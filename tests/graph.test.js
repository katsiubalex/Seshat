// Параллельные линии и смешение потоков. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/graph.js');
const { simulate } = require('../js/model.js');
const { costs } = require('../js/economics.js');
const D = require('../js/data.js');
const mk = id => ({ u: id, eff: { ...D.UNITS.find(u => u.id === id).eff } });
const inp = D.PRESETS[0];

test('старая схема без труб считается последовательной', () => {
  const s = G.norm(['screens', 'sand', 'at'].map(mk));
  assert.deepEqual(s.map(x => x.to), [[1], [2], []]);
  assert.ok(G.isChain(s));
});

test('параллельная линия делит расход и не меняет качество, если линии одинаковые', () => {
  const chain = G.norm(['screens', 'sand', 'at', 'uv'].map(mk));
  const { steps, index } = G.parallel(chain, 2);
  assert.equal(steps.length, 5);
  assert.equal(steps[index].u, 'at');
  const fl = G.flows(steps);
  assert.ok(Math.abs(fl.f[2] - 0.5) < 1e-9 && Math.abs(fl.f[3] - 0.5) < 1e-9);
  const a = simulate({ ...inp, steps: chain }), b = simulate({ ...inp, steps });
  for (const k of ['bod', 'nh4', 'p', 'ss']) assert.ok(Math.abs(a.out[k] - b.out[k]) < 1e-9, k);
  assert.ok(Math.abs(a.energy - b.energy) < 1e-9, 'энергия на 1 м³ та же');
  // две малые линии дороже одной большой
  const ca = costs({ ...inp, steps: chain }, a), cb = costs({ ...inp, steps }, b);
  assert.ok(cb.total.capex > ca.total.capex);
});

test('обводная труба смешивает очищенную и неочищенную воду на выпуске', () => {
  let s = G.norm(['screens', 'at', 'uv'].map(mk));
  s = G.connect(s, 0, 2); // часть воды после решёток идёт мимо аэротенка
  const fl = G.flows(s);
  assert.ok(Math.abs(fl.f[1] - 0.5) < 1e-9);
  const r = simulate({ ...inp, steps: s }), full = simulate({ ...inp, steps: G.norm(['screens', 'at', 'uv'].map(mk)) });
  assert.ok(r.out.bod > full.out.bod * 2, 'обвод ухудшает выпуск');
  const expect = (r.prof[1].bod * 0.5 + r.prof[2].bod * 0.5);
  assert.ok(Math.abs(r.cin[2].bod - expect) < 1e-9, 'на входе УФ — смесь по расходу');
});

test('нельзя замкнуть контур; удаление ступени соединяет соседей', () => {
  const s = G.norm(['screens', 'sand', 'at'].map(mk));
  assert.equal(G.connect(s, 2, 0), null);
  assert.deepEqual(G.remove(s, 1).map(x => x.to), [[1], []]);
  const ins = G.insertBefore(s, 1, mk('drum'));
  assert.deepEqual(ins.map(x => x.u), ['screens', 'drum', 'sand', 'at']);
  assert.ok(G.isChain(ins));
});

test('доли потока задаются вручную', () => {
  const { steps } = G.parallel(G.norm(['screens', 'at', 'uv'].map(mk)), 1);
  const s = G.setSplit(steps, 0, [70, 30]);
  const f = G.flows(s).f;
  assert.ok(Math.abs(f[1] - 0.7) < 1e-9 && Math.abs(f[2] - 0.3) < 1e-9);
});
