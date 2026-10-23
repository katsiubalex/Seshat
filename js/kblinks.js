// Связность базы знаний, как в Википедии: термины в тексте статей становятся ссылками на соответствующие статьи,
// у каждой статьи есть блок «Где упоминается» (обратные ссылки), а в общей базе — алфавитный указатель всех статей.
// Цвет ссылки показывает, к чему относится статья (вид воды модуля, весь кластер или общие разделы), подпись — её тип.
// Подключается после kbview.js и docsview.js.

const WL = (() => {
  const MODS = SeshatModules.MODULES, KIND_OF = Object.fromEntries(MODS.map(m => [m.id, m.kind]));
  const TYPES = { u: 'Сооружение', p: 'Процесс', i: 'Показатель', d: 'Документ', f: 'Дисциплина', h: 'Человек и вода', y: 'Миф о воде', n: 'Расчёт сети', m: 'Модуль', a: 'Здание', g: 'Термин', k: 'Курс' };
  // тип статьи — значком (цвет занят принадлежностью)
  const ICON = {
    u: '<path d="M2 5h12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M2 8.5c2-1 4 1 6 0s4-1 6 0"/>',
    p: '<path d="M13 6a5 5 0 0 0-9.3-1.5M3 10a5 5 0 0 0 9.3 1.5"/><path d="M13 2.5V6H9.5M3 13.5V10h3.5"/>',
    i: '<path d="M6 2h4M6.5 2v4.5L3 13a1 1 0 0 0 .9 1.5h8.2A1 1 0 0 0 13 13L9.5 6.5V2"/>',
    d: '<path d="M4 1.5h5.5L12.5 4.5v10h-8.5z"/><path d="M9.5 1.5v3h3M6.5 8.5h4M6.5 11h4"/>',
    f: '<path d="M2 3c2-1 4-1 6 .5 2-1.5 4-1.5 6-.5v10c-2-1-4-1-6 .5-2-1.5-4-1.5-6-.5z"/><path d="M8 3.5v10"/>',
    h: '<circle cx="8" cy="4.5" r="2.5"/><path d="M3 14c0-3 2.2-5 5-5s5 2 5 5"/>',
    n: '<circle cx="3" cy="4" r="1.6"/><circle cx="13" cy="4" r="1.6"/><circle cx="3" cy="12" r="1.6"/><circle cx="13" cy="12" r="1.6"/><path d="M4.6 4h6.8M4.6 12h6.8M3 5.6v4.8M13 5.6v4.8"/>',
    y: '<path d="M8 1.5l1.8 4 4.2.4-3.2 2.8 1 4.3L8 10.8 4.2 13l1-4.3L2 5.9l4.2-.4z"/>',
    m: '<path d="M8 1.5c2.5 3.5 4.5 6 4.5 8.5a4.5 4.5 0 0 1-9 0c0-2.5 2-5 4.5-8.5z"/>',
    a: '<path d="M2 14.5h12M3.5 14.5V6l4.5-3.5L12.5 6v8.5"/><path d="M6.5 14.5v-4h3v4"/>',
    g: '<path d="M2.5 13l3-9 3 9M3.6 10h3.8"/><path d="M10 9.5h3.5M10 12.5h3.5"/>',
    k: '<rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M6.5 6v4l3.5-2z"/>'
  };
  const icon = type => `<svg class="wl-ico" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[type] || ''}</svg>`;
  // принадлежность: kind-* (вид воды модуля), cluster (весь кластер), multi (несколько видов), common (общие разделы)
  const docBelong = d => { if (d.mods === 'all') return 'cluster'; const k = [...new Set(d.mods.map(m => KIND_OF[m]))]; return k.length === 1 ? 'kind-' + k[0] : 'multi'; };

  /* ---------- словарь терминов ---------- */
  // Основа слова: срезаем окончание и разрешаем любые окончания (падежи и числа)
  const stemWord = w => {
    if (w.length < 4 || /[^а-яё-]/i.test(w)) return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return w.replace(/[аяоеыиуюйьё]{1,2}$/i, '') + (w.length < 5 ? '[а-яё]{0,2}' : '[а-яё]{0,4}'); // короткие слова — только короткие окончания (жиры ≠ жирные)
  };
  const pat = phrase => phrase.split(/\s+/).map(stemWord).join('\\s+');
  const T = []; // [регулярное выражение, адрес, тип, принадлежность, заголовок]
  const add = (phrases, href, type, belong, title) => phrases.forEach(ph => T.push({ src: pat(ph), len: ph.length, href, type, belong, title }));

  // сооружения (база знаний модуля «Очистка сточных вод» — водоотведение)
  const U_SYN = {
    coarse: ['решётки грубой очистки'], screens: ['тонкие решётки', 'ступенчатые решётки'], drum: ['барабанные сита', 'барабанное сито'],
    sand: ['аэрируемые песколовки', 'аэрируемая песколовка'], sandv: ['тангенциальные песколовки', 'вихревые песколовки'], grease: ['жироуловитель', 'нефтеловушка'],
    equal: ['усреднитель'], primary: ['первичные отстойники', 'первичный отстойник', 'первичное отстаивание'], lamella: ['тонкослойные отстойники', 'ламельные отстойники'],
    daf: ['напорная флотация'], coag: ['реагентное осветление'], at: ['аэротенк'], oxid: ['окислительный канал', 'окислительные каналы'],
    mle: ['нитри-денитрификация', 'процесс Лудзака—Эттингера', 'МЛЭ'], a2o: ['A²/O', 'A2/O', 'UCT', 'MUCT'], bardenpho: ['Bardenpho'], sbr: ['SBR', 'циклические реакторы'],
    mbbr: ['МББР', 'плавающая загрузка', 'плавающей загрузкой'], ifas: ['IFAS'], ags: ['гранулированный ил'], mbr: ['мембранный биореактор', 'мембранные биореакторы', 'МБР'],
    tf: ['капельный биофильтр', 'капельные биофильтры', 'незатопленные биофильтры'], baf: ['затопленные биофильтры', 'затопленный биофильтр', 'BAF'], uasb: ['UASB'],
    wetland: ['биоплато', 'фитоочистные системы'], chemP: ['реагентная дефосфатация', 'химическое удаление фосфора'], denf: ['денитрифицирующие фильтры'],
    filter: ['зернистые фильтры', 'песчаные фильтры'], nitf: ['биофильтры доочистки'], disc: ['дисковые фильтры'], uf: ['ультрафильтрация', 'ультрафильтрационные мембраны'],
    gac: ['активированный уголь', 'активный уголь'], ozone: ['озонирование'], aop: ['усовершенствованное окисление'], ix: ['ионообменные смолы'], ro: ['обратный осмос'],
    hypo: ['гипохлорит натрия', 'хлорирование'], uv: ['УФ-обеззараживание', 'ультрафиолет'], strip: ['аммиачная отдувка'], neutral: ['нейтрализация стоков'], anammox: []
  };
  SeshatData.UNITS.forEach(u => add(U_SYN[u.id] || [u.n.split(' (')[0]], '#kb-u-' + u.id, 'u', 'kind-waste', u.n));
  // процессы
  const P_SYN = {
    screening: ['процеживание'], sedimentation: ['осаждение', 'отстаивание', 'седиментация'], flotation: ['флотация'], coagulation: ['коагуляция', 'флокуляция', 'коагулянт', 'флокулянт'],
    filtration: ['фильтрование', 'фильтрация'], equalization: ['усреднение'], neutralization: ['щёлочность', 'нейтрализация'], aeration: ['аэрация', 'перенос кислорода'],
    biooxidation: ['биологическое окисление', 'активный ил', 'активного ила'], nitrification: ['нитрификация', 'нитрификаторы'], denitrification: ['денитрификация', 'денитрификаторы'],
    biop: ['биологическое удаление фосфора', 'фосфат-аккумулирующие бактерии', 'ФАО'], chemp: ['реагентное удаление фосфора'], anaerobic: ['анаэробное сбраживание', 'метантенк', 'метантенки', 'биогаз'],
    anammox: ['анаммокс', 'АНАММОКС', 'деаммонификация'], adsorption: ['адсорбция', 'сорбция'], membranes: ['мембранное разделение', 'мембранное илоразделение'], ionexchange: ['ионный обмен'],
    aop: ['окислительные процессы'], disinfection: ['обеззараживание'], stripping: ['отдувка аммиака'], sludge: ['обработка осадка', 'обезвоживание осадка', 'избыточный ил', 'избыточный активный ил']
  };
  SeshatKB.PROCESSES.forEach(p => add(P_SYN[p.id] || [p.t], '#kb-p-' + p.id, 'p', 'kind-waste', p.t));
  // показатели
  const I_SYN = {
    ss: ['взвешенные вещества', 'взвесь'], bod: ['БПК₅', 'БПК5', 'БПК'], cod: ['ХПК'], nh4: ['аммонийный азот', 'азот аммонийный', 'аммоний'], no2: ['азот нитритов', 'нитриты'],
    no3: ['азот нитратов', 'нитраты'], p: ['фосфор фосфатов', 'фосфаты'], oil: ['нефтепродукты'], fat: ['жиры'], tn: ['общий азот'], tp: ['общий фосфор'], do: ['растворённый кислород', 'растворенный кислород'],
    ph: ['pH'], alk: [], temp: [], tds: ['сухой остаток', 'солесодержание'], coli: ['микробиологические показатели', 'колиформные бактерии'], svi: ['иловый индекс', 'доза ила']
  };
  SeshatKB.INDICATORS.forEach(p => add(I_SYN[p.id] || [], '#kb-i-' + p.id, 'i', 'kind-waste', p.t));
  // документы
  const D_SYN = {
    fz416: ['416-ФЗ'], fz7: ['7-ФЗ'], vk74: ['Водный кодекс'], its10: ['ИТС 10-2019', 'ИТС 10', 'справочник НДТ', 'справочника НДТ'], pp1430: ['постановление № 1430', 'постановлением № 1430', 'ПП № 1430', '№ 1430'],
    pp1379: ['постановление № 1379', 'ПП № 1379', '№ 1379'], its8: ['ИТС 8-2022', 'ИТС 8'], sp32: ['СП 32.13330.2018', 'СП 32.13330', 'СП 32'], sanpin1200: ['СанПиН 2.2.1/2.1.1.1200-03', '1200-03'],
    pr296: ['приказ № 296', 'приказу № 296', 'приказа № 296'], sanpin3685: ['СанПиН 1.2.3685-21', 'СанПиН 1.2.3685'], sanpin3684: ['СанПиН 2.1.3684-21', 'СанПиН 2.1.3684'], pp644: ['ПП № 644', 'постановление № 644'],
    fz117: ['117-ФЗ'], pp883: ['ПП № 883'], pp1391: ['ПП № 1391'], pr1118: ['приказ № 1118', '№ 1118'], sp529: ['СП 529.1325800.2023', 'СП 529'], sp58: ['СП 58.13330.2019', 'СП 58'],
    sp104: ['СП 104.13330.2016', 'СП 104'], sp31: ['СП 31.13330.2021', 'СП 31'], sp8: ['СП 8.13130.2020', 'СП 8.13130'], sanpin1110: ['СанПиН 2.1.4.1110-02', '1110-02'], fz384: ['384-ФЗ'], fz52: ['52-ФЗ'], fz89: ['89-ФЗ'], pp636: ['ПП № 636'], gost59024: ['ГОСТ Р 59024-2020', 'ГОСТ Р 59024']
  };
  // для номеров документов основу не ищем — только точное написание
  SeshatDocs.DOCS.forEach(d => (D_SYN[d.id] || [d.short]).forEach(s => T.push({ src: s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), len: s.length, href: '#doc-' + d.id, type: 'd', belong: docBelong(d), title: d.short + ' — ' + d.title })));
  // общие дисциплины и гуманитарные статьи
  const F_SYN = { hydraulics: ['гидравлика', 'гидравлический расчёт'], math: ['математическая статистика'], chemistry: ['химия воды'], microbiology: ['микробиология'], geotech: ['инженерная геология', 'механика грунтов'], pumps: ['насосные станции'] };
  SeshatKB.FUNDAMENTALS.forEach(f => add(F_SYN[f.id] || [f.t], ROOT + '#kb-f-' + f.id, 'f', 'common', f.t));
  // расчёт водопроводной сети (база знаний «Сетей водоснабжения»)
  const N_SYN = { ring: ['кольцевая сеть', 'кольцевые сети', 'тупиковая сеть'], demand: ['расчётный расход', 'коэффициент часовой неравномерности'], nodal: ['удельный расход', 'узловой расход', 'путевой расход'],
    headloss: ['гидравлический уклон', 'формулы Шевелёва', 'таблицы Шевелёва'], loops: ['увязка колец', 'увязку колец', 'невязка'], heads: ['свободный напор', 'пьезометрическая линия'], fire: ['пожарный расход', 'наружное пожаротушение'] };
  SeshatKB.NETWORK.forEach(p => add(N_SYN[p.id] || [p.t], ROOT + 'juturna/#kb-n-' + p.id, 'n', 'kind-supply', p.t));
  SeshatKB.HUMANITIES.forEach(h => add({ anthropology: ['антропология воды'], philosophy: ['философия воды'], history: ['история санитарии'], commons: ['общее благо'], ethics: ['этика инженера'] }[h.id] || [h.t], ROOT + '#kb-h-' + h.id, 'h', 'common', h.t));
  // термины глоссария (определения из нормативных документов)
  const GL = (window.SeshatGlossary || { G: [] }).G, DOC_BY = Object.fromEntries(SeshatDocs.DOCS.map(d => [d.id, d]));
  const glBelong = g => DOC_BY[g.src] ? docBelong(DOC_BY[g.src]) : 'common';
  GL.forEach(g => add([g.t.replace(/\s*\(.*?\)\s*/g, ' ').trim(), ...((g.t.match(/\(([А-ЯЁA-Z]{2,})\)/) || []).slice(1))], ROOT + '#kb-g-' + g.id, 'g', glBelong(g), g.t));
  // мифы о воде: имена богов и героев ведут к статьям «Гуманитарных аспектов» (модули называются по предмету — их названия не связываем, слишком частые слова)
  const MY = window.SeshatMyths ? SeshatMyths.GODS : [];
  MY.forEach(g => add(g.id === 'yu' ? ['Ю Великий', 'Великий Ю'] : [g.name], ROOT + 'humanities/#lore-' + g.id, 'y', 'common', g.name + ' — ' + g.epithet[0].toLowerCase() + g.epithet.slice(1)));
  // длинные термины проверяем раньше коротких
  T.sort((a, b) => b.len - a.len);
  const B = '(?<![а-яёa-z0-9₀-₉])', E = '(?![а-яёa-z0-9])';
  T.forEach(t => { t.re = new RegExp(B + '(' + t.src + ')' + E, 'iu'); });

  /* ---------- превращение терминов в ссылки ---------- */
  const SKIP = 'a,button,code,h1,h2,h3,input,select,textarea,sup,.kb-crumbs,.doc-id,.its-badge,.its-ndt,.kb-tag,.kb-tags,.gp-dl dt,.its-refs,.doc-links,.doc-rel,.sc,.kb-f';
  const norm = h => h.replace(/^.*?(#|$)/, '#');
  function wikify(rootEl, selfHref, used = new Set()) {
    if (!rootEl) return;
    const self = selfHref ? norm(selfHref) : null;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: n => !n.nodeValue.trim() || n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let text = node.nodeValue, frag = null, pos = 0;
      for (;;) {
        // ближайшее вхождение ещё не использованного термина
        let best = null;
        for (const t of T) {
          if (used.has(t.href) || norm(t.href) === self) continue;
          const m = t.re.exec(text.slice(pos)); if (!m) continue;
          const at = pos + m.index;
          if (!best || at < best.at || (at === best.at && m[1].length > best.len)) best = { t, at, len: m[1].length };
        }
        if (!best) break;
        frag = frag || document.createDocumentFragment();
        frag.append(text.slice(pos, best.at));
        const a = document.createElement('a');
        a.href = best.t.href; a.className = `wl wl-${best.t.type} wb-${best.t.belong}`; a.title = `${TYPES[best.t.type]}: ${best.t.title}`;
        a.textContent = text.substr(best.at, best.len);
        frag.append(a); used.add(best.t.href); pos = best.at + best.len;
      }
      if (frag) { frag.append(text.slice(pos)); node.replaceWith(frag); }
    }
  }

  /* ---------- корпус статей: для обратных ссылок и указателя ---------- */
  const P = SeshatPlan.PLAN, ITS = window.SeshatITS;
  const ART = [];
  SeshatData.UNITS.forEach(u => ART.push({ href: '#kb-u-' + u.id, type: 'u', belong: 'kind-waste', t: u.n, text: [u.d, (P[u.id] || {}).how, ...((P[u.id] || {}).params || []), ...(ITS && ITS.UNITS[u.id] ? ITS.UNITS[u.id].sum.map(x => x[0]) : [])].join(' ') }));
  SeshatKB.AUX.forEach(a => ART.push({ href: '#kb-a-' + a.id, type: 'a', belong: 'kind-waste', t: a.t, text: [a.lead, ...a.s.map(x => x[1])].join(' ') }));
  SeshatKB.PROCESSES.forEach(p => ART.push({ href: '#kb-p-' + p.id, type: 'p', belong: 'kind-waste', t: p.t, text: [p.lead, ...p.s.map(x => x[1]), ...(p.n || [])].join(' ') }));
  SeshatKB.INDICATORS.forEach(p => ART.push({ href: '#kb-i-' + p.id, type: 'i', belong: 'kind-waste', t: p.t, text: [p.what, p.why, p.how].join(' ') }));
  SeshatDocs.DOCS.forEach(d => ART.push({ href: '#doc-' + d.id, type: 'd', belong: docBelong(d), t: d.short + ' — ' + d.title, text: [d.about, ...d.points, d.seshat].join(' ') }));
  SeshatKB.FUNDAMENTALS.forEach(f => ART.push({ href: ROOT + '#kb-f-' + f.id, type: 'f', belong: 'common', t: f.t, text: [f.lead, ...f.s.map(x => x[1])].join(' ') }));
  const CRS = (window.SeshatCourses || { C: [] }).C;
  const kindBelong = mods => { const k = [...new Set(mods.map(m => KIND_OF[m]))]; return k.length === 1 ? 'kind-' + k[0] : 'multi'; };
  CRS.forEach(c => ART.push({ href: ROOT + MODS.find(m => m.id === c.mods[0]).path + '#course-' + c.id, type: 'k', belong: kindBelong(c.mods), t: c.t, text: [c.lead, ...c.out, ...c.L.map(l => l[0] + '. ' + l[1])].join(' ') }));
  // в каких курсах статья — материал к уроку
  function coursePanel(href) {
    const h = norm(href), list = CRS.filter(c => c.L.some(l => l[2].some(x => norm(x.split('@')[0]) === h)));
    if (!list.length) return '';
    return `<section class="panel wl-back"><h2>В курсах</h2><ul class="wl-list">${list.map(c => { const ls = c.L.map((l, i) => l[2].some(x => norm(x.split('@')[0]) === h) ? i + 1 : 0).filter(Boolean);
      return `<li>${chip('k', kindBelong(c.mods))}<a href="${ROOT + MODS.find(m => m.id === c.mods[0]).path}#course-${c.id}">${esc(c.t)}</a> <small class="hint">урок ${ls.join(', ')}</small></li>`; }).join('')}</ul></section>`;
  }
  GL.forEach(g => ART.push({ href: ROOT + '#kb-g-' + g.id, type: 'g', belong: glBelong(g), t: g.t, text: g.def }));
  SeshatKB.HUMANITIES.forEach(h => ART.push({ href: ROOT + '#kb-h-' + h.id, type: 'h', belong: 'common', t: h.t, text: [h.lead, ...h.s.map(x => x[1])].join(' ') }));
  SeshatKB.NETWORK.forEach(p => ART.push({ href: ROOT + 'juturna/#kb-n-' + p.id, type: 'n', belong: 'kind-supply', t: p.t, text: [p.lead, ...p.s.map(x => x[1]), ...(p.n || [])].join(' ') }));
  MY.forEach(g => ART.push({ href: ROOT + 'humanities/#lore-' + g.id, type: 'y', belong: 'common', t: g.name, text: [g.legend, g.lead, ...g.chapters.flatMap(c => c.p)].join(' ') }));
  const termsFor = href => T.filter(t => norm(t.href) === norm(href));
  const backlinks = href => { const ts = termsFor(href); return ts.length ? ART.filter(a => norm(a.href) !== norm(href) && ts.some(t => t.re.test(a.text))) : []; };
  const chip = (type, belong) => `<span class="wl-type wb-${belong}" title="${TYPES[type]}">${icon(type)}${TYPES[type]}</span>`;
  const linkItem = a => `<li>${chip(a.type, a.belong)}<a href="${a.href}">${esc(a.t)}</a></li>`;
  function backPanel(href) {
    const list = backlinks(href); if (!list.length) return '';
    const order = ['u', 'p', 'i', 'n', 'd', 'g', 'k', 'f', 'h', 'y', 'a'];
    list.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.t.localeCompare(b.t, 'ru'));
    return `<section class="panel wl-back"><h2>Где упоминается</h2><ul class="wl-list">${list.slice(0, 18).map(linkItem).join('')}</ul>${list.length > 18 ? `<p class="hint">и ещё ${list.length - 18}</p>` : ''}</section>`;
  }

  /* ---------- указатель статей от А до Я ---------- */
  function indexHTML(q) {
    const qq = (q || '').toLowerCase().replace(/ё/g, 'е');
    const all = ART.concat(MODS.map(m => ({ href: ROOT + m.path, type: 'm', belong: 'kind-' + m.kind, t: m.n + ' — ' + m.d, text: '' })))
      .filter(a => !qq || a.t.toLowerCase().replace(/ё/g, 'е').includes(qq)).sort((a, b) => a.t.localeCompare(b.t, 'ru'));
    // кириллица — по буквам, латиница и цифры — двумя общими группами в конце
    const key = a => { const c = a.t[0].toUpperCase(); return /[А-ЯЁ]/.test(c) ? c : /[0-9]/.test(c) ? '0–9' : 'A–Z'; };
    const letters = [...new Set(all.map(key))].sort((x, y) => (x.length > 1) - (y.length > 1) || (x === '0–9') - (y === '0–9') || x.localeCompare(y, 'ru'));
    return `<nav class="wl-letters">${letters.map(l => `<a href="#wl-${encodeURIComponent(l)}" data-letter="${esc(l)}">${esc(l)}</a>`).join('')}</nav>
      ${letters.map(l => `<section class="wl-sec" id="wl-${encodeURIComponent(l)}"><h2>${esc(l)}</h2><ul class="wl-list wl-cols">${all.filter(a => key(a) === l).map(linkItem).join('')}</ul></section>`).join('')}
      <p class="hint">${all.length} статей и документов.</p>`;
  }

  /* ---------- поиск по тексту всей базы знаний ---------- */
  const low = s => s.toLowerCase().replace(/ё/g, 'е');
  function searchHTML(q) {
    const words = low(q).split(/\s+/).filter(w => w.length > 1); if (!words.length) return '';
    const res = [];
    ART.forEach(a => {
      const tl = low(a.t), xl = low(a.text || '');
      if (!words.every(w => tl.includes(w) || xl.includes(w))) return;
      const score = words.reduce((s, w) => s + (tl.includes(w) ? 10 : 0) + (xl.split(w).length - 1), 0);
      const at = Math.max(0, xl.indexOf(words[0]) - 60), raw = (a.text || '').slice(at, at + 200);
      res.push({ a, score, snip: (at ? '…' : '') + esc(raw).replace(new RegExp('(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark>$1</mark>') + (raw.length >= 200 ? '…' : '') });
    });
    res.sort((x, y) => y.score - x.score);
    if (!res.length) return `<div class="empty">В тексте базы знаний ничего не найдено по запросу «${esc(q)}».</div>`;
    return `<section class="wl-sec"><h2>Найдено в тексте: ${res.length}</h2><ul class="wl-hits">${res.slice(0, 40).map(r => `<li>${chip(r.a.type, r.a.belong)}<a href="${r.a.href}">${esc(r.a.t)}</a>${r.snip ? `<p>${r.snip}</p>` : ''}</li>`).join('')}</ul></section>`;
  }

  /* ---------- глоссарий ---------- */
  function glossaryHTML(q) {
    const qq = low(q || '');
    const list = GL.filter(g => !qq || low(g.t + ' ' + g.def).includes(qq)).sort((a, b) => a.t.localeCompare(b.t, 'ru'));
    if (!list.length) return `<div class="empty">Нет терминов по запросу «${esc(q)}».</div>`;
    return `<dl class="gl-list">${list.map(g => { const d = DOC_BY[g.src];
      return `<div class="gl-item wb-${glBelong(g)}" id="gl-${g.id}"><dt>${esc(g.t)}</dt><dd><p>${g.q ? '«' + esc(g.def) + '»' : esc(g.def)}</p>
        <p class="gl-src">${g.q ? 'Цитата' : 'Изложение'} · ${d ? `<a href="#doc-${d.id}">${esc(d.short)}</a>` : ''}, ${esc(g.ref)}</p></dd></div>`; }).join('')}</dl>
      <p class="hint">${list.length} терминов. «Цитата» — дословно из документа, «Изложение» — кратко, точная формулировка в документе.</p>`;
  }

  const LEGEND = `<div class="wl-legend"><b>Как читать ссылки</b>
    <span><i class="wb-cluster"></i>весь кластер «Водная инфраструктура»</span><span><i class="wb-kind-nature"></i>природная вода</span><span><i class="wb-kind-supply"></i>водоснабжение</span><span><i class="wb-kind-waste"></i>водоотведение</span><span><i class="wb-multi"></i>несколько видов воды</span><span><i class="wb-common"></i>общие разделы Сешат</span>
    <small>Цвет — к чему относится статья. Тип — значком: ${['u', 'p', 'i', 'n', 'd', 'g', 'k', 'f'].map(k => `<span class="wl-ti">${icon(k)}${TYPES[k].toLowerCase()}</span>`).join(' ')}.</small></div>`;

  return { wikify, backPanel, coursePanel, indexHTML, searchHTML, glossaryHTML, LEGEND, T, ART, GL, backlinks, icon };
})();

