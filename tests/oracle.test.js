// Тесты ответов Сешат. Запуск: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const O = require('../js/oracle.js');

const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));
const city = D.PRESETS[0];
const ctx = (over = {}) => ({ q: city.q, c: { ...city.c }, steps: city.scheme.map(u => ({ u, eff: { ...U[u].eff } })), norm: { ...D.NORMS.pdk.v }, prices: undefined, projects: 0, hour: 10, ...over });

test('приветствие с вариантами ответа', () => {
  const r = O.greet(ctx({ projects: 3 }));
  assert.match(r.text, /Доброе утро/);
  assert.match(r.text, /3 проекта/);
  assert.doesNotMatch(r.text, /зодчий|шнур|дом книг/);
  assert.equal(r.options.length, O.MENU.length);
});

test('свободный вопрос о технологии находит её описание', () => {
  for (const [q, id] of [['как работает МБР?', 'mbr'], ['расскажи про флотацию', 'daf'], ['Что делают песколовки', 'sand'], ['УФ', 'uv'], ['озонирование', 'ozone']]) {
    const r = O.local({ text: q }, ctx());
    assert.ok(r.text.startsWith(U[id].n), `${q} → ${r.text.slice(0, 40)}`);
  }
});

test('темы: азот, фосфор, затраты, НДТ, кто ты', () => {
  assert.match(O.local({ text: 'как удалить азот' }, ctx()).text, /нитрификатор/i);
  assert.match(O.local({ text: 'фосфор не проходит' }, ctx()).text, /A²\/O/);
  assert.match(O.local({ text: 'дорого, как сэкономить' }, ctx()).text, /электроэнерги/);
  assert.match(O.local({ text: 'что такое НДТ' }, ctx()).text, /ИТС 10/);
  assert.match(O.local({ text: 'что ты умеешь?' }, ctx()).text, /проверить схему/);
});

test('разбор схемы: нормативы, совет, затраты', () => {
  const r = O.local({ id: 'review' }, ctx());
  assert.match(r.text, /В вашей схеме 7 ступеней/);
  assert.match(r.text, /Нормативы выполнены по \d+ из \d+/);
  assert.match(r.text, /Рекомендую добавить/);
  assert.match(r.text, /₽ за кубометр/);
  assert.match(O.local({ id: 'review' }, ctx({ steps: [] })).text, /нет ни одной ступени/);
  assert.match(O.local({ id: 'review' }, ctx({ steps: [{ u: 'at', eff: { ...U.at.eff } }] })).text, /1 ступень,/);
});

test('подбор схемы учитывает состав стоков и строгость нормативов', () => {
  const dairy = D.PRESETS[1];
  const a = O.recommendSteps(ctx({ q: dairy.q, c: dairy.c }));
  assert.ok(a.steps.includes('daf'), 'жирные стоки → флотация');
  const loose = O.recommendSteps(ctx({ norm: { ...D.NORMS.pdk.v, nh4: null, no3: null, p: null, ss: null, bod: 20, oil: null } }));
  assert.ok(loose.steps.includes('at') && !loose.steps.includes('a2o'));
  const strict = O.recommendSteps(ctx());
  assert.ok(strict.steps.includes('a2o') && strict.steps.includes('chemP') && strict.steps.includes('filter'));
  const r = O.local({ id: 'recommend' }, ctx());
  assert.equal(r.action.type, 'apply');
  assert.ok(r.action.steps.every(id => U[id]));
});

test('неизвестный вопрос — честный ответ и меню', () => {
  const r = O.local({ text: 'какая погода на Марсе' }, ctx());
  assert.match(r.text, /пока нет/);
  assert.ok(r.options.length > 3);
});

test('внешний источник ответов используется для свободных вопросов, при ошибке — локальный ответ', async () => {
  O.setProvider(async (q) => ({ text: 'модель: ' + q }));
  assert.equal((await O.ask({ text: 'привет' }, ctx())).text, 'модель: привет');
  assert.match((await O.ask({ id: 'who' }, ctx())).text, /проверить схему/); // варианты меню — без модели
  O.setProvider(async () => { throw new Error('offline'); });
  assert.match((await O.ask({ text: 'как работает МБР' }, ctx())).text, /Мембранный/);
  O.setProvider(null);
});

test('Сешат знает новые технологии и предлагает UASB для концентрированных стоков', () => {
  for (const [q, id] of [['что такое окислительный канал', 'oxid'], ['как работает анаммокс', 'anammox'], ['биоплато', 'wetland'], ['хлорирование', 'hypo'], ['ультрафильтрация', 'uf'], ['гранулированный ил', 'ags'], ['UASB', 'uasb']]) {
    assert.ok(O.local({ text: q }, ctx()).text.startsWith(U[id].n), q);
  }
  const dairy = D.PRESETS[1];
  assert.ok(O.recommendSteps(ctx({ q: dairy.q, c: dairy.c })).steps.includes('uasb'));
});
