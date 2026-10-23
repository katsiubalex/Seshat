#!/usr/bin/env node
// Перенос статей из старых JS-файлов (js/kb.js, js/myths.js, js/glossary.js) в Markdown-файлы content/… — по одному файлу на статью.
// Запускается один раз для каждой коллекции; существующие файлы не перезаписываются (ключ --force — перезаписать).
// Пример: node tools/migrate-content.js processes indicators   ·   без аргументов — все коллекции, у которых есть данные.
const fs = require('node:fs'), path = require('node:path');
const MD = require('../js/mdcontent.js');
const root = path.join(__dirname, '..');
const force = process.argv.includes('--force');
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));

// данные берём из старых файлов, если в них ещё есть массивы статей (до перехода на content.js)
function legacy(coll) {
  const C = MD.COLLECTIONS[coll];
  if (coll === 'glossary') { const src = path.join(root, 'js/glossary.js'); delete require.cache[src]; require(src); const G = (globalThis.SeshatGlossary || {}).G; return G && G.length && !G.fromContent ? G : null; }
  if (coll === 'myths') { const src = path.join(root, 'js/myths.js'); delete require.cache[src]; const M = require(src); return M.GODS && M.GODS.length ? M.GODS : null; }
  const src = path.join(root, 'js/kb.js'); delete require.cache[src]; const K = require(src);
  return K[C.kbKey] && K[C.kbKey].length ? K[C.kbKey] : null;
}
let total = 0;
for (const coll of want.length ? want : Object.keys(MD.COLLECTIONS)) {
  const C = MD.COLLECTIONS[coll], data = legacy(coll);
  if (!C) { console.error('Нет коллекции ' + coll); process.exitCode = 1; continue; }
  if (!data) { console.log(`${coll}: в старых файлах данных нет — пропускаю`); continue; }
  fs.mkdirSync(path.join(root, C.dir), { recursive: true });
  data.forEach((x, i) => {
    const doc = C.fromData(x); doc.meta = { ...doc.meta, order: (i + 1) * 10 };
    const file = path.join(root, C.dir, x.id + '.md');
    if (fs.existsSync(file) && !force) return;
    fs.writeFileSync(file, MD.serialize(doc)); total++;
  });
  console.log(`${coll}: ${data.length} статей → ${C.dir}`);
}
console.log(`Записано файлов: ${total}`);
