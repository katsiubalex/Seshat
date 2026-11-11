// Тесты укрупнённых нормативов цены строительства (НЦС 2026). Запуск: npm test
// Контрольные значения — из официальных сборников (приказы Минстроя России от 19.03.2026 № 166/пр и № 147/пр),
// в том числе из примеров расчёта в их технических частях.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/ncs.js');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('сборник 19: показатели совпадают со сборником (выборочно, по PDF)', () => {
  const g = id => N.G19.find(x => x.id === id);
  assert.deepEqual(g('screens').r.map(r => r[1]), [10.61, 6.9, 4.1, 0.97]);
  assert.deepEqual(g('uv').r.map(r => r[0]), [24000, 50000, 73500, 176000]);
  assert.equal(g('aer').r[0][1], 15.81);
  assert.equal(g('kns').r[0][1], 359.76);
  assert.equal(g('wtp').r[0][1], 6076.89);
  for (const x of N.G19) {
    assert.match(x.t, /^19-0[34]-\d{3}$/, x.id);
    assert.ok(x.r.every(r => r[0] > 0 && r[1] > 0), x.id);
    assert.ok(x.r.every((r, i) => i === 0 || r[0] > x.r[i - 1][0]), x.id + ': мощности по возрастанию');
  }
});

test('интерполяция — по формуле сборника (пример 1 технической части сб. 19)', () => {
  // котельная 2,8 МВт между 1 МВт (14 718,72) и 3 МВт (12 863,21) → 13 048,76 тыс. руб. на 1 МВт
  near(N.interp([[1, 14718.72, 2], [3, 12863.21, 3]], 2.8).v, 13048.76);
});

test('за крайними значениями — только в пределах 10 %, у таблицы с одним показателем интерполяции нет', () => {
  assert.equal(N.cost19('screens', 4600).unit, 10.61);
  assert.equal(N.cost19('screens', 4600).p.how, 'edge-lo');
  assert.equal(N.cost19('screens', 4400).unit, null);
  assert.equal(N.cost19('screens', 240000).unit, 0.97);
  assert.equal(N.cost19('screens', 250000).unit, null);
  assert.equal(N.cost19('sec', 73500).unit, 8.17);
  assert.equal(N.cost19('sec', 70000).p.how, 'single');
  near(N.cost19('screens', 10800).base, 74520);
});

test('региональные коэффициенты: в сборниках 86 субъектов, значения из примеров', () => {
  assert.equal(N.KPER.length, 86);
  assert.equal(N.kperOf('Московская область', 1), 1);
  assert.equal(N.kperOf('Краснодарский край', 1), 0.89); // сб. 19, пример 2
  assert.equal(N.kperOf('Хабаровский край (1 зона)', 2), 1.15); // сб. 14, пример 1, водоснабжение
  assert.equal(N.kperOf('Нижегородская область', 3), 0.86); // сб. 14, пример 2, канализация
  assert.equal(N.kperOf('Астраханская область', 3), 0.85); // сб. 14, пример 3
});

test('сборник 14: 56 таблиц, 1520 показателей, контрольные значения и примеры', () => {
  const ids = Object.keys(N.T14);
  assert.equal(ids.length, 56);
  assert.equal(ids.reduce((s, id) => s + N.T14[id][6].reduce((a, r) => a + r[1].length, 0), 0), 1520);
  assert.equal(N.net('14-07-001', 160, 1, 1).v, 4185.28);
  assert.equal(N.net('14-01-003', 100, 4, 1).v, 128492.69);
  // пример 1: ВЧШГ 300 мм, 3 м, сухой грунт без креплений — 23 743,45 тыс. руб. на 1 км; Хабаровский край — 1,15
  const a = N.net('14-01-001', 300, 3, 10, { region: 'Хабаровский край (1 зона)' });
  assert.equal(a.perKm, 23743.45); assert.equal(a.base, 237434.5); assert.equal(a.k, 1.15);
  // пример 2: канализация ВЧШГ 400 мм, 2 м — 26 772,28
  assert.equal(N.net('14-02-001', 400, 2, 1).perKm, 26772.28);
  // пример 3: ж/б раструбные 600 мм, 4,3 м с креплением — интерполяция 138 581,27
  near(N.net('14-05-003', 600, 4.3, 1).perKm, 138581.27);
});

test('сборник 14: правила по глубине и диаметру', () => {
  assert.equal(N.net('14-05-003', 600, 3.5, 1).how, 'as4');
  assert.equal(N.net('14-05-003', 600, 3.5, 1).v, N.net('14-05-003', 600, 4, 1).v);
  assert.equal(N.net('14-07-001', 170, 2, 1).how, 'nodiam');
  assert.equal(N.net('14-07-001', 160, 6, 1).how, 'deep');
  assert.equal(N.net('14-07-001', 160, 1.5, 1).how, 'interp12');
});

test('каждой технологии конструктора из UNIT_MAP соответствует группа сборника 19', () => {
  const { UNITS } = require('../js/data.js');
  const ids = new Set(UNITS.map(u => u.id));
  for (const [u, g] of Object.entries(N.UNIT_MAP)) {
    assert.ok(ids.has(u), u);
    assert.ok(N.G19.some(x => x.id === g), g);
  }
});
