// Главная страница экосистемы Сешат: водный цикл из модулей, страницы модулей, «О проекте».

const { MODULES, KIND, glyph } = SeshatModules;
const MOD = Object.fromEntries(MODULES.map(m => [m.id, m]));
const modHref = m => m.path;

/* ---------- меню: список модулей ---------- */
document.getElementById('nav-modules').innerHTML = MODULES.map(m =>
  `<a class="nav-link nav-mod kind-${m.kind}" href="${modHref(m)}">${glyph(m.id, 20)}<span class="nav-t">${esc(m.n)}<small>${esc(m.d)}${m.ready ? '' : ' · скоро'}</small></span></a>`).join('');

/* ---------- главная: водный цикл ---------- */
// место на поле 5 × 2: путь воды слева направо по верхнему ряду и обратно по нижнему
const CELL = { tlaloc: [1, 1], hapi: [2, 1], enki: [3, 1], anahita: [4, 1], juturna: [5, 1], yu: [1, 2], tlazolteotl: [3, 2], cloacina: [4, 2], city: [5, 2] };
const ORDER = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'city', 'cloacina', 'tlazolteotl']; // порядок на телефоне
function card(id) {
  if (id === 'city') return `<div class="mod-card city" data-id="city" style="grid-column:${CELL.city[0]};grid-row:${CELL.city[1]}">${glyph('city', 30)}<b>Город</b><span>потребители воды</span></div>`;
  const m = MOD[id];
  return `<a class="mod-card kind-${m.kind}${m.ready ? ' ready' : ''}" data-id="${id}" href="${modHref(m)}" style="grid-column:${CELL[id][0]};grid-row:${CELL[id][1]}">
    ${glyph(id, 30)}<b>${esc(m.n)}</b><span>${esc(m.d)}</span><em>${m.ready ? 'открыть модуль' : 'в разработке'}</em></a>`;
}
function renderHome() {
  const ready = MODULES.filter(m => m.ready);
  document.getElementById('home-root').innerHTML = `
    <header class="home-head">
      <h1>Сешат</h1>
      <p class="home-lead">Образовательная экосистема по водоснабжению и водоотведению. Каждый модуль — отдельная дисциплина, а вместе они проходят весь путь воды: от дождевой тучи до очищенного стока, который возвращается в реку.</p>
      <div class="home-actions">${ready.map(m => `<a class="btn primary" href="${m.path}">Открыть ${esc(m.n)}</a>`).join('')}<a class="btn" href="#seshat" data-go="seshat">Спросить Сешат</a></div>
    </header>
    <section class="cycle-wrap" aria-label="Модули экосистемы в водном цикле">
      <div class="cycle" id="cycle">${ORDER.map(card).join('')}<svg class="cycle-lines" id="cycle-lines" aria-hidden="true"></svg></div>
      <ul class="cycle-legend">${Object.entries(KIND).map(([k, n]) => `<li class="kind-${k}"><i></i>${n}</li>`).join('')}</ul>
    </section>
    <section class="home-more">
      <a class="home-link" href="#kb" data-go="kb"><b>База знаний</b><span>Сооружения, процессы, показатели воды, учебники, журналы и сообщества.</span></a>
      <a class="home-link" href="#docs" data-go="docs"><b>Нормативные документы</b><span>Законы, справочники НДТ, своды правил и нормативы качества воды.</span></a>
      <a class="home-link" href="#about" data-go="about"><b>О проекте</b><span>Для кого экосистема, почему такие имена и как связаться с автором.</span></a>
    </section>`;
  requestAnimationFrame(drawCycle);
}
// стрелки между карточками: считаются по их положению на экране
function drawCycle() {
  const box = document.getElementById('cycle'), svg = document.getElementById('cycle-lines'); if (!box || !svg) return;
  if (getComputedStyle(svg).display === 'none') return;
  const B = box.getBoundingClientRect(), r = id => { const e = box.querySelector(`[data-id="${id}"]`).getBoundingClientRect(); return { x: e.left - B.left, y: e.top - B.top, w: e.width, h: e.height }; };
  svg.setAttribute('viewBox', `0 0 ${B.width} ${B.height}`);
  const A = 'marker-end="url(#cy-arrow)"', p = [], g = 4;
  const right = (a, b) => { const A1 = r(a), B1 = r(b), y = A1.y + A1.h / 2; p.push(`<path d="M${A1.x + A1.w + g} ${y}H${B1.x - g - 2}" ${A}/>`); };
  const left = (a, b) => { const A1 = r(a), B1 = r(b), y = A1.y + A1.h / 2; p.push(`<path d="M${A1.x - g} ${y}H${B1.x + B1.w + g + 2}" ${A}/>`); };
  ['tlaloc', 'hapi', 'enki', 'anahita', 'juturna'].reduce((a, b) => (right(a, b), b));
  const ju = r('juturna'), ci = r('city');
  p.push(`<path d="M${ju.x + ju.w / 2} ${ju.y + ju.h + g}V${ci.y - g - 2}" ${A}/>`);
  left('city', 'cloacina'); left('cloacina', 'tlazolteotl');
  const tz = r('tlazolteotl'), hp = r('hapi'), yu = r('yu');
  p.push(`<path class="back" d="M${tz.x - g} ${tz.y + tz.h / 2}H${hp.x + hp.w * 0.65}V${hp.y + hp.h + g + 2}" ${A}/>`);
  const gap = (hp.y + hp.h + yu.y) / 2;
  p.push(`<path class="dash" d="M${yu.x + yu.w / 2} ${yu.y - g}V${gap}H${hp.x + hp.w * 0.25}V${hp.y + hp.h + g}"/>`);
  svg.innerHTML = `<defs><marker id="cy-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${p.join('')}`;
}
window.addEventListener('resize', () => { if (document.body.dataset.view === 'home') drawCycle(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (document.body.dataset.view === 'home') drawCycle(); });

/* ---------- «О проекте»: имена всех модулей ---------- */
document.getElementById('about-names').innerHTML = MODULES.map(m => `<div class="name-card kind-${m.kind}"><h3>${glyph(m.id, 22)} ${esc(m.n)}</h3><p class="name-sub">${esc(m.d)}</p><p>${esc(m.legend)}</p></div>`).join('');

VIEW_RENDER.home = renderHome;
startPage();
