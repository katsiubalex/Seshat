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
      ${[18, 32, 46].map(x => `<rect x="${x - 2.5}" y="10" width="5" height="24" rx="2.5" ${S}/><path d="M${x - 7} 22h-3M${x + 7} 22h3M${x - 6} 16l-2-2M${x + 6} 16l2-2M${x - 6} 28l-2 2M${x + 6} 28l2 2" ${T}/>`).join('')}`
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
