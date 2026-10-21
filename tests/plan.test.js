// Тесты генплана. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { PLAN, layout, unitSize } = require('../js/plan.js');

const city = D.PRESETS[0];
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('у каждой технологии есть данные для генплана и описание работы', () => {
  for (const u of D.UNITS) {
    const p = PLAN[u.id];
    assert.ok(p, u.id);
    assert.ok(p.how && p.how.length > 80, u.id + ': описание');
    assert.ok(p.params.length >= 1, u.id + ': параметры');
  }
});

test('площадь растёт с расходом, но не меньше минимальной', () => {
  const small = unitSize('a2o', 100), big = unitSize('a2o', 50000);
  assert.ok(big.area > small.area * 10);
  assert.ok(small.parts[0].area >= PLAN.a2o.min);
  assert.equal(big.parts.length, 2); // аэротенк + вторичные отстойники
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
