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
  for (const id of Object.keys(KB.UNIT_PROC)) assert.ok(KB.UNITS_KB.some(u => u.id === id), 'лишнее сооружение ' + id);
});

test('статьи о сооружениях: есть на каждое сооружение каталога; элементы ссылаются на существующие сооружения', () => {
  const ids = new Set(KB.UNITS_KB.map(u => u.id));
  for (const u of D.UNITS) assert.ok(ids.has(u.id), 'нет статьи о сооружении ' + u.id);
  for (const x of KB.UNITS_KB) {
    assert.ok(['unit', 'element', 'option'].includes(x.role), x.id + ': роль');
    if (x.role === 'unit') assert.ok(D.UNITS.some(u => u.id === x.id), x.id + ': сооружения нет в каталоге');
    for (const h of [...(x.part_of || []), ...(x.parts || [])]) assert.ok(ids.has(h), `${x.id} → ${h}`);
    for (const i of x.inds || []) assert.ok(KB.INDICATORS.some(k => k.id === i), `${x.id} → показатель ${i}`);
  }
});

test('статьи очистки сточных вод: у каждого абзаца есть сноска, номера сносок существуют, формулы собираются', () => {
  const RT = require('../js/richtext.js');
  const all = [...KB.UNITS_KB, ...KB.PROCESSES, ...KB.INDICATORS, ...KB.AUX];
  assert.ok(all.length > 80);
  const problems = [];
  for (const x of all) {
    const raw = [x.lead, ...x.s.map(([h, t]) => t)].join('\n\n');
    const a = RT.audit(raw, x.src.length);
    if (a.uncited.length) problems.push(`${x.id}: без сноски — «${a.uncited[0].slice(0, 70)}…»`);
    if (a.bad.length) problems.push(`${x.id}: нет источника № ${a.bad.join(', ')}`);
    if (a.tex.length) problems.push(`${x.id}: формула не собирается — ${a.tex[0]}`);
    for (const [doc, t] of x.src) assert.ok(doc && t, x.id + ': пустой источник');
  }
  assert.deepEqual(problems, []);
});

test('статьи о процессах и показателях заполнены, показатели расчёта описаны все', () => {
  for (const p of KB.PROCESSES) assert.ok(p.t && p.lead.length > 60 && p.s.length >= 2 && p.src.length, p.id);
  const ids = new Set(KB.INDICATORS.map(i => i.id));
  assert.equal(ids.size, KB.INDICATORS.length);
  for (const par of D.PARAMS) assert.ok(KB.INDICATORS.some(i => i.k === par.k), 'нет статьи о ' + par.k);
  for (const i of KB.INDICATORS) assert.ok(i.lead && i.s.length >= 2 && i.src.length && i.u, i.id);
});

test('ссылки на журналы и сообщества — https, учебники с выходными данными', () => {
  for (const g of [...KB.JOURNALS, ...KB.COMMUNITIES]) for (const [t, d, u] of g.list) { assert.match(u, /^https:\/\//, t); assert.ok(d, t); }
  for (const [id, b] of Object.entries(KB.BIB)) { assert.ok(b.a && b.t && b.pub, id); if (b.url) assert.match(b.url, /^https:\/\//, id); }
});

test('у каждого модуля свои учебники; общие разделы — фундаментальные и гуманитарные', () => {
  const { MODULES } = require('../js/modules.js');
  for (const m of MODULES.filter(x => !x.stub && x.id !== 'humanities')) { // у заготовок учебники появятся позже; у «Гуманитарных аспектов» книги — в статьях
    const groups = KB.MODULE_BOOKS[m.id];
    assert.ok(groups && groups.length, 'нет учебников у ' + m.id);
    for (const g of groups) { assert.ok(g.d && g.list.length, m.id); for (const [a, t, pub] of g.list) assert.ok(a && t && pub, m.id + ': ' + t); }
  }
  const ids = new Set(MODULES.map(m => m.id));
  for (const f of KB.FUNDAMENTALS) { assert.ok(f.t && f.lead && f.s.length && f.books.length, f.id); for (const m of f.mods) assert.ok(ids.has(m), f.id + ' → ' + m); }
  for (const h of KB.HUMANITIES) assert.ok(h.t && h.lead && h.s.length >= 2, h.id);
  assert.ok(KB.HUMANITIES.some(h => h.books.length), 'у гуманитарных статей должны быть книги');
});

test('мифы о воде: главы, источник и созвучные модули', () => {
  const My = require('../js/myths.js');
  const { MODULES } = require('../js/modules.js');
  const ids = new Set(MODULES.map(m => m.id));
  for (const g of My.GODS) {
    assert.ok(g.name && g.epithet && g.culture && g.legend, g.id);
    assert.ok(g.chapters.length >= 4 && g.chapters.every(c => c.t && c.p.length), g.id);
    assert.ok(g.sources.some(([, u]) => u && u.startsWith('https://')), g.id);
    assert.ok(g.mods.length >= 1 && g.mods.every(([m, why]) => ids.has(m) && why), g.id);
  }
  // у каждого модуля водной инфраструктуры, кроме внутренних систем, есть созвучный миф
  for (const m of MODULES.filter(x => x.group === 'water' && x.id !== 'interior')) assert.ok(My.forModule(m.id).length, m.id);
  // модули называются по предмету: в названиях нет имён богов
  for (const m of MODULES) assert.ok(!My.GODS.some(g => m.n.includes(g.name)), m.n);
});
