// Тесты базы знаний. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const KB = require('../js/kb.js');
const D = require('../js/data.js');

test('у каждого сооружения каталога есть связанные процессы, и они существуют', () => {
  const procs = new Set(KB.PROCESSES.map(p => p.id));
  assert.equal(procs.size, KB.PROCESSES.length, 'id процессов уникальны');
  for (const u of D.UNITS) {
    assert.ok(KB.UNIT_PROC[u.id] && KB.UNIT_PROC[u.id].length, u.id + ': нет процессов');
    for (const p of KB.UNIT_PROC[u.id]) assert.ok(procs.has(p), `${u.id} → ${p}`);
  }
  for (const id of Object.keys(KB.UNIT_PROC)) assert.ok(D.UNITS.some(u => u.id === id), 'лишнее сооружение ' + id);
});

test('статьи о процессах и показателях заполнены, показатели расчёта описаны все', () => {
  for (const p of KB.PROCESSES) assert.ok(p.t && p.lead.length > 60 && p.s.length >= 2, p.id);
  const ids = new Set(KB.INDICATORS.map(i => i.id));
  assert.equal(ids.size, KB.INDICATORS.length);
  for (const par of D.PARAMS) assert.ok(KB.INDICATORS.some(i => i.k === par.k), 'нет статьи о ' + par.k);
  for (const i of KB.INDICATORS) assert.ok(i.what && i.why && i.how && i.typ, i.id);
});

test('ссылки на журналы и сообщества — https, учебники с выходными данными', () => {
  for (const g of [...KB.JOURNALS, ...KB.COMMUNITIES]) for (const [t, d, u] of g.list) { assert.match(u, /^https:\/\//, t); assert.ok(d, t); }
  for (const b of KB.BOOKS) for (const [a, t, pub] of b.list) assert.ok(a && t && pub, t);
});

test('у каждого модуля есть история божества с главами и источником', () => {
  const vm = require('node:vm'), fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../js/lore.js'), 'utf8');
  const ctx = { document: { getElementById: () => ({ addEventListener() {} }) }, VIEW_RENDER: {} };
  vm.runInNewContext(src + '\nthis.LORE = LORE;', ctx);
  const { MODULES } = require('../js/modules.js');
  for (const m of MODULES) {
    const L = ctx.LORE[m.id];
    assert.ok(L, 'нет истории для ' + m.id);
    assert.ok(L.chapters.length >= 4 && L.chapters.every(c => c.t && c.p.length), m.id);
    assert.ok(L.sources.some(([, u]) => u && u.startsWith('https://')), m.id);
  }
});
