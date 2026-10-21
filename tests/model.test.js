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

test('у каждой технологии есть пиктограмма', () => {
  const { ICONS, icon } = require('../js/icons.js');
  for (const u of D.UNITS) {
    assert.ok(ICONS[u.id], u.id);
    assert.match(icon(u.id, 48, u.n), /^<svg[\s\S]*<\/svg>$/);
  }
});

test('нормативы НДТ (ПП № 1430): категории по расходу и значения', () => {
  assert.equal(D.capacityName(80), 'сверхмалые');
  assert.equal(D.capacityName(20000), 'большие');
  assert.equal(D.capacityName(700000), 'сверхкрупные');
  const n = k => D.NORMS[D.ndtKey(...k)].v;
  assert.deepEqual([n([20000, 'А']).bod, n([20000, 'А']).p, n([20000, 'А']).ss], [3, 0.5, 5]);
  assert.equal(n([5000, 'Б']).p, 1);       // новые небольшие – средние
  assert.equal(n([500, 'Б']).p, 1.5);      // малые
  assert.equal(n([1000.5, 'Б']).p, 1);     // дробный расход попадает в следующий диапазон
  assert.equal(n([50, 'Б']).nh4, 8);
  assert.equal(n([6000, 'В']).nh4, 2);
  assert.equal(n([3000, 'В']).nh4, 8);
  assert.equal(n([50000, 'Г']).p, 5);
  for (const c of ['А', 'Б', 'В', 'Г']) for (const q of [5, 100, 101, 4000, 10000, 10001, 1e6]) assert.ok(D.ndtKey(q, c), `${c} ${q}`);
  assert.equal(D.NORMS.ndt_sБ.v.oil, 1);
  assert.equal(D.NORMS.ndt_sБ.v.nh4, null);
});
