// Каждый подключённый в index.html файл стилей и скриптов должен иметь ?v=<версия из package.json>,
// иначе после обновления браузеры могут взять старый файл из кэша.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { version } = require('../package.json');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:href|src)="((?:css|js|assets)\/[^"]+)"/g)].map(m => m[1]);

test('все локальные файлы подключены с актуальной версией', () => {
  assert.ok(refs.length >= 5);
  for (const r of refs) assert.match(r, new RegExp(`\\?v=${version.replace(/\./g, '\\.')}$`), r);
});

test('подключённые файлы существуют', () => {
  for (const r of refs) assert.ok(fs.existsSync(path.join(root, r.split('?')[0])), r);
});
