#!/usr/bin/env node
// Еженедельная проверка актуальности: внешние ссылки в данных сайта и давность сверки нормативных документов.
// Запуск: node tools/check-links.js [--report отчёт.md]. Код выхода 1 — есть битые ссылки или документы, которые давно не сверяли.
// Сайты, которые закрываются от роботов (401, 403, 429), считаются предупреждением, а не ошибкой.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const STALE_DAYS = 365; // документ считается давно не сверенным через год
const SKIP = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /katsiubalex\.github\.io/, /github\.com\/katsiubalex/, /example\.(com|org)/];

const files = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => path.join('js', f));
const found = new Map(); // ссылка → файлы
for (const f of files) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s'"`<>)\]]+/g)) {
    const u = m[0].replace(/[.,;]+$/, '').replace(/\$\{.*$/, '');
    if (!/^https?:\/\/[^/]+\.[^/]+/.test(u) || SKIP.some(r => r.test(u))) continue;
    if (!found.has(u)) found.set(u, new Set());
    found.get(u).add(f);
  }
}

async function probe(u) {
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (Seshat link check; +https://katsiubalex.github.io/Seshat/)' } };
  try {
    let r = await fetch(u, { ...opts, method: 'HEAD' });
    if ([403, 405, 501].includes(r.status) || r.status >= 500) r = await fetch(u, { ...opts, method: 'GET' });
    return r.status;
  } catch (e) { return 'ошибка сети: ' + (e.cause && e.cause.code || e.name); }
}

async function run() {
  const list = [...found.keys()], res = [];
  for (let i = 0; i < list.length; i += 6) res.push(...await Promise.all(list.slice(i, i + 6).map(async u => [u, await probe(u)])));
  const broken = res.filter(([, s]) => typeof s !== 'number' || (s >= 400 && ![401, 403, 429].includes(s)));
  const warn = res.filter(([, s]) => [401, 403, 429].includes(s));

  // давность сверки документов: checked = ['ДД.ММ.ГГГГ' | 'ММ.ГГГГ', пояснение]
  const { DOCS } = require(path.join(root, 'js/docs.js'));
  const now = Date.now(), stale = [];
  for (const d of DOCS) {
    const c = d.checked && d.checked[0]; if (!c) { stale.push([d.short, 'дата сверки не указана']); continue; }
    const p = c.split('.').map(Number), [dd, mm, yy] = p.length === 3 ? p : [1, ...p];
    const days = (now - Date.UTC(yy, mm - 1, dd)) / 864e5;
    if (days > STALE_DAYS) stale.push([d.short, `сверен ${c}, ${Math.round(days)} дн. назад`]);
  }

  const lines = [`# Проверка актуальности Сешат — ${new Date().toISOString().slice(0, 10)}`, '',
    `Ссылок проверено: ${res.length}. Битых: ${broken.length}. Сайт не пустил робота: ${warn.length}. Документов без свежей сверки: ${stale.length}.`, ''];
  if (broken.length) lines.push('## Битые ссылки', '', ...broken.map(([u, s]) => `- [ ] ${u} — ${s} (${[...found.get(u)].join(', ')})`), '');
  if (stale.length) lines.push(`## Документы, которые давно не сверяли (больше ${STALE_DAYS} дней)`, '', ...stale.map(([n, w]) => `- [ ] ${n} — ${w}`), '');
  if (warn.length) lines.push('## Проверить вручную (сайт закрыт от роботов)', '', ...warn.map(([u, s]) => `- ${u} — ${s}`), '');
  const report = lines.join('\n');
  const i = process.argv.indexOf('--report');
  if (i > 0 && process.argv[i + 1]) fs.writeFileSync(process.argv[i + 1], report);
  console.log(report);
  process.exitCode = broken.length || stale.length ? 1 : 0;
}
run();
