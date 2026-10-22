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

test('каждый документ привязан к модулям кластера, и у каждого модуля есть свои документы', () => {
  const MODS = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl'];
  const GROUPS = ['Законы', 'Правила и порядок', 'Наилучшие доступные технологии', 'Проектирование и строительство', 'Нормативы качества воды и сбросов', 'Санитарная охрана'];
  for (const d of DOCS) {
    assert.ok(d.mods === 'all' || (Array.isArray(d.mods) && d.mods.length && d.mods.every(m => MODS.includes(m))), d.id + ': модули');
    assert.ok(GROUPS.includes(d.group), d.id + ': смысловая группа');
  }
  for (const m of MODS) {
    const own = DOCS.filter(d => d.mods !== 'all' && d.mods.includes(m));
    assert.ok(own.length >= 1, m + ': есть документы только для модуля или группы модулей');
  }
  assert.ok(DOCS.filter(d => d.mods === 'all').length >= 2, 'есть общие для кластера документы');
});
