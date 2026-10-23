// Статьи в отдельных Markdown-файлах: разбор, запись, сборка в js/content.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MD = require('../js/mdcontent.js');
const { build } = require('../tools/build-content.js');
const root = path.join(__dirname, '..');

const files = Object.entries(MD.COLLECTIONS).flatMap(([coll, C]) => { const d = path.join(root, C.dir); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.md')).map(f => [coll, path.join(C.dir, f)]) : []; });

test('js/content.js собран из актуальных Markdown-файлов', () => {
  const r = build();
  assert.deepEqual(r.problems, []);
  assert.equal(fs.readFileSync(path.join(root, 'js/content.js'), 'utf8'), r.js, 'выполните node tools/build-content.js');
  assert.ok(r.count >= 60);
});

test('каждый файл: без ошибок, имя совпадает с id, запись не меняет файл', () => {
  for (const [coll, f] of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8'), doc = MD.parse(text);
    assert.deepEqual(MD.validate(coll, doc).err, [], f);
    assert.equal(path.basename(f), doc.meta.id + '.md', f);
    assert.equal(MD.serialize(doc), text, f + ': файл не в каноническом виде');
  }
});

test('данные статьи переживают путь «данные → файл → данные» без потерь', () => {
  const C = require('../js/content.js');
  for (const [coll, list] of Object.entries(C)) for (const x of list) {
    const doc = MD.COLLECTIONS[coll].fromData(x);
    assert.deepEqual(MD.COLLECTIONS[coll].toData(MD.parse(MD.serialize(doc))), x, coll + '/' + x.id);
  }
});

test('заголовок понимает то, что пишут редакторы (Decap CMS): кавычки, блоки |, >, списки записей', () => {
  const y = MD.parseYaml([
    'id: test', 'title: "Нитрификация: две ступени"', "name: 'Ю Великий'", 'order: 30', 'empty: []', 'inline: [a, b]',
    'legend: >-', '  Первая строка', '  вторая строка', 'lead: |', '  абзац 1', '', '  абзац 2',
    'mods:', '  - module: tlaloc', '    why: "дождь: сток"', '  - module: hapi', '    why: разлив', 'tags:', '  - один', '  - "два: три"'
  ].join('\n'));
  assert.equal(y.title, 'Нитрификация: две ступени'); assert.equal(y.name, 'Ю Великий'); assert.equal(y.order, '30');
  assert.deepEqual(y.empty, []); assert.deepEqual(y.inline, ['a', 'b']);
  assert.equal(y.legend, 'Первая строка вторая строка'); assert.equal(y.lead, 'абзац 1\n\nабзац 2');
  assert.deepEqual(y.mods, [{ module: 'tlaloc', why: 'дождь: сток' }, { module: 'hapi', why: 'разлив' }]);
  assert.deepEqual(y.tags, ['один', 'два: три']);
  // и обратно: строки с двоеточием и числами в кавычках не ломают разбор
  const meta = { id: 'x', title: 'A: b', order: 10, list: ['- c', '# d'], mods: [{ module: 'm', why: 'w: z' }] };
  assert.deepEqual(MD.parseYaml(MD.dumpYaml(meta)), { ...meta, order: '10' });
});

test('проверка статьи ловит главные ошибки', () => {
  const bad = MD.parse('---\nid: Bad Id\n---\n\n## Пусто\n');
  const v = MD.validate('processes', bad);
  assert.ok(v.err.some(e => /id/.test(e))); assert.ok(v.err.some(e => /title/.test(e))); assert.ok(v.err.some(e => /вводного абзаца/.test(e)));
  const myth = MD.parse('---\nid: x\nname: X\n---\n\n## Имя: Икс\nТекст.\n');
  assert.ok(MD.validate('myths', myth).err.some(e => /источник/.test(e)));
});
