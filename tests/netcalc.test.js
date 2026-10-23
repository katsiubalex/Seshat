// Расчёт кольцевой сети: потери напора по Шевелёву, увязка колец, проверки по СП 31 и СП 8.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/netcalc.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} ± ${tol}`);

test('потери напора по Шевелёву совпадают с таблицами (q = 38 л/с, d = 205 мм, неновые трубы)', () => {
  // Таблицы Шевелёва: 1000i = 11,14 (по данным статьи: Приволжский научный журнал ННГАСУ, 2024, № 1, табл. 1)
  const p = { L: 1000, d: 205, mat: 'used' };
  near(N.velocity(38, 205), 1.15, 0.01, 'скорость');
  near(N.headLoss(p, 38), 11.14, 0.12, 'потери на 1 км'); // расхождение с таблицами меньше 1 %
  // зона V ≥ 1,2 м/с — квадратичная формула; на границе формулы стыкуются с разрывом меньше 1 %
  const i1 = N.MATERIALS.used.i(1.1999, 0.2), i2 = N.MATERIALS.used.i(1.2, 0.2);
  near(i1 / i2, 1, 0.01, 'стык формул при 1,2 м/с');
});

test('увязка колец сходится к известному решению (пример Харди Кросса: 4 узла, 2 кольца, h = r·q²)', () => {
  const net = {
    nodes: [{ id: '1', x: 0, y: 1, source: true, H: 100 }, { id: '2', x: 1, y: 0 }, { id: '3', x: 1, y: 2 }, { id: '4', x: 2, y: 1, q: 10 }],
    pipes: [{ id: '1-2', a: '1', b: '2', r: 1, L: 1, d: 100 }, { id: '1-3', a: '1', b: '3', r: 5, L: 1, d: 100 }, { id: '2-3', a: '2', b: '3', r: 1, L: 1, d: 100 },
      { id: '2-4', a: '2', b: '4', r: 5, L: 1, d: 100 }, { id: '3-4', a: '3', b: '4', r: 1, L: 1, d: 100 }]
  };
  const r = N.solve(net, { tol: 1e-6 });
  assert.ok(r.ok, r.errors && r.errors.join());
  assert.equal(r.loops.length, 2);
  const q = Object.fromEntries(r.pipes.map(p => [p.id, p.q]));
  near(q['1-2'], 20 / 3, 1e-3, '1-2'); near(q['1-3'], 10 / 3, 1e-3, '1-3'); near(q['2-3'], 10 / 3, 1e-3, '2-3');
  near(q['2-4'], 10 / 3, 1e-3, '2-4'); near(q['3-4'], 20 / 3, 1e-3, '3-4');
  // напор в узле 4 одинаков по любому пути: 100 − (20/3)² − 5·(10/3)²
  near(r.nodes.find(n => n.id === '4').H, 100 - 400 / 9 - 500 / 9, 1e-3, 'напор в узле 4');
});

// учебная сеть из двух колец с реальными трубами — пример конструктора
const city = () => N.example();

test('реальная сеть: баланс в узлах, невязки колец, напоры не зависят от пути', () => {
  const net = city(), r = N.solve(net, { tol: 0.001 });
  assert.ok(r.ok, r.errors.join());
  assert.equal(r.loops.length, 2);
  // баланс расходов в каждом узле: приток = отбор
  for (const n of net.nodes.filter(x => !x.source)) {
    const inflow = r.pipes.reduce((s, p) => { const P = net.pipes.find(x => x.id === p.id); return s + (P.b === n.id ? p.q : P.a === n.id ? -p.q : 0); }, 0);
    near(inflow, n.q, 1e-9, 'баланс в узле ' + n.id);
  }
  near(r.pipes.find(p => p.id === 'в').q, 85, 1e-9, 'водовод несёт весь расход');
  // невязка каждого кольца — в пределах допуска
  for (const L of r.loops) near(L.reduce((s, [id, sg]) => s + sg * r.pipes.find(p => p.id === id).h, 0), 0, 0.001, 'невязка кольца');
  // напор в каждом узле одинаков, если идти по любому участку
  const H = Object.fromEntries(r.nodes.map(n => [n.id, n.H]));
  for (const p of r.pipes) { const P = net.pipes.find(x => x.id === p.id); near(H[P.a] - H[P.b], p.h, 0.002, 'участок ' + p.id); }
  assert.ok(r.iters.length > 1 && r.iters.length < 50, 'итераций: ' + r.iters.length);
});

test('кольца — ячейки плана; если участки пересекаются, берутся независимые контуры', () => {
  const r = N.solve(city());
  const ids = r.loops.map(l => l.map(([id]) => id).sort().join(''));
  assert.deepEqual(ids.sort(), ['abcd', 'defg']);
  const crossed = city(); crossed.nodes.find(n => n.id === '3').x = 900; // участки b и f пересекаются
  const r2 = N.solve(crossed, { tol: 0.001 });
  assert.ok(r2.ok); assert.equal(r2.loops.length, 2);
});

