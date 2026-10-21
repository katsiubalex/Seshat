// Ответы Сешат. Сейчас — правила и знания самого сервиса (технологии, модель, экономика).
// Позже сюда подключается языковая модель: SeshatOracle.setProvider(async (question, ctx, local) => reply).
// Ответ: { text: string, options?: [{ id, label }], action?: { type, ... } }
(function (root) {
  const req = n => (typeof require !== 'undefined' ? require(n) : null);
  const D = root.SeshatData || req('./data.js');
  const M = root.SeshatModel || req('./model.js');
  const E = root.SeshatEconomics || req('./economics.js');
  const P = root.SeshatPlan || req('./plan.js');
  const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));

  const f = v => M.fmt(v);
  const money = v => v >= 1e9 ? (v / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млрд ₽'
    : v >= 1e6 ? (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽'
    : Math.round(v).toLocaleString('ru-RU') + ' ₽';
  const list = arr => arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' и ' + arr[arr.length - 1];
  const name = id => U[id].n.split(' (')[0];
  // строчная первая буква в середине фразы, кроме аббревиатур (БПК₅, МБР, УФ)
  const lc = t => (t.length > 1 && t[1] === t[1].toLowerCase() && t[1] !== t[1].toUpperCase()) ? t[0].toLowerCase() + t.slice(1) : t;
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

  // Главное меню разговора — как варианты ответа на экране лидера
  const MENU = [
    { id: 'review', label: 'Посмотри на мою схему' },
    { id: 'recommend', label: 'Подбери схему для моих стоков' },
    { id: 'how', label: 'Как работает сооружение?' },
    { id: 'ndt', label: 'Что такое наилучшие доступные технологии?' },
    { id: 'who', label: 'Кто ты, Сешат?' },
    { id: 'bye', label: 'Мне пора за работу' }
  ];
  const back = { id: 'menu', label: 'Вернуться к другим вопросам' };

  // Ключевые слова для свободных вопросов → технология
  const KEYS = [
    ['screens', ['решетк', 'решётк', 'отброс']], ['sand', ['песколов', 'песок']],
    ['grease', ['жироулов', 'нефтелов', 'жироуловит']], ['primary', ['первичн']],
    ['daf', ['флотац', 'флотатор']], ['mbr', ['мбр', 'mbr', 'мембранн', 'мембран']],
    ['mbbr', ['мббр', 'mbbr', 'биозагруз', 'носител', 'биоплён', 'биоплен']], ['sbr', ['sbr', 'сбр', 'периодическ']],
    ['a2o', ['a2o', 'a²/o', 'а2о', 'uct', 'биологическое удаление фосфора']], ['mle', ['нитри-денитри', 'д-н', 'нитриденитри', 'аноксид']],
    ['denf', ['денитрифицирующ', 'метанол']], ['chemP', ['дефосфат', 'коагулянт', 'соли алюмин', 'соли желез']],
    ['gac', ['угол', 'уголь', 'сорбц', 'адсорб']], ['ozone', ['озон']], ['ro', ['осмос']],
    ['uv', ['уф', 'ультрафиол', 'обеззараж']], ['filter', ['фильтр', 'доочист']], ['at', ['аэротенк', 'активный ил', 'активного ила']]
  ];
  const TOPICS = [
    ['who', ['кто ты', 'кто такая', 'о себе', 'сешат', 'богин']],
    ['ndt', ['ндт', 'наилучш', 'справочник', 'итс']],
    ['review', ['мою схему', 'моя схема', 'проверь', 'посмотри', 'нормативы не', 'не выполня', 'превыш']],
    ['recommend', ['подбери', 'посоветуй', 'какую схему', 'что выбрать', 'предложи']],
    ['nitrogen', ['азот', 'аммони', 'нитрат', 'нитрит', 'нитрификац']],
    ['phosphorus', ['фосфор', 'фосфат']],
    ['sludge', ['осадок', 'ил ', 'обезвожив']],
    ['cost', ['стоим', 'цена', 'дорого', 'дешев', 'дешёв', 'затрат', 'деньг', 'окупа']],
    ['genplan', ['генплан', 'площад', 'участок', 'план станции']],
    ['bye', ['пока', 'до свидания', 'спасибо', 'прощай']]
  ];

  function evaluate(ctx) {
    const input = { q: ctx.q, c: ctx.c, steps: ctx.steps };
    const sim = M.simulate(input), eco = E.costs(input, sim, ctx.prices), out = sim.prof[sim.prof.length - 1];
    const fails = [], ok = [];
    for (const p of D.PARAMS) {
      const n = ctx.norm[p.k]; if (n == null) continue;
      (out[p.k] <= n ? ok : fails).push({ p, v: out[p.k], n });
    }
    return { sim, eco, out, fails, ok };
  }
  // Какая технология лучше всего снижает показатель (как подсказки в конструкторе)
  function helpFor(k, have) {
    const score = u => k === 'nh4' ? (u.eff.nit || 0) : k === 'no3' || k === 'no2' ? Math.max(u.eff.den || 0, u.eff[k] || 0) : k === 'p' ? Math.max(u.eff.bioP || 0, u.eff.p || 0) : (u.eff[k] || 0);
    return D.UNITS.filter(u => !have.has(u.id) && u.id !== 'ro' && score(u) >= 40).sort((a, b) => score(b) - score(a))[0] || U.ro;
  }

  /* ---------- ответы ---------- */
  function greet(ctx) {
    const h = (ctx.hour ?? 12), when = h < 5 ? 'Звёзды ещё высоко' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const n = ctx.projects || 0;
    return {
      text: `${when}, зодчий. Я Сешат — та, что ведёт счёт, хранит дом книг и натягивает шнур, когда закладывают основание. ${n ? `В моих записях уже ${n} ${plural(n, 'проект', 'проекта', 'проектов')} — вижу, работа идёт.` : 'Твой первый проект ещё не заложен.'} О чём хочешь спросить?`,
      options: MENU
    };
  }
  function who() {
    return {
      text: 'Египтяне звали меня писцом и Владычицей дома книг. Я считала годы правления фараонов, вела переписи и учёт, а перед строительством храма вместе с фараоном натягивала шнур между кольями: по звёздам находила стороны света и размечала основание. Здесь я делаю то же самое для очистных: считаю качество воды и затраты, храню твои схемы и размечаю станцию на генплане.',
      options: MENU.filter(o => o.id !== 'who')
    };
  }
  function ndt() {
    return {
      text: 'Наилучшие доступные технологии — это способы очистки, которые государство признало лучшими по сочетанию результата и цены. Они описаны в информационно-технических справочниках: для городских стоков это ИТС 10, для промышленных — ИТС 8. Для очистных сооружений поселений технологические показатели установлены постановлением Правительства № 1430. Все сооружения в моём каталоге взяты из этого круга технологий. Сами документы ты найдёшь в разделе «Нормативные документы».',
      options: [{ id: 'recommend', label: 'Подбери схему для моих стоков' }, back],
      action: { type: 'link', view: 'docs', label: 'Открыть нормативные документы' }
    };
  }
  function howMenu() {
    return {
      text: 'О каком сооружении рассказать? Назови любое своими словами или выбери из тех, о которых спрашивают чаще всего.',
      options: ['primary', 'at', 'a2o', 'mbr', 'chemP', 'uv'].map(id => ({ id: 'tech:' + id, label: name(id) })).concat([back])
    };
  }
  function tech(id) {
    const p = P.PLAN[id], u = U[id];
    return {
      text: `${u.n}. ${p.how} Типовые параметры: ${p.params.join('; ').toLowerCase()}.`,
      options: [{ id: 'how', label: 'Расскажи о другом сооружении' }, back],
      action: { type: 'link', view: 'genplan', label: 'Посмотреть на генплане' }
    };
  }
  function review(ctx) {
    if (!ctx.steps.length) return { text: 'Шнур ещё не натянут: в конструкторе нет ни одной ступени. Начни с решёток и песколовок — так начинается любая станция. Или позволь мне подобрать схему для твоих стоков.', options: [{ id: 'recommend', label: 'Подбери схему' }, back] };
    const r = evaluate(ctx), have = new Set(ctx.steps.map(s => s.u));
    const tot = r.fails.length + r.ok.length;
    let text = `Твоя схема из ${ctx.steps.length} ${plural(ctx.steps.length, 'ступени', 'ступеней', 'ступеней')} на ${Math.round(ctx.q).toLocaleString('ru-RU')} м³/сут. `;
    if (!tot) text += 'Нормативы не заданы, поэтому сравнить мне не с чем. ';
    else if (!r.fails.length) text += `Все ${tot} заданных нормативов выполнены. `;
    else {
      const worst = [...r.fails].sort((a, b) => b.v / b.n - a.v / a.n);
      text += `Нормативы выполнены по ${r.ok.length} из ${tot}. Больше всего превышен показатель «${lc(worst[0].p.n)}»: ${f(worst[0].v)} при нормативе ${f(worst[0].n)}. `;
      const tips = [...new Map(worst.slice(0, 3).map(w => { const u = helpFor(w.p.k, have); return [u.id, `${lc(name(u.id))} — против показателя «${lc(w.p.n)}»`]; })).values()];
      text += `Я бы добавила: ${list(tips)}. `;
    }
    text += `Строительство обойдётся примерно в ${money(r.eco.total.capex * 1e6)}, эксплуатация — ${money(r.eco.total.opex)} в сутки, это ${r.eco.perM3.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ за кубометр.`;
    const warns = r.sim.warns.flat();
    if (warns.length) text += ` И ещё одно предупреждение из моих записей: ${warns[0].charAt(0).toLowerCase() + warns[0].slice(1)}`;
    return { text, options: [{ id: 'recommend', label: 'Подбери другую схему' }, { id: 'cost', label: 'Как снизить затраты?' }, back] };
  }

  /** Подбор схемы по составу стоков и нормативам (правила, а не оптимизация). */
  function recommendSteps(ctx) {
    const c = ctx.c, n = ctx.norm, q = ctx.q, steps = ['screens', 'sand'], why = [];
    if (c.fat + c.oil > 200) { steps.push('daf'); why.push('много жиров и нефтепродуктов — нужна флотация до биологии'); }
    else if (c.fat > 100 || c.oil > 20) { steps.push('grease'); why.push('жиры и нефтепродукты задержит жироуловитель'); }
    const strict = (k, v) => n[k] != null && n[k] <= v;
    const needN = strict('nh4', 5) || strict('no3', 15);
    const needP = strict('p', 2);
    if (q >= 5000 && c.ss > 150 && !steps.includes('daf') && !(needN && c.bod / Math.max(c.nh4, 1) < 5)) { steps.push('primary'); why.push('первичные отстойники снимут половину взвеси и разгрузят биологию'); }
    if (needN && needP) { steps.push(q < 500 ? 'sbr' : 'a2o'); why.push(q < 500 ? 'для малого расхода удобен SBR: все зоны в одном резервуаре' : 'нормативы и по азоту, и по фосфору — подойдёт A²/O'); }
    else if (needN) { steps.push(q < 500 ? 'sbr' : 'mle'); why.push('нужно удалять азот — нитри-денитрификация'); }
    else { steps.push('at'); why.push('биогены не нормируются строго — хватит аэротенка'); }
    if (strict('p', 1)) { steps.push('chemP'); why.push('строгий норматив по фосфору — реагентная дефосфатация'); }
    if (strict('no3', 5)) { steps.push('denf'); why.push('строгий норматив по нитратам — денитрифицирующие фильтры'); }
    if (strict('ss', 10) || strict('bod', 5) || strict('p', 0.5)) { steps.push('filter'); why.push('строгие нормы по взвеси — доочистка на фильтрах'); }
    if (strict('oil', 0.1) || c.cod / Math.max(c.bod, 1) > 3) { steps.push('gac'); why.push(strict('oil', 0.1) ? 'строгий норматив по нефтепродуктам — сорбция на угле' : 'много трудноокисляемой органики — сорбция на угле'); }
    steps.push('uv');
    return { steps, why };
  }
  function recommend(ctx) {
    const { steps, why } = recommendSteps(ctx);
    const r = evaluate({ ...ctx, steps: steps.map(id => ({ u: id, eff: { ...U[id].eff } })) });
    const tot = r.fails.length + r.ok.length;
    let text = `Для твоих стоков я натянула бы шнур так: ${steps.map(name).join(' → ')}. Почему: ${list(why)}. `;
    text += tot ? (r.fails.length ? `По моему счёту выполняется ${r.ok.length} из ${tot} нормативов; не хватает по показателям ${list(r.fails.map(x => `«${lc(x.p.n)}»`))}. ` : `По моему счёту все ${tot} нормативов выполняются. `) : '';
    text += `Строительство — около ${money(r.eco.total.capex * 1e6)}, эксплуатация — ${money(r.eco.total.opex)} в сутки.`;
    return { text, options: [{ id: 'review', label: 'Посмотри на мою текущую схему' }, back], action: { type: 'apply', steps, label: 'Собрать эту схему в конструкторе' } };
  }
  function topic(id, ctx) {
    const T = {
      nitrogen: 'Азот приходит в основном как аммоний. Нитрификаторы в аэробной зоне окисляют его до нитратов, а денитрификаторы в аноксидной зоне превращают нитраты в газообразный азот. Им нужна органика: примерно 4 мг БПК₅ на 1 мг азота. Если её мало, не ставь первичные отстойники или добавь внешний углерод — метанол на денитрифицирующих фильтрах.',
      phosphorus: 'Фосфор удаляют двумя путями. Биологически — в схеме A²/O: в анаэробной зоне бактерии выделяют фосфор, а в аэробной поглощают его с избытком и уходят с илом. Реагентно — солями алюминия или железа, которые связывают фосфаты в осадок. Для норматива ниже 1 мг/л обычно сочетают оба способа и ставят фильтры.',
      sludge: 'Осадок образуется в отстойниках, а избыточный активный ил — в биологии. Его сгущают, обезвоживают до 20–25% сухого вещества и вывозят. В моём счёте вывоз осадка — одна из главных статей эксплуатации, а на генплане осадок идёт в цех обезвоживания.',
      cost: 'Больше всего денег уходит на электроэнергию для аэрации, вывоз осадка и ремонт. Сократить можно так: первичные отстойники снимают часть органики до аэротенка; биологическое удаление фосфора дешевле реагентов; мембраны и обратный осмос ставь, только если без них не выполнить норматив. Сравни варианты в разделе «Проекты» — там я посчитаю и срок окупаемости.',
      genplan: 'На генплане я размечаю станцию, как когда-то основание храма: сооружения стоят по ходу воды, их размеры зависят от расхода. Нажми на любое — я расскажу, как оно работает.'
    };
    const links = { cost: { view: 'projects', label: 'Сравнить варианты в проектах' }, genplan: { view: 'genplan', label: 'Открыть генплан' }, sludge: { view: 'genplan', label: 'Посмотреть на генплане' } };
    return { text: T[id], options: [back], action: links[id] ? { type: 'link', ...links[id] } : undefined };
  }
  function bye() { return { text: 'Иди, зодчий. Пусть шнур ляжет ровно, а вода уйдёт чистой. Я буду здесь, когда понадоблюсь.', options: [back], action: { type: 'link', view: 'constructor', label: 'Перейти в конструктор' } }; }
  function unknown() {
    return {
      text: 'Такого свитка в моём доме книг пока нет. Я знаю сооружения из каталога, нормативы, затраты и твои схемы — спроси об этом. Скоро ко мне подключат языковую модель, и я смогу отвечать на любые вопросы о воде и её очистке.',
      options: MENU
    };
  }

  /** Ответ на выбранный вариант (id) или свободный вопрос (text). */
  function local(input, ctx) {
    const id = input.id;
    if (id) {
      if (id === 'menu') return { text: 'Спрашивай.', options: MENU };
      if (id === 'greet') return greet(ctx);
      if (id.startsWith('tech:')) return tech(id.slice(5));
      return ({ who, ndt, how: howMenu, review: () => review(ctx), recommend: () => recommend(ctx), bye, cost: () => topic('cost', ctx) }[id] || unknown)();
    }
    const q = ' ' + String(input.text || '').toLowerCase().replace(/ё/g, 'е') + ' ';
    const keyHit = (keys) => keys.some(k => q.includes(k.replace(/ё/g, 'е')));
    for (const [t, keys] of TOPICS) if (['who', 'ndt', 'review', 'recommend', 'bye'].includes(t) && keyHit(keys)) return local({ id: t }, ctx);
    for (const [tid, keys] of KEYS) if (keyHit(keys)) return tech(tid);
    for (const [t, keys] of TOPICS) if (keyHit(keys)) return topic(t, ctx);
    return unknown();
  }

  let provider = null;
  /** Подключить внешний источник ответов (например, локальную модель). Получает вопрос, контекст и локальный ответ. */
  function setProvider(fn) { provider = fn; }
  async function ask(input, ctx) {
    const loc = local(input, ctx);
    if (provider && input.text) { try { const r = await provider(input.text, ctx, loc); if (r && r.text) return r; } catch (e) { /* модель недоступна — отвечаем сами */ } }
    return loc;
  }

  root.SeshatOracle = { ask, local, greet, setProvider, recommendSteps, MENU };
  if (typeof module !== 'undefined') module.exports = root.SeshatOracle;
})(typeof globalThis !== 'undefined' ? globalThis : this);
