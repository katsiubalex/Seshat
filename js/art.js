// Рисунки экосистемы: символы божеств, иллюстрации к главам историй и эскизы будущих конструкторов модулей.
// Всё — линейная графика SVG цветом текста: s — линия, f — мягкая заливка, d — сплошная заливка, w — вода.
(function (root) {
  /* ---------- маленькие помощники ---------- */
  const wave = (x, y, w, a = 3, n = 4, cls = 'w') => { let d = `M${x} ${y}`; const s = w / n; for (let i = 0; i < n; i++) d += `q${s / 4} ${-a} ${s / 2} 0t${s / 2} 0`; return `<path class="${cls}" d="${d}"/>`; };
  const rain = (x, y, n, gap = 8, len = 7) => Array.from({ length: n }, (_, i) => `<path class="w" d="M${x + i * gap} ${y}l-2 ${len}"/>`).join('');
  const drop = (x, y, r, cls = 'w') => `<path class="${cls}" d="M${x} ${y - r * 1.6}C${x + r} ${y - r * 0.4} ${x + r} ${y + r} ${x} ${y + r}S${x - r} ${y - r * 0.4} ${x} ${y - r * 1.6}Z"/>`;
  const fish = (x, y, s = 1) => `<path class="s" d="M${x} ${y}c${4 * s} ${-3 * s} ${9 * s} ${-3 * s} ${12 * s} 0c${-3 * s} ${3 * s} ${-8 * s} ${3 * s} ${-12 * s} 0zM${x + 12 * s} ${y}l${4 * s} ${-3 * s}v${6 * s}z"/>`;
  const person = (x, y, h = 30, cls = 's') => `<circle class="${cls}" cx="${x}" cy="${y - h + 4}" r="4"/><path class="${cls}" d="M${x} ${y - h + 8}v${h * 0.45}M${x - 7} ${y - h * 0.55}h14M${x} ${y - h * 0.35}l-6 ${h * 0.35}M${x} ${y - h * 0.35}l6 ${h * 0.35}"/>`;
  const star = (x, y, r, n = 8) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1); } return `<path class="s f2" d="${d}Z"/>`; };
  const house = (x, y, s = 1) => `<path class="s" d="M${x} ${y}v${-10 * s}l${7 * s} ${-7 * s}l${7 * s} ${7 * s}v${10 * s}z"/>`;
  const svg = (inner, vb = '0 0 160 100', cls = 'art') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

  /* ---------- символы божеств ---------- */
  const SYMBOL = {
    // украшение-полумесяц в носу (якаметцтли) и веретено с хлопком
    tlazolteotl: '<path class="s f" d="M14 26c4 14 16 20 30 14c-12 2-22-4-26-14z"/><path class="s" d="M44 8v40M38 14c3 2 9 2 12 0M38 20c3 2 9 2 12 0"/><circle class="s f" cx="44" cy="52" r="6"/><path class="s" d="M44 46v12"/>',
    // маска Тлалока: глаза в кольцах, губа-усы, клыки
    tlaloc: '<circle class="s" cx="21" cy="24" r="9"/><circle class="s" cx="43" cy="24" r="9"/><circle class="d" cx="21" cy="24" r="3"/><circle class="d" cx="43" cy="24" r="3"/><path class="s f" d="M14 40c6-5 12-5 18-1c6-4 12-4 18 1c-6 5-30 5-36 0z"/><path class="s" d="M24 43v10M32 44v12M40 43v10"/>',
    // связанные лотос и папирус — знак единства двух земель
    hapi: '<path class="s" d="M32 60V22"/><path class="s f" d="M32 22c-10-2-16-10-16-16c6 4 12 4 16 10c4-6 10-6 16-10c0 6-6 14-16 16z"/><path class="s" d="M32 44c-8-6-14-16-20-18M32 44c8-6 14-16 20-18"/><path class="s f" d="M8 22l4 4l4-6zM56 22l-4 4l-4-6z"/><path class="s" d="M24 46h16M24 50h16"/>',
    // бронзовый треножник дин
    yu: '<path class="s f" d="M12 22h40v6c0 12-8 18-20 18s-20-6-20-18z"/><path class="s" d="M18 22v-8h6v8M40 22v-8h6v8M20 44l-4 14M32 46v12M44 44l4 14M18 32h28"/>',
    // два потока с рыбами из плеч
    enki: '<circle class="s f" cx="32" cy="12" r="6"/><path class="s" d="M24 22h16"/><path class="w" d="M24 22c-6 8-10 18-16 34M40 22c6 8 10 18 16 34"/><path class="w" d="M28 22c-4 10-6 22-12 34M36 22c4 10 6 22 12 34"/>' + fish(4, 40, 0.7) + fish(48, 46, 0.7),
    // восьмилучевая звезда над водой
    anahita: star(32, 26, 18) + '<circle class="d" cx="32" cy="26" r="3"/>' + wave(8, 54, 48, 3, 4) + wave(14, 60, 36, 2, 3),
    // бассейн источника и бьющая струя
    juturna: '<path class="s f" d="M8 46h48v8H8z"/><path class="s" d="M14 46v-4h36v4"/><path class="w" d="M32 42V14M32 14c-6 4-10 12-12 20M32 14c6 4 10 12 12 20"/>' + drop(32, 10, 3),
    // круглое святилище над Клоакой, как на римской монете
    cloacina: '<path class="s f" d="M10 26h44v4H10z"/><path class="s" d="M12 30v16M22 30v16M32 30v16M42 30v16M52 30v16M8 46h48v4H8z"/><path class="s" d="M12 26c4-10 36-10 40 0"/><path class="w" d="M6 56c8-3 12 3 20 0s12-3 20 0s8 3 12 0"/>'
  };

  /* ---------- иллюстрации к главам ---------- */
  const LORE = {
    tlazolteotl: [
      // Имя: два знака — «тласолли» (куча мусора) и «теотль» (божество)
      '<rect class="s" x="22" y="22" width="50" height="50" rx="6"/><path class="s f" d="M30 62c4-14 10-20 17-20s13 6 17 20z"/><circle class="d" cx="38" cy="54" r="1.6"/><circle class="d" cx="50" cy="50" r="1.6"/><circle class="d" cx="56" cy="58" r="1.6"/><rect class="s" x="88" y="22" width="50" height="50" rx="6"/><path class="s" d="M113 47m-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0M113 47m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0"/><path class="s" d="M113 29v-4M113 69v-4M95 47h-4M135 47h-4"/><path class="s" d="M76 47h8"/>',
      // Исповедь: кающийся перед богиней, его слова уходят к ней
      person(42, 86, 34) + '<path class="s f" d="M100 86V54c0-10 22-10 22 0v32z"/><circle class="s" cx="111" cy="42" r="7"/><path class="d" d="M106 45h10v3h-10z"/><path class="s" d="M54 52c6-6 12 0 18-6s12 0 18-6M58 60c6-4 12 0 18-4"/>',
      // Четыре сестры в конических колпаках
      [28, 62, 96, 130].map((x, i) => `<path class="s f" d="M${x - 8} ${44 + (i % 2) * 2}l8-18l8 18z"/>` + person(x, 88 + (i % 2) * 2, 40)).join(''),
      // Облик: профиль с чёрным ртом, полумесяцем в носу и веретёнами в волосах
      '<path class="s" d="M60 86c-14-6-18-22-14-38c4-16 18-24 34-22c14 2 22 12 22 24c4 2 6 6 4 10l-6 2v8c0 6-6 10-14 10h-6"/><path class="d" d="M88 62c6 0 10 2 14 0v10c-6 4-12 4-16 0z"/><path class="s f" d="M104 54c4 6 2 10-4 10c4-2 6-6 4-10z"/><circle class="d" cx="88" cy="44" r="2.5"/><path class="s" d="M64 26l-8-20M74 24l2-20M84 26l10-18"/><circle class="s f" cx="56" cy="6" r="4"/><circle class="s f" cx="76" cy="4" r="4"/><circle class="s f" cx="94" cy="8" r="4"/>',
      // Пар: баня темаскаль с низким входом
      '<path class="s f" d="M34 86c0-30 18-48 46-48s46 18 46 48z"/><path class="d" d="M70 86v-12c0-8 20-8 20 0v12z"/><path class="s" d="M20 86h120"/><path class="w" d="M60 30c-4-6 4-8 0-14M80 26c-4-6 4-8 0-14M100 30c-4-6 4-8 0-14"/>',
      // Время: метла выметания и тринадцать дней
      '<path class="s" d="M40 16l40 44"/><path class="s f" d="M76 56l14 16l-8 6l-16-14z"/><path class="s" d="M80 74l-6 8M86 70l2 12M90 66l8 6"/>' + Array.from({ length: 13 }, (_, i) => `<circle class="${i === 0 ? 'd' : 's'}" cx="${18 + i * 10}" cy="92" r="3"/>`).join(''),
      // Происхождение: побережье залива и початок кукурузы
      wave(10, 74, 80, 4, 5) + wave(10, 84, 80, 4, 5) + '<path class="s" d="M90 86c10-6 20-6 60 0"/><path class="s f" d="M118 70c-8-12-8-34 0-46c8 12 8 34 0 46z"/><path class="s" d="M112 40h12M111 48h14M112 56h12M118 70c-10 4-16 10-18 16M118 70c10 4 16 10 18 16"/>',
      // Почему этот модуль: мутная капля → отстойник → чистая капля
      drop(26, 54, 14, 's f') + '<circle class="d" cx="22" cy="54" r="1.6"/><circle class="d" cx="30" cy="60" r="1.6"/><circle class="d" cx="27" cy="47" r="1.6"/><path class="s" d="M46 52h14"/><circle class="s" cx="80" cy="52" r="20"/><circle class="s" cx="80" cy="52" r="4"/><path class="s" d="M80 52l16-10"/><path class="s" d="M104 52h14"/>' + drop(136, 54, 14)
    ],
    tlaloc: [
      // Имя: земля, пещера в горе и дождь
      '<path class="s f" d="M10 88l40-56l22 26l18-14l60 44z"/><path class="d" d="M52 88c0-14 16-14 16 0z"/>' + rain(96, 12, 6),
      // Древность: Великий храм с двумя святилищами
      '<path class="s f" d="M30 90l10-22h80l10 22zM44 68l8-18h56l8 18z"/><path class="s" d="M56 50V34h18v16M86 50V34h18v16M56 34l9-8l9 8M86 34h18"/><path class="s" d="M76 90V60h8v30"/>',
      // Облик: маска с глазами в кольцах и клыками
      '<path class="s f" d="M40 16h80v62c0 8-80 8-80 0z"/><circle class="s" cx="62" cy="40" r="11"/><circle class="s" cx="98" cy="40" r="11"/><circle class="d" cx="62" cy="40" r="4"/><circle class="d" cx="98" cy="40" r="4"/><path class="s" d="M56 62c8-6 16-6 24 0c8-6 16-6 24 0"/><path class="s" d="M68 64v12M80 62v14M92 64v12"/>',
      // Тлалоки: четыре кувшина — урожай, гниль, засуха, заморозки
      [26, 62, 98, 134].map((x, i) => `<path class="s f" d="M${x - 12} 50c0 26 24 26 24 0c0-6-4-8-6-12h-12c-2 4-6 6-6 12z"/><path class="s" d="M${x - 6} 38h12"/>` + [
        `<path class="s" d="M${x} 32v-14M${x} 22l-5-4M${x} 26l5-4"/>`,
        `<path class="s" d="M${x - 5} 22c3 6 7 6 10 0"/><circle class="d" cx="${x - 3}" cy="16" r="1.5"/><circle class="d" cx="${x + 4}" cy="18" r="1.5"/>`,
        `<circle class="s" cx="${x}" cy="20" r="5"/><path class="s" d="M${x} 10v3M${x} 27v3M${x - 10} 20h3M${x + 7} 20h3"/>`,
        `<path class="s" d="M${x} 12v16M${x - 7} 16l14 8M${x + 7} 16l-14 8"/>`][i]).join('') + rain(20, 84, 16, 8, 6),
      // Тлалокан: вечная весна — цветы, ростки, дождь и бабочка
      '<path class="s" d="M10 90h140"/>' + [30, 64, 100, 132].map(x => `<path class="s" d="M${x} 90V62"/><circle class="s f" cx="${x}" cy="56" r="6"/><path class="s" d="M${x} 76c-8-2-10-8-10-12M${x} 72c8-2 10-8 10-12"/>`).join('') + '<path class="s f" d="M80 26c-6-8-16-6-14 2c2 6 10 4 14-2c4 6 12 8 14 2c2-8-8-10-14-2z"/>' + rain(20, 10, 4, 10, 6) + rain(110, 10, 4, 10, 6),
      // Почему этот модуль: дождь и гидрограф стока
      '<path class="s" d="M14 88h136M14 88V14"/>' + [22, 32, 42, 52, 62].map((x, i) => `<rect class="s f" x="${x}" y="14" width="7" height="${[8, 18, 26, 14, 6][i]}"/>`).join('') + '<path class="w" d="M14 84c20 0 30-2 40-14s16-40 26-40s18 30 30 42s24 12 40 12"/><path class="s" d="M80 30v58" stroke-dasharray="3 4"/>'
    ],
    hapi: [
      // Разлив: Нил поднимается на поля
      '<path class="s" d="M10 60h40l8 8h44l8-8h40"/>' + wave(56, 66, 48, 2, 3) + wave(10, 50, 140, 3, 8) + '<path class="s" d="M24 60v-14M24 50l-5-4M24 54l5-4M136 60v-14M136 50l-5-4M136 54l5-4"/><path class="s" d="M80 20v20M74 34l6 6l6-6"/>',
      // Облик: полный бог с сосудом, из которого льётся вода
      '<circle class="s f" cx="60" cy="22" r="9"/><path class="s f" d="M48 34h24c6 14 8 30 2 40H46c-6-10-4-26 2-40z"/><path class="s" d="M50 74v16M70 74v16M72 40l20 8"/><path class="s f" d="M92 40h14l-2 16h-10z"/><path class="w" d="M104 56c4 8 6 18 6 32M98 58c2 10 2 20 0 30"/>' + wave(90, 92, 40, 2, 3),
      // Пещера и ниломер: лестница с отметками уровня
      '<path class="s" d="M24 90V20h16v12h14v12h14v12h14v12h14v12h14"/>' + [30, 44, 58, 72].map((y, i) => `<path class="s" d="M118 ${y}h10"/><text class="t" x="132" y="${y + 3}">${16 - i * 2}</text>`).join('') + '<path class="f" d="M24 64h96v26H24z"/>' + wave(24, 64, 96, 2, 6),
      // Две земли: лотос и папирус, связанные вокруг знака единства
      '<path class="s f" d="M74 90V40c0-8 12-8 12 0v50z"/><path class="s" d="M80 40V14"/><path class="s" d="M80 40c-20-4-34-16-44-28M80 40c20-4 34-16 44-28"/><path class="s f" d="M28 8c4 2 8 6 8 10c-6 0-10-4-8-10zM44 10c-2 4-6 8-10 8c0-6 4-10 10-8z"/><path class="s f" d="M118 6l14 4l-10 10z"/><path class="s" d="M66 60h28M66 66h28"/>',
      // Почему этот модуль: водомерный пост и делёж воды между пользователями
      wave(10, 80, 60, 3, 4) + '<path class="s" d="M30 90V24M30 30h8M30 44h8M30 58h8M30 72h8"/>' + [92, 112, 132].map((x, i) => `<rect class="s f" x="${x}" y="${90 - [40, 26, 18][i]}" width="14" height="${[40, 26, 18][i]}"/>`).join('') + '<path class="s" d="M84 90h66"/>' + house(93, 40, 0.8) + '<path class="s" d="M114 52c2-6 8-8 10-2M134 64l4-8l4 8"/>'
    ],
    yu: [
      // Потоп: прорванная дамба Гуня
      '<path class="s f" d="M20 90l16-40h20l8 40zM96 90l8-40h20l16 40z"/>' + wave(60, 52, 40, 4, 3) + '<path class="w" d="M62 60c6 10 30 10 36 0M64 70c8 10 24 10 32 0M66 80c8 6 20 6 28 0"/>' + wave(10, 40, 140, 3, 8),
      // Путь Ю: русло углублено, вода расходится по каналам к морю
      '<path class="w" d="M10 20c30 10 40 30 60 40s60 20 80 20"/><path class="w" d="M70 60c10-10 20-30 40-40M70 60c0 14 10 24 20 30M110 74c10-14 26-20 40-20"/>' + wave(130, 90, 26, 2, 2) + '<path class="s" d="M24 34l-6 10M40 44l-4 8"/>' + person(30, 92, 26),
      // Девять областей и треножник
      '<path class="s" d="M14 16h60v60H14zM34 16v60M54 16v60M14 36h60M14 56h60"/><path class="s f" d="M96 40h44v6c0 14-10 20-22 20s-22-6-22-20z"/><path class="s" d="M102 40v-8h6v8M128 40v-8h6v8M104 62l-6 22M118 66v20M132 62l6 22"/>',
      // Шаг Ю: ритуальная походка по звёздам
      [[24, 70], [44, 56], [64, 66], [84, 50], [104, 60], [124, 44], [140, 56]].map(([x, y], i) => `<path class="s f" d="M${x} ${y}c-4 0-6-6-4-10s8-4 8 2s0 8-4 8z"/>` + (i ? '' : '')).join('') + '<path class="s" d="M28 30l20-10l20 8l20-12l20 10l20-6" stroke-dasharray="2 5"/>' + [28, 48, 68, 88, 108, 128].map((x, i) => `<circle class="d" cx="${x}" cy="${[30, 20, 28, 16, 26, 20][i]}" r="2.4"/>`).join(''),
      // Почему этот модуль: плотина с водосбросом
      '<path class="s f" d="M60 90V30h18l40 60z"/><path class="f" d="M10 44h50v46H10z"/>' + wave(10, 44, 50, 2, 3) + '<path class="w" d="M78 30c10 0 20 20 30 40s20 20 42 20"/><path class="s" d="M10 90h140"/><path class="s" d="M60 36h-6M60 50h-6M60 64h-6"/>'
    ],
    enki: [
      // Имя: знак «бог» клинописью и клинья
      '<rect class="s f" x="20" y="16" width="120" height="70" rx="10"/>' + star(56, 51, 22, 4) + '<path class="s" d="M56 29v44M34 51h44"/>' + [[96, 34], [112, 34], [96, 54], [112, 54], [124, 44]].map(([x, y]) => `<path class="d" d="M${x} ${y}l10 3l-10 3z"/>`).join(''),
      // Абзу: подземный океан под землёй и потоки с рыбами
      '<path class="s" d="M10 40h140"/><path class="s f" d="M10 40h140v-12c-20-6-40-6-70 0s-50 6-70 0z"/><path class="f" d="M10 58h140v32H10z"/>' + wave(10, 58, 140, 3, 8) + fish(40, 74) + fish(98, 80) + '<path class="w" d="M80 40v18M60 40l-6 18M100 40l6 18"/>' + person(80, 36, 22),
      // Мудрец: глиняные таблички с законами ме
      [[30, 22], [70, 18], [110, 24]].map(([x, y]) => `<rect class="s f" x="${x}" y="${y}" width="30" height="44" rx="5"/>` + [0, 1, 2, 3].map(r => `<path class="d" d="M${x + 6} ${y + 8 + r * 9}l7 2l-7 2zM${x + 16} ${y + 8 + r * 9}l7 2l-7 2z"/>`).join('')).join('') + '<path class="s" d="M20 84h120"/>',
      // Спаситель людей: тростниковый корабль на водах потопа
      rain(20, 8, 15, 9, 8) + '<path class="s f" d="M34 58h92l-10 16H44z"/><path class="s" d="M54 58V40h52v18M66 40v-10h28v10"/>' + wave(10, 80, 140, 3, 8) + wave(10, 90, 140, 3, 8),
      // Почему этот модуль: скважина до водоносного пласта
      '<path class="s" d="M10 28h140"/>' + house(30, 28) + '<path class="f" d="M10 60h140v18H10z"/><path class="s" d="M10 60h140M10 78h140"/><path class="s" d="M100 16v62M108 16v62M96 16h16"/><path class="s" d="M72 60c10 8 18 10 28 10s18-2 28-10" stroke-dasharray="3 3"/>' + wave(14, 69, 60, 2, 4) + '<path class="w" d="M104 22v40"/>'
    ],
    anahita: [
      // Имя: капля чистой воды и звезда
      drop(56, 56, 22) + star(110, 40, 22) + '<path class="s" d="M48 52c2-8 6-12 10-14"/>',
      // Источник всех вод: поток с горы Хара в море
      '<path class="s f" d="M20 70l40-56l40 56z"/><path class="w" d="M60 18c-4 18 4 28 0 52c10 4 30 6 40 20M60 30c8 10 20 16 30 40"/>' + wave(90, 90, 60, 3, 4) + wave(96, 82, 54, 2, 3) + star(130, 22, 8),
      // Облик: колесница — ветер, дождь, облака, мокрый снег
      '<circle class="s" cx="50" cy="66" r="18"/><circle class="s" cx="50" cy="66" r="3"/><path class="s" d="M50 48v36M32 66h36M37 53l26 26M63 53l-26 26"/><path class="s f" d="M40 44h40l-6 14H44z"/><path class="s" d="M80 50h18"/>' + '<path class="s" d="M104 24c10-2 14 4 26 0M104 30c8-2 12 2 22 0"/>' + rain(104, 42, 4, 8, 7) + '<path class="s f" d="M118 64c-8 0-10-10 0-10c2-6 14-6 14 2c6 0 6 8 0 8z"/><path class="s" d="M106 80l4 4M106 84l4-4M118 80l4 4M118 84l4-4M130 80l4 4M130 84l4-4"/>',
      // Очищающая: чаша приношения водам
      '<path class="s f" d="M42 50h76c0 22-16 32-38 32s-38-10-38-32z"/><path class="s" d="M62 82l-6 8h48l-6-8"/>' + wave(48, 54, 64, 2, 4) + '<path class="w" d="M80 14c0 12 0 20 0 30"/>' + drop(80, 12, 4) + '<path class="s" d="M118 30c6-6 14-6 18 0c-6 4-14 4-18 0zM118 30l-8 8"/>',
      // Почему этот модуль: мутная вода → фильтр → чистая
      drop(26, 54, 13, 's f') + '<circle class="d" cx="22" cy="52" r="1.6"/><circle class="d" cx="29" cy="58" r="1.6"/><path class="s" d="M44 52h12"/><rect class="s" x="62" y="24" width="36" height="62" rx="4"/><path class="f" d="M62 54h36v32H62z"/>' + [70, 80, 90].map(x => `<circle class="s" cx="${x}" cy="66" r="2"/><circle class="s" cx="${x - 4}" cy="76" r="2"/>`).join('') + '<path class="s" d="M104 52h12"/>' + drop(134, 54, 13) + star(134, 20, 7)
    ],
    juturna: [
      // Богиня: родник бьёт из камней
      '<path class="s f" d="M20 90c4-20 16-30 30-30s20 10 24 30zM86 90c4-14 14-22 26-22s20 8 26 22z"/><path class="w" d="M74 70c4-20 6-36 6-50M80 20c-8 6-14 18-16 30M80 20c8 6 14 18 16 30"/>' + drop(80, 14, 4) + wave(56, 90, 50, 2, 3),
      // Источник на Форуме: бассейн и кони Диоскуров
      '<path class="s f" d="M30 70h100v16H30z"/><path class="s" d="M36 70v-6h88v6"/>' + wave(38, 76, 84, 2, 5) + '<path class="s f" d="M44 64c-2-12 2-24 12-30l6 4l-2 6l8 4l-2 6c-4 0-8-2-10-4l-2 14zM116 64c2-12-2-24-12-30l-6 4l2 6l-8 4l2 6c4 0 8-2 10-4l2 14z"/><path class="s" d="M66 24h28M70 20v24M90 20v24"/>',
      // Праздник 11 января: фонтан и календарь
      '<path class="s f" d="M34 74h56v12H34z"/><path class="s" d="M40 74v-6h44v6"/><path class="w" d="M62 68V30M62 30c-10 4-16 14-18 24M62 30c10 4 16 14 18 24M62 30c-4 8-6 18-6 26M62 30c4 8 6 18 6 26"/><rect class="s" x="104" y="26" width="38" height="44" rx="4"/><path class="s" d="M104 38h38M114 22v8M132 22v8"/><text class="t big" x="123" y="62" text-anchor="middle">11</text>',
      // Энеида: меч Турна и волны, в которых скрылась Ютурна
      '<path class="s" d="M60 14l40 52M58 24l12-10M96 62l10 10l-4 4l-10-10"/><path class="s f" d="M60 14l6 4l-4 4z"/>' + wave(20, 80, 120, 4, 6) + wave(30, 90, 100, 3, 5) + '<path class="w" d="M40 70c4-4 8-4 10 0"/>',
      // Почему этот модуль: сеть от источника к домам
      '<circle class="s f" cx="22" cy="50" r="10"/><path class="w" d="M22 46v-6"/><path class="s" d="M32 50h30M62 50v-24h40M62 50v24h40M102 26v48M102 26h20M102 74h20M102 50h20"/>' + [[62, 50], [102, 26], [102, 74], [102, 50]].map(([x, y]) => `<circle class="d" cx="${x}" cy="${y}" r="3"/>`).join('') + house(124, 32, 0.9) + house(124, 56, 0.9) + house(124, 80, 0.9)
    ],
    cloacina: [
      // Клоака Максима: сводчатый тоннель коллектора
      '<path class="s" d="M10 30h140"/><path class="s f" d="M40 90V60c0-22 80-22 80 0v30z"/><path class="s" d="M48 90V62c0-16 64-16 64 0v28"/>' + [50, 62, 74, 86, 98, 110].map((x, i) => `<path class="s" d="M${x} ${[60, 49, 45, 45, 49, 60][i]}l${i < 3 ? -4 : 4} -6"/>`).join('') + wave(48, 82, 64, 2, 4) + '<path class="s" d="M24 30v-12h20v12M110 30v-16h26v16"/>',
      // Имя: очищающая — ветвь и чистая вода
      '<path class="s" d="M40 80c20-20 40-40 80-56"/>' + [[56, 64], [72, 52], [88, 42], [104, 32]].map(([x, y]) => `<path class="s f" d="M${x} ${y}c-2-10 6-14 12-12c-2 8-6 12-12 12zM${x} ${y}c10 2 14 10 10 14c-8-2-12-6-10-14z"/>`).join('') + drop(40, 54, 10),
      // Святилище: круглая постройка с балюстрадой, как на монете
      '<circle class="s" cx="80" cy="50" r="42"/><circle class="s" cx="80" cy="50" r="38" stroke-dasharray="2 3"/><path class="s f" d="M52 42h56v4H52z"/><path class="s" d="M56 46v20M68 46v20M80 46v20M92 46v20M104 46v20M50 66h60v4H50z"/>' + person(70, 40, 16) + person(90, 40, 16),
      // Мир: опущенные копья и ветви мирта
      '<path class="s" d="M30 86l60-70M130 86l-60-70"/><path class="s f" d="M86 20l8-8l-2 10zM74 20l-8-8l2 10z"/>' + [[50, 80], [66, 84], [94, 84], [110, 80]].map(([x, y]) => `<path class="s f" d="M${x} ${y}c-2-8 4-12 10-10c-2 6-6 10-10 10z"/>`).join('') + '<path class="s" d="M44 88c20-6 52-6 72 0"/>',
      // Почему этот модуль: продольный профиль самотёчной сети
      '<path class="s" d="M10 30c30-4 60 4 90 0s40 6 50 4"/>' + [28, 70, 112].map((x, i) => `<path class="s" d="M${x} ${30 + i}v${28 + i * 8}h8v${-28 - i * 8}"/>`).join('') + '<path class="s f" d="M10 56l140 26v6L10 62z"/><path class="w" d="M14 60l130 24"/><path class="s" d="M140 90v-12h10v12"/>'
    ]
  };

  /* ---------- эскизы будущих конструкторов ---------- */
  const panel = (x, y, w, h, title) => `<rect class="sk-p" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>${title ? `<text class="sk-t" x="${x + 10}" y="${y + 18}">${title}</text>` : ''}`;
  const note = (x, y, t) => `<text class="sk-n" x="${x}" y="${y}">${t}</text>`;
  const chrome = (title, left, right) => panel(8, 8, 664, 30) + `<text class="sk-t" x="20" y="28">${title}</text>` + [0, 1, 2].map(i => `<rect class="sk-chip" x="${400 + i * 88}" y="15" width="78" height="16" rx="8"/>`).join('') + panel(8, 46, 120, 300, left) + panel(552, 46, 120, 300, right) + panel(8, 354, 664, 58, 'Каталог') + [0, 1, 2, 3, 4, 5, 6].map(i => `<rect class="sk-chip" x="${20 + i * 92}" y="378" width="80" height="26" rx="5"/>`).join('');
  const SKETCH = {
    tlaloc: chrome('Тлалок · водосбор реки', 'Осадки', 'Створ реки') +
      '<path class="sk-s" d="M160 120c40-50 160-60 220-30s120 20 150 70s-20 120-90 140s-200 20-250-30s-60-110-30-150z"/>' +
      '<path class="sk-w" d="M200 150c40 20 70 40 110 70s80 40 120 90M260 110c10 40 30 70 50 110M420 140c-20 40-50 60-70 120M330 300h40"/>' +
      '<path class="sk-s" d="M380 300l4 22"/>' + note(390, 330, 'створ: Q = ? м³/с') +
      [[200, 120], [300, 100], [420, 110]].map(([x, y]) => `<path class="sk-s" d="M${x - 16} ${y}c-8 0-8-12 2-12c2-8 18-8 20 0c8 0 8 12 0 12z"/>` + [0, 1, 2].map(i => `<path class="sk-w" d="M${x - 8 + i * 8} ${y + 4}l-2 8"/>`).join('')).join('') +
      '<path class="sk-s" d="M20 200h96M20 200v-80"/>' + [0, 1, 2, 3, 4, 5].map(i => `<rect class="sk-f" x="${26 + i * 15}" y="${200 - [20, 50, 70, 40, 25, 10][i]}" width="10" height="${[20, 50, 70, 40, 25, 10][i]}"/>`).join('') + note(20, 220, 'ливень 1% обесп.') +
      '<path class="sk-s" d="M562 200h100M562 200v-90"/><path class="sk-w" d="M562 196c20 0 26-60 40-70s30 50 60 66"/>' + note(564, 220, 'гидрограф стока'),
    hapi: chrome('Хапи · водохозяйственный баланс', 'Водопользователи', 'Баланс реки') +
      '<path class="sk-w" d="M150 80c60 40 120 30 180 80s100 120 200 180" stroke-width="10"/>' +
      [[220, 120, 'город'], [300, 170, 'ГЭС'], [420, 250, 'орошение'], [470, 300, 'промышленность']].map(([x, y, t]) => `<circle class="sk-s" cx="${x + 50}" cy="${y - 20}" r="16"/><path class="sk-s" d="M${x + 36} ${y - 10}L${x + 6} ${y}" stroke-dasharray="4 4"/>` + note(x + 72, y - 16, t)).join('') +
      '<path class="sk-s" d="M18 110h100M18 150h100M18 190h100"/>' + note(18, 104, 'забор, млн м³') + note(18, 144, 'возврат') + note(18, 184, 'потери') +
      [0, 1, 2, 3].map(i => `<rect class="sk-f" x="${566 + i * 26}" y="${290 - [180, 120, 90, 60][i]}" width="18" height="${[180, 120, 90, 60][i]}"/>`).join('') + note(560, 306, 'приток / расход'),
    yu: chrome('Ю Великий · гидроузел', 'Сооружения', 'Расчёт') +
      '<path class="sk-f" d="M150 190h180v130H150z"/><path class="sk-w" d="M150 190h180"/><path class="sk-s" d="M330 320V160h30l70 160z"/><path class="sk-w" d="M360 160c40 10 70 70 100 120s50 40 80 40"/><path class="sk-s" d="M140 320h400"/>' +
      note(170, 182, 'НПУ ▽ 112,0') + note(170, 214, 'УМО ▽ 104,5') + '<path class="sk-s" d="M150 220h180" stroke-dasharray="6 4"/>' + note(390, 150, 'водосброс: Q 1% = ?') +
      '<path class="sk-s" d="M20 90h96v40H20zM20 150h96v40H20zM20 210h96v40H20z"/>' + note(30, 114, 'плотина') + note(30, 174, 'водосброс') + note(30, 234, 'канал') +
      note(566, 90, 'устойчивость') + note(566, 120, 'фильтрация') + note(566, 150, 'пропускная') + note(566, 166, 'способность'),
    enki: chrome('Энки · водозабор', 'Источник', 'Скважины') +
      '<path class="sk-s" d="M140 120h400"/><path class="sk-f" d="M140 200h400v60H140z"/><path class="sk-s" d="M140 200h400M140 260h400"/>' + note(150, 194, 'водоносный горизонт') +
      [220, 320, 420].map(x => `<path class="sk-s" d="M${x - 5} 100v150M${x + 5} 100v150M${x - 10} 100h20"/><path class="sk-s" d="M${x - 60} 200c30 30 50 30 60 30s30 0 60-30" stroke-dasharray="5 4"/>`).join('') + note(240, 290, 'воронки депрессии') +
      '<path class="sk-w" d="M480 120c10 20 30 30 60 30"/><path class="sk-s" d="M470 110h40v20h-40z"/>' + note(470, 104, 'береговой водозабор') +
      '<path class="sk-s" d="M18 90h100v60H18z"/>' + note(24, 110, 'дебит, м³/сут') + note(24, 130, 'понижение, м') + note(564, 90, 'ЗСО: I, II, III пояс') + '<circle class="sk-s" cx="610" cy="180" r="20"/><circle class="sk-s" cx="610" cy="180" r="40" stroke-dasharray="4 4"/><circle class="sk-s" cx="610" cy="180" r="55" stroke-dasharray="2 5"/>',
    anahita: chrome('Анахита · станция водоподготовки', 'Вода источника', 'Питьевая вода') +
      ['смеситель', 'камера хлопьеобр.', 'отстойник', 'фильтры', 'обеззараж.', 'РЧВ'].map((t, i) => `<rect class="sk-p" x="${142 + i * 68}" y="150" width="56" height="${i === 2 ? 90 : 60}" rx="4"/>` + note(142 + i * 68, 140 - (i % 2) * 14, t) + (i < 5 ? `<path class="sk-w" d="M${198 + i * 68} 180h12"/>` : '')).join('') +
      '<path class="sk-s" d="M150 260v30h40v-30"/>' + note(140, 310, 'коагулянт') + note(20, 90, 'мутность') + note(20, 110, 'цветность') + note(20, 130, 'железо') + note(20, 150, 'жёсткость') + note(20, 170, 'микробы') +
      note(564, 90, 'СанПиН 1.2.3685') + '<path class="sk-s" d="M564 110h96M564 130h96M564 150h96M564 170h96"/>',
    juturna: chrome('Ютурна · кольцевая сеть', 'Источник и башня', 'Напоры в узлах') +
      '<path class="sk-s" d="M180 120h140v100H180zM320 120h140v100H320zM180 220h140v80H180z" stroke-width="2"/><path class="sk-s" d="M460 220v80H320"/>' +
      [[180, 120], [320, 120], [460, 120], [180, 220], [320, 220], [460, 220], [180, 300], [320, 300], [460, 300]].map(([x, y], i) => `<circle class="sk-node" cx="${x}" cy="${y}" r="7"/>` + note(x + 8, y - 8, `${[38, 34, 31, 33, 29, 27, 30, 26, 24][i]} м`)).join('') +
      note(236, 112, 'q, л/с · v, м/с') + '<path class="sk-s" d="M150 120h30"/><path class="sk-s" d="M130 80h20v40h-20zM126 80h28"/>' + note(30, 100, 'НС II подъёма') + note(30, 120, 'водонапорная') + note(30, 136, 'башня') +
      note(564, 90, 'увязка колец') + note(564, 110, 'Лобачёв — Кросс') + note(564, 140, 'мин. напор 10 м'),
    cloacina: chrome('Клоацина · водоотводящая сеть', 'Бассейны стока', 'Продольный профиль') +
      '<path class="sk-s" d="M150 110c60-8 140 6 200 0s120 10 180 4"/>' + note(150, 102, 'поверхность земли') +
      [180, 260, 340, 420, 500].map((x, i) => `<path class="sk-s" d="M${x} ${110 + (i % 2) * 3}v${60 + i * 18}M${x + 10} ${110 + (i % 2) * 3}v${60 + i * 18}"/>`).join('') +
      '<path class="sk-f" d="M150 170l390 80v10L150 180z"/><path class="sk-w" d="M154 176l380 78"/>' + note(250, 230, 'i = 0,005 · d 300 · h/d 0,6') +
      '<path class="sk-s" d="M500 250h40v40h-40z"/>' + note(480, 310, 'КНС') + note(20, 90, 'население') + note(20, 110, 'норма водоотв.') + note(20, 130, 'коэф. неравном.') +
      note(564, 90, 'уклон') + note(564, 110, 'наполнение') + note(564, 130, 'скорость ≥ 0,7')
  };

  root.SeshatArt = {
    symbol: (id, size = 64) => SYMBOL[id] ? svg(SYMBOL[id], '0 0 64 64', 'art sym') .replace('<svg ', `<svg width="${size}" height="${size}" `) : '',
    lore: (id, i) => LORE[id] && LORE[id][i] ? svg(LORE[id][i]) : '',
    sketch: id => SKETCH[id] ? svg(SKETCH[id], '0 0 680 420', 'sketch') : '',
    has: { symbol: id => !!SYMBOL[id], lore: id => (LORE[id] || []).length, sketch: id => !!SKETCH[id] }
  };
  if (typeof module !== 'undefined') module.exports = root.SeshatArt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
