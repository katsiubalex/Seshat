// Конструктор модуля «Водоотводящие сети»: план самотёчной хозяйственно-бытовой сети, подбор диаметров и уклонов,
// продольный профиль и «Логика расчёта» у каждого участка. Расчёт — js/sewercalc.js. Сеть хранится в этом браузере.
(function () {
  if (PAGE !== 'cloacina' || !window.SeshatSewer) return;
  const W = SeshatSewer, KEY = 'seshat-sewer';
  const num = (v, d = 1) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const tex = (f, disp) => (window.SeshatRich ? SeshatRich.tex(f, disp) : `<code>${esc(f)}</code>`);
  const KIND = { norm: 'норма', method: 'методика', assume: 'допущение', input: 'исходные данные', calc: 'расчёт' };
  const inReg = id => !!(window.SeshatDocs && SeshatDocs.DOCS.some(d => d.id === id));
  const refHTML = r => r ? `${inReg(r.doc) ? `<a href="#doc-${esc(r.doc)}">${esc(W.DOCS[r.doc] || r.doc)}</a>` : esc(W.DOCS[r.doc] || r.doc)}, ${esc(r.where)}${r.page ? ', с. ' + r.page : ''}` : '';

  /* ---------- состояние ---------- */
  const fresh = () => ({ net: W.example(), sel: null, tool: 'select', tab: 'pipes', show: 'd', mat: 'pe', kind: 'street',
    cost: { mat: 'полиэтиленовые', wet: 0, fix: 0, grp: '1-3' } });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...S, sel: null })); } catch (e) { /* хранилище недоступно — работаем без сохранения */ } };
  let R = null, pick = null, view = null;
  const node = id => S.net.nodes.find(n => n.id === id), pipe = id => S.net.pipes.find(p => p.id === id);
  const res = id => R && R.pipes ? R.pipes.find(p => p.id === id) : null;
  const dist = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  const nextId = (list, pre) => { let i = 1; while (list.some(x => x.id === pre + i)) i++; return pre + i; };
  const P = () => (S.net.params = Object.assign({ qzh: 160, density: 300, md: 30, place: 'existing', soil: 'clay', Mt: 15.6, t: 15, ss: 200, mat: 'pe', hStart: 0, localSlope: false,
    extra: { services: 0.06, unaccounted: 0.04 } }, S.net.params || {}));

  function compute() {
    try { return W.solve(S.net); } catch (e) { return { ok: false, errors: ['Ошибка расчёта: ' + e.message], pipes: [] }; }
  }
  const allChecks = () => (R.pipes || []).flatMap(p => p.checks.map(c => ({ ...c, pipe: p.id })));

  /* ---------- план ---------- */
  const fillClass = r => !r || !isFinite(r.fill) ? '' : 'v' + Math.min(4, Math.floor(r.fill / r.fillMax * 4.0001));
  function bounds() {
    const xs = S.net.nodes.map(n => n.x || 0), ys = S.net.nodes.map(n => n.y || 0);
    if (!xs.length) return { x: -100, y: -100, w: 1000, h: 600 };
    const x0 = Math.min(...xs) - 120, y0 = Math.min(...ys) - 120, x1 = Math.max(...xs) + 120, y1 = Math.max(...ys) + 120;
    const w = Math.max(x1 - x0, 600), h = Math.max(y1 - y0, 360, w * 0.45);
    return { x: x0, y: y0 - (h - (y1 - y0)) / 2, w, h };
  }
  function planSVG() {
    const b = view || (view = bounds()), k = b.w / 700;
    const grid = []; for (let x = Math.ceil(b.x / 100) * 100; x < b.x + b.w; x += 100) grid.push(`<path d="M${x} ${b.y}V${b.y + b.h}"/>`);
    for (let y = Math.ceil(b.y / 100) * 100; y < b.y + b.h; y += 100) grid.push(`<path d="M${b.x} ${y}H${b.x + b.w}"/>`);
    const pipes = S.net.pipes.map(p => {
      const A = node(p.a), B = node(p.b); if (!A || !B) return '';
      const r = res(p.id), sel = S.sel === 'p:' + p.id, bad = r && r.checks.some(c => c.level === 'bad'), warn = r && r.checks.some(c => c.level === 'warn');
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI, flip = ang > 90 || ang < -90 ? 180 : 0;
      const lab = !r ? esc(p.id) : S.show === 'd' ? `Ø${r.d} · ${num(r.i * 1000, 1)}‰` : S.show === 'q' ? `${num(r.qDes, 1)} л/с` : `${num(r.fill, 2)} · ${num(r.v, 2)} м/с`;
      return `<g class="np ${fillClass(r)}${sel ? ' sel' : ''}${bad ? ' warn bad' : warn ? ' warn' : ''}" data-p="${esc(p.id)}">
        <line class="np-hit" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke-width="${16 * k}"/>
        <line class="np-l" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke-width="${(2 + (r ? r.d : 150) / 120) * k}"${p.kind === 'yard' ? ` stroke-dasharray="${8 * k} ${5 * k}"` : ''}/>
        <path class="np-a" transform="translate(${mx} ${my}) rotate(${ang})" d="M${-7 * k} ${-6 * k}L${7 * k} 0L${-7 * k} ${6 * k}z"/>
        <text class="np-t" transform="translate(${mx} ${my}) rotate(${ang + flip})" y="${-10 * k}" font-size="${11 * k}">${lab}</text></g>`;
    }).join('');
    const outlets = new Set(S.net.nodes.filter(n => !S.net.pipes.some(p => p.a === n.id) && S.net.pipes.some(p => p.b === n.id)).map(n => n.id));
    const nodes = S.net.nodes.map(n => {
      const sel = S.sel === 'n:' + n.id || pick === n.id, out = outlets.has(n.id);
      return `<g class="nn${out ? ' src' : ''}${sel ? ' sel' : ''}" data-n="${esc(n.id)}" transform="translate(${n.x || 0} ${n.y || 0})">
        ${out ? `<rect x="${-12 * k}" y="${-12 * k}" width="${24 * k}" height="${24 * k}" rx="${4 * k}"/>` : `<circle r="${10 * k}"/>`}
        <text class="nn-id" y="${4.5 * k}" font-size="${11.5 * k}">${esc(n.id)}</text>
        <text class="nn-v" x="${-12 * k}" y="${24 * k}" text-anchor="end" font-size="${11 * k}">${num(n.z, 2)}</text></g>`;
    }).join('');
    return `<svg id="sew-svg" class="net-svg tool-${S.tool}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="План водоотводящей сети">
      <g class="ng">${grid.join('')}</g>${pipes}${nodes}</svg>`;
  }

  /* ---------- панели ---------- */
  const fld = (label, name, value, extra = '') => `<label class="net-f"><span>${label}</span><input ${NUM_ATTRS} data-f="${name}" value="${esc(showNum(value ?? ''))}" ${extra}></label>`;
  const sel = (label, name, opts, cur) => `<label class="net-f"><span>${label}</span><select data-f="${name}">${opts.map(([v, t]) => `<option value="${esc(String(v))}"${String(v) === String(cur) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  function leftHTML() {
    const p = P();
    return `
      <section class="panel"><h2>Расходы</h2>
        ${fld('Водопотребление, л/сут на жителя (СП 31, табл. 1: 140–180)', 'P.qzh', p.qzh)}
        ${fld('Плотность населения, чел/га', 'P.density', p.density)}
        ${fld('Торговля, услуги, местная промышленность, % (6–12)', 'P.services', Math.round(p.extra.services * 100))}
        ${fld('Неучтённые притоки, % (4–8)', 'P.unaccounted', Math.round(p.extra.unaccounted * 100))}
        <p class="hint">Средний расход участка — от площади квартала и плотности; доли п. 5.1.5 <a href="#doc-sp32">СП 32</a>. Коэффициент неравномерности — табл. 1, дополнительный приток — формула (1).</p></section>
      <section class="panel"><h2>Дополнительный приток</h2>
        ${sel('Территория (коэффициент a)', 'P.place', [['existing', 'Существующее поселение — 0,45'], ['newAbove', 'Новый район, сети выше УГВ — 0,15'], ['newBelow', 'Новый район, сети ниже УГВ — 0,25']], p.place)}
        ${fld('Суточный максимум осадков md, мм (СП 131, табл. 6.1)', 'P.md', p.md)}
        <p class="hint">В формулу идёт не больше 30 мм. Санкт-Петербург — 76 мм.</p></section>
      <section class="panel"><h2>Глубина заложения</h2>
        ${sel('Грунт (d0 по СП 22)', 'P.soil', [['clay', 'Суглинки и глины — 0,23 м'], ['sandy', 'Супеси, пески мелкие и пылеватые — 0,28 м'], ['sand', 'Пески гравелистые, крупные, средние — 0,30 м'], ['coarse', 'Крупнообломочные — 0,34 м']], p.soil)}
        ${fld('Mt — сумма отрицательных среднемесячных температур (СП 131, табл. 7.1)', 'P.Mt', p.Mt)}
        ${fld('Начальная глубина концевых участков, м (0 — по норме)', 'P.hStart', p.hStart)}
        <p class="hint">Глубина промерзания ${num(R.dfn, 2)} м. Санкт-Петербург: Mt = 15,6.</p></section>
      <section class="panel"><h2>Трубы и сточная вода</h2>
        ${sel('Материал новых участков', 'mat', Object.entries(W.MATERIALS).map(([k, m]) => [k, m.n]), S.mat)}
        ${sel('Новые участки', 'kind', [['street', 'Уличная сеть'], ['yard', 'Внутриквартальная сеть']], S.kind)}
        ${fld('Температура сточной воды, °С', 'P.t', p.t)}${fld('Взвешенные вещества, мг/л', 'P.ss', p.ss)}
        <label class="net-c"><input type="checkbox" data-f="P.localSlope"${p.localSlope ? ' checked' : ''}> Пониженные уклоны по местным условиям (150 мм — 0,007; 200 мм — 0,005)</label>
        <div class="net-btns"><button type="button" data-act="example">Пример</button><button type="button" data-act="clear">Очистить</button></div></section>`;
  }
  function rightHTML() {
    const list = R.errors && R.errors.length ? R.errors.map(e => ({ level: 'bad', text: e })) : allChecks().filter(c => c.level !== 'info');
    const info = allChecks().filter(c => c.level === 'info');
    const head = R.pipes.length ? (R.ok ? { level: 'ok', text: `Сеть рассчитана: ${R.pipes.length} уч., средний расход поселения ${num(R.Qday, 0)} м³/сут.` } : null) : null;
    const items = [head, ...list].filter(Boolean);
    return `<section class="panel"><h2>Проверки</h2><ul class="net-checks">${items.map(c => `<li class="nc-${c.level}">${c.pipe ? `<b>${esc(c.pipe)}</b>: ` : ''}${esc(c.text)}${c.ref ? ` <span class="net-ref">${refHTML(c.ref)}</span>` : ''}</li>`).join('') || '<li class="nc-ok">Замечаний нет.</li>'}</ul>
      ${info.length ? `<details class="sew-info"><summary>Справки (${info.length})</summary><ul class="net-checks">${info.map(c => `<li><b>${esc(c.pipe)}</b>: ${esc(c.text)}</li>`).join('')}</ul></details>` : ''}</section>` + editorHTML();
  }
  function editorHTML() {
    const [t, id] = (S.sel || '').split(':');
    if (t === 'n' && node(id)) {
      const n = node(id);
      return `<section class="panel net-ed"><h2>Колодец ${esc(n.id)}</h2>
        <label class="net-f"><span>Название</span><input type="text" data-f="n.id" value="${esc(n.id)}" maxlength="12"></label>
        ${fld('Отметка поверхности земли, м', 'n.z', n.z)}
        <button type="button" data-act="profile">Профиль от колодца до выпуска</button> <button type="button" class="danger" data-act="del">Удалить колодец</button></section>`;
    }
    if (t === 'p' && pipe(id)) {
      const p = pipe(id), r = res(id);
      return `<section class="panel net-ed"><h2>Участок ${esc(p.id)}: ${esc(p.a)} → ${esc(p.b)}</h2>
        ${fld('Длина, м', 'p.L', p.L)}${fld('Площадь квартала, обслуживаемого участком, га', 'p.area', p.area)}
        ${fld('Жителей (если задано — вместо площади)', 'p.people', p.people)}${fld('Сосредоточенный расход, л/с', 'p.conc', p.conc)}
        ${sel('Сеть', 'p.kind', [['street', 'Уличная'], ['yard', 'Внутриквартальная']], p.kind || 'street')}
        ${sel('Материал', 'p.mat', Object.entries(W.MATERIALS).map(([k, m]) => [k, m.n]), p.mat || P().mat)}
        ${sel('Диаметр, мм', 'p.d', [['', 'подобрать'], ...W.DIAMETERS.map(d => [d, d])], p.d || '')}
        ${fld('Уклон, ‰ (пусто — подобрать)', 'p.i', p.i != null ? +(p.i * 1000).toFixed(3) : '')}
        ${r ? `<dl class="gp-dl net-dl"><dt>Расчётный расход</dt><dd>${num(r.qDes, 2)} л/с</dd><dt>Диаметр, уклон</dt><dd>${r.d} мм, ${num(r.i * 1000, 2)}‰</dd><dt>Наполнение</dt><dd>${num(r.fill, 2)} (не более ${num(r.fillMax, 2)})</dd><dt>Скорость</dt><dd>${num(r.v, 2)} м/с (не менее ${num(r.vmin, 2)})</dd><dt>Глубина лотка</dt><dd>${num(r.depthA, 2)} → ${num(r.depthB, 2)} м</dd></dl>` : ''}
        <button type="button" class="primary" data-act="logic">Логика расчёта</button> <button type="button" class="danger" data-act="del">Удалить участок</button></section>`;
    }
    return `<section class="panel net-ed"><h2>Как работать</h2><ul class="net-help">
      <li><b>Выбор</b> — нажмите на колодец или участок, чтобы изменить его; колодцы можно перетаскивать.</li>
      <li><b>Колодец</b> — нажмите на пустое место плана. Сетка — 100 м.</li>
      <li><b>Участок</b> — нажмите на верхний колодец, затем на нижний: стрелка показывает направление течения. Из колодца выходит только один участок.</li>
      <li>Расчёт идёт сразу. У каждого участка есть «Логика расчёта»: формула, подстановка и пункт нормы для каждого шага.</li></ul></section>`;
  }

  /* ---------- таблицы ---------- */
  function pipesTable() {
    if (!R.pipes.length) return `<p class="hint">${R.errors && R.errors.length ? esc(R.errors.join(' ')) : 'Нарисуйте сеть или нажмите «Пример».'}</p>`;
    return `<div class="net-tw"><table class="net-t"><thead><tr><th>Участок</th><th class="l">Колодцы</th><th>L, м</th><th>qср, л/с</th><th>qad, л/с</th><th>Kобщ</th><th>qmax, л/с</th><th>d, мм</th><th>i, ‰</th><th>h/d</th><th>v, м/с</th><th>Vmin</th><th>Глубина, м</th></tr></thead><tbody>
      ${R.order.map(id => res(id)).map(r => `<tr data-sel="p:${esc(r.id)}" class="${r.checks.some(c => c.level === 'bad') ? 'bad' : ''}"><td>${esc(r.id)}</td><td class="l">${esc(r.a)} → ${esc(r.b)}</td><td>${num(r.L, 0)}</td><td>${num(r.qAvg, 2)}</td><td>${num(r.qad, 2)}</td><td>${num(r.kTot, 2)}</td><td>${num(r.qDes, 2)}</td><td>${r.d}</td><td>${num(r.i * 1000, 2)}</td><td>${num(r.fill, 2)}</td><td>${num(r.v, 2)}</td><td>${num(r.vmin, 1)}</td><td>${num(r.depthA, 2)}–${num(r.depthB, 2)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Строки — в порядке расчёта: от концевых участков к выпуску. Нажмите на строку, чтобы открыть участок.</p>`;
  }
  // путь вниз по течению от колодца до выпуска
  function pathFrom(id) {
    const out = []; let cur = id, guard = 0;
    while (guard++ < 500) { const p = S.net.pipes.find(x => x.a === cur); if (!p) break; out.push(p.id); cur = p.b; }
    return out;
  }
  function startNode() {
    const [t, id] = (S.sel || '').split(':');
    if (t === 'n' && node(id)) return id;
    if (t === 'p' && pipe(id)) return pipe(id).a;
    // по умолчанию — самый далёкий от выпуска концевой колодец
    const leaves = S.net.nodes.filter(n => !S.net.pipes.some(p => p.b === n.id) && S.net.pipes.some(p => p.a === n.id));
    return (leaves.map(n => ({ id: n.id, L: pathFrom(n.id).reduce((s, pid) => s + (pipe(pid).L || 0), 0) })).sort((a, b) => b.L - a.L)[0] || {}).id;
  }
  function profileHTML() {
    const ids = pathFrom(startNode()).filter(id => res(id));
    if (!ids.length) return '<p class="hint">Выберите колодец или участок — здесь появится продольный профиль до выпуска.</p>';
    const rs = ids.map(res); let s = 0;
    const seg = rs.map(r => { const o = { r, s0: s, s1: s + r.L }; s += r.L; return o; });
    const ys = rs.flatMap(r => [r.zA, r.zB, r.invStart, r.invEnd]), y0 = Math.floor(Math.min(...ys) - 0.5), y1 = Math.ceil(Math.max(...ys) + 0.5);
    const Wd = 760, Hh = 300, padL = 52, padR = 20, padT = 16, padB = 70;
    const X = v => padL + (Wd - padL - padR) * v / (s || 1), Y = v => padT + (Hh - padT - padB) * (y1 - v) / (y1 - y0);
    const ground = `M${X(0)} ${Y(rs[0].zA)}` + seg.map(o => `L${X(o.s1)} ${Y(o.r.zB)}`).join('');
    const pipeBand = seg.map(o => `<path class="sp-pipe" d="M${X(o.s0)} ${Y(o.r.invStart)}L${X(o.s1)} ${Y(o.r.invEnd)}L${X(o.s1)} ${Y(o.r.crownEnd)}L${X(o.s0)} ${Y(o.r.crownStart)}Z"/>`
      + (o.r.waterStart != null ? `<path class="sp-water" d="M${X(o.s0)} ${Y(o.r.waterStart)}L${X(o.s1)} ${Y(o.r.waterEnd)}"/>` : '')).join('');
    const wells = seg.map((o, k) => { const top = k === 0 ? o.r.zA : seg[k - 1].r.zB, bot = Math.min(o.r.invStart, k ? seg[k - 1].r.invEnd : o.r.invStart);
      return `<rect class="sp-well" x="${X(o.s0) - 3}" y="${Y(top)}" width="6" height="${Y(bot) - Y(top)}"/><text class="pt" x="${X(o.s0)}" y="${Hh - padB + 14}" text-anchor="middle">${esc(o.r.a)}</text>`; }).join('')
      + (() => { const o = seg[seg.length - 1]; return `<rect class="sp-well" x="${X(o.s1) - 3}" y="${Y(o.r.zB)}" width="6" height="${Y(o.r.invEnd) - Y(o.r.zB)}"/><text class="pt" x="${X(o.s1)}" y="${Hh - padB + 14}" text-anchor="middle">${esc(o.r.b)}</text>`; })();
    const labels = seg.map(o => `<text class="pt" x="${(X(o.s0) + X(o.s1)) / 2}" y="${Hh - padB + 32}" text-anchor="middle">${o.r.d} мм · ${num(o.r.i * 1000, 1)}‰</text><text class="pt" x="${(X(o.s0) + X(o.s1)) / 2}" y="${Hh - padB + 48}" text-anchor="middle">L ${num(o.r.L, 0)} м · h/d ${num(o.r.fill, 2)}</text>`).join('');
    const ticks = []; for (let v = y0; v <= y1; v += Math.max(1, Math.round((y1 - y0) / 6))) ticks.push(v);
    return `<p class="hint">Путь ${[rs[0].a, ...rs.map(r => r.b)].map(esc).join(' → ')}. Отметки в метрах; соединение труб в колодцах — по шелыгам (п. 6.2.3 <a href="#doc-sp32">СП 32</a>).</p>
      <svg class="net-prof sew-prof" viewBox="0 0 ${Wd} ${Hh}" role="img" aria-label="Продольный профиль сети">
        ${ticks.map(v => `<path class="pg" d="M${padL} ${Y(v)}H${Wd - padR}"/><text class="pt" x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        <path class="pz" d="${ground}L${X(s)} ${Hh - padB}L${X(0)} ${Hh - padB}Z"/>${pipeBand}${wells}${labels}</svg>
      <p class="net-leg"><span class="lz"></span>поверхность земли <span class="sp-lp"></span>труба (лоток — шелыга) <span class="sp-lw"></span>уровень воды при расчётном расходе <span class="sp-lwell"></span>колодец</p>
      <div class="net-tw"><table class="net-t"><thead><tr><th>Участок</th><th>Земля, м</th><th>Лоток, м</th><th>Шелыга, м</th><th>Вода, м</th><th>Глубина, м</th></tr></thead><tbody>
        ${rs.map(r => `<tr data-sel="p:${esc(r.id)}"><td>${esc(r.id)}</td><td>${num(r.zA, 2)} / ${num(r.zB, 2)}</td><td>${num(r.invStart, 3)} / ${num(r.invEnd, 3)}</td><td>${num(r.crownStart, 3)} / ${num(r.crownEnd, 3)}</td><td>${num(r.waterStart, 3)} / ${num(r.waterEnd, 3)}</td><td>${num(r.depthA, 2)} / ${num(r.depthB, 2)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const stepHTML = (s, k) => `<li class="sl sl-${s.kind}"><div class="sl-h"><span class="sl-n">${k + 1}</span><b>${esc(s.t)}</b><span class="sl-k">${KIND[s.kind] || s.kind}</span></div>
    ${s.f ? `<div class="sl-f">${tex(s.f, false)}</div>` : ''}<div class="sl-s">${esc(s.s)}${s.u ? ' ' + esc(s.u) : ''}</div>
    ${s.ref ? `<div class="sl-r">${refHTML(s.ref)}</div>` : ''}${s.note ? `<details class="sl-note"><summary>Почему так</summary><p>${esc(s.note)}</p></details>` : ''}</li>`;
  function logicHTML() {
    const [t, id] = (S.sel || '').split(':'), r = t === 'p' ? res(id) : (R.pipes || [])[0];
    if (!r) return '<p class="hint">Выберите участок — здесь появится логика его расчёта.</p>';
    return `<p class="hint">Участок <b>${esc(r.id)}</b> (${esc(r.a)} → ${esc(r.b)}). У каждого шага — формула, подстановка и источник. Типы шагов: <span class="sl-k sl-norm">норма</span> — прямое требование документа; <span class="sl-k sl-method">методика</span> — способ расчёта, на который норма отсылает; <span class="sl-k sl-assume">допущение</span> — решение Сешат там, где документ молчит (полный список — на вкладке «Допущения»).</p>
      <div class="sew-pick">${R.order.map(pid => `<button type="button" data-sel="p:${esc(pid)}" aria-pressed="${pid === r.id}">${esc(pid)}</button>`).join('')}</div>
      <h3 class="sl-title">Общие для сети</h3><ol class="sew-logic">${R.steps.map(stepHTML).join('')}</ol>
      <h3 class="sl-title">Участок ${esc(r.id)}</h3><ol class="sew-logic">${r.steps.map(stepHTML).join('')}</ol>
      <h3 class="sl-title">Проверки участка</h3><ul class="net-checks">${r.checks.map(c => `<li class="nc-${c.level === 'info' ? 'ok' : c.level}">${esc(c.text)}${c.ref ? ` <span class="net-ref">${refHTML(c.ref)}</span>` : ''}</li>`).join('') || '<li class="nc-ok">Все проверки пройдены.</li>'}</ul>`;
  }
  function assumptionsHTML() {
    return `<p class="hint">Здесь всё, что Сешат решила сама, потому что норма молчит или читается неоднозначно. Каждое допущение помечено в логике расчёта; список вопросов к нормам — в журнале разработки и в карте нормативки «Сети канализации».</p>
      <ol class="sew-assume">${Object.values(W.ASSUMPTIONS).map(a => `<li>${esc(a)}</li>`).join('')}</ol>
      <p class="hint">Источники: ${Object.values(W.DOCS).map(esc).join('; ')}.</p>`;
  }
  function costHTML() {
    const C = window.SeshatNCS; if (!C) return '<p class="hint">Данные НЦС не загружены.</p>';
    if (!R.pipes.length) return '<p class="hint">Сначала рассчитайте сеть.</p>';
    const k = S.cost = Object.assign({ mat: 'полиэтиленовые', wet: 0, fix: 0, grp: '1-3' }, S.cost || {}), region = typeof ncsRegion === 'function' ? ncsRegion() : 'Московская область';
    const mats = [...new Set(C.nets('kan').map(t => t.mat))];
    if (!mats.includes(k.mat)) k.mat = mats[0];
    const h = R.pipes.reduce((s, r) => s + (r.depthA + r.depthB) / 2 * r.L, 0) / R.pipes.reduce((s, r) => s + r.L, 0);
    const e = C.netEstimate(R.pipes.map(r => ({ id: r.id, L: r.L, d: r.d })), { sys: 'kan', ...k, h, region });
    const t = e.id && C.T14[e.id], selk = (f, opts, cur) => `<select data-f="k.${f}">${opts.map(([v, tt]) => `<option value="${esc(String(v))}"${String(v) === String(cur) ? ' selected' : ''}>${esc(tt)}</option>`).join('')}</select>`;
    const mln = v => (v / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    return `<p class="hint">Укрупнённая стоимость по сборнику НЦС 81-02-14-2026 «Наружные сети водоснабжения и канализации»: цены на ${C.DATE}, без НДС, с коэффициентом перехода к региону. Глубина — средневзвешенная по длине: ${num(h, 2)} м. Сборник не интерполирует между диаметрами: берётся наименьший диаметр таблицы не меньше расчётного; у полиэтиленовых труб в сборнике — наружный диаметр, поэтому сопоставление приближённое.</p>
      <div class="net-cost-f">
        <label class="net-f"><span>Трубы</span>${selk('mat', mats.map(m => [m, m[0].toUpperCase() + m.slice(1)]), k.mat)}</label>
        <label class="net-f"><span>Грунт</span>${selk('wet', [[0, 'сухой'], [1, 'мокрый']], k.wet)}</label>
        <label class="net-f"><span>Траншея</span>${selk('fix', [[0, 'без креплений'], [1, 'с креплением']], k.fix)}</label>
        <label class="net-f"><span>Группа грунтов</span>${selk('grp', [['1-3', '1–3'], ['4', '4']], k.grp)}</label>
        <label class="net-f"><span>Регион</span>${typeof ncsRegionSelect === 'function' ? ncsRegionSelect('sew-reg', region).replace('<select ', '<select data-f="k.region" ') : esc(region)}</label>
      </div>
      ${e.id ? `<div class="net-tw"><table class="net-t"><thead><tr><th>Участок</th><th>L, м</th><th>d, мм</th><th>Ø по НЦС</th><th>тыс. ₽ за 1 км</th><th>Стоимость, млн ₽</th></tr></thead><tbody>
        ${e.rows.map(r => `<tr><td>${esc(r.id)}</td><td>${num(r.L, 0)}</td><td>${r.d}</td><td>${r.dN || '—'}</td><td>${r.r && r.r.perKm != null ? num(r.r.perKm, 2) : '—'}</td><td>${r.r && r.r.total != null ? mln(r.r.total) : '—'}</td></tr>`).join('')}
        <tr class="tot"><td><b>Итого</b></td><td>${num(e.km * 1000, 0)}</td><td></td><td></td><td></td><td><b>${mln(e.total)}</b></td></tr></tbody></table></div>
        <p class="hint">Таблица ${e.id}, с. ${t[5][0]} сборника; Кпер ${num(C.kperOf(region, 2), 2)} (${esc(region)}). Колодцы, КНС, вывоз грунта дальше 1 км, НДС и индекс к году строительства не учтены. <a href="#doc-ncs14">Калькулятор и правила сборника</a>.</p>`
        : '<p class="hint">Для такого сочетания условий в сборнике нет таблицы.</p>'}`;
  }
  function tablesHTML() {
    const tabs = [['pipes', 'Участки'], ['profile', 'Профиль'], ['logic', 'Логика расчёта'], ['assume', 'Допущения'], ['cost', 'Стоимость (НЦС)']];
    const body = S.tab === 'profile' ? profileHTML() : S.tab === 'logic' ? logicHTML() : S.tab === 'assume' ? assumptionsHTML() : S.tab === 'cost' ? costHTML() : pipesTable();
    return `<section class="panel net-tabs"><div class="seg seg-sm" role="tablist">${tabs.map(([k, t]) => `<button type="button" data-tab="${k}" aria-pressed="${S.tab === k}">${t}</button>`).join('')}</div>${body}</section>`;
  }

  /* ---------- отрисовка ---------- */
  const root = () => document.getElementById('constructor-root');
  let rendering = false; // замена разметки снимает фокус с поля, blur может прислать ещё один change — повторный вход пропускаем
  function render() {
    if (rendering) return; rendering = true;
    try { renderNow(); } finally { rendering = false; }
  }
  function renderNow() {
    R = compute();
    const m = SeshatModules.MODULES.find(x => x.id === 'cloacina');
    root().innerHTML = `<article class="net-tool kind-${m.kind}">
      <header class="net-head"><div><span class="gp-stage">Конструктор · ${esc(m.n)}</span><h1>Самотёчная хозяйственно-бытовая сеть</h1></div>
        <div class="net-tools seg" role="group" aria-label="Инструмент">${[['select', 'Выбор'], ['node', 'Колодец'], ['pipe', 'Участок'], ['delete', 'Удалить']].map(([k, t]) => `<button type="button" data-tool="${k}" aria-pressed="${S.tool === k}">${t}</button>`).join('')}</div>
        <div class="seg seg-sm" role="group" aria-label="Подписи участков">${[['d', 'Диаметр и уклон'], ['q', 'Расход'], ['fill', 'Наполнение и скорость']].map(([k, t]) => `<button type="button" data-show="${k}" aria-pressed="${S.show === k}">${t}</button>`).join('')}</div></header>
      <div class="net-body">
        <aside class="net-left">${leftHTML()}</aside>
        <div class="net-plan"><div class="net-canvas">${planSVG()}</div>
          <p class="net-leg">Наполнение от наибольшего допустимого: ${['до 25 %', '25–50 %', '50–75 %', '75–100 %', 'предел'].map((t, i) => `<span class="lv v${i}"></span>${t}`).join(' ')} · пунктир — внутриквартальная сеть · квадрат — выпуск · у колодцев — отметка земли${pick ? ' · <b>выберите нижний колодец участка</b>' : ''}</p></div>
        <aside class="net-right">${rightHTML()}</aside>
      </div>
      ${tablesHTML()}
      <p class="hint net-note">Учебный расчёт по СП 32.13330.2018 (ред. изм. № 1–5), СП 399.1325800.2018 (прил. Б) и таблицам Н. Н. Павловского; расчётный внутренний диаметр принят равным номинальному. Для проекта нужны изыскания, данные эксплуатирующей организации и сертифицированные программы.</p>
    </article>`;
    save();
  }
  const rerender = () => { const sx = window.scrollX, sy = window.scrollY; render(); window.scrollTo(sx, sy); };

  /* ---------- события ---------- */
  const svgPoint = (svg, ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const snap = (v, s) => Math.round(v / s) * s;
  let drag = null;
  root().addEventListener('pointerdown', ev => {
    const svg = ev.target.closest('#sew-svg'); if (!svg) return;
    const g = ev.target.closest('[data-n]');
    if (g && S.tool === 'select') { drag = { id: g.dataset.n, moved: false }; svg.setPointerCapture(ev.pointerId); }
  });
  root().addEventListener('pointermove', ev => {
    if (!drag || drag.done) return;
    const svg = document.getElementById('sew-svg'), p = svgPoint(svg, ev), n = node(drag.id);
    const x = snap(p.x, 10), y = snap(p.y, 10); if (x === n.x && y === n.y) return;
    n.x = x; n.y = y; drag.moved = true;
    S.net.pipes.forEach(q => { if (!q.Lset && (q.a === n.id || q.b === n.id)) q.L = Math.max(1, dist(node(q.a), node(q.b))); });
    const keep = view; render(); view = keep;
  });
  root().addEventListener('pointerup', () => {
    if (!drag || drag.done) return;
    if (drag.moved) view = null; else S.sel = 'n:' + drag.id;
    rerender(); drag = { done: true }; setTimeout(() => { drag = null; }, 0);
  });
  root().addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-tool]')) { S.tool = t.closest('[data-tool]').dataset.tool; pick = null; return rerender(); }
    if (t.closest('[data-show]')) { S.show = t.closest('[data-show]').dataset.show; return rerender(); }
    if (t.closest('[data-tab]')) { S.tab = t.closest('[data-tab]').dataset.tab; return rerender(); }
    const row = t.closest('[data-sel]'); if (row) { S.sel = row.dataset.sel; return rerender(); }
    const act = t.closest('[data-act]'); if (act) return action(act.dataset.act);
    const svg = t.closest('#sew-svg'); if (!svg || (drag && drag.done)) return;
    const g = t.closest('[data-n]'), pp = t.closest('[data-p]');
    if (S.tool === 'delete') { if (g) removeNode(g.dataset.n); else if (pp) removePipe(pp.dataset.p); return; }
    if (S.tool === 'pipe' && g) {
      const id = g.dataset.n;
      if (!pick) { if (S.net.pipes.some(p => p.a === id)) { toast('Из этого колодца уже выходит участок: в самотёчной сети он один.'); return; } pick = id; return rerender(); }
      if (pick !== id && !S.net.pipes.some(p => (p.a === pick && p.b === id) || (p.a === id && p.b === pick))) {
        const pid = pick + '-' + id; S.net.pipes.push({ id: pipe(pid) ? nextId(S.net.pipes, pid + '/') : pid, a: pick, b: id, L: Math.max(1, dist(node(pick), node(id))), area: 0, mat: S.mat, kind: S.kind });
        S.sel = 'p:' + S.net.pipes[S.net.pipes.length - 1].id;
      }
      pick = null; return rerender();
    }
    if (S.tool === 'node' && !g && !pp) {
      const p = svgPoint(svg, ev), zs = S.net.nodes.map(n => n.z || 0);
      const nid = nextId(S.net.nodes, 'К'); S.net.nodes.push({ id: nid, x: snap(p.x, 50), y: snap(p.y, 50), z: zs.length ? Math.round(zs.reduce((a, b) => a + b, 0) / zs.length * 10) / 10 : 20 });
      S.sel = 'n:' + nid; return rerender();
    }
    if (g) S.sel = 'n:' + g.dataset.n; else if (pp) S.sel = 'p:' + pp.dataset.p; else S.sel = null;
    rerender();
  });
  function removeNode(id) { S.net.nodes = S.net.nodes.filter(n => n.id !== id); S.net.pipes = S.net.pipes.filter(p => p.a !== id && p.b !== id); S.sel = null; view = null; rerender(); }
  function removePipe(id) { S.net.pipes = S.net.pipes.filter(p => p.id !== id); S.sel = null; rerender(); }
  function action(a) {
    const [t, id] = (S.sel || '').split(':');
    if (a === 'example') { S.net = W.example(); S.sel = null; view = null; }
    else if (a === 'clear') { S.net = { params: P(), nodes: [], pipes: [] }; S.sel = null; view = null; }
    else if (a === 'del') { if (t === 'n') return removeNode(id); if (t === 'p') return removePipe(id); }
    else if (a === 'profile') S.tab = 'profile';
    else if (a === 'logic') S.tab = 'logic';
    rerender();
  }
  root().addEventListener('change', ev => {
    const f = ev.target.dataset.f; if (!f) return;
    const v = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    const n = parseNum(v), [t, id] = (S.sel || '').split(':'), p = P();
    if (typeof v === 'string' && ev.target.inputMode === 'decimal' && Number.isNaN(n)) { markInvalid(ev.target, n); return; }
    if (f === 'mat') S.mat = v;
    else if (f === 'kind') S.kind = v;
    else if (f === 'P.services' || f === 'P.unaccounted') p.extra[f.slice(2)] = (n || 0) / 100;
    else if (f === 'P.place' || f === 'P.soil') p[f.slice(2)] = v;
    else if (f === 'P.localSlope') p.localSlope = v;
    else if (f.startsWith('P.')) { const k = f.slice(2); p[k] = k === 'hStart' ? (n || 0) : n > 0 ? n : p[k]; }
    else if (f === 'k.region') { if (typeof ncsSetRegion === 'function') ncsSetRegion(v); }
    else if (f.startsWith('k.')) { const kk = f.slice(2); S.cost[kk] = kk === 'wet' || kk === 'fix' ? +v : v; }
    else if (f.startsWith('n.') && t === 'n') {
      const x = node(id), k = f.slice(2);
      if (k === 'id') { const nid = String(v).trim(); if (!nid || node(nid)) { toast('Такой колодец уже есть.'); return rerender(); } S.net.pipes.forEach(q => { if (q.a === id) q.a = nid; if (q.b === id) q.b = nid; }); x.id = nid; S.sel = 'n:' + nid; }
      else x[k] = n ?? 0;
    } else if (f.startsWith('p.') && t === 'p') {
      const x = pipe(id), k = f.slice(2);
      if (k === 'L') { x.L = Math.max(1, n || 1); x.Lset = true; }
      else if (k === 'area' || k === 'conc') x[k] = n || 0;
      else if (k === 'people') { if (n == null) delete x.people; else x.people = n; }
      else if (k === 'd') { if (v) x.d = Number(v); else delete x.d; }
      else if (k === 'i') { if (n == null || !n) delete x.i; else x.i = n / 1000; }
      else x[k] = v;
    }
    rerender();
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && pick && document.getElementById('sew-svg')) { pick = null; rerender(); } });

  VIEW_RENDER.constructor = render;
})();
