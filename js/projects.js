// Раздел «Проекты»: общие для объекта стоки, нормативы и цены + варианты схем, их сравнение.
// Использует общие функции и состояние конструктора из app.js. Проекты сохраняются сразу при любом изменении.

/* ---------- навигация ---------- */
const VIEWS = ['seshat', 'constructor', 'projects', 'genplan', 'docs', 'about'];
const VIEW_RENDER = { projects: () => renderProjects() }; // разделы, которые перерисовываются при открытии
function showView(view) {
  if (view === 'home') view = 'seshat'; // старые ссылки на главную
  if (!VIEWS.includes(view)) view = 'seshat';
  for (const v of VIEWS) document.getElementById('view-' + v).hidden = v !== view;
  document.querySelectorAll('.nav-link').forEach(a => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.dataset.view = view;
  if (VIEW_RENDER[view]) VIEW_RENDER[view]();
  window.scrollTo(0, 0);
}
function viewFromHash() { return (location.hash || '#seshat').slice(1); }
window.addEventListener('hashchange', () => showView(viewFromHash()));
function go(view) { if (viewFromHash() === view) showView(view); else location.hash = view; }

function renderNavCount() {
  const n = store.list('project').length;
  document.getElementById('nav-projects-count').textContent = n ? n : '';
}

/* ---------- состояние раздела ---------- */
const pui = { creating: null, renaming: null, confirmDel: false, renameVar: null };
const projectOpenId = () => state.projectOpen && store.get('project', state.projectOpen) ? state.projectOpen : null;

function saveProject(pr) {
  const it = store.save('project', { id: pr.id, name: pr.name, data: pr.data });
  if (!it) toast('Не удалось сохранить проект: данные заполнены неверно.');
  return it;
}
function currentName(kind, fallback) { const it = refItem(kind, state.ref[kind]); return it ? it.name : fallback; }
// Название без префикса «Проект: », если данные открыты из проекта.
function plainName(kind, fallback) {
  const ref = state.ref[kind], n = currentName(kind, fallback);
  if (!ref || ref[0] !== 'p') return n;
  const pr = store.get('project', ref.slice(2).split(':')[0]);
  return pr && n.startsWith(pr.name + ': ') ? n.slice(pr.name.length + 2) : n;
}
function nextVariantName(pr) { return 'Вариант ' + (pr.data.variants.length + 1); }

// Источники данных для проекта: текущее в конструкторе, «Мои» и примеры.
function sourceOptions(kind) {
  const mine = store.list(kind), ex = KINDS[kind].builtins;
  return `<option value="">${kind === 'scheme' ? 'Добавить вариант…' : 'Заменить на…'}</option>
    <option value="cur">Из конструктора: ${esc(plainName(kind, 'текущее'))}</option>
    ${mine.length ? `<optgroup label="Мои">${mine.map(it => `<option value="u:${esc(it.id)}">${esc(it.name)}</option>`).join('')}</optgroup>` : ''}
    <optgroup label="Примеры">${ex.map(b => `<option value="b:${esc(b.id)}">${esc(b.name)}</option>`).join('')}</optgroup>`;
}
function takeSource(kind, val) {
  if (val === 'cur') return { name: plainName(kind, KINDS[kind].label), data: clone(KINDS[kind].get()) };
  const it = refItem(kind, val);
  return it ? { name: it.name, data: clone(it.data) } : null;
}

/* ---------- панель выбора проекта ---------- */
function renderProjBar() {
  const el = document.getElementById('proj-bar'), list = store.list('project'), pid = projectOpenId(), pr = pid && store.get('project', pid);
  let h = '<div class="proj-bar">';
  if (list.length) {
    h += `<select id="sel-project" aria-label="Открыть проект">${list.map(p => `<option value="${esc(p.id)}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
  }
  if (pui.creating != null) {
    h += `<form class="name-form" data-mode="create"><input id="proj-name" type="text" maxlength="120" required aria-label="Название проекта" placeholder="Например: Очистные пос. Н." value="${esc(pui.creating)}">
      <button type="submit" class="primary">Создать</button><button type="button" data-act="cancel">Отмена</button></form>`;
  } else if (pui.renaming != null && pr) {
    h += `<form class="name-form" data-mode="rename"><input id="proj-rename" type="text" maxlength="120" required aria-label="Новое название проекта" value="${esc(pui.renaming)}">
      <button type="submit" class="primary">Переименовать</button><button type="button" data-act="cancel">Отмена</button></form>`;
  } else if (pui.confirmDel && pr) {
    h += `<div class="saved-actions"><span class="ask">Удалить проект «${esc(pr.name)}» со всеми вариантами?</span>
      <button type="button" data-act="del-yes" class="danger">Удалить</button><button type="button" data-act="cancel">Отмена</button></div>`;
  } else {
    h += `<div class="saved-actions"><button type="button" data-act="create" class="${list.length ? '' : 'primary'}">Создать проект</button>
      ${pr ? '<button type="button" data-act="rename">Переименовать</button><button type="button" data-act="del">Удалить</button>' : ''}</div>`;
  }
  el.innerHTML = h + '</div>';
  if (pui.creating != null || pui.renaming != null) { const inp = el.querySelector('input'); inp.focus(); if (!inp.dataset.sel) { inp.select(); inp.dataset.sel = 1; } }
}

const projBar = document.getElementById('proj-bar');
projBar.addEventListener('change', ev => {
  if (ev.target.id !== 'sel-project') return;
  state.projectOpen = ev.target.value; Object.assign(pui, { renaming: null, confirmDel: false, renameVar: null });
  saveState(); renderProjects();
});
projBar.addEventListener('input', ev => {
  if (ev.target.id === 'proj-name') pui.creating = ev.target.value;
  if (ev.target.id === 'proj-rename') pui.renaming = ev.target.value;
});
projBar.addEventListener('click', ev => {
  const act = ev.target.closest('[data-act]')?.dataset.act; if (!act) return;
  const pid = projectOpenId(), pr = pid && store.get('project', pid);
  if (act === 'create') { pui.creating = uniqueProjectName(); pui.renaming = null; pui.confirmDel = false; }
  else if (act === 'rename' && pr) pui.renaming = pr.name;
  else if (act === 'del') pui.confirmDel = true;
  else if (act === 'cancel') Object.assign(pui, { creating: null, renaming: null, confirmDel: false });
  else if (act === 'del-yes' && pr) {
    pui.confirmDel = false;
    const snap = clone(pr);
    store.remove('project', pr.id);
    detachProject(pr.id);
    state.projectOpen = store.list('project')[0]?.id || null; saveState();
    toast(`Удалён проект «${snap.name}»`, { label: 'Восстановить', run: () => {
      const it = store.save('project', { name: snap.name, data: snap.data });
      if (it) { state.projectOpen = it.id; saveState(); renderProjects(); }
    } });
  }
  renderProjects();
});
projBar.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.dataset.mode === 'create') {
    const name = pui.creating.trim(); if (!name) return;
    const it = store.save('project', { name, data: newProjectData() });
    pui.creating = null;
    if (it) { state.projectOpen = it.id; saveState(); toast(`Создан проект «${it.name}»`); }
  } else {
    const pr = store.get('project', projectOpenId()), name = (pui.renaming || '').trim(); if (!pr || !name) return;
    store.rename('project', pr.id, name); pui.renaming = null; toast(`Переименовано: «${name}»`);
    renderBars();
  }
  renderProjects();
});
projBar.addEventListener('keydown', ev => { if (ev.key === 'Escape') { Object.assign(pui, { creating: null, renaming: null, confirmDel: false }); renderProjects(); } });

