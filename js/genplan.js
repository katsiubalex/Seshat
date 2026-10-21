// Экран конструктора: план станции (вид сверху) посередине, ввод стоков слева, водоём справа,
// показатели сверху, каталог технологий снизу. План редактируется: сооружения двигают, соединяют трубами,
// врезают в трубы из каталога, делают параллельные линии. Использует состояние и функции app.js и projects.js.

const gpUI = { sel: null, edge: null, cam: null, layer: 'plan', qp: 'bod', mode: 'plan', drawer: null, sheet: false, pane: 'pfd' };
const SVGNS = 'http://www.w3.org/2000/svg';
const n1 = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const n0 = v => Math.round(v).toLocaleString('ru-RU');

/* ---------- рисование сооружений в плане ---------- */
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function drawTank(g, x, y, w, h, p, fs) {
  el('rect', { x, y, width: w, height: h, class: 'gp-water' }, g);
  if (p.lines > 1) for (let i = 1; i < p.lines; i++) el('line', { x1: x, x2: x + w, y1: y + h * i / p.lines, y2: y + h * i / p.lines, class: 'gp-wall' }, g);
  const zones = p.zones || [];
  let zx = x;
  zones.forEach(([name, share], i) => {
    const zw = w * share;
    if (i > 0) el('line', { x1: zx, x2: zx, y1: y, y2: y + h, class: 'gp-wall' }, g);
    if (['АН', 'АКС', 'СМ', 'ФЛ', 'pH'].includes(name)) {
      const mx = zx + zw / 2, my = y + h / 2, r = Math.min(zw, h) * 0.16;
      el('circle', { cx: mx, cy: my, r, class: 'gp-mixer' }, g);
      el('path', { d: `M${mx - r} ${my}h${2 * r}M${mx} ${my - r}v${2 * r}`, class: 'gp-mixer gp-spin', style: `transform-origin:${mx}px ${my}px` }, g);
    } else if (name === 'АЭР' || name === 'O₃' || name === 'МББР' || (name === 'АММ' && p.carrier)) {
      const nx = Math.max(2, Math.round(zw / Math.max(4, h / 4))), ny = 3;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        const cx = zx + zw * (a + 0.5) / nx, cy = y + h * (b + 0.5) / ny;
        const car = name === 'МББР' || name === 'АММ';
        el('circle', { cx, cy, r: Math.min(zw / nx, h / ny) * (car ? 0.22 : 0.12), class: car ? 'gp-carrier' : 'gp-bubble', style: `animation-delay:${((a * 7 + b * 3) % 10) / 10 * 2}s` }, g);
      }
    } else if (name === 'МБР') {
      const k = 4;
      for (let a = 0; a < k; a++) el('rect', { x: zx + zw * 0.15 + a * zw * 0.7 / k, y: y + h * 0.2, width: zw * 0.7 / k * 0.6, height: h * 0.6, class: 'gp-membrane' }, g);
    }
    // подпись зоны — только если помещается в неё
    if ((zones.length > 1 || name !== 'АЭР') && zw > name.length * fs * 0.6 + fs * 0.4 && h > fs * 1.3) el('text', { x: zx + zw / 2, y: y + h - fs * 0.35, class: 'gp-zone', 'font-size': fs * 0.75 }, g).textContent = name;
    zx += zw;
  });
  if (p.aer && !zones.length) {
    const nx = Math.max(3, Math.round(w / 3));
    for (let a = 0; a < nx; a++) el('circle', { cx: x + w * (a + 0.5) / nx, cy: y + h * 0.25, r: Math.min(h * 0.08, 0.8), class: 'gp-bubble', style: `animation-delay:${(a % 5) * 0.4}s` }, g);
  }
  if (p.baffle) el('line', { x1: x + w * 0.75, x2: x + w * 0.75, y1: y, y2: y + h, class: 'gp-wall gp-dash' }, g);
  if (p.lamella) { const k = Math.max(4, Math.round(w / 2)); for (let i = 1; i < k; i++) el('line', { x1: x + w * i / k - h * 0.15, x2: x + w * i / k + h * 0.15, y1: y + h * 0.15, y2: y + h * 0.85, class: 'gp-wall' }, g); }
  if (p.float) el('rect', { x, y, width: w, height: h * 0.22, class: 'gp-foam' }, g);
  if (p.carrier && !zones.length) { /* носители рисуются в зоне МББР */ }
  el('rect', { x, y, width: w, height: h, class: 'gp-edge' }, g);
}
function drawClar(g, x, y, part) {
  for (let i = 0; i < part.n; i++) {
    const c = i % part.cols, r = Math.floor(i / part.cols), R = part.d / 2;
    const cx = x + c * (part.d + part.g) + R, cy = y + r * (part.d + part.g) + R;
    el('circle', { cx, cy, r: R, class: 'gp-water' }, g);
    el('circle', { cx, cy, r: R, class: 'gp-edge' }, g);
    el('circle', { cx, cy, r: R * 0.92, class: 'gp-wall gp-dash' }, g);
    el('circle', { cx, cy, r: R * 0.12, class: 'gp-edge' }, g);
    const br = el('g', { class: 'gp-bridge', style: `transform-origin:${cx}px ${cy}px;animation-delay:-${(i * 7) % 30}s` }, g);
    el('line', { x1: cx, y1: cy, x2: cx + R * 0.98, y2: cy, class: 'gp-bridge-line' }, br);
    el('rect', { x: cx + R * 0.86, y: cy - R * 0.06, width: R * 0.12, height: R * 0.12, class: 'gp-bridge-car' }, br);
  }
}
function drawBld(g, x, y, w, h, label, fs) {
  el('rect', { x, y, width: w, height: h, class: 'gp-bld' }, g);
  el('path', { d: w >= h ? `M${x} ${y + h / 2}H${x + w}` : `M${x + w / 2} ${y}V${y + h}`, class: 'gp-ridge' }, g);
  el('rect', { x, y, width: w, height: h, class: 'gp-edge' }, g);
  if (label && w > fs * 4) {
    const t = el('text', { x: x + w / 2, y: y + h / 2 + fs * 0.35, class: 'gp-bld-label', 'font-size': Math.min(fs * 0.85, w / (label.length * 0.55)) }, g);
    t.textContent = label;
  }
}
function drawCells(g, x, y, w, h) {
  el('rect', { x, y, width: w, height: h, class: 'gp-bld' }, g);
  const k = Math.max(2, Math.round(w / Math.max(4, h / 2)));
  for (let r = 0; r < 2; r++) for (let c = 0; c < k; c++) {
    const cw = w / k, ch = h / 2, px = x + c * cw + cw * 0.12, py = y + r * ch + ch * 0.12;
    el('rect', { x: px, y: py, width: cw * 0.76, height: ch * 0.76, class: 'gp-water' }, g);
    el('rect', { x: px, y: py, width: cw * 0.76, height: ch * 0.76, class: 'gp-wall' }, g);
  }
  el('rect', { x, y, width: w, height: h, class: 'gp-edge' }, g);
}
function drawCols(g, x, y, w, h) {
  el('rect', { x, y, width: w, height: h, class: 'gp-pad' }, g);
  const k = Math.max(2, Math.round(w / h * 2)), d = Math.min(w / k, h / 2) * 0.8;
  for (let r = 0; r < 2; r++) for (let c = 0; c < k; c++) {
    const cx = x + w * (c + 0.5) / k, cy = y + h * (r + 0.5) / 2;
    el('circle', { cx, cy, r: d / 2, class: 'gp-col' }, g);
  }
  el('rect', { x, y, width: w, height: h, class: 'gp-edge' }, g);
}
function drawSbr(g, x, y, w, h, fs, label) {
  const n = 4, cw = w / 2, ch = h / 2, gp = Math.min(cw, ch) * 0.08;
  for (let i = 0; i < n; i++) {
    const px = x + (i % 2) * cw + gp / 2, py = y + Math.floor(i / 2) * ch + gp / 2;
    el('rect', { x: px, y: py, width: cw - gp, height: ch - gp, class: 'gp-water' }, g);
    el('rect', { x: px, y: py, width: cw - gp, height: ch - gp, class: 'gp-edge' }, g);
    el('line', { x1: px + (cw - gp) * 0.2, x2: px + (cw - gp) * 0.8, y1: py + (ch - gp) * 0.8, y2: py + (ch - gp) * 0.8, class: 'gp-wall' }, g);
    if (cw > fs * 3.2 && ch > fs * 1.2) el('text', { x: px + (cw - gp) / 2, y: py + (ch - gp) / 2 + fs * 0.25, class: 'gp-zone', 'font-size': fs * 0.7 }, g).textContent = (label || 'SBR') + ' ' + (i + 1);
  }
}
// Окислительный канал: кольцо воды вокруг разделительной стенки, аэраторы на прямых участках
function drawDitch(g, x, y, w, h) {
  const r = h / 2;
  el('rect', { x, y, width: w, height: h, rx: r, class: 'gp-water' }, g);
  el('rect', { x, y, width: w, height: h, rx: r, class: 'gp-edge' }, g);
  const iw = w - h * 0.9, ih = h * 0.22;
  el('rect', { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih, rx: ih / 2, class: 'gp-bld' }, g);
  for (const fx of [0.3, 0.7]) {
    el('line', { x1: x + w * fx, x2: x + w * fx, y1: y + h * 0.04, y2: y + (h - ih) / 2 - h * 0.04, class: 'gp-mixer' }, g);
    el('line', { x1: x + w * (1 - fx), x2: x + w * (1 - fx), y1: y + (h + ih) / 2 + h * 0.04, y2: y + h * 0.96, class: 'gp-mixer' }, g);
  }
}
// Биоплато: поля с тростником
function drawWetland(g, x, y, w, h) {
  el('rect', { x, y, width: w, height: h, class: 'gp-reed-bed' }, g);
  const k = Math.max(2, Math.round(w / h * 2));
  for (let i = 1; i < k; i++) el('line', { x1: x + w * i / k, x2: x + w * i / k, y1: y, y2: y + h, class: 'gp-wall' }, g);
  const n = Math.min(160, Math.round(w * h / 60));
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) el('circle', { cx: x + rnd() * w, cy: y + rnd() * h, r: Math.min(w, h) * 0.012 + 0.3, class: 'gp-reed' }, g);
  el('rect', { x, y, width: w, height: h, class: 'gp-edge' }, g);
}
function drawChannel(g, x, y, w, h) {
  el('rect', { x, y, width: w, height: h, class: 'gp-bld' }, g);
  el('rect', { x: x + w * 0.08, y: y + h * 0.3, width: w * 0.84, height: h * 0.4, class: 'gp-water' }, g);
  for (let i = 1; i <= 4; i++) el('line', { x1: x + w * (0.08 + 0.84 * i / 5), x2: x + w * (0.08 + 0.84 * i / 5), y1: y + h * 0.26, y2: y + h * 0.74, class: 'gp-lamp' }, g);
  el('rect', { x, y, width: w, height: h, class: 'gp-edge' }, g);
}


