// Конструктор модуля «Очистка природных вод»: вода источника → класс по СП 31 (прил. Б) → схема водоподготовки →
// качество после каждого сооружения и сравнение с СанПиН 1.2.3685-21 → расчёт основных сооружений.
// Расчёт — js/dwcalc.js. Состояние хранится в этом браузере.
(function () {
  if (PAGE !== 'anahita' || !window.SeshatDW) return;
  const D = SeshatDW, KEY = 'seshat-dw';
  const docShort = id => { const d = window.SeshatDocs && SeshatDocs.DOCS.find(x => x.id === id); return d ? d.short : id; };
  const ref = x => x ? `<a class="dw-ref" href="#doc-${x.doc}">${esc(docShort(x.doc))}, ${esc(x.where)}${x.page ? `, с. ${x.page}` : ''}</a>` : '';
  const P = Object.fromEntries(D.PARAMS.map(p => [p.k, p]));
  const fmt = v => (v == null || !isFinite(v) ? '—' : D.fmt(v));

  /* ---------- состояние ---------- */
  const fromPreset = id => { const p = D.PRESETS.find(x => x.id === id) || D.PRESETS[0]; const inp = { src: p.src, q: p.q, c: { ...p.c } };
    return { preset: p.id, src: p.src, q: p.q, c: { ...p.c }, scheme: D.classify(inp).scheme, coagDose: 40, filter: 'sand2', hardTarget: 5, tdsTarget: 500, sel: null }; };
  let S;
  try { S = Object.assign(fromPreset('river-b1'), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { S = fromPreset('river-b1'); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* без хранилища — без сохранения */ } };
  const input = () => ({ src: S.src, q: S.q, c: S.c, scheme: S.scheme, coagDose: S.coagDose, filter: S.filter, hardTarget: S.hardTarget, tdsTarget: S.tdsTarget });

  // новое сооружение встаёт по порядку стадий: после последнего сооружения той же или более ранней стадии
  const stIdx = id => D.STAGES.findIndex(s => s.id === D.BY[id].st);
  function add(id) {
    if (!D.BY[id]) return;
    const k = stIdx(id); let at = 0;
    S.scheme.forEach((x, i) => { if (stIdx(x) <= k) at = i + 1; });
    S.scheme.splice(at, 0, id); S.sel = at; save();
    if (document.body.dataset.view === 'constructor') render();
    toast(`Добавлено: ${D.BY[id].n}.`);
  }
  window.SeshatDWView = { add };

  /* ---------- разметка ---------- */
  const num = (label, key, v, hint) => `<label class="net-f"><span>${label}</span><input ${NUM_ATTRS} data-f="${key}" value="${esc(showNum(v ?? ''))}"${hint ? ` title="${esc(hint)}"` : ''}></label>`;
  const SRC_KEYS = { surface: ['turb', 'color', 'po', 'ph', 'alk', 'hard', 'tds', 'fe', 'mn', 'nh4', 'no3', 'f', 'oil', 'phyto', 'temp'], ground: ['turb', 'color', 'po', 'ph', 'alk', 'hard', 'tds', 'fe', 'mn', 'nh4', 'no3', 'f', 'h2s', 'co2', 'temp'] };
  function leftHTML(cl) {
    const extra = S.src === 'ground' ? num('Доля двухвалентного железа, %', 'c.fe2', S.c.fe2) : num('Обобщённые колиформные бактерии, КОЕ/100 мл', 'c.coli', S.c.coli);
    return `
      <section class="panel"><h2>Источник</h2>
        <label class="net-f"><span>Пример воды</span><select data-f="preset">${D.PRESETS.map(p => `<option value="${p.id}"${p.id === S.preset ? ' selected' : ''}>${esc(p.n)}</option>`).join('')}<option value=""${S.preset ? '' : ' selected'}>Свои данные</option></select></label>
        <div class="seg seg-sm dw-src" role="group" aria-label="Тип источника">${[['surface', 'Поверхностный'], ['ground', 'Подземный']].map(([k, t]) => `<button type="button" data-src="${k}" aria-pressed="${S.src === k}">${t}</button>`).join('')}</div>
        ${num('Производительность, м³/сут', 'q', S.q)}</section>
      <section class="panel"><h2>Качество исходной воды</h2>
        <div class="dw-grid">${SRC_KEYS[S.src].map(k => num(`${P[k].n}, ${P[k].u}`, 'c.' + k, S.c[k])).join('')}${extra}</div>
        <p class="hint">Расчётные максимальные мутность и цветность — по анализам не менее чем за 3 года (${ref({ doc: 'sp31', where: 'п. 9.9', page: 33 })}).</p></section>
      <section class="panel"><h2>Реагенты и цели</h2>
        ${num('Доза коагулянта (безводный Al₂(SO₄)₃), мг/л', 'coagDose', S.coagDose, 'Дозу подбирают пробным коагулированием (п. 9.2, 9.15)')}
        <label class="net-f"><span>Загрузка скорых фильтров</span><select data-f="filter">${Object.entries(D.FILTERS).map(([k, f]) => `<option value="${k}"${S.filter === k ? ' selected' : ''}>${esc(f.n)}</option>`).join('')}</select></label>
        ${S.scheme.includes('nacat') ? num('Целевая жёсткость, мг-экв/л', 'hardTarget', S.hardTarget) : ''}
        ${S.scheme.includes('ro') ? num('Целевая минерализация, мг/л', 'tdsTarget', S.tdsTarget) : ''}</section>`;
  }
  function classHTML(cl) {
    const same = cl.scheme.join() === S.scheme.join();
    const what = cl.src === 'ground' ? `Подкласс ${cl.id || '—'} табл. Б.7` : `Класс ${cl.id}${cl.sub && cl.sub.length ? `, подкласс ${cl.sub.join(', ')} (табл. Б.2)` : ''}`;
    return `<section class="panel dw-class"><div><span class="gp-stage">${esc(what)}</span><h2>${esc(cl.n)}</h2><p class="hint">${esc(cl.note)}</p>
        <p>${cl.src === 'surface' ? `Рекомендуемая схема <b>${esc(cl.code)}</b>: ` : 'Рекомендуемая схема: '}${cl.scheme.map(id => esc(D.BY[id].code || D.BY[id].n)).join(' → ')} ${ref(cl.ref)}</p></div>
      <button type="button" class="${same ? '' : 'primary'}" data-act="recommend"${same ? ' disabled' : ''}>${same ? 'Схема совпадает с рекомендуемой' : 'Собрать рекомендуемую схему'}</button></section>`;
  }
  function chainHTML(sim) {
    const warnAt = new Set(sim.warns.filter(w => w.level === 'bad' && w.step >= 0).map(w => w.step));
    const cards = S.scheme.map((id, i) => { const u = D.BY[id], st = D.STAGES.find(s => s.id === u.st);
      return `<li class="dw-unit st-${u.st}${S.sel === i ? ' sel' : ''}${warnAt.has(i) ? ' bad' : ''}" data-i="${i}">
        <button type="button" class="dw-u-main" data-pick="${i}"><b>${i + 1}. ${esc(u.n)}</b><small>${esc(st.n)}${u.code ? ' · код ' + esc(u.code) : ''}</small></button>
        <span class="dw-u-acts"><button type="button" data-mv="-1" data-i="${i}" aria-label="Раньше" title="Раньше"${i ? '' : ' disabled'}>↑</button><button type="button" data-mv="1" data-i="${i}" aria-label="Позже" title="Позже"${i < S.scheme.length - 1 ? '' : ' disabled'}>↓</button><button type="button" data-rm="${i}" aria-label="Убрать" title="Убрать">✕</button></span></li>`; }).join('');
    const opts = D.STAGES.map(st => `<optgroup label="${esc(st.n)}">${D.UNITS.filter(u => u.st === st.id).map(u => `<option value="${u.id}">${esc(u.n)}</option>`).join('')}</optgroup>`).join('');
    return `<section class="panel"><h2>Схема водоподготовки</h2>
      <ol class="dw-chain"><li class="dw-end">Вода источника</li>${cards}<li class="dw-end">В резервуар чистой воды и сеть</li></ol>
      <div class="dw-add"><select id="dw-add" aria-label="Сооружение">${opts}</select><button type="button" data-act="add">Добавить сооружение</button><button type="button" data-act="clear">Очистить схему</button></div></section>`;
  }
  function profileHTML(sim) {
    const keys = D.PARAMS.filter(p => p.norm || ['alk', 'co2'].includes(p.k)).filter(p => SRC_KEYS[S.src].includes(p.k)).map(p => p.k);
    const est = new Set(sim.est), last = sim.steps.length - 1, chk = Object.fromEntries(sim.check.map(c => [c.k, c]));
    const head = `<tr><th class="l">Показатель</th><th>Исходная</th>${sim.steps.slice(1).map((s, i) => `<th title="${esc(D.BY[s.id].n)}"${S.sel === i ? ' class="cur"' : ''}>${esc(D.BY[s.id].code || '•')}<small>${i + 1}</small></th>`).join('')}<th>Норматив</th></tr>`;
    const rows = keys.map(k => { const p = P[k], c = chk[k];
      const cells = sim.steps.map((s, i) => { const prev = i ? sim.steps[i - 1].q[k] : null, changed = i && Math.abs(s.q[k] - prev) > 1e-9;
        return `<td class="${i === last && c ? (c.ok ? 'ok' : 'bad') : ''}${changed ? ' chg' : ''}">${changed && est.has(k) && D.BY[s.id].est && D.BY[s.id].est.includes(k) ? '≈' : ''}${fmt(s.q[k])}</td>`; }).join('');
      const n = p.norm ? (p.norm.min != null ? `${D.fmt(p.norm.min)}–${D.fmt(p.norm.max)}` : `≤ ${D.fmt(p.norm.max)}`) : '—';
      return `<tr><td class="l">${esc(p.n)}<small>${esc(p.u)}</small></td>${cells}<td class="nrm" title="${p.norm ? esc(docShort(p.norm.ref.doc) + ', ' + p.norm.ref.where) : ''}">${n}</td></tr>`; }).join('');
    const micro = `<tr class="dw-micro"><td class="l">Микробиология<small>${S.src === 'surface' ? 'исходная ОКБ ' + fmt(S.c.coli) + ' КОЕ/100 мл' : 'подземный источник'}</small></td><td colspan="${sim.steps.length - 1}" class="l">${sim.flags.barrier ? `физических барьеров: ${sim.flags.barrier}` : 'физических барьеров нет'}${sim.flags.disinfected ? ` · обеззараживание: ${({ cl: 'хлор', nh2cl: 'хлорамины', clo2: 'диоксид хлора', uv: 'ультрафиолет' })[sim.flags.disinfected]}` : ' · нет обеззараживания'}${sim.residual ? ` · остаточный хлор ${D.fmt(sim.residual[0])}–${D.fmt(sim.residual[1])} мг/л` : ''}</td><td class="${sim.micro ? 'ok' : 'bad'}">${sim.micro ? 'барьеры есть' : 'не обеспечено'}</td><td class="nrm" title="${esc(D.NORM_MICRO.where)}">отсутствие</td></tr>`;
    return `<section class="panel"><h2>Качество воды по сооружениям</h2><div class="net-tw"><table class="net-t dw-t"><thead>${head}</thead><tbody>${rows}${micro}</tbody></table></div>
      <p class="hint">Нормативы — СанПиН 1.2.3685-21, табл. 3.1, 3.3, 3.5, 3.13. Изменившиеся значения выделены; «≈» — учебный ориентир: свод правил таких чисел не даёт. Значения после отстойников и фильтров — достижимое качество по табл. 11 и Б.7 СП 31 («не более»).</p></section>`;
  }
  function warnsHTML(sim) {
    const lv = { bad: 'bad', warn: 'warn', info: 'info' };
    const bad = sim.check.filter(c => !c.ok);
    const sum = bad.length || !sim.micro ? `<li class="nc-bad">Не соответствует нормативам: ${[...bad.map(c => P[c.k].n.toLowerCase()), ...(sim.micro ? [] : ['микробиологическая безопасность'])].join(', ')}.</li>` : '<li class="nc-ok">Вода на выходе соответствует нормативам СанПиН по всем показателям модели.</li>';
    return `<section class="panel"><h2>Проверки</h2><ul class="net-checks">${sum}${sim.warns.map(w => `<li class="nc-${lv[w.level] || 'warn'}">${w.step >= 0 ? `<b>${w.step + 1}. ${esc(D.BY[S.scheme[w.step]].n)}:</b> ` : ''}${esc(w.text)}${w.ref ? ' ' + ref(w.ref) : ''}</li>`).join('')}</ul></section>`;
  }
  function selHTML() {
    const id = S.scheme[S.sel]; if (!id) return `<section class="panel"><h2>Как работать</h2><ul class="net-help"><li>Выберите пример воды или введите свои анализы — конструктор определит класс воды по СП 31 и предложит схему.</li><li>Добавляйте, убирайте и переставляйте сооружения; таблица покажет качество после каждого.</li><li>Нажмите на сооружение в схеме — здесь появится его описание и ссылки на пункты свода правил.</li></ul></section>`;
    const u = D.BY[id];
    return `<section class="panel dw-sel"><h2>${esc(u.n)}</h2><p>${esc(u.d)}</p><ul>${u.params.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="hint">${u.refs.map(ref).join(' · ')}</p><a class="btn" href="#kb-v-${id}">Статья о сооружении</a></section>`;
  }
  function sizingHTML(sim) {
    const rows = D.sizing(input(), sim);
    return `<section class="panel dw-size"><h2>Расчёт сооружений</h2><div class="dw-size-grid">${rows.map(g => `<div><h3>${esc(g.t)}</h3><dl>${g.items.map(([l, v, rf, bad]) => `<dt>${esc(l)}</dt><dd class="${bad ? 'bad' : ''}">${esc(v)}${rf ? `<br>${ref(rf)}` : ''}</dd>`).join('')}</dl></div>`).join('')}</div>
      <p class="hint">Учебный расчёт по формулам и таблицам СП 31.13330.2021 для расчётного периода; свод правил требует считать сооружения для двух периодов (минимальной и наибольшей мутности) и уточнять дозы реагентов технологическими изысканиями.</p></section>`;
  }

  /* ---------- отрисовка ---------- */
  const root = () => document.getElementById('constructor-root');
  function render() {
    const cl = D.classify(input()), sim = D.simulate(input());
    if (S.sel != null && S.sel >= S.scheme.length) S.sel = null;
    const m = SeshatModules.MODULES.find(x => x.id === 'anahita');
    root().innerHTML = `<article class="net-tool dw-tool kind-${m.kind}">
      <header class="net-head"><div><span class="gp-stage">Конструктор · ${esc(m.n)}</span><h1>Схема водоподготовки</h1></div></header>
      <div class="net-body dw-body">
        <aside class="net-left">${leftHTML(cl)}</aside>
        <div class="dw-center">${classHTML(cl)}${chainHTML(sim)}</div>
        <aside class="net-right">${warnsHTML(sim)}${selHTML()}</aside>
      </div>
      ${profileHTML(sim)}
      ${sizingHTML(sim)}
      <p class="hint net-note">Учебная модель. Качество после сооружений осветления и обезжелезивания взято как достижимое по табл. 11 и Б.7 СП 31.13330.2021, остальное — ориентиры, помеченные «≈». Статьи о процессах — в <a href="#kb-dwk">базе знаний модуля</a>.</p>
    </article>`;
    save();
  }
  const rerender = () => { const y = window.scrollY; render(); window.scrollTo(window.scrollX, y); };

  /* ---------- события ---------- */
  root().addEventListener('click', ev => {
    const t = ev.target;
    const src = t.closest('[data-src]'); if (src) { if (S.src !== src.dataset.src) { S.src = src.dataset.src; S.preset = ''; } return rerender(); }
    const pick = t.closest('[data-pick]'); if (pick) { S.sel = +pick.dataset.pick === S.sel ? null : +pick.dataset.pick; return rerender(); }
    const mv = t.closest('[data-mv]'); if (mv) { const i = +mv.dataset.i, j = i + +mv.dataset.mv; [S.scheme[i], S.scheme[j]] = [S.scheme[j], S.scheme[i]]; S.sel = j; return rerender(); }
    const rm = t.closest('[data-rm]'); if (rm) { S.scheme.splice(+rm.dataset.rm, 1); S.sel = null; return rerender(); }
    const act = t.closest('[data-act]'); if (!act) return;
    if (act.dataset.act === 'recommend') { S.scheme = D.classify(input()).scheme; S.sel = null; return rerender(); }
    if (act.dataset.act === 'add') return add(document.getElementById('dw-add').value);
    if (act.dataset.act === 'clear') { S.scheme = []; S.sel = null; return rerender(); }
  });
  root().addEventListener('change', ev => {
    const f = ev.target.dataset.f; if (!f) return;
    if (f === 'preset') { if (ev.target.value) { const keep = S.coagDose; S = fromPreset(ev.target.value); S.coagDose = keep; } else S.preset = ''; return rerender(); }
    if (f === 'filter') { S.filter = ev.target.value; return rerender(); }
    const v = parseNum(ev.target.value);
    if (Number.isNaN(v) || v == null) { markInvalid(ev.target, NaN); return; }
    if (f === 'q') S.q = Math.max(1, v);
    else if (f.startsWith('c.')) { S.c[f.slice(2)] = v; S.preset = ''; }
    else S[f] = v;
    rerender();
  });
  VIEW_RENDER.constructor = render;
})();