function uniqueProjectName() {
  const names = new Set(store.list('project').map(p => p.name));
  let i = 1; while (names.has(`Проект ${i}`)) i++;
  return `Проект ${i}`;
}
// Новый проект берёт то, что сейчас открыто в конструкторе: стоки, нормативы, цены и схему как первый вариант.
function newProjectData() {
  return {
    influent: { name: plainName('influent', 'Стоки'), q: state.q, c: { ...state.c } },
    norm: { name: plainName('norm', 'Нормативы'), v: { ...state.norm } },
    prices: { ...state.prices },
    variants: [{ id: SeshatStore.newId(), name: plainName('scheme', 'Вариант 1'), steps: clone(state.steps) }]
  };
}
// Проект удалён: конструктор перестаёт на него ссылаться.
function detachProject(pid) {
  const f = fresh();
  for (const k of Object.keys(KINDS)) if (state.ref[k] && state.ref[k].startsWith('p:' + pid)) state.ref[k] = f.ref[k];
  if (state.ctx && state.ctx.pid === pid) state.ctx = null;
  saveState(); renderBars(); renderCtx();
}

/* ---------- содержимое проекта ---------- */
function renderProjects() {
  renderNavCount();
  renderProjBar();
  const body = document.getElementById('proj-body'), pid = projectOpenId();
  if (!pid) {
    body.innerHTML = `<section class="panel proj-empty">
      <h2>Проектов пока нет</h2>
      <p>Создайте проект для объекта, который проектируете. В него сразу попадут стоки, нормативы, цены и схема, открытые в конструкторе. Затем добавьте ещё 1–5 вариантов схем и сравните их рядом: качество воды на выпуске, капзатраты, эксплуатация, себестоимость.</p>
    </section>`;
    return;
  }
  const pr = store.get('project', pid), d = pr.data;
  const nset = PARAMS.filter(p => d.norm.v[p.k] != null).length;
  const pricesLine = `${showNum(d.prices.kwh)} ₽/кВт·ч · осадок ${rub(d.prices.sludge)} ₽/т · ремонт ${showNum(d.prices.repair)}%/год${d.prices.capexIdx !== 1 ? ` · коэфф. ${showNum(d.prices.capexIdx)}` : ''}`;
  const card = (kind, title, name, line, extra) => `<div class="proj-card">
      <span class="proj-card-k">${title}</span><b>${esc(name)}</b><p>${line}</p>
      ${extra || `<select id="src-${kind}" class="src" data-kind="${kind}" aria-label="${title}: заменить">${sourceOptions(kind)}</select>`}
    </div>`;
  let h = `<section class="panel" aria-labelledby="h-proj-in">
    <div class="panel-head"><h2 id="h-proj-in">Исходные данные</h2><span class="hint">Общие для всех вариантов</span></div>
    <div class="proj-cards">
      ${card('influent', 'Стоки', d.influent.name, `${rub(d.influent.q)} м³/сут · БПК₅ ${fmt(d.influent.c.bod)} · N-NH₄ ${fmt(d.influent.c.nh4)} · P ${fmt(d.influent.c.p)}`)}
      ${card('norm', 'Нормативы', d.norm.name, `задано ${nset} из ${PARAMS.length} показателей`)}
      ${card('prices', 'Цены', 'Экономические параметры', pricesLine, '<button type="button" data-act="prices-cur">Взять цены из конструктора</button>')}
    </div>
    <p class="hint">Чтобы поправить отдельные значения, откройте любой вариант в конструкторе и нажмите «Сохранить в проект»: стоки, нормативы и цены обновятся для всех вариантов.</p>
  </section>`;

  const cmp = SeshatCompare.compare(d), rows = cmp.rows, full = d.variants.length >= SeshatStore.MAX_VARIANTS;
  h += `<section class="panel" aria-labelledby="h-proj-var">
    <div class="panel-head"><h2 id="h-proj-var">Сравнение вариантов</h2>
      ${full ? `<span class="hint">Не больше ${SeshatStore.MAX_VARIANTS} вариантов</span>` : `<select id="src-scheme" class="src src-add" data-kind="scheme" aria-label="Добавить вариант">${sourceOptions('scheme')}</select>`}
    </div>
    ${verdictHtml(cmp, d)}
    ${rows.length ? compareTable(cmp, d) : '<div class="empty">Вариантов нет. Добавьте схему из конструктора, из своих или из примеров.</div>'}
  </section>`;
  body.innerHTML = h;
  const rv = pui.renameVar && document.getElementById('var-rename-' + pui.renameVar);
  if (rv) { rv.focus(); rv.select(); }
}

