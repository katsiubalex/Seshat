// Раздел «Курсы» модуля: список курсов по уровням и страница курса с уроками.
// Уроки — заготовки видео, ссылки на статьи базы знаний, статьи в плане и интерактив.
const COURSES = (window.SeshatCourses || { C: [] }).C, COURSE_BY = Object.fromEntries(COURSES.map(c => [c.id, c]));
const LVL = ['Основы', 'Практика', 'Проектирование', 'Эксплуатация', 'Углублённый'];
const coursesOf = id => COURSES.filter(c => c.mods.includes(id)).sort((a, b) => LVL.indexOf(a.lvl) - LVL.indexOf(b.lvl));
const plural = (n, one, few, many) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b > 1 && b < 5 ? few : many; };
const crsRoot = () => document.getElementById('courses-root');
const crsCrumbs = (...items) => {
  const path = [['Курсы', items.length ? '#courses' : null], ...items];
  return `<nav class="kb-crumbs" aria-label="Путь">${path.map(([t, h], i) => i === path.length - 1 || !h ? `<span aria-current="page">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a>`).join('<span class="kb-sep" aria-hidden="true">/</span>')}</nav>`;
};
// название статьи по адресу — из корпуса вики-слоя (статьи, документы, термины)
const kbTitle = href => {
  const h = href.replace(/^.*?#/, '#'), a = typeof WL !== 'undefined' && WL.ART.find(x => x.href.replace(/^.*?#/, '#') === h);
  return a ? { t: a.t, type: a.type, belong: a.belong } : { t: h, type: 'd', belong: 'common' };
};
const kbHref = h => /^#kb-(f|h|g)-/.test(h) ? ROOT + h : h;
const modName = id => (KB_MODS.find(x => x.id === id) || {}).n || id;

function courseCard(c) {
  const other = c.mods.filter(m => m !== PAGE), n = c.L.length;
  return `<a class="kb-card course-card" href="#course-${c.id}"><b>${esc(c.t)}</b><span>${esc(c.lead)}</span>
    <small>${n} ${plural(n, 'урок', 'урока', 'уроков')} · заготовка${other.length ? ' · также в: ' + other.map(m => esc(modName(m))).join(', ') : ''}</small></a>`;
}
function coursesHome() {
  const list = coursesOf(PAGE), n = list.reduce((s, c) => s + c.L.length, 0);
  crsRoot().innerHTML = `${crsCrumbs()}<header class="kb-head"><div><p class="lore-kicker">${esc(KB_MOD.n)} · ${esc(KB_MOD.d)}</p><h1>Курсы</h1>
      <p class="sub">${list.length ? `${list.length} ${plural(list.length, 'курс', 'курса', 'курсов')}, ${n} ${plural(n, 'урок', 'урока', 'уроков')} — от основ к проектированию.` : ''} Каждый урок: видео, текст с интерактивными схемами и подборка статей <a href="#kb">базы знаний</a>. Сейчас готовы программы, видео в подготовке.</p></div></header>
    ${list.length ? '' : '<div class="empty">Курсы этого модуля ещё не разработаны: сначала определим его программу.</div>'}
    ${LVL.map(l => { const c = list.filter(x => x.lvl === l); return c.length ? `<section class="kb-group"><h2>${esc(l)}</h2><div class="kb-grid kb-grid-sm">${c.map(courseCard).join('')}</div></section>` : ''; }).join('')}`;
}
function lessonHTML(l, i) {
  const [t, q, kb, todo, ia] = l;
  const links = kb.map(x => { const [h, where] = x.split('@'), a = kbTitle(h);
    return `<li><a href="${kbHref(h)}" class="wb-${a.belong}">${typeof WL !== 'undefined' ? WL.icon(a.type) : ''}${esc(a.t.split(' — ')[0])}</a>${where ? `<small>${esc(where)}</small>` : ''}</li>`; }).join('');
  return `<li class="lesson" id="lesson-${i + 1}"><div class="lesson-n">${i + 1}</div><div class="lesson-b">
    <h3>${esc(t)}</h3><p class="lesson-q">${esc(q)}</p>
    <div class="lesson-video" aria-label="Видео урока появится позже"><span>▶</span><small>Видео в подготовке</small></div>
    ${links ? `<h4>Читать в базе знаний</h4><ul class="lesson-links">${links}</ul>` : ''}
    ${todo.length ? `<h4>Статьи, которые появятся</h4><ul class="lesson-todo">${todo.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${ia.length ? `<h4>Интерактив</h4><ul class="lesson-ia">${ia.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  </div></li>`;
}
function coursePage(id) {
  const c = COURSE_BY[id], mine = coursesOf(PAGE), i = mine.indexOf(c);
  const head = `${crsCrumbs([c.t])}<header class="kb-ahead"><div><span class="gp-stage">${esc(c.lvl)} · ${c.L.length} уроков</span><h1>${esc(c.t)}</h1><p class="kb-lead">${esc(c.lead)}</p></div></header>`;
  const main = `<section class="panel"><h2>После курса вы сможете</h2><ul>${c.out.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="panel"><h2>Программа</h2><ol class="lessons">${c.L.map(lessonHTML).join('')}</ol></section>
    ${i >= 0 ? seq(mine, i, x => '#course-' + x.id, x => x.t) : ''}`;
  const pre = (c.pre || []).map(p => COURSE_BY[p]).filter(Boolean);
  const nk = c.L.reduce((s, l) => s + l[2].length, 0), nt = c.L.reduce((s, l) => s + l[3].length, 0), ni = c.L.reduce((s, l) => s + l[4].length, 0);
  const side = `<section class="panel course-status"><h2>Готовность</h2><dl class="gp-dl"><dt>Программа</dt><dd>готова</dd><dt>Видео</dt><dd>0 из ${c.L.length}</dd><dt>Статьи базы знаний</dt><dd>${nk}</dd><dt>Статьи в плане</dt><dd>${nt}</dd><dt>Интерактивы в плане</dt><dd>${ni}</dd></dl></section>
    ${pre.length ? `<section class="panel"><h2>Перед курсом</h2><ul class="kb-links">${pre.map(p => `<li><a href="#course-${p.id}">${esc(p.t)}</a> <span class="hint">— ${esc(modName(p.mods[0]))}</span></li>`).join('')}</ul></section>` : ''}
    <section class="panel"><h2>Модули</h2><p class="kb-tags">${c.mods.map(m => { const x = KB_MODS.find(k => k.id === m); return `<a class="kb-tag kind-${x.kind}" href="${ROOT + x.path}#courses">${SeshatModules.glyph(x.id, 16)} ${esc(x.n)}</a>`; }).join('')}</p></section>`;
  crsRoot().innerHTML = article(head, main, side);
  if (typeof WL !== 'undefined') WL.wikify(crsRoot().querySelector('.kb-lead'), null);
}
if (crsRoot()) {
  if (KB_MOD) crsRoot().classList.add('kb-themed', 'kind-' + KB_MOD.kind);
  VIEW_RENDER.courses = param => (param && COURSE_BY[param] ? coursePage(param) : coursesHome());
}
