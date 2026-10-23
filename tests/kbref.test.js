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
const MODS = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl', 'interior', 'fundamentals', 'basics', 'economics', 'decentral', 'safety', 'digital', 'construction', 'environment'];
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
      assert.ok(f[3] === null || (Number.isInteger(f[3]) && f[3] >= 0), `${d.id}: страница`);
      if (d.mods !== 'all') assert.ok(d.mods.includes(f[0]), `${d.id}: тема для модуля ${f[0]}, к которому документ не привязан`);
    }
  }
});

test('внутренние ссылки #doc-… в данных ведут на существующие документы', () => {
  const files = ['docs.js', 'kb.js', 'kbview.js', 'docsview.js', 'plan.js', 'its.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
  for (const src of files) for (const [, id] of src.matchAll(/#doc-([a-z0-9]+)/g)) assert.ok(DOC_IDS.has(id), '#doc-' + id);
});

test('курсы: ссылки уроков ведут на существующие статьи, модули и курсы-предшественники существуют', () => {
  const { C } = require('../js/courses.js');
  const D = require('../js/data.js');
  const ok = new Set([...D.UNITS.map(u => '#kb-u-' + u.id), ...KB.AUX.map(a => '#kb-a-' + a.id), ...KB.PROCESSES.map(p => '#kb-p-' + p.id),
    ...KB.INDICATORS.map(p => '#kb-i-' + p.id), ...KB.FUNDAMENTALS.map(p => '#kb-f-' + p.id), ...KB.HUMANITIES.map(p => '#kb-h-' + p.id), ...KB.NETWORK.map(p => '#kb-n-' + p.id), ...KB.DRINKING.map(p => '#kb-w-' + p.id), ...require('../js/dwcalc.js').UNITS.map(u => '#kb-v-' + u.id),
    ...DOCS.map(d => '#doc-' + d.id), ...G.map(g => '#kb-g-' + g.id)]);
  const ids = new Set(C.map(c => c.id));
  assert.equal(ids.size, C.length, 'id уникальны');
  for (const m of MODS.slice(0, 11)) assert.ok(C.some(c => c.mods.includes(m)), 'у модуля есть курсы: ' + m); // кластер и «Основы»; у смежных областей курсы появятся позже
  for (const c of C) {
    assert.match(c.id, /^[a-z]+-[a-z]+$/, c.id);
    assert.ok(c.mods.length && c.mods.every(m => MODS.includes(m)), c.id);
    assert.ok(['Основы', 'Практика', 'Проектирование', 'Эксплуатация', 'Углублённый'].includes(c.lvl), c.id);
    assert.ok(c.out.length >= 2 && c.L.length >= 4, c.id);
    for (const p of c.pre || []) assert.ok(ids.has(p) && p !== c.id, `${c.id} → ${p}`);
    for (const [t, q, kb, todo, ia] of c.L) {
      assert.ok(t && q.endsWith('?') && Array.isArray(todo) && Array.isArray(ia), `${c.id}: ${t}`);
      assert.ok(kb.length + todo.length > 0, `${c.id}: ${t} — урок без материалов`);
      for (const k of kb) assert.ok(ok.has(k.split('@')[0]), `${c.id}: ${k}`);
    }
  }
});

test('учебники: у каждой книги базы знаний есть запись о том, где её взять, ссылки корректны', () => {
  const B = require('../js/books.js');
  const all = [...KB.BOOKS.flatMap(g => g.list), ...Object.values(KB.MODULE_BOOKS).flatMap(gs => gs.flatMap(g => g.list)), ...KB.FUNDAMENTALS.flatMap(f => f.books), ...KB.HUMANITIES.flatMap(f => f.books)];
  for (const [a, t] of all) assert.ok(B.LINKS[B.key(a, t)], 'нет записи о ссылках: ' + a + ' — ' + t);
  const kinds = ['read', 'buy', 'ebs', 'used', 'lib'];
  const check = l => { assert.ok(kinds.includes(l[0]) && l[1], l.join(' ')); assert.match(l[2], /^https?:\/\//, l[2]); assert.ok(!/twirpx|studmed|obuchalka|totalarch|elima|b-ok|zlib|dokumen\.pub/.test(l[2]), 'пиратский сайт: ' + l[2]); };
  Object.values(B.LINKS).forEach(ls => ls.forEach(check));
  [...Object.values(B.EXTRA).flatMap(gs => gs.flatMap(g => g.list)), ...Object.values(B.FUND).flat()].forEach(b => { assert.equal(b.length, 4, b[1]); b[3].forEach(check); });
  for (const f of Object.keys(B.FUND)) assert.ok(KB.FUNDAMENTALS.some(x => x.id === f), f);
  for (const m of Object.keys(B.EXTRA)) assert.ok(MODS.includes(m), m);
});
