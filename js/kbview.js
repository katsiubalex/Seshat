// База знаний. Общие разделы Сешат (фундаментальные дисциплины, гуманитарные аспекты, журналы, сообщества) — на главной,
// разделы модулей — внутри модулей: у каждого модуля свои учебники, у «Очистки сточных вод» ещё сооружения, процессы и показатели.
// Адреса: #kb — главная базы знаний этой страницы, #kb-<раздел> — раздел,
// #kb-u-<id> сооружение, #kb-p-<id> процесс, #kb-i-<id> показатель, #kb-a-<id> вспомогательное здание (очистка сточных вод),
// #kb-f-<id> фундаментальная дисциплина, #kb-h-<id> гуманитарная статья («Гуманитарные аспекты»). Чужие разделы core.js открывает у владельца.

const KB = SeshatKB;
const kbUI = { q: '' };
const KB_MODS = SeshatModules.MODULES, KB_MOD = KB_MODS.find(m => m.id === PAGE); // модуль этой страницы (на главной — нет)
// учебники модуля: подборка базы знаний + современные учебные издания (books.js), группы с одинаковым названием сливаются
const BK = window.SeshatBooks || { LINKS: {}, EXTRA: {}, FUND: {}, key: () => '' };
const booksOf = id => {
  // у «Основ» учебники — из статей их дисциплин
  if (['fundamentals', 'basics'].includes(id)) return KB.FUNDAMENTALS.filter(f => f.home === id).map(f => ({ d: f.t, list: [...f.books, ...(BK.FUND[f.id] || [])] }));
  if (id === 'humanities') return KB.HUMANITIES.filter(h => h.books.length).map(h => ({ d: h.t, list: [...h.books] }));
  const out = (KB.MODULE_BOOKS[id] || []).map(g => ({ d: g.d, list: [...g.list] }));
  (BK.EXTRA[id] || []).forEach(g => { const same = out.find(x => x.d === g.d); if (same) same.list.push(...g.list); else out.push({ d: g.d, list: [...g.list] }); });
  return out;
};
const nBooks = id => booksOf(id).reduce((s, b) => s + b.list.length, 0);
const KB_SECTIONS = [
  { id: 'units', t: 'Сооружения очистки', d: 'Как устроено и работает каждое из 40 сооружений, что оно удаляет и сколько стоит.', n: () => UNITS.length + KB.AUX.length },
  { id: 'proc', t: 'Физика и химия процессов', d: 'Осаждение, флотация, нитрификация, денитрификация, мембраны, обеззараживание — с уравнениями и ключевыми числами.', n: () => KB.PROCESSES.length },
  { id: 'ind', t: 'Показатели качества воды', d: 'Что означают БПК, ХПК, азот, фосфор и другие показатели, как их измеряют и почему они важны.', n: () => KB.INDICATORS.length },
  { id: 'books', t: 'Учебники', d: 'Учебники и справочники по дисциплинам модуля — российские и зарубежные.', n: () => nBooks(PAGE), unit: 'учебников' },
  { id: 'docs', t: 'Нормативные документы', d: 'Законы, правила, своды правил, санитарные нормы и справочники НДТ, которые относятся к модулю. Белые — общие для всего кластера «Водная инфраструктура».', n: () => docsOf(PAGE).length, unit: 'документов' },
  { id: 'fund', t: 'Основы', d: 'Фундаментальные дисциплины (математика, химия, микробиология, геология) и основы водоснабжения и водоотведения (гидравлика, насосы) — опора всех модулей.', n: () => KB.FUNDAMENTALS.length },
  { id: 'hum', t: 'Человек и вода', d: 'Гуманитарные аспекты водопользования: антропология и философия воды, история санитарии, вода как общее благо, этика инженера.', n: () => KB.HUMANITIES.length },
  { id: 'myth', t: 'Мифы о воде', d: 'Боги и герои древних культур, чья сфера созвучна модулям Сешат: история, образ, обряды и связь с инженерной дисциплиной.', n: () => (window.SeshatMyths ? SeshatMyths.GODS.length : 0) },
  { id: 'journals', t: 'Научные журналы', d: 'Российские и международные журналы, где публикуют исследования по воде.', n: () => KB.JOURNALS.reduce((s, b) => s + b.list.length, 0), unit: 'журналов' },
  { id: 'glossary', t: 'Глоссарий', d: 'Термины с определениями из законов, сводов правил и справочников НДТ — с номером статьи или пункта.', n: () => (window.SeshatGlossary ? SeshatGlossary.G.length : 0), unit: 'терминов' },
  { id: 'index', t: 'Указатель и поиск', d: 'Все статьи, термины и документы от А до Я и поиск по тексту всей базы знаний.', n: () => (typeof WL !== 'undefined' ? WL.ART.length : 0), unit: 'статей' },
  { id: 'comm', t: 'Профессиональные сообщества', d: 'Ассоциации и организации отрасли в России и мире: конференции, стандарты, обучение.', n: () => KB.COMMUNITIES.reduce((s, b) => s + b.list.length, 0), unit: 'организаций' }
];
const SEC = Object.fromEntries(KB_SECTIONS.map(s => [s.id, s]));
const UNIVERSAL = ['glossary', 'index', 'fund', 'hum', 'myth', 'journals', 'comm'];
// разделы модулей: учебники есть у всех, у «Очистки сточных вод» — ещё сооружения, процессы и показатели
const MODULE_KB = Object.fromEntries(KB_MODS.map(m => [m.id, m.id === 'tlazolteotl' ? ['units', 'proc', 'ind', 'books', 'docs'] : m.id === 'humanities' ? ['hum', 'myth', 'books'] : m.group === 'base' ? ['fund', 'books'] : ['books', 'docs']]));
// раздел «Основы» внутри модуля «Основ» — его статьи
const secOf = id => id === 'fund' && KB_MOD && KB_MOD.group === 'base' ? { id: 'fund', t: 'Статьи', d: 'Статьи по дисциплинам модуля: ключевые понятия, формулы и учебники.', n: () => fundOf(PAGE).length } : SEC[id];
const fundOf = id => KB.FUNDAMENTALS.filter(f => f.home === id);
const kbCount = id => (MODULE_KB[id] || []).reduce((n, s) => n + (s === 'books' ? nBooks(id) : s === 'docs' ? docsOf(id).length : s === 'fund' ? fundOf(id).length : SEC[s].n()), 0);
const PROC_BY = Object.fromEntries(KB.PROCESSES.map(p => [p.id, p]));
const IND_BY = Object.fromEntries(KB.INDICATORS.map(p => [p.id, p]));
const AUX_BY = Object.fromEntries(KB.AUX.map(p => [p.id, p]));
const FUND_BY = Object.fromEntries(KB.FUNDAMENTALS.map(p => [p.id, p]));
const HUM_BY = Object.fromEntries(KB.HUMANITIES.map(p => [p.id, p]));
const EFF_IND = { ss: 'ss', bod: 'bod', cod: 'cod', nh4: 'nh4', no2: 'no2', no3: 'no3', p: 'p', oil: 'oil', fat: 'fat', nit: 'nh4', den: 'no3', bioP: 'p' };
const EFF_NAME = { nit: 'нитрификация', den: 'денитрификация', bioP: 'биоудаление P' };
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е');
const kbRoot = () => document.getElementById('kb-root');
// Путь вверху, как в файловой системе: База знаний / Модуль / Раздел / Статья. «База знаний» ведёт в общую базу Сешат.
const crumbs = (...items) => {
  const path = [[`База знаний`, ROOT + '#kb']];
  if (KB_MOD) path.push([KB_MOD.n, '#kb']);
  items.forEach(x => path.push(x));
  const last = path.length - 1;
  return `<nav class="kb-crumbs" aria-label="Путь в базе знаний">${path.map(([t, h], i) => i === last || !h ? `<span aria-current="page">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a>`).join('<span class="kb-sep" aria-hidden="true">/</span>')}</nav>`;
};
const procLink = id => PROC_BY[id] ? `<a class="kb-tag" href="#kb-p-${id}">${esc(PROC_BY[id].t)}</a>` : '';
const unitLink = id => `<a class="kb-unit-link" href="#kb-u-${id}" style="--c:${STG[U[id].st].c}">${SeshatIcons.icon(id, 36)}<span>${esc(U[id].n)}${window.SeshatITS ? SeshatITS.badge(id) : ''}</span></a>`;
const modLink = id => { const m = KB_MODS.find(x => x.id === id); return m ? `<a class="kb-tag kind-${m.kind}" href="${ROOT + m.path}#kb">${SeshatModules.glyph(m.id, 16)} ${esc(m.n)}</a>` : ''; };
const ext = (t, u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;
// у каждого учебника — где его реально прочитать или купить; если нигде — поиск в каталоге РГБ
const LINK_KIND = { read: 'Читать', buy: 'Купить', ebs: 'ЭБС', used: 'Букинист', lib: 'Библиотека' };
const bookFind = (a, t, own) => {
  const links = own || BK.LINKS[BK.key(a, t)];
  if (links && links.length) return `<span class="kb-find">${links.map(([k, l, u]) => `<a class="bk-${k}" href="${esc(u)}" target="_blank" rel="noopener"><b>${LINK_KIND[k]}</b> ${esc(l)} ↗</a>`).join('')}</span>`;
  const q = encodeURIComponent(t + ' ' + a.split(',')[0]);
  return `<span class="kb-find"><span class="bk-none">Не переиздаётся, легальной копии нет — <a href="https://search.rsl.ru/ru/search#q=${q}" target="_blank" rel="noopener">найти в РГБ ↗</a></span></span>`;
};
const bookList = list => `<ol class="kb-books">${list.map(([a, t, pub, own]) => `<li><span class="kb-auth">${esc(a)}</span> <b>${esc(t)}</b>. <span class="kb-pub">${esc(pub)}</span> ${bookFind(a, t, own)}</li>`).join('')}</ol>`;

/* ---------- главная базы знаний: на главной Сешат и в каждом модуле ---------- */
const kbCard = (s, href) => `<a class="kb-card" href="${href || '#kb-' + s.id}"><b>${esc(s.t)}</b><span>${esc(s.d)}</span><small>${s.n()} ${s.unit || 'статей'}</small></a>`;
function kbHome() {
  const head = KB_MOD
    ? `${crumbs()}<header class="kb-head"><div><p class="lore-kicker">${esc(KB_MOD.n)} · ${esc(KB_MOD.d)}</p><h1>База знаний модуля</h1>
        <p class="sub">Статьи и учебники по дисциплине модуля. Общие разделы — фундаментальные дисциплины, гуманитарные аспекты, журналы и сообщества — в <a href="${ROOT}#kb">базе знаний Сешат</a>.</p></div></header>`
    : `${crumbs()}<header class="kb-head"><div><h1>База знаний Сешат</h1>
        <p class="sub">Общие разделы для всей платформы и базы знаний модулей: у каждого модуля — свои сооружения, процессы и учебники.</p></div></header>`;
  kbRoot().innerHTML = `${head}
    <input id="kb-search" type="search" class="lib-search kb-search" placeholder="${KB_MOD ? 'Найти в базе знаний модуля…' : 'Найти: «гидравлика», «нитрификация», «Остром», «мембран»…'}" aria-label="Поиск по базе знаний" value="${esc(kbUI.q)}">
    <div id="kb-results"></div>`;
  kbResults();
}
function kbResults() {
  const box = document.getElementById('kb-results'), q = norm(kbUI.q.trim());
  const own = KB_MOD ? MODULE_KB[PAGE] : [];
  if (!q) {
    if (!KB_MOD) {
      box.innerHTML = `<section class="kb-group"><h2>Общие разделы</h2><div class="kb-grid">${UNIVERSAL.map(id => kbCard(SEC[id])).join('')}</div></section>
        ${['water', 'base', 'related'].map(g => { const ms = KB_MODS.filter(m => m.group === g); return `<section class="kb-group kb-cluster"><h2>${esc(SeshatModules.GROUPS[g])}</h2>${g === 'water' ? '<p class="sub">Базы знаний модулей кластера по пути воды. В каждой — учебники и нормативные документы модуля; общие для всего кластера документы отмечены белым.</p>' : ''}<div class="kb-grid kb-mods">${ms.map(m =>
          `<a class="kb-card kb-mod kind-${m.kind}" href="${ROOT + m.path}#kb">${SeshatModules.glyph(m.id, 26)}<b>${esc(m.n)}</b><span>${esc(m.d)}</span><small>${kbCount(m.id)} ${m.id === 'tlazolteotl' ? 'статей, учебников и документов' : m.group === 'base' ? 'статей и учебников' : 'учебников и документов'}</small></a>`).join('')}</div></section>`; }).join('')}`;
      return;
    }
    const mine = `<section class="kb-group"><h2>Разделы модуля</h2><div class="kb-grid">${own.map(id => kbCard(secOf(id))).join('')}</div></section>`;
    const related = (KB_MOD.kb || []).map(h => { const p = PROC_BY[h.replace('kb-p-', '')]; return p ? `<li><a href="#${h}">${esc(p.t)}</a> <span class="hint">— из базы знаний модуля «Очистка сточных вод»</span></li>` : ''; }).join('');
    const fund = KB.FUNDAMENTALS.filter(f => f.mods.includes(PAGE));
    const start = PAGE === 'tlazolteotl' ? `<section class="panel kb-start"><h2>С чего начать</h2><ul class="kb-links">
        <li><a href="#kb-p-biooxidation">Как бактерии очищают воду</a> — основа всей биологической очистки.</li>
        <li><a href="#kb-p-nitrification">Нитрификация</a> и <a href="#kb-p-denitrification">денитрификация</a> — как удаляют азот.</li>
        <li><a href="#kb-i-bod">БПК₅</a> и <a href="#kb-i-cod">ХПК</a> — два главных показателя органики.</li>
        <li><a href="#kb-p-sedimentation">Осаждение</a> — почему отстойники считают по площади, а не по глубине.</li>
      </ul></section>` : `<section class="panel"><h2>Что появится здесь</h2><ul class="kb-links">${KB_MOD.will.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${related ? `<h2 class="kb-sub">Смежные статьи уже сейчас</h2><ul class="kb-links">${related}</ul>` : ''}</section>`;
    const base = fund.length ? `<section class="panel"><h2>Опора модуля — общие дисциплины</h2><p class="kb-tags">${fund.map(f => `<a class="kb-tag" href="#kb-f-${f.id}">${esc(f.t)}</a>`).join('')}</p></section>` : '';
    box.innerHTML = mine + start + base;
    return;
  }
  const stem = q.length > 5 ? q.slice(0, -2) : q, hit = t => norm(t).includes(stem);
  const res = [], all = !KB_MOD; // на главной Сешат ищем по всем модулям, в модуле — по своим разделам
  if (all || own.includes('units')) {
    UNITS.forEach(u => { const P = SeshatPlan.PLAN[u.id] || {}; if (hit(u.n + ' ' + u.d + ' ' + (P.how || ''))) res.push(['Сооружение', u.n, '#kb-u-' + u.id]); });
    KB.AUX.forEach(a => { if (hit(a.t + ' ' + a.lead + a.s.map(x => x.join(' ')).join(' '))) res.push(['Сооружение', a.t, '#kb-a-' + a.id]); });
  }
  if (KB_MOD) docsOf(PAGE).forEach(d => { if (hit(d.short + ' ' + d.title + ' ' + d.about)) res.push(['Документ', d.short + ' — ' + d.title, '#doc-' + d.id]); });
  if (all || own.includes('proc')) KB.PROCESSES.forEach(p => { if (hit(p.t + ' ' + p.lead + ' ' + p.s.map(x => x.join(' ')).join(' ') + (p.f || []).join(' '))) res.push(['Процесс', p.t, '#kb-p-' + p.id]); });
  if (all || own.includes('ind')) KB.INDICATORS.forEach(p => { if (hit([p.t, p.what, p.why, p.how].join(' '))) res.push(['Показатель', p.t, '#kb-i-' + p.id]); });
  (all ? KB_MODS.map(m => m.id) : [PAGE]).forEach(mid => booksOf(mid).forEach(b => b.list.forEach(([a, t]) => {
    if (hit(a + ' ' + t + ' ' + b.d)) res.push(['Учебник', `${a} ${t}`, mid === PAGE ? '#kb-books' : ROOT + KB_MODS.find(m => m.id === mid).path + '#kb-books']);
  })));
  if (all) {
    KB.FUNDAMENTALS.forEach(f => { if (hit(f.t + ' ' + f.lead + f.s.map(x => x.join(' ')).join(' ') + f.books.map(b => b.join(' ')).join(' '))) res.push(['Дисциплина', f.t, '#kb-f-' + f.id]); });
    KB.HUMANITIES.forEach(f => { if (hit(f.t + ' ' + f.lead + f.s.map(x => x.join(' ')).join(' ') + f.books.map(b => b.join(' ')).join(' '))) res.push(['Человек и вода', f.t, '#kb-h-' + f.id]); });
    KB.JOURNALS.forEach(b => b.list.forEach(([t, d]) => { if (hit(t + ' ' + d)) res.push(['Журнал', t, '#kb-journals']); }));
    KB.COMMUNITIES.forEach(b => b.list.forEach(([t, d]) => { if (hit(t + ' ' + d)) res.push(['Сообщество', t, '#kb-comm']); }));
  }
  box.innerHTML = res.length ? `<p class="hint">Найдено: ${res.length}</p><ul class="kb-res">${res.map(([k, t, h]) => `<li><a href="${h}"><small>${k}</small><span>${esc(t)}</span></a></li>`).join('')}</ul>`
    : `<div class="empty">Ничего не найдено по запросу «${esc(kbUI.q)}».</div>`;
}

/* ---------- разделы ---------- */
function kbSection(id) {
  const S = secOf(id);
  let body = '';
  if (id === 'units') {
    body = (window.SeshatITS ? `<p class="hint its-intro">Каталог сверен со справочником наилучших доступных технологий <a href="#doc-its10">ИТС 10-2019</a>. Значок у технологии показывает её статус: ${['ndt', 'group', 'psv', 'persp', 'old', 'none'].map(k => `<span class="its-badge its-${k}">${esc(SeshatITS.STATUS[k].t)}</span>`).join(' ')}</p>` : '') + STAGES.map(s => `<section class="kb-group"><h2><span class="dot" style="background:${s.c}"></span>${esc(s.n)}</h2><div class="kb-units">${UNITS.filter(u => u.st === s.id).map(u => unitLink(u.id)).join('')}</div></section>`).join('')
      + `<section class="kb-group"><h2><span class="dot" style="background:var(--muted)"></span>Вспомогательные здания</h2><ul class="kb-links">${KB.AUX.map(a => `<li><a href="#kb-a-${a.id}">${esc(a.t)}</a></li>`).join('')}</ul></section>`;
  } else if (id === 'proc') {
    const groups = [...new Set(KB.PROCESSES.map(p => p.g))];
    body = groups.map(g => `<section class="kb-group"><h2>${esc(g)}</h2><div class="kb-grid kb-grid-sm">${KB.PROCESSES.filter(p => p.g === g).map(p => `<a class="kb-card" href="#kb-p-${p.id}"><b>${esc(p.t)}</b><span>${esc(p.lead)}</span></a>`).join('')}</div></section>`).join('');
  } else if (id === 'ind') {
    body = `<div class="kb-grid kb-grid-sm">${KB.INDICATORS.map(p => `<a class="kb-card" href="#kb-i-${p.id}"><b>${esc(p.t)}</b><span>${esc(p.u)} · в городских стоках ${esc(p.typ)}</span></a>`).join('')}</div>`;
  } else if (id === 'books' && KB_MOD) {
    body = (booksOf(PAGE).length ? '' : '<div class="empty">Учебники модуля ещё подбираются.</div>') + booksOf(PAGE).map(b => `<section class="panel kb-group"><h2>${esc(b.d)}</h2>${bookList(b.list)}</section>`).join('')
      + `<p class="hint">Учебники по гидравлике, математике, химии воды и другим общим дисциплинам — в разделе <a href="${ROOT}#kb-fund">«Фундаментальные дисциплины»</a> базы знаний Сешат. Ссылки ведут в магазины, к издателям, в электронные библиотеки (по подписке) или к открытому тексту; классические книги, которые больше не издаются, — к букинистам.</p>`;
  } else if (id === 'books') { // на главной: учебники собраны по модулям
    body = `<p class="sub">Учебники теперь лежат в базах знаний модулей — у каждого своя дисциплина.</p><div class="kb-grid kb-mods">${KB_MODS.map(m => `<a class="kb-card kb-mod kind-${m.kind}" href="${ROOT + m.path}#kb-books">${SeshatModules.glyph(m.id, 26)}<b>${esc(m.n)}</b><span>${booksOf(m.id).map(b => esc(b.d)).join(' · ')}</span><small>${nBooks(m.id)} учебников</small></a>`).join('')}</div>`;
  } else if (id === 'docs' && KB_MOD) {
    body = `${DOC_LEGEND}<input id="docs-search" type="search" class="lib-search kb-search" placeholder="Найти: «НДТ», «ЗСО», «гидротехнические», «1430»…" aria-label="Поиск по документам модуля" value="${esc(kbUI.dq || '')}">
      <div id="docs-list">${docsListHTML(PAGE, kbUI.dq)}</div>
      <p class="hint docs-note">Перед использованием документа в работе проверьте его действующую редакцию: нормативные акты регулярно изменяются. Сроки действия и редакции проверены 22.10.2026.</p>`;
  } else if (id === 'fund' && KB_MOD) { // в «Основах»: статьи своих дисциплин
    body = `<div class="kb-grid kb-grid-sm">${fundOf(PAGE).map(x => `<a class="kb-card" href="${ROOT}#kb-f-${x.id}"><b>${esc(x.t)}</b><span>${esc(x.lead)}</span></a>`).join('')}</div>
      <p class="hint">Статьи общие для всех модулей и открываются в базе знаний Сешат. Новые статьи по дисциплинам модуля появятся по мере работы над курсами.</p>`;
  } else if (id === 'fund') {
    body = ['fundamentals', 'basics'].map(h => { const m = KB_MODS.find(x => x.id === h); return `<section class="kb-group"><h2><a href="${ROOT + m.path}">${esc(m.n)}</a></h2><div class="kb-grid kb-grid-sm">${fundOf(h).map(x => `<a class="kb-card" href="#kb-f-${x.id}"><b>${esc(x.t)}</b><span>${esc(x.lead)}</span></a>`).join('')}</div></section>`; }).join('');
  } else if (id === 'myth') {
    body = window.SeshatMyths ? `<div class="kb-grid kb-grid-sm">${SeshatMyths.GODS.map(g => `<a class="kb-card" href="#lore-${g.id}"><b>${esc(g.name)}</b><span>${esc(g.epithet)} · ${esc(g.culture)}</span><small>Созвучно: ${g.mods.map(([m]) => esc((KB_MODS.find(x => x.id === m) || {}).n || m)).join(', ')}</small></a>`).join('')}</div>` : '';
  } else if (id === 'hum') {
    const list = KB.HUMANITIES, p = 'h';
    body = `<div class="kb-grid kb-grid-sm">${list.map(x => `<a class="kb-card" href="#kb-${p}-${x.id}"><b>${esc(x.t)}</b><span>${esc(x.lead)}</span></a>`).join('')}</div>`;
  } else {
    const src = id === 'journals' ? KB.JOURNALS : KB.COMMUNITIES;
    body = src.map(b => `<section class="panel kb-group"><h2>${esc(b.g)}</h2><ul class="kb-ext">${b.list.map(([t, d, u]) => `<li>${ext(t, u)}<span>${esc(d)}</span></li>`).join('')}</ul></section>`).join('');
  }
  const d = id === 'books' && KB_MOD ? `Учебники и справочники по дисциплинам модуля ${KB_MOD.n}.` : S.d;
  kbRoot().innerHTML = `${crumbs([S.t])}<header class="kb-head"><div><h1>${esc(S.t)}</h1><p class="sub">${esc(d)}</p></div></header>${body}`;
}

/* ---------- статьи ---------- */
function article(head, main, side) {
  return `<article class="kb-article">${head}<div class="kb-layout"><div class="kb-main">${main}</div><aside class="kb-side">${side}</aside></div></article>`;
}
function sections(list) { return list.map(([h, t]) => `<section class="panel"><h2>${esc(h)}</h2><p>${esc(t)}</p></section>`).join(''); }
// раздел «Источники» из файла статьи: ссылки — как есть, остальное — текстом
const srcPanel = x => x.src && x.src.length ? `<section class="panel"><h2>Источники</h2><ul class="kb-links">${x.src.map(s => { const m = /^(.*?)(https?:\/\/\S+)\s*$/.exec(s); return `<li>${m ? `${esc(m[1].replace(/[\s—–-]+$/, '') || m[2])} <a href="${esc(m[2])}" target="_blank" rel="noopener">↗</a>` : esc(s)}</li>`; }).join('')}</ul></section>` : '';
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
    ${window.SeshatITS ? SeshatITS.section(id) : ''}
    ${P.params && P.params.length ? `<section class="panel"><h2>Типовые параметры</h2><ul>${P.params.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    <section class="panel"><h2>Что удаляет</h2>${eff.length ? `<ul class="kb-eff">${eff.map(([k, v]) => `<li><span>${EFF_NAME[k] || esc(PARAMS.find(p => p.k === k)?.n || k)}</span><b>${v}%</b></li>`).join('')}</ul><p class="hint">Типовые эффективности, принятые в расчётах конструктора очистки. В карточке сооружения на плане их можно изменить.</p>` : '<p>Химический состав воды почти не меняет: сооружение нужно для защиты оборудования, выравнивания режима или обеззараживания.</p>'}</section>
    ${procs.length ? `<section class="panel"><h2>Какие процессы идут</h2><p class="kb-tags">${procs.map(procLink).join('')}</p></section>` : ''}
    ${seq(UNITS, i, x => '#kb-u-' + x.id, x => x.n)}`;
  const side = `<section class="panel"><h2>Затраты</h2><dl class="gp-dl"><dt>Электроэнергия</dt><dd>${fmt(u.en)} кВт·ч/м³</dd><dt>Капзатраты</dt><dd>≈ ${u.cx} млн ₽ на 10 000 м³/сут</dd>${u.cons ? `<dt>Расходники</dt><dd>${fmt(u.cons)} ₽/м³</dd>` : ''}</dl><p class="hint">Ориентиры для учебных расчётов.</p></section>
    ${inds.length ? `<section class="panel"><h2>Показатели</h2><ul class="kb-links">${inds.map(k => `<li><a href="#kb-i-${k}">${esc(IND_BY[k].t)}</a></li>`).join('')}</ul></section>` : ''}
    <section class="panel"><h2>Попробовать</h2><p>Добавьте сооружение на план и посмотрите, как оно меняет воду и затраты.</p><button type="button" class="primary" data-kbadd="${id}">Добавить в конструктор</button></section>`;
  kbRoot().innerHTML = article(head, main, side);
}
function kbProc(id) {
  const p = PROC_BY[id], i = KB.PROCESSES.indexOf(p);
  const units = Object.entries(KB.UNIT_PROC).filter(([, l]) => l.includes(id)).map(([u]) => u).filter(u => U[u]);
  const head = `${crumbs(['Физика и химия процессов', '#kb-proc'], [p.t])}<header class="kb-ahead"><div><span class="gp-stage">${esc(p.g)}</span><h1>${esc(p.t)}</h1><p class="kb-lead">${esc(p.lead)}</p></div></header>`;
  const main = `${p.f ? `<section class="panel"><h2>Уравнения</h2><div class="kb-f">${p.f.map(x => `<code>${esc(x)}</code>`).join('')}</div></section>` : ''}
    ${sections(p.s)}${seq(KB.PROCESSES, i, x => '#kb-p-' + x.id, x => x.t)}`;
  const side = `${numbers(p.n)}${srcPanel(p)}${units.length ? `<section class="panel"><h2>Где идёт</h2><div class="kb-units kb-units-col">${units.map(unitLink).join('')}</div></section>` : ''}`;
  kbRoot().innerHTML = article(head, main, side);
}
// методики измерений показателя: обозначение, метод, для каких вод, где подтверждено
function methodsHTML(id) {
  const S = window.SeshatMethods; if (!S) return '';
  const list = S.M[id], fif = `<a href="${S.FIF[1]}" target="_blank" rel="noopener">${esc(S.FIF[0])} ↗</a>`;
  if (!list) return S.TODO[id] ? `<section class="panel"><h2>Как измеряют</h2><p class="hint">Методика для этого показателя ещё подбирается по проверенным источникам. Действующие методики — в ${fif}.</p></section>` : '';
  return `<section class="panel"><h2>Как измеряют</h2><ul class="mt-list">
    ${list.map(([n, m, w, src]) => `<li><b>${esc(n)}</b><span>${esc(m)}</span><small>Воды: ${esc(w)} · подтверждено: ${src.map(s => `<a href="${S.SRC[s][1]}" target="_blank" rel="noopener" title="${esc(S.SRC[s][0])}">${{ normacs: 'NormaCS', spmi: 'ЦКП СПГУ', muctr: 'ЦКП РХТУ', fsa: 'область аккредитации' }[s]} ↗</a>`).join(', ')}</small></li>`).join('')}
  </ul><p class="hint">Перед применением проверьте действующую редакцию методики в ${fif}. Для контроля сброса используют методики из области аккредитации лаборатории.</p></section>`;
}
function kbInd(id) {
  const p = IND_BY[id], i = KB.INDICATORS.indexOf(p), par = p.k && PARAMS.find(x => x.k === p.k);
  const nv = p.k && state.norm[p.k], iv = p.k && state.c[p.k];
  const head = `${crumbs(['Показатели качества воды', '#kb-ind'], [p.t])}<header class="kb-ahead"><div><span class="gp-stage">${esc(p.u)}</span><h1>${esc(p.t)}</h1></div></header>`;
  const main = `${sections([['Что это', p.what], ['Почему важно', p.why], ['Как снижают', p.how]])}${methodsHTML(p.id)}${seq(KB.INDICATORS, i, x => '#kb-i-' + x.id, x => x.t)}`;
  const side = `<section class="panel"><h2>Значения</h2><dl class="gp-dl"><dt>Городские стоки</dt><dd>${esc(p.typ)}</dd>${par ? `<dt>Ваши стоки</dt><dd>${fmt(iv)} ${esc(par.u)}</dd><dt>Ваш норматив</dt><dd>${nv == null || nv === '' ? 'не задан' : fmt(nv) + ' ' + esc(par.u)}</dd>` : ''}</dl>
      <p class="hint">Нормативы сброса — в документах <a href="#doc-pp1430">ПП № 1430</a> (НДТ) и <a href="#doc-pr296">приказе № 296</a> (рыбохозяйственные).</p></section>
    ${srcPanel(p)}${par ? '<section class="panel"><h2>В конструкторе</h2><p>Этот показатель рассчитывается по ступеням схемы. Включите на плане режим «Качество», чтобы увидеть его в каждой трубе.</p><a class="btn" href="#constructor" data-go="constructor">Открыть план</a></section>' : ''}`;
  kbRoot().innerHTML = article(head, main, side);
}
function kbAux(id) {
  const a = AUX_BY[id];
  const head = `${crumbs(['Сооружения очистки', '#kb-units'], [a.t])}<header class="kb-ahead"><div><span class="gp-stage">Вспомогательное здание</span><h1>${esc(a.t)}</h1><p class="kb-lead">${esc(a.lead)}</p></div></header>`;
  kbRoot().innerHTML = article(head, sections(a.s), numbers(a.n) + srcPanel(a) + (a.proc ? `<section class="panel"><h2>Процессы</h2><p class="kb-tags">${a.proc.map(procLink).join('')}</p></section>` : ''));
}

function kbFund(id, hum) {
  const list = hum ? KB.HUMANITIES : KB.FUNDAMENTALS, x = (hum ? HUM_BY : FUND_BY)[id], i = list.indexOf(x), pre = hum ? 'h' : 'f';
  const S = SEC[hum ? 'hum' : 'fund'];
  const head = `${crumbs([S.t, '#kb-' + S.id], [x.t])}<header class="kb-ahead"><div><span class="gp-stage">${esc(S.t)}</span><h1>${esc(x.t)}</h1><p class="kb-lead">${esc(x.lead)}</p></div></header>`;
  const main = `${x.f ? `<section class="panel"><h2>Ключевые формулы</h2><div class="kb-f">${x.f.map(v => `<code>${esc(v)}</code>`).join('')}</div></section>` : ''}${sections(x.s)}${seq(list, i, v => `#kb-${pre}-${v.id}`, v => v.t)}`;
  const fb = hum ? [] : BK.FUND[x.id] || [];
  const side = `${srcPanel(x)}${x.books.length ? `<section class="panel"><h2>${hum ? 'Почитать' : 'Учебники'}</h2>${bookList(x.books)}</section>` : ''}${fb.length ? `<section class="panel"><h2>Современные учебные издания</h2>${bookList(fb)}</section>` : ''}${x.mods ? `<section class="panel"><h2>Где пригодится</h2><p class="kb-tags">${x.mods.map(modLink).join('')}</p></section>` : ''}`;
  kbRoot().innerHTML = article(head, main, side);
}

/* ---------- нормативные документы модуля ---------- */
function kbDoc(id) {
  const d = DOCS_BY_ID[id];
  kbRoot().innerHTML = docPageHTML(id, crumbs([SEC.docs.t, '#kb-docs'], [d.short]));
  mountDocWidget(id);
}

/* ---------- маршрут и события ---------- */
function renderKB(param) {
  const m = /^([a-z]+)(?:-([a-zA-Z0-9-]+))?$/.exec(param || '');
  if (!m) return kbHome();
  const [, a, b] = m;
  if (a === 'u' && b && U[b]) return kbUnit(b);
  if (a === 'p' && PROC_BY[b]) return kbProc(b);
  if (a === 'i' && IND_BY[b]) return kbInd(b);
  if (a === 'a' && AUX_BY[b]) return kbAux(b);
  if (a === 'f' && FUND_BY[b]) return kbFund(b);
  if (a === 'h' && HUM_BY[b]) return kbFund(b, true);
  if (a === 'd' && b && DOCS_BY_ID[b]) return kbDoc(b);
  if (!b && SEC[a]) return kbSection(a);
  kbHome();
}
document.getElementById('kb-root').addEventListener('input', ev => {
  if (ev.target.id === 'kb-search') { kbUI.q = ev.target.value; kbResults(); }
  if (ev.target.id === 'docs-search') { kbUI.dq = ev.target.value; document.getElementById('docs-list').innerHTML = docsListHTML(PAGE, kbUI.dq); }
});
document.getElementById('kb-root').addEventListener('click', ev => {
  const b = ev.target.closest('[data-kbadd]'); if (!b) return;
  addUnit(b.dataset.kbadd); if (PAGE === 'tlazolteotl') go('constructor'); else location.href = pageUrl('tlazolteotl', 'constructor');
});
// база знаний модуля окрашена в цвет модуля
if (KB_MOD) kbRoot().classList.add('kb-themed', 'kind-' + KB_MOD.kind);
VIEW_RENDER.kb = renderKB;
