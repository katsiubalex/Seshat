// Расчёт кольцевой водопроводной сети: потери напора, увязка колец (метод Лобачёва — Кросса), напоры в узлах
// и проверки по СП 31.13330.2021 и СП 8.13130.2020. Модуль «Сети водоснабжения».
// Единицы: расход q — л/с, длина L — м, диаметр d — мм (расчётный внутренний), отметки и напоры — м.
// Сеть: { nodes: [{ id, x, y, z, q, floors, source?, H? }], pipes: [{ id, a, b, L, d, mat, transit? }] }.
// У источника (насосная станция второго подъёма или водонапорная башня) задан пьезометрический напор H, м.
(function (root) {
  const G = 9.81;

  /* ---------- потери напора ---------- */
  // Гидравлический уклон i (м/м) по скорости V (м/с) и расчётному внутреннему диаметру d (м).
  // Формулы Ф. А. Шевелёва — по «Таблицам для гидравлического расчёта водопроводных труб» (Шевелёв Ф. А., Шевелёв А. Ф.).
  const MATERIALS = {
    used: { n: 'Стальные и чугунные, неновые', short: 'сталь/чугун',
      src: 'Шевелёв Ф. А., Шевелёв А. Ф. Таблицы для гидравлического расчёта водопроводных труб',
      f: 'i = 0,00107·V²/d^1,3 при V ≥ 1,2 м/с; i = 0,000912·V²/d^1,3·(1 + 0,867/V)^0,3 при V < 1,2 м/с',
      i: (V, d) => V >= 1.2 ? 0.00107 * V * V / Math.pow(d, 1.3) : 0.000912 * V * V / Math.pow(d, 1.3) * Math.pow(1 + 0.867 / V, 0.3) },
    pe: { n: 'Пластмассовые (полиэтилен)', short: 'полиэтилен', unverified: true,
      src: 'Шевелёв Ф. А., Шевелёв А. Ф. Таблицы для гидравлического расчёта водопроводных труб — коэффициенты нужно сверить с изданием',
      f: 'i = 0,000685·V^1,774/d^1,226',
      i: (V, d) => 0.000685 * Math.pow(V, 1.774) / Math.pow(d, 1.226) },
    hw: { n: 'Формула Хазена — Вильямса (C = 130), для сравнения', short: 'Хазен — Вильямс',
      src: 'Hazen–Williams equation (SI): h = 10,67·L·Q^1,852 / (C^1,852·d^4,87)',
      f: 'i = 10,67·Q^1,852 / (C^1,852·d^4,87), Q — м³/с',
      i: (V, d) => { const Q = V * Math.PI * d * d / 4; return 10.67 * Math.pow(Q, 1.852) / (Math.pow(130, 1.852) * Math.pow(d, 4.87)); } }
  };
  const area = dmm => Math.PI * Math.pow(dmm / 1000, 2) / 4;
  const velocity = (q, dmm) => Math.abs(q) / 1000 / area(dmm);
  // потери напора на участке, м: знак — по направлению расхода (q > 0 — от узла a к узлу b)
  function headLoss(p, q) {
    if (!q) return 0;
    if (p.r != null) return p.r * q * Math.abs(q); // учебная модель h = r·q², для проверки метода
    const V = velocity(q, p.d), M = MATERIALS[p.mat] || MATERIALS.used;
    return Math.sign(q) * M.i(V, p.d / 1000) * p.L;
  }
  // производная dh/dq — для поправки расхода; около нуля берём малый расход, чтобы знаменатель не обнулялся
  function slope(p, q) {
    const qq = Math.max(Math.abs(q), 0.05), e = qq * 1e-4;
    return (headLoss(p, qq + e) - headLoss(p, qq - e)) / (2 * e);
  }

  /* ---------- граф сети ---------- */
  function graph(net) {
    const N = net.nodes.length, idx = Object.fromEntries(net.nodes.map((n, i) => [n.id, i]));
    const adj = net.nodes.map(() => []);
    net.pipes.forEach((p, k) => { const a = idx[p.a], b = idx[p.b]; if (a == null || b == null || a === b) return; adj[a].push([b, k]); adj[b].push([a, k]); });
    return { N, idx, adj };
  }
  // остов (дерево) из источника обходом в ширину
  function tree(net, g, src) {
    const parent = new Array(g.N).fill(-1), pipeTo = new Array(g.N).fill(-1), order = [src], seen = new Array(g.N).fill(false);
    seen[src] = true;
    for (let h = 0; h < order.length; h++) for (const [v, k] of g.adj[order[h]]) if (!seen[v]) { seen[v] = true; parent[v] = order[h]; pipeTo[v] = k; order.push(v); }
    return { parent, pipeTo, order, seen };
  }
  // Кольца. Если сеть нарисована без пересечений, кольца — ячейки плана (как на чертеже);
  // иначе — независимые контуры через хорды остова. Кольцо: [[номер участка, знак]], знак +1 — участок идёт по часовой стрелке.
  function loops(net, g, T) {
    const chords = net.pipes.map((p, k) => k).filter(k => { const p = net.pipes[k], a = g.idx[p.a], b = g.idx[p.b];
      return a != null && b != null && a !== b && T.seen[a] && T.seen[b] && T.pipeTo[a] !== k && T.pipeTo[b] !== k; });
    const need = chords.length;
    if (!need) return [];
    const faces = planarFaces(net, g, T);
    if (faces && faces.length === need) return faces;
    return chords.map(k => fundamental(net, g, T, k));
  }
  function fundamental(net, g, T, k) {
    const p = net.pipes[k], a = g.idx[p.a], b = g.idx[p.b];
    const path = v => { const r = []; while (v !== -1) { r.push(v); v = T.parent[v]; } return r; };
    const pa = path(a), pb = path(b), inB = new Set(pb);
    const lca = pa.find(v => inB.has(v));
    // контур: a → b по хорде, затем по дереву b → lca → a
    const L = [[k, 1]];
    for (let v = b; v !== lca; v = T.parent[v]) { const e = T.pipeTo[v], q = net.pipes[e]; L.push([e, g.idx[q.a] === v ? 1 : -1]); }
    const down = []; for (let v = a; v !== lca; v = T.parent[v]) down.push(v);
    down.reverse().forEach(v => { const e = T.pipeTo[v], q = net.pipes[e]; L.push([e, g.idx[q.b] === v ? 1 : -1]); });
    return orient(net, g, L);
  }
  // знаки по часовой стрелке (в координатах экрана y вниз) — чтобы «плюс» везде означал одно и то же
  function orient(net, g, L) {
    const pts = L.map(([k, s]) => { const p = net.pipes[k], n = net.nodes[g.idx[s > 0 ? p.a : p.b]]; return [n.x || 0, n.y || 0]; });
    let A = 0; pts.forEach((u, i) => { const w = pts[(i + 1) % pts.length]; A += u[0] * w[1] - w[0] * u[1]; });
    return A < 0 ? L.map(([k, s]) => [k, -s]) : L;
  }
  function planarFaces(net, g, T) {
    const P = net.nodes.map(n => [n.x, n.y]);
    if (P.some(([x, y]) => !isFinite(x) || !isFinite(y))) return null;
    // тупиковые ветви не образуют колец — отрезаем узлы степени 1
    const deg = g.adj.map(a => a.length), alive = net.pipes.map((p, k) => g.idx[p.a] != null && g.idx[p.b] != null && g.idx[p.a] !== g.idx[p.b] && T.seen[g.idx[p.a]]);
    let changed = true;
    while (changed) { changed = false; net.pipes.forEach((p, k) => { if (!alive[k]) return; const a = g.idx[p.a], b = g.idx[p.b]; if (deg[a] === 1 || deg[b] === 1) { alive[k] = false; deg[a]--; deg[b]--; changed = true; } }); }
    // пересекающиеся участки — план непланарный
    const live = net.pipes.map((p, k) => k).filter(k => alive[k]);
    const cross = (p1, p2, p3, p4) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0; };
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = net.pipes[live[i]], b = net.pipes[live[j]];
      if ([a.a, a.b].some(x => x === b.a || x === b.b)) continue;
      if (cross(P[g.idx[a.a]], P[g.idx[a.b]], P[g.idx[b.a]], P[g.idx[b.b]])) return null;
    }
    // обход граней: из ребра u→v поворачиваем у v на ближайшее ребро по часовой стрелке
    const nb = g.adj.map((list, u) => list.filter(([, k]) => alive[k]).map(([v, k]) => ({ v, k, ang: Math.atan2(P[v][1] - P[u][1], P[v][0] - P[u][0]) })).sort((x, y) => x.ang - y.ang));
    const used = new Set(), faces = [];
    for (const k of live) for (const dir of [1, -1]) {
      const p = net.pipes[k]; let u = dir > 0 ? g.idx[p.a] : g.idx[p.b], v = dir > 0 ? g.idx[p.b] : g.idx[p.a];
      if (used.has(k + ':' + u)) continue;
      const face = [], seenE = new Set();
      let cu = u, cv = v, ck = k, guard = 0;
      do {
        used.add(ck + ':' + cu);
        face.push([ck, g.idx[net.pipes[ck].a] === cu ? 1 : -1]);
        if (seenE.has(ck)) return null; seenE.add(ck);
        const list = nb[cv], i = list.findIndex(x => x.v === cu && x.k === ck);
        const nx = list[(i - 1 + list.length) % list.length];
        cu = cv; cv = nx.v; ck = nx.k;
        if (guard++ > 10000) return null;
      } while (!(ck === k && cu === u));
      faces.push(face);
    }
    // внешняя грань — с наибольшей по модулю площадью; остальные — кольца
    const areaOf = f => { let A = 0; f.forEach(([k, s]) => { const p = net.pipes[k], a = P[g.idx[s > 0 ? p.a : p.b]], b = P[g.idx[s > 0 ? p.b : p.a]]; A += a[0] * b[1] - b[0] * a[1]; }); return A / 2; };
    const withA = faces.map(f => ({ f, A: areaOf(f) }));
    let outer = 0; withA.forEach((x, i) => { if (Math.abs(x.A) > Math.abs(withA[outer].A)) outer = i; });
    return withA.filter((x, i) => i !== outer).map(x => orient(net, g, x.f));
  }

  /* ---------- увязка колец ---------- */
  // opts: { tol — допустимая невязка, м; maxIt; demands — отборы по узлам (иначе из узлов), off — номера выключенных участков }
  function solve(netIn, opts = {}) {
    const tol = opts.tol ?? 0.01, maxIt = opts.maxIt ?? 200;
    const off = new Set(opts.off || []);
    const net = { nodes: netIn.nodes, pipes: netIn.pipes.filter((p, k) => !off.has(p.id)) };
    const g = graph(net), errors = [];
    const si = net.nodes.findIndex(n => n.source);
    if (si < 0) return { ok: false, errors: ['Нет источника: отметьте узел, из которого вода поступает в сеть (насосная станция или башня).'] };
    const T = tree(net, g, si);
    const lost = net.nodes.filter((n, i) => !T.seen[i]);
    if (lost.length) errors.push(`Не соединены с источником: ${lost.map(n => n.id).join(', ')}.`);
    const dem = net.nodes.map((n, i) => (opts.demands ? opts.demands[n.id] ?? 0 : n.q || 0) * (T.seen[i] && !n.source ? 1 : 0));
    // начальное потокораспределение: по хордам 0, по дереву — сумма отборов «ниже» по дереву
    const q = net.pipes.map(() => 0), sub = dem.slice();
    for (let h = T.order.length - 1; h > 0; h--) {
      const v = T.order[h], k = T.pipeTo[v], p = net.pipes[k];
      q[k] = g.idx[p.b] === v ? sub[v] : -sub[v]; sub[T.parent[v]] += sub[v];
    }
    const L = loops(net, g, T), iters = [];
    let resid = 0, it = 0, damp = 1, prevMax = Infinity;
    for (; it < maxIt && L.length; it++) {
      const dh = L.map(l => l.reduce((s, [k, sg]) => s + sg * headLoss(net.pipes[k], q[k]), 0));
      const den = L.map(l => l.reduce((s, [k]) => s + slope(net.pipes[k], q[k]), 0));
      resid = Math.max(...dh.map(Math.abs));
      if (resid <= tol) { iters.push({ k: it, dh, dq: dh.map(() => 0) }); break; }
      if (resid > prevMax * 0.999) damp = Math.max(0.25, damp * 0.7); // поправки «перескакивают» — уменьшаем шаг
      prevMax = resid;
      const dq = dh.map((x, i) => -damp * x / den[i]);
      L.forEach((l, i) => l.forEach(([k, sg]) => { q[k] += sg * dq[i]; }));
      iters.push({ k: it, dh, dq });
    }
    if (L.length && resid > tol) errors.push(`Увязка не сошлась за ${maxIt} итераций: невязка ${resid.toFixed(3)} м.`);
    // пьезометрические напоры от источника по дереву
    const H = new Array(g.N).fill(NaN); H[si] = net.nodes[si].H;
    for (let h = 1; h < T.order.length; h++) { const v = T.order[h], k = T.pipeTo[v], p = net.pipes[k], a = T.parent[v];
      H[v] = H[a] - (g.idx[p.a] === a ? 1 : -1) * headLoss(p, q[k]); }
    const pipes = net.pipes.map((p, k) => { const V = velocity(q[k], p.d); return { id: p.id, q: q[k], V, i1000: Math.abs(headLoss(p, q[k])) / p.L * 1000, h: headLoss(p, q[k]) }; });
    const nodes = net.nodes.map((n, i) => ({ id: n.id, H: H[i], free: H[i] - (n.z || 0), q: dem[i] }));
    const total = dem.reduce((s, x) => s + x, 0);
    return { ok: !errors.length, errors, pipes, nodes, loops: L.map(l => l.map(([k, s]) => [net.pipes[k].id, s])), iters, resid, total, it };
  }

  /* ---------- нормы ---------- */
  // Минимальный свободный напор на вводе в здание при максимальном хозяйственно-питьевом водопотреблении:
  // 10 м при одноэтажной застройке (СП 31.13330.2021 п. 5.11). Для большей этажности действующая редакция отсылает к п. 8.21
  // СП 30.13330.2020; здесь — прежнее правило «10 м + 4 м на каждый следующий этаж» (СП 31.13330.2012 п. 5.11) как ориентир.
  const requiredFree = floors => (floors > 1 ? 10 + 4 * (floors - 1) : 10);
  const MAX_FREE = 60;            // СП 31.13330.2021 п. 5.13
  const FIRE_FREE = 10;           // СП 8.13130.2020 п. 6.3: сеть низкого давления, на уровне земли
  const EMERGENCY = { share: 0.7, free: 10 }; // СП 31.13330.2021 п. 11.6
  // СП 8.13130.2020, таблица 1: [жителей до, тыс. чел.; одновременных пожаров; л/с при застройке до 2 этажей; 3 этажа и выше]
  const FIRE_TABLE = [[1, 1, 5, 10], [5, 1, 10, 10], [10, 1, 10, 15], [25, 2, 10, 15], [50, 2, 20, 25], [100, 2, 25, 35], [200, 3, 40, 40],
    [300, 3, null, 55], [400, 3, null, 70], [500, 3, null, 80], [600, 3, null, 85], [700, 3, null, 90], [800, 3, null, 95], [1000, 3, null, 100], [Infinity, 5, null, 110]];
  function fireDemand(thousands, floors) {
    const r = FIRE_TABLE.find(x => thousands <= x[0]);
    const tall = floors >= 3, q = tall ? r[3] : r[2] ?? r[3];
    return { fires: r[1], q, total: r[1] * q, note: !tall && r[2] == null ? 'Для поселений больше 200 тыс. жителей таблица даёт расход только для застройки 3 этажа и выше.' : '' };
  }
  // СП 31.13330.2021, таблица 2: коэффициент βmax по числу жителей (тыс. чел.), между значениями — линейная интерполяция
  const BETA = [[0.1, 4.5], [0.15, 4], [0.2, 3.5], [0.3, 3], [0.5, 2.5], [0.75, 2.2], [1, 2], [1.5, 1.8], [2.5, 1.6], [4, 1.5], [6, 1.4], [10, 1.3], [20, 1.2], [50, 1.15], [100, 1.1], [300, 1.05], [1000, 1]];
  function betaMax(th) {
    if (th <= BETA[0][0]) return BETA[0][1];
    if (th >= 1000) return 1;
    const i = BETA.findIndex(x => x[0] >= th), [x0, y0] = BETA[i - 1], [x1, y1] = BETA[i];
    return y0 + (y1 - y0) * (th - x0) / (x1 - x0);
  }
  // Расчётный расход населения (СП 31.13330.2021 п. 5.1–5.2): Qсут.m = qж·Nж/1000; Qсут.max = Kсут.max·Qсут.m;
  // qч.max = Kч.max·Qсут.max/24; Kч.max = αmax·βmax. Возвращает расходы в м³/сут, м³/ч и л/с.
  function demand({ people, qzh = 160, ksut = 1.2, amax = 1.3, extra = 0 }) {
    const Qm = qzh * people / 1000 * (1 + extra), Qmax = ksut * Qm, beta = betaMax(people / 1000), kch = amax * beta;
    const qh = kch * Qmax / 24;
    return { Qm, Qmax, beta, kch, qh, qs: qh / 3.6 };
  }
  // Узловые отборы через удельный расход: qуд = Q / ΣL (без транзитных участков), путевой — qуд·L, узловой — половина путевых примыкающих участков
  function nodalDemands(net, Qls) {
    const serv = net.pipes.filter(p => !p.transit), sumL = serv.reduce((s, p) => s + p.L, 0);
    const out = Object.fromEntries(net.nodes.map(n => [n.id, 0]));
    if (!sumL) return out;
    const qud = Qls / sumL;
    serv.forEach(p => { const qp = qud * p.L; out[p.a] += qp / 2; out[p.b] += qp / 2; });
    net.nodes.filter(n => n.source).forEach(n => { delete out[n.id]; });
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  }

  /* ---------- проверки ---------- */
  const REF = {
    min: { doc: 'sp31', t: 'СП 31.13330.2021, п. 5.11, с. 11' }, max: { doc: 'sp31', t: 'СП 31.13330.2021, п. 5.13, с. 11' },
    fire: { doc: 'sp8', t: 'СП 8.13130.2020, п. 6.3; табл. 1' }, emerg: { doc: 'sp31', t: 'СП 31.13330.2021, п. 11.6, с. 74' },
    ring: { doc: 'sp31', t: 'СП 31.13330.2021, п. 11.5, с. 74' }
  };
  function check(net, res, mode = 'max') {
    const out = [], byId = Object.fromEntries(net.nodes.map(n => [n.id, n]));
    if (!res.ok) res.errors.forEach(e => out.push({ level: 'bad', text: e }));
    const cons = res.nodes.filter(n => !byId[n.id].source && isFinite(n.H));
    if (mode === 'fire') {
      const low = cons.filter(n => n.free < FIRE_FREE - 1e-6);
      out.push(low.length ? { level: 'bad', text: `При пожаре свободный напор ниже ${FIRE_FREE} м в узлах ${low.map(n => n.id).join(', ')}.`, ref: REF.fire, nodes: low.map(n => n.id) }
        : { level: 'ok', text: `При пожаре свободный напор во всех узлах не ниже ${FIRE_FREE} м.`, ref: REF.fire });
    } else {
      const low = cons.filter(n => n.free < requiredFree(byId[n.id].floors || 1) - 1e-6);
      const high = cons.filter(n => n.free > MAX_FREE + 1e-6);
      out.push(low.length ? { level: 'bad', text: `Свободный напор меньше требуемого в узлах ${low.map(n => `${n.id} (${n.free.toFixed(1)} из ${requiredFree(byId[n.id].floors || 1)} м)`).join(', ')}.`, ref: REF.min, nodes: low.map(n => n.id) }
        : { level: 'ok', text: 'Свободный напор во всех узлах не меньше требуемого по этажности.', ref: REF.min });
      out.push(high.length ? { level: 'bad', text: `Свободный напор больше ${MAX_FREE} м в узлах ${high.map(n => n.id).join(', ')}: нужны регуляторы давления или зонирование.`, ref: REF.max, nodes: high.map(n => n.id) }
        : { level: 'ok', text: `Свободный напор у потребителей не больше ${MAX_FREE} м.`, ref: REF.max });
    }
    // тупиковые хозяйственно-питьевые линии — не больше 100 мм (СП 31 п. 11.5)
    const g = graph(net), deg = g.adj.map(a => a.length);
    const dead = net.pipes.filter(p => { const a = g.idx[p.a], b = g.idx[p.b]; return a != null && b != null && (deg[a] === 1 && !net.nodes[a].source || deg[b] === 1 && !net.nodes[b].source) && p.d > 100; });
    if (dead.length) out.push({ level: 'warn', text: `Тупиковые участки диаметром больше 100 мм: ${dead.map(p => p.id).join(', ')}. Для хозяйственно-питьевых нужд сеть должна быть кольцевой.`, ref: REF.ring, pipes: dead.map(p => p.id) });
    return out;
  }
  // Аварийный режим (СП 31 п. 11.6, упрощённо): выключаем участок, отборы — 70 % расчётных, свободный напор везде не меньше 10 м
  function emergency(net, pipeId) {
    const demands = Object.fromEntries(net.nodes.map(n => [n.id, (n.q || 0) * EMERGENCY.share]));
    const res = solve(net, { off: [pipeId], demands });
    const lost = res.ok === false && res.errors && res.errors.some(e => e.startsWith('Не соединены'));
    const low = (res.nodes || []).filter(n => !net.nodes.find(x => x.id === n.id).source && isFinite(n.H) && n.free < EMERGENCY.free - 1e-6);
    return { pipe: pipeId, res, ok: !lost && !low.length && res.ok, lost, low: low.map(n => n.id), minFree: Math.min(...(res.nodes || []).filter(n => isFinite(n.H) && !net.nodes.find(x => x.id === n.id).source).map(n => n.free)) };
  }
  const emergencyAll = net => net.pipes.filter(p => !net.nodes.find(n => n.source && (n.id === p.a || n.id === p.b))).map(p => emergency(net, p.id));

  // Пример: квартал из двух колец, насосная станция второго подъёма слева, застройка 5 этажей
  const example = () => ({
  nodes: [
    { id: 'НС', x: 0, y: 200, z: 50, source: true, H: 93 },
    { id: '1', x: 200, y: 200, z: 52, q: 10, floors: 5 }, { id: '2', x: 200, y: 0, z: 55, q: 15, floors: 5 }, { id: '3', x: 500, y: 0, z: 56, q: 20, floors: 5 },
    { id: '4', x: 500, y: 200, z: 54, q: 15, floors: 5 }, { id: '5', x: 800, y: 0, z: 57, q: 15, floors: 5 }, { id: '6', x: 800, y: 200, z: 55, q: 10, floors: 5 }
  ],
  pipes: [
    { id: 'в', a: 'НС', b: '1', L: 400, d: 300, mat: 'used', transit: true },
    { id: 'a', a: '1', b: '2', L: 400, d: 250, mat: 'used' }, { id: 'b', a: '2', b: '3', L: 600, d: 200, mat: 'used' }, { id: 'c', a: '1', b: '4', L: 600, d: 250, mat: 'used' },
    { id: 'd', a: '3', b: '4', L: 400, d: 125, mat: 'used' }, { id: 'e', a: '3', b: '5', L: 600, d: 150, mat: 'used' }, { id: 'f', a: '4', b: '6', L: 600, d: 200, mat: 'used' },
    { id: 'g', a: '5', b: '6', L: 400, d: 125, mat: 'used' }
  ]
});

  const api = { example, MATERIALS, headLoss, velocity, solve, check, requiredFree, MAX_FREE, FIRE_FREE, EMERGENCY, FIRE_TABLE, fireDemand, BETA, betaMax, demand, nodalDemands, emergency, emergencyAll, REF };
  root.SeshatNet = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
