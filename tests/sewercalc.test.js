// Ядро водоотводящей сети: контрольные числа из источников и логика расчёта у каждого шага.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/sewercalc.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} ± ${tol}`);

test('геометрия круга совпадает с табл. Б.1 СП 399 (R/d, Kω) во всех узлах', () => {
  for (const [a, r, ratio, kw] of S.TB1) {
    const g = S.geom(a);
    near(g.r, r, 1e-4, `R/d при h/d = ${a}`);
    near(g.r / 0.25, ratio, 3e-4, `Rн/Rп при h/d = ${a}`);
    near(g.w, kw, 1e-4, `Kω при h/d = ${a}`);
  }
});

test('формула Павловского воспроизводит таблицы Лукиных (табл. 4, d = 125 мм, с. 19)', () => {
  // [h/d, i, q л/с, v м/с] — значения сверены по изображению страницы
  const rows = [[0.5, 0.009, 4.19, 0.68], [0.5, 0.010, 4.42, 0.72], [0.5, 0.015, 5.41, 0.88],
    [0.75, 0.010, 8.05, 0.81], [0.75, 0.015, 9.86, 1.00], [1.0, 0.010, 8.83, 0.72], [1.0, 0.012, 9.67, 0.79]];
  for (const [a, i, q, v] of rows) {
    const r = S.pavlovsky(125, a, i, 0.014);
    near(r.v, v, 0.006, `v при h/d = ${a}, i = ${i}`);
    near(r.q / q, 1, 0.01, `q при h/d = ${a}, i = ${i}`);
  }
  // формула (17) Лукиных: v = 71,4·R^(0,666 − 0,014√R)·√i
  const R = 0.125 / 4, v17 = 71.4 * Math.pow(R, 0.666 - 0.014 * Math.sqrt(R)) * Math.sqrt(0.01);
  near(S.pavlovsky(125, 1, 0.01).v, v17, 0.003, 'формула (17)');
});

test('СП 399 прил. Б (Kэ в мм в формуле Б.3) согласуется с формулой Колбрука — Уайта', () => {
  // Полное наполнение, вязкость чистой воды 10 °С, ПЭ (Kэ = 0,014 мм) и НПВХ (0,008 мм).
  // Метод СП 399 эмпирический: расхождение с Колбруком — Уайтом растёт с диаметром (ПЭ 200 мм −2 %, НПВХ 1200 мм +8 %).
  // При Kэ в метрах в (Б.3) λ получается почти вдвое больше — это и есть основание допущения ASSUMPTIONS.keunit.
  for (const [mat, ke] of [['pe', 0.014], ['pvc', 0.008]]) for (const [dmm, i] of [[200, 0.007], [400, 0.003], [800, 0.0015], [1200, 0.001]]) {
    const nu = S.viscosity(10, 50), d = dmm / 1000, k = ke / 1000;
    let lam = 0.02;
    for (let it = 0; it < 60; it++) { const V = Math.sqrt(2 * 9.81 * d * i / lam), Re = V * d / nu; lam = Math.pow(-2 * Math.log10(k / (3.7 * d) + 2.51 / (Re * Math.sqrt(lam))), -2); }
    const Vcw = Math.sqrt(2 * 9.81 * d * i / lam), r = S.sp399(dmm, 1, i, S.MATERIALS[mat], { t: 10, ss: 50 });
    near(r.v / Vcw, 1, 0.08, `${mat} d = ${dmm}, i = ${i}`);
    const lamMetres = 0.2 * Math.pow(k / d, 0.3124 * Math.pow(k, 0.0516));
    assert.ok(lamMetres / lam > 1.5, `${mat} d = ${dmm}: при Kэ в метрах λ = ${lamMetres} против ${lam} у Колбрука`);
  }
});