test('свободные напоры: требуемый по этажности, не больше 60 м', () => {
  assert.equal(N.requiredFree(1), 10); assert.equal(N.requiredFree(5), 26); assert.equal(N.requiredFree(9), 42);
  const net = city(), r = N.solve(net), c = N.check(net, r);
  assert.ok(c.every(x => x.level === 'ok'), c.map(x => x.text).join(' | '));
  net.nodes[0].H = 70; // насосы слабее — напора не хватает
  const c2 = N.check(net, N.solve(net));
  assert.ok(c2.some(x => x.level === 'bad' && /меньше требуемого/.test(x.text)));
  net.nodes[0].H = 130; // слишком сильные — больше 60 м
  assert.ok(N.check(net, N.solve(net)).some(x => x.level === 'bad' && /больше 60/.test(x.text)));
});

test('пожарный расход по СП 8.13130.2020, таблица 1', () => {
  assert.deepEqual(N.fireDemand(0.8, 2), { fires: 1, q: 5, total: 5, note: '' });
  assert.equal(N.fireDemand(0.8, 5).q, 10);
  assert.deepEqual([N.fireDemand(30, 5).fires, N.fireDemand(30, 5).q], [2, 25]);
  assert.deepEqual([N.fireDemand(150, 9).fires, N.fireDemand(150, 9).q], [3, 40]);
  assert.equal(N.fireDemand(1500, 16).fires, 5);
  // пожарный режим: город на 20 тыс. жителей, 5 этажей — 2 пожара по 15 л/с в узлах 3 и 5; напор при пожаре не меньше 10 м
  const fd = N.fireDemand(20, 5); assert.deepEqual([fd.fires, fd.q], [2, 15]);
  const net = city(), d = Object.fromEntries(net.nodes.map(n => [n.id, n.q || 0])); d['3'] += fd.q; d['5'] += fd.q;
  const r = N.solve(net, { demands: d, tol: 0.001 });
  assert.ok(r.ok); near(r.total, 115, 1e-9, 'общий расход при пожаре');
  assert.equal(N.check(net, r, 'fire')[0].level, 'ok');
  // оба пожара в конце сети — напора не хватает
  d['3'] -= fd.q; d['5'] += fd.q * 2;
  assert.equal(N.check(net, N.solve(net, { demands: d }), 'fire')[0].level, 'bad');
});

test('коэффициенты неравномерности и расчётный расход по СП 31.13330.2021 (п. 5.2, табл. 2)', () => {
  assert.equal(N.betaMax(0.1), 4.5); assert.equal(N.betaMax(10), 1.3); assert.equal(N.betaMax(1000), 1);
  near(N.betaMax(15), 1.25, 1e-9, 'интерполяция между 10 и 20 тыс.');
  const r = N.demand({ people: 20000, qzh: 160, ksut: 1.2, amax: 1.3 });
  near(r.Qm, 3200, 1e-9, 'Qсут.m'); near(r.Qmax, 3840, 1e-9, 'Qсут.max'); near(r.kch, 1.56, 1e-9, 'Kч.max');
  near(r.qh, 249.6, 1e-9, 'qч.max, м³/ч'); near(r.qs, 69.33, 0.01, 'л/с');
});

test('узловые отборы через удельный расход: сумма равна расходу, транзитный водовод не раздаёт воду', () => {
  const net = city(), d = N.nodalDemands(net, 85);
  near(Object.values(d).reduce((s, x) => s + x, 0), 85, 0.05, 'сумма узловых');
  assert.ok(!('НС' in d));
  // узел 1 получает половину путевых расходов участков a и c, но не водовода
  near(d['1'], 85 / 3600 * (400 + 600) / 2, 0.01, 'узел 1');
});

test('аварийный режим по СП 31 п. 11.6: участок выключен, отборы 70 %, напор не меньше 10 м', () => {
  const net = city(), all = N.emergencyAll(net);
  assert.equal(all.length, net.pipes.length - 1); // водовод от насосной не выключаем: это отдельная проверка числа линий
  assert.ok(all.every(e => !e.lost), 'кольцевая сеть не теряет узлы');
  const worst = all.reduce((a, b) => (b.minFree < a.minFree ? b : a));
  assert.ok(isFinite(worst.minFree));
  // тупиковый узел при выключении своего участка теряет воду
  net.nodes.push({ id: '7', x: 900, y: 300, z: 55, q: 2, floors: 2 }); net.pipes.push({ id: 'т', a: '6', b: '7', L: 200, d: 100, mat: 'used' });
  assert.ok(N.emergency(net, 'т').lost);
});

test('ошибки сети: нет источника, узел не соединён', () => {
  const net = city(); net.nodes[0].source = false;
  assert.equal(N.solve(net).ok, false);
  const n2 = city(); n2.nodes.push({ id: '8', x: 0, y: 0, q: 1 });
  const r = N.solve(n2); assert.equal(r.ok, false); assert.match(r.errors[0], /Не соединены/);
});

test('статьи о расчёте сети: у каждой есть источники; где источника нет — пометка «уточняется»', () => {
  const KB = require('../js/kb.js'), DOCS = new Set(require('../js/docs.js').DOCS.map(d => d.id));
  for (const p of KB.NETWORK) {
    assert.ok(p.t && p.lead && p.s.length >= 2 && p.src.length >= 1, p.id);
    for (const [doc, t, , url] of p.src) { assert.ok(!doc || DOCS.has(doc), p.id + ' → ' + doc); assert.ok(t); if (url) assert.match(url, /^https:\/\//); }
    if (p.src.every(([doc, , , url]) => !doc && !url)) assert.ok(p.need, p.id + ': источник без ссылки — нужна пометка');
  }
});
