// Тесты экономики. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { simulate } = require('../js/model.js');
const { costs, defaultPrices } = require('../js/economics.js');

const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));
const input = (preset, ids, q) => ({ q: q ?? preset.q, c: preset.c, steps: (ids || preset.scheme).map(id => ({ u: id, eff: { ...U[id].eff } })) });
const calc = (inp, prices) => costs(inp, simulate(inp), prices);
const city = D.PRESETS[0];
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('капзатраты при базовой производительности равны табличным', () => {
  const r = calc(input(city, ['primary', 'a2o'], D.ECON.qRef));
  near(r.steps[0].capex, U.primary.cx);
  near(r.total.capex, U.primary.cx + U.a2o.cx);
});

test('эффект масштаба: вдвое больше расход — капзатраты растут меньше чем вдвое', () => {
  const a = calc(input(city, null, 10000)).total.capex;
  const b = calc(input(city, null, 20000)).total.capex;
  near(b / a, Math.pow(2, D.ECON.scale));
  assert.ok(b / a < 2);
});

test('электроэнергия = удельный расход × расход × тариф', () => {
  const inp = input(city, ['a2o'], 5000);
  const r = calc(inp, { kwh: 10 });
  near(r.steps[0].kwh, U.a2o.en * 5000);
  near(r.steps[0].energy, U.a2o.en * 5000 * 10);
});

test('коагулянт для дефосфатации считается по удалённому фосфору', () => {
  const inp = input(city, ['primary', 'at', 'chemP'], 10000);
  const sim = simulate(inp), r = costs(inp, sim);
  const dP = sim.perStep[2].dP;
  near(r.steps[2].reagentKg.coag, D.ECON.reagents.coagPerP * dP * 10);
  assert.ok(r.steps[2].reagents > 0);
  assert.equal(r.steps[1].reagents, 0);
});

test('итог в сутки — сумма статей, себестоимость — итог / расход', () => {
  const inp = input(city);
  const r = calc(inp);
  for (const s of r.steps) near(s.opex, s.energy + s.reagents + s.consumables + s.sludge + s.repair);
  near(r.perM3, r.total.opex / inp.q);
  near(r.perYear, r.total.opex * 365);
});

test('ремонт = процент капзатрат в год, региональный коэффициент масштабирует капзатраты', () => {
  const inp = input(city, ['primary'], D.ECON.qRef);
  const r = calc(inp, { repair: 3.65, capexIdx: 1.5 });
  near(r.steps[0].capex, U.primary.cx * 1.5);
  near(r.steps[0].repair, U.primary.cx * 1.5 * 1e6 * 0.0365 / 365);
});

test('нулевой расход и пустая схема не ломают расчёт', () => {
  assert.equal(calc(input(city, [], 0)).total.opex, 0);
  const r = calc(input(city, ['a2o'], 0));
  assert.equal(r.total.capex, 0);
  assert.equal(r.perM3, 0);
});

test('цены по умолчанию заданы для всех статей', () => {
  const p = defaultPrices();
  for (const k of ['kwh', 'sludge', 'coag', 'floc', 'meth', 'repair', 'capexIdx']) assert.ok(p[k] > 0, k);
});

test('у всех технологий есть капзатраты и энергия; коагуляция считает реагенты', () => {
  for (const u of D.UNITS) { assert.ok(u.cx > 0, u.id); assert.ok(u.en >= 0, u.id); }
  const r = calc(input(city, ['screens', 'coag'], 10000));
  assert.ok(r.steps[1].reagentKg.coag > 0 && r.steps[1].reagents > 0);
});