test('вязкость: табл. А.2 при взвешенных < 100 мг/л, табл. А.3 иначе; подозрительное значение издания сохранено', () => {
  near(S.viscosity(10, 50) * 1e6, 1.31, 1e-9, 'А.2, 10 °С');
  near(S.viscosity(15, 200) * 1e6, 1.16, 1e-9, 'А.3, 15 °С, 200 мг/л');
  near(S.viscosity(7, 300) * 1e6, 1.64, 1e-9, 'А.3, 7 °С, 300 мг/л (вероятная опечатка издания)');
  near(S.viscosity(12.5, 250) * 1e6, (1.275 + 1.24) / 2, 1e-9, 'интерполяция по t и по взвешенным');
});

test('СП 32 табл. 1: значения, интерполяция и примечание 2 (q < 5 л/с → 3)', () => {
  near(S.kTable(50, 95), 1.7, 1e-12, '95-й, 50 л/с');
  near(S.kTable(50, 99), 2.2, 1e-12, '99-й, 50 л/с');
  near(S.kTable(75, 95), 1.65, 1e-12, '95-й, 75 л/с — линейная интерполяция');
  near(S.kTable(3, 95), 3, 1e-12, 'q < 5 л/с');
  near(S.kTable(8000, 99), 1.6, 1e-12, 'больше 5000 л/с');
  near(S.kTable(20, 95, 'min'), 0.5, 1e-12, 'минимальный');
});

test('дополнительный приток: md не более 30 мм (СП 32 п. 5.1.10, ред. изм. № 2)', () => {
  // Санкт-Петербург: суточный максимум осадков 76 мм (СП 131.13330.2025, табл. 6.1) → в формулу идёт 30
  near(S.qAdditional({ Lkm: 2, md: 76, place: 'existing' }), 0.45 * 2 * Math.sqrt(30), 1e-12, 'существующее поселение');
  near(S.qAdditional({ Lkm: 1, md: 16, place: 'newBelow' }), 0.25 * 4, 1e-12, 'новый район ниже УГВ');
});

test('глубина промерзания и наименьшая глубина заложения (СП 22 п. 5.5.3; СП 32 п. 6.2.4)', () => {
  // Санкт-Петербург: Mt = 5,6 + 5,5 + 1,2 + 3,3 = 15,6 (СП 131.13330.2025, табл. 7.1), суглинок
  const dfn = S.frostDepth({ soil: 'clay', Mt: 15.6 });
  near(dfn, 0.23 * Math.sqrt(15.6), 1e-12, 'dfn');
  near(S.minInvertDepth(200, dfn), 0.9, 1e-12, 'd = 200: не менее 0,7 м до верха трубы');
  near(S.minInvertDepth(600, 2.0), 1.5, 1e-12, 'd = 600: dfn − 0,5');
  near(S.minInvertDepth(400, 2.0), 1.7, 1e-12, 'd = 400: dfn − 0,3');
});

test('табл. 2 СП 32 и нормы диаметров, уклонов, колодцев', () => {
  assert.deepEqual(S.table2(200), { vmin: 0.7, fill: 0.6, listed: true });
  assert.deepEqual(S.table2(350), { vmin: 0.8, fill: 0.7, listed: true });
  assert.deepEqual(S.table2(1000), { vmin: 1.2, fill: 0.8, listed: true });
  assert.equal(S.table2(1400).listed, false, '1400 мм нет в табл. 2');
  assert.equal(S.slopeNorm(150), 0.008); assert.equal(S.slopeNorm(200, true), 0.005);
  assert.equal(S.dMin('street', 500), 200); assert.equal(S.dMin('street', 250), 150); assert.equal(S.dMin('yard', 5000), 150);
  assert.equal(S.wellSpacing(150), 35); assert.equal(S.wellSpacing(300), 50); assert.equal(S.wellSpacing(1200), 150);
});

