// Конструктор модуля «Сети водоснабжения»: план кольцевой сети, увязка колец и проверки по нормам.
// Узлы и участки рисуются на плане (координаты — метры), расчёт — js/netcalc.js. Сеть хранится в этом браузере.
(function () {
  if (PAGE !== 'juturna' || !window.SeshatNet) return;
  const N = SeshatNet, KEY = 'seshat-net';
  const DIAMS = [50, 80, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];
  const num = (v, d = 1) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];
  const docLink = r => r ? ` <a class="net-ref" href="#doc-${r.doc}">${esc(r.t)}</a>` : '';

  /* ---------- состояние ---------- */
  const fresh = () => ({ net: N.example(), scen: 'max', people: 20, floors: 5, mat: 'used', Hfire: null, sel: null, tool: 'select', show: 'free', off: null, tab: 'pipes',
    calc: { people: 20000, qzh: 160, ksut: 1.2, amax: 1.3 } });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...S, sel: null, pick: null })); } catch (e) { /* хранилище недоступно — работаем без сохранения */ } };
  let R = null, pick = null; // результат расчёта; первый узел нового участка
  const node = id => S.net.nodes.find(n => n.id === id), pipe = id => S.net.pipes.find(p => p.id === id);
  const dist = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  const nextId = (list, pre) => { let i = 1; while (list.some(x => x.id === pre + i)) i++; return pre + i; };

  /* ---------- расчёт по режиму ---------- */
  function compute() {
    const net = S.net;
    const base = N.solve(net, { tol: 0.001 });
    const out = { base, res: base, checks: [], fire: null, emerg: null };
    if (S.scen === 'fire') {
      const fd = N.fireDemand(S.people, S.floors), fn = net.nodes.filter(n => n.fire && !n.source);
      const d = Object.fromEntries(net.nodes.map(n => [n.id, n.q || 0])); fn.forEach(n => { d[n.id] += fd.q; });
      const nf = S.Hfire ? { ...net, nodes: net.nodes.map(n => (n.source ? { ...n, H: S.Hfire } : n)) } : net;
      out.res = N.solve(nf, { demands: d, tol: 0.001 });
      out.fire = { ...fd, nodes: fn.map(n => n.id) };
      out.checks = N.check(net, out.res, 'fire');
      if (fn.length !== fd.fires) out.checks.unshift({ level: 'warn', text: `По таблице 1 СП 8 одновременных пожаров — ${fd.fires}, на плане отмечено ${fn.length}. Отметьте узлы пожаров или нажмите «Пожары в диктующих узлах».`, ref: N.REF.fire });
    } else if (S.scen === 'emerg') {
      const list = N.emergencyAll(net);
      out.emerg = list;
      const cur = list.find(e => e.pipe === S.off) || list.reduce((a, b) => (b.minFree < a.minFree ? b : a), list[0]);
      if (cur) { S.off = cur.pipe; out.res = cur.res; }
      const bad = list.filter(e => !e.ok);
      out.checks = [bad.length ? { level: 'bad', text: `При выключении участков ${bad.map(e => e.pipe).join(', ')} подача 70 % расхода с напором 10 м не обеспечивается${bad.some(e => e.lost) ? ': часть узлов остаётся без воды' : ''}.`, ref: N.REF.emerg }
        : { level: 'ok', text: `При выключении любого участка сеть подаёт 70 % расхода со свободным напором не меньше ${N.EMERGENCY.free} м.`, ref: N.REF.emerg }];
    } else out.checks = N.check(net, base);
    return out;
  }

  /* ---------- план ---------- */
  const V_STEPS = [0.3, 0.6, 0.9, 1.2]; // полосы цвета по скорости, м/с — только для наглядности
  const vClass = V => 'v' + V_STEPS.filter(s => V >= s).length;
  let view = null; // область плана в метрах
  function bounds() {
    const xs = S.net.nodes.map(n => n.x), ys = S.net.nodes.map(n => n.y);
    if (!xs.length) return { x: -100, y: -100, w: 1000, h: 600 };
    const x0 = Math.min(...xs) - 150, y0 = Math.min(...ys) - 150, x1 = Math.max(...xs) + 150, y1 = Math.max(...ys) + 150;
    const w = Math.max(x1 - x0, 600), h = Math.max(y1 - y0, 400, w * 0.5);
    return { x: x0, y: y0 - (h - (y1 - y0)) / 2, w, h };
  }
  function planSVG() {
    const b = view || (view = bounds()), res = R.res, by = Object.fromEntries((res.pipes || []).map(p => [p.id, p])), bn = Object.fromEntries((res.nodes || []).map(n => [n.id, n]));
    const bad = new Set(R.checks.flatMap(c => (c.level === 'bad' && c.nodes) || [])), badP = new Set(R.checks.flatMap(c => c.pipes || []));
    const grid = []; for (let x = Math.ceil(b.x / 100) * 100; x < b.x + b.w; x += 100) grid.push(`<path d="M${x} ${b.y}V${b.y + b.h}"/>`);
    for (let y = Math.ceil(b.y / 100) * 100; y < b.y + b.h; y += 100) grid.push(`<path d="M${b.x} ${y}H${b.x + b.w}"/>`);
    const k = b.w / 700; // размер подписей растёт вместе с планом: на экране около 12 px
    const pipes = S.net.pipes.map(p => {
      const A = node(p.a), B = node(p.b); if (!A || !B) return '';
      const r = by[p.id], off = S.scen === 'emerg' && S.off === p.id, sel = S.sel === 'p:' + p.id;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
      const dir = r && r.q < 0 ? 180 : 0, w = (2 + p.d / 120) * k;
      const lab = r ? `${num(Math.abs(r.q), 1)} л/с · ${p.d}` : `${p.d}`;
      const flip = ang > 90 || ang < -90 ? 180 : 0;
      return `<g class="np ${off ? 'off' : r ? vClass(r.V) : ''}${sel ? ' sel' : ''}${badP.has(p.id) ? ' warn' : ''}" data-p="${esc(p.id)}">
        <line class="np-hit" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke-width="${16 * k}"/>
        <line class="np-l" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke-width="${w}"/>
        ${r && Math.abs(r.q) > 1e-6 ? `<path class="np-a" transform="translate(${mx} ${my}) rotate(${ang + dir})" d="M${-7 * k} ${-6 * k}L${7 * k} 0L${-7 * k} ${6 * k}z"/>` : ''}
        <text class="np-t" transform="translate(${mx} ${my}) rotate(${ang + flip})" y="${-10 * k}" font-size="${13 * k}">${esc(p.id)}: ${lab}${off ? ' · выключен' : ''}</text></g>`;
    }).join('');
    const loops = (res.loops || []).map((l, i) => {
      const pts = l.map(([id, s]) => { const p = pipe(id); return node(s > 0 ? p.a : p.b); }).filter(Boolean);
      const cx = pts.reduce((s, n) => s + n.x, 0) / pts.length, cy = pts.reduce((s, n) => s + n.y, 0) / pts.length;
      return `<text class="nl" x="${cx}" y="${cy}" font-size="${22 * k}">${ROMAN[i] || i + 1}</text>`;
    }).join('');
    const nodes = S.net.nodes.map(n => {
      const r = bn[n.id], sel = S.sel === 'n:' + n.id, pk = pick === n.id;
      const val = !r || !isFinite(r.H) ? '' : S.show === 'free' ? `Hсв ${num(r.free)} м` : S.show === 'H' ? `H ${num(r.H)} м` : `q ${num(r.q, 1)} л/с`;
      const fire = S.scen === 'fire' && n.fire && !n.source;
      return `<g class="nn${n.source ? ' src' : ''}${bad.has(n.id) ? ' bad' : ''}${sel || pk ? ' sel' : ''}${fire ? ' fire' : ''}" data-n="${esc(n.id)}" transform="translate(${n.x} ${n.y})">
        ${n.source ? `<rect x="${-13 * k}" y="${-13 * k}" width="${26 * k}" height="${26 * k}" rx="${4 * k}"/>` : `<circle r="${11 * k}"/>`}
        <text class="nn-id" y="${4.5 * k}" font-size="${12 * k}">${esc(n.id)}</text>
        <text class="nn-v" y="${30 * k}" font-size="${12.5 * k}">${val}</text>
        ${fire ? `<path class="nn-f" transform="translate(${12 * k} ${-14 * k})" d="M0 ${-9 * k}c${4 * k} ${5 * k} ${6 * k} ${7 * k} ${3 * k} ${11 * k}c${-1 * k} ${-3 * k} ${-3 * k} ${-4 * k} ${-3 * k} ${-4 * k}c0 0 ${-2 * k} ${2 * k} ${-3 * k} ${4 * k}c${-3 * k} ${-4 * k} 0 ${-8 * k} ${3 * k} ${-11 * k}z"/>` : ''}</g>`;
    }).join('');
    return `<svg id="net-svg" class="net-svg tool-${S.tool}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="План водопроводной сети">
      <g class="ng">${grid.join('')}</g>${pipes}${loops}${nodes}</svg>`;
  }

  /* ---------- панели ---------- */
  const fld = (label, name, value, extra = '') => `<label class="net-f"><span>${label}</span><input ${NUM_ATTRS} data-f="${name}" value="${esc(showNum(value ?? ''))}" ${extra}></label>`;
  function leftHTML() {
    const src = S.net.nodes.find(n => n.source), fd = N.fireDemand(S.people, S.floors), c = N.demand(S.calc);
    return `
      <section class="panel"><h2>Режим</h2>
        <div class="seg seg-sm net-scen" role="group" aria-label="Режим расчёта">${[['max', 'Максимальный водоразбор'], ['fire', 'Пожар'], ['emerg', 'Авария']].map(([k, t]) => `<button type="button" data-scen="${k}" aria-pressed="${S.scen === k}">${t}</button>`).join('')}</div>
        <p class="hint">${S.scen === 'max' ? 'Час максимального водопотребления: свободный напор не меньше требуемого по этажности и не больше 60 м.' : S.scen === 'fire' ? 'Отборы часа максимального водопотребления плюс расход на пожаротушение в отмеченных узлах; свободный напор при пожаре не меньше 10 м.' : 'По очереди выключается каждый участок, отборы — 70 % расчётных; свободный напор должен оставаться не меньше 10 м.'}</p></section>
      <section class="panel"><h2>Источник</h2>
        ${src ? `${fld('Напор на выходе насосной (пьезометрическая отметка), м', 'srcH', src.H)}<p class="hint">Узел «${esc(src.id)}», отметка земли ${num(src.z, 1)} м.</p>` : '<p class="hint">Отметьте узел-источник: выберите узел и включите «Источник».</p>'}
        ${S.scen === 'fire' ? fld('Напор при пожаре, м (пустое — как обычно)', 'Hfire', S.Hfire) : ''}</section>
      ${S.scen === 'fire' ? `<section class="panel"><h2>Пожаротушение</h2>
        ${fld('Жителей, тыс. чел.', 'people', S.people)}${fld('Этажность застройки', 'floors', S.floors)}
        <p class="net-fire">Пожаров: <b>${fd.fires}</b> · по <b>${fd.q}</b> л/с · всего <b>${fd.total}</b> л/с</p>
        ${fd.note ? `<p class="hint">${esc(fd.note)}</p>` : ''}
        <button type="button" data-act="firepick">Пожары в диктующих узлах</button>
        <p class="hint">Таблица 1 <a href="#doc-sp8">СП 8.13130.2020</a>. Узел пожара можно отметить и вручную — в карточке узла.</p></section>` : ''}
      <section class="panel"><h2>Расчётный расход</h2>
        ${fld('Жителей', 'c.people', S.calc.people)}${fld('Водопотребление, л/сут на жителя', 'c.qzh', S.calc.qzh)}${fld('Kсут.max', 'c.ksut', S.calc.ksut)}${fld('αmax', 'c.amax', S.calc.amax)}
        <dl class="gp-dl net-dl"><dt>Qсут.m</dt><dd>${num(c.Qm, 0)} м³/сут</dd><dt>Qсут.max</dt><dd>${num(c.Qmax, 0)} м³/сут</dd><dt>βmax</dt><dd>${num(c.beta, 2)}</dd><dt>Kч.max</dt><dd>${num(c.kch, 2)}</dd><dt>qч.max</dt><dd>${num(c.qh, 1)} м³/ч = <b>${num(c.qs, 1)} л/с</b></dd></dl>
        <button type="button" data-act="distribute">Распределить по узлам</button>
        <p class="hint">Формулы (1)–(4) и таблицы 1–2 <a href="#doc-sp31">СП 31.13330.2021</a>, с. 8–9. Распределение — через удельный расход по длине участков; транзитные участки воду не раздают.</p></section>
      <section class="panel"><h2>Сеть</h2>
        <label class="net-f"><span>Материал новых участков</span><select data-f="mat">${Object.entries(N.MATERIALS).map(([k, m]) => `<option value="${k}"${S.mat === k ? ' selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>
        <div class="net-btns"><button type="button" data-act="example">Пример</button><button type="button" data-act="clear">Очистить</button></div></section>`;
  }
  function rightHTML() {
    const lv = { ok: 'ok', bad: 'bad', warn: 'warn' };
    const checks = `<section class="panel"><h2>Проверки</h2><ul class="net-checks">${R.checks.map(c => `<li class="nc-${lv[c.level]}">${esc(c.text)}${docLink(c.ref)}</li>`).join('')}</ul>
      ${R.res && R.res.loops ? `<p class="hint">Колец: ${R.res.loops.length}. Увязка: ${R.res.iters.length} итераций, невязка ${num(R.res.resid, 3)} м. Подача в сеть ${num(R.res.total, 1)} л/с.</p>` : ''}</section>`;
    return checks + editorHTML();
  }
  function editorHTML() {
    const [t, id] = (S.sel || '').split(':');
    if (t === 'n' && node(id)) {
      const n = node(id), r = (R.res.nodes || []).find(x => x.id === id);
      return `<section class="panel net-ed"><h2>Узел ${esc(n.id)}</h2>
        <label class="net-f"><span>Название</span><input type="text" data-f="n.id" value="${esc(n.id)}" maxlength="12"></label>
        ${fld('Отметка земли, м', 'n.z', n.z)}
        ${n.source ? fld('Напор на выходе (пьезометрическая отметка), м', 'n.H', n.H) : fld('Узловой отбор, л/с', 'n.q', n.q) + fld('Этажность застройки', 'n.floors', n.floors || 1)}
        <label class="net-c"><input type="checkbox" data-f="n.source"${n.source ? ' checked' : ''}> Источник (насосная станция или башня)</label>
        ${n.source ? '' : `<label class="net-c"><input type="checkbox" data-f="n.fire"${n.fire ? ' checked' : ''}> Пожар в этом узле (режим «Пожар»)</label>`}
        ${r && isFinite(r.H) ? `<dl class="gp-dl net-dl"><dt>Пьезометрический напор</dt><dd>${num(r.H, 2)} м</dd><dt>Свободный напор</dt><dd>${num(r.free, 2)} м</dd>${n.source ? '' : `<dt>Требуется</dt><dd>${S.scen === 'max' ? N.requiredFree(n.floors || 1) : 10} м</dd>`}</dl>` : ''}
        <button type="button" data-act="profile">Пьезометрия до узла</button> <button type="button" class="danger" data-act="del">Удалить узел</button></section>`;
    }
    if (t === 'p' && pipe(id)) {
      const p = pipe(id), r = (R.res.pipes || []).find(x => x.id === id), M = N.MATERIALS[p.mat] || N.MATERIALS.used;
      return `<section class="panel net-ed"><h2>Участок ${esc(p.id)}: ${esc(p.a)} — ${esc(p.b)}</h2>
        ${fld('Длина, м', 'p.L', p.L)}
        <label class="net-f"><span>Диаметр (расчётный внутренний), мм</span><select data-f="p.d">${[...new Set([...DIAMS, p.d])].sort((a, b) => a - b).map(d => `<option${d === p.d ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
        <label class="net-f"><span>Материал</span><select data-f="p.mat">${Object.entries(N.MATERIALS).map(([k, m]) => `<option value="${k}"${p.mat === k ? ' selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>
        <label class="net-c"><input type="checkbox" data-f="p.transit"${p.transit ? ' checked' : ''}> Транзитный (водовод без отбора по пути)</label>
        ${r ? `<dl class="gp-dl net-dl"><dt>Расход</dt><dd>${num(Math.abs(r.q), 2)} л/с, ${r.q >= 0 ? esc(p.a) + ' → ' + esc(p.b) : esc(p.b) + ' → ' + esc(p.a)}</dd><dt>Скорость</dt><dd>${num(r.V, 2)} м/с</dd><dt>1000i</dt><dd>${num(r.i1000, 2)}</dd><dt>Потери напора</dt><dd>${num(Math.abs(r.h), 2)} м</dd></dl>` : ''}
        <p class="hint">${esc(M.f)}.${M.unverified ? ' Коэффициенты формулы ещё сверяются с изданием.' : ''}</p>
        <button type="button" class="danger" data-act="del">Удалить участок</button></section>`;
    }
    return `<section class="panel net-ed"><h2>Как работать</h2><ul class="net-help">
      <li><b>Выбор</b> — нажмите на узел или участок, чтобы изменить его; узлы можно перетаскивать.</li>
      <li><b>Узел</b> — нажмите на пустое место плана. Сетка — 100 м.</li>
      <li><b>Участок</b> — нажмите на два узла подряд. Длина считается по плану, её можно исправить.</li>
      <li>Расчёт идёт сразу: стрелки — направление воды, цвет — скорость, римские цифры — кольца.</li></ul></section>`;
  }
  function tablesHTML() {
    const res = R.res, tabs = [['pipes', 'Участки'], ['nodes', 'Узлы'], ['loops', 'Увязка колец'], ['profile', 'Пьезометрия']].concat(S.scen === 'emerg' ? [['emerg', 'Аварии']] : []);
    let body = '';
    if (!res.pipes) body = '<p class="hint">Нет результатов: проверьте, что у сети есть источник и все узлы с ним соединены.</p>';
    else if (S.tab === 'pipes') body = `<div class="net-tw"><table class="net-t"><thead><tr><th>Участок</th><th class="l">Узлы</th><th>L, м</th><th>d, мм</th><th class="l">Материал</th><th>q, л/с</th><th>V, м/с</th><th>1000i</th><th>h, м</th></tr></thead><tbody>
      ${res.pipes.map(r => { const p = pipe(r.id); return `<tr data-sel="p:${esc(p.id)}"><td>${esc(p.id)}</td><td class="l">${esc(r.q >= 0 ? p.a + ' → ' + p.b : p.b + ' → ' + p.a)}</td><td>${num(p.L, 0)}</td><td>${p.d}</td><td class="l">${esc((N.MATERIALS[p.mat] || N.MATERIALS.used).short)}</td><td>${num(Math.abs(r.q), 2)}</td><td>${num(r.V, 2)}</td><td>${num(r.i1000, 2)}</td><td>${num(Math.abs(r.h), 2)}</td></tr>`; }).join('')}</tbody></table></div>`;
    else if (S.tab === 'nodes') body = `<div class="net-tw"><table class="net-t"><thead><tr><th>Узел</th><th>z, м</th><th>Отбор, л/с</th><th>Этажей</th><th>H, м</th><th>Hсв, м</th><th>Требуется, м</th></tr></thead><tbody>
      ${res.nodes.map(r => { const n = node(r.id), req = n.source ? '' : S.scen === 'max' ? N.requiredFree(n.floors || 1) : 10, bad = !n.source && isFinite(r.free) && (r.free < req || (S.scen === 'max' && r.free > N.MAX_FREE));
        return `<tr data-sel="n:${esc(n.id)}" class="${bad ? 'bad' : ''}"><td>${esc(n.id)}${n.source ? ' (источник)' : ''}</td><td>${num(n.z, 1)}</td><td>${n.source ? '—' : num(r.q, 2)}</td><td>${n.source ? '—' : n.floors || 1}</td><td>${num(r.H, 2)}</td><td>${num(r.free, 2)}</td><td>${req}</td></tr>`; }).join('')}</tbody></table></div>`;
    else if (S.tab === 'loops') body = !res.loops.length ? '<p class="hint">В сети нет колец: она тупиковая, и расходы определяются без увязки. По п. 11.5 СП 31 водопроводные сети должны быть кольцевыми.</p>'
      : `<p class="hint">Метод Лобачёва — Кросса: на каждой итерации считается невязка кольца Δh = Σ±h (по часовой стрелке «плюс») и поправка Δq = −Δh / Σ(dh/dq), которая одновременно вносится во все участки кольца. Общие участки соседних колец получают обе поправки.</p>
        <p class="net-rings">${res.loops.map((l, i) => `<span><b>${ROMAN[i] || i + 1}</b>: ${l.map(([id, s]) => (s > 0 ? '+' : '−') + esc(id)).join(' ')}</span>`).join('')}</p>
        <div class="net-tw"><table class="net-t"><thead><tr><th>Итерация</th>${res.loops.map((l, i) => `<th>Δh ${ROMAN[i] || i + 1}, м</th><th>Δq ${ROMAN[i] || i + 1}, л/с</th>`).join('')}</tr></thead><tbody>
        ${res.iters.map(it => `<tr><td>${it.k + 1}</td>${it.dh.map((x, i) => `<td>${num(x, 3)}</td><td>${num(it.dq[i], 3)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    else if (S.tab === 'profile') body = profileHTML();
    else if (S.tab === 'emerg' && R.emerg) body = `<p class="hint">Выключенный участок — пунктиром на плане. Нажмите на строку, чтобы посмотреть режим. Участки, примыкающие к источнику, — это водоводы: их не выключают здесь, число линий водоводов и переключения между ними проверяют отдельно (п. 11.1–11.2 СП 31.13330.2021). Требование к худшей точке (не меньше 25 % расхода) в этой упрощённой проверке не считается отдельно.</p><div class="net-tw"><table class="net-t"><thead><tr><th>Выключен участок</th><th>Наименьший Hсв, м</th><th class="l">Узлы ниже 10 м</th><th class="l">Итог</th></tr></thead><tbody>
      ${R.emerg.map(e => `<tr data-off="${esc(e.pipe)}" class="${e.ok ? '' : 'bad'}${S.off === e.pipe ? ' cur' : ''}"><td>${esc(e.pipe)}</td><td>${e.lost ? '—' : num(e.minFree, 1)}</td><td class="l">${e.lost ? 'узлы без воды' : esc(e.low.join(', ') || '—')}</td><td class="l">${e.ok ? 'обеспечено' : 'не обеспечено'}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section class="panel net-tabs"><div class="seg seg-sm" role="tablist">${tabs.map(([k, t]) => `<button type="button" data-tab="${k}" aria-pressed="${S.tab === k}">${t}</button>`).join('')}</div>${body}</section>`;
  }
  // пьезометрическая линия от источника до узла: кратчайший путь по длине участков
  function pathTo(target) {
    const src = S.net.nodes.find(n => n.source); if (!src || !target) return null;
    const D = { [src.id]: 0 }, prev = {}, todo = new Set(S.net.nodes.map(n => n.id));
    while (todo.size) {
      let u = null; todo.forEach(id => { if (D[id] != null && (u == null || D[id] < D[u])) u = id; });
      if (u == null) break; todo.delete(u);
      S.net.pipes.forEach(p => { if (S.scen === 'emerg' && p.id === S.off) return; const v = p.a === u ? p.b : p.b === u ? p.a : null; if (v && todo.has(v) && (D[v] == null || D[u] + p.L < D[v])) { D[v] = D[u] + p.L; prev[v] = u; } });
    }
    if (D[target] == null) return null;
    const ids = [target]; while (ids[0] !== src.id) ids.unshift(prev[ids[0]]);
    return ids.map(id => ({ id, s: D[id] }));
  }
  function profileHTML() {
    const res = R.res, bn = Object.fromEntries(res.nodes.map(n => [n.id, n]));
    const [t, id] = (S.sel || '').split(':');
    // по умолчанию — диктующий узел: наименьший запас свободного напора
    const target = t === 'n' && node(id) && !node(id).source ? id : (res.nodes.filter(n => !node(n.id).source && isFinite(n.free)).sort((a, b) => (a.free - req(a.id)) - (b.free - req(b.id)))[0] || {}).id;
    const path = pathTo(target);
    if (!path || path.length < 2) return '<p class="hint">Выберите узел на плане — здесь появится пьезометрическая линия от источника до него.</p>';
    const pts = path.map(p => ({ ...p, z: node(p.id).z || 0, H: bn[p.id].H, req: (node(p.id).z || 0) + (node(p.id).source ? 0 : req(p.id)) }));
    const W = 760, Hh = 260, padL = 50, padR = 20, padT = 20, padB = 40, xs = pts[pts.length - 1].s || 1;
    const ys = pts.flatMap(p => [p.z, p.H, p.req]), y0 = Math.floor(Math.min(...ys) / 5) * 5 - 5, y1 = Math.ceil(Math.max(...ys) / 5) * 5 + 5;
    const X = s => padL + (W - padL - padR) * s / xs, Y = v => padT + (Hh - padT - padB) * (y1 - v) / (y1 - y0);
    const line = k => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.s).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
    const ticks = []; for (let v = y0; v <= y1; v += Math.max(5, Math.round((y1 - y0) / 6 / 5) * 5)) ticks.push(v);
    return `<p class="hint">Путь ${pts.map(p => esc(p.id)).join(' → ')}${t === 'n' ? '' : ' — до диктующего узла (наименьший запас напора)'}. Между пьезометрической линией и землёй — свободный напор.</p>
      <svg class="net-prof" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Пьезометрическая линия">
        ${ticks.map(v => `<path class="pg" d="M${padL} ${Y(v)}H${W - padR}"/><text class="pt" x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        <path class="pz" d="${line('z')}L${X(xs)} ${Hh - padB}L${padL} ${Hh - padB}Z"/>
        <path class="pr" d="${line('req')}"/><path class="ph" d="${line('H')}"/>
        ${pts.map(p => `<g><path class="pv" d="M${X(p.s)} ${Y(p.z)}V${Y(p.H)}"/><circle class="pc" cx="${X(p.s)}" cy="${Y(p.H)}" r="3.5"/><text class="pt" x="${X(p.s)}" y="${Hh - padB + 16}" text-anchor="middle">${esc(p.id)}</text><text class="pt pf" x="${X(p.s) + 4}" y="${(Y(p.z) + Y(p.H)) / 2}">${num(p.H - p.z, 1)}</text></g>`).join('')}
        <text class="pt" x="${W - padR}" y="${Hh - 6}" text-anchor="end">расстояние от источника, м: ${num(xs, 0)}</text>
      </svg>
      <p class="net-leg"><span class="lh"></span>пьезометрическая линия H <span class="lr"></span>требуемый напор над землёй <span class="lz"></span>поверхность земли</p>`;
  }
  const req = id => (S.scen === 'max' ? N.requiredFree(node(id).floors || 1) : 10);

  /* ---------- отрисовка ---------- */
  const root = () => document.getElementById('constructor-root');
  function render() {
    R = compute();
    const m = SeshatModules.MODULES.find(x => x.id === 'juturna');
    root().innerHTML = `<article class="net-tool kind-${m.kind}">
      <header class="net-head"><div><span class="gp-stage">Конструктор · ${esc(m.n)}</span><h1>Расчёт кольцевой сети</h1></div>
        <div class="net-tools seg" role="group" aria-label="Инструмент">${[['select', 'Выбор'], ['node', 'Узел'], ['pipe', 'Участок'], ['delete', 'Удалить']].map(([k, t]) => `<button type="button" data-tool="${k}" aria-pressed="${S.tool === k}">${t}</button>`).join('')}</div>
        <div class="seg seg-sm" role="group" aria-label="Подписи узлов">${[['free', 'Свободный напор'], ['H', 'Пьезометр'], ['q', 'Отборы']].map(([k, t]) => `<button type="button" data-show="${k}" aria-pressed="${S.show === k}">${t}</button>`).join('')}</div></header>
      <div class="net-body">
        <aside class="net-left">${leftHTML()}</aside>
        <div class="net-plan"><div class="net-canvas">${planSVG()}</div>
          <p class="net-leg">Скорость: ${['до 0,3', '0,3–0,6', '0,6–0,9', '0,9–1,2', 'от 1,2'].map((t, i) => `<span class="lv v${i}"></span>${t}`).join(' ')} м/с · толщина — диаметр${pick ? ` · <b>выберите второй узел участка</b>` : ''}</p></div>
        <aside class="net-right">${rightHTML()}</aside>
      </div>
      ${tablesHTML()}
      <p class="hint net-note">Учебный расчёт. Потери напора — по формулам Ф. А. Шевелёва для неновых стальных и чугунных труб; требуемый напор для многоэтажной застройки — ориентир «10 м + 4 м на этаж»; для проекта нужны расчёт по действующим нормам и сертифицированные программы (п. 7.9 СП 31.13330.2021). Статьи о методе — в <a href="#kb-net">базе знаний модуля</a>.</p>
    </article>`;
    save();
  }
  const rerender = () => { const sx = window.scrollX, sy = window.scrollY; render(); window.scrollTo(sx, sy); };

  /* ---------- события ---------- */
  const svgPoint = (svg, ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const snap = (v, s) => Math.round(v / s) * s;
  let drag = null;
  root().addEventListener('pointerdown', ev => {
    const svg = ev.target.closest('#net-svg'); if (!svg) return;
    const g = ev.target.closest('[data-n]');
    if (g && S.tool === 'select') { drag = { id: g.dataset.n, moved: false }; svg.setPointerCapture(ev.pointerId); }
  });
  root().addEventListener('pointermove', ev => {
    if (!drag) return;
    const svg = document.getElementById('net-svg'), p = svgPoint(svg, ev), n = node(drag.id);
    const x = snap(p.x, 10), y = snap(p.y, 10); if (x === n.x && y === n.y) return;
    n.x = x; n.y = y; drag.moved = true;
    S.net.pipes.forEach(q => { if (!q.Lset && (q.a === n.id || q.b === n.id)) q.L = Math.max(1, dist(node(q.a), node(q.b))); });
    const keep = view; render(); view = keep; // план не «прыгает», пока узел тащат
  });
  root().addEventListener('pointerup', () => { if (drag && drag.moved) { view = null; rerender(); } drag = drag && drag.moved ? { done: true } : null; setTimeout(() => { drag = null; }, 0); });
  root().addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-tool]')) { S.tool = t.closest('[data-tool]').dataset.tool; pick = null; return rerender(); }
    if (t.closest('[data-show]')) { S.show = t.closest('[data-show]').dataset.show; return rerender(); }
    if (t.closest('[data-scen]')) { S.scen = t.closest('[data-scen]').dataset.scen; if (S.scen === 'emerg') S.tab = 'emerg'; else if (S.tab === 'emerg') S.tab = 'pipes'; return rerender(); }
    if (t.closest('[data-tab]')) { S.tab = t.closest('[data-tab]').dataset.tab; return rerender(); }
    const row = t.closest('[data-sel]'); if (row) { S.sel = row.dataset.sel; return rerender(); }
    const er = t.closest('[data-off]'); if (er) { S.off = er.dataset.off; return rerender(); }
    const act = t.closest('[data-act]'); if (act) return action(act.dataset.act);
    const svg = t.closest('#net-svg'); if (!svg || (drag && drag.done)) return;
    const g = t.closest('[data-n]'), pp = t.closest('[data-p]');
    if (S.tool === 'delete') { if (g) removeNode(g.dataset.n); else if (pp) removePipe(pp.dataset.p); return; }
    if (S.tool === 'pipe' && g) {
      const id = g.dataset.n;
      if (!pick) { pick = id; return rerender(); }
      if (pick !== id && !S.net.pipes.some(p => (p.a === pick && p.b === id) || (p.a === id && p.b === pick))) {
        const pid = nextId(S.net.pipes, 'у'); S.net.pipes.push({ id: pid, a: pick, b: id, L: Math.max(1, dist(node(pick), node(id))), d: 150, mat: S.mat }); S.sel = 'p:' + pid;
      }
      pick = null; return rerender();
    }
    if (S.tool === 'node' && !g && !pp) {
      const p = svgPoint(svg, ev), zs = S.net.nodes.map(n => n.z || 0);
      const nid = nextId(S.net.nodes, ''); S.net.nodes.push({ id: nid, x: snap(p.x, 50), y: snap(p.y, 50), z: zs.length ? Math.round(zs.reduce((a, b) => a + b, 0) / zs.length) : 50, q: 0, floors: S.floors });
      S.sel = 'n:' + nid; return rerender();
    }
    if (g) S.sel = 'n:' + g.dataset.n; else if (pp) S.sel = 'p:' + pp.dataset.p; else S.sel = null;
    rerender();
  });
  function removeNode(id) { S.net.nodes = S.net.nodes.filter(n => n.id !== id); S.net.pipes = S.net.pipes.filter(p => p.a !== id && p.b !== id); S.sel = null; view = null; rerender(); }
  function removePipe(id) { S.net.pipes = S.net.pipes.filter(p => p.id !== id); S.sel = null; rerender(); }
  function action(a) {
    const [t, id] = (S.sel || '').split(':');
    if (a === 'del') return t === 'n' ? removeNode(id) : removePipe(id);
    if (a === 'profile') { S.tab = 'profile'; return rerender(); }
    if (a === 'example') { S.net = N.example(); S.sel = null; S.off = null; view = null; return rerender(); }
    if (a === 'clear') { S.net = { nodes: [{ id: 'НС', x: 0, y: 0, z: 50, source: true, H: 90 }], pipes: [] }; S.sel = 'n:НС'; S.tool = 'node'; view = null; toast('Оставлен только источник. Добавляйте узлы инструментом «Узел».'); return rerender(); }
    if (a === 'distribute') {
      const q = N.demand(S.calc).qs, d = N.nodalDemands(S.net, q);
      S.net.nodes.forEach(n => { if (!n.source) n.q = d[n.id] || 0; });
      toast(`Распределено ${num(q, 1)} л/с по ${Object.keys(d).length} узлам.`); return rerender();
    }
    if (a === 'firepick') {
      const fd = N.fireDemand(S.people, S.floors), base = R.base.nodes.filter(n => !node(n.id).source && isFinite(n.free)).sort((x, y) => x.free - y.free);
      const on = new Set(base.slice(0, fd.fires).map(n => n.id));
      S.net.nodes.forEach(n => { n.fire = on.has(n.id); });
      return rerender();
    }
  }
  root().addEventListener('change', ev => {
    const f = ev.target.dataset.f; if (!f) return;
    const v = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.tagName === 'SELECT' ? ev.target.value : ev.target.value;
    const n = parseNum(v), [t, id] = (S.sel || '').split(':');
    if (typeof v === 'string' && ev.target.inputMode === 'decimal' && Number.isNaN(n)) { markInvalid(ev.target, n); return; }
    if (f === 'srcH') S.net.nodes.find(x => x.source).H = n;
    else if (f === 'Hfire') S.Hfire = n || null;
    else if (f === 'people') S.people = Math.max(0.01, n || 0.01);
    else if (f === 'floors') S.floors = Math.max(1, Math.round(n || 1));
    else if (f === 'mat') S.mat = v;
    else if (f.startsWith('c.')) S.calc[f.slice(2)] = n || 0;
    else if (f.startsWith('n.') && t === 'n') {
      const x = node(id), k = f.slice(2);
      if (k === 'id') { const nid = String(v).trim(); if (!nid || node(nid)) { toast('Такой узел уже есть.'); return rerender(); } S.net.pipes.forEach(p => { if (p.a === id) p.a = nid; if (p.b === id) p.b = nid; }); x.id = nid; S.sel = 'n:' + nid; }
      else if (k === 'source') { if (v) S.net.nodes.forEach(o => { o.source = o === x; if (o === x && o.H == null) o.H = (o.z || 0) + 40; }); else x.source = false; }
      else if (k === 'fire') x.fire = v;
      else x[k] = k === 'floors' ? Math.max(1, Math.round(n || 1)) : n ?? 0;
    } else if (f.startsWith('p.') && t === 'p') {
      const x = pipe(id), k = f.slice(2);
      if (k === 'd') x.d = Number(v); else if (k === 'mat') x.mat = v; else if (k === 'transit') x.transit = v; else if (k === 'L') { x.L = Math.max(1, n || 1); x.Lset = true; }
    }
    rerender();
  });
  document.addEventListener('keydown', ev => {
    if (document.body.dataset.view !== 'constructor' || !S.sel || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); action('del'); }
    if (ev.key === 'Escape') { S.sel = null; pick = null; rerender(); }
  });
  VIEW_RENDER.constructor = () => { view = null; render(); };
})();
