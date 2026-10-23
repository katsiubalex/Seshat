// Редактор статей на сайте: открыть статью базы знаний или миф, править Markdown и сразу видеть, как она будет выглядеть.
// Правки не публикуются сами: готовый файл отправляют на проверку — на GitHub (изменение файла или новый файл), письмом
// или файлом. Черновик сохраняется в этом браузере. Адреса: #editor — список, #editor-<коллекция>-<id> — статья,
// #editor-<коллекция>-new — новая статья. Подключается на главной после kbview.js и kblinks.js.
(function () {
  const root = document.getElementById('editor-root'); if (!root || !window.SeshatMD) return;
  const MD = SeshatMD, R = window.SeshatReview || { REPO: 'katsiubalex/Seshat', MAIL: 'katsiubalex@proton.me' };
  const CT = window.SeshatContent || {};
  const COLL = MD.COLLECTIONS, DRAFT = 'seshat-editor-draft:';
  const draftGet = k => { try { return localStorage.getItem(DRAFT + k); } catch (e) { return null; } };
  const draftSet = (k, v) => { try { if (v == null) localStorage.removeItem(DRAFT + k); else localStorage.setItem(DRAFT + k, v); } catch (e) { /* хранилище недоступно */ } };
  const nameOf = (coll, x) => (coll === 'myths' ? x.name : x.t);
  let cur = null; // { coll, id, isNew, orig, text }
  let ui = { coll: 'processes', q: '' };

  /* ---------- шаблоны новых статей ---------- */
  const TEMPLATE = {
    processes: '---\nid: new-process\ntitle: Название процесса\ngroup: Биологические процессы\n---\n\nВводный абзац: что это за процесс и зачем он нужен — в двух-трёх предложениях.\n\n## Уравнения\n- `A + B → C`\n\n## Как идёт процесс\nТекст раздела.\n\n## Ключевые числа\n- число с единицами и пояснением\n\n## Источники\n- Автор. Название. Издательство, год, с. N\n',
    indicators: '---\nid: new-indicator\ntitle: Название показателя\nunit: мг/л\ntypical: диапазон в городских стоках\n---\n\n## Что это\nОпределение показателя.\n\n## Почему важно\nЧем опасен или важен.\n\n## Как снижают\nКакие сооружения и процессы.\n\n## Источники\n- Документ или учебник с пунктом или страницей\n',
    aux: '---\nid: new-building\ntitle: Название здания\n---\n\nВводный абзац.\n\n## Назначение\nТекст.\n\n## Источники\n- Источник\n',
    fundamentals: '---\nid: new-discipline\ntitle: Название дисциплины\nhome: fundamentals\nmods:\n  - tlazolteotl\n---\n\nВводный абзац.\n\n## Ключевые формулы\n- `формула — пояснение`\n\n## Раздел\nТекст.\n\n## Учебники\n- Автор И. О. | Название | Город: Издательство, год\n\n## Источники\n- Источник\n',
    humanities: '---\nid: new-article\ntitle: Название статьи\n---\n\nВводный абзац.\n\n## Раздел\nТекст.\n\n## Почитать\n- Автор И. О. | Название | Город: Издательство, год\n\n## Источники\n- Источник\n',
    myths: '---\nid: new-myth\nname: Имя\nnative: Имя в оригинале\nepithet: Кто это\nculture: Культура\nabout: о боге\nlegend: Одно-два предложения о главном.\nmods:\n  - module: tlaloc\n    why: чем созвучен модулю\nsources:\n  - title: Название источника\n    url: https://…\n---\n\nВводный абзац.\n\n## Имя: Заголовок главы\n> Цитата или главная мысль главы (необязательно).\n\nТекст главы.\n'
  };
  // в ветке без статей о расчёте сети коллекция пустая — её не показываем
  const colls = () => Object.keys(COLL).filter(c => (CT[c] || []).length || c !== 'network');

  /* ---------- список ---------- */
  function renderList() {
    const list = (CT[ui.coll] || []).filter(x => !ui.q || (nameOf(ui.coll, x) + ' ' + x.id).toLowerCase().includes(ui.q.toLowerCase()));
    root.innerHTML = `
      <header class="about-head"><h1>Редактор статей</h1>
        <p class="about-lead">Каждая статья базы знаний и каждый миф — отдельный файл в формате Markdown. Откройте статью, поправьте текст и сразу посмотрите, как она будет выглядеть. Готовую правку отправьте на проверку: куратор модуля посмотрит её, и после проверки она появится на сайте.</p></header>
      <section class="panel ed-list">
        <div class="ed-pick"><label class="net-f"><span>Раздел</span><select id="ed-coll">${colls().map(c => `<option value="${c}"${c === ui.coll ? ' selected' : ''}>${esc(COLL[c].label)} (${(CT[c] || []).length})</option>`).join('')}</select></label>
          <input id="ed-q" type="search" class="lib-search" placeholder="Найти статью…" value="${esc(ui.q)}" aria-label="Найти статью">
          <a class="btn primary" href="#editor-${ui.coll}-new">Новая статья</a></div>
        <ul class="ed-items">${list.map(x => `<li><a href="#editor-${ui.coll}-${x.id}">${esc(nameOf(ui.coll, x))}</a><code>${esc(COLL[ui.coll].dir)}/${esc(x.id)}.md</code>${draftGet(ui.coll + '/' + x.id) ? '<span class="ed-dr">черновик</span>' : ''}${(x.src && x.src.length) || ui.coll === 'myths' || ui.coll === 'network' ? '' : '<span class="ed-nosrc" title="Нет раздела «Источники»">без источников</span>'}</li>`).join('') || '<li class="hint">Ничего не найдено.</li>'}</ul></section>
      <section class="panel about-block"><h2>Как устроен файл статьи</h2>
        <pre class="ed-sample">---\nid: nitrification          ← адрес статьи, латиницей\ntitle: Нитрификация\n---\n\nВводный абзац.\n\n## Раздел\nТекст раздела.\n\n## Источники\n- СП 32.13330.2018, п. 9.2.2.10, с. 61</pre>
        <p>Над первой чертой — поля статьи, под ней — вводный абзац и разделы, каждый начинается с «## ». Особые разделы: «Уравнения», «Ключевые числа», «Источники», «Учебники», «Почитать» — в них пункты списка «- ». Разметка внутри абзацев не нужна: текст показывается как есть.</p>
        <p class="hint">Умеете работать с Git? Те же файлы лежат в папке <code>content/</code> репозитория; после правки выполните <code>node tools/build-content.js</code>. Правила — в <a href="https://github.com/${R.REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">CONTRIBUTING.md ↗</a>.</p></section>`;
  }

  /* ---------- предпросмотр: те же блоки, что на сайте ---------- */
  const H = s => esc(s == null ? '' : s);
  function preview(coll, x) {
    if (coll === 'myths') return `<article class="ed-myth">
        <p class="lore-kicker">${H(x.epithet)}${x.culture ? ' · ' + H(x.culture) : ''}</p><h1>${H(x.name)}</h1><p class="lore-native">${H(x.native)}</p><p class="lore-lead">${H(x.lead)}</p>
        ${x.chapters.map((c, i) => `<section class="ed-ch"><p class="lore-k">${i + 1}. ${H(c.k)}</p><h2>${H(c.t)}</h2>${c.q ? `<blockquote>${H(c.q)}</blockquote>` : ''}${c.p.map(p => `<p>${H(p)}</p>`).join('')}</section>`).join('')}
        <section class="panel"><h2>Созвучные модули</h2><ul class="kb-links">${x.mods.map(([m, w]) => `<li><b>${H((SeshatModules.MODULES.find(z => z.id === m) || { n: m + ' — нет такого модуля' }).n)}</b> — ${H(w)}</li>`).join('')}</ul></section>
        <section class="panel"><h2>Источники</h2><ul class="kb-links">${x.sources.map(([t, u]) => `<li>${u ? `<a href="${H(u)}" target="_blank" rel="noopener">${H(t)} ↗</a>` : H(t)}</li>`).join('')}</ul></section></article>`;
    const head = `<header class="kb-ahead"><div><span class="gp-stage">${H(coll === 'processes' ? x.g : coll === 'indicators' ? x.u : COLL[coll].label)}</span><h1>${H(x.t)}</h1>${x.lead ? `<p class="kb-lead">${H(x.lead)}</p>` : ''}</div></header>`;
    const f = x.f && x.f.length ? `<section class="panel"><h2>${coll === 'processes' ? 'Уравнения' : 'Ключевые формулы'}</h2><div class="kb-f">${x.f.map(v => `<code>${H(v)}</code>`).join('')}</div></section>` : '';
    const s = coll === 'indicators' ? sections([['Что это', x.what], ['Почему важно', x.why], ['Как снижают', x.how]]) : sections(x.s || []);
    const books = x.books && x.books.length ? `<section class="panel"><h2>${coll === 'humanities' ? 'Почитать' : 'Учебники'}</h2>${bookList(x.books)}</section>` : '';
    const src = coll === 'network' ? `<section class="panel"><h2>Источники</h2><ul class="kb-links">${x.src.map(([d, t, w, u]) => `<li>${u ? `<a href="${H(u)}" target="_blank" rel="noopener">${H(t)} ↗</a>` : H(t)}${d ? ` <span class="hint">[${H(d)}]</span>` : ''}${w ? ` <span class="hint">— ${H(w)}</span>` : ''}</li>`).join('')}</ul></section>` : srcPanel(x);
    return article(head, f + s, numbers(x.n) + src + books);
  }

  /* ---------- статья ---------- */
  const fileOf = (coll, id) => `${COLL[coll].dir}/${id}.md`;
  async function open(coll, id) {
    if (!COLL[coll]) { ui.coll = colls()[0]; return renderList(); }
    ui.coll = coll;
    const isNew = id === 'new', key = coll + '/' + id;
    let orig = isNew ? TEMPLATE[coll] : null;
    if (!isNew) {
      try { const r = await fetch(ROOT + fileOf(coll, id), { cache: 'no-cache' }); if (r.ok) orig = await r.text(); } catch (e) { /* без сети — соберём файл из данных сайта */ }
      if (orig == null) { const x = (CT[coll] || []).find(v => v.id === id); if (x) orig = MD.serialize(COLL[coll].fromData(x)); }
      if (orig == null) { root.innerHTML = `<p class="empty">Статья «${esc(id)}» не найдена. <a href="#editor">К списку статей</a></p>`; return; }
    }
    const draft = draftGet(key);
    cur = { coll, id, isNew, key, orig, text: draft || orig };
    root.innerHTML = `
      <nav class="kb-crumbs" aria-label="Путь"><a href="#editor">Редактор статей</a><span class="kb-sep" aria-hidden="true">/</span><span>${esc(COLL[coll].label)}</span><span class="kb-sep" aria-hidden="true">/</span><span aria-current="page">${isNew ? 'новая статья' : esc(id)}</span></nav>
      <div class="ed-bar">
        <code class="ed-file">${isNew ? esc(COLL[coll].dir) + '/<i>id</i>.md' : esc(fileOf(coll, id))}</code>
        ${draft ? '<span class="ed-dr">восстановлен черновик из этого браузера</span>' : ''}
        <span class="ed-acts"><button type="button" class="primary" data-ed="github">Предложить на GitHub</button><button type="button" data-ed="mail">Письмом</button><button type="button" data-ed="download">Скачать .md</button><button type="button" data-ed="copy">Скопировать</button><button type="button" data-ed="reset"${draft ? '' : ' disabled'}>Вернуть исходный текст</button></span>
      </div>
      <div class="ed-split">
        <div class="ed-src"><label class="visually-hidden" for="ed-text">Текст статьи в формате Markdown</label><textarea id="ed-text" spellcheck="true">${esc(cur.text)}</textarea>
          <div id="ed-check" class="ed-check" aria-live="polite"></div>
          <details class="ed-help"><summary>Поля этого раздела</summary><dl>${Object.entries(COLL[coll].fields).map(([k, v]) => `<dt><code>${k}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl>
            ${(COLL[coll].special || []).length ? `<p>Особые разделы (пункты списка «- »): ${COLL[coll].special.map(s => '«' + esc(s) + '»').join(', ')}.</p>` : ''}</details></div>
        <div class="ed-prev kb-root" id="ed-prev" aria-label="Предпросмотр"></div>
      </div>`;
    update();
  }
  function update() {
    const doc = MD.parse(cur.text), v = MD.validate(cur.coll, doc), box = document.getElementById('ed-check'), prev = document.getElementById('ed-prev');
    let x = null; try { x = COLL[cur.coll].toData(doc); } catch (e) { v.err.push('Не удалось разобрать файл: ' + e.message); }
    box.innerHTML = (v.err.length ? `<p class="ed-err"><b>Исправьте перед отправкой:</b></p><ul class="ed-err">${v.err.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="ed-ok">Файл в порядке: его можно отправлять на проверку.</p>')
      + (v.warn.length ? `<ul class="ed-warn">${v.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '');
    if (x) { try { prev.innerHTML = preview(cur.coll, x); } catch (e) { prev.innerHTML = `<p class="empty">Предпросмотр не получился: ${esc(e.message)}</p>`; } }
    cur.valid = !v.err.length; cur.newId = doc.meta.id;
    const btn = root.querySelector('[data-ed="reset"]'); if (btn) btn.disabled = cur.text === cur.orig;
  }
  let timer = null;
  root.addEventListener('input', ev => {
    if (ev.target.id === 'ed-q') { ui.q = ev.target.value; const pos = ev.target.selectionStart; renderList(); const q = document.getElementById('ed-q'); q.focus(); q.setSelectionRange(pos, pos); return; }
    if (ev.target.id !== 'ed-text') return;
    cur.text = ev.target.value; draftSet(cur.key, cur.text === cur.orig ? null : cur.text);
    clearTimeout(timer); timer = setTimeout(update, 200);
  });
  root.addEventListener('change', ev => { if (ev.target.id === 'ed-coll') { ui.coll = ev.target.value; ui.q = ''; renderList(); } });
  root.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ed]'); if (!b || !cur) return;
    const a = b.dataset.ed, id = cur.isNew ? cur.newId : cur.id, file = cur.isNew ? `${COLL[cur.coll].dir}/${id}.md` : fileOf(cur.coll, cur.id);
    if (a === 'reset') { cur.text = cur.orig; draftSet(cur.key, null); document.getElementById('ed-text').value = cur.text; update(); return; }
    if (a === 'copy') { try { await navigator.clipboard.writeText(cur.text); toast('Текст статьи скопирован.'); } catch (e) { toast('Браузер не дал скопировать: выделите текст вручную.'); } return; }
    if (a === 'download') { const blob = new Blob([cur.text], { type: 'text/markdown;charset=utf-8' }), u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = (id || 'article') + '.md'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); return; }
    if (!cur.valid) { toast('Сначала исправьте ошибки, отмеченные под текстом.'); return; }
    if (a === 'mail') {
      const body = `Правка статьи ${file}\nСтраница: ${location.href}\n\n${cur.text}`;
      if (body.length > 6000) toast('Статья длинная: письмо может обрезаться. Надёжнее скачать файл и приложить его к письму.');
      location.href = `mailto:${R.MAIL}?subject=${encodeURIComponent('Сешат: правка статьи ' + file)}&body=${encodeURIComponent(body.slice(0, 6000))}`; return;
    }
    if (a === 'github') {
      if (cur.isNew) { // новый файл: GitHub подставит имя и текст, сохранить можно в виде предложения изменений
        const u = `https://github.com/${R.REPO}/new/main/${COLL[cur.coll].dir}?filename=${encodeURIComponent(id + '.md')}&value=${encodeURIComponent(cur.text)}`;
        if (u.length < 7500) { window.open(u, '_blank', 'noopener'); toast('Откроется GitHub с готовым файлом: нажмите «Commit changes» и выберите «Propose changes».'); return; }
      }
      try { await navigator.clipboard.writeText(cur.text); } catch (e) { /* без буфера — пользователь скопирует сам */ }
      window.open(`https://github.com/${R.REPO}/${cur.isNew ? 'new/main/' + COLL[cur.coll].dir + '?filename=' + encodeURIComponent(id + '.md') : 'edit/main/' + file}`, '_blank', 'noopener');
      toast('Текст скопирован. На GitHub замените им содержимое файла и нажмите «Propose changes» — правка уйдёт на проверку.');
    }
  });

  VIEW_RENDER.editor = param => {
    const m = /^([a-z]+)-([a-z0-9-]+)$/.exec(param || '');
    if (m) open(m[1], m[2]); else { cur = null; renderList(); }
  };
})();