function drawUnit(svg, b, i, fs, ov) {
  const u = U[b.id], st = STG[u.st], P = SeshatPlan.PLAN[b.id];
  const g = el('g', { class: 'gp-unit movable' + (gpUI.sel === i ? ' sel' : '') + (b.idle ? ' idle' : ''), 'data-i': i, tabindex: 0, role: 'button', style: `--c:${st.c}`, 'aria-label': `${i + 1}. ${u.n}${b.idle ? ', не подключено' : ''}. Показать, как работает` }, svg);
  el('title', {}, g).textContent = `${i + 1}. ${u.n}${b.idle ? ' — не подключено' : ''}. Перетащите, чтобы передвинуть`;
  let y = b.y;
  b.parts.forEach(part => {
    const x = b.x + (b.w - part.w) / 2;
    if (part.kind === 'clar') drawClar(g, x, y, part);
    else if (part.kind === 'bld') drawBld(g, x, y, part.w, part.h, P.label, fs);
    else if (part.kind === 'cells') drawCells(g, x, y, part.w, part.h);
    else if (part.kind === 'cols') drawCols(g, x, y, part.w, part.h);
    else if (part.kind === 'sbr') drawSbr(g, x, y, part.w, part.h, fs, P.reactor);
    else if (part.kind === 'ditch') drawDitch(g, x, y, part.w, part.h);
    else if (part.kind === 'wetland') drawWetland(g, x, y, part.w, part.h);
    else if (part.kind === 'channel') drawChannel(g, x, y, part.w, part.h);
    else drawTank(g, x, y, part.w, part.h, P, fs);
    y += part.h + SeshatPlan.GAP * 0.6;
  });
  // режимы «Затраты» и «Энергия»: сооружение подкрашено по доле, сверху подпись
  if (ov) {
    el('rect', { x: b.x - 1, y: b.y - 1, width: b.w + 2, height: b.h + 2, rx: 1.5, class: 'gp-heat', style: `fill-opacity:${(0.1 + 0.55 * ov.share).toFixed(2)}` }, g);
    el('text', { x: b.cx, y: b.y - fs * 0.5, class: 'gp-ov', 'font-size': fs * 0.85 }, g).textContent = ov.text;
  }
  // обводка выбора и номер
  el('rect', { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4, rx: 2, class: 'gp-hit' }, g);
  const r = fs * 0.85;
  el('circle', { cx: b.x - 1, cy: b.y - 1, r, class: 'gp-badge' }, g);
  el('text', { x: b.x - 1, y: b.y - 1 + r * 0.4, class: 'gp-badge-n', 'font-size': r * 1.15 }, g).textContent = i + 1;
  // предупреждения Сешат
  const warns = gpView && gpView.sim ? gpView.sim.warns[i] : [];
  if (warns && warns.length && !b.idle) {
    const wg = el('g', { class: 'gp-warn' }, g);
    el('title', {}, wg).textContent = warns.join('\n');
    el('circle', { cx: b.x + b.w + 1, cy: b.y - 1, r: r * 0.9, class: 'gp-warn-dot' }, wg);
    el('text', { x: b.x + b.w + 1, y: b.y - 1 + r * 0.38, class: 'gp-warn-t', 'font-size': r * 1.1 }, wg).textContent = '!';
  }
  // выход воды: от него тянут новую трубу; кружок снаружи, чтобы маленькое сооружение можно было взять
  const py = SeshatPlan.flowY(b), pg = el('g', { class: 'gp-port', 'data-port': i }, g);
  el('title', {}, pg).textContent = 'Потяните к другому сооружению, чтобы проложить трубу';
  const px = b.x + b.w + fs * 0.75;
  el('circle', { cx: px, cy: py, r: fs * 0.95, class: 'gp-port-hit' }, pg);
  el('circle', { cx: px, cy: py, r: fs * 0.55, class: 'gp-port-dot' }, pg);
  return g;
}

