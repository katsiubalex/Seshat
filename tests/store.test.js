// Тесты библиотеки пользователя. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const S = require('../js/store.js');

const city = D.PRESETS[0];
const influent = { q: city.q, c: { ...city.c } };
const scheme = { steps: [{ u: 'primary', eff: { ss: 50 } }, { u: 'a2o', eff: { bod: 95, nit: 95 } }] };
const norm = { v: { ...D.NORMS.target.v } };
const fresh = () => { const a = S.memoryAdapter(); return { a, s: S.createStore(a) }; };

test('сохраняет, обновляет и удаляет записи всех трёх видов', () => {
  const { s } = fresh();
  const i = s.save('influent', { name: 'Город', data: influent });
  const sc = s.save('scheme', { name: 'Схема 1', data: scheme });
  const n = s.save('norm', { name: 'Мои нормы', data: norm });
  assert.ok(i && sc && n);
  assert.equal(s.count(), 3);
  s.save('influent', { id: i.id, name: 'Город, лето', data: { ...influent, q: 25000 } });
  assert.equal(s.get('influent', i.id).name, 'Город, лето');
  assert.equal(s.get('influent', i.id).data.q, 25000);
  assert.equal(s.list('influent').length, 1);
  assert.ok(s.remove('scheme', sc.id));
  assert.equal(s.get('scheme', sc.id), null);
});

test('данные переживают перезапуск (читаются из адаптера заново)', () => {
  const { a, s } = fresh();
  s.save('norm', { name: 'Нормы', data: norm });
  const s2 = S.createStore(a);
  assert.equal(s2.list('norm')[0].name, 'Нормы');
});

test('не сохраняет пустое имя и негодные данные', () => {
  const { s } = fresh();
  assert.equal(s.save('influent', { name: '  ', data: influent }), null);
  assert.equal(s.save('influent', { name: 'x', data: { q: -5, c: {} } }), null);
  assert.equal(s.save('scheme', { name: 'x', data: { steps: [{ u: 'нет-такой', eff: {} }] } }), null);
  assert.equal(s.count(), 0);
});

test('нормализует данные: недостающие показатели, проценты вне 0–100', () => {
  const { s } = fresh();
  const i = s.save('influent', { name: 'Неполный', data: { q: 10, c: { bod: 100 } } });
  assert.equal(i.data.c.nh4, 0);
  const sc = s.save('scheme', { name: 'S', data: { steps: [{ u: 'at', eff: { bod: 140, cod: -3 } }] } });
  assert.deepEqual(sc.data.steps[0].eff, { bod: 100, cod: 0 });
  const n = s.save('norm', { name: 'N', data: { v: { bod: 3 } } });
  assert.equal(n.data.v.nh4, null);
});

test('выгрузка и загрузка: новые добавляются, существующие обновляются, битые пропускаются', () => {
  const { s } = fresh();
  s.save('influent', { name: 'А', data: influent });
  s.save('scheme', { name: 'Б', data: scheme });
  const dump = s.exportAll();
  assert.equal(dump.format, 'seshat-library');

  const { s: s2 } = fresh();
  assert.deepEqual(s2.importAll(dump), { added: 2, updated: 0, skipped: 0 });
  dump.influent[0].name = 'А (обновлено)';
  dump.norm.push({ id: 'bad', name: 'Битый', data: { v: null } });
  assert.deepEqual(s2.importAll(dump), { added: 0, updated: 2, skipped: 1 });
  assert.equal(s2.list('influent')[0].name, 'А (обновлено)');
});

test('отклоняет чужой файл', () => {
  const { s } = fresh();
  assert.throws(() => s.importAll({ foo: 1 }), /не файл библиотеки/);
});

test('повреждённое хранилище не ломает запуск', () => {
  const s = S.createStore({ read() { throw new Error('quota'); }, write() {} });
  assert.equal(s.count(), 0);
  const s2 = S.createStore(S.memoryAdapter({ influent: [{ id: '1', name: 'ok', data: influent }, { id: '2', name: 'bad', data: null }] }));
  assert.equal(s2.list('influent').length, 1);
});