/* ---------- встраивание в базу знаний ---------- */
(function () {
  const render = VIEW_RENDER.kb;
  VIEW_RENDER.kb = param => {
    if (param === 'index') { // указатель и поиск по всей базе — раздел общей базы знаний
      kbRoot().innerHTML = `${crumbs(['Указатель и поиск'])}<header class="kb-head"><div><h1>Указатель и поиск</h1><p class="sub">Все статьи, термины и документы базы знаний от А до Я. Поиск ищет и в заголовках, и в тексте статей всех модулей.</p></div></header>
        ${WL.LEGEND}<input id="wl-q" type="search" class="lib-search kb-search" placeholder="Найти во всей базе знаний: термин, сооружение, документ…" aria-label="Найти во всей базе знаний"><div id="wl-index">${WL.indexHTML('')}</div>`;
      return;
    }
    if (param === 'glossary' || /^g-/.test(param || '')) { // глоссарий: термины с определениями из норм
      kbRoot().innerHTML = `${crumbs(['Глоссарий'])}<header class="kb-head"><div><h1>Глоссарий</h1><p class="sub">Термины с определениями из законов, сводов правил и справочников НДТ — с номером статьи или пункта.</p></div></header>
        <input id="gl-q" type="search" class="lib-search kb-search" placeholder="Найти термин…" aria-label="Найти термин"><div id="gl-box">${WL.glossaryHTML('')}</div>`;
      const el = param !== 'glossary' && document.getElementById('gl-' + param.slice(2));
      if (el) { el.classList.add('on'); requestAnimationFrame(() => el.scrollIntoView({ block: 'center' })); }
      return;
    }
    render(param);
    const root = kbRoot(), m = /^([a-z])-(.+)$/.exec(param || '');
    if (!m) { // главная и разделы: легенда и вход в указатель
      const head = root.querySelector('.kb-head');
      if (head && !param) head.insertAdjacentHTML('afterend', WL.LEGEND + `<p class="wl-goindex"><a href="${ROOT}#kb-index">Указатель и поиск по всей базе знаний →</a></p>`);
      return;
    }
    const self = m[1] === 'd' ? '#doc-' + m[2] : m[1] === 'f' || m[1] === 'h' ? ROOT + '#kb-' + param : '#kb-' + param;
    const used = new Set(); // каждый термин — одна ссылка на статью: сначала во вводной части, потом в основном тексте
    WL.wikify(root.querySelector('.kb-lead, .doc-lead'), self, used);
    WL.wikify(root.querySelector('.kb-main, .doc-main'), self, used);
    const side = root.querySelector('.kb-side, .doc-side');
    if (side) side.insertAdjacentHTML('beforeend', (m[1] === 'k' ? '' : WL.coursePanel(self)) + WL.backPanel(self));
  };
  kbRoot().addEventListener('input', ev => {
    if (ev.target.id === 'wl-q') { const v = ev.target.value.trim(); document.getElementById('wl-index').innerHTML = (v.length > 2 ? WL.searchHTML(v) : '') + WL.indexHTML(v.length > 2 ? '' : v).replace(/^/, v.length > 2 ? '<h2 class="wl-sub">Все статьи</h2>' : ''); }
    if (ev.target.id === 'gl-q') document.getElementById('gl-box').innerHTML = WL.glossaryHTML(ev.target.value);
  });
  // буквы указателя прокручивают, не меняя адрес раздела
  kbRoot().addEventListener('click', ev => {
    const a = ev.target.closest('[data-letter]'); if (!a) return;
    ev.preventDefault(); document.getElementById('wl-' + encodeURIComponent(a.dataset.letter))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
