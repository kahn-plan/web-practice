const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../predict.js');

const game = (no, samsung, kia, home = 'samsung') => ({ id: 'g' + no, no, home, score: { samsung, kia } });

test('기록이 없으면 중립 50%, 홈팀이 약간 유리하다', () => {
  assert.equal(P.predict([]).pSamsung, 0.5);
  const home = P.predict([], { home: 'kia' });
  assert.ok(home.pKia > 0.5 && home.pKia < 0.55);
  assert.equal(home.pick, 'kia');
});

test('이긴 쪽, 점수 차가 큰 쪽의 확률이 올라간다', () => {
  const one = P.predict([game(1, 5, 3)]);
  const two = P.predict([game(1, 5, 3), game(2, 7, 1)]);
  assert.ok(one.pSamsung > 0.5);
  assert.ok(two.pSamsung > one.pSamsung);
  assert.equal(two.pick, 'samsung');
  assert.ok(two.predictedScore.samsung > two.predictedScore.kia);
});

test('경기 전 기록은 무시하고, 무승부는 승패에 넣지 않는다', () => {
  const s = P.summarize([game(1, 4, 4), { id: 'x', no: 2, home: 'kia', score: null }]);
  assert.deepEqual(s.wins, { samsung: 0, kia: 0 });
  assert.equal(s.draws, 1);
  assert.equal(s.played, 1);
  assert.equal(P.predict([game(1, 4, 4)]).pSamsung, 0.5);
});

test('시리즈 승리 확률', () => {
  assert.equal(P.seriesWinProb(0.5, 3, 3), 0.5);
  assert.equal(P.seriesWinProb(0.3, 0, 2), 1);
  assert.equal(P.seriesWinProb(0.9, 2, 0), 0);
  assert.ok(Math.abs(P.seriesWinProb(0.5, 1, 3) - 0.875) < 1e-12);
});

test('모델 평가는 그 경기 이전 기록만 쓴다', () => {
  const rows = P.evaluate([game(2, 1, 6, 'kia'), game(1, 5, 3)]);
  assert.deepEqual(rows.map((r) => r.id), ['g1', 'g2']);
  assert.equal(rows[0].model.sampleSize, 0);
  assert.equal(rows[0].modelHit, true);   // 기록 0 → 홈(삼성) 선택, 삼성 승
  assert.equal(rows[1].model.sampleSize, 1);
  assert.equal(rows[1].actual, 'kia');
});

test('KBO 홈 배정: 5전제 2-2-1, 7전제 2-3-2', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => P.homeFor(n, 3, 'kia')), ['kia', 'kia', 'samsung', 'samsung', 'kia']);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => P.homeFor(n, 4, 'samsung')),
    ['samsung', 'samsung', 'kia', 'kia', 'kia', 'samsung', 'samsung']);
});
