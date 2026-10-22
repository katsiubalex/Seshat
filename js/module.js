// Раздел «О модуле» на странице модуля и запуск страниц модулей в разработке. История божества — в lore.js.

(function () {
  const { MODULES, KIND, glyph } = SeshatModules;
  const MOD = Object.fromEntries(MODULES.map(m => [m.id, m]));
  const m = MOD[PAGE];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  // соседи по пути воды — переход сразу на их страницы
  const PATH = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl'];
  const href = x => ROOT + x.path;

  function renderOverview() {
    const i = PATH.indexOf(m.id), prev = MOD[PATH[i - 1]], next = MOD[PATH[i + 1]];
    const kb = (m.ready ? ['kb-units', 'kb-proc', 'kb-ind'] : []).map(h => `<li><a href="#${h}">${({ 'kb-units': 'Сооружения очистки', 'kb-proc': 'Физика и химия процессов', 'kb-ind': 'Показатели качества воды' })[h]}</a></li>`).join('') + (m.kb || []).map(h => { const p = SeshatKB.PROCESSES.find(x => 'kb-p-' + x.id === h); return p ? `<li><a href="#${h}">${esc(p.t)}</a></li>` : ''; }).join('');
    document.getElementById('overview-root').innerHTML = `
      <article class="mod-page kind-${m.kind}">
        <header class="mod-head">${glyph(m.id, 64)}<div><span class="gp-stage">${esc(KIND[m.kind])} · ${esc(m.culture)}</span><h1>${esc(m.n)}</h1><p class="mod-domain">${esc(m.d)}</p><a class="mod-lore" href="#lore">${cap(m.about)} →</a></div></header>
        ${m.ready
          ? `<div class="mod-status mod-ready"><span>Модуль готов: соберите схему очистки на плане станции, сравните варианты и посмотрите, как меняются вода и затраты.</span><span class="mod-acts"><a class="btn primary" href="#constructor" data-go="constructor">Открыть конструктор</a><a class="btn" href="#projects" data-go="projects">Проекты</a></span></div>`
          : `<p class="mod-status">Модуль в разработке. Здесь появится свой интерактивный тренажёр — так же, как конструктор очистных сооружений в модуле <a href="${href(MOD.tlazolteotl)}">Тласольтеотль</a>.</p>`}
        <div class="kb-layout">
          <div class="kb-main">
            <section class="panel"><h2>${m.ready ? 'Что умеет модуль' : 'Что будет в модуле'}</h2><ul>${m.will.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
            <section class="panel"><h2>Почему ${esc(m.n)}</h2><p>${esc(m.legend)}</p><p><a href="#lore">Читать историю целиком →</a></p></section>
            <nav class="kb-seq">${prev ? `<a href="${href(prev)}">← ${esc(prev.n)}</a>` : '<span></span>'}${next ? `<a href="${href(next)}">${esc(next.n)} →</a>` : ''}</nav>
          </div>
          <aside class="kb-side">
            <section class="panel"><h2>Дисциплины</h2><p class="kb-tags">${m.disc.map(d => `<span class="kb-tag">${esc(d)}</span>`).join('')}</p></section>
            <section class="panel"><h2>Уже сейчас в Сешат</h2><ul class="kb-links">${kb}<li><a href="#kb-books">Учебники по дисциплинам</a></li><li><a href="#docs">Нормативные документы</a></li></ul></section>
          </aside>
        </div>
      </article>`;
  }
  VIEW_RENDER.overview = renderOverview;
  if (DEV_MODULES.includes(PAGE)) startPage(); // у Тласольтеотль страницу запускает main.js
})();
