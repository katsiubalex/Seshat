// Раздел «Генплан»: станция в плане (вид сверху), клик по сооружению — описание принципа работы.
// Использует состояние и функции конструктора (app.js) и проектов (projects.js).

const gpUI = { sel: null, edge: null };
const SVGNS = 'http://www.w3.org/2000/svg';
const n1 = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const n0 = v => Math.round(v).toLocaleString('ru-RU');

/* ---------- источник схемы: конструктор или вариант проекта ---------- */
function gpSources() {
  const list = [{ id: 'c', name: `Конструктор: ${currentName('scheme', 'текущая схема')}` }];
  for (const pr of store.list('project')) for (const v of pr.data.variants) list.push({ id: `p:${pr.id}:${v.id}`, name: `${pr.name}: ${v.name}`, group: pr.name });
  return list;
}
function gpInput(src) {
  if (src && src.startsWith('p:')) {
    const [pid, vid] = src.slice(2).split(':'), pr = store.get('project', pid), v = pr && pr.data.variants.find(x => x.id === vid);
    if (v) return { q: pr.data.influent.q, c: pr.data.influent.c, steps: SeshatGraph.norm(v.steps), prices: pr.data.prices, title: `${pr.name}: ${v.name}`, pid, vid };
  }
  return { q: state.q, c: state.c, steps: SeshatGraph.norm(state.steps), prices: state.prices, title: currentName('scheme', 'Текущая схема'), edit: true };
}

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

function drawUnit(svg, b, i, fs, edit) {
  const u = U[b.id], st = STG[u.st], P = SeshatPlan.PLAN[b.id];
  const g = el('g', { class: 'gp-unit' + (gpUI.sel === i ? ' sel' : '') + (edit ? ' movable' : ''), 'data-i': i, tabindex: 0, role: 'button', style: `--c:${st.c}`, 'aria-label': `${i + 1}. ${u.n}. Показать, как работает` }, svg);
  el('title', {}, g).textContent = `${i + 1}. ${u.n}${edit ? ' — перетащите, чтобы передвинуть' : ''}`;
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
  // обводка выбора и номер
  el('rect', { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4, rx: 2, class: 'gp-hit' }, g);
  const r = fs * 0.85;
  el('circle', { cx: b.x - 1, cy: b.y - 1, r, class: 'gp-badge' }, g);
  el('text', { x: b.x - 1, y: b.y - 1 + r * 0.4, class: 'gp-badge-n', 'font-size': r * 1.15 }, g).textContent = i + 1;
  // выход воды: от него тянут новую трубу
  if (edit) {
    const py = SeshatPlan.flowY(b), pg = el('g', { class: 'gp-port', 'data-port': i }, g);
    el('title', {}, pg).textContent = 'Потяните к другому сооружению, чтобы проложить трубу';
    // кружок стоит снаружи, у правой стенки: так маленькое сооружение всё равно можно взять и передвинуть
    const px = b.x + b.w + fs * 0.75;
    el('circle', { cx: px, cy: py, r: fs * 0.95, class: 'gp-port-hit' }, pg);
    el('circle', { cx: px, cy: py, r: fs * 0.55, class: 'gp-port-dot' }, pg);
  }
  return g;
}

