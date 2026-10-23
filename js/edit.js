// Правки от пользователей и профессионалов: под каждым материалом — его статус, кнопки «Предложить правку»
// и «Нашли ошибку?» и ссылка на историю правок. Форма собирает правку с источником и раскрытием интересов
// и отправляет её куратору: задачей на GitHub (поля формы заполняются сами), письмом или копированием текста.
// На главной — раздел «Участвовать» (#contribute): как правка попадает на сайт, статусы, роли, кураторы.
// Подключается после kblinks.js / coursesview.js и до запуска страницы (hub.js, module.js, lore.js, main.js).

(function () {
  const R = window.SeshatReview; if (!R) return;
  const MODS = SeshatModules.MODULES, MOD = Object.fromEntries(MODS.map(m => [m.id, m]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idPat = id => new RegExp(`id: '${reEsc(id)}'`);
  // где лежат данные материала: файл и как найти в нём запись
  const BY_TYPE = {
    u: id => ({ files: ['js/plan.js', 'js/data.js'], find: new RegExp(`^\\s+${reEsc(id)}: \\{`, 'm'), type: 'Сооружение' }),
    // статьи базы знаний — отдельные Markdown-файлы (content/…): их можно править прямо на GitHub или в редакторе Сешат
    p: id => ({ files: [`content/kb/processes/${id}.md`], type: 'Процесс', md: ['processes', id] }),
    i: id => ({ files: [`content/kb/indicators/${id}.md`, 'js/methods.js'], type: 'Показатель', md: ['indicators', id] }),
    a: id => ({ files: [`content/kb/aux/${id}.md`], type: 'Здание', md: ['aux', id] }),
    f: id => ({ files: [`content/kb/fundamentals/${id}.md`, 'js/books.js'], type: 'Дисциплина', md: ['fundamentals', id] }),
    h: id => ({ files: [`content/kb/humanities/${id}.md`], type: 'Человек и вода', md: ['humanities', id] }),
    n: id => ({ files: [`content/kb/network/${id}.md`], type: 'Расчёт сети', md: ['network', id] }),
    d: id => ({ files: ['js/docs.js'], find: idPat(id), type: 'Документ', key: 'doc-' + id }),
    g: id => ({ files: [`content/glossary/${id}.md`], type: 'Термин', md: ['glossary', id] })
  };
  const BY_SECTION = { net: 'content/kb/network', units: 'js/data.js', proc: 'content/kb/processes', ind: 'content/kb/indicators', books: 'js/books.js', docs: 'js/docs.js', fund: 'content/kb/fundamentals', hum: 'content/kb/humanities',
    myth: 'content/myths', journals: 'js/kb.js', comm: 'js/kb.js', glossary: 'content/glossary' };

  // материал, открытый сейчас: ключ (адрес без «#»), тип, файлы данных
  function material() {
    const view = document.body.dataset.view, param = document.body.dataset.param;
    let m;
    if (view === 'kb' && param) {
      if ((m = /^([a-z])-(.+)$/.exec(param)) && BY_TYPE[m[1]]) { const x = BY_TYPE[m[1]](m[2]); return { key: x.key || 'kb-' + param, ...x }; }
      if (BY_SECTION[param]) return { key: 'kb-' + param, files: [BY_SECTION[param]], type: 'Раздел базы знаний' };
      return null;
    }
    if (view === 'courses' && param) return { key: 'course-' + param, files: ['js/courses.js'], find: idPat(param), type: 'Курс' };
    if (view === 'lore' && param) return { key: 'lore-' + param, files: [`content/myths/${param}.md`], type: 'Миф о воде', md: ['myths', param] };
    if (view === 'overview' && PAGE !== 'hub' && MOD[PAGE]) return { key: 'm-' + PAGE, files: ['js/modules.js'], find: idPat(PAGE), type: PAGE === 'humanities' ? 'Раздел' : 'Модуль' };
    return null;
  }
  const titleOf = view => { const h = document.querySelector(`#view-${view} h1`); return h ? h.textContent.replace(/\s+/g, ' ').trim() : document.title; };
  const modName = () => (MOD[PAGE] ? MOD[PAGE].n : 'Сешат');

  /* ---------- панель под материалом ---------- */
  function bar(view, mat) {
    const st = R.statusOf(mat.key, view), S = R.STATUS[st.s];
    const file = mat.files && mat.files[0];
    return `<aside class="edit-bar" aria-label="Качество и правки">
      <div class="eb-status"><span class="rv rv-${st.s}" title="${esc(S.d)}">${esc(S.t)}</span>${st.by ? `<span class="eb-by">${esc(st.by)}${st.date ? ', ' + esc(st.date) : ''}</span>` : ''}<a href="${ROOT}#contribute">Как устроена проверка</a></div>
      <div class="eb-acts">${mat.md ? `<a class="btn" href="${ROOT}#editor-${mat.md[0]}-${mat.md[1]}" title="Открыть текст статьи в редакторе с предпросмотром">Править статью</a>` : ''}<button type="button" class="btn" data-edit="fix">${mat.md ? 'Сообщить о правке' : 'Предложить правку'}</button><button type="button" class="btn" data-edit="bug">Нашли ошибку?</button>${file ? `<a href="${R.urls.history(file)}" target="_blank" rel="noopener">История правок ↗</a>` : ''}</div>
    </aside>`;
  }
  let current = null;
  function mount() {
    const view = document.body.dataset.view, box = document.getElementById('view-' + view);
    document.querySelectorAll('.edit-bar').forEach(e => e.remove());
    current = null;
    const mat = material(); if (!mat || !box) return;
    current = { view, mat, title: titleOf(view) };
    box.insertAdjacentHTML('beforeend', bar(view, mat));
  }
  document.addEventListener('viewchange', () => setTimeout(mount, 0)); // после отрисовки раздела и вики-ссылок

  /* ---------- форма правки ---------- */
  const KINDS = ['Ошибка в факте или расчёте', 'Устарела норма или не работает ссылка', 'Опечатка или неясная формулировка', 'Дополнение: факт, источник, учебник или новая статья'];
  const dlgHTML = `<dialog id="edit-dlg" class="edit-dlg" aria-labelledby="edit-h">
    <form id="edit-form" method="dialog" novalidate>
      <header class="edit-head"><h2 id="edit-h">Предложить правку</h2><button type="submit" value="cancel" class="edit-x" aria-label="Закрыть">✕</button></header>
      <p class="edit-where" id="edit-where"></p>
      <label>Что не так<select name="kind">${KINDS.map(k => `<option>${esc(k)}</option>`).join('')}</select></label>
      <label>Фрагмент <small>выделите текст на странице до нажатия кнопки — он подставится сам</small><textarea name="fragment" rows="2"></textarea></label>
      <label>Что предлагаете <small>обязательно</small><textarea name="proposal" rows="4"></textarea></label>
      <label>Источник <small>пункт нормы, страница учебника, ссылка; не нужен только для опечаток</small><input name="source" type="text" autocomplete="off"></label>
      <label class="edit-check"><input type="checkbox" name="coi"> Я связан(а) с производителем или организацией, о которой идёт речь</label>
      <label class="edit-coi" hidden>Кого вы представляете<input name="coiwho" type="text" autocomplete="organization"></label>
      <label>Как указать вас в истории правок <small>необязательно</small><input name="contact" type="text" autocomplete="name"></label>
      <p class="edit-err" id="edit-err" role="alert" hidden></p>
      <div class="edit-send"><button type="button" class="btn primary" data-send="github">Отправить через GitHub</button><button type="button" class="btn" data-send="mail">Отправить письмом</button><button type="button" class="btn" data-send="copy">Скопировать текст</button></div>
      <p class="hint">Правку проверит куратор модуля. На сайт она попадёт после автоматической проверки и проверки человеком; автор правки и проверяющий — разные люди. Для GitHub нужен бесплатный аккаунт, письмо можно отправить без него. Отправляя правку, вы соглашаетесь опубликовать её по лицензии <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ru" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</p>
      <details class="edit-dev"><summary>Для авторов: правка прямо в исходниках</summary><p id="edit-dev"></p></details>
    </form>
  </dialog>`;
  document.body.insertAdjacentHTML('beforeend', dlgHTML);
  const dlg = document.getElementById('edit-dlg'), form = document.getElementById('edit-form'), err = document.getElementById('edit-err');
  const F = n => form.elements[n];
  form.addEventListener('submit', ev => { if (!ev.submitter || ev.submitter.value !== 'cancel') ev.preventDefault(); }); // Enter в поле не закрывает форму
  F('coi').addEventListener('change', () => { form.querySelector('.edit-coi').hidden = !F('coi').checked; });

  // строка записи в файле данных — чтобы автор сразу попал в нужное место исходников
  async function lineOf(file, re) {
    if (!re) return null;
    try { const t = await (await fetch(ROOT + file, { cache: 'no-cache' })).text(); const m = re.exec(t); return m ? t.slice(0, m.index).split('\n').length : null; } catch (e) { return null; }
  }
  async function open(kind) {
    if (!current) return;
    const sel = String(window.getSelection ? getSelection() : '').replace(/\s+/g, ' ').trim().slice(0, 600);
    form.reset(); form.querySelector('.edit-coi').hidden = true; err.hidden = true;
    F('kind').selectedIndex = kind === 'bug' ? 0 : 3;
    F('fragment').value = sel;
    document.getElementById('edit-h').textContent = kind === 'bug' ? 'Сообщить об ошибке' : 'Предложить правку';
    document.getElementById('edit-where').innerHTML = `<b>${esc(current.mat.type)}:</b> ${esc(current.title)} <span class="hint">· ${esc(modName())}</span>`;
    const files = current.mat.files || [], dev = document.getElementById('edit-dev');
    const md = current.mat.md;
    dev.innerHTML = files.length ? `${md ? `<a class="btn" href="${ROOT}#editor-${md[0]}-${md[1]}">Открыть в редакторе статей</a> — правка с предпросмотром и проверкой. ` : ''}Данные материала — в файле${files.length > 1 ? 'ах' : ''} ${files.map(f => `<code>${esc(f)}</code>`).join(' и ')}. <span id="edit-line"></span><a href="${R.urls.edit(files[0])}" target="_blank" rel="noopener">Редактировать файл на GitHub ↗</a> — GitHub сам предложит сделать копию и отправить изменения на проверку. Правила — в <a href="${R.urls.guide()}" target="_blank" rel="noopener">CONTRIBUTING.md ↗</a>.` : '';
    dlg.showModal();
    (sel ? F('proposal') : F(kind === 'bug' ? 'fragment' : 'proposal')).focus();
    const line = await lineOf(files[0], current.mat.find);
    const slot = document.getElementById('edit-line');
    if (line && slot) slot.innerHTML = `<a href="${R.urls.blob(files[0], line)}" target="_blank" rel="noopener">Открыть запись, строка ${line} ↗</a> · `;
  }
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-edit]'); if (b) open(b.dataset.edit); });

  function collect() {
    const v = n => F(n).value.trim(), kind = v('kind');
    const fields = { page: `${current.title} — ${location.href}`, module: modName(), kind, fragment: v('fragment'), proposal: v('proposal'), source: v('source'),
      coi: F('coi').checked ? 'Да: ' + (v('coiwho') || 'не указано') : 'Нет', contact: v('contact') };
    const short = kind.split(/[:,]| или /)[0];
    const title = `[${fields.module}] ${short}: ${current.title}`.slice(0, 140);
    return { fields, title };
  }
  function check({ fields }) {
    if (!fields.proposal) return 'Опишите, что предлагаете исправить или добавить.';
    if (!fields.source && !/^Опечатка/.test(fields.kind)) return 'Укажите источник: пункт нормы, страницу учебника или ссылку. Без источника правку не смогут проверить.';
    if (F('coi').checked && !F('coiwho').value.trim()) return 'Укажите, кого вы представляете: это увидит проверяющий.';
    return '';
  }
  const asText = ({ fields, title }) => [title, '', `Страница: ${fields.page}`, `Модуль: ${fields.module}`, `Вид правки: ${fields.kind}`,
    fields.fragment ? `Фрагмент: «${fields.fragment}»` : '', `Предложение: ${fields.proposal}`, `Источник: ${fields.source || '—'}`,
    `Конфликт интересов: ${fields.coi}`, fields.contact ? `Автор: ${fields.contact}` : '', current.mat.files ? `Файл данных: ${current.mat.files.join(', ')}` : ''].filter(Boolean).join('\n');
  form.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-send]'); if (!b) return;
    const c = collect(), problem = check(c);
    err.textContent = problem; err.hidden = !problem; if (problem) return;
    const cut = s => s.length > 1500 ? s.slice(0, 1500) + '…' : s;
    if (b.dataset.send === 'github') {
      const f = Object.fromEntries(Object.entries(c.fields).map(([k, x]) => [k, cut(x)]));
      window.open(R.urls.issue('pravka.yml', c.title, f), '_blank', 'noopener');
      dlg.close(); toast('Откроется GitHub: проверьте текст и нажмите «Create» («Создать»).');
    } else if (b.dataset.send === 'mail') {
      location.href = `mailto:${R.MAIL}?subject=${encodeURIComponent(c.title)}&body=${encodeURIComponent(cut(asText(c)))}`;
      dlg.close();
    } else {
      try { await navigator.clipboard.writeText(asText(c)); dlg.close(); toast('Текст правки скопирован. Отправьте его в Telegram или на почту из раздела «О проекте».'); }
      catch (e) { toast('Не удалось скопировать: браузер запретил доступ к буферу обмена.'); }
    }
  });

  /* ---------- раздел «Участвовать» на главной ---------- */
  function renderContribute() {
    const groups = ['water', 'base', 'related'];
    const S = R.STATUS;
    document.getElementById('contribute-root').innerHTML = `
      <header class="about-head"><h1>Участвовать</h1>
        <p class="about-lead">Сешат растёт как сетевая структура: предложить правку может любой — студент, инженер, преподаватель, сотрудник водоканала. На сайт правка попадает после двух проверок: автоматической и человеческой. Так платформа остаётся открытой и при этом проверяемой.</p></header>
      <section class="panel about-block" aria-labelledby="ct-how"><h2 id="ct-how">Как правка попадает на сайт</h2>
        <ol class="ct-steps">
          <li><b>Предложение.</b> Под каждой статьёй, документом, курсом и мифом есть кнопки «Предложить правку» и «Нашли ошибку?». В форме — что не так, что предлагаете и источник.</li>
          <li><b>Автоматическая проверка.</b> Тесты проверяют, что у документов, методик и мифов указаны источники, ссылки не ведут на пиратские сайты, а изменения не сломали страницы.</li>
          <li><b>Проверка человеком.</b> Куратор модуля или эксперт проверяет правку по существу. Автор правки и проверяющий — всегда разные люди.</li>
          <li><b>Публикация.</b> Правка появляется на сайте; кто, что и когда изменил, видно в открытой истории правок.</li>
        </ol></section>
      <section class="panel about-block" aria-labelledby="ct-st"><h2 id="ct-st">Статусы материалов</h2>
        <ul class="ct-status">${Object.entries(S).map(([k, s]) => `<li><span class="rv rv-${k}">${esc(s.t)}</span><span>${esc(s.d)}</span></li>`).join('')}</ul>
        <p class="hint">Статус виден под каждым материалом. Сейчас экспертных проверок ещё нет: все статьи проверены автоматически, курсы — черновики.</p></section>
      <section class="panel about-block" aria-labelledby="ct-roles"><h2 id="ct-roles">Роли</h2>
        <div class="ct-wrap"><table class="ct-table"><thead><tr><th>Роль</th><th>Кто</th><th>Что делает</th></tr></thead><tbody>${R.ROLES.map(([r, w, d]) => `<tr><td><b>${esc(r)}</b></td><td>${esc(w)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel about-block" aria-labelledby="ct-cur"><h2 id="ct-cur">Кураторы модулей</h2>
        <p>Куратор отвечает за модуль: принимает правки, назначает рецензентов и следит, чтобы нормы были действующими. Пока кураторов нет, правки проверяет автор проекта.</p>
        ${groups.map(g => `<h3 class="ct-sub">${esc(SeshatModules.GROUPS[g])}</h3><ul class="ct-cur">${MODS.filter(m => m.group === g).map(m => { const c = R.CURATORS[m.id];
          return `<li class="kind-${m.kind}"><a href="${ROOT + m.path}">${SeshatModules.glyph(m.id, 18)} ${esc(m.n)}</a><span>${c ? `${esc(c.name)}${c.org ? ', ' + esc(c.org) : ''}` : '<em>куратор не назначен</em>'}</span></li>`; }).join('')}</ul>`).join('')}
        <p class="ct-acts"><a class="btn primary" href="${R.urls.issue('kurator.yml', 'Стать куратором или рецензентом', {})}" target="_blank" rel="noopener">Стать куратором или рецензентом ↗</a><a class="btn" href="mailto:${R.MAIL}?subject=${encodeURIComponent('Сешат: стать куратором или рецензентом')}">Написать письмо</a></p></section>
      <section class="panel about-block" aria-labelledby="ct-rules"><h2 id="ct-rules">Правила качества</h2>
        <ul class="about-list">
          <li><b>Источник у каждого факта:</b> пункт нормы, страница учебника, данные измерений. Без источника правку не принимают.</li>
          <li><b>Нормы не копируем:</b> ссылаемся на пункт и пересказываем своими словами; файлы — только с официальных или легальных страниц.</li>
          <li><b>Конфликт интересов раскрывается:</b> сотрудник производителя может предложить правку о своём оборудовании, но обязан это указать; сравнения технологий — только по объективным критериям.</li>
          <li><b>История открыта:</b> каждое изменение сохраняется с автором и датой.</li>
          <li><b>Актуальность проверяется регулярно:</b> автоматическая проверка ссылок и сроков сверки документов раз в неделю.</li>
          <li><b>Лицензии:</b> тексты и иллюстрации — <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ru" target="_blank" rel="noopener">CC BY-SA 4.0 ↗</a>, код — <a href="${R.urls.blob('LICENSE')}" target="_blank" rel="noopener">MIT ↗</a>. Присылая правку, вы соглашаетесь, что она публикуется на тех же условиях; если вы оставили имя, оно сохраняется в истории правок.</li>
        </ul></section>
      <section class="panel about-block" aria-labelledby="ct-links"><h2 id="ct-links">Где следить</h2>
        <ul class="about-list">
          <li><a href="${R.urls.issues()}" target="_blank" rel="noopener">Предложенные правки и обсуждения ↗</a></li>
          <li><a href="${R.urls.commits()}" target="_blank" rel="noopener">История правок всего сайта ↗</a></li>
          <li><a href="${R.urls.guide()}" target="_blank" rel="noopener">Правила для авторов (CONTRIBUTING.md) ↗</a> — как устроены данные и как править исходники напрямую.</li>
        </ul></section>`;
  }
  if (document.getElementById('contribute-root')) VIEW_RENDER.contribute = renderContribute;
})();
