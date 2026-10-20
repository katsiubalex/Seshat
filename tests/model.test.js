// Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { simulate } = require('../js/model.js');

const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));
const run = (preset, ids) => simulate({ q: preset.q, c: preset.c, steps: (ids || preset.scheme).map(id => ({ u: id, eff: { ...U[id].eff } })) });
const city = D.PRESETS[0];
const last = r => r.prof[r.prof.length - 1];

test('пустая схема не меняет состав', () => {
  const r = run(city, []);
  assert.deepEqual(last(r), { ...city.c });
  assert.equal(r.energy, 0);
});

test('концентрации никогда не отрицательны, ХПК не ниже БПК', () => {
  for (const p of D.PRESETS) {
    for (const c of run(p).prof) {
      for (const v of Object.values(c)) assert.ok(v >= 0);
      assert.ok(c.cod >= c.bod);
    }
  }
});

test('нитрификация переводит аммоний в нитраты', () => {
  const out = last(run(city, ['screens', 'at']));
  const outN = last(run(city, ['screens', 'mle']));
  assert.ok(outN.nh4 < out.nh4);
  assert.ok(outN.nh4 < 2);
});

test('без органики денитрификация ограничена и выдаёт предупреждение', () => {
  const lean = { q: 100, c: { ...city.c, bod: 40, cod: 80, nh4: 50 }, scheme: ['mle'] };
  const r = run(lean);
  assert.ok(r.warns[0].some(w => w.includes('денитрификации')));
});

test('дефосфатация снижает фосфор', () => {
  const a = last(run(city, ['primary', 'at']));
  const b = last(run(city, ['primary', 'at', 'chemP']));
  assert.ok(b.p < a.p * 0.3);
});

test('УФ не меняет химические показатели', () => {
  const a = last(run(city, ['primary', 'a2o']));
  const b = last(run(city, ['primary', 'a2o', 'uv']));
  assert.deepEqual(a, b);
});

test('городская схема-пример выходит на целевые показатели по азоту и фосфору', () => {
  const o = last(run(city));
  assert.ok(o.nh4 <= D.NORMS.target.v.nh4);
  assert.ok(o.no3 <= D.NORMS.target.v.no3);
  assert.ok(o.p <= D.NORMS.target.v.p);
});