/* ---------- трубы: вход, между сооружениями, выпуск, осадок ---------- */
function drawPipes(layer, L, sim, fs, pad, blocks) {
  layer.replaceChildren();
  const W = L.site.w, fy = SeshatPlan.flowY;
  const sl = L.aux.find(a => a.id === 'sludge'), collectorY = sl.y - SeshatPlan.GAP * 0.7;
  blocks.forEach((b, i) => {
    if (sim.perStep[i].sludge < 1) return;
    el('polyline', { points: `${b.cx},${b.y + b.h} ${b.cx},${collectorY} ${sl.x + sl.w / 2},${collectorY} ${sl.x + sl.w / 2},${sl.y}`, class: 'gp-sludge' }, layer);
  });
  const line = (pts, cls, data) => {
    const d = pts.map(p => p.join(',')).join(' ');
    if (data) { const h = el('polyline', { points: d, class: 'gp-pipe-hit', 'data-e': data }, layer); el('title', {}, h).textContent = 'Нажмите, чтобы выбрать трубу'; }
    el('polyline', { points: d, class: cls }, layer);
  };
  const label = (pts, txt) => {
    let best = 0, k = 0;
    for (let j = 0; j < pts.length - 1; j++) { const len = Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); if (len > best) { best = len; k = j; } }
    if (best < fs * 3.5) return; // на коротком участке подпись не поместится
    const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
    el('text', { x: mx, y: my - fs * 0.5, class: 'gp-flow', 'font-size': fs * 0.85 }, layer).textContent = txt;
  };
  // входы: исходные стоки
  L.steps.forEach((s, i) => {
    const b = blocks[i], p = sim.src ? sim.src[i] : 0; if (!p) return;
    const y = fy(b), pts = [[-pad * 0.9, y], [b.x, y]];
    line(pts, 'gp-pipe');
    el('text', { x: -pad * 0.9, y: y - fs * 0.7, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': 'start' }, layer).textContent = p < 0.999 ? `Стоки ${Math.round(p * 100)}%` : 'Стоки';
  });
  // трубы между сооружениями
  L.edges.forEach(e => {
    const pts = SeshatPlan.route(blocks[e.a], blocks[e.b], W / 2, blocks), sel = gpUI.edge && gpUI.edge[0] === e.a && gpUI.edge[1] === e.b;
    line(pts, 'gp-pipe' + (sel ? ' sel' : ''), L.edit ? `${e.a}-${e.b}` : null);
    if (e.f < 0.999) label(pts, `${Math.round(e.f * 100)}%`);
  });
  // выпуски
  L.steps.forEach((s, i) => {
    if (s.to.length) return;
    const b = blocks[i], y = fy(b), right = b.cx >= W / 2, end = right ? W + pad * 0.9 : -pad * 0.9;
    line([[right ? b.x + b.w : b.x, y], [end, y]], 'gp-pipe');
    el('text', { x: end, y: y - fs * 0.7, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': right ? 'end' : 'start' }, layer).textContent = 'Выпуск';
  });
}

/* ---------- генплан целиком ---------- */
let gpView = null; // то, что сейчас нарисовано: нужно для перетаскивания
function renderGenplan() {
  const sel = document.getElementById('gp-source'), sources = gpSources();
  if (!state.gp || !sources.some(s => s.id === state.gp)) state.gp = 'c';
  const groups = {};
  sources.forEach(s => { (groups[s.group || ''] = groups[s.group || ''] || []).push(s); });
  sel.innerHTML = Object.entries(groups).map(([g, list]) => {
    const opts = list.map(s => `<option value="${esc(s.id)}" ${s.id === state.gp ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    return g ? `<optgroup label="Проект «${esc(g)}»">${opts}</optgroup>` : opts;
  }).join('');

  const inp = gpInput(state.gp), canvas = document.getElementById('gp-canvas'), tools = document.getElementById('gp-tools');
  const positioned = inp.steps.some(s => s.x != null);
  tools.innerHTML = inp.edit
    ? `<p class="hint">Перетаскивайте сооружения мышью или пальцем. Чтобы проложить трубу, потяните от кружка ● справа у сооружения к другому сооружению. Нажмите на трубу, чтобы удалить её. Параллельную линию можно добавить в карточке сооружения.</p>
       ${positioned ? '<button type="button" data-gpact="auto">Расставить автоматически</button>' : ''}`
    : `<p class="hint">Это вариант проекта: здесь его можно только смотреть. Чтобы двигать сооружения и менять трубы, откройте вариант в конструкторе.</p>
       <button type="button" data-gpact="open">Открыть в конструкторе</button>`;
  if (!inp.steps.length) {
    canvas.innerHTML = '<div class="empty">В схеме нет сооружений. Добавьте ступени в конструкторе.</div>';
    document.getElementById('gp-stats').innerHTML = ''; document.getElementById('gp-info').innerHTML = '';
    gpView = null; return;
  }
  const sim = SeshatModel.simulate(inp), ec = SeshatEconomics.costs(inp, sim, inp.prices);
  sim.src = SeshatGraph.flows(inp.steps).src;
  const L = SeshatPlan.layout(inp.q, inp.steps); L.edit = !!inp.edit;
  if (gpUI.sel != null && gpUI.sel >= L.blocks.length) gpUI.sel = null;
  if (gpUI.edge && !L.edges.some(e => e.a === gpUI.edge[0] && e.b === gpUI.edge[1])) gpUI.edge = null;
  const W = L.site.w, H = L.site.h, fs = Math.max(2.6, Math.min(9, W / 58));
  const pad = fs * 4.5;

  const svg = el('svg', { viewBox: `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`, class: 'gp-svg' + (inp.edit ? ' editable' : ''), role: 'img', 'aria-label': `Генплан: ${inp.title}` });
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'gp-ground' }, svg);
  const road = 9;
  el('rect', { x: road, y: road, width: W - road * 2, height: H - road * 2, rx: 6, class: 'gp-road' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'gp-fence' }, svg);

  const pipes = el('g', { class: 'gp-pipes' }, svg);
  drawPipes(pipes, L, sim, fs, pad, L.blocks);
  L.aux.forEach(a => { const g = el('g', { class: 'gp-aux' }, svg); el('title', {}, g).textContent = a.label; drawBld(g, a.x, a.y, a.w, a.h, a.id === 'abk' ? 'АБК' : 'Обезвоживание', fs); });
  L.blocks.forEach((b, i) => drawUnit(svg, b, i, fs, inp.edit));

  // север и масштаб
  const nx = W - fs * 2, ny = fs * 2.2;
  el('path', { d: `M${nx} ${ny - fs * 1.6}l${fs * 0.7} ${fs * 2}l-${fs * 0.7} -${fs * 0.5}l-${fs * 0.7} ${fs * 0.5}z`, class: 'gp-north' }, svg);
  el('text', { x: nx, y: ny + fs * 1.4, class: 'gp-note', 'font-size': fs * 0.9, 'text-anchor': 'middle' }, svg).textContent = 'С';
  const nice = [10, 20, 25, 50, 100, 200].find(v => v >= W / 8) || 200;
  const sx = W - nice - fs * 2, sy = H - fs * 1.4;
  el('path', { d: `M${sx} ${sy}h${nice}M${sx} ${sy - fs * 0.4}v${fs * 0.8}M${sx + nice} ${sy - fs * 0.4}v${fs * 0.8}M${sx + nice / 2} ${sy - fs * 0.25}v${fs * 0.5}`, class: 'gp-scale' }, svg);
  el('text', { x: sx + nice / 2, y: sy - fs * 0.6, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': 'middle' }, svg).textContent = `${nice} м`;

  canvas.replaceChildren(svg);
  gpView = { svg, L, sim, fs, pad, pipes, inp };
  const par = L.edges.length > L.blocks.length - 1 || L.blocks.length - 1 > L.edges.length || !SeshatGraph.isChain(inp.steps);
  document.getElementById('gp-stats').innerHTML = `
    <span><b>${n0(inp.q)}</b> м³/сут</span>
    <span>участок <b>${n1(L.area.site / 1e4)} га</b> (${n0(W)} × ${n0(H)} м)</span>
    <span>сооружения <b>${n0(L.area.structures)} м²</b></span>
    <span>капзатраты <b>${mln(ec.total.capex)}</b></span>
    ${par ? '<span>схема <b>с параллельными линиями</b></span>' : ''}`;
  renderGpInfo(inp, sim, ec, L);
}

function gpName(i, steps) { return `${i + 1}. ${U[steps[i].u].n.split(' (')[0]}`; }
function renderGpInfo(inp, sim, ec, L) {
  const box = document.getElementById('gp-info'), i = gpUI.sel, steps = inp.steps;
  if (gpUI.edge) {
    const [a, b] = gpUI.edge, e = L.edges.find(x => x.a === a && x.b === b);
    box.innerHTML = `<div class="gp-nav"><button type="button" data-gpnav="list">← Все сооружения</button></div>
      <h2>Труба</h2><p><b>${esc(gpName(a, steps))}</b> → <b>${esc(gpName(b, steps))}</b></p>
      <dl class="gp-dl"><dt>Расход</dt><dd>${n0(inp.q * e.f)} м³/сут (${Math.round(e.f * 100)}% стоков)</dd></dl>
      <p class="hint">Если убрать трубу, сооружение без входа будет получать исходные стоки, а сооружение без выхода станет сбрасывать воду в выпуск.</p>
      <div class="gp-acts"><button type="button" class="danger" data-gpact="cut">Удалить трубу</button></div>`;
    return;
  }
  if (i == null) {
    box.innerHTML = `<h2>Сооружения</h2><p class="hint">Нажмите на сооружение на плане или в списке, чтобы узнать, как оно работает${inp.edit ? ', и настроить его трубы' : ''}.</p>
      <ol class="gp-list">${L.blocks.map((b, k) => `<li><button type="button" data-gpi="${k}" style="--c:${STG[U[b.id].st].c}">${SeshatIcons.icon(b.id, 34)}<span><b>${esc(U[b.id].n)}</b><small>${gpSize(b)}${b.f < 0.999 ? ` · ${Math.round(b.f * 100)}% расхода` : ''}</small></span></button></li>`).join('')}</ol>
      <p class="hint">Также на плане: цех обезвоживания осадка (${n0(L.aux[0].area)} м²) и административно-бытовой корпус. Размеры ориентировочные: по типовому времени пребывания и гидравлическим нагрузкам.</p>`;
    return;
  }
  const b = L.blocks[i], u = U[b.id], P = SeshatPlan.PLAN[b.id], st = STG[u.st], before = sim.cin[i], after = sim.prof[i + 1], e = ec.steps[i];
  const rows = [['ss', 'Взвешенные вещества'], ['bod', 'БПК₅'], ['nh4', 'Азот аммонийный'], ['no3', 'Азот нитратов'], ['p', 'Фосфор фосфатов'], ['oil', 'Нефтепродукты']]
    .filter(([k]) => Math.abs(before[k] - after[k]) > 1e-6 || before[k] > 0)
    .map(([k, n]) => { const d = before[k] > 0 ? (after[k] - before[k]) / before[k] * 100 : 0; return `<tr><td>${n}</td><td class="num">${fmt(before[k])}</td><td class="num">${fmt(after[k])}</td><td class="num ${d < -0.5 ? 'down' : d > 0.5 ? 'up' : ''}">${Math.abs(d) < 0.5 ? '—' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(0) + '%'}</td></tr>`; }).join('');
  // трубы сооружения
  const preds = SeshatGraph.preds(steps)[i], s = steps[i], src = sim.src[i];
  const ins = [...(src ? [`исходные стоки${src < 0.999 ? ` (${Math.round(src * 100)}%)` : ''}`] : []), ...preds.map(p => esc(gpName(p, steps)))];
  const outs = s.to.map((t, k) => `<li><span>→ ${esc(gpName(t, steps))}</span>${inp.edit && s.to.length > 1 ? `<label class="gp-share">доля <input ${NUM_ATTRS} data-share="${k}" value="${showNum(Math.round(SeshatGraph.share(s, k) * 1000) / 10)}" aria-label="Доля потока в ${esc(gpName(t, steps))}, %">%</label>` : ''}${inp.edit ? `<button type="button" class="icon-btn" data-cut="${t}" aria-label="Удалить трубу в ${esc(gpName(t, steps))}">✕</button>` : ''}</li>`).join('');
  const anc = SeshatGraph.ancestors(steps);
  const targets = steps.map((_, k) => k).filter(k => k !== i && !s.to.includes(k) && !anc[i].has(k));
  const pipesHtml = `<h3>Трубы</h3>
    <dl class="gp-dl"><dt>Расход</dt><dd>${n0(inp.q * b.f)} м³/сут${b.f < 0.999 ? ` (${Math.round(b.f * 100)}%)` : ''}</dd><dt>Поступает</dt><dd>${ins.join(', ')}</dd></dl>
    <ul class="gp-outs">${outs || '<li><span>→ выпуск</span></li>'}</ul>
    ${inp.edit ? `${targets.length ? `<div class="gp-link"><select id="gp-target" aria-label="Куда ещё подать воду">${targets.map(k => `<option value="${k}">${esc(gpName(k, steps))}</option>`).join('')}</select><button type="button" data-gpact="link">Подать воду</button></div>` : ''}
      <div class="gp-acts"><button type="button" data-gpact="par">Добавить параллельную линию</button><button type="button" class="danger" data-gpact="del">Удалить сооружение</button></div>` : ''}`;
  box.innerHTML = `<div class="gp-nav"><button type="button" data-gpnav="list">← Все сооружения</button>
      <span><button type="button" data-gpnav="prev" ${i === 0 ? 'disabled' : ''} aria-label="Предыдущее">↑</button><button type="button" data-gpnav="next" ${i === L.blocks.length - 1 ? 'disabled' : ''} aria-label="Следующее">↓</button></span></div>
    <div class="gp-head" style="--c:${st.c}">${SeshatIcons.icon(b.id, 64, u.n)}<div><span class="gp-stage">${i + 1} · ${st.n}</span><h2>${esc(u.n)}</h2></div></div>
    ${pipesHtml}
    <h3>Как работает</h3><p>${esc(P.how)}</p>
    <h3>Типовые параметры</h3><ul>${P.params.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Что происходит с водой</h3>
    <div class="tbl-wrap"><table class="gp-tbl"><thead><tr><th>Показатель, мг/л</th><th>до</th><th>после</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${sim.warns[i].length ? `<div class="warns">${sim.warns[i].map(w => `<div class="w">${esc(w)}</div>`).join('')}</div>` : ''}
    <h3>На генплане</h3><p>${gpSize(b)}</p>
    <dl class="gp-dl"><dt>Капзатраты</dt><dd>${mln(e.capex)}</dd><dt>Эксплуатация</dt><dd>${money(e.opex)} в сутки</dd><dt>Электроэнергия</dt><dd>${n0(e.kwh)} кВт·ч/сут</dd>${sim.perStep[i].sludge >= 1 ? `<dt>Осадок</dt><dd>${n1(sim.perStep[i].sludge / 1000)} т сухого вещества в сутки</dd>` : ''}</dl>`;
}
function gpSize(b) {
  return b.parts.map(p => p.kind === 'clar'
    ? `${p.label ? p.label.toLowerCase() + ': ' : ''}${p.n} × Ø ${n0(p.d)} м`
    : `${n0(p.w)} × ${n0(p.h)} м`).join(' + ') + ` · ≈ ${n0(b.area)} м²`;
}

/* ---------- правка схемы с генплана ---------- */
// steps — новая схема; sel — какое сооружение выбрать после правки
function gpCommit(steps, sel, msg) {
  if (!steps) return;
  state.steps = steps;
  gpUI.sel = sel; gpUI.edge = null;
  update(); renderGenplan();
  if (msg) toast(msg);
}
const remap = (i, map) => i == null || !map ? i : map[i];
// закрепить места всех сооружений такими, какими они нарисованы
function withPositions(blocks) {
  return SeshatGraph.norm(state.steps).map((s, i) => ({ ...s, x: Math.round(blocks[i].x * 2) / 2, y: Math.round(blocks[i].y * 2) / 2 }));
}
function gpOp(kind, arg) {
  const G = SeshatGraph, cur = SeshatGraph.norm(state.steps), i = gpUI.sel;
  if (kind === 'link' || kind === 'drop') {
    const [a, b] = arg, out = G.connect(cur, a, b);
    if (!out) { toast(a === b ? 'Труба должна вести в другое сооружение' : 'Так вода пошла бы по кругу: это сооружение уже стоит выше по течению'); return; }
    gpCommit(out, remap(kind === 'drop' ? a : i, G.lastPos()), `Труба проложена: ${gpName(a, cur)} → ${gpName(b, cur)}`);
  } else if (kind === 'cut') {
    const [a, b] = arg;
    gpCommit(G.disconnect(cur, a, b), remap(i, G.lastPos()), 'Труба удалена');
  } else if (kind === 'par') {
    const L = gpView.L, r = G.parallel(cur, i), n = cur.length;
    // новая линия — под исходной, если места закреплены
    if (cur.some(s => s.x != null)) {
      const b = L.blocks[i], fixed = withPositions(L.blocks);
      r.steps.forEach((s, k) => { const old = r.pos.indexOf(k); const src = old < n ? fixed[old] : { x: b.x, y: b.y + b.h + SeshatPlan.GAP }; s.x = src.x; s.y = src.y; });
    }
    gpCommit(r.steps, r.index, 'Добавлена параллельная линия: поток делится поровну');
  } else if (kind === 'del') {
    const name = gpName(i, cur);
    gpCommit(G.remove(cur, i), null, `Удалено: ${name}`);
  } else if (kind === 'auto') {
    gpCommit(cur.map(s => { const o = { ...s }; delete o.x; delete o.y; return o; }), i, 'Сооружения расставлены автоматически');
  }
}

/* ---------- мышь и касания: перетаскивание и трубы ---------- */
function svgPoint(svg, ev) {
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
const overlapBox = (a, b, g) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
let gpDrag = null;
const capture = ev => { try { gpCanvas.setPointerCapture(ev.pointerId); } catch (e) {} };
const gpCanvas = document.getElementById('gp-canvas');
gpCanvas.addEventListener('pointerdown', ev => {
  if (!gpView || ev.button > 0) return;
  const port = ev.target.closest('.gp-port'), unit = ev.target.closest('.gp-unit');
  if (port && gpView.inp.edit) {
    ev.preventDefault();
    const i = +port.dataset.port, b = gpView.L.blocks[i], p = [b.x + b.w + gpView.fs * 0.75, SeshatPlan.flowY(b)];
    const line = el('polyline', { points: `${p} ${p}`, class: 'gp-pipe gp-temp' }, gpView.svg);
    gpDrag = { kind: 'pipe', i, p, line, id: ev.pointerId };
    capture(ev);
    return;
  }
  if (!unit) return;
  const i = +unit.dataset.i;
  gpDrag = { kind: 'unit', i, g: unit, start: svgPoint(gpView.svg, ev), sx: ev.clientX, sy: ev.clientY, moved: false, id: ev.pointerId };
  if (gpView.inp.edit) capture(ev);
});
gpCanvas.addEventListener('pointermove', ev => {
  if (!gpDrag || ev.pointerId !== gpDrag.id) return;
  const pt = svgPoint(gpView.svg, ev);
  if (gpDrag.kind === 'pipe') {
    gpDrag.line.setAttribute('points', `${gpDrag.p} ${pt.x},${pt.y}`);
    const hit = document.elementFromPoint(ev.clientX, ev.clientY), u = hit && hit.closest && hit.closest('.gp-unit');
    gpCanvas.querySelectorAll('.gp-unit.target').forEach(x => { if (x !== u) x.classList.remove('target'); });
    if (u && +u.dataset.i !== gpDrag.i) u.classList.add('target');
    gpDrag.target = u && +u.dataset.i !== gpDrag.i ? +u.dataset.i : null;
    return;
  }
  if (!gpView.inp.edit) return;
  if (!gpDrag.moved && Math.hypot(ev.clientX - gpDrag.sx, ev.clientY - gpDrag.sy) < 5) return;
  gpDrag.moved = true;
  const dx = Math.round((pt.x - gpDrag.start.x) * 2) / 2, dy = Math.round((pt.y - gpDrag.start.y) * 2) / 2;
  gpDrag.dx = dx; gpDrag.dy = dy;
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
  if (!gpDrag || ev.pointerId !== gpDrag.id) return;
  const d = gpDrag; gpDrag = null;
  if (d.kind === 'pipe') {
    d.line.remove(); gpCanvas.querySelectorAll('.gp-unit.target').forEach(x => x.classList.remove('target'));
    if (!cancel && d.target != null) gpOp('drop', [d.i, d.target]);
    return;
  }
  if (!d.moved) { if (!cancel) gpSelect(d.i); return; }
  if (cancel || d.clash) { renderGenplan(); if (d.clash) toast('Сооружения не должны перекрываться: поставьте его на свободное место'); return; }
  gpCommit(withPositions(d.blocks), gpUI.sel);
}
gpCanvas.addEventListener('pointerup', ev => gpEnd(ev, false));
gpCanvas.addEventListener('pointercancel', ev => gpEnd(ev, true));
gpCanvas.addEventListener('click', ev => {
  const h = ev.target.closest('.gp-pipe-hit'); if (!h) return;
  const [a, b] = h.dataset.e.split('-').map(Number);
  gpUI.edge = [a, b]; gpUI.sel = null; renderGenplan();
});

/* ---------- события ---------- */
function gpSelect(i) {
  gpUI.sel = i; gpUI.edge = null;
  renderGenplan();
  if (i != null && window.matchMedia('(max-width: 1100px)').matches) document.getElementById('gp-info').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.getElementById('gp-source').addEventListener('change', ev => { state.gp = ev.target.value; gpUI.sel = null; gpUI.edge = null; saveState(); renderGenplan(); });
gpCanvas.addEventListener('keydown', ev => {
  const g = ev.target.closest('.gp-unit'); if (!g || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault(); gpSelect(+g.dataset.i);
  const again = document.querySelector(`.gp-unit[data-i="${g.dataset.i}"]`); if (again) again.focus();
});
document.addEventListener('keydown', ev => {
  if (document.body.dataset.view !== 'genplan' || !gpUI.edge || (ev.key !== 'Delete' && ev.key !== 'Backspace')) return;
  if (ev.target.closest && ev.target.closest('input,select,textarea')) return;
  ev.preventDefault(); gpOp('cut', gpUI.edge);
});
document.getElementById('gp-tools').addEventListener('click', ev => {
  const a = ev.target.closest('[data-gpact]')?.dataset.gpact; if (!a) return;
  if (a === 'auto') gpOp('auto');
  if (a === 'open') { const inp = gpInput(state.gp); if (inp.pid) { openVariant(inp.pid, inp.vid); state.gp = 'c'; } }
});
document.getElementById('gp-info').addEventListener('click', ev => {
  const b = ev.target.closest('[data-gpi]'); if (b) { gpSelect(+b.dataset.gpi); return; }
  const cut = ev.target.closest('[data-cut]'); if (cut) { gpOp('cut', [gpUI.sel, +cut.dataset.cut]); return; }
  const act = ev.target.closest('[data-gpact]')?.dataset.gpact;
  if (act === 'cut') { gpOp('cut', gpUI.edge); return; }
  if (act === 'link') { gpOp('link', [gpUI.sel, +document.getElementById('gp-target').value]); return; }
  if (act === 'par' || act === 'del') { gpOp(act); return; }
  const nav = ev.target.closest('[data-gpnav]')?.dataset.gpnav; if (!nav) return;
  if (nav === 'list') { gpUI.edge = null; gpSelect(null); }
  if (nav === 'prev' && gpUI.sel > 0) gpSelect(gpUI.sel - 1);
  if (nav === 'next') gpSelect(gpUI.sel + 1);
});
document.getElementById('gp-info').addEventListener('change', ev => {
  const t = ev.target; if (t.dataset.share == null) return;
  // изменили одну долю — остальные трубы делят оставшееся в прежней пропорции, в сумме 100%
  const k = +t.dataset.share, v = parseNum(t.value);
  if (v == null || Number.isNaN(v) || v <= 0 || v >= 100) { markInvalid(t, NaN); toast('Доля — от 1 до 99%'); return; }
  const cur = SeshatGraph.norm(state.steps), s = cur[gpUI.sel];
  const old = s.to.map((_, j) => SeshatGraph.share(s, j)), rest = old.reduce((a, x, j) => j === k ? a : a + x, 0);
  const w = old.map((x, j) => j === k ? v : (100 - v) * x / rest);
  gpCommit(SeshatGraph.setSplit(cur, gpUI.sel, w), gpUI.sel);
});
VIEW_RENDER.genplan = renderGenplan;