function plural(n, one, few, many) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; }

function verdictHtml(cmp, d) {
  const v = cmp.verdict; if (!v) return '';
  const nm = id => `«${esc(d.variants.find(x => x.id === id).name)}»`;
  if (v.kind === 'none') {
    return `<div class="verdict bad"><b>Ни один вариант не выполняет все нормативы.</b> Ближе всех ${nm(v.closest)}: ${v.pass} из ${v.tot}. Добавьте доочистку или откройте вариант в конструкторе: там есть подсказки, какие технологии помогут.</div>`;
  }
  if (v.kind === 'single') {
    return `<div class="verdict ok"><b>Лучший вариант: ${nm(v.best)}.</b> Выполняет все нормативы и самый дешёвый и в строительстве, и в эксплуатации${v.compliant > 1 ? ` среди ${v.compliant} подходящих` : ''}.</div>`;
  }
  const yrs = isFinite(v.payback) ? v.payback.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : '—';
  return `<div class="verdict ok"><b>Нормативы выполняют ${v.compliant} ${plural(v.compliant, 'вариант', 'варианта', 'вариантов')}.</b> ${nm(v.lowCapex)} дешевле построить, ${nm(v.lowOpex)} дешевле эксплуатировать:
    дороже на ${money(v.dCapex)} при строительстве, экономит ${money(v.dOpexYear)} в год. Разница окупается за <b>${yrs} лет</b>.</div>`;
}

