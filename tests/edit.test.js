// Правки от пользователей: статусы, кнопки на всех страницах, форма GitHub и поиск записи в файлах данных.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/review.js');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('статусы материалов и роли описаны', () => {
  assert.deepEqual(Object.keys(R.STATUS), ['draft', 'auto', 'expert']);
  assert.equal(R.statusOf('course-tz-intro', 'courses').s, 'draft');
  assert.equal(R.statusOf('kb-p-nitrification', 'kb').s, 'auto');
  for (const [k, v] of Object.entries(R.ITEMS)) assert.ok(v.s === 'expert' && v.by && v.date, k); // экспертная отметка — с именем и датой
  assert.ok(R.ROLES.length >= 5);
});

test('кнопки правки подключены на главной и на всех страницах модулей', () => {
  const pages = ['index.html', ...require('../js/modules.js').MODULES.map(m => m.path + 'index.html')];
  for (const p of pages) {
    const h = read(p);
    assert.match(h, /js\/review\.js/, p); assert.match(h, /js\/edit\.js/, p);
    assert.ok(h.indexOf('js/edit.js') < h.indexOf('js/seshat.js'), p + ': edit.js до запуска страницы');
  }
  assert.match(read('index.html'), /id="view-contribute"/);
});

test('форма на GitHub принимает все поля, которые заполняет сайт', () => {
  const sent = [...read('js/edit.js').matchAll(/const fields = \{([^}]+)\}/g)][0][1].match(/\b(\w+):/g).map(x => x.slice(0, -1));
  const form = [...read('.github/ISSUE_TEMPLATE/pravka.yml').matchAll(/^\s+id: (\w+)$/gm)].map(m => m[1]);
  for (const f of sent) assert.ok(form.includes(f), 'нет поля ' + f + ' в pravka.yml');
  assert.match(read('js/edit.js'), /issue\('pravka\.yml'/);
  assert.ok(fs.existsSync(path.join(root, '.github/ISSUE_TEMPLATE/kurator.yml')));
});

test('запись материала находится в файле данных — ссылка ведёт на нужный файл или строку', () => {
  const docs = read('js/docs.js'), courses = read('js/courses.js');
  const KB = require('../js/kb.js'), dirs = [['processes', KB.PROCESSES], ['indicators', KB.INDICATORS], ['aux', KB.AUX], ['fundamentals', KB.FUNDAMENTALS], ['humanities', KB.HUMANITIES]];
  for (const [d, list] of dirs) for (const x of list) assert.ok(fs.existsSync(path.join(root, `content/kb/${d}/${x.id}.md`)), d + '/' + x.id);
  for (const g of require('../js/myths.js').GODS) assert.ok(fs.existsSync(path.join(root, `content/myths/${g.id}.md`)), g.id);
  for (const d of require('../js/docs.js').DOCS) assert.match(docs, new RegExp(`id: '${d.id}'`), d.id);
  for (const c of require('../js/courses.js').C) assert.match(courses, new RegExp(`id: '${c.id}'`), c.id);
});
