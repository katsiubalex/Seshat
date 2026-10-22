// Страница «Гуманитарные аспекты»: обзор раздела и мифы о воде.
// #overview — обзор, #lore — все мифы, #lore-<id> — статья: история, образ, обряды и созвучные модули.
// Данные мифов — в myths.js, рисунки — в art.js.

(function () {
  const { MODULES, glyph } = SeshatModules;
  const MOD = Object.fromEntries(MODULES.map(m => [m.id, m]));
  const { GODS, BY } = SeshatMyths;
  const KBH = SeshatKB.HUMANITIES;
  const me = MOD.humanities;
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const href = m => ROOT + m.path;
  const sym = (id, size) => window.SeshatArt && SeshatArt.has.symbol(id) ? SeshatArt.symbol(id, size) : '';
  // чип созвучного модуля
  const modChip = id => { const m = MOD[id]; return m ? `<a class="kb-tag kind-${m.kind}" href="${href(m)}">${glyph(m.id, 16)} ${esc(m.n)}</a>` : ''; };
  const godCard = (g, full) => `<a class="kb-card myth-card" href="#lore-${g.id}">
      <span class="myth-sym" aria-hidden="true">${sym(g.id, 44)}</span>
      <b>${esc(g.name)}</b><span class="myth-ep">${esc(g.epithet)} · ${esc(g.culture)}</span>
      ${full ? `<span>${esc(g.legend)}</span>` : ''}
      <small>Созвучно: ${g.mods.map(([m]) => esc(MOD[m] ? MOD[m].n : m)).join(', ')}</small></a>`;

  /* ---------- обзор раздела ---------- */
  function renderOverview() {
    document.getElementById('overview-root').innerHTML = `
      <article class="mod-page kind-${me.kind}">
        <header class="mod-head">${glyph(me.id, 64)}<div><span class="gp-stage">${esc(SeshatModules.GROUPS[me.group])}</span><h1>${esc(me.n)}</h1><p class="mod-domain">${esc(me.d)}</p></div></header>
        <div class="mod-status"><span>Инженер работает не только с водой, но и с людьми. Здесь собрано то, что инженерные курсы обычно оставляют за скобками: как люди думали о воде, как строили первые водопроводы и канализации, кому принадлежит вода и за что отвечает инженер.</span></div>
        <div class="kb-layout">
          <div class="kb-main">
            <section class="kb-group"><h2>Мифы о воде</h2><p class="sub">Боги и герои древних культур, чья сфера созвучна модулям Сешат. В каждой статье — история, образ, обряды и связь с инженерной дисциплиной.</p>
              <div class="kb-grid kb-grid-sm">${GODS.filter(g => g.id !== 'seshat').map(g => godCard(g)).join('')}</div></section>
            <section class="kb-group"><h2>Человек и вода</h2>
              <div class="kb-grid kb-grid-sm">${KBH.map(x => `<a class="kb-card" href="#kb-h-${x.id}"><b>${esc(x.t)}</b><span>${esc(x.lead)}</span></a>`).join('')}</div></section>
          </div>
          <aside class="kb-side">
            <section class="panel myth-name"><h2>Откуда имя «Сешат»</h2><p>${sym('seshat', 40)}</p><p>${esc(BY.seshat.legend)}</p><p><a href="#lore-seshat">Читать о Сешат →</a></p></section>
            <section class="panel"><h2>Разделы</h2><ul class="kb-links"><li><a href="#lore">Мифы о воде</a></li><li><a href="#kb">База знаний</a></li><li><a href="#courses">Курсы</a></li></ul></section>
            <section class="panel"><h2>Дисциплины</h2><p class="kb-tags">${me.disc.map(d => `<span class="kb-tag">${esc(d)}</span>`).join('')}</p></section>
          </aside>
        </div>
      </article>`;
  }

  /* ---------- все мифы ---------- */
  function renderList() {
    const root = document.getElementById('lore-root'); root.className = 'lore-root kind-base';
    root.innerHTML = `
      <div class="kb-root">
        <nav class="kb-crumbs" aria-label="Путь"><a href="#overview">${esc(me.n)}</a><span class="kb-sep" aria-hidden="true">/</span><span aria-current="page">Мифы о воде</span></nav>
        <header class="kb-head"><div><h1>Мифы о воде</h1><p class="sub">Девять статей: сама Сешат и восемь богов и героев, созвучных модулям водной инфраструктуры. Под каждой статьёй — модули, с которыми она перекликается по смыслу.</p></div></header>
        <div class="kb-grid">${GODS.map(g => godCard(g, true)).join('')}</div>
      </div>`;
  }

  /* ---------- статья ---------- */
  function renderArticle(id) {
    const L = BY[id], root = document.getElementById('lore-root');
    if (!L) return renderList();
    const i = GODS.indexOf(L), prev = GODS[i - 1], next = GODS[i + 1];
    const first = MOD[L.mods[0][0]];
    // статья окрашена в цвет созвучного модуля водной инфраструктуры
    root.className = 'lore-root kind-' + (first && first.group === 'water' ? first.kind : 'base');
    root.innerHTML = `
      <nav class="kb-crumbs lore-crumbs" aria-label="Путь"><a href="#overview">${esc(me.n)}</a><span class="kb-sep" aria-hidden="true">/</span><a href="#lore">Мифы о воде</a><span class="kb-sep" aria-hidden="true">/</span><span aria-current="page">${esc(L.name)}</span></nav>
      <header class="lore-hero">
        <div class="lore-orn" aria-hidden="true">${sym(id, 96)}</div>
        <p class="lore-kicker">${esc(L.epithet)} · ${esc(L.culture)}</p>
        <h1>${esc(L.name)}</h1>
        <p class="lore-native">${esc(L.native)}</p>
        <p class="lore-lead">${esc(L.lead)}</p>
        <nav class="lore-toc" aria-label="Главы">${L.chapters.map((c, k) => `<a href="#lore-ch-${k}" data-lore="${k}">${roman[k]}. ${esc(c.k)}</a>`).join('')}<a href="#lore-mods" data-lore="mods">Созвучные модули</a></nav>
      </header>
      ${L.chapters.map((c, k) => `<section class="lore-ch" id="lore-ch-${k}">
        <div class="lore-num" aria-hidden="true">${roman[k]}</div>
        <div class="lore-body">
          <p class="lore-k">${esc(c.k)}</p>
          <h2>${esc(c.t)}</h2>
          ${c.q ? `<blockquote>${esc(c.q)}</blockquote>` : ''}
          ${c.p.map(x => `<p>${esc(x)}</p>`).join('')}
        </div>
        ${window.SeshatArt && SeshatArt.lore(id, k) ? `<figure class="lore-fig" aria-hidden="true">${SeshatArt.lore(id, k)}</figure>` : ''}
      </section>`).join('')}
      <section class="lore-mods" id="lore-ch-mods">
        <h2>Созвучные модули</h2>
        <p class="hint">Модули Сешат, с которыми ${L.about === 'о боге' ? 'этот бог' : L.about === 'о богине' ? 'эта богиня' : 'эта легенда'} перекликается по смыслу.</p>
        <ul class="myth-mods">${L.mods.map(([m, why]) => { const x = MOD[m]; return x ? `<li class="kind-${x.kind}"><a href="${href(x)}">${glyph(x.id, 28)}<b>${esc(x.n)}</b></a><span>${esc(why)}</span></li>` : ''; }).join('')}</ul>
      </section>
      <footer class="lore-foot">
        <div class="lore-acts">${first ? `<a class="btn primary" href="${href(first)}">К модулю «${esc(first.n)}»</a>` : ''}<a class="btn" href="#lore">Все мифы</a></div>
        <div><h3>Источники</h3><ul>${L.sources.map(([t, u]) => `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>` : esc(t)}</li>`).join('')}</ul>
        <p class="hint">Пересказ для учебных целей.${L.culture === 'Ацтеки' ? ' Сведения об ацтекских божествах дошли до нас в основном через испанских хронистов XVI века, и толкования исследователей расходятся.' : ' Толкования исследователей могут расходиться.'}</p></div>
      </footer>
      <nav class="kb-seq lore-seq">${prev ? `<a href="#lore-${prev.id}">← ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a href="#lore-${next.id}">${esc(next.name)} →</a>` : ''}</nav>`;
  }

  // оглавление прокручивает к главе, не меняя адрес раздела
  document.getElementById('lore-root').addEventListener('click', ev => {
    const a = ev.target.closest('[data-lore]'); if (!a) return;
    ev.preventDefault(); document.getElementById('lore-ch-' + a.dataset.lore).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  VIEW_RENDER.overview = renderOverview;
  VIEW_RENDER.lore = id => (id ? renderArticle(id) : renderList());
  startPage();
})();
