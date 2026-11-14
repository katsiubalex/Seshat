#!/usr/bin/env node
// Числа для месячного отчёта (docs/reports/). node tools/metrics.js [--md]
// Считает по файлам репозитория; посещаемость и задачи GitHub добавляются вручную.
const fs = require('node:fs'), path = require('node:path'), { execSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const md = walk('content').filter(f => f.endsWith('.md'));
const texts = md.map(read);
const noSource = texts.reduce((n, t) => n + (t.match(/\[\^\?\]/g) || []).length, 0);
const noSourceFiles = texts.filter(t => /\[\^\?\]/.test(t)).length;
const needArticle = texts.reduce((n, t) => n + (t.match(/==[^=\n]+==/g) || []).length, 0);
const est = (read('js/dwcalc.js').match(/\bEST\b/g) || []).length;

const review = read('js/review.js');
const expert = (review.match(/^\s*'[^']+':\s*\{\s*s:\s*'expert'/gm) || []).length; // записи ITEMS, не комментарий
const curators = (review.match(/CURATORS\s*=\s*\{([^}]*)\}/s) || [, ''])[1].trim() ? 'есть' : 0;

const docs = read('js/docs.js');
const docCount = (docs.match(/^\s*\{\s*id:\s*'/gm) || []).length;
const checked = (docs.match(/checked:\s*\['/g) || []).length;

const sh = c => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };
const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const commits = sh(`git log --since=${since} --format=%an`).split('\n').filter(Boolean);
const others = commits.filter(a => !/^(Claude|katsiubalex|github-actions)/i.test(a)).length;
const tests = walk('tests').filter(f => f.endsWith('.test.js')).length;
const version = JSON.parse(read('package.json')).version;

const rows = [
  ['Версия', version],
  ['Статей (Markdown)', md.length],
  ['Проверено экспертом (review.js)', expert],
  ['Абзацев без источника [^?] / статей с ними', `${noSource} / ${noSourceFiles}`],
  ['Пометок «нужна статья»', needArticle],
  ['Оценочных значений EST в dwcalc', est],
  ['Нормативных документов / с датой проверки', `${docCount} / ${checked}`],
  ['Файлов тестов', tests],
  ['Коммитов за 30 дней / не от автора и агента', `${commits.length} / ${others}`],
  ['Кураторов', curators],
  ['Посетителей в неделю', '— (аналитика)'],
  ['Открытых задач / закрыто за месяц', '— (GitHub)']
];
if (process.argv.includes('--md')) { console.log('| Число | Значение |\n|---|---|'); rows.forEach(([k, v]) => console.log(`| ${k} | ${v} |`)); }
else rows.forEach(([k, v]) => console.log(`${k}: ${v}`));
