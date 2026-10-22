// Условные обозначения технологий в стиле принципиальных технологических схем.
// Линейная графика: контур — currentColor, вода — полупрозрачная заливка. Поле 64 × 48,
// вход потока слева и выход справа на уровне y = 24, чтобы значки стыковались в схему.
(function (root) {
  const W = 'fill="currentColor" fill-opacity=".13" stroke="none"';   // вода
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const T = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor" stroke="none"';
  const bubbles = pts => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r || 1.6}" ${T}/>`).join('');
  const mixer = (x, y) => `<path d="M${x} 10V${y}" ${T}/><path d="M${x - 5} ${y - 2}l10 4M${x - 5} ${y + 2}l10-4" ${S}/>`;

  const ICONS = {
    // Решётка: канал с наклонными стержнями, отбросы снимаются вверх
    screens: `<rect x="8" y="16" width="48" height="22" ${W}/><path d="M8 16h48M8 38h48" ${S}/>
      <path d="M22 40L34 8M27 40L39 8M32 40L44 8" ${S}/><path d="M40 8h10l-3 -3" ${T}/>`,

    // Аэрируемая песколовка: лоток с бункером и подачей воздуха вдоль стенки
    sand: `<path d="M8 12v18l14 10h20l14-10V12" ${S}/><path d="M8 18h48v12l-14 10H22L8 30z" ${W}/>
      <path d="M12 34h10" ${T}/>${bubbles([[14, 29], [17, 24, 1.4], [13, 21, 1.2]])}
      <path d="M26 38l4-4 4 4z" ${F}/>`,

    // Жироуловитель: перегородка и всплывший слой
    grease: `<path d="M8 12v28h48V12" ${S}/><path d="M8 20h48v20H8z" ${W}/>
      <path d="M36 8v24" ${S}/><path d="M38 20h18" ${S}/><path d="M38 17h18" ${T} stroke-dasharray="2 2"/>
      <path d="M38 14c3-2 5 2 8 0s5 2 8 0" ${T}/>`,

    // Отстойник: резервуар с коническим днищем и центральной трубой
    primary: `<path d="M6 12v16l26 14 26-14V12" ${S}/><path d="M6 17h52v11L32 42 6 28z" ${W}/>
      <path d="M28 10v16h8V10" ${S}/><path d="M32 42v4" ${S}/><path d="M12 31l20 9 20-9" ${T} stroke-dasharray="2 2.5"/>`,

    // Напорная флотация: пузырьки поднимают загрязнения в пенный слой, скребок
    daf: `<path d="M8 12v28h48V12" ${S}/><path d="M8 20h48v20H8z" ${W}/>
      <path d="M8 20h48" ${S}/><path d="M10 17h44" ${T} stroke-dasharray="3 2"/>
      ${bubbles([[18, 34, 1.3], [22, 29, 1.3], [26, 35, 1.3], [30, 27, 1.3], [34, 33, 1.3], [38, 28, 1.3], [42, 34, 1.3], [46, 29, 1.3]])}
      <path d="M14 8h36" ${T}/><path d="M18 8v6M28 8v6M38 8v6" ${T}/><path d="M50 8l-3-2.5M50 8l-3 2.5" ${T}/>`,

    // Аэротенк: прямоугольный резервуар, аэраторы по дну
    at: `<path d="M6 12v28h52V12" ${S}/><path d="M6 18h52v22H6z" ${W}/>
      <path d="M10 36h44" ${S}/>
      ${bubbles([[14, 31], [20, 26], [26, 31], [32, 25], [38, 31], [44, 26], [50, 31], [17, 21, 1.2], [35, 20, 1.2], [47, 21, 1.2]])}`,

    // Нитри-денитрификация: аноксидная зона с мешалкой, аэробная с аэрацией, рецикл
    mle: `<path d="M6 14v26h52V14" ${S}/><path d="M6 20h52v20H6z" ${W}/><path d="M26 14v26" ${S}/>
      ${mixer(16, 30)}<path d="M30 36h24" ${S}/>${bubbles([[34, 31], [40, 26], [46, 31], [52, 26], [37, 22, 1.2], [49, 22, 1.2]])}
      <path d="M50 14V6H14v6" ${T}/><path d="M11 9l3 3 3-3" ${T}/>`,

    // A²/O: анаэробная, аноксидная и аэробная зоны, рецикл
    a2o: `<path d="M4 14v26h56V14" ${S}/><path d="M4 20h56v20H4z" ${W}/><path d="M20 14v26M36 14v26" ${S}/>
      ${mixer(12, 30)}${mixer(28, 30)}<path d="M39 36h18" ${S}/>${bubbles([[42, 31], [48, 26], [54, 31], [45, 22, 1.2], [51, 21, 1.2]])}
      <path d="M54 14V6H28v6" ${T}/><path d="M25 9l3 3 3-3" ${T}/>`,

    // SBR: один резервуар, циклический режим, плавающий декантер
    sbr: `<path d="M10 10v30h44V10" ${S}/><path d="M10 18h44v22H10z" ${W}/>
      <path d="M14 36h20" ${S}/>${bubbles([[17, 31], [23, 27], [29, 31]])}
      <path d="M44 32a6 6 0 1 1 6-6" ${T}/><path d="M50 22v4h-4" ${T}/>
      <path d="M40 18h10v-4" ${S}/>`,

    // МББР: аэрируемый резервуар с плавающими элементами загрузки
    mbbr: `<path d="M6 12v28h52V12" ${S}/><path d="M6 18h52v22H6z" ${W}/><path d="M10 36h44" ${S}/>
      ${[[14, 24], [24, 29], [34, 22], [44, 28], [52, 22], [19, 31], [40, 33]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" ${T}/><path d="M${x - 3} ${y}h6M${x} ${y - 3}v6" ${T}/>`).join('')}
      ${bubbles([[29, 32, 1.2], [48, 33, 1.2]])}`,

    // МБР: аэрируемый резервуар с погружным мембранным модулем и отводом фильтрата
    mbr: `<path d="M6 12v28h44V12" ${S}/><path d="M6 18h44v22H6z" ${W}/>
      ${bubbles([[12, 32], [16, 26], [12, 22, 1.2]])}
      <rect x="22" y="20" width="20" height="14" ${S}/><path d="M26 20v14M30 20v14M34 20v14M38 20v14" ${T}/>
      <path d="M22 38h20" ${S}/><path d="M32 20v-8h18" ${T}/><circle cx="54" cy="12" r="4" ${S}/><path d="M52 10l4 2-4 2" ${T}/>`,

    // Реагентная дефосфатация: расходный бак реагента, насос-дозатор, ввод в поток
    chemP: `<path d="M8 6h16v20H8z" ${S}/><path d="M8 13h16v13H8z" ${W}/>
      <path d="M16 26v6h8" ${T}/><circle cx="28" cy="32" r="4" ${S}/><path d="M26 30l4 2-4 2" ${T}/>
      <path d="M32 32h10v6" ${T}/><path d="M39 35l3 3 3-3" ${T}/>
      <path d="M4 40h56" ${S}/><path d="M54 37l4 3-4 3" ${S}/><text x="16" y="21" font-size="7" text-anchor="middle" fill="currentColor" font-family="sans-serif">Me</text>`,

    // Денитрифицирующий фильтр: зернистая загрузка и дозирование источника углерода
    // Биофильтр доочистки: ёмкость с загрузкой и аэрацией, буква N — нитрификация
    nitf: `<path d="M14 8h32v34H14z" ${S}/><path d="M14 14h32v28H14z" ${W}/>
      <path d="M14 20h32M14 36h32" ${T}/>
      ${[[18, 24], [24, 27], [30, 23], [36, 28], [42, 24], [21, 31], [33, 32], [39, 31], [27, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" ${F}/>`).join('')}
      ${bubbles([[20, 39, 1.1], [30, 39.5, 1.1], [40, 39, 1.1]])}
      <text x="54" y="16" font-size="8" font-weight="700" text-anchor="middle" fill="currentColor" font-family="sans-serif">N</text><path d="M4 24h10M46 24h14" ${T}/>`,
    denf: `<path d="M14 8h30v34H14z" ${S}/><path d="M14 14h30v28H14z" ${W}/>
      <path d="M14 22h30M14 36h30" ${T}/>
      ${[[18, 26], [24, 29], [30, 25], [36, 30], [40, 26], [21, 33], [33, 33], [27, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" ${F}/>`).join('')}
      <path d="M54 6c0 0-5 6-5 9a5 5 0 0 0 10 0c0-3-5-9-5-9z" ${T}/><path d="M54 20v-1M54 22v6H44" ${T}/>
      <text x="54" y="16" font-size="5.5" text-anchor="middle" fill="currentColor" font-family="sans-serif">C</text>`,

    // Фильтр: корпус, слой зернистой загрузки, дренаж
    filter: `<path d="M12 8h40v34H12z" ${S}/><path d="M12 14h40v28H12z" ${W}/>
      <path d="M12 22h40M12 34h40" ${T}/>
      ${[[17, 26], [23, 30], [29, 26], [35, 30], [41, 26], [47, 30], [20, 31], [32, 32], [44, 32], [26, 28], [38, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" ${F}/>`).join('')}
      <path d="M16 38h32" ${S} stroke-dasharray="1 3"/>`,

    // Угольный адсорбер: колонна с плотной загрузкой
    gac: `<path d="M20 12a12 6 0 0 1 24 0v24a12 6 0 0 1-24 0z" ${S}/><path d="M20 16h24v20a12 6 0 0 1-24 0z" ${W}/>
      ${[[25, 20], [30, 22], [35, 20], [40, 22], [27, 26], [32, 28], [38, 26], [24, 31], [30, 33], [36, 32], [41, 30], [28, 37], [35, 37]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" ${F}/>`).join('')}`,

    // Озонирование: генератор озона и контактный резервуар с диспергированием
    ozone: `<rect x="4" y="6" width="18" height="12" rx="1" ${S}/><text x="13" y="15.5" font-size="7.5" text-anchor="middle" fill="currentColor" font-family="sans-serif">O₃</text>
      <path d="M13 18v20h14" ${T}/><path d="M24 12v28h34V12" ${S}/><path d="M24 18h34v22H24z" ${W}/>
      <path d="M28 38h26" ${S}/>${bubbles([[32, 32], [38, 27], [44, 32], [50, 27], [41, 21, 1.2]])}`,

    // Обратный осмос: корпус мембраны с диагональю, пермеат и концентрат
    ro: `<path d="M4 24h8" ${S}/><path d="M9 21l3 3-3 3" ${S}/><rect x="12" y="12" width="36" height="24" ${S}/>
      <path d="M12 36L48 12" ${S}/><path d="M48 18h10" ${T}/><path d="M55 15l3 3-3 3" ${T}/>
      <path d="M48 32h10" ${T} stroke-dasharray="3 2"/><path d="M55 29l3 3-3 3" ${T}/>`,

    // УФ-обеззараживание: канал с лампами и излучением
    uv: `<path d="M6 14h52M6 38h52" ${S}/><path d="M6 14h52v24H6z" ${W}/>
      ${[18, 32, 46].map(x => `<rect x="${x - 2.5}" y="10" width="5" height="24" rx="2.5" ${S}/><path d="M${x - 7} 22h-3M${x + 7} 22h3M${x - 6} 16l-2-2M${x + 6} 16l2-2M${x - 6} 28l-2 2M${x + 6} 28l2 2" ${T}/>`).join('')}`,

    // ---- расширенный каталог ----
    // Грубые решётки: редкие толстые стержни
    coarse: `<rect x="8" y="16" width="48" height="22" ${W}/><path d="M8 16h48M8 38h48" ${S}/>
      <path d="M22 40L30 8M34 40L42 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`,

    // Барабанное сито: вращающийся сетчатый барабан
    drum: `<path d="M4 24h12" ${S}/><circle cx="30" cy="24" r="13" ${W}/><circle cx="30" cy="24" r="13" ${S}/>
      <path d="M17 24h26M30 11v26M21 15l18 18M39 15L21 33" ${T} stroke-dasharray="1.6 2.2"/>
      <path d="M45 10a18 18 0 0 1 3.5 7" ${T}/><path d="M49.5 13.5l-1 3.6-3.4-1.6" ${T}/>
      <path d="M43 36h15" ${S}/><path d="M55 33l3 3-3 3" ${S}/>`,

    // Тангенциальная песколовка: круглая камера с вихрем и бункером
    sandv: `<circle cx="32" cy="20" r="14" ${W}/><circle cx="32" cy="20" r="14" ${S}/>
      <path d="M24 20a8 8 0 1 1 8 8" ${T}/><path d="M29.5 25.5l2.5 2.5-2.5 2.5" ${T}/>
      <path d="M25 32l7 10 7-10" ${S}/><path d="M29 44h6" ${S}/>`,

    // Усреднитель: большой резервуар с переменным уровнем и мешалкой
    equal: `<path d="M8 8v32h48V8" ${S}/><path d="M8 18c5-4 10 4 16 0s11 4 16 0 11 4 16 0V40H8z" ${W}/>
      <path d="M8 18c5-4 10 4 16 0s11 4 16 0 11 4 16 0" ${T}/><path d="M8 13h48" ${T} stroke-dasharray="2 3"/>${mixer(32, 31)}`,

    // Тонкослойный отстойник: наклонные пластины над конусом
    lamella: `<path d="M8 10v22l24 12 24-12V10" ${S}/><path d="M8 16h48v16L32 44 8 32z" ${W}/>
      <path d="M16 32L26 16M23 35L33 16M30 38L40 16M37 35L47 16" ${T}/>`,

    // Коагуляция и флокуляция: смеситель, камера хлопьеобразования, осветлитель
    coag: `<path d="M4 14v26h56V14" ${S}/><path d="M4 20h56v20H4z" ${W}/><path d="M16 14v26M32 14v26" ${S}/>
      ${mixer(10, 30)}<path d="M24 12v20" ${T}/><rect x="20.5" y="27" width="7" height="6" ${T}/>
      ${[[36, 25], [41, 29], [47, 24], [52, 30], [56, 25], [44, 34], [38, 33]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" ${F}/>`).join('')}
      <path d="M10 2v6" ${T}/><path d="M7 2h6" ${T}/>`,

    // Нейтрализация: резервуар с мешалкой и датчиком pH
    neutral: `<path d="M8 12v28h44V12" ${S}/><path d="M8 20h44v20H8z" ${W}/>${mixer(22, 32)}
      <path d="M38 4v26" ${S}/><circle cx="38" cy="32" r="2.6" ${S}/>
      <text x="42" y="9" font-size="8" fill="currentColor" font-family="sans-serif">pH</text>`,

    // Аммиачная отдувка: колонна с насадкой, воздух снизу, аммиак сверху
    strip: `<rect x="22" y="8" width="20" height="36" rx="2" ${S}/><rect x="22" y="16" width="20" height="18" ${W}/>
      <path d="M22 16h20M22 34h20" ${T}/><path d="M24 21l3.6 3.6 3.6-3.6 3.6 3.6 3.6-3.6M24 28l3.6 3.6 3.6-3.6 3.6 3.6 3.6-3.6" ${T}/>
      <path d="M6 40h16" ${T}/><path d="M18 37l4 3-4 3" ${T}/><path d="M32 8V4h12" ${T}/><path d="M41 1l3 3-3 3" ${T}/>
      <text x="47" y="7" font-size="6.5" fill="currentColor" font-family="sans-serif">NH₃</text>`,

    // Окислительный канал: кольцевой канал с островом и аэратором
    oxid: `<rect x="6" y="10" width="52" height="28" rx="14" ${W}/><rect x="6" y="10" width="52" height="28" rx="14" ${S}/>
      <rect x="19" y="20" width="26" height="8" rx="4" ${S}/><path d="M30 10v10" ${S}/>
      <path d="M26 12v6M34 12v6" ${T}/><path d="M44 33h-8" ${T}/><path d="M39 30.5l-3 2.5 3 2.5" ${T}/>
      <path d="M20 15h8" ${T}/><path d="M25 12.5l3 2.5-3 2.5" ${T}/>`,

    // Bardenpho: пять зон — анаэробная, аноксидная, аэробная, аноксидная, аэробная
    bardenpho: `<path d="M2 16v24h60V16" ${S}/><path d="M2 22h60v18H2z" ${W}/><path d="M12 16v24M24 16v24M40 16v24M50 16v24" ${S}/>
      ${[7, 18, 45].map(x => `<path d="M${x} 12V${31}" ${T}/><path d="M${x - 3.5} 29.5l7 3M${x - 3.5} 32.5l7-3" ${S}/>`).join('')}
      ${bubbles([[28, 31, 1.3], [33, 26, 1.3], [37, 32, 1.3], [53, 31, 1.3], [58, 26, 1.3]])}
      <path d="M33 16V8H18v6" ${T}/><path d="M15 11l3 3 3-3" ${T}/>`,

    // IFAS: аэротенк с носителями и хлопьями ила
    ifas: `<path d="M6 12v28h52V12" ${S}/><path d="M6 18h52v22H6z" ${W}/><path d="M10 36h44" ${S}/>
      ${[[16, 24], [30, 28], [44, 23], [52, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" ${T}/><path d="M${x - 3} ${y}h6M${x} ${y - 3}v6" ${T}/>`).join('')}
      ${[[22, 30], [24, 22], [37, 22], [38, 32], [47, 33], [12, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" ${F}/>`).join('')}`,

    // Аэробный гранулированный ил: реактор с плотными гранулами
    ags: `<path d="M10 8v32h44V8" ${S}/><path d="M10 16h44v24H10z" ${W}/>
      ${[[18, 34, 2.6], [26, 31, 2], [34, 35, 2.8], [42, 30, 2.2], [48, 35, 2.4], [22, 25, 1.8], [38, 24, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${F}/>`).join('')}
      ${bubbles([[30, 22, 1.2], [46, 22, 1.2]])}<path d="M40 16h10v-5" ${S}/>`,

    // Капельный биофильтр: загрузка из щебня, сверху вращающийся ороситель
    tf: `<path d="M10 18v24h44V18" ${S}/>
      ${[16, 24, 32, 40, 48].flatMap(x => [24, 31, 38].map(y => `<circle cx="${x + (y === 31 ? 4 : 0)}" cy="${y}" r="3" ${T}/>`)).join('')}
      <path d="M12 11h40" ${S}/><path d="M32 11V5" ${S}/><path d="M17 13.5v2.5M25 13.5v2.5M39 13.5v2.5M47 13.5v2.5" ${T}/>`,

    // BAF: затопленная загрузка с аэрацией снизу
    baf: `<rect x="16" y="6" width="32" height="36" ${S}/><rect x="16" y="12" width="32" height="30" ${W}/>
      <path d="M16 18h32M16 34h32" ${T}/>
      ${[[20, 22], [26, 25], [32, 21], [38, 26], [44, 22], [23, 29], [35, 30], [41, 31], [29, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" ${F}/>`).join('')}
      ${bubbles([[22, 38, 1.2], [32, 39, 1.2], [42, 38, 1.2]])}<path d="M4 40h12" ${T}/><path d="M12 37l4 3-4 3" ${T}/>`,

    // UASB: восходящий поток через слой ила, трёхфазный сепаратор, биогаз
    uasb: `<path d="M16 8v34h32V8" ${S}/><path d="M16 14h32v28H16z" ${W}/>
      <path d="M19 24l6-6 6 6M33 24l6-6 6 6" ${S}/>
      ${[[20, 38], [24, 36], [28, 39], [32, 36], [36, 38], [40, 36], [44, 39], [22, 33], [34, 33], [42, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" ${F}/>`).join('')}
      <path d="M32 8V3" ${T}/><path d="M29 5l3-3 3 3" ${T}/><text x="37" y="7" font-size="6.5" fill="currentColor" font-family="sans-serif">CH₄</text>`,

    // Анаммокс: реактор с носителями, азот уходит газом
    anammox: `<path d="M10 14v28h44V14" ${S}/><path d="M10 20h44v22H10z" ${W}/>
      ${[[20, 30], [32, 34], [44, 29]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" ${T}/><path d="M${x - 3.2} ${y}h6.4M${x} ${y - 3.2}v6.4" ${T}/>`).join('')}
      <path d="M44 14V6" ${T}/><path d="M41 8.5l3-3 3 3" ${T}/><text x="26" y="10" font-size="7.5" fill="currentColor" font-family="sans-serif">N₂</text>`,

    // Биоплато: тростник на фильтрующей загрузке, поток под поверхностью
    wetland: `<path d="M4 32h56v10H4z" ${W}/><path d="M4 32h56" ${S}/><path d="M8 37h48" ${T} stroke-dasharray="3 2"/><path d="M52 34.5l4 2.5-4 2.5" ${T}/>
      <path d="M12 32V18M18 32V12M24 32V20M36 32V14M42 32V10M48 32V18M30 32V22" ${T}/>
      ${[[18, 11], [36, 13], [42, 9], [12, 17]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="3.4" ${F}/>`).join('')}`,

    // Дисковый фильтр: вращающиеся диски с тканью
    disc: `<path d="M8 14v26h48V14" ${S}/><path d="M8 20h48v20H8z" ${W}/><path d="M10 27h44" ${S}/>
      ${[18, 27, 36, 45].map(x => `<ellipse cx="${x}" cy="27" rx="3" ry="11" ${T}/>`).join('')}`,

    // Ультрафильтрация: модуль с полыми волокнами, пермеат и концентрат
    uf: `<path d="M2 24h12" ${S}/><path d="M10 21l3 3-3 3" ${S}/><rect x="14" y="8" width="36" height="32" rx="4" ${S}/>
      <path d="M20 13v22M24 13v22M28 13v22M32 13v22M36 13v22M40 13v22M44 13v22" ${T}/>
      <path d="M50 16h10" ${T}/><path d="M57 13l3 3-3 3" ${T}/><path d="M50 34h10" ${T} stroke-dasharray="3 2"/><path d="M57 31l3 3-3 3" ${T}/>`,

    // Усовершенствованное окисление: УФ-лампа, пероксид водорода, радикалы
    aop: `<path d="M8 14v26h48V14" ${S}/><path d="M8 20h48v20H8z" ${W}/>
      <rect x="14" y="26" width="22" height="6" rx="3" ${S}/><path d="M18 23l-2-3M25 23v-3M32 23l2-3M18 35l-2 3M25 35v3M32 35l2 3" ${T}/>
      <text x="40" y="33" font-size="8" fill="currentColor" font-family="sans-serif">•OH</text>
      <path d="M46 4v12" ${T}/><text x="27" y="8" font-size="6" fill="currentColor" font-family="sans-serif">H₂O₂</text>`,

    // Ионный обмен: колонна со смолой
    ix: `<rect x="20" y="6" width="24" height="36" rx="5" ${S}/><rect x="20" y="12" width="24" height="26" ${W}/>
      ${[[25, 17], [31, 18], [37, 17], [28, 23], [34, 23], [40, 24], [25, 29], [31, 29], [37, 30], [28, 34], [34, 35]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" ${T}/>`).join('')}
      <text x="8" y="22" font-size="9" fill="currentColor" font-family="sans-serif">+</text><text x="49" y="22" font-size="9" fill="currentColor" font-family="sans-serif">−</text>`,

    // Хлорирование: контактный резервуар с перегородками и дозированием гипохлорита
    hypo: `<path d="M6 14v26h52V14" ${S}/><path d="M6 20h52v20H6z" ${W}/><path d="M18 14v18M30 22v18M42 14v18" ${S}/>
      <path d="M12 4v12" ${T}/><path d="M9 4h6" ${T}/><text x="17" y="10" font-size="7.5" fill="currentColor" font-family="sans-serif">Cl</text>
      <path d="M48 30h6" ${T}/><path d="M52 27.5l2.5 2.5-2.5 2.5" ${T}/>`
  };

  /** SVG-разметка значка. size — ширина в px (высота пропорциональна). */
  function icon(id, size, title) {
    const body = ICONS[id] || '';
    const w = size || 48, h = Math.round(w * 0.75);
    return `<svg class="ico" viewBox="0 0 64 48" width="${w}" height="${h}" ${title ? `role="img" aria-label="${title.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"'}>${title ? `<title>${title.replace(/</g, '&lt;')}</title>` : ''}${body}</svg>`;
  }

  root.SeshatIcons = { icon, ICONS };
  if (typeof module !== 'undefined') module.exports = root.SeshatIcons;
})(typeof globalThis !== 'undefined' ? globalThis : this);
