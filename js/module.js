// Раздел «О модуле» на странице модуля и запуск страниц модулей в разработке. История божества — в lore.js.

(function () {
  const { MODULES, KIND, glyph } = SeshatModules;
  const MOD = Object.fromEntries(MODULES.map(m => [m.id, m]));
  const m = MOD[PAGE];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  // соседи по пути воды — переход сразу на их страницы
  const PATH = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'interior', 'cloacina', 'tlazolteotl'];
  const href = x => ROOT + x.path;

  // модуль-заготовка: что в нём будет, курсы и база знаний; конструктора и истории пока нет
  function renderStub() {
    const i = PATH.indexOf(m.id), prev = MOD[PATH[i - 1]], next = MOD[PATH[i + 1]];
    const same = MODULES.filter(x => x.group === m.group && x.id !== m.id);
    const nC = (window.SeshatCourses ? SeshatCourses.C.filter(c => c.mods.includes(m.id)).length : 0);
    document.getElementById('overview-root').innerHTML = `
      <article class="mod-page kind-${m.kind}">
        <header class="mod-head">${glyph(m.id, 64)}<div><span class="gp-stage">${esc(SeshatModules.GROUPS[m.group])}${m.group === 'water' ? ' · ' + esc(KIND[m.kind]) : ''}</span><h1>${esc(m.n)}${m.wip ? `<span class="mod-wip">${esc(m.wip)}</span>` : ''}</h1><p class="mod-domain">${esc(m.d)}</p></div></header>
        <div class="mod-status"><span>Модуль-заготовка. Программа и наполнение уточняются; ${nC ? `уже есть ${nC} ${nC < 5 ? 'курса' : 'курсов'} — в разделе <a href="#courses">«Курсы»</a>` : 'курсы появятся позже'}, база знаний собирается.</span></div>
        <div class="kb-layout">
          <div class="kb-main">
            <section class="panel"><h2>Что будет в модуле</h2><ul>${m.will.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
            ${i >= 0 ? `<nav class="kb-seq">${prev ? `<a href="${href(prev)}">← ${esc(prev.n)}</a>` : '<span></span>'}${next ? `<a href="${href(next)}">${esc(next.n)} →</a>` : ''}</nav>` : ''}
          </div>
          <aside class="kb-side">
            <section class="panel"><h2>Дисциплины</h2><p class="kb-tags">${m.disc.map(d => `<span class="kb-tag">${esc(d)}</span>`).join('')}</p></section>
            <section class="panel"><h2>Разделы</h2><ul class="kb-links"><li><a href="#courses">Курсы</a></li><li><a href="#kb">База знаний</a></li></ul></section>
            ${m.group !== 'water' ? `<section class="panel"><h2>${esc(SeshatModules.GROUPS[m.group])}</h2><ul class="kb-links">${same.map(x => `<li><a href="${href(x)}">${esc(x.n)}</a></li>`).join('')}</ul></section>` : ''}
          </aside>
        </div>
      </article>`;
  }
  function renderOverview() {
    if (m.stub) return renderStub();
    const i = PATH.indexOf(m.id), prev = MOD[PATH[i - 1]], next = MOD[PATH[i + 1]];
    const kb = (m.ready ? [['kb-units', 'Сооружения очистки'], ['kb-proc', 'Физика и химия процессов'], ['kb-ind', 'Показатели качества воды']] : []).concat([['kb-books', 'Учебники модуля']]).map(([h, t]) => `<li><a href="#${h}">${t}</a></li>`).join('')
      + (m.kb || []).map(h => { const p = SeshatKB.PROCESSES.find(x => 'kb-p-' + x.id === h); return p ? `<li><a href="#${h}">${esc(p.t)}</a></li>` : ''; }).join('');
    document.getElementById('overview-root').innerHTML = `
      <article class="mod-page kind-${m.kind}">
        <header class="mod-head">${glyph(m.id, 64)}<div><span class="gp-stage">${esc(KIND[m.kind])} · ${esc(m.culture)}</span><h1>${esc(m.n)}</h1><p class="mod-domain">${esc(m.d)}</p><a class="mod-lore" href="#lore">${cap(m.about)} →</a></div></header>
        ${m.ready
          ? `<div class="mod-status mod-ready"><span>Модуль готов: соберите схему очистки на плане станции, сравните варианты и посмотрите, как меняются вода и затраты.</span><span class="mod-acts"><a class="btn primary" href="#constructor" data-go="constructor">Открыть конструктор</a><a class="btn" href="#projects" data-go="projects">Проекты</a></span></div>`
          : `<div class="mod-status"><span>Модуль в разработке. Здесь появится свой конструктор — так же, как конструктор очистных сооружений в модуле <a href="${href(MOD.tlazolteotl)}">Тласольтеотль</a>.</span><span class="mod-acts"><a class="btn" href="#constructor" data-go="constructor">Эскиз конструктора</a></span></div>`}
        <div class="kb-layout">
          <div class="kb-main">
            <section class="panel"><h2>${m.ready ? 'Что умеет модуль' : 'Что будет в модуле'}</h2><ul>${m.will.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
            <section class="panel"><h2>Почему ${esc(m.n)}</h2><p>${esc(m.legend)}</p><p><a href="#lore">Читать историю целиком →</a></p></section>
            <nav class="kb-seq">${prev ? `<a href="${href(prev)}">← ${esc(prev.n)}</a>` : '<span></span>'}${next ? `<a href="${href(next)}">${esc(next.n)} →</a>` : ''}</nav>
          </div>
          <aside class="kb-side">
            <section class="panel"><h2>Дисциплины</h2><p class="kb-tags">${m.disc.map(d => `<span class="kb-tag">${esc(d)}</span>`).join('')}</p></section>
            <section class="panel"><h2>База знаний</h2><ul class="kb-links">${kb}<li><a href="#docs">Нормативные документы</a></li></ul></section>
          </aside>
        </div>
      </article>`;
  }
  VIEW_RENDER.overview = renderOverview;

  // Конструкторы модулей в разработке: пока только эскиз того, как они будут выглядеть
  const SKETCH = {
    tlaloc: ['Водосбор реки на карте', 'Студент задаёт осадки и свойства водосбора, а конструктор строит гидрограф стока и считает расход в расчётном створе.', ['Карта водосбора с притоками и створом', 'Ливни и снеготаяние заданной обеспеченности', 'Гидрограф стока и максимальный расход']],
    hapi: ['Река и её водопользователи', 'На реку ставят водопользователей — город, ГЭС, орошение, промышленность — и смотрят, хватит ли воды всем в маловодный год.', ['Водопользователи и водопотребители на схеме реки', 'Забор, возврат и потери воды', 'Водохозяйственный баланс по месяцам']],
    yu: ['Гидроузел в разрезе', 'Из плотины, водосброса и канала собирают гидроузел и проверяют его на пропуск паводка и устойчивость.', ['Профиль плотины с отметками НПУ и УМО', 'Водосброс и пропуск расчётного паводка', 'Проверки устойчивости и фильтрации']],
    enki: ['Водозабор из реки и из-под земли', 'Подбирают число и расположение скважин или береговой водозабор, видят воронки депрессии и пояса санитарной охраны.', ['Скважины и водоносный горизонт в разрезе', 'Дебит и понижение уровня', 'Зоны санитарной охраны I–III пояса']],
    anahita: ['Станция водоподготовки', 'Из сооружений собирают линию очистки природной воды и смотрят, как меняются мутность, цветность и железо до норм для питьевой воды.', ['Линия: смеситель → хлопьеобразование → отстойник → фильтры → обеззараживание → РЧВ', 'Реагенты и их дозы', 'Сравнение с нормами СанПиН']],
    juturna: ['Кольцевая сеть города', 'Студент рисует кольца сети, задаёт отборы и получает расходы, скорости и напоры в узлах после увязки колец.', ['Кольца, участки и узлы на плане', 'Насосная станция и водонапорная башня', 'Напоры в узлах и проверка минимального напора']],
    cloacina: ['Самотёчная сеть в профиле', 'По плану кварталов строят сеть, а конструктор подбирает диаметры и уклоны и рисует продольный профиль с колодцами и КНС.', ['Бассейны стока и расчётные расходы', 'Диаметр, уклон, наполнение и скорость', 'Продольный профиль с колодцами и КНС']]
  };
  function renderConstructor() {
    const k = SKETCH[m.id]; if (!k) return;
    document.getElementById('constructor-root').innerHTML = `
      <article class="mod-page kind-${m.kind}">
        <header class="mod-head">${glyph(m.id, 64)}<div><span class="gp-stage">Конструктор · ${esc(m.n)}</span><h1>${esc(k[0])}</h1><p class="mod-domain">${esc(m.d)}</p></div></header>
        <p class="mod-status"><b>Конструктор пока не готов.</b> Ниже — эскиз того, как он может выглядеть. Готовый пример — конструктор очистных сооружений в модуле <a href="${href(MOD.tlazolteotl)}">Тласольтеотль</a>.</p>
        <figure class="sketch-card"><span class="sketch-tag">эскиз</span>${SeshatArt.sketch(m.id)}<figcaption>${esc(k[1])}</figcaption></figure>
        <section class="panel"><h2>Что будет в конструкторе</h2><ul>${k[2].map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
      </article>`;
  }
  if (!m.ready && !m.stub) VIEW_RENDER.constructor = renderConstructor;
  if (DEV_MODULES.includes(PAGE) || STUB_MODULES.includes(PAGE)) startPage(); // у Тласольтеотль страницу запускает main.js
})();
