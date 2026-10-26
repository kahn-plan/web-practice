const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'data', 'games.js'), 'utf8');
const TEAMS = ['samsung', 'kia'];

test('data/games.js 는 window.PLAYOFF_DATA = <JSON>; 형태다', () => {
  const m = src.match(/^window\.PLAYOFF_DATA\s*=\s*([\s\S]*);\s*$/m);
  assert.ok(m, 'window.PLAYOFF_DATA = ...; 를 찾지 못했습니다');
  const data = JSON.parse(m[1]);

  assert.match(data.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok([2, 3, 4].includes(data.settings.winsNeeded));
  assert.ok(TEAMS.includes(data.settings.topSeed));
  assert.ok(Array.isArray(data.games));

  const nos = new Set();
  for (const g of data.games) {
    const where = `${g.no}차전`;
    assert.ok(Number.isInteger(g.no) && g.no >= 1 && g.no <= 15, where + ': no');
    assert.ok(!nos.has(g.no), where + ': 차전 번호 중복');
    nos.add(g.no);
    assert.match(g.date, /^\d{4}-\d{2}-\d{2}$/, where + ': date');
    assert.ok(TEAMS.includes(g.home), where + ': home');
    assert.equal(typeof g.spSamsung, 'string', where + ': spSamsung');
    assert.equal(typeof g.spKia, 'string', where + ': spKia');
    if (g.score !== null) {
      for (const t of TEAMS) assert.ok(Number.isInteger(g.score[t]) && g.score[t] >= 0, where + ': score.' + t);
    }
  }
});
