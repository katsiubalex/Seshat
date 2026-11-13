// Водоподготовка: качество воды по цепочке сооружений, выбор технологии и расчёт основных сооружений.
// Модуль «Очистка природных вод». Работает в браузере и в Node (тесты).
//
// Источники и как они используются:
//  • СП 31.13330.2021 (с изм. № 1) — классы вод источников и рекомендуемые схемы (прил. Б, табл. Б.1, Б.4, Б.6, Б.7),
//    достижимое качество после сооружений (табл. 11, Б.7), условия применения методов (п. 9.148, 9.162–9.165, табл. Б.3),
//    расчётные параметры (табл. 12, 14, 15, 17, 20, 22; формулы п. 9.16, 9.49, 9.82; дозы п. 9.15, 9.129, 9.151).
//    Номера пунктов разд. 9 даны по официальной нумерации (в издании 2021 г. часть пунктов напечатана со сдвигом),
//    страницы — по изданию 2021 г.
//  • СанПиН 1.2.3685-21 — нормативы качества питьевой воды (табл. 3.1, 3.3, 3.5, 3.13).
// Где свод правил не даёт числа (например, снижение перманганатной окисляемости), значение помечено est: true —
// это учебный ориентир, его нужно подтвердить источником; список таких мест — в EST.
(function (root) {
  const SP = 'sp31', SAN = 'sanpin3685';
  const r = (doc, where, page) => ({ doc, where, page });

  /* ---------- показатели ---------- */
  // norm — норматив питьевой воды централизованного водоснабжения: max (или min и max) и ссылка
  const PARAMS = [
    { k: 'turb', n: 'Мутность', u: 'мг/л', norm: { max: 1.5, ref: r(SAN, 'табл. 3.1, п. 5 (по каолину; 2,6 ЕМФ по формазину)') } },
    { k: 'color', n: 'Цветность', u: 'град.', norm: { max: 20, ref: r(SAN, 'табл. 3.1, п. 3') } },
    { k: 'po', n: 'Окисляемость перманганатная', u: 'мг O₂/л', norm: { max: 5, ref: r(SAN, 'табл. 3.3, п. 4') } },
    { k: 'ph', n: 'Водородный показатель', u: 'ед. pH', norm: { min: 6, max: 9, ref: r(SAN, 'табл. 3.3, п. 6') } },
    { k: 'alk', n: 'Щёлочность', u: 'мг-экв/л' },
    { k: 'hard', n: 'Жёсткость общая', u: 'мг-экв/л', norm: { max: 7, ref: r(SAN, 'табл. 3.3, п. 2') } },
    { k: 'tds', n: 'Общая минерализация (сухой остаток)', u: 'мг/л', norm: { max: 1000, ref: r(SAN, 'табл. 3.3, п. 1') } },
    { k: 'fe', n: 'Железо (суммарно)', u: 'мг/л', norm: { max: 0.3, ref: r(SAN, 'табл. 3.13, п. 556') } },
    { k: 'mn', n: 'Марганец (суммарно)', u: 'мг/л', norm: { max: 0.1, ref: r(SAN, 'табл. 3.13, п. 717') } },
    { k: 'nh4', n: 'Аммиак и аммоний-ион', u: 'мг/л', norm: { max: 1.5, ref: r(SAN, 'табл. 3.13, п. 106') } },
    { k: 'no3', n: 'Нитраты (NO₃⁻)', u: 'мг/л', norm: { max: 45, ref: r(SAN, 'табл. 3.13, п. 859') } },
    { k: 'f', n: 'Фториды (F⁻)', u: 'мг/л', norm: { max: 1.5, ref: r(SAN, 'табл. 3.13, п. 1227') } },
    { k: 'h2s', n: 'Сероводород', u: 'мг/л', norm: { max: 0.05, ref: r(SAN, 'табл. 3.13, п. 1022') } },
    { k: 'oil', n: 'Нефтепродукты (суммарно)', u: 'мг/л', norm: { max: 0.1, ref: r(SAN, 'табл. 3.3, п. 3') } },
    { k: 'co2', n: 'Углекислота свободная', u: 'мг/л' },
    { k: 'phyto', n: 'Фитопланктон', u: 'кл/мл' },
    { k: 'temp', n: 'Температура воды (зимой)', u: '°C' }
  ];
  // доля двухвалентного железа (%) и обобщённые колиформные бактерии (КОЕ/100 мл) — входные данные, но не строки профиля
  const EXTRA = [{ k: 'fe2', n: 'Доля двухвалентного железа', u: '%' }, { k: 'coli', n: 'Обобщённые колиформные бактерии', u: 'КОЕ/100 мл' }];
  const NORM_MICRO = r(SAN, 'табл. 3.5: ОКБ, E. coli, энтерококки — отсутствие в 100 мл; ОМЧ не более 50 КОЕ/мл');
  const RESID_CL = { free: [0.3, 0.5], bound: [0.8, 1.2], ref: r(SAN, 'табл. 3.13, п. 1230') };

  /* ---------- примеры воды источников ---------- */
  const PRESETS = [
    { id: 'river-b1', n: 'Река средней мутности и цветности', src: 'surface', q: 20000,
      c: { turb: 80, color: 60, po: 8, ph: 7.2, alk: 2, hard: 3.5, tds: 300, fe: 0.6, mn: 0.05, nh4: 0.5, no3: 5, f: 0.3, h2s: 0, oil: 0.05, co2: 5, phyto: 500, temp: 2, fe2: 0, coli: 1000 } },
    { id: 'colored-a1', n: 'Цветная маломутная вода (болотное питание)', src: 'surface', q: 8000,
      c: { turb: 8, color: 120, po: 9, ph: 6.8, alk: 0.8, hard: 1.5, tds: 120, fe: 0.8, mn: 0.04, nh4: 0.4, no3: 2, f: 0.2, h2s: 0, oil: 0.03, co2: 8, phyto: 300, temp: 1, fe2: 0, coli: 800 } },
    { id: 'turbid-c1', n: 'Мутная равнинная река в паводок', src: 'surface', q: 50000,
      c: { turb: 600, color: 18, po: 6, ph: 7.6, alk: 3, hard: 4, tds: 400, fe: 1, mn: 0.05, nh4: 0.6, no3: 8, f: 0.4, h2s: 0, oil: 0.05, co2: 4, phyto: 200, temp: 1, fe2: 0, coli: 1000 } },
    { id: 'reservoir', n: 'Водохранилище с цветением водорослей', src: 'surface', q: 30000,
      c: { turb: 20, color: 50, po: 7, ph: 8.2, alk: 2.4, hard: 3, tds: 280, fe: 0.3, mn: 0.08, nh4: 0.8, no3: 3, f: 0.3, h2s: 0, oil: 0.05, co2: 2, phyto: 20000, temp: 3, fe2: 0, coli: 600 } },
    { id: 'ground-fe', n: 'Подземная вода с железом', src: 'ground', q: 3000,
      c: { turb: 2, color: 10, po: 2, ph: 7.1, alk: 4.5, hard: 5, tds: 450, fe: 2.5, mn: 0.08, nh4: 1, no3: 1, f: 0.5, h2s: 0.2, oil: 0, co2: 30, phyto: 0, temp: 7, fe2: 90, coli: 0 } },
    { id: 'ground-femnf', n: 'Подземная вода: железо, марганец и фтор', src: 'ground', q: 5000,
      c: { turb: 3, color: 15, po: 3, ph: 7, alk: 5, hard: 6, tds: 700, fe: 12, mn: 0.8, nh4: 1.2, no3: 1, f: 3.2, h2s: 0.5, oil: 0, co2: 60, phyto: 0, temp: 8, fe2: 85, coli: 0 } },
    { id: 'ground-hard', n: 'Жёсткая минерализованная подземная вода', src: 'ground', q: 2000,
      c: { turb: 1, color: 5, po: 1.5, ph: 7.4, alk: 6, hard: 12, tds: 1600, fe: 0.4, mn: 0.05, nh4: 0.3, no3: 20, f: 1.2, h2s: 0, oil: 0, co2: 20, phyto: 0, temp: 9, fe2: 80, coli: 0 } }
  ];

  /* ---------- стадии и сооружения ---------- */
  const STAGES = [
    { id: 'pre', n: 'Предварительная обработка' }, { id: 'reag', n: 'Реагенты и смешение' }, { id: 'clar', n: 'Осветление и обесцвечивание' },
    { id: 'filt', n: 'Фильтрование' }, { id: 'spec', n: 'Специальная обработка' }, { id: 'dis', n: 'Обеззараживание' }
  ];
  const lim = (v, cap) => Math.min(v, cap); // «не более»: сооружение не ухудшает воду
  const red = (v, pct) => v * (1 - pct / 100);
  // ctx: { s: качество (меняется на месте), f: флаги пройденной обработки, warn(text, ref, level), src, q }
  const UNITS = [
    /* --- предварительная обработка --- */
    { id: 'micro', st: 'pre', code: 'СтФ', own: 1.5,
      apply(c) { if (c.f.reag) c.warn('Сетчатые фильтры ставят до ввода реагентов.', r(SP, 'п. 9.11', 34)); c.s.phyto = red(c.s.phyto, 70); c.f.screened = true; }, est: ['phyto'] },
    { id: 'presettle', st: 'pre', code: 'От', apply(c) { const s = c.s; if (s.turb <= 1500) c.warn('Предварительные радиальные отстойники предназначены для вод мутностью свыше 1500 мг/л.', r(SP, 'табл. 11, п. 9', 34), 'info');
        s.turb = c.f.reag ? lim(s.turb, 250) : lim(s.turb, Math.max(250, s.turb * 0.6)); c.f.clarified = true; } },
    { id: 'biopre', st: 'pre', code: 'БПБ', est: ['po', 'nh4'],
      apply(c) { const s = c.s; if (s.temp <= 5) c.warn('Биологическая предочистка работает при температуре выше 5 °С; зимой её эффект мал.', r(SP, 'табл. Б.3', 143), 'warn');
        const k = s.temp > 5 ? 1 : 0.3; s.po = red(s.po, 20 * k); s.nh4 = red(s.nh4, 50 * k); s.phyto = red(s.phyto, 50 * k); s.fe = red(s.fe, 20 * k); } },
    { id: 'aersimple', st: 'pre', code: 'А', own: 0,
      apply(c) { const s = c.s, fe2 = s.fe * (c.x.fe2 ?? 80) / 100, bad = [];
        if (s.fe > 10) bad.push('железо больше 10 мг/л'); if ((c.x.fe2 ?? 80) < 70) bad.push('двухвалентного железа меньше 70 %'); if (s.ph < 6.8) bad.push('pH ниже 6,8');
        if (s.alk <= 1 + fe2 / 28) bad.push(`щёлочность не больше ${(1 + fe2 / 28).toFixed(2)} мг-экв/л`); if (s.h2s > 2) bad.push('сероводорода больше 2 мг/л');
        if (bad.length) c.warn(`Упрощённая аэрация не применима: ${bad.join(', ')}. Нужны аэраторы или реагенты-окислители.`, r(SP, 'п. 9.148, 9.150', 59), 'bad');
        c.f.oxFe = bad.length ? 'weak' : 'aer'; s.co2 = red(s.co2, 10); } },
    { id: 'aerdeep', st: 'pre', code: 'А', est: ['co2'],
      apply(c) { const s = c.s; if (s.h2s > 3) c.warn('Аэрационный метод удаления сероводорода допустим до 3 мг/л; при большем содержании — химический (до 10 мг/л).', r(SP, 'п. 9.164', 61), 'bad');
        else if (s.h2s > 0) s.h2s = lim(s.h2s, 0.05);
        const dCO2 = s.co2 * 0.8; s.co2 -= dCO2; s.ph = Math.min(8.3, s.ph + Math.log10(1 + dCO2 / 10) * 0.6); c.f.oxFe = 'deep'; } },
    { id: 'prechlor', st: 'pre', code: 'Хл', apply(c) { const s = c.s; c.f.chlorinatedRaw = true; c.f.oxFe = c.f.oxFe || 'cl'; s.h2s = lim(s.h2s, s.h2s > 10 ? s.h2s : 0.05); s.color = red(s.color, 10);
        if (s.po > 5) c.warn('Хлорирование воды с высокой окисляемостью образует тригалометаны; хлорирование, влекущее их избыточное образование, допускается только если другие методы неэффективны. Норматив хлороформа — 0,06 мг/л.', r(SP, 'п. 9.135', 57), 'warn'); }, est: ['color'] },
    { id: 'preozone', st: 'pre', code: 'ОЗ', est: ['color', 'po'],
      apply(c) { const s = c.s; s.color = red(s.color, 40); s.po = red(s.po, 10); c.f.oxFe = c.f.oxFe || 'oz'; c.f.oxMn = true; c.f.ozoned = true; } },
    { id: 'kmno4', st: 'pre', code: 'Ок', apply(c) { c.f.oxMn = true; c.f.oxFe = c.f.oxFe || 'kmn'; } },
    /* --- реагенты --- */
    { id: 'alkali', st: 'reag', code: 'Щ', apply(c) { c.f.alkali = true; } },
    { id: 'coag', st: 'reag', code: 'К(Ф)', est: ['ph', 'alk'],
      apply(c) { const s = c.s; c.f.reag = true; c.f.coag = true; c.f.alStage = true;
        const need = c.dose.coag / 57, Dsh = 28 * (need - s.alk) + 1; // мг-экв/л, расходуемые сульфатом алюминия; доза извести по формуле (5)
        if (!c.f.alkali && Dsh > 0) c.warn(`Щёлочности (${fmt(s.alk)} мг-экв/л) не хватит для гидролиза коагулянта дозой ${c.dose.coag} мг/л: по формуле (5) нужно подщелачивание ${fmt(Dsh)} мг/л извести.`, r(SP, 'п. 9.16', 35), 'warn');
        s.alk = c.f.alkali && Dsh > 0 ? 1 / 28 + (s.alk > need ? s.alk - need : 0) + 0.04 : Math.max(0.05, s.alk - need); s.ph = c.f.alkali ? s.ph : s.ph - Math.min(0.6, need * 0.4); } },
    /* --- осветление --- */
    { id: 'vsettle', st: 'clar', code: 'ОтР', est: ['po', 'fe', 'phyto'],
      apply(c) { settler(c, 'вертикальные отстойники', 5000, null); } },
    { id: 'hsettle', st: 'clar', code: 'ОтР', est: ['po', 'fe', 'phyto'],
      apply(c) { settler(c, 'горизонтальные отстойники', null, 30000); } },
    { id: 'clarifier', st: 'clar', code: 'ОВОР', est: ['po', 'fe', 'phyto'],
      apply(c) { const s = c.s; if (!c.f.coag) c.warn('Осветлители со взвешенным осадком работают на коагулированной воде.', r(SP, 'табл. 11', 33), 'bad');
        if (s.turb < 50) c.warn('Осветлители со взвешенным осадком применяют при мутности не менее 50 мг/л: при меньшей слой осадка не держится.', r(SP, 'табл. 11, п. 4', 33), 'warn');
        if (s.turb > 1500) c.warn('Для мутности свыше 1500 мг/л нужны две ступени отстаивания.', r(SP, 'табл. 11, п. 5', 33), 'bad');
        partial(c); } },
    { id: 'flot', st: 'clar', code: 'ФлР', est: ['turb', 'color', 'phyto', 'po', 'fe'],
      apply(c) { const s = c.s; if (!c.f.coag) c.warn('Флотация в водоподготовке работает на коагулированной воде.', r(SP, 'табл. Б.3', 144), 'warn');
        if (s.turb > 150) c.warn('Флотация рассчитана на маломутные воды; для мутных выбирают отстойники или осветлители.', r(SP, 'табл. Б.3', 144), 'warn');
        partial(c); s.phyto = red(s.phyto, 80); s.oil = red(s.oil, 50); } },
    { id: 'prefilt', st: 'clar', code: 'КПФ', est: ['turb', 'color'],
      apply(c) { const s = c.s; if (!c.f.coag) c.warn('Контактные префильтры работают на коагулированной воде.', r(SP, 'табл. 11, п. 3', 33), 'bad');
        if (s.turb > 300) c.warn('Контактные префильтры применяют при мутности до 300 мг/л.', r(SP, 'табл. 11, п. 3', 33), 'bad');
        s.turb = lim(s.turb, s.turb > 300 ? s.turb * 0.3 : 10); s.color = lim(s.color, 30); c.f.clarified = true; c.f.prefilt = true; } },
    /* --- фильтрование --- */
    { id: 'rfilter', st: 'filt', code: 'СкФР', est: ['po', 'fe'],
      apply(c) { rapid(c); } },
    { id: 'cclar', st: 'filt', code: 'СкФР', apply(c) { const s = c.s; if (!c.f.coag) c.warn('Контактные осветлители работают на воде с коагулянтом.', r(SP, 'табл. 11, п. 6', 33), 'bad');
        if (s.turb > 70 || s.color > 70) { c.warn(`Контактные осветлители применяют при мутности до 70 мг/л и цветности до 70°; здесь ${fmt(s.turb)} мг/л и ${fmt(s.color)}°.`, r(SP, 'табл. 11, п. 6', 33), 'bad'); s.turb = red(s.turb, 90); s.color = red(s.color, 60); }
        else { s.turb = lim(s.turb, 1.5); s.color = lim(s.color, 20); }
        filtered(c); } },
    { id: 'sfilter', st: 'filt', code: 'МФ', apply(c) { const s = c.s; if (s.turb > 50) { c.warn('Медленные фильтры применяют при мутности до 50 мг/л.', r(SP, 'табл. Б.3', 142), 'bad'); s.turb = red(s.turb, 90); }
        else s.turb = lim(s.turb, 1.5);
        if (s.color > 50) c.warn('Медленные фильтры снижают цветность до 20° только при исходной не более 50°.', r(SP, 'табл. 11, п. 13', 34), 'warn'); else s.color = lim(s.color, 20);
        filtered(c); c.f.barrier = (c.f.barrier || 0) + 1; } },
    { id: 'gfilter', st: 'filt', code: 'СкФР', est: ['turb', 'mn'],
      apply(c) { ironFilter(c, false); } },
    { id: 'biofilt', st: 'filt', code: 'СкФР', est: ['turb', 'fe', 'mn'],
      apply(c) { ironFilter(c, true); } },
    { id: 'uf', st: 'filt', code: 'УУФ', est: ['turb', 'color', 'po'],
      apply(c) { const s = c.s; if (s.turb > 100) c.warn('Ультрафильтрацию применяют при мутности до 100 мг/л.', r(SP, 'табл. Б.3', 142), 'bad');
        s.turb = lim(s.turb, 0.5); if (c.f.coag) { s.color = lim(s.color, 20); s.po = red(s.po, 30); s.fe = lim(s.fe, 0.1); } else { s.color = red(s.color, 20); }
        filtered(c); c.f.membrane = true; } },
    /* --- специальная обработка --- */
    { id: 'ozone', st: 'spec', code: 'ОЗ', est: ['color', 'po'],
      apply(c) { const s = c.s; s.color = red(s.color, 50); s.po = red(s.po, 15); c.f.ozoned = true; c.f.oxMn = true; } },
    { id: 'gac', st: 'spec', code: 'СрГУ', est: ['po', 'nh4', 'oil'],
      apply(c) { const s = c.s; if (s.turb > 10 || s.color > 20) c.warn('На угольные фильтры подают уже осветлённую воду: мутность до 10 мг/л, цветность до 20°.', r(SP, 'табл. Б.3', 144), 'warn');
        s.po = red(s.po, c.f.ozoned ? 50 : 35); s.oil = lim(s.oil, s.oil > 1 ? s.oil * 0.2 : 0.05); s.nh4 = red(s.nh4, c.f.ozoned ? 40 : 15); s.color = red(s.color, 30); s.h2s = lim(s.h2s, 0.05);
        if (c.f.ozoned && c.src === 'ground') { s.fe = lim(s.fe, 0.1); s.mn = lim(s.mn, 0.05); } s.turb = lim(s.turb, 1.5); c.f.filtered = true; } },
    { id: 'pac', st: 'spec', code: 'СрПУ', est: ['po', 'oil'],
      apply(c) { const s = c.s; s.po = red(s.po, 15); s.oil = red(s.oil, 50); c.f.pacPending = true; } },
    { id: 'alumina', st: 'spec', code: '', apply(c) { const s = c.s; if (s.f > 10) { c.warn('Сорбцию на активированном оксиде алюминия применяют при фторе до 10 мг/л.', r(SP, 'п. 9.163', 61), 'bad'); s.f = red(s.f, 80); } else s.f = lim(s.f, 1.0);
        if (s.turb > 1.5 || s.fe > 0.3) c.warn('На сорбционные фильтры подают воду после обезжелезивания и осветления, иначе сорбент засоряется.', r(SP, 'табл. Б.7', 148), 'warn'); } },
    { id: 'softlime', st: 'spec', code: 'УмР', own: 25, est: ['hard', 'alk', 'tds'],
      apply(c) { const s = c.s, carb = Math.min(s.hard, s.alk), rest = s.hard - carb; s.hard = rest + 0.7; s.alk = 0.7; s.tds = Math.max(50, s.tds - carb * 60); s.ph = Math.max(s.ph, 8.5); c.f.softened = true; } },
    { id: 'nacat', st: 'spec', code: '', est: ['hard'],
      apply(c) { const s = c.s, target = c.x.hardTarget || 5, x = s.hard > target ? (s.hard - target) / (s.hard - 0.05) : 0; c.blend.nacat = x; s.hard = s.hard - x * (s.hard - 0.05); c.f.softened = true; } },
    { id: 'ro', st: 'spec', code: 'ОО', est: ['tds', 'hard', 'no3', 'f', 'po'],
      apply(c) { const s = c.s; if (s.turb > 0.5) c.warn('Перед обратным осмосом мутность должна быть не более 0,5 мг/л — нужна предочистка (ультрафильтрация).', r(SP, 'табл. Б.3', 142), 'bad');
        if (s.po > 7) c.warn('Обратный осмос применяют при ПО до 7 мг O₂/л.', r(SP, 'табл. Б.3', 142), 'warn');
        const target = c.x.tdsTarget || 500, perm = 0.03; // доля солей в пермеате — ориентир
        const x = s.tds > target ? Math.min(1, (s.tds - target) / (s.tds * (1 - perm))) : 0; c.blend.ro = x;
        const mix = k => { s[k] = s[k] * (1 - x) + s[k] * perm * x; }; ['tds', 'hard', 'no3', 'f', 'alk'].forEach(mix); s.po = s.po * (1 - x * 0.9); c.f.softened = true; } },
    { id: 'stab', st: 'spec', code: 'СтР', apply(c) { c.f.stabilized = true; c.s.ph = Math.min(Math.max(c.s.ph, 7), 8.5); } },
    /* --- обеззараживание --- */
    { id: 'chlor', st: 'dis', code: 'Хл', apply(c) { disinfect(c, 'cl'); } },
    { id: 'chloramine', st: 'dis', code: 'Хл', apply(c) { disinfect(c, 'nh2cl'); } },
    { id: 'clo2', st: 'dis', code: 'Хл', apply(c) { disinfect(c, 'clo2'); } },
    { id: 'uv', st: 'dis', code: 'УФ-об', apply(c) { disinfect(c, 'uv'); } }
  ];
  // текст статей о сооружениях — Markdown-файлы content/kb/dwunits/<id>.md (собраны в js/content.js);
  // здесь он соединяется с расчётом: название n, вводная d, «Как работает» how, параметры params, источники refs
  const CT = root.SeshatContent || (typeof require !== 'undefined' ? require('./content.js') : null);
  const TXT = Object.fromEntries(((CT && CT.dwunits) || []).map(x => [x.id, x]));
  UNITS.forEach(u => { const x = TXT[u.id]; if (!x) return;
    Object.assign(u, { n: x.t, d: x.lead, s: x.s, how: x.s.map(([, t]) => t).join('\n\n'), params: x.p,
      refs: x.src.map(([doc, , w]) => { const m = /^(.*?),\s*с\.\s*(\d+)$/.exec(w); return m ? r(doc, m[1], +m[2]) : r(doc, w); }) }); });
  const BY = Object.fromEntries(UNITS.map(u => [u.id, u]));
  const fmt = v => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100).toLocaleString('ru-RU');

  /* ---------- правила для групп сооружений ---------- */
  // отстойники: частичное осветление (табл. 11, п. 7): мутность 8–15 мг/л, цветность до 40°
  function settler(c, name, qMax, qMin) {
    const s = c.s;
    if (!c.f.coag) c.warn(`${cap(name)} в водоподготовке рассчитаны на коагулированную воду; без реагентов задерживается лишь грубая взвесь.`, r(SP, 'табл. 11', 33), 'warn');
    if (qMax && c.q > qMax) c.warn(`${cap(name)} применяют при производительности до ${qMax.toLocaleString('ru-RU')} м³/сут.`, r(SP, 'табл. 11, п. 1', 33), 'warn');
    if (qMin && c.q <= qMin) c.warn(`${cap(name)} — для станций свыше ${qMin.toLocaleString('ru-RU')} м³/сут; для меньших — вертикальные отстойники или осветлители.`, r(SP, 'табл. 11, п. 2', 33), 'info');
    if (s.turb > 1500) c.warn('Для мутности свыше 1500 мг/л нужны две ступени отстойников.', r(SP, 'табл. 11, п. 5', 34), 'bad');
    if (!c.f.coag) { s.turb = red(s.turb, 50); return; }
    partial(c);
  }
  function partial(c) { const s = c.s; s.turb = lim(s.turb, 15); s.color = lim(s.color, 40); s.po = red(s.po, 40); s.fe = red(s.fe, 50); s.phyto = red(s.phyto, 50); c.f.clarified = true; c.f.barrier = (c.f.barrier || 0) + 1; }
  // скорые фильтры: после осветления — 1,5 мг/л и 20° (табл. 11, п. 1–5); без осветления — реагентное фильтрование (Б.3: М < 200, Ц < 200°)
  function rapid(c) {
    const s = c.s;
    if (c.f.pacPending) c.f.pacPending = false;
    if (c.f.oxFe && !c.f.coag && c.src === 'ground') return ironFilter(c, false);
    if (!c.f.coag) {
      c.warn('Скорые фильтры без коагулянта задерживают только грубую взвесь: цветность и коллоиды проходят.', r(SP, 'табл. 11', 33), 'warn');
      s.turb = red(s.turb, 50); filtered(c); return;
    }
    if (!c.f.clarified && !c.f.filtered) {
      if (s.turb > 200 || s.color > 200) c.warn(`Реагентное фильтрование без отстаивания применяют при мутности до 200 мг/л и цветности до 200°; здесь ${fmt(s.turb)} мг/л и ${fmt(s.color)}°.`, r(SP, 'табл. Б.3, СкФР', 144), 'bad');
      c.warn('Одноступенчатое фильтрование как законченная схема допускается только при обосновании.', r(SP, 'табл. 11, прим. 1', 34), 'info');
      if (s.turb > 200) { s.turb = red(s.turb, 95); s.color = red(s.color, 60); } else { s.turb = lim(s.turb, 1.5); s.color = lim(s.color, 20); }
    } else { s.turb = lim(s.turb, 1.5); s.color = lim(s.color, 20); }
    s.po = red(s.po, 10); if (c.src === 'surface') s.fe = lim(s.fe, 0.3); s.mn = c.f.oxMn ? lim(s.mn, 0.1) : s.mn;
    filtered(c);
  }
  function filtered(c) { c.f.filtered = true; c.f.pacPending = false; c.f.barrier = (c.f.barrier || 0) + 1; if (c.f.alStage) c.f.alStage = false; }
  // обезжелезивание и деманганация подземных вод — по табл. Б.7 и п. 9.148
  function ironFilter(c, bio) {
    const s = c.s, ox = c.f.oxFe;
    if (bio) {
      if (s.fe < 10 && s.mn < 1 && s.ph >= 6) { s.fe = lim(s.fe, 0.05); s.mn = lim(s.mn, 0.05); }
      else if (s.fe < 15 && s.mn < 1) { s.fe = lim(s.fe, 0.3); s.mn = lim(s.mn, 0.1); }
      else if (c.f.oxMn && s.fe < 20 && s.mn < 2) { s.fe = lim(s.fe, 0.1); s.mn = lim(s.mn, 0.05); }
      else { c.warn('Для такого железа и марганца биосорбции мало: по табл. Б.7 нужны глубокая аэрация, коагуляция или перманганат калия.', r(SP, 'табл. Б.7', 147), 'bad'); s.fe = red(s.fe, 80); s.mn = red(s.mn, 50); }
    } else if (c.f.coag && s.fe <= 30 && s.mn < 5) { s.fe = lim(s.fe, 0.3); s.mn = c.f.oxMn ? lim(s.mn, 0.1) : red(s.mn, 30); }
    else if (ox === 'aer') { s.fe = lim(s.fe, 0.3); if (s.mn > 0.1 && !c.f.oxMn) c.warn('Упрощённая аэрация не удаляет марганец сверх 0,1 мг/л: проверьте удаление при обезжелезивании или добавьте окислитель.', r(SP, 'п. 9.162', 61), 'warn'); else s.mn = lim(s.mn, 0.1); }
    else if (ox === 'deep') { if (s.fe <= 5 && s.mn <= 0.5 && s.ph >= 7) { s.fe = lim(s.fe, 0.3); s.mn = lim(s.mn, 0.1); } else { s.fe = lim(s.fe, s.fe > 20 ? s.fe * 0.2 : 0.3); if (c.f.oxMn && s.mn < 2) s.mn = lim(s.mn, 0.05); else if (s.mn > 0.5) c.warn('Глубокая аэрация с фильтрованием удаляет марганец до 0,5 мг/л; при большем — окислители (перманганат, озон).', r(SP, 'табл. Б.7, подкласс 2.2', 147), 'warn'); } }
    else if (ox === 'cl' || ox === 'kmn' || ox === 'oz') { s.fe = lim(s.fe, 0.3); if (c.f.oxMn && s.mn < 2) s.mn = lim(s.mn, 0.05); }
    else if (ox === 'weak') { c.warn('Условия упрощённой аэрации не выполнены — железо задерживается фильтром лишь частично.', r(SP, 'п. 9.148, 9.150', 59), 'bad'); s.fe = red(s.fe, 50); }
    else { c.warn('Перед фильтрами обезжелезивания нужна аэрация или реагент-окислитель.', r(SP, 'п. 9.147', 59), 'bad'); s.fe = red(s.fe, 30); }
    s.turb = lim(s.turb, 1.5);
    filtered(c);
  }
  function disinfect(c, kind) {
    const s = c.s; c.f.disinfected = kind;
    if (c.src === 'surface' && s.turb > 1.5) c.warn('Обеззараживание мутной воды ненадёжно: частицы прикрывают микроорганизмы. Перед ним вода должна быть осветлена.', NORM_MICRO, 'bad');
    if (kind === 'uv') { if (c.src === 'ground' && (s.fe > 0.3 || s.turb > 1.5 || s.color > 20)) c.warn('УФ-обеззараживание подземных вод применяют при постоянном соответствии физико-химическим нормам: железо и мутность гасят излучение.', r(SP, 'п. 9.132', 57), 'bad'); c.f.uv = true; return; }
    c.f.residual = kind === 'nh2cl' ? 'bound' : kind === 'clo2' ? 'clo2' : 'free';
    if ((kind === 'cl') && s.po > 5) c.warn(`Хлорирование воды с окисляемостью ${fmt(s.po)} мг O₂/л образует тригалометаны (норматив хлороформа 0,06 мг/л); органический углерод в воде, поступающей на хлорирование, — не более 5 мг/л.`, r(SAN, 'табл. 3.3, п. 8; табл. 3.13, п. 1252'), 'warn');
  }
  const cap = t => t[0].toUpperCase() + t.slice(1);

  /* ---------- моделирование цепочки ---------- */
  // input: { src: 'surface'|'ground', q, c: {...качество}, scheme: [id…], dose: { coag }, x: { hardTarget, tdsTarget } }
  function simulate(input) {
    const s = {}; PARAMS.forEach(p => { s[p.k] = Number(input.c[p.k]) || 0; });
    const x = { fe2: input.c.fe2 ?? 80, hardTarget: input.hardTarget, tdsTarget: input.tdsTarget };
    const warns = [], f = {}, blend = {};
    const ctx = { s, f, x, blend, src: input.src, q: input.q, dose: { coag: input.coagDose ?? 40 }, step: -1,
      warn(text, ref, level = 'warn') { warns.push({ text, ref, level, step: ctx.step }); } };
    const steps = [{ id: null, q: { ...s } }];
    let own = 0;
    (input.scheme || []).forEach((id, i) => {
      const u = BY[id]; if (!u) return;
      ctx.step = i; u.apply(ctx);
      PARAMS.forEach(p => { if (s[p.k] < 0) s[p.k] = 0; });
      own = Math.max(own, u.own || 0);
      steps.push({ id, q: { ...s } });
    });
    ctx.step = -1;
    // сквозные проверки схемы
    const ids = input.scheme || [];
    if (f.pacPending) ctx.warn('После ввода порошкового угля нужны фильтры: уголь должен задержаться.', r(SP, 'п. 9.138', 57), 'bad');
    if (f.alStage) ctx.warn('После коагуляции нет фильтрования: остаточный алюминий и хлопья уйдут с водой (норматив алюминия 0,2 мг/л).', r(SAN, 'табл. 3.13, п. 41'), 'bad');
    if (!f.disinfected) ctx.warn(input.src === 'ground' ? 'Нет обеззараживания. На подземных водозаборах производительностью более 50 м³/сут его предусматривают независимо от качества исходной воды.' : 'Нет обеззараживания: без него питьевая вода из поверхностного источника не соответствует микробиологическим нормативам.', input.src === 'ground' ? r(SP, 'п. 9.113', 53) : NORM_MICRO, 'bad');
    else if (f.uv && !f.residual && input.src === 'surface') ctx.warn('После УФ нет хлорирования: у воды не будет остаточного дезинфектанта для сети. В схемах табл. Б.4 УФ всегда сочетается с хлорированием.', r(SP, 'табл. Б.4', 145), 'warn');
    if (input.src === 'surface' && f.disinfected && !f.filtered && !f.membrane) ctx.warn('Для поверхностной воды одного обеззараживания мало: нужны физические барьеры — осветление и фильтрование.', r(SP, 'п. 9.1, табл. Б.4', 31), 'bad');
    if (f.softened && !f.stabilized) ctx.warn('После умягчения или обессоливания вода теряет стабильность: добавьте стабилизационную обработку.', r(SP, 'табл. Б.3, СтР', 144), 'warn');
    if (s.phyto > 1000 && !ids.includes('micro')) ctx.warn('При содержании фитопланктона более 1000 кл/мл в дополнение к сеткам нужны микрофильтры.', r(SP, 'табл. 11, прим. 3', 34), 'warn');
    // итог: соответствие нормативам
    const out = steps[steps.length - 1].q;
    const check = PARAMS.filter(p => p.norm).map(p => {
      const v = out[p.k], n = p.norm, ok = (n.max == null || v <= n.max + 1e-9) && (n.min == null || v >= n.min - 1e-9);
      return { k: p.k, v, ok, norm: n };
    });
    const micro = f.disinfected && (input.src === 'ground' || f.filtered || f.membrane) && !(input.src === 'surface' && out.turb > 1.5);
    const residual = f.residual === 'free' ? RESID_CL.free : f.residual === 'bound' ? RESID_CL.bound : null;
    return { steps, out, check, micro, residual, warns, own, blend, flags: f, est: estimated(ids) };
  }
  // какие показатели посчитаны по ориентирам, а не по своду правил
  const estimated = ids => [...new Set(ids.flatMap(id => (BY[id] && BY[id].est) || []))];

  /* ---------- классы вод и рекомендуемые схемы (прил. Б) ---------- */
  // Поверхностные воды: классы по табл. Б.1 (упрощённо: при пограничных значениях выбирается ближайший класс)
  const CLASSES = {
    A1: { n: 'Цветные маломутные воды', note: 'Ц = 20–200°, М < 20 мг/л, ПО ≈ 6–10' }, A2: { n: 'Высокоцветные маломутные воды', note: 'Ц = 200–650°, М = 5–50 мг/л' },
    A3: { n: 'Цветные маломутные воды с повышенной окисляемостью', note: 'как А1, ПО ≈ 10–25' }, B1: { n: 'Воды со средней цветностью и мутностью', note: 'Ц = 25–150°, М = 20–150 мг/л' },
    B2: { n: 'Маломутные воды со средней цветностью', note: 'Ц = 25–150°, М = 5–50 мг/л' }, B3: { n: 'Воды средней цветности и мутности с фито- и зоопланктоном', note: 'как В2, Ф = 10³–10⁶ кл/мл' },
    C1: { n: 'Мутные малоцветные воды', note: 'Ц ≤ 20°, М = 250–1000 мг/л' }, C2: { n: 'Высокомутные воды с минеральными загрязнениями', note: 'М = 1000–5000 мг/л, ПО ≈ 3–8' },
    C3: { n: 'Высокомутные воды с повышенной окисляемостью', note: 'как С2, ПО ≈ 8–18' }, D1: { n: 'Воды с большим количеством фито- и зоопланктона', note: 'Ц ≤ 200°, М ≤ 50 мг/л, Ф = 10³–10⁶ кл/мл' },
    D2: { n: 'Воды с планктоном и повышенным содержанием органики', note: 'как D1, ПО ≈ 8–25' }, E: { n: 'Жёсткие минерализованные воды', note: 'С > 1000 мг/л, Жо > 7 мг-экв/л' }
  };
  function surfaceClass(c) {
    if (c.tds > 1000 && c.hard > 7) return 'E';
    if (c.phyto >= 1000 && c.turb <= 50) return c.color >= 25 && c.color <= 150 && c.turb >= 5 ? 'B3' : c.po > 8 ? 'D2' : 'D1';
    if (c.turb >= 1000) return c.po > 8 ? 'C3' : 'C2';
    if (c.turb >= 250) return 'C1';
    if (c.color > 200) return 'A2';
    // маломутные цветные: А — если цветность явно преобладает (Ц ≥ 3·М или Ц > 150°), иначе В2 (средняя цветность)
    if (c.turb < 20 && c.color >= 20) return c.po > 10 ? 'A3' : c.color > 150 || c.turb < 5 || c.color >= 3 * c.turb ? 'A1' : 'B2';
    if (c.turb >= 20) return 'B1';
    return 'B2';
  }
  // Подклассы по антропогенным примесям (табл. Б.2), которые есть в модели: 1 — нефтепродукты, 4 — азот, 6 — металлы (железо)
  function subclasses(c) {
    const out = [];
    if (c.oil > 0.1) out.push(1);
    if (c.nh4 > 2 || c.no3 > 45) out.push(4);
    if (c.fe > 0.3) out.push(6);
    return out;
  }
  // Схемы табл. Б.4 (первый вариант строки), коды методов — табл. Б.3. От/ОбФ — на водозаборе, в цепочку станции не входят.
  const TECH = {
    T1: 'Хл К(Ф) ОтР СкФР УФ-об ХЛ', T2: 'ОЗ К(Ф) ФлР СкФР ОЗ2 СрГУ УФ-об ХЛ', T3: 'БПБ К(Ф) СкФР ОЗ2 СрПУ СкФР УФ-об ХЛ', T4: 'БПБ К(Ф) СкФР ОЗ2 СрГУ УФ-об ХЛ',
    T5: 'БПБ ОЗ К(Ф) ОтР СкФР ОЗ2 СрГУ УФ-об ХЛ', T6: 'ОЗ К(Ф) ОтР СкФР ОЗ2 СрПУ СкФР УФ-об ХЛ', T7: 'Хл К(Ф) СкФР СрПУ СкФР УФ-об ХЛ', T8: 'БПБ К(Ф) СкФР ОЗ2 СрГУ УФ-об ХЛ',
    T9: 'БПБ К(Ф) ОВОР СкФР УФ-об ХЛ', T10: 'БПБ К(Ф) ОтР СкФР ОЗ2 СрГУ УФ-об ХЛ', T11: 'От БПБ К(Ф) СкФР СрПУ СкФР УФ-об ХЛ', T12: 'От БПБ К(Ф) ОВОР СкФР УФ-об ХЛ',
    T13: 'От БПБ К(Ф) ОтР СкФР ОЗ2 СрГУ ХЛ', T14: 'От К(Ф) КПФ ОЗ2 СрПУ СкФР УФ-об ХЛ', T15: 'СтФ БПБ К(Ф) СкФР ОЗ2 СрГУ УФ-об ХЛ', T16: 'СтФ БПБ К(Ф) СкФР ОЗ2 СрПУ СкФР УФ-об ХЛ',
    T17: 'СтФ БПБ К(Ф) ОтР СрПУ СкФР УФ-об ХЛ', T18: 'К(Ф) УУФ ОО СтР ХЛ', T19: 'От БПБ К(Ф) ОВОР СкФР СрПУ СкФР УФ-об ХЛ', T20: 'К(Ф) СкФР УУФ ОО СрГУ СтР УФ-об ХЛ'
  };
  const TECH_PAGE = { T1: 145, T2: 145, T3: 145, T4: 145, T5: 145, T6: 145, T7: 145, T8: 145, T9: 145, T10: 145, T11: 145, T12: 145, T13: 146, T14: 146, T15: 146, T16: 146, T17: 146, T18: 146, T19: 146, T20: 146 };
  // табл. Б.4 — основная технология класса (природные примеси), табл. Б.6 — с учётом подкласса
  const MAIN = { A1: 'T1', A2: 'T5', A3: 'T2', B1: 'T7', B2: 'T8', B3: 'T8', C1: 'T9', C2: 'T12', C3: 'T14', D1: 'T15', D2: 'T17', E: 'T20' };
  const B6 = { // класс → [подкласс 1, 2, 3, 4, 5, 6, 7, 8]
    A1: ['T3', 'T2', 'T2', 'T3', 'T4', 'T1', 'T2', 'T1'], A2: ['T6', 'T5', 'T5', 'T5', 'T6', 'T6', 'T6', 'T6'], B: ['T7', 'T8', 'T8', 'T8', 'T8', 'T7', 'T8', 'T7'],
    C1: ['T9', 'T10', 'T10', 'T10', 'T10', 'T9', 'T10', 'T9'], C2: ['T12', 'T13', 'T13', 'T13', 'T13', 'T13', 'T14', 'T12'], D: ['T16', 'T16', 'T16', 'T17', 'T16', 'T15', 'T17', 'T17'],
    E: ['T19', 'T20', 'T20', 'T20', 'T20', 'T19', 'T18', 'T19']
  };
  const b6row = cls => ({ A3: 'A1', B1: 'B', B2: 'B', B3: 'B', C3: 'C2', D1: 'D', D2: 'D' }[cls] || cls);
  const CODE_UNIT = { 'Хл': 'prechlor', 'ХЛ': 'chlor', 'К(Ф)': 'coag', 'ФлР': 'flot', 'СкФР': 'rfilter', 'УФ-об': 'uv', 'ОЗ': 'preozone', 'ОЗ2': 'ozone', 'СрГУ': 'gac', 'СрПУ': 'pac',
    'БПБ': 'biopre', 'ОВОР': 'clarifier', 'КПФ': 'prefilt', 'От': 'presettle', 'СтФ': 'micro', 'УУФ': 'uf', 'ОО': 'ro', 'СтР': 'stab', 'Щ': 'alkali' };
  function techScheme(code, q) {
    return TECH[code].split(' ').map(k => (k === 'ОтР' ? (q > 30000 ? 'hsettle' : 'vsettle') : CODE_UNIT[k])).filter(Boolean);
  }
  // Подземные воды: подклассы табл. Б.7 и схемы (что очищается до какого уровня)
  const GROUND = [
    { id: '1.1', n: 'Вода без избытка железа и марганца', ok: c => c.fe <= 0.3 && c.mn <= 0.1 && c.f <= 1.5 && c.tds <= 1000, scheme: ['aerdeep', 'stab', 'chlor'], result: 'стабильная вода, IL ≥ 0,3', page: 147 },
    { id: '2.1', n: 'Железо до 3 мг/л, марганец до 0,1', ok: c => c.fe < 3 && c.mn < 0.1 && c.co2 < 45 && c.ph > 6.8 && c.f <= 1.5, scheme: ['aersimple', 'gfilter', 'stab', 'chlor'], result: 'Fe < 0,3, Mn < 0,1 мг/л', page: 147 },
    { id: '2.2', n: 'Железо до 5 мг/л, марганец до 0,5', ok: c => c.fe <= 5 && c.mn <= 0.5 && c.co2 <= 45 && c.ph >= 7 && c.f <= 1.5, scheme: ['aerdeep', 'gfilter', 'stab', 'chlor'], result: 'Fe < 0,3, Mn < 0,1 мг/л', page: 147 },
    { id: '2.3', n: 'Железо до 10, марганец до 1 мг/л', ok: c => c.fe < 10 && c.mn < 1 && c.co2 <= 200 && c.ph >= 6 && c.f <= 1.5, scheme: ['aersimple', 'biofilt', 'stab', 'chlor'], result: 'Fe < 0,05, Mn < 0,05 мг/л', page: 148 },
    { id: '3.1', n: 'Железо до 15, марганец до 1 мг/л', ok: c => c.fe < 15 && c.mn < 1 && c.co2 < 200 && c.f <= 1.5, scheme: ['aerdeep', 'biofilt', 'stab', 'chlor'], result: 'Fe < 0,3, Mn < 0,1 мг/л', page: 148 },
    { id: '3.2', n: 'Железо до 20, марганец до 2 мг/л', ok: c => c.fe < 20 && c.mn < 2 && c.f < 1.5 && c.co2 < 200, scheme: ['aerdeep', 'kmno4', 'biofilt', 'stab', 'chlor'], result: 'Fe < 0,1, Mn < 0,05 мг/л', page: 148 },
    { id: '3.3', n: 'Железо до 20, марганец до 1, избыток фтора', ok: c => c.fe < 20 && c.mn < 1 && c.co2 < 200 && c.ph >= 6 && c.tds <= 1000, scheme: ['aerdeep', 'gfilter', 'ozone', 'gac', 'alumina', 'stab', 'chlor'], result: 'Fe < 0,1, Mn < 0,05, F = 0,7–1,5 мг/л', page: 148 },
    { id: '4.1', n: 'Железо до 25, марганец до 3 мг/л', ok: c => c.fe <= 25 && c.mn < 3 && c.f < 1.5 && c.tds < 1000 && c.ph >= 6, scheme: ['aerdeep', 'coag', 'rfilter', 'ozone', 'gac', 'stab', 'chlor'], result: 'Fe < 0,3, Mn < 0,1 мг/л', page: 148 },
    { id: '4.2', n: 'Железо до 30, марганец до 5, фтор до 7 мг/л', ok: c => c.fe <= 30 && c.mn < 5 && c.f < 7 && c.tds < 1000 && c.ph >= 6, scheme: ['aerdeep', 'coag', 'rfilter', 'ozone', 'gac', 'alumina', 'stab', 'chlor'], result: 'Fe < 0,3, Mn < 0,1, F = 0,7–1,5 мг/л', page: 148 },
    { id: '5.2', n: 'Железо до 40, марганец до 7, фтор до 10, минерализация до 5000 мг/л', ok: c => c.fe <= 40 && c.mn <= 7 && c.f <= 10 && c.tds <= 5000, scheme: ['aerdeep', 'coag', 'rfilter', 'kmno4', 'gfilter', 'uf', 'ro', 'stab', 'chlor'], result: 'Fe < 0,1, Mn < 0,05, F = 0,7–1,5 мг/л, минерализация < 300 мг/л', page: 149 }
  ];
  function classify(input) {
    const c = input.c;
    if (input.src === 'ground') {
      const g = GROUND.find(x => x.ok(c));
      if (!g) return { src: 'ground', id: null, n: 'Вне классификатора табл. Б.7', note: 'Состав воды выходит за пределы табл. Б.7: схему подбирают по результатам технологических изысканий (п. 9.146).', scheme: ['aerdeep', 'coag', 'rfilter', 'kmno4', 'gfilter', 'stab', 'chlor'], ref: r(SP, 'табл. Б.7', 147) };
      const hard = c.hard > 7 || c.tds > 1000, notes = [];
      const scheme = g.scheme.slice();
      if (hard && !scheme.includes('ro')) { scheme.splice(scheme.indexOf('stab'), 0, ...(c.tds > 1000 ? ['uf', 'ro'] : ['nacat'])); notes.push('жёсткость или минерализация выше нормы — добавлено умягчение (п. 9.165)'); }
      if (c.h2s > 0.05 && scheme[0] === 'aersimple') { scheme[0] = 'aerdeep'; notes.push('сероводород — вместо упрощённой аэрации глубокая (п. 9.164)'); }
      return { src: 'ground', id: g.id, n: g.n, note: 'Степень очистки по табл. Б.7: ' + g.result + (notes.length ? '. Дополнено: ' + notes.join('; ') + '.' : ''), scheme, ref: r(SP, `табл. Б.7, подкласс ${g.id}`, g.page) };
    }
    const cls = surfaceClass(c), sub = subclasses(c);
    let code = MAIN[cls], via = 'табл. Б.4';
    if (sub.length) { const row = B6[b6row(cls)]; if (row) { code = row[sub[0] - 1]; via = `табл. Б.6, подкласс ${sub[0]}`; } }
    return { src: 'surface', id: cls, n: CLASSES[cls].n, note: CLASSES[cls].note, sub, code, scheme: techScheme(code, input.q), ref: r(SP, `табл. Б.1; ${via}, схема ${code}`, TECH_PAGE[code]), via };
  }

  /* ---------- расчёт сооружений по СП 31 ---------- */
  // Скорости фильтрования табл. 15 (кварцевый песок, dэкв 0,7–0,8 мм; нормальная/форсированная), промывка табл. 17
  const FILTERS = {
    sand1: { n: 'Однослойный, песок 0,5–1,2 мм', h: '0,7–0,8 м', vn: 5.5, vf: 7, wash: 13, tw: 5.5, page: 46 },
    sand2: { n: 'Однослойный, песок 0,7–1,6 мм', h: '1,3–1,5 м', vn: 7, vf: 8.5, wash: 15, tw: 5.5, page: 46 },
    dual: { n: 'Двухслойный (песок + антрацит или керамзит)', h: '0,7–0,8 + 0,4–0,5 м', vn: 8.5, vf: 10, wash: 15, tw: 6.5, page: 46 }
  };
  // Скорость выпадения взвеси u0, мм/с (табл. 12)
  const U0 = [[50, 0.35, 'маломутные цветные воды с коагулянтом'], [250, 0.45, 'воды средней мутности с коагулянтом'], [Infinity, 0.5, 'мутные воды с коагулянтом']];
  function sizing(input, sim) {
    const Q = input.q, c = input.c, ids = input.scheme || [], rows = [];
    const ownPct = sim.own || (ids.some(id => ['rfilter', 'gfilter', 'biofilt', 'cclar'].includes(id)) ? 4 : 1);
    const Qst = Q * (1 + ownPct / 100), qh = Qst / 24;
    rows.push({ t: 'Станция', items: [
      ['Полезная производительность', fmtN(Q) + ' м³/сут'],
      [`Собственные нужды (${ownPct} %)`, fmtN(Qst - Q) + ' м³/сут', r(SP, 'п. 9.6: 3–4 % при повторном использовании промывной воды, 10–14 % без него, 20–30 % при умягчении', 32)],
      ['Расчётный расход станции', `${fmtN(Qst)} м³/сут = ${fmtN(qh)} м³/ч`, r(SP, 'п. 9.7: равномерная работа в сутки максимального водопотребления', 32)],
      ['Коммуникации — на пропуск', fmtN(qh * 1.25) + ' м³/ч (+20–30 %)', r(SP, 'п. 9.8', 32)]] });
    if (ids.includes('coag')) {
      const Dk = input.coagDose ?? 40, items = [['Доза коагулянта (безводный Al₂(SO₄)₃)', Dk + ' мг/л — по пробному коагулированию', r(SP, 'п. 9.2, 9.15', 31)],
        ['Расход коагулянта', fmtN(Dk * Qst / 1000) + ' кг/сут']];
      const Dsh = 28 * (Dk / 57 - c.alk) + 1;
      items.push(['Доза извести (по CaO) для подщелачивания', Dsh > 0 ? `${fmt(Dsh)} мг/л` : 'не нужна: щёлочности хватает', r(SP, 'п. 9.16, формула (5): Дщ = Кщ(Дк/eк − Щ₀) + 1', 35)]);
      items.push(['Смешение / хлопьеобразование', '0,5–2 мин при G = 300–500 с⁻¹ / 10–20 мин при G = 10–50 с⁻¹', r(SP, 'п. 9.17', 36)]);
      rows.push({ t: 'Реагенты и смешение', items });
    }
    const pre = ids.includes('prechlor'), oz = ids.includes('preozone') || ids.includes('ozone');
    if (pre || oz || ids.includes('kmno4')) {
      const items = [], po = c.po, t20 = po >= 15 ? [12, 14, 6, 10, 5, 8] : po >= 10 ? [8, 12, 4, 6, 3, 5] : [4, 8, 2, 4, 1, 3];
      if (pre) items.push(['Первичное хлорирование', `3–10 мг/л → ${fmtN(6.5 * Qst / 1000)} кг/сут активного хлора при 6,5 мг/л`, r(SP, 'п. 9.15', 35)]);
      if (oz) { const d = ids.includes('preozone') ? (t20[4] + t20[5]) / 2 : 2; items.push(['Озон', `${fmt(d)} мг/л → производительность озонаторов ${fmt(d * Qst / 24 / 1000)} кг/ч, контакт ≥ 12 мин`, r(SP, ids.includes('preozone') ? 'табл. 20; п. 9.129–9.131' : 'п. 9.129: 1–3 мг/л для очищенной поверхностной воды', 56)]); }
      if (ids.includes('kmno4')) { const d = input.src === 'ground' ? c.fe * (c.fe2 ?? 80) / 100 : (t20[2] + t20[3]) / 2; items.push(['Перманганат калия', `${fmt(d)} мг/л → ${fmtN(d * Qst / 1000)} кг/сут`, r(SP, input.src === 'ground' ? 'п. 9.151: Дп = [Fe²⁺]' : 'табл. 20', input.src === 'ground' ? 60 : 58)]); }
      rows.push({ t: 'Окислители', items });
    }
    if (ids.includes('aersimple')) {
      const fe2 = c.fe * (c.fe2 ?? 80) / 100;
      rows.push({ t: 'Упрощённая аэрация', items: [['Воздух для напорных фильтров', `${fmt(2 * fe2 * Qst / 1000)} м³/сут (2 л на 1 г Fe²⁺)`, r(SP, 'п. 9.149', 59)], ['Излив над уровнем воды в открытых фильтрах', '0,5–0,6 м', r(SP, 'п. 9.149', 59)]] });
    }
    const settle = ids.find(id => id === 'vsettle' || id === 'hsettle');
    if (settle === 'vsettle') {
      const [, u0, kind] = U0.find(([m]) => c.turb <= m), beta = 1.4, N = Math.max(2, Math.ceil(qh / 400));
      const F = qh * beta / (3.6 * u0 * N);
      rows.push({ t: 'Вертикальные отстойники', items: [['Скорость выпадения взвеси u₀', `${fmt(u0)} мм/с — ${kind}`, r(SP, 'табл. 12', 41)],
        [`Площадь зоны осаждения одного из ${N} рабочих`, `${fmt(F)} м² (βоб = 1,4) + 1 резервный`, r(SP, 'п. 9.49, формула (7): F = qβ/(3,6·vр·Nр)', 40)],
        ['То же с тонкослойными модулями', `${fmt(qh / N / (c.turb <= 50 ? 3.2 : c.turb <= 250 ? 4 : 5))} м² на отстойник`, r(SP, 'п. 9.50: 3–5,5 м³/(ч·м²)', 41)]] });
    }
    if (settle === 'hsettle') {
      const [, u0] = U0.find(([m]) => c.turb <= m), v = c.turb <= 50 ? 7 : c.turb <= 250 ? 8.5 : 10.5, H = 3.25, L = H * v / u0;
      rows.push({ t: 'Горизонтальные отстойники', items: [['Скорость в начале отстойника', `${v} мм/с`, r(SP, 'п. 9.54', 41)], ['Длина при высоте зоны осаждения 3,25 м', `≈ ${fmt(L)} м (L = H·v/u₀)`, r(SP, 'п. 9.54, табл. 12', 41)],
        ['Ширина коридора', 'не более 6 м; при менее шести — один резервный', r(SP, 'п. 9.54', 42)]] });
    }
    if (ids.includes('clarifier')) {
      const v = c.turb <= 100 ? 0.55 : c.turb <= 400 ? 0.7 : c.turb <= 1000 ? 0.9 : 1.1, kr = c.turb <= 100 ? 0.75 : c.turb <= 400 ? 0.75 : c.turb <= 1000 ? 0.68 : 0.62;
      rows.push({ t: 'Осветлители со взвешенным осадком', items: [['Скорость в зоне осветления (зима)', `${fmt(v)} мм/с`, r(SP, 'табл. 14', 43)], ['Коэффициент распределения воды Кр.в', fmt(kr), r(SP, 'табл. 14', 43)],
        ['Площадь зон осветления', `${fmt(qh * kr / (3.6 * v))} м²`, r(SP, 'табл. 14; расчёт по двум периодам — п. 9.63', 44)], ['Высота слоя взвешенного осадка', '2–2,5 м', r(SP, 'п. 9.64', 44)]] });
    }
    const filt = ids.find(id => ['rfilter', 'gfilter', 'biofilt', 'cclar'].includes(id));
    if (filt) {
      const F0 = filt === 'cclar' ? { n: 'Контактный осветлитель без поддерживающих слоёв', h: '2–2,3 м', vn: 4.5, vf: 5.25, wash: 15, tw: 7, page: 51 } : filt === 'gfilter' || filt === 'biofilt' ? { n: 'Загрузка 0,8–1,8 мм (упрощённая аэрация)', h: '1,0 м', vn: 6, vf: 7.5, wash: 14, tw: 6, page: 60 } : FILTERS[input.filter || 'sand2'];
      const T = 24, n = 2, t2 = 0.33, W = F0.wash, t1 = F0.tw / 60;
      // баланс воды за сутки: фильтрат минус промывная вода и потери на простой (п. 9.81 — учитывать промывку и простой)
      const F = Qst / (T * F0.vn - n * (3.6 * W * t1 + t2 * F0.vn));
      let N = Math.max(Qst > 1600 ? 4 : 2, Math.round(Qst > 8000 ? Math.sqrt(F) / 2 : Math.ceil(F / 50)));
      if (F / N > 110) N = Math.ceil(F / 110);
      // соотношение (9): при ремонте N₁ фильтров скорость на остальных не должна превышать форсированную — добавляем фильтры
      const N1of = k => (k > 20 ? 2 : 1); while (F0.vn * N / (N - N1of(N)) > F0.vf + 1e-9) N++;
      const N1 = N1of(N), vf = F0.vn * N / (N - N1);
      rows.push({ t: filt === 'cclar' ? 'Контактные осветлители' : 'Фильтры', items: [['Загрузка', `${F0.n}, слой ${F0.h}`, r(SP, filt === 'gfilter' || filt === 'biofilt' ? 'табл. 22' : filt === 'cclar' ? 'разд. «Контактные осветлители»' : 'табл. 15', F0.page)],
        ['Скорость при нормальном режиме', `${fmt(F0.vn)} м/ч`, r(SP, filt === 'cclar' ? 'п. 9.101' : filt === 'rfilter' ? 'табл. 15 (меньшие значения — для питьевой воды)' : 'табл. 22', F0.page)],
        ['Промывка', `${W} л/(с·м²), ${F0.tw} мин; ${n} промывки в сутки`, r(SP, 'табл. 17', 49)],
        ['Общая площадь', `${fmt(F)} м²`, r(SP, 'п. 9.81: по скорости нормального режима с учётом расхода на промывку и простоя (простой 0,33 ч — ориентир)', 47)],
        ['Количество фильтров', `${N} по ${fmt(F / N)} м²`, r(SP, Qst > 8000 ? 'п. 9.82, формула (8): N = √F/2; не менее 4 при Q > 1600 м³/сут' : 'п. 9.82: не менее 4 при Q > 1600 м³/сут; площадь одного — до 100–120 м²', 47)],
        ['Форсированный режим (ремонт ' + N1 + ')', `${fmt(vf)} м/ч${vf > F0.vf + 1e-9 ? ` — больше допустимых ${fmt(F0.vf)} м/ч: увеличьте число фильтров` : ` ≤ ${fmt(F0.vf)} м/ч`}`, r(SP, 'п. 9.78, 9.82, формула (9): vф = vн·N/(N − N₁)', 47), vf > F0.vf + 1e-9]] });
    }
    const dis = ids.find(id => ['chlor', 'chloramine', 'clo2'].includes(id));
    if (dis) {
      const d = dis === 'clo2' ? 2 : (input.src === 'ground' ? 1.5 : 3), kg = d * Qst / 1000;
      const items = [['Ориентировочная доза', `${d} мг/л${dis === 'clo2' ? ' (не более 2–3, контакт ≥ 30 мин)' : ' — ориентир, уточняется по хлорпоглощаемости'}`, r(SP, dis === 'clo2' ? 'п. 9.137' : 'п. 9.127: время контакта — по СанПиН; дозу свод правил не задаёт', 56)],
        ['Расход реагента (по активному хлору)', `${fmt(kg)} кг/сут`], ['Остаточный хлор', dis === 'chloramine' ? 'связанный 0,8–1,2 мг/л' : dis === 'chlor' ? 'свободный 0,3–0,5 мг/л' : 'хлориты ≤ 0,2 мг/л', r(SAN, dis === 'clo2' ? 'табл. 3.13, п. 1248' : 'табл. 3.13, п. 1230')]];
      if (dis !== 'clo2') items.push(['Хлорное хозяйство', kg >= 40 ? 'расход ≥ 40 кг/сут — допускается жидкий хлор' : 'расход < 40 кг/сут — гипохлорит натрия', r(SP, 'п. 9.116', 54)]);
      rows.push({ t: 'Обеззараживание', items });
    }
    if (sim.blend.ro != null) rows.push({ t: 'Обратный осмос', items: [['Доля обрабатываемой воды', `${Math.round(sim.blend.ro * 100)} % — остальное подмешивается`, r(SP, 'п. 9.165: обрабатывают часть воды, соотношение — расчётом', 62)], ['Срок службы мембран (для экономики)', '4 года', r(SP, 'п. 9.198', 67)]] });
    if (sim.blend.nacat != null) rows.push({ t: 'Na-катионирование', items: [['Доля обрабатываемой воды', `${Math.round(sim.blend.nacat * 100)} %`, r(SP, 'п. 9.165', 61)]] });
    return rows;
  }
  const fmtN = v => Math.round(v).toLocaleString('ru-RU');
  // какие ориентиры не подтверждены сводом правил — для вопросов и пометок в интерфейсе
  const EST = { mn: 'марганец, если условия схем табл. Б.7 не выполнены', po: 'снижение перманганатной окисляемости сооружениями', fe: 'железо поверхностной воды после осветления и фильтрования', color: 'снижение цветности окислителями и мембранами', nh4: 'удаление аммония биопредочисткой и углём', oil: 'удаление нефтепродуктов углём',
    hard: 'остаточная жёсткость после умягчения', tds: 'минерализация после известкования и обратного осмоса', no3: 'нитраты после обратного осмоса', f: 'фтор после обратного осмоса',
    alk: 'щёлочность после обработки', ph: 'pH после коагуляции и обработки', co2: 'углекислота после дегазации', phyto: 'задержание фитопланктона', turb: 'мутность после мембран и флотации' };

  const api = { PARAMS, EXTRA, PRESETS, STAGES, UNITS, BY, CLASSES, GROUND, TECH, MAIN, B6, FILTERS, U0, RESID_CL, NORM_MICRO, EST, simulate, classify, surfaceClass, subclasses, techScheme, sizing, fmt };
  root.SeshatDW = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
