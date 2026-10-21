// Схема очистки как граф: ступени соединены трубами, поток может делиться на параллельные линии и снова сливаться.
// Ступень: { u, eff, to: [индексы следующих ступеней], sp?: [доли потока по трубам], x?, y? — место на генплане, м }.
// Ступени хранятся в порядке хода воды: трубы ведут только вперёд по списку, поэтому замкнутых контуров нет.
// Старые схемы без поля to считаются последовательными. Чистые функции, тестируются в Node.
(function (root) {
  const isNum = v => typeof v === 'number' && isFinite(v);

  /** Привести схему к виду с явными трубами: копия, лишние и обратные связи отброшены. */
  function norm(steps) {
    const n = steps.length, legacy = !steps.some(s => s && Array.isArray(s.to));
    return steps.map((s, i) => {
      const o = { u: s.u, eff: { ...(s.eff || {}) } };
      let to = legacy ? (i < n - 1 ? [i + 1] : []) : (Array.isArray(s.to) ? s.to : []);
      let sp = !legacy && Array.isArray(s.sp) && s.sp.length === to.length ? s.sp : null;
      const keep = to.map((j, k) => Number.isInteger(j) && j > i && j < n && to.indexOf(j) === k);
      to = to.filter((_, k) => keep[k]);
      if (sp) sp = sp.filter((_, k) => keep[k]);
      o.to = to;
      if (sp && to.length > 1 && sp.every(w => isNum(w) && w > 0) && sp.some(w => w !== sp[0])) o.sp = sp.map(w => +w.toFixed(4));
      if (isNum(s.x) && isNum(s.y)) { o.x = Math.round(s.x * 10) / 10; o.y = Math.round(s.y * 10) / 10; }
      return o;
    });
  }

  const share = (s, k) => s.sp ? s.sp[k] / s.sp.reduce((a, b) => a + b, 0) : 1 / s.to.length;

  function preds(steps) {
    const p = steps.map(() => []);
    steps.forEach((s, i) => s.to.forEach(j => p[j].push(i)));
    return p;
  }

  /**
   * Распределение расхода: доли от общего расхода станции.
   * @returns {{f:number[], src:number[], edges:{a,b,f}[], sinks:number[], preds:number[][]}}
   *   f — через ступень; src — доля исходных стоков, поступающая прямо на ступень
   */
  function flows(steps) {
    const p = preds(steps), sources = steps.map((_, i) => i).filter(i => !p[i].length);
    const src = steps.map((_, i) => p[i].length ? 0 : 1 / sources.length);
    const f = steps.map(() => 0), edges = [];
    steps.forEach((s, i) => {
      f[i] += src[i];
      s.to.forEach((j, k) => { const v = f[i] * share(s, k); f[j] += v; edges.push({ a: i, b: j, f: v }); });
    });
    return { f, src, edges, sinks: steps.map((s, i) => i).filter(i => !steps[i].to.length), preds: p };
  }

  /** Все ступени выше по течению для каждой ступени */
  function ancestors(steps) {
    const p = preds(steps), out = [];
    steps.forEach((_, i) => { const a = new Set(); p[i].forEach(j => { a.add(j); out[j].forEach(x => a.add(x)); }); out[i] = a; });
    return out;
  }
  /** Номер «колонки» на схеме: самый длинный путь от входа */
  function depth(steps) {
    const p = preds(steps), d = [];
    steps.forEach((_, i) => { d[i] = p[i].length ? Math.max(...p[i].map(j => d[j] + 1)) : 0; });
    return d;
  }
  const isChain = steps => steps.every((s, i) => i === steps.length - 1 ? !s.to.length : s.to.length === 1 && s.to[0] === i + 1);

  /* ---------- правка через список труб ---------- */
  function toEdges(steps) {
    const e = [];
    steps.forEach((s, i) => s.to.forEach((j, k) => e.push([i, j, s.sp ? s.sp[k] : 1])));
    return e;
  }
  // nodes — ступени без труб в желаемом порядке; edges — [откуда, куда, вес]. null, если есть замкнутый контур.
  let lastPos = null; // куда переехали ступени при последней правке: lastPos[старый индекс] = новый
  function fromEdges(nodes, edges) { const r = build(nodes, edges); lastPos = r && r.pos; return r && r.steps; }
  function build(nodes, edges) {
    const n = nodes.length, indeg = nodes.map(() => 0), out = nodes.map(() => []);
    edges.forEach(([a, b, w]) => { if (a === b || out[a].some(x => x[0] === b)) return; out[a].push([b, w]); indeg[b]++; });
    const order = [], ready = nodes.map((_, i) => i).filter(i => !indeg[i]);
    while (ready.length) {
      ready.sort((x, y) => x - y);
      const i = ready.shift(); order.push(i);
      out[i].forEach(([b]) => { if (!--indeg[b]) ready.push(b); });
    }
    if (order.length < n) return null;
    const pos = []; order.forEach((old, k) => { pos[old] = k; });
    return { pos, steps: norm(order.map(old => {
      const s = { ...nodes[old] }; delete s.to; delete s.sp;
      const o = out[old].map(([b, w]) => [pos[b], w]).sort((x, y) => x[0] - y[0]);
      s.to = o.map(x => x[0]); s.sp = o.map(x => x[1]);
      return s;
    })) };
  }
  const bare = steps => steps.map(s => { const o = { ...s, eff: { ...s.eff } }; delete o.to; delete o.sp; return o; });

  /** Добавить ступень в конец: в неё сходятся все выпуски */
  function append(steps, step) {
    const n = steps.length, e = toEdges(steps);
    steps.forEach((s, i) => { if (!s.to.length) e.push([i, n, 1]); });
    return fromEdges([...bare(steps), step], e);
  }
  /** Вставить ступень перед ступенью idx: вода, шедшая в idx, сначала проходит новую */
  function insertBefore(steps, idx, step) {
    if (idx >= steps.length) return append(steps, step);
    const nodes = [...bare(steps)]; nodes.splice(idx, 0, step);
    const sh = i => i >= idx ? i + 1 : i, e = [];
    toEdges(steps).forEach(([a, b, w]) => e.push(b === idx ? [sh(a), idx, w] : [sh(a), sh(b), w]));
    e.push([idx, idx + 1, 1]);
    return fromEdges(nodes, e);
  }
  /** Удалить ступень: её входы соединяются с её выходами */
  function remove(steps, i) {
    const e = toEdges(steps), ins = e.filter(x => x[1] === i), outs = e.filter(x => x[0] === i);
    const sumOut = outs.reduce((s, x) => s + x[2], 0);
    const rest = e.filter(x => x[0] !== i && x[1] !== i);
    ins.forEach(([a, , wa]) => outs.forEach(([, b, wb]) => { if (!rest.some(x => x[0] === a && x[1] === b)) rest.push([a, b, wa * wb / sumOut]); }));
    const sh = k => k > i ? k - 1 : k;
    return fromEdges(bare(steps).filter((_, k) => k !== i), rest.map(([a, b, w]) => [sh(a), sh(b), w]));
  }
  /** Поменять местами технологии двух ступеней, трубы и места на плане остаются */
  function swap(steps, i, j) {
    const s = norm(steps);
    [s[i].u, s[j].u] = [s[j].u, s[i].u]; [s[i].eff, s[j].eff] = [s[j].eff, s[i].eff];
    return s;
  }
  /** Проложить трубу a → b. null — получится замкнутый контур */
  function connect(steps, a, b) {
    if (a === b) return null;
    if (steps[a].to.includes(b)) { lastPos = steps.map((_, i) => i); return norm(steps); }
    if (ancestors(steps)[a].has(b)) return null;
    const e = toEdges(steps), mine = e.filter(x => x[0] === a);
    e.push([a, b, mine.length ? mine.reduce((s, x) => s + x[2], 0) / mine.length : 1]);
    return fromEdges(bare(steps), e);
  }
  function disconnect(steps, a, b) {
    return fromEdges(bare(steps), toEdges(steps).filter(x => !(x[0] === a && x[1] === b)));
  }
  /** Параллельная линия: копия ступени с теми же входами и выходами, поток делится поровну */
  function parallel(steps, i) {
    const n = steps.length, e = toEdges(steps), copy = { u: steps[i].u, eff: { ...steps[i].eff } };
    e.filter(x => x[1] === i).forEach(([a, , w]) => e.push([a, n, w]));
    e.filter(x => x[0] === i).forEach(([, b, w]) => e.push([n, b, w]));
    const r = build([...bare(steps), copy], e);
    return { steps: r.steps, index: r.pos[n], pos: r.pos };
  }
  /** Доли потока по трубам ступени, в процентах или любых весах */
  function setSplit(steps, i, weights) {
    const s = norm(steps);
    if (weights.length === s[i].to.length && weights.every(w => isNum(w) && w > 0)) s[i].sp = weights;
    return norm(s);
  }

  root.SeshatGraph = { norm, flows, preds, ancestors, depth, isChain, append, insertBefore, remove, swap, connect, disconnect, parallel, setSplit, share, lastPos: () => lastPos };
  if (typeof module !== 'undefined') module.exports = root.SeshatGraph;
})(typeof globalThis !== 'undefined' ? globalThis : this);
