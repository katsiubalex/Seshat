// Отправка правки из редактора через API GitHub: проверяем порядок запросов на подменённом fetch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const GH = require('../js/ghsubmit.js');

// поддельный GitHub: отвечает по таблице «метод адрес → [код, тело]» и записывает все запросы
function fakeGitHub(routes) {
  const calls = [];
  const fetch = async (url, opt) => {
    const key = `${opt.method} ${url.replace('https://api.github.com', '')}`;
    calls.push({ key, body: opt.body ? JSON.parse(opt.body) : null, auth: opt.headers.Authorization });
    const hit = Object.entries(routes).find(([k]) => (k.endsWith('*') ? key.startsWith(k.slice(0, -1)) : key === k));
    const [status, body] = hit ? (typeof hit[1] === 'function' ? hit[1]() : hit[1]) : [500, { message: 'нет маршрута ' + key }];
    return { status, json: async () => body };
  };
  return { fetch, calls };
}
const now = new Date('2026-10-23T07:15:00Z');
const base = {
  'GET /user': [200, { login: 'ivanova', name: 'Анна Иванова' }],
  'GET /repos/katsiubalex/Seshat/git/ref/heads/main': [200, { object: { sha: 'abc123' } }]
};

test('куратор с правом записи: ветка в самом репозитории, файл заменяется, запрос на слияние из ветки', async () => {
  const gh = fakeGitHub({ ...base,
    'GET /repos/katsiubalex/Seshat': [200, { default_branch: 'main', permissions: { push: true } }],
    'POST /repos/katsiubalex/Seshat/git/refs': [201, {}],
    'GET /repos/katsiubalex/Seshat/contents/*': [200, { sha: 'old-file-sha' }],
    'PUT /repos/katsiubalex/Seshat/contents/*': [200, {}],
    'POST /repos/katsiubalex/Seshat/pulls': [201, { html_url: 'https://github.com/katsiubalex/Seshat/pull/7', number: 7 }] });
  const steps = [];
  const r = await GH.submit({ token: 't0k', repo: 'katsiubalex/Seshat', path: 'content/kb/processes/nitrification.md', content: '---\nid: nitrification\n---\nНитрификация\n',
    title: 'Правка статьи «Нитрификация»', body: 'описание', fetch: gh.fetch, step: m => steps.push(m), now });
  assert.equal(r.number, 7); assert.equal(r.target, 'katsiubalex/Seshat'); assert.equal(r.isNew, false);
  assert.equal(r.branch, 'pravka/nitrification-202610230715');
  assert.ok(!gh.calls.some(c => c.key.includes('/forks')), 'форк не нужен');
  const ref = gh.calls.find(c => c.key === 'POST /repos/katsiubalex/Seshat/git/refs');
  assert.deepEqual(ref.body, { ref: 'refs/heads/pravka/nitrification-202610230715', sha: 'abc123' });
  const put = gh.calls.find(c => c.key.startsWith('PUT'));
  assert.equal(put.body.sha, 'old-file-sha'); assert.equal(put.body.branch, r.branch);
  assert.equal(Buffer.from(put.body.content, 'base64').toString('utf8'), '---\nid: nitrification\n---\nНитрификация\n');
  const pr = gh.calls.find(c => c.key.endsWith('/pulls'));
  assert.equal(pr.body.head, r.branch); assert.equal(pr.body.base, 'main');
  assert.ok(gh.calls.every(c => c.auth === 'Bearer t0k'));
  assert.ok(steps.length >= 4);
});

test('читатель без прав: копия (форк), её обновление, новый файл, запрос из копии', async () => {
  const gh = fakeGitHub({ ...base,
    'GET /repos/katsiubalex/Seshat': [200, { default_branch: 'main', permissions: { push: false } }],
    'POST /repos/katsiubalex/Seshat/forks': [202, { full_name: 'ivanova/Seshat' }],
    'GET /repos/ivanova/Seshat': [200, { full_name: 'ivanova/Seshat' }],
    'POST /repos/ivanova/Seshat/merge-upstream': [409, { message: 'conflict' }], // не страшно: ветку берём от main основного репозитория
    'POST /repos/ivanova/Seshat/git/refs': [201, {}],
    'GET /repos/ivanova/Seshat/contents/*': [404, { message: 'Not Found' }],
    'PUT /repos/ivanova/Seshat/contents/*': [201, {}],
    'POST /repos/katsiubalex/Seshat/pulls': [201, { html_url: 'https://github.com/katsiubalex/Seshat/pull/8', number: 8 }] });
  const r = await GH.submit({ token: 'x', repo: 'katsiubalex/Seshat', path: 'content/myths/new-myth.md', content: 'текст', title: 'Новая статья', body: '', fetch: gh.fetch, now, pollMs: 0 });
  assert.equal(r.target, 'ivanova/Seshat'); assert.equal(r.isNew, true);
  assert.ok(!('sha' in gh.calls.find(c => c.key.startsWith('PUT')).body), 'у нового файла нет sha');
  assert.equal(gh.calls.find(c => c.key.endsWith('/pulls')).body.head, 'ivanova:' + r.branch);
});

test('понятные ошибки: неверный ключ, нет прав', async () => {
  const bad = fakeGitHub({ 'GET /user': [401, { message: 'Bad credentials' }] });
  await assert.rejects(GH.submit({ token: 'x', repo: 'a/b', path: 'p.md', content: '', title: '', body: '', fetch: bad.fetch }), /не принял ключ/);
  const ro = fakeGitHub({ ...base, 'GET /repos/a/b': [200, { permissions: { push: true } }], 'GET /repos/a/b/git/ref/heads/main': [200, { object: { sha: 's' } }],
    'POST /repos/a/b/git/refs': [403, { message: 'Resource not accessible by personal access token' }] });
  await assert.rejects(GH.submit({ token: 'x', repo: 'a/b', path: 'p.md', content: '', title: '', body: '', fetch: ro.fetch }), /не хватает прав/);
});

test('кириллица в base64 и имя ветки', () => {
  assert.equal(Buffer.from(GH.b64('Ёжик — ёж'), 'base64').toString('utf8'), 'Ёжик — ёж');
  assert.equal(GH.branchName('content/kb/processes/Нитр ификация.md', now), 'pravka/statya-202610230715');
  assert.match(GH.tokenUrl(), /scopes=public_repo/);
});

test('редактор подключает отправку на проверку до себя', () => {
  const h = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  assert.ok(h.indexOf('js/ghsubmit.js') > 0 && h.indexOf('js/ghsubmit.js') < h.indexOf('js/editor.js'));
});
