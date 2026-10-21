// Тесты справочника документов. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { DOCS } = require('../js/docs.js');

test('у каждого документа есть суть, положения, ссылка на оригинал и корректные связи', () => {
  const ids = new Set(DOCS.map(d => d.id));
  assert.equal(ids.size, DOCS.length, 'id уникальны');
  for (const d of DOCS) {
    assert.match(d.id, /^[a-z0-9]+$/, d.id + ': id подходит для адреса #doc-…');
    assert.ok(d.title && d.about.length > 80 && d.points.length >= 2, d.id);
    assert.ok(d.links.length >= 1, d.id + ': есть оригинал');
    for (const [, url] of d.links) assert.match(url, /^https?:\/\//, d.id);
    for (const r of d.related || []) assert.ok(ids.has(r), `${d.id} → ${r}`);
  }
});

test('приказ № 552 помечен как утративший силу, действующий — № 296', () => {
  const pr = DOCS.find(d => d.id === 'pr296');
  assert.match(pr.about, /заменил приказ Минсельхоза России от 13\.12\.2016 № 552/);
  assert.ok(pr.links.some(([t]) => /утратил силу/.test(t)));
});
