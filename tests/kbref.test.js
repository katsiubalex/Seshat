// Целостность ссылок базы знаний: глоссарий, методики, редакции и «Где искать» в документах. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DOCS } = require('../js/docs.js');
const KB = require('../js/kb.js');
require('../js/glossary.js');
require('../js/methods.js');
const { G } = globalThis.SeshatGlossary;
const MET = globalThis.SeshatMethods;
const MODS = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl'];
const DOC_IDS = new Set(DOCS.map(d => d.id));

test('у каждого термина глоссария есть определение, документ-источник и пункт', () => {
  const ids = new Set();
  for (const g of G) {
    assert.ok(!ids.has(g.id), 'id уникальны: ' + g.id); ids.add(g.id);
    assert.match(g.id, /^[a-z0-9-]+$/, g.id);
    assert.ok(DOC_IDS.has(g.src), `${g.id}: документ ${g.src} есть в базе`);
    assert.ok(g.def.length > 20 && g.ref, g.id);
    assert.equal(typeof g.q, 'boolean', g.id + ': отмечено, цитата или изложение');
  }
});

test('методики привязаны к существующим показателям и подтверждены источником', () => {
  const ind = new Set(KB.INDICATORS.map(i => i.id));
  for (const [id, list] of Object.entries(MET.M)) {
    assert.ok(ind.has(id), 'показатель ' + id);
    for (const [n, m, w, src] of list) {
      assert.match(n, /^(ПНД Ф|ГОСТ|РД|МУК|ФР)/, n);
      assert.ok(m && w && src.length, n);
      for (const s of src) assert.ok(MET.SRC[s], `${n}: источник ${s}`);
    }
  }
  for (const id of Object.keys(MET.TODO)) assert.ok(ind.has(id) && !MET.M[id], 'в списке «подобрать» — ' + id);
});

test('редакции, структура и «Где искать» в документах заполнены корректно', () => {
  for (const d of DOCS) {
    for (const c of d.changes || []) assert.equal(c.length, 3, d.id + ': редакция — [что, акт, когда]');
    if (d.checked) assert.match(d.checked[0], /^(\d{2}\.)?\d{2}\.\d{4}$/, d.id + ': дата проверки');
    if (d.toc) for (let i = 1; i < d.toc.length; i++) assert.ok(d.toc[i][2] >= d.toc[i - 1][2], d.id + ': страницы по возрастанию');
    for (const f of d.find || []) {
      assert.ok(MODS.includes(f[0]), `${d.id}: модуль ${f[0]}`);
      assert.ok(Number.isInteger(f[3]) && f[3] > 0, `${d.id}: страница`);
      if (d.mods !== 'all') assert.ok(d.mods.includes(f[0]), `${d.id}: тема для модуля ${f[0]}, к которому документ не привязан`);
    }
  }
});

test('внутренние ссылки #doc-… в данных ведут на существующие документы', () => {
  const files = ['docs.js', 'kb.js', 'kbview.js', 'docsview.js', 'plan.js', 'its.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
  for (const src of files) for (const [, id] of src.matchAll(/#doc-([a-z0-9]+)/g)) assert.ok(DOC_IDS.has(id), '#doc-' + id);
});

test('учебный план: дисциплины привязаны к модулям, у каждой есть темы и литература со ссылками', () => {
  const C = require('../js/curriculum.js');
  const fund = new Set(KB.FUNDAMENTALS.map(f => f.id)), ids = new Set();
  assert.equal(C.DISC.length, 20);
  for (const d of C.DISC) {
    assert.ok(!ids.has(d.id), d.id); ids.add(d.id);
    assert.ok(d.mods === 'all' || d.mods.every(m => MODS.includes(m)), d.id + ': модули');
    assert.ok(!d.fund || fund.has(d.fund), d.id + ': фундаментальная дисциплина');
    assert.ok(d.topics.length >= 4 && d.lit.length >= 1 && d.ze > 0 && d.h === d.ze * 36, d.id);
    for (const [c, a, t, pub, u, isbn] of d.lit) {
      assert.ok(['осн', 'доп', 'умл'].includes(c) && a && t && /(19|20)\d\d$/.test(pub), `${d.id}: ${t}`);
      if (u) assert.match(u, /^https?:\/\//, t);
      if (isbn) assert.match(isbn, /^97[89]\d{10}$/, t);
    }
  }
});
