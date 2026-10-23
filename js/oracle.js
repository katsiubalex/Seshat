// Ответы Сешат — проводника по инженерной платформе. Сейчас — правила и знания самого сервиса: модули, база знаний,
// мифы о воде, технологии, модель и экономика модуля «Очистка сточных вод». Позже сюда подключается языковая модель:
// SeshatOracle.setProvider(async (question, ctx, local) => reply).
// Контекст: ctx.page — где идёт разговор ('hub', 'tlazolteotl' или модуль в разработке), ctx.view — открытый раздел.
// Ответ: { text, options?: [{ id, label }], action?: { type: 'link', view } | { type: 'url', page, hash } | { type: 'apply', steps } }
(function (root) {
  const req = n => (typeof require !== 'undefined' ? require(n) : null);
  const D = root.SeshatData || req('./data.js');
  const M = root.SeshatModel || req('./model.js');
  const E = root.SeshatEconomics || req('./economics.js');
  const P = root.SeshatPlan || req('./plan.js');
  const MS = root.SeshatModules || req('./modules.js');
  const KB = root.SeshatKB || req('./kb.js');
  const MY = root.SeshatMyths || req('./myths.js');
  const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));
  const MODS = MS.MODULES, MOD = Object.fromEntries(MODS.map(m => [m.id, m]));
  const PATH = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl']; // путь воды
  const pageOf = ctx => (ctx && ctx.page) || 'tlazolteotl';

  const f = v => M.fmt(v);
  const money = v => v >= 1e9 ? (v / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млрд ₽'
    : v >= 1e6 ? (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽'
    : Math.round(v).toLocaleString('ru-RU') + ' ₽';
  const list = arr => arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' и ' + arr[arr.length - 1];
  const name = id => U[id].n.split(' (')[0];
  // строчная первая буква в середине фразы, кроме аббревиатур (БПК₅, МБР, УФ)
  const lc = t => (t.length > 1 && t[1] === t[1].toLowerCase() && t[1] !== t[1].toUpperCase()) ? t[0].toLowerCase() + t.slice(1) : t;
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

  // Меню зависит от того, где идёт разговор: на главной Сешат, в «Очистке сточных вод» или в модуле в разработке
  const MENU = [ // «Очистка сточных вод»
    { id: 'review', label: 'Посмотри на мою схему' },
    { id: 'recommend', label: 'Подбери схему для моих стоков' },
    { id: 'how', label: 'Как работает сооружение?' },
    { id: 'ndt', label: 'Что такое наилучшие доступные технологии?' },
    { id: 'books:tlazolteotl', label: 'Что почитать по очистке сточных вод?' },
    { id: 'modules', label: 'Какие ещё есть модули?' }
  ];
  const HUB_MENU = [
    { id: 'eco', label: 'Что такое Сешат?' },
    { id: 'start', label: 'С чего начать?' },
    { id: 'modules', label: 'Какие есть модули?' },
    { id: 'kbhelp', label: 'Что есть в базе знаний?' },
    { id: 'names', label: 'Откуда имя «Сешат»?' },
    { id: 'who', label: 'Что ты умеешь?' }
  ];
  const whoIs = g => g.about === 'о богине' ? 'Кто такая' : 'Кто такой';
  const devMenu = id => [
    { id: 'mod:' + id, label: 'Что будет в этом модуле?' },
    { id: 'books:' + id, label: 'Что почитать по теме?' },
    PATH.includes(id) && { id: 'cycle:' + id, label: 'Где модуль в водном цикле?' },
    { id: 'modules', label: 'Какие ещё есть модули?' },
    { id: 'who', label: 'Что ты умеешь?' }
  ].filter(Boolean);
  const menuFor = ctx => { const p = pageOf(ctx); return p === 'hub' ? HUB_MENU : p === 'tlazolteotl' ? MENU : devMenu(p); };
  const back = { id: 'menu', label: 'Вернуться к другим вопросам' };

  // Ключевые слова для свободных вопросов → технология
  const KEYS = [
    ['coarse', ['грубой', 'грубые решетк']], ['drum', ['барабан', 'сито', 'сита']], ['sandv', ['тангенциал', 'вихрев']],
    ['equal', ['усредн']], ['lamella', ['ламел', 'тонкослой']], ['coag', ['коагуляц', 'флокуляц', 'осветлен']],
    ['neutral', ['нейтрализ', ' ph ']], ['strip', ['отдув']], ['oxid', ['окислительн', 'продленн']],
    ['bardenpho', ['bardenpho', 'барденфо']], ['ifas', ['ifas', 'ифас']], ['ags', ['гранул', 'nereda', 'нереда']],
    ['baf', ['baf', 'аэрируемый фильтр', 'аэрируемые фильтр', 'затоплен']], ['tf', ['капельн', 'биофильтр', 'оросител']],
    ['uasb', ['uasb', 'анаэроб', 'биогаз', 'метан']], ['anammox', ['анаммокс', 'anammox', 'деаммонификац']],
    ['wetland', ['биоплато', 'болот', 'тростник', 'wetland']], ['disc', ['дисков', 'тканев']], ['uf', ['ультрафильтр']],
    ['aop', ['aop', 'радикал', 'пероксид', 'перекис', 'усовершенствован']], ['ix', ['ионообмен', 'ионный обмен', 'ионного обмена', 'смол']],
    ['hypo', ['хлор', 'гипохлорит']],
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
    ['who', ['кто ты', 'что ты умеешь', 'что умеешь', 'о себе', 'помощь']],
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

  // Мифы о воде: имя божества или героя → статья в «Гуманитарных аспектах»
  const MYTH_NAMES = [['seshat', ['кто такая сешат', 'богиня сешат', 'богине сешат', 'имя сешат', 'почему сешат', 'откуда имя']], ['tlaloc', ['тлалок']], ['hapi', ['хапи']], ['yu', ['ю велик', 'юй', 'великий ю']], ['enki', ['энки', ' эа ']],
    ['anahita', ['анахит']], ['juturna', ['ютурн']], ['cloacina', ['клоацин']], ['tlazolteotl', ['тласол', 'тлацол']]];
  // Модули: тема
  const MOD_TOPICS = [['tlaloc', ['гидролог', 'осадки', 'дожд', 'ливн', 'паводк', 'обеспеченност']], ['hapi', ['водные ресурс', 'водохозяйств', 'водопользовател', 'бассейн реки', 'разбавлен']],
    ['yu', ['гидротехн', 'плотин', 'дамб', 'водосброс', 'водохранилищ', 'наводнен']], ['enki', ['водозабор', 'скважин', 'подземн', 'гидрогеолог', 'зон санитарной охран']],
    ['anahita', ['водоподготов', 'питьев', 'природн вод', 'природной вод', 'обезжелез', 'умягчен', 'марган']], ['juturna', ['водопровод', 'сети водоснаб', 'сеть водоснаб', 'водонапорн', 'кольцев']],
    ['cloacina', ['канализац', 'водоотводящ', 'самотеч', 'коллектор', 'кнс', 'ливнев']]];
  // База знаний: фундаментальные дисциплины, «Человек и вода», показатели, разделы
  const FUND_KEYS = [['hydraulics', ['гидравлик', 'бернулли', 'дарси', 'рейнольдс', 'шези', 'потери напор']], ['math', ['математик', 'статистик', 'дифференциальн']],
    ['chemistry', ['химия вод', 'химии вод', 'карбонатн', 'растворимост']], ['microbiology', ['микробиолог', 'биохими']],
    ['geotech', ['грунт', 'инженерная геолог']], ['pumps', ['насос', 'автоматизац']]];
  // Водоподготовка — статьи модуля «Очистка природных вод»; общие слова (фильтры, отстойники) — только на его странице
  const W_KEYS = [['dw-iron', ['обезжелез', 'деманган', 'железо в вод', 'железа в вод', 'марганец в вод']], ['dw-softening', ['умягч', 'обессол', 'обратный осмос', 'жёсткост', 'жесткост']],
    ['dw-fluoride', ['фтор']], ['dw-classes', ['класс вод', 'классы вод', 'выбор технологи', 'водоподготов']], ['dw-micro', ['колиформ', 'микробиолог']],
    ['dw-disinfection', ['обеззараж питьев', 'остаточный хлор', 'хлорамин', 'диоксид хлора']], ['dw-organoleptic', ['мутност', 'цветност']]];
  const W_LOCAL = [['dw-disinfection', ['обеззараж', 'хлорирован', 'ультрафиолет']], ['dw-coagulation', ['коагуля', 'коагулянт', 'подщелач']], ['dw-clarification', ['отстойник', 'осветлител', 'отстаиван']],
    ['dw-filtration', ['фильтр']], ['dw-oxidation', ['озон', 'уголь', 'запах', 'привкус', 'окислител']], ['dw-general', ['окисляемост', 'щёлочност', 'щелочност']]];
  const HUM_KEYS = [['anthropology', ['антрополог']], ['philosophy', ['философ', 'фалес', 'гераклит', 'башляр', 'иллич']],
    ['history', ['истори водо', 'истории водо', 'истории санитар', 'холер', 'джон сноу', 'акведук', 'фронтин']],
    ['commons', ['общее благо', 'остром', 'хардин', 'трагедия общин', 'право на воду']], ['ethics', ['этик']]];
  const IND_KEYS = [['bod', ['бпк']], ['cod', ['хпк']], ['ss', ['взвешен']], ['do', ['растворенный кислород', 'растворённый кислород']], ['ph', [' ph', 'кислотност']],
    ['alk', ['щелочност']], ['coli', ['колиформ', 'кишечная палочк', 'микробиологическ']], ['svi', ['иловый индекс', 'доза ила']], ['tds', ['солесодерж', 'сухой остаток']]];
  const SEC_KEYS = [['books', ['учебник', 'что почитать', 'литератур', 'книг']], ['journals', ['журнал', 'статьи учен', 'публикац']],
    ['comm', ['сообществ', 'ассоциац', 'iwa', 'равв', 'конференц']], ['docs', ['документ', 'закон', 'санпин', 'постановлен', 'приказ', 'сп 32']],
    ['kbhelp', ['база знаний', 'базе знаний', 'энциклопед']], ['names', ['назван', 'такие имена', 'почему имена', 'имена бог', 'именами бог', 'мифы', 'миф о', 'боги вод', 'богах вод', 'гуманитар']],
    ['eco', ['что такое сешат', 'сешат', 'платформ', 'экосистем']],
    ['start', ['с чего начать', 'начать', 'новичок', 'первый раз']], ['modules', ['модул']]];

  function evaluate(ctx) {
    const input = { q: ctx.q, c: ctx.c, steps: ctx.steps };
    const sim = M.simulate(input), eco = E.costs(input, sim, ctx.prices), out = sim.out;
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
    const h = (ctx.hour ?? 12), when = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const p = pageOf(ctx), n = ctx.projects || 0;
    if (p === 'hub') return { text: `${when}! Я Сешат, проводник по инженерной платформе. Здесь кластер «Водная инфраструктура» — модули от гидрологии до очистки сточных вод, база знаний и нормативные документы. Спросите, с чего начать, или выберите вопрос.`, options: HUB_MENU };
    if (p === 'humanities') return { text: `${when}! Вы в разделе «Гуманитарные аспекты»: мифы о воде, история санитарии, философия и этика. Спросите о любом боге воды — например, «кто такая Анахита?» — или выберите вопрос.`, options: [{ id: 'names', label: 'Откуда имя «Сешат»?' }, { id: 'lore:tlazolteotl', label: 'Кто такая Тласольтеотль?' }, { id: 'h:history', label: 'Как появилась санитария?' }, { id: 'modules', label: 'Какие есть модули?' }] };
    if (p !== 'tlazolteotl') { const m = MOD[p]; return { text: `${when}! Вы в модуле «${m.n}» — ${lc(m.d)}. Модуль ещё в разработке, но я могу рассказать, что в нём будет и что почитать по теме.`, options: devMenu(p) }; }
    return {
      text: `${when}! Вы в модуле «Очистка сточных вод». Я помогу подобрать и проверить схему очистки сточных вод. ${n ? `У вас ${n} ${plural(n, 'проект', 'проекта', 'проектов')}.` : 'Проектов пока нет.'} Выберите вопрос или задайте свой.`,
      options: MENU
    };
  }
  function who(ctx) {
    const p = pageOf(ctx);
    const base = 'Я Сешат — помощник инженерной платформы. Я знаю модули «Водной инфраструктуры» и мифы о воде из «Гуманитарных аспектов», могу рассказать, что есть в базе знаний и что почитать по каждой дисциплине, объяснить основы гидравлики, химии воды и показатели качества.';
    const tz = ' В модуле «Очистка сточных вод» я могу проверить схему из конструктора: какие нормативы выполняются, что добавить и сколько это стоит; подобрать схему под состав стоков и рассказать, как работает любое сооружение.';
    return { text: base + tz + ' Сейчас ответы строятся на данных сервиса; позже будет подключена языковая модель.', options: menuFor(ctx).filter(o => o.id !== 'who') };
  }
  function ndt() {
    return {
      text: 'Наилучшие доступные технологии — это способы очистки, которые государство признало лучшими по сочетанию результата и цены. Они описаны в информационно-технических справочниках: для городских стоков это ИТС 10, для промышленных — ИТС 8. Для очистных сооружений поселений технологические показатели установлены постановлением Правительства № 1430. Все сооружения в каталоге Сешат относятся к этим технологиям. Сами документы собраны в разделе «Нормативные документы».',
      options: [{ id: 'recommend', label: 'Подбери схему для моих стоков' }, back],
      action: { type: 'link', view: 'docs', label: 'Открыть нормативные документы' }
    };
  }
  function howMenu() {
    return {
      text: 'О каком сооружении рассказать? Выберите из списка или напишите название.',
      options: ['primary', 'at', 'a2o', 'mbr', 'chemP', 'uv'].map(id => ({ id: 'tech:' + id, label: name(id) })).concat([back])
    };
  }
  function tech(id) {
    const p = P.PLAN[id], u = U[id];
    return {
      text: `${u.n}. ${p.how} Типовые параметры: ${p.params.join('; ').toLowerCase()}.`,
      options: [{ id: 'how', label: 'Расскажи о другом сооружении' }, back],
      action: open('tlazolteotl', 'kb-u-' + id, 'Подробнее в базе знаний')
    };
  }
  function review(ctx) {
    if (!ctx.steps.length) return { text: 'В конструкторе пока нет ни одной ступени. Обычно схема начинается с решёток и песколовок. Могу подобрать схему под ваши стоки.', options: [{ id: 'recommend', label: 'Подбери схему' }, back] };
    const r = evaluate(ctx), have = new Set(ctx.steps.map(s => s.u));
    const tot = r.fails.length + r.ok.length;
    let text = `В вашей схеме ${ctx.steps.length} ${plural(ctx.steps.length, 'ступень', 'ступени', 'ступеней')}, расход ${Math.round(ctx.q).toLocaleString('ru-RU')} м³/сут. `;
    if (!tot) text += 'Нормативы не заданы, сравнивать не с чем. ';
    else if (!r.fails.length) text += `Все ${tot} заданных нормативов выполнены. `;
    else {
      const worst = [...r.fails].sort((a, b) => b.v / b.n - a.v / a.n);
      text += `Нормативы выполнены по ${r.ok.length} из ${tot}. Больше всего превышен показатель «${lc(worst[0].p.n)}»: ${f(worst[0].v)} при нормативе ${f(worst[0].n)}. `;
      const tips = [...new Map(worst.slice(0, 3).map(w => { const u = helpFor(w.p.k, have); return [u.id, `${lc(name(u.id))} — против показателя «${lc(w.p.n)}»`]; })).values()];
      text += `Рекомендую добавить: ${list(tips)}. `;
    }
    text += `Строительство обойдётся примерно в ${money(r.eco.total.capex * 1e6)}, эксплуатация — ${money(r.eco.total.opex)} в сутки, это ${r.eco.perM3.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ за кубометр.`;
    const warns = r.sim.warns.flat();
    if (warns.length) text += ` Обратите внимание: ${warns[0].charAt(0).toLowerCase() + warns[0].slice(1)}`;
    return { text, options: [{ id: 'recommend', label: 'Подбери другую схему' }, { id: 'cost', label: 'Как снизить затраты?' }, back], action: pageOf(ctx) !== 'tlazolteotl' ? open('tlazolteotl', 'constructor', 'Открыть схему в конструкторе') : undefined };
  }

  /* ---------- платформа и модули ---------- */
  const open = (page, hash, label) => ({ type: 'url', page, hash, label });
  const modOpt = m => ({ id: 'mod:' + m.id, label: `${m.n} — ${lc(m.d)}` });
  function eco() {
    return { text: `Сешат — инженерная платформа водного хозяйства: база знаний, курсы и расчётные инструменты на одном движке. Сейчас в ней кластер «Водная инфраструктура»: модули, которые вместе проходят весь путь воды: ${PATH.map(id => MOD[id].n).join(' → ')}. Каждый модуль — отдельная дисциплина со своей базой знаний, курсами и конструктором; сейчас готов модуль «Очистка сточных вод», остальные в разработке. Общие для всех модулей разделы — фундаментальные дисциплины, гуманитарные аспекты, журналы, сообщества и нормативные документы.`,
      options: [{ id: 'start', label: 'С чего начать?' }, { id: 'modules', label: 'Какие есть модули?' }, back], action: { type: 'link', view: 'home', label: 'Открыть водный цикл модулей' } };
  }
  function start(ctx) {
    return { text: 'Начните с модуля «Очистка сточных вод» — он уже работает. Откройте раздел «О модуле», затем конструктор: выберите пример стоков слева, нормативы водоёма справа и соберите схему очистки из каталога внизу. Если какие-то понятия незнакомы, в базе знаний есть статьи о каждом сооружении, процессе и показателе, а в общих разделах — основы гидравлики и химии воды.',
      options: [{ id: 'mod:tlazolteotl', label: 'Расскажи об очистке сточных вод' }, { id: 'f:hydraulics', label: 'Что такое гидравлика?' }, back], action: open('tlazolteotl', 'overview', 'Открыть модуль') };
  }
  function modules(ctx) {
    const here = pageOf(ctx);
    return { text: `В кластере «Водная инфраструктура» модули идут по пути воды. ${PATH.map(id => `${MOD[id].n} — ${lc(MOD[id].d)}${MOD[id].ready ? ' (готов)' : ''}`).join('; ')}. О каком рассказать?`,
      options: PATH.filter(id => id !== here).map(id => modOpt(MOD[id])).concat([back]) };
  }
  function moduleInfo(id, ctx) {
    const m = MOD[id], here = pageOf(ctx) === id;
    const myths = MY.forModule(id);
    const text = `${m.n} — ${lc(m.d)}. ${m.ready ? 'Модуль готов. Он умеет' : 'Модуль в разработке. В нём будет'}: ${list(m.will.map(lc))}. Дисциплины: ${list(m.disc.map(lc))}.${myths.length ? ` Созвучные мифы о воде: ${list(myths.map(g => g.name))}.` : ''}`;
    const action = here ? (m.ready ? { type: 'link', view: 'constructor', label: 'Открыть конструктор' } : { type: 'link', view: 'kb', label: 'Открыть базу знаний модуля' })
      : open(id, 'overview', `Открыть модуль «${m.n}»`);
    return { text, options: [myths[0] && { id: 'lore:' + myths[0].id, label: `${whoIs(myths[0])} ${myths[0].name}?` }, { id: 'books:' + id, label: 'Что почитать по теме?' }, back].filter(Boolean), action };
  }
  // миф о воде: кратко, созвучные модули и ссылка на статью в «Гуманитарных аспектах»
  function lore(id) {
    const g = MY.BY[id], mods = g.mods.map(([m]) => MOD[m]).filter(Boolean);
    return { text: `${g.legend} Созвучные модули: ${list(mods.map(m => `«${m.n}»`))}. Полная история — несколько глав о мифах и обрядах — в разделе «Гуманитарные аспекты».`,
      options: [mods[0] && { id: 'mod:' + mods[0].id, label: `Что в модуле «${mods[0].n}»?` }, { id: 'names', label: 'Какие ещё есть мифы о воде?' }, back].filter(Boolean), action: open('humanities', 'lore-' + id, `Читать: ${g.name}`) };
  }
  function books(id) {
    const m = MOD[id], groups = KB.MODULE_BOOKS[id] || [], all = groups.flatMap(g => g.list);
    const top = all.slice(0, 3).map(([a, t]) => `«${t}» (${a.split(',')[0]})`);
    return { text: `По теме модуля «${m.n}» — ${all.length} ${plural(all.length, 'учебник', 'учебника', 'учебников')}: ${list(groups.map(g => lc(g.d)))}. Для начала: ${list(top)}. Полный список — в базе знаний модуля, а учебники по гидравлике, химии воды и математике — в разделе «Фундаментальные дисциплины».`,
      options: [{ id: 'mod:' + id, label: `Что в модуле «${m.n}»?` }, back], action: open(id, 'kb-books', 'Открыть учебники модуля') };
  }
  function cycle(id) {
    const i = PATH.indexOf(id), prev = MOD[PATH[i - 1]], next = MOD[PATH[i + 1]], m = MOD[id];
    let text = `Модуль «${m.n}»: ${lc(m.d)}. `;
    if (prev) text += `Перед ним в пути воды — «${prev.n}» (${lc(prev.d)}). `;
    if (next) text += `После него — «${next.n}» (${lc(next.d)}). `;
    if (id === 'tlazolteotl') text += 'Очищенная вода возвращается в реку — к модулю «Водные ресурсы», и круг замыкается.';
    if (id === 'yu') text += 'Гидротехника стоит рядом с рекой: плотины, каналы и водохранилища регулируют сток для всех следующих модулей.';
    return { text, options: [prev && modOpt(prev), next && modOpt(next), back].filter(Boolean), action: { type: 'link', view: 'home', label: 'Открыть водный цикл' } };
  }
  function names() {
    const gods = MY.GODS.filter(g => g.id !== 'seshat');
    return { text: `Платформа названа в честь египетской богини Сешат — покровительницы письма, счёта и измерений, которая вместе с фараоном размечала храмы перед закладкой. Модули называются по своему предмету, а мифы о богах воды, созвучные модулям, собраны в разделе «Гуманитарные аспекты»: ${gods.map(g => `${g.name} — ${lc(g.epithet)}`).join('; ')}.`,
      options: [{ id: 'lore:seshat', label: 'Расскажи о Сешат подробнее' }, { id: 'lore:' + gods[0].id, label: `${whoIs(gods[0])} ${gods[0].name}?` }, back], action: open('humanities', 'lore', 'Открыть мифы о воде') };
  }
  function kbHelp(ctx) {
    const p = pageOf(ctx);
    if (p === 'tlazolteotl') return { text: 'В базе знаний модуля «Очистка сточных вод» — статьи о 40 сооружениях очистки, 22 процессах с уравнениями, 18 показателях качества воды и учебники модуля. Общие разделы Сешат — фундаментальные дисциплины, гуманитарные аспекты, журналы и сообщества.', options: [back], action: { type: 'link', view: 'kb', label: 'Открыть базу знаний модуля' } };
    if (p !== 'hub') return { text: `Модуль «${MOD[p].n}» ещё наполняется, но в его базе знаний уже есть учебники и ссылки на общие дисциплины, на которых он держится. Общие разделы Сешат — фундаментальные дисциплины, гуманитарные аспекты, журналы и сообщества.`, options: [{ id: 'books:' + p, label: 'Что почитать по теме?' }, back], action: { type: 'link', view: 'kb', label: 'Открыть базу знаний модуля' } };
    return { text: 'База знаний устроена как дерево. Общие разделы: фундаментальные дисциплины (гидравлика, математика, химия воды, микробиология, геология, насосы), гуманитарные аспекты (мифы о воде, антропология, философия, история санитарии, вода как общее благо, этика), научные журналы и профессиональные сообщества. У каждого модуля — своя база знаний со своими учебниками; у «Очистки сточных вод» ещё сооружения, процессы и показатели качества воды.',
      options: [{ id: 'f:hydraulics', label: 'Расскажи про гидравлику' }, { id: 'h:philosophy', label: 'Что такое философия воды?' }, back], action: { type: 'link', view: 'kb', label: 'Открыть базу знаний' } };
  }
  function article(kind, id) {
    const x = (kind === 'f' ? KB.FUNDAMENTALS : kind === 'h' ? KB.HUMANITIES : kind === 'w' ? KB.DRINKING : KB.INDICATORS).find(v => v.id === id);
    const text = kind === 'i' ? `${x.t}. ${x.what} ${x.why} В городских стоках обычно ${x.typ}.` : `${x.t}. ${x.lead} ${x.s[0][1]}`;
    const page = kind === 'i' ? 'tlazolteotl' : kind === 'h' ? 'humanities' : kind === 'w' ? 'anahita' : 'hub';
    return { text, options: [{ id: 'kbhelp', label: 'Что ещё есть в базе знаний?' }, back], action: open(page, `kb-${kind}-${id}`, 'Читать статью целиком') };
  }
  function section(id, ctx) {
    const p = pageOf(ctx);
    if (id === 'books') return p !== 'hub' ? books(p) : { text: `Учебники собраны в базах знаний модулей — у каждого своя дисциплина: ${PATH.map(m => `${MOD[m].n} — ${(KB.MODULE_BOOKS[m] || []).reduce((s, g) => s + g.list.length, 0)}`).join(', ')}. Учебники по гидравлике, математике, химии воды и другим общим дисциплинам — в разделе «Фундаментальные дисциплины».`,
      options: PATH.map(m => ({ id: 'books:' + m, label: `Учебники: ${MOD[m].n}` })).slice(0, 4).concat([back]), action: open('hub', 'kb-books', 'Открыть учебники по модулям') };
    if (id === 'journals') return { text: `В базе знаний собраны ${KB.JOURNALS.reduce((s, g) => s + g.list.length, 0)} научных журналов: российские — «Водоснабжение и санитарная техника», «НДТ водоснабжения и водоотведения», «Вода и экология»; международные — Water Research, Water Science and Technology и другие.`, options: [back], action: open('hub', 'kb-journals', 'Открыть список журналов') };
    if (id === 'comm') return { text: 'Профессиональные сообщества: в России — Российская ассоциация водоснабжения и водоотведения (РАВВ), крупные водоканалы; в мире — IWA, WEF, AWWA, EWA, немецкая DWA и другие. Там проходят конференции, выпускаются стандарты и обучающие материалы.', options: [back], action: open('hub', 'kb-comm', 'Открыть список сообществ') };
    if (id === 'docs') return { text: 'Нормативные документы лежат в базе знаний каждого модуля кластера «Водная инфраструктура» и сгруппированы по смыслу: законы, правила, справочники НДТ, своды правил, нормативы качества воды, санитарная охрана. Белым отмечены документы, общие для всех модулей, — Водный кодекс и закон об охране окружающей среды; остальные окрашены в цвет вида воды тех модулей, к которым относятся. У части документов есть интерактивные таблицы, например показатели НДТ по постановлению № 1430.', options: [{ id: 'ndt', label: 'Что такое НДТ?' }, back], action: { type: 'link', view: 'docs', label: 'Открыть документы' } };
    return ({ kbhelp: () => kbHelp(ctx), names, eco, start: () => start(ctx), modules: () => modules(ctx) })[id]();
  }

  /** Подбор схемы по составу стоков и нормативам (правила, а не оптимизация). */
  function recommendSteps(ctx) {
    const c = ctx.c, n = ctx.norm, q = ctx.q, steps = ['screens', 'sand'], why = [];
    if (c.fat + c.oil > 200) { steps.push('daf'); why.push('много жиров и нефтепродуктов — нужна флотация до биологии'); }
    if (c.bod > 1000) { steps.push('equal', 'uasb'); why.push('очень высокая органика — усреднитель и анаэробный реактор UASB с получением биогаза перед аэробной очисткой'); }
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
    let text = `Предлагаю схему: ${steps.map(name).join(' → ')}. Почему: ${list(why)}. `;
    text += tot ? (r.fails.length ? `По расчёту выполняется ${r.ok.length} из ${tot} нормативов; не хватает по показателям ${list(r.fails.map(x => `«${lc(x.p.n)}»`))}. ` : `По расчёту выполняются все ${tot} нормативов. `) : '';
    text += `Строительство — около ${money(r.eco.total.capex * 1e6)}, эксплуатация — ${money(r.eco.total.opex)} в сутки.`;
    return { text, options: [{ id: 'review', label: 'Посмотри на мою текущую схему' }, back], action: { type: 'apply', steps, label: 'Собрать эту схему в конструкторе' } };
  }
  function topic(id, ctx) {
    const tz = pageOf(ctx) === 'tlazolteotl';
    const T = {
      nitrogen: 'Азот приходит в основном как аммоний. Нитрификаторы в аэробной зоне окисляют его до нитратов, а денитрификаторы в аноксидной зоне превращают нитраты в газообразный азот. Им нужна органика: примерно 4 мг БПК₅ на 1 мг азота. Если её мало, откажитесь от первичных отстойников или добавьте внешний углерод — метанол на денитрифицирующих фильтрах.',
      phosphorus: 'Фосфор удаляют двумя путями. Биологически — в схеме A²/O: в анаэробной зоне бактерии выделяют фосфор, а в аэробной поглощают его с избытком и уходят с илом. Реагентно — солями алюминия или железа, которые связывают фосфаты в осадок. Для норматива ниже 1 мг/л обычно сочетают оба способа и ставят фильтры.',
      sludge: 'Осадок образуется в отстойниках, а избыточный активный ил — в биологии. Его сгущают, обезвоживают до 20–25% сухого вещества и вывозят. Вывоз осадка — одна из главных статей эксплуатационных затрат. На генплане осадок отводится в цех обезвоживания.',
      cost: 'Больше всего денег уходит на электроэнергию для аэрации, вывоз осадка и ремонт. Сократить можно так: первичные отстойники снимают часть органики до аэротенка; биологическое удаление фосфора дешевле реагентов; мембраны и обратный осмос стоит ставить, только если без них не выполнить норматив. Сравнить варианты и срок окупаемости можно в разделе «Проекты».',
      genplan: 'В конструкторе схема показана как план станции: размеры сооружений зависят от расхода, их можно двигать, соединять трубами и делать параллельные линии. Нажмите на сооружение, чтобы увидеть, как оно работает.'
    };
    const links = { cost: { view: 'projects', label: 'Сравнить варианты в проектах' }, genplan: { view: 'constructor', label: 'Открыть план' }, sludge: { view: 'constructor', label: 'Посмотреть на плане' } };
    return { text: T[id], options: [back], action: !links[id] ? undefined : tz ? { type: 'link', ...links[id] } : open('tlazolteotl', links[id].view, links[id].label) };
  }
  function bye(ctx) { return { text: 'Хорошо. Если понадобится помощь, возвращайтесь.', options: [back], action: pageOf(ctx) === 'tlazolteotl' ? { type: 'link', view: 'constructor', label: 'Открыть конструктор' } : undefined }; }
  function unknown(ctx) {
    return {
      text: 'На этот вопрос у меня пока нет ответа. Я могу рассказать о модулях платформы и мифах о воде, о базе знаний и учебниках, о сооружениях очистки, нормативах и затратах или проверить вашу схему. Позже будет подключена языковая модель, и круг вопросов станет шире.',
      options: menuFor(ctx)
    };
  }

  /** Ответ на выбранный вариант (id) или свободный вопрос (text). */
  function local(input, ctx) {
    const id = input.id;
    if (id) {
      if (id === 'menu') return { text: 'Что вас интересует?', options: menuFor(ctx) };
      if (id === 'greet') return greet(ctx);
      const [k, v] = id.split(':');
      if (k === 'tech' && U[v]) return tech(v);
      if (k === 'mod' && MOD[v]) return moduleInfo(v, ctx);
      if (k === 'lore' && MY.BY[v]) return lore(v);
      if (k === 'books' && MOD[v]) return books(v);
      if (k === 'cycle' && MOD[v]) return cycle(v);
      if ((k === 'f' || k === 'h' || k === 'i' || k === 'w') && v) return article(k, v);
      return ({ who: () => who(ctx), ndt, how: howMenu, review: () => review(ctx), recommend: () => recommend(ctx), bye: () => bye(ctx), cost: () => topic('cost', ctx),
        eco, start: () => start(ctx), modules: () => modules(ctx), kbhelp: () => kbHelp(ctx), names }[id] || (() => unknown(ctx)))();
    }
    const q = ' ' + String(input.text || '').toLowerCase().replace(/ё/g, 'е') + ' ';
    const keyHit = (keys) => keys.some(k => q.includes(k.replace(/ё/g, 'е')));
    // 1. кто ты, НДТ, разбор и подбор схемы, прощание
    for (const [t, keys] of TOPICS) if (['who', 'ndt', 'review', 'recommend', 'bye'].includes(t) && keyHit(keys) && !(t === 'who' && MYTH_NAMES.some(([, k]) => keyHit(k)) && !keyHit(['кто ты', 'что ты умеешь', 'что умеешь']))) return local({ id: t }, ctx);
    // 2. имя божества или героя — миф о воде из «Гуманитарных аспектов»
    for (const [gid, keys] of MYTH_NAMES) if (keyHit(keys)) return lore(gid);
    // 3. разделы базы знаний и платформы
    for (const [sid, keys] of SEC_KEYS) if (keyHit(keys)) return section(sid, ctx);
    // 4. фундаментальные дисциплины и гуманитарные статьи
    for (const [fid, keys] of FUND_KEYS) if (keyHit(keys)) return article('f', fid);
    for (const [hid, keys] of HUM_KEYS) if (keyHit(keys)) return article('h', hid);
    if (KB.DRINKING && KB.DRINKING.length) {
      for (const [wid, keys] of W_KEYS) if (keyHit(keys)) return article('w', wid);
      if (pageOf(ctx) === 'anahita') for (const [wid, keys] of W_LOCAL) if (keyHit(keys)) return article('w', wid);
    }
    // 5. сооружения очистки
    for (const [tid, keys] of KEYS) if (keyHit(keys)) return tech(tid);
    // 6. модуль по теме: гидрология, водозабор, канализация…
    for (const [mid, keys] of MOD_TOPICS) if (keyHit(keys)) return moduleInfo(mid, ctx);
    // 7. показатели качества воды и темы очистки
    for (const [iid, keys] of IND_KEYS) if (keyHit(keys)) return article('i', iid);
    for (const [t, keys] of TOPICS) if (keyHit(keys)) return topic(t, ctx);
    return unknown(ctx);
  }

  let provider = null;
  /** Подключить внешний источник ответов (например, локальную модель). Получает вопрос, контекст и локальный ответ. */
  function setProvider(fn) { provider = fn; }
  async function ask(input, ctx) {
    const loc = local(input, ctx);
    if (provider && input.text) { try { const r = await provider(input.text, ctx, loc); if (r && r.text) return r; } catch (e) { /* модель недоступна — отвечаем сами */ } }
    return loc;
  }

  root.SeshatOracle = { ask, local, greet, setProvider, recommendSteps, MENU, HUB_MENU, menuFor };
  if (typeof module !== 'undefined') module.exports = root.SeshatOracle;
})(typeof globalThis !== 'undefined' ? globalThis : this);
