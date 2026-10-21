// Тесты сравнения вариантов. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { compare } = require('../js/compare.js');
const { defaultPrices } = require('../js/economics.js');

const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));
const city = D.PRESETS[0];
const v = (id, ids) => ({ id, name: id, steps: ids.map(u => ({ u, eff: { ...U[u].eff } })) });
const proj = (variants, norm) => ({ influent: { name: 'Город', q: city.q, c: { ...city.c } }, norm: { name: 'N', v: norm || { ...D.NORMS.target.v, fat: 3 } }, prices: defaultPrices(), variants });

const full = v('full', city.scheme);                                  // пример: выполняет целевые нормативы
const cheap = v('cheap', ['screens', 'sand', 'primary', 'at']);        // без удаления биогенов

test('каждый вариант считается на общих стоках и нормативах', () => {
  const r = compare(proj([full, cheap]));
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].tot, r.rows[1].tot);
  assert.ok(r.rows[0].compliant);
  assert.ok(!r.rows[1].compliant);
  assert.ok(r.rows[1].status.nh4 === 'bad');
});

test('лучшие значения: меньше — лучше; при равенстве не подсвечивается', () => {
  const r = compare(proj([full, cheap]));
  assert.deepEqual(r.best.capex, ['cheap']);
  assert.deepEqual(r.best.c_nh4, ['full']);
  assert.deepEqual(r.best.pass, ['full']);
  const same = compare(proj([full, { ...full, id: 'copy' }]));
  assert.deepEqual(same.best.capex, []);
});

test('вывод: из выполняющих нормативы — дешевле в эксплуатации; иначе — ближайший к нормам', () => {
  const r = compare(proj([full, cheap]));
  assert.equal(r.verdict.kind, 'single');
  assert.equal(r.verdict.best, 'full');
  const none = compare(proj([cheap], { ...D.NORMS.target.v, nh4: 0.01 }));
  assert.equal(none.verdict.kind, 'none');
  assert.equal(none.verdict.closest, 'cheap');
});

test('компромисс капзатраты / эксплуатация: срок окупаемости разницы', () => {
  const { verdict } = require('../js/compare.js');
  const row = (id, capex, opex) => ({ id, compliant: true, pass: 5, tot: 5, eco: { total: { capex, opex } } });
  // A: строить дороже на 100 млн ₽, эксплуатация дешевле на 50 000 ₽/сут → 18,25 млн ₽/год → 5,48 года
  const r = verdict([row('A', 600, 150000), row('B', 500, 200000)]);
  assert.equal(r.kind, 'tradeoff');
  assert.equal(r.lowOpex, 'A');
  assert.equal(r.lowCapex, 'B');
  assert.equal(r.dCapex, 100e6);
  assert.equal(r.dOpexYear, 50000 * 365);
  assert.ok(Math.abs(r.payback - 100e6 / (50000 * 365)) < 1e-9);
});

test('проект без вариантов', () => {
  const r = compare(proj([]));
  assert.equal(r.rows.length, 0);
  assert.equal(r.verdict, null);
});
