#!/usr/bin/env node
// Сборка статей: content/**/*.md → js/content.js (данные, которые читает сайт).
// node tools/build-content.js — собрать; node tools/build-content.js --check — только проверить, что js/content.js актуален.
// Ошибки в статьях (нет id, названия, вводного абзаца…) останавливают сборку; предупреждения печатаются.
const fs = require('node:fs'), path = require('node:path');
const MD = require('../js/mdcontent.js');
const root = path.join(__dirname, '..');

function build() {
  const out = {}, problems = [], warnings = [];
  for (const [coll, C] of Object.entries(MD.COLLECTIONS)) {
    const dir = path.join(root, C.dir);
    if (!fs.existsSync(dir)) { out[coll] = []; continue; }
    const docs = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
      const doc = MD.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const v = MD.validate(coll, doc);
      v.err.forEach(e => problems.push(`${C.dir}/${f}: ${e}`)); v.warn.forEach(w => warnings.push(`${C.dir}/${f}: ${w}`));
      if (doc.meta.id && doc.meta.id + '.md' !== f) problems.push(`${C.dir}/${f}: имя файла должно совпадать с id (${doc.meta.id}.md).`);
      return doc;
    });
    const ids = new Set(); docs.forEach(d => { if (ids.has(d.meta.id)) problems.push(`${C.dir}: повторяется id ${d.meta.id}`); ids.add(d.meta.id); });
    out[coll] = MD.ordered(docs).map(C.toData);
  }
  // схемы к статьям: content/kb/fig/<имя>.svg → SeshatFigs[имя] (встраиваются в страницу, чтобы работали цвета темы)
  const figDir = path.join(root, 'content/kb/fig'), figs = {};
  if (fs.existsSync(figDir)) fs.readdirSync(figDir).filter(f => f.endsWith('.svg')).sort().forEach(f => {
    const svg = fs.readFileSync(path.join(figDir, f), 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim();
    if (!/^<svg[\s>]/.test(svg) || /<script|on\w+=/i.test(svg)) problems.push(`content/kb/fig/${f}: не SVG или содержит скрипты`);
    else figs[f.slice(0, -4)] = svg;
  });
  // ссылки статей на схемы: файл должен существовать
  for (const [coll, C] of Object.entries(MD.COLLECTIONS)) if (C.rich) (out[coll] || []).forEach(x => [x.lead, ...x.s.map(s => s[1])].forEach(t => {
    for (const m of String(t).matchAll(/!\[[^\]]*\]\(fig\/([\w-]+)\.svg\)/g)) if (!figs[m[1]]) problems.push(`${C.dir}/${x.id}.md: нет схемы content/kb/fig/${m[1]}.svg`);
  }));
  const js = `// Собрано из content/**/*.md командой node tools/build-content.js — не править вручную: правьте Markdown-файлы.\n` +
    `(function (root) {\n  const C = ${JSON.stringify(out, null, 1).replace(/\n/g, '\n  ')};\n  root.SeshatContent = C;\n  root.SeshatFigs = ${JSON.stringify(figs)};\n  if (typeof module !== 'undefined') module.exports = C;\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n`;
  return { js, problems, warnings, count: Object.values(out).reduce((s, a) => s + a.length, 0) };
}
if (require.main === module) {
  const r = build(), file = path.join(root, 'js/content.js');
  if (process.argv.includes('--verbose')) r.warnings.forEach(w => console.warn('предупреждение: ' + w));
  else if (r.warnings.length) { const noSrc = r.warnings.filter(w => /Источники/.test(w)).length; console.warn(`Предупреждений: ${r.warnings.length}${noSrc ? `, из них статей без раздела «Источники»: ${noSrc}` : ''}. Список — с ключом --verbose.`); }
  if (r.problems.length) { r.problems.forEach(p => console.error('ошибка: ' + p)); process.exit(1); }
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur !== r.js) { console.error('js/content.js устарел: выполните node tools/build-content.js'); process.exit(1); }
    console.log(`js/content.js актуален: ${r.count} статей`);
  } else { fs.writeFileSync(file, r.js); console.log(`Собрано статей: ${r.count} → js/content.js`); }
}
module.exports = { build };