/* ---------- трубы: вход, между сооружениями, выпуск, осадок ---------- */
const QP = [['bod', 'БПК₅'], ['nh4', 'N-NH₄'], ['no3', 'N-NO₃'], ['p', 'P'], ['ss', 'Взвесь']];
// класс трубы в режиме «Качество»: сравнение с нормативом выбранного показателя
function qClass(v) {
  const n = state.norm[gpUI.qp];
  if (n == null || n === '' || isNaN(n)) return 'q-na';
  return v <= n ? 'q-ok' : v <= n * 3 ? 'q-mid' : 'q-bad';
}
function drawPipes(layer, L, sim, fs, pad, blocks) {
  layer.replaceChildren();
  const W = L.site.w, fy = SeshatPlan.flowY, qual = gpUI.layer === 'quality', qp = gpUI.qp;
  const sl = L.aux.find(a => a.id === 'sludge'), collectorY = sl.y - SeshatPlan.GAP * 0.7;
  blocks.forEach((b, i) => {
    if (sim.perStep[i].sludge < 1) return;
    el('polyline', { points: `${b.cx},${b.y + b.h} ${b.cx},${collectorY} ${sl.x + sl.w / 2},${collectorY} ${sl.x + sl.w / 2},${sl.y}`, class: 'gp-sludge' }, layer);
  });
  const line = (pts, cls, data) => {
    const d = pts.map(p => p.join(',')).join(' ');
    if (data) { const h = el('polyline', { points: d, class: 'gp-pipe-hit', 'data-e': data }, layer); el('title', {}, h).textContent = 'Нажмите, чтобы выбрать трубу. Сюда можно бросить сооружение из каталога'; }
    el('polyline', { points: d, class: cls }, layer);
  };
  const label = (pts, txt, cls) => {
    let best = 0, k = 0;
    for (let j = 0; j < pts.length - 1; j++) { const len = Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); if (len > best) { best = len; k = j; } }
    if (best < fs * 3.5) return; // на коротком участке подпись не поместится
    const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
    el('text', { x: mx, y: my - fs * 0.5, class: 'gp-flow ' + (cls || ''), 'font-size': fs * 0.85 }, layer).textContent = txt;
  };
  const qcls = v => qual ? ' ' + qClass(v) : '';
  // входы: исходные стоки
  L.steps.forEach((s, i) => {
    const b = blocks[i], p = sim.src[i]; if (!p) return;
    const y = fy(b), pts = [[-pad * 0.95, y], [b.x, y]];
    line(pts, 'gp-pipe' + qcls(state.c[qp]));
    el('text', { x: -pad * 0.95, y: y - fs * 0.7, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': 'start' }, layer).textContent = qual ? `${fmt(state.c[qp])} мг/л` : p < 0.999 ? `Стоки ${Math.round(p * 100)}%` : 'Стоки';
  });
  // трубы между сооружениями
  L.edges.forEach(e => {
    const pts = SeshatPlan.route(blocks[e.a], blocks[e.b], W / 2, blocks), sel = gpUI.edge && gpUI.edge[0] === e.a && gpUI.edge[1] === e.b;
    const v = sim.prof[e.a + 1][qp];
    line(pts, 'gp-pipe' + (sel ? ' sel' : '') + qcls(v), `${e.a}-${e.b}`);
    if (qual) label(pts, fmt(v), qClass(v));
    else if (e.f < 0.999) label(pts, `${Math.round(e.f * 100)}%`);
  });
  // выпуски
  L.steps.forEach((s, i) => {
    if (s.to.length || s.idle) return;
    const b = blocks[i], y = fy(b), right = b.cx >= W / 2, end = right ? W + pad * 0.95 : -pad * 0.95;
    const v = sim.prof[i + 1][qp];
    line([[right ? b.x + b.w + gpView.fs * 1.5 : b.x, y], [end, y]], 'gp-pipe' + qcls(v));
    el('text', { x: end, y: y - fs * 0.7, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': right ? 'end' : 'start' }, layer).textContent = qual ? `${fmt(v)} мг/л` : 'В водоём';
  });
}

/* ---------- план ---------- */
let gpView = null; // то, что сейчас нарисовано: нужно для перетаскивания и масштаба
function renderPlan(sim, eco) {
  const steps = SeshatGraph.norm(state.steps), canvas = document.getElementById('gp-canvas');
  renderPlanTools(steps);
  if (!steps.length) {
    canvas.innerHTML = '<div class="plan-empty"><b>Площадка пуста</b><span>Перетащите технологию из каталога внизу на план или нажмите на неё. Обычно станция начинается с решёток и песколовок.</span></div>';
    gpView = null; return null;
  }
  sim.src = SeshatGraph.flows(steps).src;
  const r = canvas.getBoundingClientRect();
  const L = SeshatPlan.layout(state.q, steps, { aspect: r.width && r.height ? r.width / r.height : 1.6 });
  if (gpUI.sel != null && gpUI.sel >= L.blocks.length) gpUI.sel = null;
  if (gpUI.edge && !L.edges.some(e => e.a === gpUI.edge[0] && e.b === gpUI.edge[1])) gpUI.edge = null;
  const W = L.site.w, H = L.site.h, fs = Math.max(2.6, Math.min(9, W / 58)), pad = fs * 5;
  const full = { x: -pad, y: -pad, w: W + pad * 2, h: H + pad * 2 };
  const cam = gpUI.cam || full;
  const svg = el('svg', { viewBox: `${cam.x} ${cam.y} ${cam.w} ${cam.h}`, preserveAspectRatio: 'xMidYMid meet', class: 'gp-svg editable layer-' + gpUI.layer, role: 'img', 'aria-label': 'План очистных сооружений' });
  gpView = { svg, L, sim, fs, pad, full, steps };
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'gp-ground' }, svg);
  const road = 9;
  el('rect', { x: road, y: road, width: W - road * 2, height: H - road * 2, rx: 6, class: 'gp-road' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'gp-fence' }, svg);
  const pipes = el('g', { class: 'gp-pipes' }, svg);
  gpView.pipes = pipes;
  drawPipes(pipes, L, sim, fs, pad, L.blocks);
  L.aux.forEach(a => { const g = el('g', { class: 'gp-aux' }, svg); el('title', {}, g).textContent = a.label; drawBld(g, a.x, a.y, a.w, a.h, a.id === 'abk' ? 'АБК' : 'Обезвоживание', fs); });
  // подкраска в режимах «Затраты» и «Энергия»
  let ov = () => null;
  if (gpUI.layer === 'cost' || gpUI.layer === 'energy') {
    const val = i => gpUI.layer === 'cost' ? eco.steps[i].opex : eco.steps[i].kwh;
    const max = Math.max(1e-9, ...steps.map((_, i) => val(i)));
    ov = i => ({ share: val(i) / max, text: gpUI.layer === 'cost' ? money(val(i)) : `${n0(val(i))} кВт·ч` });
  }
  L.blocks.forEach((b, i) => drawUnit(svg, b, i, fs, ov(i)));
  // север и масштаб
  const nx = W - fs * 2, ny = fs * 2.2;
  el('path', { d: `M${nx} ${ny - fs * 1.6}l${fs * 0.7} ${fs * 2}l-${fs * 0.7} -${fs * 0.5}l-${fs * 0.7} ${fs * 0.5}z`, class: 'gp-north' }, svg);
  el('text', { x: nx, y: ny + fs * 1.4, class: 'gp-note', 'font-size': fs * 0.9, 'text-anchor': 'middle' }, svg).textContent = 'С';
  const nice = [10, 20, 25, 50, 100, 200].find(v => v >= W / 8) || 200;
  const sx = W - nice - fs * 2, sy = H - fs * 1.4;
  el('path', { d: `M${sx} ${sy}h${nice}M${sx} ${sy - fs * 0.4}v${fs * 0.8}M${sx + nice} ${sy - fs * 0.4}v${fs * 0.8}M${sx + nice / 2} ${sy - fs * 0.25}v${fs * 0.5}`, class: 'gp-scale' }, svg);
  el('text', { x: sx + nice / 2, y: sy - fs * 0.6, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': 'middle' }, svg).textContent = `${nice} м`;
  canvas.replaceChildren(svg);
  return L;
}
function renderPlanTools(steps) {
  const positioned = steps.some(s => s.x != null);
  const layers = [['plan', 'План'], ['quality', 'Качество'], ['cost', 'Затраты'], ['energy', 'Энергия']];
  const legend = gpUI.layer === 'quality'
    ? `<div class="seg seg-sm" role="group" aria-label="Показатель">${QP.map(([k, n]) => `<button type="button" data-qp="${k}" aria-pressed="${gpUI.qp === k}">${n}</button>`).join('')}</div>
       <span class="lg"><i class="q-ok"></i>в норме <i class="q-mid"></i>до 3 норм <i class="q-bad"></i>выше</span>`
    : gpUI.layer === 'cost' ? '<span class="lg">чем ярче, тем дороже эксплуатация, ₽ в сутки</span>'
    : gpUI.layer === 'energy' ? '<span class="lg">чем ярче, тем больше электроэнергии, кВт·ч в сутки</span>'
    : '<span class="lg hint-plan">Тяните технологии из каталога на план или на трубу. От кружка ● ведите трубу к другому сооружению.</span>';
  document.getElementById('plan-tools').innerHTML = `
    <div class="seg" role="group" aria-label="Режим просмотра">${layers.map(([k, n]) => `<button type="button" data-layer="${k}" aria-pressed="${gpUI.layer === k}">${n}</button>`).join('')}</div>
    ${legend}
    <span class="pt-space"></span>
    ${positioned ? '<button type="button" data-gpact="auto">Расставить заново</button>' : ''}
    <div class="seg" role="group" aria-label="Масштаб"><button type="button" data-zoom="in" aria-label="Приблизить">+</button><button type="button" data-zoom="out" aria-label="Отдалить">−</button><button type="button" data-zoom="fit" aria-label="Показать всё">⤢</button></div>`;
}

/* ---------- верхняя строка, края экрана, шторки ---------- */
function normsState(out) {
  const list = PARAMS.filter(p => state.norm[p.k] != null && state.norm[p.k] !== '' && !isNaN(state.norm[p.k]));
  return { list, pass: list.filter(p => out[p.k] <= state.norm[p.k]).length };
}
function renderHud(sim, eco, L) {
  const scheme = refItem('scheme', state.ref.scheme), dirty = typeof isDirty === 'function' && scheme && isDirty('scheme');
  document.getElementById('hud-scheme-name').textContent = (ui.draft.scheme ? ui.draft.scheme.name : currentName('scheme', 'Без названия')) + (dirty ? ' •' : '');
  const { list, pass } = normsState(sim.out);
  document.getElementById('hud-norms').innerHTML = list.length
    ? `<span class="hud-score ${pass === list.length ? 'ok' : 'bad'}">${pass} из ${list.length}</span>` + list.map(p => {
      const v = sim.out[p.k], n = state.norm[p.k], ok = v <= n;
      return `<button type="button" class="hud-chip ${ok ? 'ok' : 'bad'}" data-pane="res" title="${esc(p.n)}: на выходе ${fmt(v)}, норматив ${fmt(n)} ${p.u}">${SHORT[p.k]} <b>${fmt(v)}</b>${ok ? '' : ` <small>×${fmt(v / n)}</small>`}</button>`;
    }).join('')
    : '<button type="button" class="hud-chip" data-open="drw-out">Нормативы не заданы</button>';
  const area = L ? `<span title="Площадь участка"><b>${n1(L.area.site / 1e4)}</b> га</span>` : '';
  document.getElementById('hud-money').innerHTML = `
    <span title="Капитальные затраты"><b>${mln(eco.total.capex)}</b></span>
    <span title="Эксплуатация в сутки"><b>${money(eco.total.opex)}</b>/сут</span>
    <span title="Себестоимость очистки"><b>${eco.perM3.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</b> ₽/м³</span>${area}`;
}
const PIPE_IN = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M2 12h18a6 6 0 0 1 6 6v12M2 20h14a2 2 0 0 1 2 2v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const WAVES = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M3 11c4-3 6 3 10 0s6-3 10 0 6 3 6 0M3 18c4-3 6 3 10 0s6-3 10 0 6 3 6 0M3 25c4-3 6 3 10 0s6-3 10 0 6 3 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function renderEdges(sim) {
  const c = state.c;
  document.getElementById('edge-in').innerHTML = `${PIPE_IN}<b>Ввод</b><span>${n0(state.q)}<small>м³/сут</small></span><span>БПК₅ ${fmt(c.bod)}</span><span>N ${fmt(c.nh4)}</span><span>P ${fmt(c.p)}</span><em>стоки</em>`;
  const { list, pass } = normsState(sim.out), all = list.length && pass === list.length;
  const out = document.getElementById('edge-out');
  out.className = 'sd-edge sd-out ' + (!list.length ? '' : all ? 'clean' : 'dirty');
  const nm = currentName('norm', 'Нормативы');
  out.innerHTML = `${WAVES}<b>Водоём</b><span class="edge-norm">${esc(nm.length > 34 ? nm.slice(0, 32) + '…' : nm)}</span><span>${list.length ? `${pass} из ${list.length}<small>в норме</small>` : 'нормы не заданы'}</span><em>нормативы</em>`;
}
function renderOutCheck(sim) {
  const rows = PARAMS.map(p => {
    const v = sim.out[p.k], n = state.norm[p.k], has = n != null && n !== '' && !isNaN(n), ok = has && v <= n;
    return `<tr><td class="p">${p.n}</td><td class="num">${fmt(v)}</td><td class="num">${has ? fmt(n) : '—'}</td><td><span class="pill ${has ? ok ? 'ok' : 'bad' : 'na'}">${has ? ok ? 'в норме' : '×' + fmt(v / n) : 'нет'}</span></td></tr>`;
  }).join('');
  document.getElementById('out-check').innerHTML = `<h3>На выпуске, мг/л</h3><div class="tbl-wrap"><table class="out-tbl"><thead><tr><th class="p">Показатель</th><th>выпуск</th><th>норма</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Свои значения норматива можно вписать в таблицу «Очистка по ступеням» в аналитике.</p>`;
}
function setDrawer(id) {
  gpUI.drawer = gpUI.drawer === id ? null : id;
  for (const d of ['drw-in', 'drw-out']) {
    document.getElementById(d).hidden = gpUI.drawer !== d;
    document.getElementById(d === 'drw-in' ? 'edge-in' : 'edge-out').setAttribute('aria-expanded', String(gpUI.drawer === d));
  }
  if (gpUI.drawer) { const f = document.querySelector(`#${gpUI.drawer} select, #${gpUI.drawer} input`); if (f) f.focus({ preventScroll: true }); }
}
function setSheet(open, pane) {
  gpUI.sheet = open;
  if (pane) gpUI.pane = pane;
  const sh = document.getElementById('sheet');
  sh.hidden = !open;
  document.getElementById('btn-sheet').setAttribute('aria-expanded', String(open));
  document.querySelectorAll('#sheet-tabs [data-pane]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pane === gpUI.pane)));
  document.querySelectorAll('#sheet .pane').forEach(p => { p.hidden = p.dataset.pane !== gpUI.pane; });
  try { localStorage.setItem('seshat-sheet', JSON.stringify({ open, pane: gpUI.pane })); } catch (e) {}
}
function setMode(mode) {
  gpUI.mode = mode;
  document.querySelectorAll('.hud .seg [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  document.getElementById('gp-canvas').hidden = mode !== 'plan';
  document.getElementById('plan-tools').hidden = mode !== 'plan';
  document.getElementById('list-view').hidden = mode !== 'list';
  if (mode === 'list') { gpUI.sel = null; gpUI.edge = null; }
  try { localStorage.setItem('seshat-mode', mode); } catch (e) {}
  renderStudio();
}

/* ---------- весь экран конструктора ---------- */
function renderStudio() {
  const sim = lastSim; if (!sim) return;
  const L = gpUI.mode === 'plan' ? renderPlan(sim, eco) : SeshatPlan.layout(state.q, SeshatGraph.norm(state.steps));
  renderHud(sim, eco, L); renderEdges(sim); renderOutCheck(sim);
  const card = document.getElementById('gp-info');
  if (gpUI.mode === 'plan' && L && (gpUI.sel != null || gpUI.edge)) { card.hidden = false; renderUnitCard(sim, eco, L); }
  else { card.hidden = true; card.innerHTML = ''; }
}

/* ---------- карточка сооружения или трубы ---------- */
function gpName(i, steps) { return `${i + 1}. ${U[steps[i].u].n.split(' (')[0]}`; }
function renderUnitCard(sim, ec, L) {
  const box = document.getElementById('gp-info'), i = gpUI.sel, steps = L.steps, q = state.q;
  const close = '<button type="button" class="icon-btn card-close" data-gpnav="close" aria-label="Закрыть карточку">✕</button>';
  if (gpUI.edge) {
    const [a, b] = gpUI.edge, e = L.edges.find(x => x.a === a && x.b === b);
    const c = sim.prof[a + 1];
    box.innerHTML = `${close}<h2>Труба</h2><p><b>${esc(gpName(a, steps))}</b> → <b>${esc(gpName(b, steps))}</b></p>
      <dl class="gp-dl"><dt>Расход</dt><dd>${n0(q * e.f)} м³/сут (${Math.round(e.f * 100)}% стоков)</dd><dt>Вода в трубе</dt><dd>БПК₅ ${fmt(c.bod)} · N-NH₄ ${fmt(c.nh4)} · P ${fmt(c.p)} мг/л</dd></dl>
      <p class="hint">Нажмите на технологию в каталоге, чтобы врезать её в эту трубу. Если убрать трубу, сооружение без входа будет получать исходные стоки, а сооружение без выхода — сбрасывать воду в водоём.</p>
      <div class="gp-acts"><button type="button" class="danger" data-gpact="cut">Удалить трубу</button></div>`;
    return;
  }
  const b = L.blocks[i], u = U[b.id], P = SeshatPlan.PLAN[b.id], st = STG[u.st], before = sim.cin[i], after = sim.prof[i + 1], e = ec.steps[i], s = steps[i];
  const rows = [['ss', 'Взвешенные вещества'], ['bod', 'БПК₅'], ['nh4', 'Азот аммонийный'], ['no3', 'Азот нитратов'], ['p', 'Фосфор фосфатов'], ['oil', 'Нефтепродукты']]
    .filter(([k]) => Math.abs(before[k] - after[k]) > 1e-6 || before[k] > 0)
    .map(([k, n]) => { const d = before[k] > 0 ? (after[k] - before[k]) / before[k] * 100 : 0; return `<tr><td>${n}</td><td class="num">${fmt(before[k])}</td><td class="num">${fmt(after[k])}</td><td class="num ${d < -0.5 ? 'down' : d > 0.5 ? 'up' : ''}">${Math.abs(d) < 0.5 ? '—' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(0) + '%'}</td></tr>`; }).join('');
  const preds = SeshatGraph.preds(steps)[i], src = sim.src[i];
  const ins = [...(src ? [`исходные стоки${src < 0.999 ? ` (${Math.round(src * 100)}%)` : ''}`] : []), ...preds.map(p => esc(gpName(p, steps)))];
  const outs = s.to.map((t, k) => `<li><span>→ ${esc(gpName(t, steps))}</span>${s.to.length > 1 ? `<label class="gp-share">доля <input ${NUM_ATTRS} data-share="${k}" value="${showNum(Math.round(SeshatGraph.share(s, k) * 1000) / 10)}" aria-label="Доля потока в ${esc(gpName(t, steps))}, %">%</label>` : ''}<button type="button" class="icon-btn" data-cut="${t}" aria-label="Удалить трубу в ${esc(gpName(t, steps))}">✕</button></li>`).join('');
  const anc = SeshatGraph.ancestors(steps);
  const targets = steps.map((_, k) => k).filter(k => k !== i && !s.to.includes(k) && !anc[i].has(k));
  const tune = Object.keys(s.eff).length ? `<details class="tune"><summary>Настроить эффективность, %</summary><div class="tune-grid">${Object.keys(s.eff).map(k => `<label for="ct-${k}">${SHORT[k]}<input id="ct-${k}" ${NUM_ATTRS} data-ctk="${k}" value="${showNum(s.eff[k])}"></label>`).join('')}</div></details>` : '';
  box.innerHTML = `${close}
    <div class="gp-head" style="--c:${st.c}">${SeshatIcons.icon(b.id, 56, u.n)}<div><span class="gp-stage">${i + 1} · ${st.n}</span><h2>${esc(u.n)}</h2></div></div>
    ${s.idle ? '<div class="warns"><div class="w">Сооружение стоит на плане, но не подключено. Потяните трубу от кружка ● к следующему сооружению или выберите, куда подать воду, ниже.</div></div>' : ''}
    ${!s.idle && sim.warns[i].length ? `<div class="warns">${sim.warns[i].map(w => `<div class="w">${esc(w)}</div>`).join('')}</div>` : ''}
    <h3>Трубы</h3>
    <dl class="gp-dl"><dt>Расход</dt><dd>${s.idle ? 'нет' : `${n0(q * b.f)} м³/сут${b.f < 0.999 ? ` (${Math.round(b.f * 100)}%)` : ''}`}</dd>${s.idle ? '' : `<dt>Поступает</dt><dd>${ins.join(', ')}</dd>`}</dl>
    ${s.idle ? '' : `<ul class="gp-outs">${outs || '<li><span>→ в водоём</span></li>'}</ul>`}
    ${targets.length ? `<div class="gp-link"><select id="gp-target" aria-label="Куда подать воду">${targets.map(k => `<option value="${k}">${esc(gpName(k, steps))}</option>`).join('')}</select><button type="button" data-gpact="link">Подать воду</button></div>` : ''}
    ${s.idle ? '<div class="gp-acts"><button type="button" data-gpact="tail">Включить в конец схемы</button></div>' : ''}
    <div class="gp-acts"><button type="button" data-gpact="par">Параллельная линия</button><button type="button" class="danger" data-gpact="del">Удалить</button></div>
    ${s.idle ? '' : `<h3>Что происходит с водой</h3>
    <div class="tbl-wrap"><table class="gp-tbl"><thead><tr><th>Показатель, мг/л</th><th>до</th><th>после</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`}
    ${tune}
    <h3>Как работает</h3><p>${esc(P.how)}</p>
    <h3>Типовые параметры</h3><ul>${P.params.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Размеры и затраты</h3><p>${gpSize(b)}</p>
    <dl class="gp-dl"><dt>Капзатраты</dt><dd>${mln(e.capex)}</dd><dt>Эксплуатация</dt><dd>${money(e.opex)} в сутки</dd><dt>Электроэнергия</dt><dd>${n0(e.kwh)} кВт·ч/сут</dd>${sim.perStep[i].sludge >= 1 ? `<dt>Осадок</dt><dd>${n1(sim.perStep[i].sludge / 1000)} т сухого вещества в сутки</dd>` : ''}</dl>`;
}
function gpSize(b) {
  return b.parts.map(p => p.kind === 'clar'
    ? `${p.label ? p.label.toLowerCase() + ': ' : ''}${p.n} × Ø ${n0(p.d)} м`
    : `${n0(p.w)} × ${n0(p.h)} м`).join(' + ') + ` · ≈ ${n0(b.area)} м²`;
}

/* ---------- правка схемы ---------- */
// steps — новая схема; sel — какое сооружение выбрать после правки
function gpCommit(steps, sel, msg, edge) {
  if (!steps) return;
  state.steps = steps;
  gpUI.sel = sel; gpUI.edge = edge || null;
  update();
  if (msg) toast(msg);
}
const remap = (i, map) => i == null || !map ? i : map[i];
// закрепить места всех сооружений такими, какими они нарисованы
function withPositions(blocks) {
  return SeshatGraph.norm(state.steps).map((s, i) => ({ ...s, x: Math.round(blocks[i].x * 2) / 2, y: Math.round(blocks[i].y * 2) / 2 }));
}
function gpOp(kind, arg) {
  const G = SeshatGraph, cur = G.norm(state.steps), i = gpUI.sel;
  if (kind === 'link' || kind === 'drop') {
    const [a, b] = arg, out = G.connect(cur, a, b);
    if (!out) { toast(a === b ? 'Труба должна вести в другое сооружение' : 'Так вода пошла бы по кругу: это сооружение уже стоит выше по течению'); return; }
    gpCommit(out, remap(kind === 'drop' ? a : i, G.lastPos()), `Труба проложена: ${gpName(a, cur)} → ${gpName(b, cur)}`);
  } else if (kind === 'cut') {
    const [a, b] = arg;
    gpCommit(G.disconnect(cur, a, b), remap(i, G.lastPos()), 'Труба удалена');
  } else if (kind === 'par') {
    const L = gpView && gpView.L, r = G.parallel(cur, i), n = cur.length;
    // новая линия — под исходной, если места закреплены
    if (L && cur.some(s => s.x != null)) {
      const b = L.blocks[i], fixed = withPositions(L.blocks);
      r.steps.forEach((s, k) => { const old = r.pos.indexOf(k); const p = old < n ? fixed[old] : { x: b.x, y: b.y + b.h + SeshatPlan.GAP }; s.x = p.x; s.y = p.y; });
    }
    gpCommit(r.steps, r.index, 'Добавлена параллельная линия: поток делится поровну');
  } else if (kind === 'del') {
    const name = gpName(i, cur);
    gpCommit(G.remove(cur, i), null, `Удалено: ${name}`);
  } else if (kind === 'tail') {
    // включить неподключённое сооружение: все выпуски схемы идут в него
    const sinks = cur.map((s, k) => k).filter(k => k !== i && !cur[k].to.length && !cur[k].idle && !G.ancestors(cur)[k].has(i));
    let st = cur, sel = i;
    for (const k of sinks) { const nx = G.connect(st, k, sel); if (!nx) continue; const m = G.lastPos(); st = nx; sel = m[sel]; sinks.forEach((x, j) => { sinks[j] = m[x]; }); }
    if (st === cur) { const s2 = G.norm(cur); delete s2[i].idle; st = s2; } // схема была пустой: сооружение получает стоки
    gpCommit(st, sel, 'Сооружение включено в схему');
  } else if (kind === 'auto') {
    gpUI.cam = null;
    gpCommit(cur.map(s => { const o = { ...s }; delete o.x; delete o.y; return o; }), i, 'Сооружения расставлены автоматически');
  }
}
// технология из каталога: в выбранную трубу, в точку плана или в конец схемы
function addUnit(id, where) {
  const G = SeshatGraph, cur = G.norm(state.steps), n = cur.length, name = U[id].n.split(' (')[0];
  if (where && where.edge) {
    const [a, b] = where.edge, out = G.split(cur, a, b, mk(id));
    if (!out) return;
    gpCommit(out, G.lastPos()[n], `${name}: врезано в трубу`);
    return;
  }
  if (where && where.pt && gpView) {
    const size = SeshatPlan.unitSize(id, state.q), fixed = withPositions(gpView.L.blocks);
    const out = G.place(fixed, { ...mk(id), x: Math.round((where.pt.x - size.w / 2) * 2) / 2, y: Math.round((where.pt.y - size.h / 2) * 2) / 2 });
    gpCommit(out, G.lastPos()[n], `${name}: стоит на плане. Подведите к нему трубу, чтобы оно заработало`);
    return;
  }
  const out = G.append(cur, mk(id));
  gpCommit(out, gpUI.mode === 'plan' ? G.lastPos()[n] : null, `${name}: добавлено в конец схемы`);
}

/* ---------- мышь и касания ---------- */
function svgPoint(svg, ev) {
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
// сколько единиц плана (метров) в одном пикселе экрана
function unitsPerPx() { const r = gpView.svg.getBoundingClientRect(), c = gpView.cam || camNow(); return Math.max(c.w / r.width, c.h / r.height); }
function camNow() { const v = gpView.svg.viewBox.baseVal; return { x: v.x, y: v.y, w: v.width, h: v.height }; }
function setCam(c) {
  const f = gpView.full, minW = f.w / 10, maxW = f.w * 2.5;
  if (c.w < minW) { const k = minW / c.w; c.x -= (c.w * k - c.w) / 2; c.y -= (c.h * k - c.h) / 2; c.w *= k; c.h *= k; }
  if (c.w > maxW) return;
  gpUI.cam = c;
  gpView.svg.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
}
function zoomAt(pt, k) {
  const c = camNow();
  setCam({ x: pt.x - (pt.x - c.x) * k, y: pt.y - (pt.y - c.y) * k, w: c.w * k, h: c.h * k });
}
// ближайшая труба к точке плана (для броска сооружения на трубу)
function nearestEdge(pt, tolPx) {
  if (!gpView) return null;
  const tol = tolPx * unitsPerPx(); let best = null, bd = tol;
  for (const e of gpView.L.edges) {
    const pts = SeshatPlan.route(gpView.L.blocks[e.a], gpView.L.blocks[e.b], gpView.L.site.w / 2, gpView.L.blocks);
    for (let k = 0; k < pts.length - 1; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[k + 1], dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((pt.x - x1) * dx + (pt.y - y1) * dy) / len));
      const d = Math.hypot(pt.x - (x1 + t * dx), pt.y - (y1 + t * dy));
      if (d < bd) { bd = d; best = [e.a, e.b]; }
    }
  }
  return best;
}
const overlapBox = (a, b, g) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
let gpDrag = null;
const gpCanvas = document.getElementById('gp-canvas');
const capture = (el, ev) => { try { el.setPointerCapture(ev.pointerId); } catch (e) {} };
const touches = new Map(); // для масштаба двумя пальцами
gpCanvas.addEventListener('pointerdown', ev => {
  if (!gpView || ev.button > 0) return;
  touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (touches.size === 2) { // второй палец: масштаб вместо перетаскивания
    if (gpDrag && gpDrag.line) gpDrag.line.remove();
    if (gpDrag && gpDrag.g) gpDrag.g.removeAttribute('transform');
    const [p1, p2] = [...touches.values()];
    gpDrag = { kind: 'pinch', d: Math.hypot(p1.x - p2.x, p1.y - p2.y) };
    return;
  }
  const port = ev.target.closest('.gp-port'), unit = ev.target.closest('.gp-unit'), pipe = ev.target.closest('.gp-pipe-hit');
  if (port) {
    ev.preventDefault();
    const i = +port.dataset.port, b = gpView.L.blocks[i], p = [b.x + b.w + gpView.fs * 0.75, SeshatPlan.flowY(b)];
    const line = el('polyline', { points: `${p} ${p}`, class: 'gp-pipe gp-temp' }, gpView.svg);
    gpDrag = { kind: 'pipe', i, p, line, id: ev.pointerId };
    capture(gpCanvas, ev); return;
  }
  if (unit) {
    gpDrag = { kind: 'unit', i: +unit.dataset.i, g: unit, start: svgPoint(gpView.svg, ev), sx: ev.clientX, sy: ev.clientY, moved: false, id: ev.pointerId };
    capture(gpCanvas, ev); return;
  }
  if (pipe) return; // нажатие на трубу обрабатывает click
  gpDrag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, cam: camNow(), k: unitsPerPx(), moved: false, id: ev.pointerId };
  capture(gpCanvas, ev);
});
gpCanvas.addEventListener('pointermove', ev => {
  if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (!gpDrag) return;
  if (gpDrag.kind === 'pinch') {
    if (touches.size < 2) return;
    const [p1, p2] = [...touches.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const mid = svgPoint(gpView.svg, { clientX: (p1.x + p2.x) / 2, clientY: (p1.y + p2.y) / 2 });
    zoomAt(mid, gpDrag.d / d); gpDrag.d = d; return;
  }
  if (ev.pointerId !== gpDrag.id) return;
  const pt = svgPoint(gpView.svg, ev);
  if (gpDrag.kind === 'pan') {
    const dx = ev.clientX - gpDrag.sx, dy = ev.clientY - gpDrag.sy;
    if (!gpDrag.moved && Math.hypot(dx, dy) < 4) return;
    gpDrag.moved = true; gpCanvas.classList.add('panning');
    setCam({ ...gpDrag.cam, x: gpDrag.cam.x - dx * gpDrag.k, y: gpDrag.cam.y - dy * gpDrag.k });
    return;
  }
  if (gpDrag.kind === 'pipe') {
    gpDrag.line.setAttribute('points', `${gpDrag.p} ${pt.x},${pt.y}`);
    const hit = document.elementFromPoint(ev.clientX, ev.clientY), u = hit && hit.closest && hit.closest('.gp-unit');
    gpCanvas.querySelectorAll('.gp-unit.target').forEach(x => { if (x !== u) x.classList.remove('target'); });
    if (u && +u.dataset.i !== gpDrag.i) u.classList.add('target');
    gpDrag.target = u && +u.dataset.i !== gpDrag.i ? +u.dataset.i : null;
    return;
  }
  if (!gpDrag.moved && Math.hypot(ev.clientX - gpDrag.sx, ev.clientY - gpDrag.sy) < 5) return;
  gpDrag.moved = true;
  const dx = Math.round((pt.x - gpDrag.start.x) * 2) / 2, dy = Math.round((pt.y - gpDrag.start.y) * 2) / 2;
  gpDrag.g.setAttribute('transform', `translate(${dx} ${dy})`);
  gpDrag.g.classList.add('dragging');
  const blocks = gpView.L.blocks.map((b, k) => k === gpDrag.i ? { ...b, x: b.x + dx, y: b.y + dy, cx: b.cx + dx, cy: b.cy + dy } : b);
  const me = blocks[gpDrag.i];
  gpDrag.clash = blocks.some((b, k) => k !== gpDrag.i && overlapBox(me, b, 2)) || gpView.L.aux.some(a => overlapBox(me, a, 2));
  gpDrag.g.classList.toggle('clash', gpDrag.clash);
  gpDrag.blocks = blocks;
  drawPipes(gpView.pipes, gpView.L, gpView.sim, gpView.fs, gpView.pad, blocks);
});
function gpEnd(ev, cancel) {
  touches.delete(ev.pointerId);
  if (!gpDrag) return;
  if (gpDrag.kind === 'pinch') { if (touches.size === 0) gpDrag = null; return; }
  if (ev.pointerId !== gpDrag.id) return;
  const d = gpDrag; gpDrag = null; gpCanvas.classList.remove('panning');
  if (d.kind === 'pan') {
    if (!d.moved && !cancel && (gpUI.sel != null || gpUI.edge)) { gpUI.sel = null; gpUI.edge = null; renderStudio(); }
    return;
  }
  if (d.kind === 'pipe') {
    d.line.remove(); gpCanvas.querySelectorAll('.gp-unit.target').forEach(x => x.classList.remove('target'));
    if (!cancel && d.target != null) gpOp('drop', [d.i, d.target]);
    return;
  }
  if (!d.moved) { if (!cancel) gpSelect(d.i); return; }
  if (cancel || d.clash) { renderStudio(); if (d.clash) toast('Сооружения не должны перекрываться: поставьте его на свободное место'); return; }
  gpCommit(withPositions(d.blocks), gpUI.sel);
}
gpCanvas.addEventListener('pointerup', ev => gpEnd(ev, false));
gpCanvas.addEventListener('pointercancel', ev => gpEnd(ev, true));
gpCanvas.addEventListener('click', ev => {
  const h = ev.target.closest('.gp-pipe-hit'); if (!h) return;
  const [a, b] = h.dataset.e.split('-').map(Number);
  gpUI.edge = [a, b]; gpUI.sel = null; renderStudio();
});
gpCanvas.addEventListener('wheel', ev => {
  if (!gpView) return;
  ev.preventDefault();
  zoomAt(svgPoint(gpView.svg, ev), Math.exp(Math.max(-60, Math.min(60, ev.deltaY)) * 0.004));
}, { passive: false });

/* ---------- каталог: нажать или потянуть на план ---------- */
let shelfDrag = null;
const shelf = document.getElementById('library');
shelf.addEventListener('pointerdown', ev => {
  const it = ev.target.closest('[data-add]'); if (!it || ev.button > 0) return;
  shelfDrag = { id: it.dataset.add, sx: ev.clientX, sy: ev.clientY, pid: ev.pointerId, touch: ev.pointerType !== 'mouse', active: false };
});
shelf.addEventListener('pointermove', ev => {
  const d = shelfDrag; if (!d || ev.pointerId !== d.pid) return;
  const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
  if (!d.active) {
    // пальцем полку листают вбок, а на план тянут вверх
    if (d.touch ? dy > -10 || Math.abs(dx) > Math.abs(dy) : Math.hypot(dx, dy) < 6) { if (d.touch && Math.abs(dx) > 10) shelfDrag = null; return; }
    d.active = true; capture(shelf, ev);
    d.ghost = document.createElement('div');
    d.ghost.className = 'drag-ghost'; d.ghost.style.setProperty('--c', STG[U[d.id].st].c);
    d.ghost.innerHTML = SeshatIcons.icon(d.id, 48) + `<span>${esc(U[d.id].n.split(' (')[0])}</span>`;
    document.body.appendChild(d.ghost);
  }
  d.ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
  const over = gpView && gpUI.mode === 'plan' && document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#gp-canvas');
  d.edge = over ? nearestEdge(svgPoint(gpView.svg, ev), 16) : null;
  d.over = !!over;
  gpCanvas.classList.toggle('drop-on', d.over);
  gpView && gpView.pipes.querySelectorAll('.gp-pipe.drop').forEach(x => x.classList.remove('drop'));
  if (d.edge) { const h = gpView.pipes.querySelector(`.gp-pipe-hit[data-e="${d.edge[0]}-${d.edge[1]}"]`); if (h && h.nextSibling) h.nextSibling.classList.add('drop'); }
  d.ghost.dataset.hint = d.edge ? 'врезать в трубу' : d.over ? 'поставить сюда' : '';
});
function shelfEnd(ev, cancel) {
  const d = shelfDrag; if (!d || ev.pointerId !== d.pid) return;
  shelfDrag = null; gpCanvas.classList.remove('drop-on');
  if (!d.active) { if (!cancel) addUnit(d.id, gpUI.edge ? { edge: gpUI.edge } : null); return; }
  d.ghost.remove();
  if (cancel || !d.over) return;
  addUnit(d.id, d.edge ? { edge: d.edge } : { pt: svgPoint(gpView.svg, ev) });
}
shelf.addEventListener('pointerup', ev => shelfEnd(ev, false));
shelf.addEventListener('pointercancel', ev => shelfEnd(ev, true));
shelf.addEventListener('keydown', ev => {
  const it = ev.target.closest('[data-add]'); if (!it || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault(); addUnit(it.dataset.add, gpUI.edge ? { edge: gpUI.edge } : null);
});

/* ---------- кнопки экрана ---------- */
function gpSelect(i) { gpUI.sel = i; gpUI.edge = null; renderStudio(); }
gpCanvas.addEventListener('keydown', ev => {
  const g = ev.target.closest('.gp-unit'); if (!g || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault(); gpSelect(+g.dataset.i);
  const again = document.querySelector(`.gp-unit[data-i="${g.dataset.i}"]`); if (again) again.focus();
});
document.addEventListener('keydown', ev => {
  if (document.body.dataset.view !== 'constructor') return;
  if (ev.key === 'Escape') {
    if (gpUI.drawer) { setDrawer(gpUI.drawer); return; }
    if (!document.getElementById('pop-scheme').hidden) { togglePop(false); return; }
    if (gpUI.sel != null || gpUI.edge) { gpUI.sel = null; gpUI.edge = null; renderStudio(); }
    return;
  }
  if (!gpUI.edge || (ev.key !== 'Delete' && ev.key !== 'Backspace')) return;
  if (ev.target.closest && ev.target.closest('input,select,textarea')) return;
  ev.preventDefault(); gpOp('cut', gpUI.edge);
});
document.getElementById('plan-tools').addEventListener('click', ev => {
  const l = ev.target.closest('[data-layer]'); if (l) { gpUI.layer = l.dataset.layer; renderStudio(); return; }
  const q = ev.target.closest('[data-qp]'); if (q) { gpUI.qp = q.dataset.qp; renderStudio(); return; }
  const z = ev.target.closest('[data-zoom]')?.dataset.zoom;
  if (z && gpView) {
    if (z === 'fit') { gpUI.cam = null; setCam({ ...gpView.full }); gpUI.cam = null; return; }
    const c = camNow(); zoomAt({ x: c.x + c.w / 2, y: c.y + c.h / 2 }, z === 'in' ? 0.75 : 1.33); return;
  }
  if (ev.target.closest('[data-gpact="auto"]')) gpOp('auto');
});
document.getElementById('gp-info').addEventListener('click', ev => {
  if (ev.target.closest('[data-gpnav="close"]')) { gpUI.sel = null; gpUI.edge = null; renderStudio(); return; }
  const cut = ev.target.closest('[data-cut]'); if (cut) { gpOp('cut', [gpUI.sel, +cut.dataset.cut]); return; }
  const act = ev.target.closest('[data-gpact]')?.dataset.gpact;
  if (act === 'cut') gpOp('cut', gpUI.edge);
  else if (act === 'link') gpOp('link', [gpUI.sel, +document.getElementById('gp-target').value]);
  else if (act) gpOp(act);
});
document.getElementById('gp-info').addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.ctk) { // эффективность ступени
    const v = parseNum(t.value); if (Number.isNaN(v)) { markInvalid(t, v); return; }
    const s = SeshatGraph.norm(state.steps); s[gpUI.sel].eff[t.dataset.ctk] = Math.min(100, v || 0);
    const id = t.id; state.steps = s; update();
    const again = document.getElementById(id); if (again) { again.closest('details').open = true; again.focus(); }
    return;
  }
  if (t.dataset.share == null) return;
  // изменили одну долю — остальные трубы делят оставшееся в прежней пропорции, в сумме 100%
  const k = +t.dataset.share, v = parseNum(t.value);
  if (v == null || Number.isNaN(v) || v <= 0 || v >= 100) { markInvalid(t, NaN); toast('Доля — от 1 до 99%'); return; }
  const cur = SeshatGraph.norm(state.steps), s = cur[gpUI.sel];
  const old = s.to.map((_, j) => SeshatGraph.share(s, j)), rest = old.reduce((a, x, j) => j === k ? a : a + x, 0);
  gpCommit(SeshatGraph.setSplit(cur, gpUI.sel, old.map((x, j) => j === k ? v : (100 - v) * x / rest)), gpUI.sel);
});
document.getElementById('edge-in').addEventListener('click', () => setDrawer('drw-in'));
document.getElementById('edge-out').addEventListener('click', () => setDrawer('drw-out'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => setDrawer(b.dataset.close)));
function togglePop(open) {
  const pop = document.getElementById('pop-scheme'), btn = document.getElementById('btn-scheme');
  pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
}
document.getElementById('btn-scheme').addEventListener('click', () => togglePop(document.getElementById('pop-scheme').hidden));
document.addEventListener('pointerdown', ev => {
  const pop = document.getElementById('pop-scheme');
  if (!pop.hidden && !ev.target.closest('.hud-scheme') && !ev.target.closest('#toast')) togglePop(false);
});
document.getElementById('view-constructor').addEventListener('click', ev => {
  const m = ev.target.closest('[data-mode]'); if (m) { setMode(m.dataset.mode); return; }
  const p = ev.target.closest('.hud [data-pane]'); if (p) { setSheet(true, p.dataset.pane); return; }
  const o = ev.target.closest('.hud [data-open]'); if (o) setDrawer(o.dataset.open);
});
document.getElementById('btn-sheet').addEventListener('click', () => setSheet(!gpUI.sheet));
document.getElementById('sheet-close').addEventListener('click', () => setSheet(false));
document.getElementById('sheet-tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-pane]'); if (b) setSheet(true, b.dataset.pane); });

/* ---------- запуск ---------- */
try { const m = localStorage.getItem('seshat-mode'); if (m === 'list' || m === 'plan') gpUI.mode = m; } catch (e) {}
try { const s = JSON.parse(localStorage.getItem('seshat-sheet') || 'null'); if (s) { gpUI.pane = s.pane || 'pfd'; gpUI.sheet = !!s.open; } } catch (e) {}
AFTER_UPDATE.push(() => renderStudio());
setSheet(gpUI.sheet, gpUI.pane);
setMode(gpUI.mode);
VIEW_RENDER.constructor = () => renderStudio();
