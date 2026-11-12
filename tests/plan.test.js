// Тесты генплана. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { PLAN, layout, unitSize } = require('../js/plan.js');

const city = D.PRESETS[0];
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('у каждой технологии есть данные для генплана; описание работы — в статье базы знаний, а не в plan.js', () => {
  for (const u of D.UNITS) {
    const p = PLAN[u.id];
    assert.ok(p && p.a >= 0 && p.min > 0 && p.label, u.id);
    assert.ok(!p.how && !p.params, u.id + ': описание перенесено в content/kb/units');
  }
});

test('площадь растёт с расходом, но не меньше минимальной', () => {
  const small = unitSize('a2o', 100), big = unitSize('a2o', 50000);
  assert.ok(big.area > small.area * 10);
  assert.ok(small.parts[0].area >= PLAN.a2o.min);
  assert.equal(big.parts.length, 1); // вторичные отстойники — отдельное сооружение sec
  const sec = unitSize('sec', 50000);
  assert.equal(sec.parts[0].kind, 'clar');
  assert.ok(sec.parts[0].n >= 2, 'не менее двух отстойников');
});

test('сооружения и здания не перекрываются и лежат внутри участка', () => {
  for (const p of D.PRESETS) for (const q of [300, p.q, 100000]) {
    const L = layout(q, p.scheme);
    const all = [...L.blocks, ...L.aux];
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= L.site.w && a.y + a.h <= L.site.h, `${p.n} q=${q}: ${a.id} вне участка`);
      for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(a, all[j]), `${p.n} q=${q}: ${a.id} и ${all[j].id} перекрываются`);
    }
  }
});

test('трубопровод соединяет все ступени по порядку', () => {
  const L = layout(city.q, city.scheme);
  assert.equal(L.blocks.length, city.scheme.length);
  assert.equal(L.pipes.length, city.scheme.length - 1);
  for (const pipe of L.pipes) for (const [x, y] of pipe) assert.ok(x >= 0 && x <= L.site.w && y >= 0 && y <= L.site.h);
});

test('участок больше суммарной площади сооружений', () => {
  const L = layout(city.q, city.scheme);
  assert.ok(L.area.site > L.area.structures);
});

test('генплан со всеми технологиями каталога сразу: без перекрытий, внутри участка', () => {
  for (const q of [300, 20000]) {
    const L = layout(q, D.UNITS.map(u => u.id));
    const all = [...L.blocks, ...L.aux];
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= L.site.w && a.y + a.h <= L.site.h, `${q}: ${a.id} вне участка`);
      for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(a, all[j]), `${q}: ${a.id} и ${all[j].id}`);
    }
    assert.ok(Math.max(...L.blocks.map(b => b.row)) >= 1, 'длинная схема переносится на несколько рядов');
  }
});

test('параллельные линии стоят друг под другом, меньшего размера, трубы ведут к обеим', () => {
  const G = require('../js/graph.js');
  const mk = id => (typeof id === 'object' ? { ...id, eff: {} } : { u: id, eff: {} });
  const ia = city.scheme.indexOf('a2o');
  const { steps } = G.parallel(G.norm(city.scheme.map(mk)), ia >= 0 ? ia : 2);
  const L = layout(city.q, steps), one = layout(city.q, city.scheme);
  const i = steps.findIndex((s, k) => k > 0 && s.u === steps[k - 1].u);
  assert.ok(i > 0);
  const a = L.blocks[i - 1], b = L.blocks[i];
  assert.ok(Math.abs(a.cx - b.cx) < 1 && !overlap(a, b), 'одна колонка, без перекрытия');
  assert.ok(a.area < one.blocks[i - 1].area, 'каждая линия на половину расхода');
  assert.equal(L.pipes.length, G.flows(steps).edges.length);
});

test('сохранённые места сооружений соблюдаются', () => {
  const G = require('../js/graph.js');
  const s = G.norm(['screens', 'sand', 'at'].map(u => ({ u, eff: {} })));
  s[0].x = 200; s[0].y = 40; s[1].x = 30; s[1].y = 40; s[2].x = 30; s[2].y = 120;
  const L = layout(1000, s);
  assert.equal(L.blocks[0].x, 200);
  assert.equal(L.blocks[2].y, 120);
});
