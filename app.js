(function () {
  'use strict';

  const P = window.Predict;
  const STORAGE_KEY = 'web-practice:playoff:v1';
  const NAMES = { samsung: '삼성', kia: 'KIA' };
  const $ = (sel) => document.querySelector(sel);

  let state; // 아래 함수들이 모두 정의된 뒤, 맨 끝에서 불러옵니다.
  let editingId = null;

  // ---------- 저장 ----------

  function defaultState() {
    return { settings: { winsNeeded: 3, topSeed: 'samsung' }, games: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* 저장소를 못 쓰면 빈 상태로 시작 */ }
    return defaultState();
  }

  let warnedSave = false;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (warnedSave) return;
      warnedSave = true;
      alert('브라우저에 저장하지 못했습니다. 창을 닫기 전에 JSON 내보내기로 백업해 주세요.');
    }
  }

  function toInt(v, max = 99) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
  }

  function cleanScore(s) {
    if (!s) return null;
    const samsung = toInt(s.samsung);
    const kia = toInt(s.kia);
    return samsung === null || kia === null ? null : { samsung, kia };
  }

  const team = (v) => (v === 'samsung' || v === 'kia' ? v : null);
  const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

  // 가져온 JSON 이나 저장된 값을 믿지 않고 필요한 모양으로만 다시 만듭니다.
  function normalize(data) {
    const base = defaultState();
    if (!data || typeof data !== 'object') return base;
    const s = data.settings || {};
    const winsNeeded = [2, 3, 4].includes(s.winsNeeded) ? s.winsNeeded : base.settings.winsNeeded;
    const topSeed = team(s.topSeed) || base.settings.topSeed;
    const games = (Array.isArray(data.games) ? data.games : [])
      .map((g) => ({
        id: text(g.id, 40) || newId(),
        no: toInt(g.no, 15),
        date: /^\d{4}-\d{2}-\d{2}$/.test(g.date) ? g.date : '',
        home: team(g.home) || topSeed,
        spSamsung: text(g.spSamsung, 20),
        spKia: text(g.spKia, 20),
        myPick: team(g.myPick) || '',
        myScore: cleanScore(g.myScore),
        score: cleanScore(g.score),
        memo: text(g.memo, 300),
        note: text(g.note, 100),
      }))
      .filter((g) => g.no);
    return { settings: { winsNeeded, topSeed }, games };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- 공식 기록 (data/games.js) ----------

  // 일정·선발·결과는 data/games.js 의 공식 기록을, 내 예측·메모는 이 브라우저 저장분을 씁니다.
  // 같은 차전이면 공식 기록이 우선입니다.
  const hasOfficial = !!window.PLAYOFF_DATA;
  const OFFICIAL = normalize(window.PLAYOFF_DATA);
  const officialByNo = new Map(OFFICIAL.games.map((g) => [g.no, g]));
  const officialUpdated = hasOfficial ? text(window.PLAYOFF_DATA.updatedAt, 40) : '';

  const settings = () => (hasOfficial ? OFFICIAL.settings : state.settings);

  function mergeOfficial(o, local) {
    const l = local || {};
    return {
      id: l.id || 'official-' + o.no,
      no: o.no,
      date: o.date || l.date || '',
      home: o.home,
      spSamsung: o.spSamsung || l.spSamsung || '',
      spKia: o.spKia || l.spKia || '',
      score: o.score || l.score || null,
      myPick: l.myPick || '',
      myScore: l.myScore || null,
      memo: l.memo || '',
      official: o,
    };
  }

  function allGames() {
    const merged = state.games.map((g) => (officialByNo.has(g.no) ? mergeOfficial(officialByNo.get(g.no), g) : g));
    for (const o of OFFICIAL.games) {
      if (!state.games.some((g) => g.no === o.no)) merged.push(mergeOfficial(o, null));
    }
    return merged;
  }

  // ---------- 계산 ----------

  const sortedGames = () => allGames().sort((a, b) => a.no - b.no);

  function seriesState() {
    const s = P.summarize(allGames());
    const need = settings().winsNeeded;
    const winner = s.wins.samsung >= need ? 'samsung' : s.wins.kia >= need ? 'kia' : null;
    return { ...s, need, winner };
  }

  // 다음 예측 대상: 결과가 없는 가장 앞 경기, 없으면 마지막 경기 다음 차전
  function nextTarget() {
    const games = sortedGames();
    const pending = games.find((g) => !P.isPlayed(g));
    if (pending) return { no: pending.no, home: pending.home, existing: pending };
    const no = games.length ? games[games.length - 1].no + 1 : 1;
    return { no, home: P.homeFor(no, settings().winsNeeded, settings().topSeed), existing: null };
  }

  // ---------- 그리기 ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const pct = (p) => Math.round(p * 100) + '%';
  const teamTag = (t) => `<span class="t-${t}">${NAMES[t]}</span>`;

  function render() {
    renderSeries();
    renderNext();
    renderGames();
    renderStats();
    $('#winsNeeded').value = String(settings().winsNeeded);
    $('#topSeed').value = settings().topSeed;
  }

  function renderSeries() {
    const s = seriesState();
    $('#series').innerHTML =
      `<span class="num t-samsung">${s.wins.samsung}</span><span class="dash">:</span><span class="num t-kia">${s.wins.kia}</span>`;
    let note = `${s.need}승 선승제`;
    if (s.draws) note += ` · 무승부 ${s.draws}`;
    if (s.winner) note = `${NAMES[s.winner]} 시리즈 승리 · ` + note;
    else if (s.played) note += ` · ${s.played}경기 진행`;
    else note += ' · 아직 기록된 경기가 없습니다';
    if (officialUpdated) note += ` · 공식 기록 갱신 ${officialUpdated}`;
    $('#seriesNote').textContent = note;
  }

  let nextHomeOverride = null;

  function renderNext() {
    const s = seriesState();
    const target = nextTarget();
    const home = nextHomeOverride || target.home;
    $('#nextHome').value = home;

    const m = P.predict(allGames(), { home });
    const series = s.winner ? null : P.seriesWinProb(m.neutral, s.need - s.wins.samsung, s.need - s.wins.kia);
    const fav = m.pick;
    const homeEffect = Math.round(Math.abs(m.factors.home) * 100);
    const ex = target.existing;
    const detail = ex
      ? (ex.spSamsung || ex.spKia ? `선발 ${esc(ex.spSamsung || '?')} vs ${esc(ex.spKia || '?')}` : '') +
        (ex.official && ex.official.note ? ` · ${esc(ex.official.note)}` : '')
      : '';
    const button = !ex ? `${target.no}차전 등록하기` : ex.official ? `${target.no}차전 내 예측 입력` : `${target.no}차전 결과 입력`;

    $('#next').innerHTML = `
      <p class="target">${target.no}차전 · 홈 ${teamTag(home)}${ex && ex.date ? ' · ' + esc(ex.date) : ''}${s.winner ? ' <span class="muted">(시리즈 종료 후 가상 경기)</span>' : ''}</p>
      ${detail ? `<p class="meta target-meta">${detail.replace(/^ · /, '')}</p>` : ''}
      <div class="prob">
        <div class="prob-label">${teamTag('samsung')}<strong>${pct(m.pSamsung)}</strong></div>
        <div class="bar" role="img" aria-label="삼성 ${pct(m.pSamsung)}, KIA ${pct(m.pKia)}">
          <span class="bar-samsung" style="width:${(m.pSamsung * 100).toFixed(1)}%"></span>
          <span class="bar-kia" style="width:${(m.pKia * 100).toFixed(1)}%"></span>
        </div>
        <div class="prob-label right"><strong>${pct(m.pKia)}</strong>${teamTag('kia')}</div>
      </div>
      <div class="summary">
        <div><span class="muted">예상 승리</span><strong>${teamTag(fav)}</strong></div>
        <div><span class="muted">예상 스코어</span><strong>${m.predictedScore.samsung} : ${m.predictedScore.kia}</strong></div>
        ${series === null ? '' : `<div><span class="muted">시리즈 승리 확률</span><strong>${teamTag('samsung')} ${pct(series)} · ${teamTag('kia')} ${pct(1 - series)}</strong></div>`}
      </div>
      <details>
        <summary>예측 근거 (삼성 기준)</summary>
        <ul class="factors">
          <li><span>상대 전적</span><strong>${pct(m.factors.series)}</strong></li>
          <li><span>득실점 (피타고리안)</span><strong>${pct(m.factors.runs)}</strong></li>
          <li><span>최근 3경기 흐름</span><strong>${pct(m.factors.recent)}</strong></li>
          <li><span>홈 이점</span><strong>${teamTag(home)} +${homeEffect}%p</strong></li>
        </ul>
        <p class="muted">기록된 ${m.sampleSize}경기 기준입니다. 기록이 적을수록 50:50에 가깝게 보정됩니다.
        평균 득점 예상: 삼성 ${m.expectedRuns.samsung.toFixed(1)}점, KIA ${m.expectedRuns.kia.toFixed(1)}점.</p>
      </details>
      <div class="actions">
        <button type="button" class="primary" id="recordNext">${button}</button>
      </div>`;

    $('#recordNext').addEventListener('click', () => {
      if (target.existing) startEdit(target.existing.id);
      else fillForm({ no: target.no, home, myPick: '' });
      $('#formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function renderGames() {
    const evals = new Map(P.evaluate(allGames()).map((e) => [e.id, e]));
    const games = sortedGames();
    if (!games.length) {
      $('#games').innerHTML = '<p class="muted">아직 기록이 없습니다. 위에서 1차전을 등록해 보세요.</p>';
      return;
    }
    const mark = (hit) => (hit === null ? '' : hit ? '<span class="hit">적중</span>' : '<span class="miss">실패</span>');

    $('#games').innerHTML = '<ul class="game-list">' + games.map((g) => {
      const e = evals.get(g.id);
      const played = P.isPlayed(g);
      const result = played
        ? `${teamTag('samsung')} <strong>${g.score.samsung} : ${g.score.kia}</strong> ${teamTag('kia')}` +
          (e.actual === 'draw' ? ' <span class="muted">무승부</span>' : ` <span class="muted">${NAMES[e.actual]} 승</span>`)
        : '<span class="pending">경기 전</span>';
      const my = g.myPick
        ? `${teamTag(g.myPick)}${g.myScore ? ` (${g.myScore.samsung}:${g.myScore.kia})` : ''} ${mark(e.myHit)}${e.myExact ? ' <span class="hit">스코어 적중</span>' : ''}`
        : '<span class="muted">없음</span>';
      const modelP = e.model.pick === 'samsung' ? e.model.pSamsung : e.model.pKia;
      const sp = g.spSamsung || g.spKia
        ? `<div class="meta">선발 ${esc(g.spSamsung || '?')} vs ${esc(g.spKia || '?')}</div>` : '';
      return `
        <li class="game${played ? '' : ' is-pending'}">
          <div class="game-top">
            <strong>${g.no}차전</strong>
            <span class="muted">${g.date ? esc(g.date) + ' · ' : ''}홈 ${NAMES[g.home]}</span>
            ${g.official ? '<span class="badge">공식</span>' : ''}
            <span class="game-actions">
              <button type="button" class="link" data-edit="${esc(g.id)}">${g.official ? '내 예측' : '수정'}</button>
              ${g.official ? '' : `<button type="button" class="link danger" data-del="${esc(g.id)}">삭제</button>`}
            </span>
          </div>
          <div class="result">${result}</div>
          ${sp}
          ${g.official && g.official.note ? `<div class="meta">${esc(g.official.note)}</div>` : ''}
          <div class="preds">
            <div><span class="muted">내 예측</span> ${my}</div>
            <div><span class="muted">모델</span> ${teamTag(e.model.pick)} ${pct(modelP)} ${mark(e.modelHit)}</div>
          </div>
          ${g.memo ? `<p class="memo">${esc(g.memo)}</p>` : ''}
        </li>`;
    }).join('') + '</ul>';
  }

  function renderStats() {
    const evals = P.evaluate(allGames());
    const s = seriesState();
    const rate = (list, key) => {
      const done = list.filter((e) => e[key] !== null);
      const hits = done.filter((e) => e[key]).length;
      return done.length ? `${hits}/${done.length} <span class="muted">(${pct(hits / done.length)})</span>` : '<span class="muted">-</span>';
    };
    const avg = (t) => (s.played ? (s.runs[t] / s.played).toFixed(1) : '-');

    $('#stats').innerHTML = `
      <div class="stat-grid">
        <div class="stat"><span class="muted">내 승부 예측</span><strong>${rate(evals, 'myHit')}</strong></div>
        <div class="stat"><span class="muted">모델 승부 예측</span><strong>${rate(evals, 'modelHit')}</strong></div>
        <div class="stat"><span class="muted">내 스코어 적중</span><strong>${rate(evals, 'myExact')}</strong></div>
        <div class="stat"><span class="muted">경기당 평균 득점</span><strong>${teamTag('samsung')} ${avg('samsung')} · ${teamTag('kia')} ${avg('kia')}</strong></div>
      </div>
      <p class="muted">모델 성적은 각 경기를 그 이전 경기 기록만으로 예측했을 때 기준입니다.</p>`;
  }

  // ---------- 폼 ----------

  const form = $('#gameForm');
  const fields = form.elements;

  function fillForm(g) {
    form.reset();
    fields.no.value = g.no ?? '';
    fields.date.value = g.date || '';
    fields.home.value = g.home || settings().topSeed;
    fields.spSamsung.value = g.spSamsung || '';
    fields.spKia.value = g.spKia || '';
    form.querySelector(`input[name="myPick"][value="${g.myPick || ''}"]`).checked = true;
    fields.mySamsung.value = g.myScore ? g.myScore.samsung : '';
    fields.myKia.value = g.myScore ? g.myScore.kia : '';
    fields.scoreSamsung.value = g.score ? g.score.samsung : '';
    fields.scoreKia.value = g.score ? g.score.kia : '';
    fields.memo.value = g.memo || '';
    $('#formError').textContent = '';

    // 공식 기록이 채운 칸은 잠가서 내 예측·메모만 고치게 합니다.
    const o = g.official || null;
    const locks = {
      no: !!o, home: !!o, date: !!(o && o.date),
      spSamsung: !!(o && o.spSamsung), spKia: !!(o && o.spKia),
      scoreSamsung: !!(o && o.score), scoreKia: !!(o && o.score),
    };
    for (const [name, on] of Object.entries(locks)) fields[name].disabled = on;
    $('#officialNote').hidden = !o;
  }

  function startEdit(id) {
    const g = allGames().find((x) => x.id === id);
    if (!g) return;
    editingId = id;
    fillForm(g);
    $('#formTitle').textContent = `${g.no}차전 수정`;
    $('#submitBtn').textContent = '수정 저장';
    $('#cancelEdit').hidden = false;
  }

  function endEdit() {
    editingId = null;
    $('#formTitle').textContent = '경기 기록 추가';
    $('#submitBtn').textContent = '저장';
    $('#cancelEdit').hidden = true;
    const t = nextTarget();
    fillForm({ no: t.existing ? '' : t.no, home: t.home });
  }

  // 두 칸이 모두 비었으면 null, 하나만 채웠거나 잘못된 값이면 오류
  function readPair(a, b, label) {
    if (a === '' && b === '') return { value: null };
    const value = cleanScore({ samsung: a, kia: b });
    return value ? { value } : { error: `${label}는 두 팀 모두 0~99 사이 정수로 입력해 주세요.` };
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = (msg) => { $('#formError').textContent = msg; };

    const no = toInt(fields.no.value, 15);
    if (!no) return err('경기 번호는 1~15 사이로 입력해 주세요.');
    if (allGames().some((g) => g.no === no && g.id !== editingId)) return err(`${no}차전은 이미 있습니다. 목록에서 수정해 주세요.`);

    const myScore = readPair(fields.mySamsung.value, fields.myKia.value, '예상 스코어');
    if (myScore.error) return err(myScore.error);
    const score = readPair(fields.scoreSamsung.value, fields.scoreKia.value, '실제 결과');
    if (score.error) return err(score.error);

    let myPick = form.querySelector('input[name="myPick"]:checked').value;
    if (myScore.value && myScore.value.samsung !== myScore.value.kia) {
      const byScore = myScore.value.samsung > myScore.value.kia ? 'samsung' : 'kia';
      if (myPick && myPick !== byScore) return err('예상 스코어와 예측 승리팀이 다릅니다.');
      myPick = byScore;
    }

    const game = {
      id: editingId || newId(),
      no,
      date: fields.date.value,
      home: team(fields.home.value) || settings().topSeed,
      spSamsung: fields.spSamsung.value.trim().slice(0, 20),
      spKia: fields.spKia.value.trim().slice(0, 20),
      myPick,
      myScore: myScore.value,
      score: score.value,
      memo: fields.memo.value.trim().slice(0, 300),
    };

    if (state.games.some((g) => g.id === game.id)) state.games = state.games.map((g) => (g.id === game.id ? game : g));
    else state.games.push(game);
    nextHomeOverride = null;
    save();
    endEdit();
    render();
  });

  // 경기 번호를 바꾸면 KBO 홈 배정 규칙에 맞춰 홈팀을 미리 골라줍니다 (새 경기일 때만).
  fields.no.addEventListener('input', () => {
    const no = toInt(fields.no.value, 15);
    if (no && !editingId) fields.home.value = P.homeFor(no, settings().winsNeeded, settings().topSeed);
  });

  $('#cancelEdit').addEventListener('click', endEdit);

  $('#games').addEventListener('click', (ev) => {
    const edit = ev.target.closest('[data-edit]');
    const del = ev.target.closest('[data-del]');
    if (edit) {
      startEdit(edit.dataset.edit);
      $('#formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (del) {
      const g = state.games.find((x) => x.id === del.dataset.del);
      if (!g || !confirm(`${g.no}차전 기록을 삭제할까요?`)) return;
      state.games = state.games.filter((x) => x.id !== g.id);
      if (editingId === g.id) endEdit();
      save();
      render();
    }
  });

  $('#nextHome').addEventListener('change', (ev) => {
    nextHomeOverride = team(ev.target.value);
    renderNext();
  });

  // ---------- 설정 · 데이터 ----------

  $('#winsNeeded').addEventListener('change', (ev) => {
    state.settings.winsNeeded = Number(ev.target.value);
    save();
    render();
  });

  $('#topSeed').addEventListener('change', (ev) => {
    state.settings.topSeed = team(ev.target.value) || 'samsung';
    nextHomeOverride = null;
    save();
    render();
    if (!editingId) endEdit();
  });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `playoff-records-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#importBtn').addEventListener('click', () => $('#importFile').click());

  $('#importFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!confirm(`${data.games.length}경기 기록으로 현재 기록을 바꿀까요?`)) return;
      state = data;
      nextHomeOverride = null;
      save();
      endEdit();
      render();
    } catch (e) {
      alert('JSON 파일을 읽지 못했습니다.');
    }
  });

  $('#resetBtn').addEventListener('click', () => {
    const what = hasOfficial ? '내 예측·메모와 직접 입력한 기록을 지울까요? 공식 기록은 남습니다.' : '모든 경기 기록을 지울까요?';
    if (!confirm(what + ' 되돌릴 수 없습니다.')) return;
    state = defaultState();
    nextHomeOverride = null;
    save();
    endEdit();
    render();
  });

  // 공식 기록이 있으면 시리즈 방식·상위 시드는 그 값을 따릅니다.
  if (hasOfficial) {
    $('#winsNeeded').disabled = true;
    $('#topSeed').disabled = true;
    $('#settingsNote').hidden = false;
  }

  state = load();
  render();
  endEdit();
})();
