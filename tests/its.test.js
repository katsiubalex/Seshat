const test = require('node:test');
const assert = require('node:assert');
global.window = global;
require('../js/data.js');
const SeshatModel = require('../js/model.js');
const ITS = require('../js/its.js');
const { UNITS } = SeshatData;

test('каждая технология каталога сверена со справочником ИТС 10-2019', () => {
  for (const u of UNITS) {
    const v = ITS.UNITS[u.id];
    assert.ok(v, `нет сверки для ${u.id}`);
    assert.ok(ITS.STATUS[v.st], `${u.id}: неизвестный статус`);
    assert.ok(v.its && v.sum.length && v.refs.length, `${u.id}: нет пересказа или ссылок`);
  }
});

test('все ссылки ведут на существующие страницы справочника', () => {
  for (const [id, v] of Object.entries(ITS.UNITS)) {
    for (const x of [...v.sum, ...(v.facts || []), ...v.refs]) {
      const p = x[x.length - 1];
      assert.ok(Number.isInteger(p) && p >= 1 && p <= 417, `${id}: страница ${p}`);
    }
    (v.ndt || []).forEach(c => assert.ok(ITS.NDT[c], `${id}: нет НДТ ${c}`));
    (v.schemes || []).forEach(k => assert.match(ITS.scheme(k), /<svg/, `${id}: схема ${k}`));
  }
  assert.match(ITS.link(98), /#page=117$/); // страница документа 98 = страница PDF 117
});

test('НДТ получают только технологии, которые справочник относит к НДТ', () => {
  for (const [id, v] of Object.entries(ITS.UNITS)) {
    if (v.st === 'none') assert.ok(!(v.ndt || []).length, `${id}: «нет в справочнике», но указаны НДТ`);
  }
});

test('биофильтры доочистки доводят аммоний до уровня справочника (≤ 1 мг/л)', () => {
  const st = { q: 20000, c: { ss: 0, bod: 0, cod: 0, nh4: 0, no2: 0, no3: 0, p: 0, oil: 0, fat: 0 } };
  const out = SeshatModel.simulate({ ...st, c: { ...st.c, nh4: 1.14, no3: 5.5, bod: 7, cod: 30 }, steps: [{ u: 'nitf', eff: { ...UNITS.find(u => u.id === 'nitf').eff } }] }).out;
  assert.ok(out.nh4 <= 0.4, `аммоний ${out.nh4}`);
  assert.ok(out.no3 > 5.5, 'аммоний переходит в нитраты');
});
