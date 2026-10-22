// База знаний. Универсальные разделы (показатели, учебники, журналы, сообщества) живут на главной Сешат,
// специфические — у своих модулей: сооружения и процессы очистки сточных вод — в Тласольтеотль.
// Адреса: #kb — главная базы знаний этой страницы, #kb-units / -proc / -ind / -books / -journals / -comm — разделы,
// #kb-u-<id> — сооружение, #kb-p-<id> — процесс, #kb-i-<id> — показатель, #kb-a-<id> — вспомогательное здание.
// Чужие разделы core.js открывает на странице владельца.

const KB = SeshatKB;
const kbUI = { q: '' };
const KB_SECTIONS = [
  { id: 'units', t: 'Сооружения очистки', d: 'Как устроено и работает каждое из 40 сооружений, что оно удаляет и сколько стоит.', n: () => UNITS.length + KB.AUX.length },
  { id: 'proc', t: 'Физика и химия процессов', d: 'Осаждение, флотация, нитрификация, денитрификация, мембраны, обеззараживание — с уравнениями и ключевыми числами.', n: () => KB.PROCESSES.length },
  { id: 'ind', t: 'Показатели качества воды', d: 'Что означают БПК, ХПК, азот, фосфор и другие показатели, как их измеряют и почему они важны.', n: () => KB.INDICATORS.length },
  { id: 'books', t: 'Учебники по дисциплинам', d: 'Классические российские и зарубежные учебники и справочники по водоотведению, биологии, химии воды и гидравлике.', n: () => KB.BOOKS.reduce((s, b) => s + b.list.length, 0) },
  { id: 'journals', t: 'Научные журналы', d: 'Российские и международные журналы, где публикуют исследования по очистке воды.', n: () => KB.JOURNALS.reduce((s, b) => s + b.list.length, 0) },
  { id: 'comm', t: 'Профессиональные сообщества', d: 'Ассоциации и организации отрасли в России и мире: конференции, стандарты, обучение.', n: () => KB.COMMUNITIES.reduce((s, b) => s + b.list.length, 0) }
];
const UNIVERSAL = ['ind', 'books', 'journals', 'comm'];
const MODULE_KB = { tlazolteotl: ['units', 'proc'] }; // разделы, подведомственные модулям
const KB_MODS = SeshatModules.MODULES, KB_MOD = KB_MODS.find(m => m.id === PAGE); // модуль этой страницы (на главной — нет)
const kbCount = id => (MODULE_KB[id] || []).reduce((n, s) => n + KB_SECTIONS.find(x => x.id === s).n(), 0);
const PROC_BY = Object.fromEntries(KB.PROCESSES.map(p => [p.id, p]));
const IND_BY = Object.fromEntries(KB.INDICATORS.map(p => [p.id, p]));
const AUX_BY = Object.fromEntries(KB.AUX.map(p => [p.id, p]));
const EFF_IND = { ss: 'ss', bod: 'bod', cod: 'cod', nh4: 'nh4', no2: 'no2', no3: 'no3', p: 'p', oil: 'oil', fat: 'fat', nit: 'nh4', den: 'no3', bioP: 'p' };
const EFF_NAME = { nit: 'нитрификация', den: 'денитрификация', bioP: 'биоудаление P' };
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е');
const kbRoot = () => document.getElementById('kb-root');
const crumbs = (...items) => `<nav class="kb-crumbs" aria-label="Навигация"><a href="#kb">База знаний${KB_MOD ? ' · ' + esc(KB_MOD.n) : ''}</a>${items.map(([t, h]) => h ? ` / <a href="${h}">${esc(t)}</a>` : ` / <span>${esc(t)}</span>`).join('')}</nav>`;
const procLink = id => PROC_BY[id] ? `<a class="kb-tag" href="#kb-p-${id}">${esc(PROC_BY[id].t)}</a>` : '';
const unitLink = id => `<a class="kb-unit-link" href="#kb-u-${id}" style="--c:${STG[U[id].st].c}">${SeshatIcons.icon(id, 36)}<span>${esc(U[id].n)}</span></a>`;
const ext = (t, u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;

/* ---------- главная базы знаний: на главной Сешат и в каждом модуле ---------- */
const kbCard = (s, href) => `<a class="kb-card" href="${href || '#kb-' + s.id}"><b>${esc(s.t)}</b><span>${esc(s.d)}</span><small>${s.n()} ${({ books: 'учебников', journals: 'журналов', comm: 'организаций' })[s.id] || 'статей'}</small></a>`;
function kbHome() {
  const head = KB_MOD
    ? `<header class="kb-head"><div><p class="lore-kicker kind-${KB_MOD.kind}" style="color:var(--k)">${esc(KB_MOD.n)} · ${esc(KB_MOD.d)}</p><h1>База знаний модуля</h1>
        <p class="sub">${(MODULE_KB[PAGE] || []).length ? 'Статьи по дисциплине модуля. Общие для всей экосистемы разделы — показатели воды, учебники, журналы и сообщества — собраны в базе знаний Сешат.' : 'Раздел наполняется вместе с модулем. Пока здесь — смежные статьи из других модулей и общие разделы Сешат.'}</p></div></header>`
    : `<header class="kb-head"><div><h1>База знаний Сешат</h1>
        <p class="sub">Общие разделы для всей экосистемы и базы знаний модулей: у каждого модуля — свои сооружения, процессы и расчёты.</p></div></header>`;
  kbRoot().innerHTML = `${head}
    <input id="kb-search" type="search" class="lib-search kb-search" placeholder="${KB_MOD ? 'Найти в базе знаний модуля и общих разделах…' : 'Найти: «нитрификация», «ХПК», «мембран», «Хенце»…'}" aria-label="Поиск по базе знаний" value="${esc(kbUI.q)}">
    <div id="kb-results"></div>`;
  kbResults();
}
function kbResults() {
  const box = document.getElementById('kb-results'), q = norm(kbUI.q.trim());
  const own = KB_MOD ? (MODULE_KB[PAGE] || []) : [];
  if (!q) {
    const uni = `<section class="kb-group"><h2>${KB_MOD ? 'Общие разделы Сешат' : 'Общие разделы'}</h2><div class="kb-grid">${UNIVERSAL.map(id => kbCard(KB_SECTIONS.find(s => s.id === id))).join('')}</div></section>`;
    if (!KB_MOD) {
      box.innerHTML = uni + `<section class="kb-group"><h2>Базы знаний модулей</h2><div class="kb-grid kb-mods">${KB_MODS.map(m => {
        const n = kbCount(m.id);
        return `<a class="kb-card kb-mod kind-${m.kind}" href="${ROOT + m.path}#kb">${SeshatModules.glyph(m.id, 26)}<b>${esc(m.n)}</b><span>${esc(m.d)}</span><small>${n ? n + ' статей' : 'наполняется'}</small></a>`;
      }).join('')}</div></section>`;
      return;
    }
    const mine = own.length ? `<section class="kb-group"><h2>Разделы модуля</h2><div class="kb-grid">${own.map(id => kbCard(KB_SECTIONS.find(s => s.id === id))).join('')}</div></section>` : '';
    const related = (KB_MOD.kb || []).map(h => { const p = PROC_BY[h.replace('kb-p-', '')]; return p ? `<li><a href="#${h}">${esc(p.t)}</a> <span class="hint">— из базы знаний Тласольтеотль</span></li>` : ''; }).join('');
    const start = PAGE === 'tlazolteotl' ? `<section class="panel kb-start"><h2>С чего начать</h2><ul class="kb-links">
        <li><a href="#kb-p-biooxidation">Как бактерии очищают воду</a> — основа всей биологической очистки.</li>
        <li><a href="#kb-p-nitrification">Нитрификация</a> и <a href="#kb-p-denitrification">денитрификация</a> — как удаляют азот.</li>
        <li><a href="#kb-i-bod">БПК₅</a> и <a href="#kb-i-cod">ХПК</a> — два главных показателя органики.</li>
        <li><a href="#kb-p-sedimentation">Осаждение</a> — почему отстойники считают по площади, а не по глубине.</li>
      </ul></section>` : '';
    const soon = !own.length ? `<section class="panel"><h2>Что появится здесь</h2><ul class="kb-links">${KB_MOD.will.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${related ? `<h2 class="kb-sub">Смежные статьи уже сейчас</h2><ul class="kb-links">${related}</ul>` : ''}</section>` : '';
    box.innerHTML = mine + start + soon + uni;
    return;
  }
  const stem = q.length > 5 ? q.slice(0, -2) : q, hit = t => norm(t).includes(stem);
  const res = [], withMod = !KB_MOD; // на главной Сешат ищем и по модулям, в модуле — по своему модулю и общим разделам
  if (withMod || own.includes('units')) {
    UNITS.forEach(u => { const P = SeshatPlan.PLAN[u.id] || {}; if (hit(u.n + ' ' + u.d + ' ' + (P.how || ''))) res.push(['Сооружение', u.n, '#kb-u-' + u.id]); });
    KB.AUX.forEach(a => { if (hit(a.t + ' ' + a.lead + a.s.map(x => x.join(' ')).join(' '))) res.push(['Сооружение', a.t, '#kb-a-' + a.id]); });
  }
  if (withMod || own.includes('proc')) KB.PROCESSES.forEach(p => { if (hit(p.t + ' ' + p.lead + ' ' + p.s.map(x => x.join(' ')).join(' ') + (p.f || []).join(' '))) res.push(['Процесс', p.t, '#kb-p-' + p.id]); });
  KB.INDICATORS.forEach(p => { if (hit([p.t, p.what, p.why, p.how].join(' '))) res.push(['Показатель', p.t, '#kb-i-' + p.id]); });
  KB.BOOKS.forEach(b => b.list.forEach(([a, t]) => { if (hit(a + ' ' + t + ' ' + b.d)) res.push(['Учебник', `${a} ${t}`, '#kb-books']); }));
  KB.JOURNALS.forEach(b => b.list.forEach(([t, d]) => { if (hit(t + ' ' + d)) res.push(['Журнал', t, '#kb-journals']); }));
  KB.COMMUNITIES.forEach(b => b.list.forEach(([t, d]) => { if (hit(t + ' ' + d)) res.push(['Сообщество', t, '#kb-comm']); }));
  box.innerHTML = res.length ? `<p class="hint">Найдено: ${res.length}</p><ul class="kb-res">${res.map(([k, t, h]) => `<li><a href="${h}"><small>${k}</small><span>${esc(t)}</span></a></li>`).join('')}</ul>`
    : `<div class="empty">Ничего не найдено по запросу «${esc(kbUI.q)}».</div>`;
}

/* ---------- разделы ---------- */
function kbSection(id) {
  const S = KB_SECTIONS.find(s => s.id === id);
  let body = '';
  if (id === 'units') {
    body = STAGES.map(s => `<section class="kb-group"><h2><span class="dot" style="background:${s.c}"></span>${esc(s.n)}</h2><div class="kb-units">${UNITS.filter(u => u.st === s.id).map(u => unitLink(u.id)).join('')}</div></section>`).join('')
      + `<section class="kb-group"><h2><span class="dot" style="background:var(--muted)"></span>Вспомогательные здания</h2><ul class="kb-links">${KB.AUX.map(a => `<li><a href="#kb-a-${a.id}">${esc(a.t)}</a></li>`).join('')}</ul></section>`;
  } else if (id === 'proc') {
    const groups = [...new Set(KB.PROCESSES.map(p => p.g))];
    body = groups.map(g => `<section class="kb-group"><h2>${esc(g)}</h2><div class="kb-grid kb-grid-sm">${KB.PROCESSES.filter(p => p.g === g).map(p => `<a class="kb-card" href="#kb-p-${p.id}"><b>${esc(p.t)}</b><span>${esc(p.lead)}</span></a>`).join('')}</div></section>`).join('');
  } else if (id === 'ind') {
    body = `<div class="kb-grid kb-grid-sm">${KB.INDICATORS.map(p => `<a class="kb-card" href="#kb-i-${p.id}"><b>${esc(p.t)}</b><span>${esc(p.u)} · в городских стоках ${esc(p.typ)}</span></a>`).join('')}</div>`;
  } else if (id === 'books') {
    body = KB.BOOKS.map(b => `<section class="panel kb-group"><h2>${esc(b.d)}</h2><ol class="kb-books">${b.list.map(([a, t, pub]) => `<li><span class="kb-auth">${esc(a)}</span> <b>${esc(t)}</b>. <span class="kb-pub">${esc(pub)}</span></li>`).join('')}</ol></section>`).join('')
      + '<p class="hint">Многие учебники переиздавались; ищите последнее издание в библиотеке вуза или в электронных библиотечных системах.</p>';
  } else {
    const src = id === 'journals' ? KB.JOURNALS : KB.COMMUNITIES;
    body = src.map(b => `<section class="panel kb-group"><h2>${esc(b.g)}</h2><ul class="kb-ext">${b.list.map(([t, d, u]) => `<li>${ext(t, u)}<span>${esc(d)}</span></li>`).join('')}</ul></section>`).join('');
  }
  kbRoot().innerHTML = `${crumbs([S.t])}<header class="kb-head"><div><h1>${esc(S.t)}</h1><p class="sub">${esc(S.d)}</p></div></header>${body}`;
}

/* ---------- статьи ---------- */
function article(head, main, side) {
  return `<article class="kb-article">${head}<div class="kb-layout"><div class="kb-main">${main}</div><aside class="kb-side">${side}</aside></div></article>`;
}
function sections(list) { return list.map(([h, t]) => `<section class="panel"><h2>${esc(h)}</h2><p>${esc(t)}</p></section>`).join(''); }
function numbers(n) { return n && n.length ? `<section class="panel kb-nums"><h2>Ключевые числа</h2><ul>${n.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''; }
function seq(list, i, href, title) {
  const prev = list[i - 1], next = list[i + 1];
  return `<nav class="kb-seq">${prev ? `<a href="${href(prev)}">← ${esc(title(prev))}</a>` : '<span></span>'}${next ? `<a href="${href(next)}">${esc(title(next))} →</a>` : ''}</nav>`;
}

function kbUnit(id) {
  const u = U[id], P = SeshatPlan.PLAN[id] || {}, st = STG[u.st], i = UNITS.indexOf(u);
  const eff = Object.entries(u.eff).filter(([, v]) => v > 0);
  const procs = KB.UNIT_PROC[id] || [];
  const inds = [...new Set(eff.map(([k]) => EFF_IND[k]).filter(Boolean))];
  const head = `${crumbs(['Сооружения очистки', '#kb-units'], [u.n])}
    <header class="kb-ahead" style="--c:${st.c}">${SeshatIcons.icon(id, 72, u.n)}<div><span class="gp-stage">${esc(st.n)}</span><h1>${esc(u.n)}</h1><p class="kb-lead">${esc(u.d)}</p></div></header>`;
  const main = `<section class="panel"><h2>Как работает</h2><p>${esc(P.how || '')}</p></section>
    ${P.params && P.params.length ? `<section class="panel"><h2>Типовые параметры</h2><ul>${P.params.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    <section class="panel"><h2>Что удаляет</h2>${eff.length ? `<ul class="kb-eff">${eff.map(([k, v]) => `<li><span>${EFF_NAME[k] || esc(PARAMS.find(p => p.k === k)?.n || k)}</span><b>${v}%</b></li>`).join('')}</ul><p class="hint">Типовые эффективности, принятые в расчётах Тласольтеотль. В карточке сооружения на плане их можно изменить.</p>` : '<p>Химический состав воды почти не меняет: сооружение нужно для защиты оборудования, выравнивания режима или обеззараживания.</p>'}</section>
    ${procs.length ? `<section class="panel"><h2>Какие процессы идут</h2><p class="kb-tags">${procs.map(procLink).join('')}</p></section>` : ''}
    ${seq(UNITS, i, x => '#kb-u-' + x.id, x => x.n)}`;
  const side = `<section class="panel"><h2>Затраты</h2><dl class="gp-dl"><dt>Электроэнергия</dt><dd>${fmt(u.en)} кВт·ч/м³</dd><dt>Капзатраты</dt><dd>≈ ${u.cx} млн ₽ на 10 000 м³/сут</dd>${u.cons ? `<dt>Расходники</dt><dd>${fmt(u.cons)} ₽/м³</dd>` : ''}</dl><p class="hint">Ориентиры для учебных расчётов.</p></section>
    ${inds.length ? `<section class="panel"><h2>Показатели</h2><ul class="kb-links">${inds.map(k => `<li><a href="#kb-i-${k}">${esc(IND_BY[k].t)}</a></li>`).join('')}</ul></section>` : ''}
    <section class="panel"><h2>Попробовать</h2><p>Добавьте сооружение на план и посмотрите, как оно меняет воду и затраты.</p><button type="button" class="primary" data-kbadd="${id}">Добавить в Тласольтеотль</button></section>`;
  kbRoot().innerHTML = article(head, main, side);
}
function kbProc(id) {
  const p = PROC_BY[id], i = KB.PROCESSES.indexOf(p);
  const units = Object.entries(KB.UNIT_PROC).filter(([, l]) => l.includes(id)).map(([u]) => u).filter(u => U[u]);
  const head = `${crumbs(['Физика и химия процессов', '#kb-proc'], [p.t])}<header class="kb-ahead"><div><span class="gp-stage">${esc(p.g)}</span><h1>${esc(p.t)}</h1><p class="kb-lead">${esc(p.lead)}</p></div></header>`;
  const main = `${p.f ? `<section class="panel"><h2>Уравнения</h2><div class="kb-f">${p.f.map(x => `<code>${esc(x)}</code>`).join('')}</div></section>` : ''}
    ${sections(p.s)}${seq(KB.PROCESSES, i, x => '#kb-p-' + x.id, x => x.t)}`;
  const side = `${numbers(p.n)}${units.length ? `<section class="panel"><h2>Где идёт</h2><div class="kb-units kb-units-col">${units.map(unitLink).join('')}</div></section>` : ''}`;
  kbRoot().innerHTML = article(head, main, side);
}
function kbInd(id) {
  const p = IND_BY[id], i = KB.INDICATORS.indexOf(p), par = p.k && PARAMS.find(x => x.k === p.k);
  const nv = p.k && state.norm[p.k], iv = p.k && state.c[p.k];
  const head = `${crumbs(['Показатели качества воды', '#kb-ind'], [p.t])}<header class="kb-ahead"><div><span class="gp-stage">${esc(p.u)}</span><h1>${esc(p.t)}</h1></div></header>`;
  const main = `${sections([['Что это', p.what], ['Почему важно', p.why], ['Как снижают', p.how]])}${seq(KB.INDICATORS, i, x => '#kb-i-' + x.id, x => x.t)}`;
  const side = `<section class="panel"><h2>Значения</h2><dl class="gp-dl"><dt>Городские стоки</dt><dd>${esc(p.typ)}</dd>${par ? `<dt>Ваши стоки</dt><dd>${fmt(iv)} ${esc(par.u)}</dd><dt>Ваш норматив</dt><dd>${nv == null || nv === '' ? 'не задан' : fmt(nv) + ' ' + esc(par.u)}</dd>` : ''}</dl>
      <p class="hint">Нормативы сброса — в документах <a href="#doc-pp1430">ПП № 1430</a> (НДТ) и <a href="#doc-pr296">приказе № 296</a> (рыбохозяйственные).</p></section>
    ${par ? '<section class="panel"><h2>В Тласольтеотль</h2><p>Этот показатель рассчитывается по ступеням схемы. Включите на плане режим «Качество», чтобы увидеть его в каждой трубе.</p><a class="btn" href="#constructor" data-go="constructor">Открыть план</a></section>' : ''}`;
  kbRoot().innerHTML = article(head, main, side);
}
function kbAux(id) {
  const a = AUX_BY[id];
  const head = `${crumbs(['Сооружения очистки', '#kb-units'], [a.t])}<header class="kb-ahead"><div><span class="gp-stage">Вспомогательное здание</span><h1>${esc(a.t)}</h1><p class="kb-lead">${esc(a.lead)}</p></div></header>`;
  kbRoot().innerHTML = article(head, sections(a.s), numbers(a.n) + (a.proc ? `<section class="panel"><h2>Процессы</h2><p class="kb-tags">${a.proc.map(procLink).join('')}</p></section>` : ''));
}

/* ---------- маршрут и события ---------- */
function renderKB(param) {
  const m = /^([a-z]+)(?:-([a-zA-Z0-9]+))?$/.exec(param || '');
  if (!m) return kbHome();
  const [, a, b] = m;
  if (a === 'u' && b && U[b]) return kbUnit(b);
  if (a === 'p' && PROC_BY[b]) return kbProc(b);
  if (a === 'i' && IND_BY[b]) return kbInd(b);
  if (a === 'a' && AUX_BY[b]) return kbAux(b);
  if (!b && KB_SECTIONS.some(s => s.id === a)) return kbSection(a);
  kbHome();
}
document.getElementById('kb-root').addEventListener('input', ev => { if (ev.target.id === 'kb-search') { kbUI.q = ev.target.value; kbResults(); } });
document.getElementById('kb-root').addEventListener('click', ev => {
  const b = ev.target.closest('[data-kbadd]'); if (!b) return;
  addUnit(b.dataset.kbadd); go('constructor');
});
VIEW_RENDER.kb = renderKB;
