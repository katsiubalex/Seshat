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
  const MODS = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl', 'interior', 'fundamentals', 'basics', 'economics', 'decentral', 'safety', 'digital', 'construction', 'environment'];
  const GROUPS = ['Законы', 'Правила и порядок', 'Наилучшие доступные технологии', 'Проектирование и строительство', 'Нормативы качества воды и сбросов', 'Осадок сточных вод', 'Санитарная охрана', 'Стоимость строительства'];
  for (const d of DOCS) {
    assert.ok(d.mods === 'all' || (Array.isArray(d.mods) && d.mods.length && d.mods.every(m => MODS.includes(m))), d.id + ': модули');
    assert.ok(GROUPS.includes(d.group), d.id + ': смысловая группа');
  }
  for (const m of MODS.slice(0, 9)) { // модули кластера «Водная инфраструктура»; у заготовок документы подбираются
    const own = DOCS.filter(d => d.mods !== 'all' && d.mods.includes(m));
    assert.ok(own.length >= 1, m + ': есть документы только для модуля или группы модулей');
  }
  assert.ok(DOCS.filter(d => d.mods === 'all').length >= 2, 'есть общие для кластера документы');
});

test('структура документа: строки оглавления корректны, страницы — числа, изменения — № 1–5', () => {
  for (const d of DOCS.filter(x => x.toc)) {
    for (const r of d.toc) {
      assert.ok(typeof r[0] === 'string' && r[0] && typeof r[1] === 'string' && r[1], d.id + ': номер и название');
      assert.ok(r[2] == null || (Number.isInteger(r[2]) && r[2] > 0), `${d.id} ${r[0]}: страница`);
      if (r[3] !== undefined) assert.ok(Array.isArray(r[3]) && r[3].every(a => a >= 1 && a <= 5), `${d.id} ${r[0]}: изменения`);
    }
  }
  const sp = DOCS.find(d => d.id === 'sp32');
  assert.equal(sp.interactive, 'toc');
  assert.ok(sp.toc.length > 70);
  const row = n => sp.toc.find(r => r[0] === n);
  assert.deepEqual(row('5.4').slice(2, 4), [13, [5]], '5.4 — с. 13, изменён изм. № 5');
  assert.equal(row('7.8')[4], 'искл');
  assert.equal(row('Прил. И')[4], 'нов');
  assert.equal(row('Прил. И')[2], null, 'новых приложений в издании 2018 г. нет');
  for (const f of sp.find) assert.ok(Number.isInteger(f[3]), 'sp32: у каждой темы страница или 0 («в тексте изменения»)');
});

test('документы с калькулятором НЦС подключены к виджетам', () => {
  for (const id of ['ncs19', 'ncs14']) assert.equal(DOCS.find(d => d.id === id).interactive, id);
});