test('наполнение по расходу обратно расходу по наполнению', () => {
  for (const mat of ['pe', 'concrete']) {
    const q = S.flow(300, 0.55, 0.004, mat).q, f = S.fillFor(q, 300, 0.004, mat);
    near(f.a, 0.55, 1e-6, mat);
  }
  assert.equal(S.fillFor(1e6, 200, 0.005, 'pe').over, true, 'переполнение');
});

test('расчёт примера сети: баланс расходов, нормы соблюдены, профиль соединён по шелыгам', () => {
  const net = S.example(), r = S.solve(net);
  assert.ok(r.ok, JSON.stringify(r.pipes.flatMap(p => p.checks.filter(c => c.level === 'bad'))));
  const by = Object.fromEntries(r.pipes.map(p => [p.id, p]));
  // средний расход на выпуске = сумма собственных расходов всех участков
  near(by['5-В'].qAvg, r.pipes.reduce((s, p) => s + p.qOwn, 0), 1e-9, 'баланс расходов');
  for (const p of r.pipes) {
    assert.ok(p.fill <= p.fillMax + 1e-9, `${p.id}: наполнение`);
    assert.ok(p.i >= S.slopeNorm(p.d) - 1e-12, `${p.id}: уклон`);
    assert.ok(p.depthA >= S.minInvertDepth(p.d, r.dfn) - 1e-9, `${p.id}: глубина в начале`);
    assert.ok(p.d >= Math.max(0, ...r.pipes.filter(u => u.b === p.a).map(u => u.d)), `${p.id}: диаметр не уменьшается`);
    // шелыга следующего участка не выше шелыг входящих (п. 6.2.3)
    for (const u of r.pipes.filter(u => u.b === p.a)) assert.ok(p.crownStart <= u.crownEnd + 1e-9, `${p.id}: шелыги с ${u.id}`);
  }
  assert.ok(r.Qday > 300, 'расход поселения больше 300 м³/сут → уличная сеть не меньше 200 мм');
  for (const p of r.pipes.filter(p => p.kind === 'street')) assert.ok(p.d >= 200, `${p.id}: уличная сеть`);
});

test('у каждого шага есть тип, а у шагов «норма» и «методика» — источник; допущения объяснены', () => {
  const r = S.solve(S.example());
  const steps = [...r.steps, ...r.pipes.flatMap(p => p.steps)];
  assert.ok(steps.length > 50);
  for (const s of steps) {
    assert.ok(['norm', 'method', 'assume', 'input', 'calc'].includes(s.kind), `${s.t}: тип шага`);
    if (s.kind === 'norm' || s.kind === 'method') assert.ok(s.ref && S.DOCS[s.ref.doc] && s.ref.where, `${s.t}: источник`);
    if (s.kind === 'assume') assert.ok(s.note && Object.values(S.ASSUMPTIONS).includes(s.note), `${s.t}: допущение из списка`);
    assert.ok(typeof s.s === 'string' && s.s.length, `${s.t}: подстановка`);
  }
  // текстовая логика расчёта читается и называет документ и пункт
  const txt = S.explain(r.pipes[0].steps);
  assert.match(txt, /СП 399\.1325800\.2018, прил\. Б/);
  assert.match(txt, /СП 32\.13330\.2018.*табл\. 1/);
});

test('ошибки ввода: развилка вниз по течению, цикл, неизвестный узел', () => {
  const base = S.example();
  const fork = { ...base, pipes: [...base.pipes, { id: '1-x', a: '1', b: '3', L: 100 }] };
  assert.equal(S.solve(fork).ok, false);
  const loop = { nodes: [{ id: 'a', z: 1 }, { id: 'b', z: 1 }], pipes: [{ id: '1', a: 'a', b: 'b', L: 10 }, { id: '2', a: 'b', b: 'a', L: 10 }] };
  assert.equal(S.solve(loop).ok, false);
  assert.equal(S.solve({ nodes: [{ id: 'a', z: 1 }], pipes: [{ id: '1', a: 'a', b: 'zz', L: 10 }] }).ok, false);
});
