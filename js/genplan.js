// Раздел «Генплан»: станция в плане (вид сверху), клик по сооружению — описание принципа работы.
// Использует состояние и функции конструктора (app.js) и проектов (projects.js).

const gpUI = { sel: null };
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
    if (v) return { q: pr.data.influent.q, c: pr.data.influent.c, steps: v.steps, prices: pr.data.prices, title: `${pr.name}: ${v.name}` };
  }
  return { q: state.q, c: state.c, steps: state.steps, prices: state.prices, title: currentName('scheme', 'Текущая схема') };
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

function drawUnit(svg, b, i, stepEco, fs) {
  const u = U[b.id], st = STG[u.st], P = SeshatPlan.PLAN[b.id];
  const g = el('g', { class: 'gp-unit' + (gpUI.sel === i ? ' sel' : ''), 'data-i': i, tabindex: 0, role: 'button', style: `--c:${st.c}`, 'aria-label': `${i + 1}. ${u.n}. Показать, как работает` }, svg);
  el('title', {}, g).textContent = `${i + 1}. ${u.n}`;
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
}

/* ---------- генплан целиком ---------- */
function renderGenplan() {
  const sel = document.getElementById('gp-source'), sources = gpSources();
  if (!state.gp || !sources.some(s => s.id === state.gp)) state.gp = 'c';
  const groups = {};
  sources.forEach(s => { (groups[s.group || ''] = groups[s.group || ''] || []).push(s); });
  sel.innerHTML = Object.entries(groups).map(([g, list]) => {
    const opts = list.map(s => `<option value="${esc(s.id)}" ${s.id === state.gp ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    return g ? `<optgroup label="Проект «${esc(g)}»">${opts}</optgroup>` : opts;
  }).join('');

  const inp = gpInput(state.gp), canvas = document.getElementById('gp-canvas');
  if (!inp.steps.length) {
    canvas.innerHTML = '<div class="empty">В схеме нет сооружений. Добавьте ступени в конструкторе.</div>';
    document.getElementById('gp-stats').innerHTML = ''; document.getElementById('gp-info').innerHTML = '';
    return;
  }
  const sim = SeshatModel.simulate(inp), ec = SeshatEconomics.costs(inp, sim, inp.prices);
  const L = SeshatPlan.layout(inp.q, inp.steps.map(s => s.u));
  if (gpUI.sel != null && gpUI.sel >= L.blocks.length) gpUI.sel = null;
  const W = L.site.w, H = L.site.h, fs = Math.max(2.6, Math.min(9, W / 58));
  const pad = fs * 4;

  const svg = el('svg', { viewBox: `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`, class: 'gp-svg', role: 'img', 'aria-label': `Генплан: ${inp.title}` });
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'gp-ground' }, svg);
  const road = 9;
  el('rect', { x: road, y: road, width: W - road * 2, height: H - road * 2, rx: 6, class: 'gp-road' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'gp-fence' }, svg);

  // трубопроводы: вход, между ступенями, выпуск
  const first = L.blocks[0], last = L.blocks[L.blocks.length - 1];
  const fy = b => b.y + b.parts[0].h / 2;
  const lastRev = last.row % 2 === 1;
  const flows = [[[-pad * 0.9, fy(first)], [first.x, fy(first)]], ...L.pipes, [[lastRev ? last.x : last.x + last.w, fy(last)], [lastRev ? -pad * 0.9 : W + pad * 0.9, fy(last)]]];
  flows.forEach(p => el('polyline', { points: p.map(q => q.join(',')).join(' '), class: 'gp-pipe' }, svg));
  el('text', { x: -pad * 0.9, y: fy(first) - fs * 0.7, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': 'start' }, svg).textContent = 'Стоки';
  el('text', { x: lastRev ? -pad * 0.9 : W + pad * 0.9, y: fy(last) - fs * 0.7, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': lastRev ? 'start' : 'end' }, svg).textContent = 'Выпуск';

  // осадок: от сооружений к цеху обезвоживания
  const sl = L.aux.find(a => a.id === 'sludge'), collectorY = sl.y - SeshatPlan.GAP * 0.7;
  L.blocks.forEach((b, i) => {
    if (sim.perStep[i].sludge < 1) return;
    el('polyline', { points: `${b.cx},${b.y + b.h} ${b.cx},${collectorY} ${sl.x + sl.w / 2},${collectorY} ${sl.x + sl.w / 2},${sl.y}`, class: 'gp-sludge' }, svg);
  });

  L.aux.forEach(a => { const g = el('g', { class: 'gp-aux' }, svg); el('title', {}, g).textContent = a.label; drawBld(g, a.x, a.y, a.w, a.h, a.id === 'abk' ? 'АБК' : 'Обезвоживание', fs); });
  L.blocks.forEach((b, i) => drawUnit(svg, b, i, ec.steps[i], fs));

  // север и масштаб
  const nx = W - fs * 2, ny = fs * 2.2;
  el('path', { d: `M${nx} ${ny - fs * 1.6}l${fs * 0.7} ${fs * 2}l-${fs * 0.7} -${fs * 0.5}l-${fs * 0.7} ${fs * 0.5}z`, class: 'gp-north' }, svg);
  el('text', { x: nx, y: ny + fs * 1.4, class: 'gp-note', 'font-size': fs * 0.9, 'text-anchor': 'middle' }, svg).textContent = 'С';
  const nice = [10, 20, 25, 50, 100, 200].find(v => v >= W / 8) || 200;
  const sx = W - nice - fs * 2, sy = H - fs * 1.4;
  el('path', { d: `M${sx} ${sy}h${nice}M${sx} ${sy - fs * 0.4}v${fs * 0.8}M${sx + nice} ${sy - fs * 0.4}v${fs * 0.8}M${sx + nice / 2} ${sy - fs * 0.25}v${fs * 0.5}`, class: 'gp-scale' }, svg);
  el('text', { x: sx + nice / 2, y: sy - fs * 0.6, class: 'gp-note', 'font-size': fs * 0.8, 'text-anchor': 'middle' }, svg).textContent = `${nice} м`;

  canvas.replaceChildren(svg);
  document.getElementById('gp-stats').innerHTML = `
    <span><b>${n0(inp.q)}</b> м³/сут</span>
    <span>участок <b>${n1(L.area.site / 1e4)} га</b> (${n0(W)} × ${n0(H)} м)</span>
    <span>сооружения <b>${n0(L.area.structures)} м²</b></span>
    <span>капзатраты <b>${mln(ec.total.capex)}</b></span>`;
  renderGpInfo(inp, sim, ec, L);
}

function renderGpInfo(inp, sim, ec, L) {
  const box = document.getElementById('gp-info'), i = gpUI.sel;
  if (i == null) {
    box.innerHTML = `<h2>Сооружения</h2><p class="hint">Нажмите на сооружение на плане или в списке, чтобы узнать, как оно работает.</p>
      <ol class="gp-list">${L.blocks.map((b, k) => `<li><button type="button" data-gpi="${k}" style="--c:${STG[U[b.id].st].c}">${SeshatIcons.icon(b.id, 34)}<span><b>${esc(U[b.id].n)}</b><small>${gpSize(b)}</small></span></button></li>`).join('')}</ol>
      <p class="hint">Также на плане: цех обезвоживания осадка (${n0(L.aux[0].area)} м²) и административно-бытовой корпус. Размеры ориентировочные: по типовому времени пребывания и гидравлическим нагрузкам.</p>`;
    return;
  }
  const b = L.blocks[i], u = U[b.id], P = SeshatPlan.PLAN[b.id], st = STG[u.st], before = sim.prof[i], after = sim.prof[i + 1], e = ec.steps[i];
  const rows = [['ss', 'Взвешенные вещества'], ['bod', 'БПК₅'], ['nh4', 'Азот аммонийный'], ['no3', 'Азот нитратов'], ['p', 'Фосфор фосфатов'], ['oil', 'Нефтепродукты']]
    .filter(([k]) => Math.abs(before[k] - after[k]) > 1e-6 || before[k] > 0)
    .map(([k, n]) => { const d = before[k] > 0 ? (after[k] - before[k]) / before[k] * 100 : 0; return `<tr><td>${n}</td><td class="num">${fmt(before[k])}</td><td class="num">${fmt(after[k])}</td><td class="num ${d < -0.5 ? 'down' : d > 0.5 ? 'up' : ''}">${Math.abs(d) < 0.5 ? '—' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(0) + '%'}</td></tr>`; }).join('');
  box.innerHTML = `<div class="gp-nav"><button type="button" data-gpnav="list">← Все сооружения</button>
      <span><button type="button" data-gpnav="prev" ${i === 0 ? 'disabled' : ''} aria-label="Предыдущее">↑</button><button type="button" data-gpnav="next" ${i === L.blocks.length - 1 ? 'disabled' : ''} aria-label="Следующее">↓</button></span></div>
    <div class="gp-head" style="--c:${st.c}">${SeshatIcons.icon(b.id, 64, u.n)}<div><span class="gp-stage">${i + 1} · ${st.n}</span><h2>${esc(u.n)}</h2></div></div>
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

/* ---------- события ---------- */
function gpSelect(i) {
  gpUI.sel = i;
  renderGenplan();
  if (i != null && window.matchMedia('(max-width: 1100px)').matches) document.getElementById('gp-info').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.getElementById('gp-source').addEventListener('change', ev => { state.gp = ev.target.value; gpUI.sel = null; saveState(); renderGenplan(); });
document.getElementById('gp-canvas').addEventListener('click', ev => { const g = ev.target.closest('.gp-unit'); if (g) gpSelect(+g.dataset.i); });
document.getElementById('gp-canvas').addEventListener('keydown', ev => {
  const g = ev.target.closest('.gp-unit'); if (!g || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault(); gpSelect(+g.dataset.i);
  const again = document.querySelector(`.gp-unit[data-i="${g.dataset.i}"]`); if (again) again.focus();
});
document.getElementById('gp-info').addEventListener('click', ev => {
  const b = ev.target.closest('[data-gpi]'); if (b) { gpSelect(+b.dataset.gpi); return; }
  const nav = ev.target.closest('[data-gpnav]')?.dataset.gpnav; if (!nav) return;
  if (nav === 'list') gpSelect(null);
  if (nav === 'prev' && gpUI.sel > 0) gpSelect(gpUI.sel - 1);
  if (nav === 'next') gpSelect(gpUI.sel + 1);
});
VIEW_RENDER.genplan = renderGenplan;
