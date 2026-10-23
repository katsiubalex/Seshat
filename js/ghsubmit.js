// Отправка правки статьи на проверку прямо из редактора — через API GitHub, без копирования текста вручную.
// Порядок: кто вы (по ключу доступа) → куда писать: в сам репозиторий, если у вас есть права на запись, иначе в вашу копию
// (форк, создаётся сам) → новая ветка от актуального main → файл статьи в этой ветке → запрос на слияние (pull request)
// в основной репозиторий. Дальше правку проверяют тесты и куратор модуля; на сайт она попадает только после слияния.
// Ключ доступа (personal access token) хранится только в памяти страницы или, по желанию, до закрытия вкладки.
// Модуль работает в браузере и в Node (тесты подменяют fetch).
(function (root) {
  const API = 'https://api.github.com';
  // UTF-8 → base64 без устаревших escape/unescape: так требует API для содержимого файла
  function b64(text) {
    if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
    const bytes = new TextEncoder().encode(text); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // адрес новой ветки: латиница, цифры и дефис, с отметкой времени — чтобы две правки не столкнулись
  const branchName = (path, now = new Date()) => 'pravka/' + (path.replace(/^.*\//, '').replace(/\.md$/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '').slice(0, 40) || 'statya')
    + '-' + now.toISOString().slice(0, 16).replace(/[-:T]/g, '');

  class GHError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
  // понятные сообщения вместо кодов API
  function explain(status, what, data) {
    const m = (data && data.message) || '';
    if (status === 401) return 'GitHub не принял ключ доступа: он неверный или истёк. Создайте новый ключ.';
    if (status === 403 && /rate limit/i.test(m)) return 'GitHub временно ограничил число запросов. Попробуйте через несколько минут.';
    if (status === 403 || /not accessible by personal access token/i.test(m)) return `У ключа не хватает прав (${what}). Для классического ключа нужна область public_repo.`;
    if (status === 404) return `GitHub не нашёл ${what}. Проверьте, что у ключа есть доступ к публичным репозиториям.`;
    if (status === 409) return `Конфликт при записи (${what}): файл успел измениться. Обновите страницу и повторите.`;
    if (status === 422) return `GitHub отклонил запрос (${what})${m ? ': ' + m : ''}.`;
    return `Ошибка GitHub при шаге «${what}» (${status}${m ? ': ' + m : ''}).`;
  }

  function client(token, fetchImpl) {
    const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    return async function call(method, url, body, what, ok404) {
      const r = await f(API + url, { method, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined });
      let data = null; try { data = await r.json(); } catch (e) { /* пустой ответ */ }
      if (r.status === 404 && ok404) return null;
      if (r.status >= 400) throw new GHError(explain(r.status, what, data), r.status);
      return data;
    };
  }

  // Проверка ключа: чей он и можно ли писать в репозиторий напрямую
  async function whoami({ token, repo, fetch: fx }) {
    const call = client(token, fx);
    const user = await call('GET', '/user', null, 'проверка ключа');
    const info = await call('GET', `/repos/${repo}`, null, 'репозиторий ' + repo);
    return { login: user.login, name: user.name || user.login, push: !!(info.permissions && info.permissions.push), base: info.default_branch || 'main' };
  }

  // Основное действие. step(текст) — сообщение о ходе работы для интерфейса.
  async function submit({ token, repo, path, content, title, body, base, fetch: fx, step = () => {}, now, pollMs = 1500 }) {
    const call = client(token, fx);
    step('Проверяю ключ доступа…');
    const me = await whoami({ token, repo, fetch: fx });
    base = base || me.base;
    let target = repo;
    if (!me.push) {
      step('Создаю вашу копию репозитория (форк)…');
      const fork = await call('POST', `/repos/${repo}/forks`, { default_branch_only: true }, 'создание копии');
      target = fork.full_name;
      // GitHub создаёт копию не мгновенно — ждём, пока она откроется
      for (let i = 0; i < 10; i++) { if (await call('GET', `/repos/${target}`, null, 'копия репозитория', true)) break; await wait(pollMs); }
      step('Обновляю копию до актуальной версии…');
      try { await call('POST', `/repos/${target}/merge-upstream`, { branch: base }, 'обновление копии'); } catch (e) { /* копия свежая или обновится позже — ветку всё равно создаём от main основного репозитория */ }
    }
    step('Создаю ветку для правки…');
    const ref = await call('GET', `/repos/${repo}/git/ref/heads/${base}`, null, 'ветка ' + base);
    const branch = branchName(path, now);
    await call('POST', `/repos/${target}/git/refs`, { ref: 'refs/heads/' + branch, sha: ref.object.sha }, 'создание ветки');
    step('Записываю файл статьи…');
    const enc = path.split('/').map(encodeURIComponent).join('/');
    const old = await call('GET', `/repos/${target}/contents/${enc}?ref=${encodeURIComponent(branch)}`, null, 'файл ' + path, true);
    await call('PUT', `/repos/${target}/contents/${enc}`, { message: title, content: b64(content), branch, ...(old && old.sha ? { sha: old.sha } : {}) }, 'запись файла');
    step('Открываю запрос на проверку…');
    const pr = await call('POST', `/repos/${repo}/pulls`, { title, body, head: (target === repo ? '' : me.login + ':') + branch, base, maintainer_can_modify: true }, 'запрос на слияние');
    return { url: pr.html_url, number: pr.number, branch, target, isNew: !old, login: me.login };
  }

  // ссылка на создание классического ключа с нужной областью и подписью
  const tokenUrl = () => 'https://github.com/settings/tokens/new?scopes=public_repo&description=' + encodeURIComponent('Сешат — правки статей');
  const api = { submit, whoami, b64, branchName, tokenUrl, GHError };
  root.SeshatGH = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
