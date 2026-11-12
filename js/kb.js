// База знаний Сешат: процессы очистки, показатели качества воды, учебники, журналы, сообщества.
// Статьи хранятся в content/kb/<коллекция>/<id>.md и собираются в js/content.js (tools/build-content.js).
// Статьи очистки сточных вод (сооружения, процессы, показатели, здания) — с разметкой js/richtext.js:
// lead — «Коротко», s — разделы [заголовок, текст], n — ключевые числа, see — «См. также», src — источники для сносок [^n].
(function (root) {
  const CT = root.SeshatContent || (typeof require !== 'undefined' ? require('./content.js') : {});

  /* ---------- очистка сточных вод ---------- */
  const UNITS_KB = CT.units || [];          // сооружения каталога, их элементы и опции (role)
  const PROCESSES = CT.processes || [];     // физика и химия процессов
  const INDICATORS = CT.indicators || [];   // показатели качества воды (k — ключ в расчёте конструктора)
  const AUX = CT.aux || [];                 // вспомогательные здания станции
  // связи сооружений с процессами — из поля procs статьи о сооружении
  const UNIT_PROC = Object.fromEntries(UNITS_KB.filter(u => u.procs && u.procs.length).map(u => [u.id, u.procs]));

  /* ---------- книги, на которые ссылаются статьи (сноски «книга | название | глава, страница») ---------- */
  // a — авторы, t — название, pub — выходные данные, url — где прочитать (открытый доступ или DOI), off — сдвиг страниц PDF относительно печатных
  const BIB = {
    iwa2020: { a: 'Chen G., van Loosdrecht M. C. M., Ekama G. A., Brdjanovic D. (ред.)', t: 'Biological Wastewater Treatment: Principles, Modelling and Design. 2nd ed.', pub: 'London: IWA Publishing, 2020. ISBN 978-1-78906-036-2', url: 'https://doi.org/10.2166/9781789060362', note: 'открытый доступ (CC BY-NC-ND 4.0)' },
    mwh2012: { a: 'Crittenden J. C., Trussell R. R., Hand D. W., Howe K. J., Tchobanoglous G.', t: "MWH's Water Treatment: Principles and Design. 3rd ed.", pub: 'Hoboken: John Wiley & Sons, 2012', url: 'https://doi.org/10.1002/9781118131473' },
    yak1975: { a: 'Яковлев С. В., Карелин Я. А., Жуков А. И., Колобанов С. К.', t: 'Канализация: учебник для вузов. 5-е изд., перераб. и доп.', pub: 'М.: Стройиздат, 1975. 632 с.' },
    eawag2014: { a: 'Tilley E., Ulrich L., Lüthi C., Reymond Ph., Schertenleib R., Zurbrügg C.', t: 'Compendium of Sanitation Systems and Technologies. 2nd revised ed.', pub: 'Dübendorf: Eawag, 2014', url: 'https://www.eawag.ch/en/department/sandec/publications/compendium/' },
    me2014: { a: 'Metcalf & Eddy, AECOM: Tchobanoglous G., Stensel H. D., Tsuchihashi R., Burton F.', t: 'Wastewater Engineering: Treatment and Resource Recovery. 5th ed.', pub: 'New York: McGraw-Hill Education, 2014' }
  };

  const B = {
    yakovlev: ['Яковлев С. В., Воронов Ю. В.', 'Водоотведение и очистка сточных вод', 'М.: АСВ, 2004 и переиздания'],
    yak1975: ['Яковлев С. В., Карелин Я. А., Жуков А. И., Колобанов С. К.', 'Канализация. 5-е изд.', 'М.: Стройиздат, 1975'],
    gudkovMech: ['Гудков А. Г.', 'Механическая очистка сточных вод', 'М.; Вологда: Инфра-Инженерия, 2019 (2-е изд.)'],
    gudkovBio: ['Гудков А. Г.', 'Биологическая очистка городских сточных вод', 'Вологда: ВоГТУ, 2002'],
    me2014: ['Metcalf & Eddy, AECOM (Tchobanoglous G. и др.)', 'Wastewater Engineering: Treatment and Resource Recovery, 5th ed.', 'McGraw-Hill, 2014'],
    iwa2020: ['Chen G., van Loosdrecht M. C. M., Ekama G. A., Brdjanovic D. (ред.)', 'Biological Wastewater Treatment: Principles, Modelling and Design, 2nd ed.', 'IWA Publishing, 2020 (открытый доступ)', [['read', 'IWA Publishing, открытый доступ', 'https://doi.org/10.2166/9781789060362']]],
    henze: ['Хенце М., Армоэс П., Ля-Кур-Янсен Й., Арван Э.', 'Очистка сточных вод. Биологические и химические процессы', 'М.: Мир, 2004 (перевод с англ.)'],
    zhmur: ['Жмур Н. С.', 'Технологические и биохимические процессы очистки сточных вод на сооружениях с аэротенками', 'М.: АКВАРОС, 2003'],
    grady: ['Grady C. P. L., Daigger G. T., Love N. G., Filipe C. D. M.', 'Biological Wastewater Treatment, 3rd ed.', 'CRC Press, 2011'],
    asm: ['Henze M., Gujer W., Mino T., van Loosdrecht M.', 'Activated Sludge Models ASM1, ASM2, ASM2d and ASM3', 'IWA Publishing, 2000'],
    turovsky: ['Туровский И. С.', 'Обработка осадков сточных вод', 'М.: Стройиздат'],
    judd: ['Judd S.', 'The MBR Book: Principles and Applications of Membrane Bioreactors, 2nd ed.', 'Butterworth-Heinemann, 2011'],
    voronov: ['Воронов Ю. В., Алексеев Е. В., Саломеев В. П., Пугачёв Е. А.', 'Водоотведение', 'М.: АСВ; ИНФРА-М (переиздания)'],
    kalitsun: ['Калицун В. И.', 'Водоотводящие системы и сооружения', 'М.: Стройиздат'],
    laskov: ['Ласков Ю. М., Воронов Ю. В., Калицун В. И.', 'Примеры расчётов канализационных сооружений', 'М.: Стройиздат'],
    lukinykh: ['Лукиных А. А., Лукиных Н. А.', 'Таблицы для гидравлического расчёта канализационных сетей и дюкеров по формуле акад. Н. Н. Павловского', 'М.: Стройиздат'],
    abramov: ['Абрамов Н. Н.', 'Водоснабжение', 'М.: Стройиздат'],
    abramovNet: ['Абрамов Н. Н., Поспелова М. М., Сомов М. А. и др.', 'Расчёт водопроводных сетей', 'М.: Стройиздат'],
    shevelev: ['Шевелев Ф. А., Шевелев А. Ф.', 'Таблицы для гидравлического расчёта водопроводных труб', 'М.: Стройиздат'],
    nikoladze: ['Николадзе Г. И., Сомов М. А.', 'Водоснабжение', 'М.: Стройиздат'],
    kulsky: ['Кульский Л. А.', 'Теоретические основы и технология кондиционирования воды', 'Киев: Наукова думка'],
    mwh: ['Crittenden J. C. и др.', "MWH's Water Treatment: Principles and Design, 3rd ed.", 'Wiley, 2012'],
    benjamin: ['Benjamin M. M., Lawler D. F.', 'Water Quality Engineering: Physical/Chemical Treatment Processes', 'Wiley, 2013'],
    karelin: ['Карелин В. Я., Минаев А. В.', 'Насосы и насосные станции', 'М.: Стройиздат'],
    vsevol: ['Всеволожский В. А.', 'Основы гидрогеологии', 'М.: Изд-во МГУ'],
    shestakov: ['Шестаков В. М.', 'Гидрогеодинамика', 'М.: Изд-во МГУ'],
    mikhailov: ['Михайлов В. Н., Добровольский А. Д., Добролюбов С. А.', 'Гидрология', 'М.: Высшая школа'],
    vladimirov: ['Владимиров А. М.', 'Гидрологические расчёты', 'Л.: Гидрометеоиздат'],
    rozhd: ['Рождественский А. В., Чеботарев А. И.', 'Статистические методы в гидрологии', 'Л.: Гидрометеоиздат'],
    chowApplied: ['Chow V. T., Maidment D. R., Mays L. W.', 'Applied Hydrology', 'McGraw-Hill, 1988'],
    loucks: ['Loucks D. P., van Beek E.', 'Water Resource Systems Planning and Management', 'Springer, 2017 (открытый доступ)'],
    danilov: ['Данилов-Данильян В. И., Лосев К. С.', 'Потребление воды: экологический, экономический, социальный и политический аспекты', 'М.: Наука, 2006'],
    rasskazov: ['Рассказов Л. Н. (ред.)', 'Гидротехнические сооружения', 'М.: АСВ'],
    novak: ['Novak P., Moffat A. I. B., Nalluri C., Narayanan R.', 'Hydraulic Structures', 'CRC Press'],
    chowOpen: ['Chow V. T.', 'Open-Channel Hydraulics', 'McGraw-Hill, 1959'],
    chugaev: ['Чугаев Р. Р.', 'Гидравлика', 'Л.: Энергоиздат']
  };
  const MODULE_BOOKS = {
    tlazolteotl: [
      { d: 'Водоотведение и очистка сточных вод', list: [B.yakovlev, B.yak1975, B.voronov, B.laskov, B.gudkovMech, B.me2014] },
      { d: 'Биологическая очистка и моделирование', list: [B.iwa2020, B.henze, B.zhmur, B.gudkovBio, B.grady, B.asm] },
      { d: 'Обработка осадков', list: [B.turovsky] },
      { d: 'Физико-химические методы и мембраны', list: [B.mwh, B.judd, B.benjamin] }],
    anahita: [{ d: 'Очистка природных вод', list: [B.nikoladze, B.kulsky, B.abramov, B.mwh, B.benjamin] }],
    juturna: [{ d: 'Сети водоснабжения', list: [B.abramov, B.abramovNet, B.shevelev, B.karelin] }],
    cloacina: [{ d: 'Водоотводящие сети', list: [B.kalitsun, B.voronov, B.yakovlev, B.lukinykh, B.karelin] }],
    enki: [{ d: 'Водозаборные сооружения', list: [B.abramov, B.nikoladze, B.karelin] }, { d: 'Гидрогеология', list: [B.vsevol, B.shestakov] }],
    tlaloc: [{ d: 'Гидрология', list: [B.mikhailov, B.vladimirov, B.rozhd, B.chowApplied] }],
    hapi: [{ d: 'Водные ресурсы и водное хозяйство', list: [B.loucks, B.danilov] }],
    yu: [{ d: 'Гидротехнические сооружения', list: [B.rasskazov, B.novak] }, { d: 'Гидравлика открытых русел', list: [B.chugaev, B.chowOpen] }]
  };

  /* ---------- общие разделы: фундаментальные дисциплины ---------- */
  const FUNDAMENTALS = CT.fundamentals || [];

  /* ---------- общие разделы: гуманитарные аспекты водопользования ---------- */
  const HUMANITIES = CT.humanities || [];
  // водоподготовка («Очистка природных вод»): процессы и показатели — content/kb/drinking/<id>.md
  const DRINKING = CT.drinking || [];

  /* ---------- научные журналы ---------- */
  const JOURNALS = [
    { g: 'Российские', list: [
      ['Водоснабжение и санитарная техника (ВСТ)', 'Старейший отраслевой научно-технический журнал по водоснабжению и водоотведению.', 'https://www.vstmag.ru/'],
      ['НДТ водоснабжения и водоотведения', 'Журнал Российской ассоциации водоснабжения и водоотведения о наилучших доступных технологиях.', 'https://raww.ru/'],
      ['Вода и экология: проблемы и решения', 'Научный журнал СПбГАСУ, входит в перечень ВАК.', 'https://cyberleninka.ru/journal/n/voda-i-ekologiya-problemy-i-resheniya'],
      ['Вода Magazine', 'Ежемесячный отраслевой журнал: технологии, оборудование, опыт водоканалов.', 'https://watermagazine.ru/'],
      ['Вестник МГСУ', 'Научный журнал НИУ МГСУ; есть раздел по водоснабжению и водоотведению.', 'https://vestnikmgsu.ru/']] },
    { g: 'Международные', list: [
      ['Water Research', 'Elsevier, IWA. Один из ведущих журналов по технологиям воды.', 'https://www.sciencedirect.com/journal/water-research'],
      ['Water Research X', 'Открытый доступ, сестринский журнал Water Research.', 'https://www.sciencedirect.com/journal/water-research-x'],
      ['Water Science and Technology', 'IWA Publishing. Широкий охват технологий очистки.', 'https://iwaponline.com/wst'],
      ['Water Environment Research', 'Wiley, журнал Water Environment Federation.', 'https://onlinelibrary.wiley.com/journal/15547531'],
      ['Journal of Water Process Engineering', 'Elsevier. Процессы и аппараты водоочистки.', 'https://www.sciencedirect.com/journal/journal-of-water-process-engineering'],
      ['Bioresource Technology', 'Elsevier. Биотехнологии, в том числе анаэробное сбраживание и биологическая очистка.', 'https://www.sciencedirect.com/journal/bioresource-technology'],
      ['Environmental Science & Technology', 'ACS. Химия и инженерия окружающей среды.', 'https://pubs.acs.org/journal/esthag'],
      ['Journal of Environmental Engineering', 'ASCE. Инженерная экология и очистные сооружения.', 'https://ascelibrary.org/journal/joeedu'],
      ['Journal of Membrane Science', 'Elsevier. Мембранные технологии.', 'https://www.sciencedirect.com/journal/journal-of-membrane-science'],
      ['Desalination', 'Elsevier. Опреснение и обратный осмос.', 'https://www.sciencedirect.com/journal/desalination'],
      ['npj Clean Water', 'Nature Portfolio, открытый доступ.', 'https://www.nature.com/npjcleanwater/'],
      ['Water (MDPI)', 'Открытый доступ, широкий профиль водных наук.', 'https://www.mdpi.com/journal/water']] }
  ];

  /* ---------- сообщества ---------- */
  const COMMUNITIES = [
    { g: 'Российские', list: [
      ['РАВВ — Российская ассоциация водоснабжения и водоотведения', 'Объединяет водоканалы и отраслевые организации: нормативы, справочники НДТ, конференции, обучение.', 'https://raww.ru/'],
      ['Водоканал Санкт-Петербурга', 'Один из крупнейших водоканалов страны; просветительские проекты и музей «Вселенная воды».', 'https://www.vodokanal.spb.ru/'],
      ['Мосводоканал', 'Водоканал Москвы; открытые данные о качестве воды и работе очистных сооружений.', 'https://www.mosvodokanal.ru/']] },
    { g: 'Международные', list: [
      ['IWA — International Water Association', 'Крупнейшее международное профессиональное сообщество специалистов по воде: конференции, специализированные группы, IWA Publishing.', 'https://iwa-network.org/'],
      ['WEF — Water Environment Federation', 'Сообщество специалистов по сточным водам (США): стандарты практики, выставка WEFTEC.', 'https://www.wef.org/'],
      ['AWWA — American Water Works Association', 'Ассоциация по питьевому водоснабжению: стандарты и обучение.', 'https://www.awwa.org/'],
      ['EWA — European Water Association', 'Европейская ассоциация по управлению водными ресурсами и очистке сточных вод.', 'https://www.ewa-online.eu/'],
      ['DWA', 'Немецкая ассоциация водного хозяйства, сточных вод и отходов; известна стандартами расчёта сооружений (ATV-DWA).', 'https://de.dwa.de/'],
      ['UN-Water', 'Координационный механизм ООН по водным вопросам и цели устойчивого развития 6.', 'https://www.unwater.org/'],
      ['SSWM', 'Открытый набор материалов по устойчивой санитарии и водному хозяйству.', 'https://sswm.info/']] }
  ];

  /* ---------- модуль «Сети водоснабжения»: расчёт кольцевой сети ---------- */
  // статьи — content/kb/network/<id>.md; src: [документ (id в docs.js) или null, название, где, ссылка]; need — что ещё не подтверждено источником
  const NETWORK = CT.network || [];
  root.SeshatKB = { UNITS_KB, PROCESSES, INDICATORS, UNIT_PROC, AUX, BIB, MODULE_BOOKS, FUNDAMENTALS, HUMANITIES, NETWORK, DRINKING, JOURNALS, COMMUNITIES };
  if (typeof module !== 'undefined') module.exports = root.SeshatKB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
