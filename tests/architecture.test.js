// ARCHITECTURE.md — документ для онбординга; он должен описывать каждый файл js/ и не описывать несуществующих.
// AGENTS.md п. 23: новый файл js/*.js — строка в ARCHITECTURE.md.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const arch = fs.readFileSync(path.join(root, 'ARCHITECTURE.md'), 'utf8');
const files = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));

test('каждый файл js/*.js описан в ARCHITECTURE.md', () => {
  const missing = files.filter(f => !arch.includes('`' + f + '`') && !arch.includes('`' + f.replace(/\.js$/, '') + '`') && !new RegExp('\\b' + f.replace(/\.js$/, '') + '\\b').test(arch));
  assert.deepStrictEqual(missing, [], 'не описаны: ' + missing.join(', '));
});

test('ARCHITECTURE.md не ссылается на несуществующие файлы js/', () => {
  const mentioned = [...arch.matchAll(/`([a-z0-9-]+\.js)`/g)].map(m => m[1]).filter(f => !f.includes('/'));
  const ghosts = [...new Set(mentioned)].filter(f => !files.includes(f));
  assert.deepStrictEqual(ghosts, [], 'нет таких файлов: ' + ghosts.join(', '));
});

test('ARCHITECTURE.md называет текущую версию', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(arch.includes('**' + version + '**'), `в ARCHITECTURE.md нет версии ${version}`);
});

test('CHANGELOG.md начинается с текущей версии', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const first = log.match(/^## (\d+\.\d+\.\d+)/m);
  assert.ok(first && first[1] === version, `первая запись CHANGELOG — ${first && first[1]}, версия — ${version}`);
});