function compareTable(cmp, d) {
  const rows = cmp.rows, best = cmp.best;
  const isBest = (k, id) => (best[k] || []).includes(id);
  const cell = (k, r, txt, cls) => `<td class="num${isBest(k, r.id) ? ' best' : ''}${cls ? ' ' + cls : ''}">${txt}</td>`;
  const head = rows.map((r, i) => {
    const v = d.variants[i];
    const icons = v.steps.map(st => `<span style="color:${STG[U[st.u].st].c}" title="${esc(U[st.u].n)}">${SeshatIcons.icon(st.u, 30)}</span>`).join('');
    const title = pui.renameVar === v.id
      ? `<form class="var-rename" data-vid="${esc(v.id)}"><input id="var-rename-${esc(v.id)}" type="text" maxlength="80" value="${esc(v.name)}" aria-label="Название варианта"><button type="submit" class="primary">OK</button></form>`
      : `<b class="var-name">${esc(v.name)}</b>`;
    return `<th class="var-col" scope="col"><div class="var-head">
      <span class="var-n">${i + 1}</span>${title}
      <div class="var-icons">${icons || '<span class="hint">пусто</span>'}</div>
      <span class="hint">${v.steps.length} ступ.</span>
      <div class="var-actions">
        <button type="button" data-vact="open" data-vid="${esc(v.id)}" class="primary">Открыть в конструкторе</button>
        <button type="button" data-vact="rename" data-vid="${esc(v.id)}">Переименовать</button>
        <button type="button" data-vact="copy" data-vid="${esc(v.id)}" ${d.variants.length >= SeshatStore.MAX_VARIANTS ? 'disabled' : ''}>Копия</button>
        <button type="button" data-vact="del" data-vid="${esc(v.id)}" aria-label="Удалить вариант">Удалить</button>
      </div></div></th>`;
  }).join('');
  let h = `<div class="tbl-wrap"><table class="cmp"><thead><tr><th class="p">Показатель</th>${head}</tr></thead><tbody>`;
  h += `<tr class="grp"><th class="p" colspan="${rows.length + 1}">Качество воды на выпуске</th></tr>`;
  for (const p of PARAMS) {
    const n = d.norm.v[p.k];
    h += `<tr><td class="p"><b>${p.n}</b><small>${p.u}${n != null ? ` · норматив ${fmt(n)}` : ''}</small></td>${rows.map(r =>
      cell('c_' + p.k, r, `${fmt(r.out[p.k])} ${r.status[p.k] === 'ok' ? '<span class="pill ok">✓</span>' : r.status[p.k] === 'bad' ? `<span class="pill bad">×${fmt(r.out[p.k] / n)}</span>` : ''}`)).join('')}</tr>`;
  }
  h += `<tr class="sum"><td class="p"><b>Нормативы выполнены</b></td>${rows.map(r => cell('pass', r, `<span class="pill ${r.compliant ? 'ok' : 'bad'}">${r.pass} из ${r.tot}</span>`)).join('')}</tr>`;
  h += `<tr class="grp"><th class="p" colspan="${rows.length + 1}">Затраты</th></tr>`;
  const line = (k, label, unit, f) => `<tr><td class="p"><b>${label}</b><small>${unit}</small></td>${rows.map(r => cell(k, r, f(r))).join('')}</tr>`;
  h += line('capex', 'Капитальные затраты', 'единовременно', r => mln(r.eco.total.capex));
  h += line('opex', 'Эксплуатация', 'в сутки / в год', r => `${money(r.eco.total.opex)}<small class="sub2">${money(r.eco.perYear)} в год</small>`);
  h += line('perM3', 'Себестоимость очистки', '₽/м³', r => r.eco.perM3.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  h += line('kwh', 'Электроэнергия', 'кВт·ч/сут', r => rub(r.eco.total.kwh));
  h += line('sludge', 'Осадок и ил', 'т сухого вещества в сутки', r => fmt(r.sim.sludge / 1000));
  h += `<tr class="grp"><th class="p" colspan="${rows.length + 1}">Риски</th></tr>`;
  h += line('warnings', 'Предупреждения', 'проверки применимости', r => r.warnings ? `<span class="pill warn" title="${esc(r.sim.warns.flat().join('\n'))}">${r.warnings}</span>` : '<span class="pill ok">нет</span>');
  return h + '</tbody></table></div><p class="hint">Зелёным выделено лучшее значение в строке. Наведите на число предупреждений, чтобы прочитать их.</p>';
}

/* ---------- действия внутри проекта ---------- */
const projBody = document.getElementById('proj-body');
projBody.addEventListener('change', ev => {
  const t = ev.target; if (!t.classList.contains('src') || !t.value) return;
  const pr = store.get('project', projectOpenId()); if (!pr) return;
  const kind = t.dataset.kind, src = takeSource(kind, t.value); if (!src) return;
  const d = pr.data;
  if (kind === 'influent') d.influent = { name: src.name, ...src.data };
  else if (kind === 'norm') d.norm = { name: src.name, ...src.data };
  else if (kind === 'scheme') {
    if (d.variants.length >= SeshatStore.MAX_VARIANTS) return;
    d.variants.push({ id: SeshatStore.newId(), name: src.name || nextVariantName(pr), steps: src.data.steps });
  }
  if (saveProject(pr)) toast(kind === 'scheme' ? `Добавлен вариант «${d.variants[d.variants.length - 1].name}»` : `Заменено: ${kind === 'influent' ? 'стоки' : 'нормативы'} «${src.name}»`);
  renderProjects();
});
projBody.addEventListener('click', ev => {
  const pr = store.get('project', projectOpenId()); if (!pr) return;
  if (ev.target.closest('[data-act=prices-cur]')) {
    pr.data.prices = { ...state.prices }; saveProject(pr); toast('Цены взяты из конструктора'); renderProjects(); return;
  }
  const b = ev.target.closest('[data-vact]'); if (!b) return;
  const d = pr.data, i = d.variants.findIndex(v => v.id === b.dataset.vid); if (i < 0) return;
  const v = d.variants[i], act = b.dataset.vact;
  if (act === 'open') { openVariant(pr.id, v.id); return; }
  if (act === 'rename') { pui.renameVar = v.id; }
  if (act === 'copy') {
    d.variants.splice(i + 1, 0, { id: SeshatStore.newId(), name: (v.name + ' (копия)').slice(0, 80), steps: clone(v.steps) });
    saveProject(pr);
  }
  if (act === 'del') {
    const snap = clone(v);
    d.variants.splice(i, 1); saveProject(pr);
    if (state.ctx && state.ctx.vid === v.id) { state.ctx = null; renderCtx(); }
    toast(`Удалён вариант «${snap.name}»`, { label: 'Вернуть', run: () => {
      const p2 = store.get('project', pr.id); if (!p2) return;
      p2.data.variants.splice(Math.min(i, p2.data.variants.length), 0, snap); saveProject(p2); renderProjects();
    } });
  }
  renderProjects();
});
projBody.addEventListener('submit', ev => {
  const f = ev.target.closest('.var-rename'); if (!f) return;
  ev.preventDefault();
  const pr = store.get('project', projectOpenId()), v = pr && pr.data.variants.find(x => x.id === f.dataset.vid);
  const name = f.querySelector('input').value.trim();
  if (v && name) { v.name = name.slice(0, 80); saveProject(pr); renderBars(); }
  pui.renameVar = null; renderProjects();
});
projBody.addEventListener('keydown', ev => { if (ev.key === 'Escape' && pui.renameVar) { pui.renameVar = null; renderProjects(); } });

/* ---------- вариант проекта в конструкторе ---------- */
function openVariant(pid, vid) {
  const pr = store.get('project', pid), v = pr && pr.data.variants.find(x => x.id === vid); if (!pr || !v) return;
  const d = pr.data;
  state.q = d.influent.q; state.c = { ...d.influent.c };
  state.norm = { ...d.norm.v };
  state.prices = { ...d.prices };
  state.steps = clone(v.steps);
  state.ref = { influent: 'p:' + pid, norm: 'p:' + pid, scheme: `p:${pid}:${vid}` };
  state.ctx = { pid, vid };
  for (const k of Object.keys(KINDS)) { delete ui.draft[k]; delete ui.confirmDel[k]; delete ui.rename[k]; }
  renderInputs(); renderPrices(); update();
  go('constructor');
}

function ctxDirty() {
  const c = state.ctx, pr = c && store.get('project', c.pid), v = pr && pr.data.variants.find(x => x.id === c.vid);
  if (!v) return false;
  const d = pr.data, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return !same(SeshatStore.validate.influent({ q: state.q, c: state.c }), SeshatStore.validate.influent(d.influent))
    || !same(SeshatStore.validate.norm({ v: state.norm }), SeshatStore.validate.norm(d.norm))
    || !same(SeshatStore.validate.scheme({ steps: state.steps }), SeshatStore.validate.scheme(v))
    || !same(state.prices, d.prices);
}

function renderCtx() {
  const el = document.getElementById('ctx'), c = state.ctx;
  const pr = c && store.get('project', c.pid), v = pr && pr.data.variants.find(x => x.id === c.vid);
  if (!v) { el.hidden = true; el.innerHTML = ''; return; }
  const dirty = ctxDirty();
  el.hidden = false;
  el.innerHTML = `<div class="ctx-text"><span>Вариант <b>«${esc(v.name)}»</b> проекта <b>«${esc(pr.name)}»</b>${dirty ? ' <span class="mod">изменено</span>' : ''}</span>
      <small>«Сохранить в проект» запишет схему в этот вариант, а стоки, нормативы и цены — в проект, для всех вариантов.</small></div>
    <div class="ctx-actions">
      <button type="button" data-cact="save" class="${dirty ? 'primary' : ''}" ${dirty ? '' : 'disabled'}>Сохранить в проект</button>
      <button type="button" data-cact="back">К сравнению</button>
      <button type="button" data-cact="close" aria-label="Отвязать конструктор от проекта" title="Отвязать конструктор от проекта">✕</button>
    </div>`;
}
document.getElementById('ctx').addEventListener('click', ev => {
  const act = ev.target.closest('[data-cact]')?.dataset.cact; if (!act) return;
  const c = state.ctx, pr = c && store.get('project', c.pid), v = pr && pr.data.variants.find(x => x.id === c.vid);
  if (act === 'close') { state.ctx = null; saveState(); renderCtx(); return; }
  if (!v) return;
  if (act === 'save') {
    const d = pr.data;
    d.influent = { name: d.influent.name, q: state.q, c: { ...state.c } };
    d.norm = { name: d.norm.name, v: { ...state.norm } };
    d.prices = { ...state.prices };
    v.steps = clone(state.steps);
    if (saveProject(pr)) {
      state.ref = { influent: 'p:' + pr.id, norm: 'p:' + pr.id, scheme: `p:${pr.id}:${v.id}` };
      update(); toast(`Сохранено в проект «${pr.name}»`);
    }
    return;
  }
  if (act === 'back') { state.projectOpen = pr.id; saveState(); go('projects'); }
});

/* ---------- запуск ---------- */
state.projectOpen = projectOpenId() || store.list('project')[0]?.id || null;
renderNavCount();
renderCtx();
// Библиотека загружена из файла — обновить список проектов.
document.getElementById('file-import').addEventListener('change', () => setTimeout(() => { renderNavCount(); if (viewFromHash() === 'projects') renderProjects(); }, 50));
