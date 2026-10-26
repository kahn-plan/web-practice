// 삼성 vs KIA 시리즈 승부 예측 모델.
// 브라우저에서는 window.Predict, Node(테스트)에서는 module.exports 로 씁니다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Predict = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 기록이 적을 때 한쪽으로 쏠리지 않도록, 50:50 가상 경기를 섞어서 계산합니다.
  const PRIOR_GAMES = 2;
  const PRIOR_RUNS = 4.5;            // 가상 경기의 팀당 평균 득점
  const PYTH_EXP = 1.83;             // 피타고리안 승률 지수
  const RECENT_WEIGHTS = [3, 2, 1];  // 가장 최근 경기부터의 가중치
  const HOME_LOGIT = 0.12;           // 홈 이점 (50% 기준 약 +3%p)
  const FACTOR_WEIGHTS = { series: 0.35, runs: 0.4, recent: 0.25 };

  const logit = (p) => Math.log(p / (1 - p));
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const byNo = (a, b) => a.no - b.no;

  function isPlayed(g) {
    return !!g.score && Number.isFinite(g.score.samsung) && Number.isFinite(g.score.kia);
  }

  // 'samsung' | 'kia' | 'draw' | null(경기 전)
  function winnerOf(g) {
    if (!isPlayed(g)) return null;
    const { samsung, kia } = g.score;
    if (samsung > kia) return 'samsung';
    if (kia > samsung) return 'kia';
    return 'draw';
  }

  function summarize(games) {
    const s = { played: 0, draws: 0, wins: { samsung: 0, kia: 0 }, runs: { samsung: 0, kia: 0 } };
    for (const g of games) {
      if (!isPlayed(g)) continue;
      s.played++;
      s.runs.samsung += g.score.samsung;
      s.runs.kia += g.score.kia;
      const w = winnerOf(g);
      if (w === 'draw') s.draws++;
      else s.wins[w]++;
    }
    return s;
  }

  // 최근 경기일수록 크게 반영한 삼성의 승률
  function recentForm(played) {
    const last = played.slice(-RECENT_WEIGHTS.length).reverse();
    let num = 0.5 * PRIOR_GAMES;
    let den = PRIOR_GAMES;
    last.forEach((g, i) => {
      const w = winnerOf(g);
      num += RECENT_WEIGHTS[i] * (w === 'samsung' ? 1 : w === 'draw' ? 0.5 : 0);
      den += RECENT_WEIGHTS[i];
    });
    return num / den;
  }

  function predictedScore(expectedRuns, pick) {
    const score = { samsung: Math.round(expectedRuns.samsung), kia: Math.round(expectedRuns.kia) };
    const rival = pick === 'samsung' ? 'kia' : 'samsung';
    if (score[pick] <= score[rival]) score[pick] = score[rival] + 1;
    return score;
  }

  // history 의 경기 결과만으로 다음 경기(홈팀 home)의 삼성 승리 확률을 계산합니다.
  function predict(history, { home = null } = {}) {
    const played = history.filter(isPlayed).sort(byNo);
    const s = summarize(played);

    const decided = s.wins.samsung + s.wins.kia;
    const series = (s.wins.samsung + PRIOR_GAMES / 2) / (decided + PRIOR_GAMES);

    const rs = s.runs.samsung + PRIOR_RUNS * PRIOR_GAMES;
    const ra = s.runs.kia + PRIOR_RUNS * PRIOR_GAMES;
    const runs = rs ** PYTH_EXP / (rs ** PYTH_EXP + ra ** PYTH_EXP);

    const recent = recentForm(played);

    const neutral = sigmoid(
      FACTOR_WEIGHTS.series * logit(series) +
      FACTOR_WEIGHTS.runs * logit(runs) +
      FACTOR_WEIGHTS.recent * logit(recent)
    );
    const homeShift = home === 'samsung' ? HOME_LOGIT : home === 'kia' ? -HOME_LOGIT : 0;
    const pSamsung = sigmoid(logit(neutral) + homeShift);

    const games = played.length + PRIOR_GAMES;
    const expectedRuns = { samsung: rs / games, kia: ra / games };
    const pick = pSamsung > 0.5 ? 'samsung' : pSamsung < 0.5 ? 'kia' : (home || 'samsung');

    return {
      pSamsung,
      pKia: 1 - pSamsung,
      pick,
      home,
      neutral,
      sampleSize: played.length,
      factors: { series, runs, recent, home: pSamsung - neutral },
      expectedRuns,
      predictedScore: predictedScore(expectedRuns, pick),
    };
  }

  // 한 경기 삼성 승리 확률 p 일 때, 삼성이 needSamsung 승을 먼저 할 확률 (무승부는 무시)
  function seriesWinProb(p, needSamsung, needKia) {
    const memo = new Map();
    const f = (a, b) => {
      if (a <= 0) return 1;
      if (b <= 0) return 0;
      const key = a + ',' + b;
      if (!memo.has(key)) memo.set(key, p * f(a - 1, b) + (1 - p) * f(a, b - 1));
      return memo.get(key);
    };
    return f(needSamsung, needKia);
  }

  // 각 경기를 "그 이전 경기 기록만으로" 예측했을 때의 모델 예측과 적중 여부
  function evaluate(games) {
    const sorted = games.slice().sort(byNo);
    return sorted.map((g, i) => {
      const model = predict(sorted.slice(0, i), { home: g.home });
      const actual = winnerOf(g);
      const decided = actual === 'samsung' || actual === 'kia';
      return {
        id: g.id,
        model,
        actual,
        modelHit: decided ? model.pick === actual : null,
        myHit: decided && g.myPick ? g.myPick === actual : null,
        myExact: isPlayed(g) && g.myScore
          ? g.myScore.samsung === g.score.samsung && g.myScore.kia === g.score.kia
          : null,
      };
    });
  }

  // KBO 포스트시즌 홈 배정: 5전제 2-2-1, 7전제 2-3-2, 3전제 이하는 상위 시드 홈
  function homeFor(no, winsNeeded, topSeed) {
    const total = winsNeeded * 2 - 1;
    const lower = topSeed === 'samsung' ? 'kia' : 'samsung';
    if (total <= 3 || no > total) return topSeed;
    const topLast = total === 5 ? 1 : 2;
    return no <= 2 || no > total - topLast ? topSeed : lower;
  }

  return { isPlayed, winnerOf, summarize, predict, seriesWinProb, evaluate, homeFor };
});
