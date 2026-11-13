// Расчёт самотечной хозяйственно-бытовой водоотводящей сети: расходы, гидравлика, подбор диаметров и уклонов,
// продольный профиль и проверки по СП 32.13330.2018 (ред. изм. № 1–5). Модуль «Водоотводящие сети» (Клоацина).
// Работает в браузере и в Node (тесты).
//
// Главный принцип: каждое число объяснимо. Функции возвращают не только результат, но и «логику расчёта» —
// список шагов { t, f, s, v, u, ref, kind, note }:
//   t — что считаем; f — формула (LaTeX); s — подстановка; v — результат; u — единица;
//   ref — источник { doc, where, page }; kind — тип шага:
//     'norm'   — прямое требование нормативного документа;
//     'method' — способ расчёта из признанного источника, на который норма отсылает («по таблицам…»);
//     'assume' — решение Сешат там, где документ молчит или неоднозначен (каждое есть в ASSUMPTIONS);
//     'input'  — исходные данные пользователя; 'calc' — арифметика.
//
// Источники (рабочие тексты — нормативка «Сети канализации», INDEX.md):
//   СП 32.13330.2018 — расходы (п. 5.1, табл. 1, формулы (1), (1а)), гидравлика (п. 5.2.1), диаметры (п. 5.3.1),
//     скорости и наполнения (п. 5.4, табл. 2), уклоны (п. 5.5.1), глубина (п. 6.2.3–6.2.4), колодцы (п. 6.3.1);
//   СП 399.1325800.2018 — полимерные самотёчные трубы: п. 5.5.5 → прил. Б, табл. А.1–А.3, Б.1 (основной текст 2018 г.,
//     влияние изм. № 1 не проверено — текст изменения не найден);
//   СП 31.13330.2021 — удельное водопотребление (табл. 1); СП 131.13330.2025 — осадки и температуры;
//   СП 22.13330.2016 — нормативная глубина промерзания (п. 5.5.3);
//   СНиП 2.04.03-85 п. 2.29 (недействующий) и таблицы Лукиных (1974) — формула Н. Н. Павловского для неполимерных труб.
// Единицы: расход q — л/с, длина L — м, диаметр d — мм (расчётный внутренний), отметки, глубины, h — м, уклон i — доли.
(function (root) {
  const G = 9.81;
  const ref = (doc, where, page) => ({ doc, where, page });
  const DOCS = {
    sp32: 'СП 32.13330.2018 (ред. изм. № 1–5)', sp399: 'СП 399.1325800.2018', sp31: 'СП 31.13330.2021',
    sp131: 'СП 131.13330.2025', sp22: 'СП 22.13330.2016', snip20403: 'СНиП 2.04.03-85 (недействующий)',
    luk: 'Лукиных А. А., Лукиных Н. А. Таблицы для гидравлического расчёта канализационных сетей… — М.: Стройиздат, 1974'
  };
  const R = {
    t1: ref('sp32', 'п. 5.1.7, табл. 1 (ред. изм. № 2, № 3)'), k1a: ref('sp32', 'п. 5.1.7, формула (1а) (введена изм. № 3)'),
    add: ref('sp32', 'п. 5.1.5 (ред. изм. № 3)'), qad: ref('sp32', 'п. 5.1.10, формула (1) (ред. изм. № 2)'),
    hyd: ref('sp32', 'п. 5.2.1'), dmin: ref('sp32', 'п. 5.3.1 (ред. изм. № 2, № 3)'), t2: ref('sp32', 'п. 5.4.1, табл. 2'),
    vmax: ref('sp32', 'п. 5.4.2'), fill: ref('sp32', 'п. 5.4.6 (ред. изм. № 5)'), check95: ref('sp32', 'п. 5.1.10, последний абзац'),
    imin: ref('sp32', 'п. 5.5.1 (ред. изм. № 3)'), crown: ref('sp32', 'п. 6.2.3'), depth: ref('sp32', 'п. 6.2.4'),
    well: ref('sp32', 'п. 6.3.1'),
    b1: ref('sp399', 'прил. Б, формула (Б.1)', 95), b2: ref('sp399', 'прил. Б, формулы (Б.2)–(Б.3)', 95),
    b4: ref('sp399', 'прил. Б, формулы (Б.4)–(Б.6)', 95), b7: ref('sp399', 'прил. Б, формула (Б.7)', 96),
    b8: ref('sp399', 'прил. Б, формулы (Б.8)–(Б.9), табл. Б.1', 96), a1: ref('sp399', 'табл. А.1', 93),
    visc: ref('sp399', 'прил. Б, п. Б.3.2; табл. А.2, А.3', 94), poly: ref('sp399', 'п. 5.5.4–5.5.5'),
    pav: ref('snip20403', 'п. 2.29, формулы (11)–(12)', 10), luk: ref('luk', 'введение, формулы (1)–(2); с. 7, формула (17)', 3),
    qzh: ref('sp31', 'п. 5.1, табл. 1'), md: ref('sp131', 'табл. 6.1 «Суточный максимум осадков»'),
    mt: ref('sp131', 'табл. 7.1'), dfn: ref('sp22', 'п. 5.5.3, формула (5.3)', 29)
  };
  // Допущения: где норма молчит или неоднозначна. Каждое показывается в логике расчёта и в списке вопросов.
  const ASSUMPTIONS = {
    interp: 'Промежуточные значения табл. 1 СП 32 — линейная интерполяция по среднему расходу (способ в СП не указан).',
    k5: 'Примечание 2 к табл. 1 (Kmax = 3 при q < 5 л/с) применено к обоим процентилям.',
    extra: 'Доли п. 5.1.5 приняты по нижней границе диапазонов: торговля и услуги 6 %, неучтённые притоки 4 %; неорганизованный приток в максимальный расход не входит (п. 5.1.10 — вместо него дополнительный приток qad).',
    path: 'Путевой расход участка принят поступающим в его начало (в запас).',
    conc: 'Сосредоточенный расход задаётся как максимальный секундный и прибавляется к расчётному без коэффициента неравномерности.',
    fillcol: 'Наибольшее расчётное наполнение принято по столбцу табл. 2 СП 32 для данного диаметра (0,6 / 0,7 / 0,75 / 0,8), но не более 0,8 (п. 5.4.6).',
    gap: 'Диаметр, которого нет в табл. 2 (например, 1400 мм), отнесён к ближайшей строке с бо́льшим диаметром.',
    keunit: 'В (Б.3) α = 0,3124·Kэ^0,0516 единица Kэ не указана; принято Kэ в мм (как в табл. А.1). При Kэ в мм метод даёт λ, совпадающий с формулой Колбрука — Уайта (проверено тестом).',
    rp: 'В (Б.5)–(Б.6) гидравлический радиус принят при полном наполнении Rп: по (Б.1)–(Б.6) находится скорость полного наполнения Vп, затем (Б.7) переводит её к неполному наполнению.',
    geom: 'Гидравлический радиус и площадь при промежуточных наполнениях — по точной геометрии круга; в узлах табл. Б.1 значения совпадают (проверено тестом).',
    visc: 'Температура сточной воды 15 °С и взвешенные вещества 200 мг/л по умолчанию (для табл. А.3 СП 399); задаются пользователем.',
    pav: 'В печатном тексте СНиП 2.04.03-85 (12) стоит 0,75R, у Н. Н. Павловского и в таблицах Лукиных — 0,75√R; принят вариант таблиц, по которым п. 5.2.1 СП 32 велит считать.',
    dint: 'Расчётный внутренний диаметр принят равным номинальному (уточнение по сортаменту ГОСТ — следующий шаг).',
    zero: 'Глубина проникания нулевой температуры (п. 6.2.4 СП 32) при отсутствии данных принята равной нормативной глубине промерзания по СП 22 п. 5.5.3.',
    small: 'Если при минимальном (самоочищающем) уклоне наполнение меньше наибольшего расчётного, скорость может быть меньше Vmin — участок помечается как нерасчётный; уклон при этом не увеличивается.',
    q99: 'Проверка на пропуск увеличенного расхода (п. 5.1.10, наполнение 0,95) выполняется на приток 99-го процентиля плюс дополнительный приток (примечание 4 к табл. 1).'
  };

  const fmt = (x, n = 3) => (x == null || !isFinite(x)) ? '—' : (+x.toFixed(n)).toString().replace('.', ',');
  const tracer = () => { const steps = []; return { steps, add(o) { steps.push(o); return o.v; } }; };
  const interp = (pts, x) => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    const k = pts.findIndex(p => p[0] >= x), [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  };

  /* ---------- геометрия круглого сечения ---------- */
  // a = h/d; θ — центральный угол смоченной части. ω/d² = (θ − sin θ)/8; R/d = (θ − sin θ)/(4θ).
  function geom(a) {
    const th = 2 * Math.acos(1 - 2 * Math.min(Math.max(a, 1e-9), 1));
    return { th, w: (th - Math.sin(th)) / 8, r: (th - Math.sin(th)) / (4 * th) };
  }
  // табл. Б.1 СП 399: h/d → R/d, Rн/Rп, Kω (для теста геометрии)
  const TB1 = [[0.1, 0.0635, 0.2540, 0.0409], [0.2, 0.1206, 0.4824, 0.1118], [0.3, 0.1709, 0.6836, 0.1982], [0.4, 0.2142, 0.8568, 0.2934],
    [0.5, 0.25, 1, 0.3927], [0.6, 0.2776, 1.1104, 0.4920], [0.7, 0.2962, 1.1848, 0.5872], [0.8, 0.3042, 1.2168, 0.6736],
    [0.9, 0.2980, 1.1920, 0.7445], [1.0, 0.25, 1, 0.7854]];

  /* ---------- материалы труб ---------- */
  const MATERIALS = {
    pe: { n: 'Полиэтилен, блок-сополимер пропилена (ПЭ, ПП-Б)', method: 'sp399', ke: 0.014, vmax: 8, poly: true },
    pvc: { n: 'Непластифицированный ПВХ, ПВХ-О', method: 'sp399', ke: 0.008, vmax: 8, poly: true },
    concrete: { n: 'Железобетонные', method: 'pavlovsky', nr: 0.014, vmax: 4 },
    ceramic: { n: 'Керамические', method: 'pavlovsky', nr: 0.014, vmax: 4 },
    castiron: { n: 'Чугунные', method: 'pavlovsky', nr: 0.014, vmax: 8 }
  };
  const DIAMETERS = [150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1500, 1600, 1800, 2000];

  /* ---------- вязкость сточной воды (СП 399, табл. А.2, А.3), ν·10⁶ м²/с ---------- */
  const A2 = [[2, 1.67], [3, 1.62], [4, 1.57], [5, 1.52], [6, 1.47], [7, 1.43], [8, 1.39], [9, 1.35], [10, 1.31], [11, 1.27], [12, 1.24], [13, 1.21],
    [14, 1.18], [15, 1.15], [16, 1.12], [17, 1.09], [18, 1.06], [19, 1.03], [20, 1.01], [21, 0.98], [22, 0.96], [23, 0.94], [24, 0.92], [25, 0.90]];
  const A3SS = [100, 200, 300, 400, 500, 600];
  const A3 = { 2: [2.17, 2.67, 3.17, 3.67, 4.17, 4.67], 3: [1.83, 2.05, 2.27, 2.49, 2.71, 2.93], 4: [1.68, 1.80, 1.92, 2.04, 2.16, 2.28],
    5: [1.60, 1.68, 1.76, 1.84, 1.92, 2.00], 6: [1.52, 1.58, 1.63, 1.69, 1.74, 1.80], 7: [1.46, 1.50, 1.64, 1.58, 1.62, 1.67],
    8: [1.42, 1.45, 1.48, 1.51, 1.54, 1.58], 9: [1.37, 1.40, 1.42, 1.45, 1.47, 1.49], 10: [1.33, 1.35, 1.37, 1.39, 1.41, 1.43],
    11: [1.29, 1.30, 1.32, 1.34, 1.35, 1.37], 12: [1.25, 1.27, 1.28, 1.30, 1.31, 1.32], 13: [1.22, 1.23, 1.25, 1.26, 1.27, 1.28],
    14: [1.18, 1.19, 1.20, 1.21, 1.22, 1.23], 15: [1.15, 1.16, 1.17, 1.18, 1.18, 1.19], 16: [1.12, 1.13, 1.13, 1.14, 1.15, 1.16],
    17: [1.10, 1.10, 1.11, 1.12, 1.12, 1.13], 18: [1.07, 1.07, 1.08, 1.08, 1.09, 1.10], 19: [1.04, 1.04, 1.05, 1.05, 1.06, 1.06],
    20: [1.02, 1.02, 1.02, 1.03, 1.04, 1.04], 21: [1.00, 1.00, 1.00, 1.01, 1.01, 1.02], 22: [0.96, 0.97, 0.97, 0.98, 0.98, 0.98],
    23: [0.94, 0.95, 0.95, 0.96, 0.96, 0.96], 24: [0.92, 0.93, 0.93, 0.93, 0.94, 0.94], 25: [0.90, 0.91, 0.91, 0.91, 0.92, 0.92] };
  // опечатка издания, вероятная: t = 7 °С, 300 мг/л — 1,64 (ряд 1,50 → 1,64 → 1,58). Значение издания сохранено.
  const A3_SUSPECT = { t: 7, ss: 300, v: 1.64 };
  function viscosity(t = 15, ss = 200) {
    const tt = Math.min(Math.max(t, 2), 25);
    if (ss < 100) return interp(A2, tt) * 1e-6;
    const row = T => interp(A3SS.map((s, k) => [s, A3[T][k]]), Math.min(ss, 600));
    const t0 = Math.floor(tt), t1 = Math.min(t0 + 1, 25);
    return (row(t0) + (row(t1) - row(t0)) * (tt - t0)) * 1e-6;
  }

  /* ---------- гидравлика при заданном наполнении ---------- */
  // Павловский: C = R^y/n, y = 2,5√n − 0,13 − 0,75√R(√n − 0,1), v = C√(Ri). R — м.
  function pavlovsky(dmm, a, i, nr = 0.014, tr) {
    const d = dmm / 1000, g = geom(a), Rh = g.r * d, w = g.w * d * d;
    const y = 2.5 * Math.sqrt(nr) - 0.13 - 0.75 * Math.sqrt(Rh) * (Math.sqrt(nr) - 0.1);
    const C = Math.pow(Rh, y) / nr, v = C * Math.sqrt(Rh * i), q = v * w * 1000;
    if (tr) {
      tr.add({ t: 'Гидравлический радиус и живое сечение при h/d = ' + fmt(a, 2), f: '\\omega = \\tfrac{\\theta-\\sin\\theta}{8}d^2,\\; R = \\tfrac{\\theta-\\sin\\theta}{4\\theta}d',
        s: `ω = ${fmt(w, 5)} м², R = ${fmt(Rh, 4)} м`, v: Rh, u: '', kind: 'assume', note: ASSUMPTIONS.geom });
      tr.add({ t: 'Показатель степени y (Н. Н. Павловский)', f: 'y = 2{,}5\\sqrt{n} - 0{,}13 - 0{,}75\\sqrt{R}\\,(\\sqrt{n} - 0{,}1)',
        s: `n = ${fmt(nr, 3)}, R = ${fmt(Rh, 4)} → y = ${fmt(y, 4)}`, v: y, u: '', ref: R.luk, kind: 'method', note: ASSUMPTIONS.pav });
      tr.add({ t: 'Коэффициент Шези', f: 'C = R^{y}/n', s: `C = ${fmt(Rh, 4)}^{${fmt(y, 4)}} / ${fmt(nr, 3)} = ${fmt(C, 2)}`, v: C, u: 'м^0,5/с', ref: R.pav, kind: 'method' });
      tr.add({ t: 'Скорость', f: 'v = C\\sqrt{R\\,i}', s: `v = ${fmt(C, 2)}·√(${fmt(Rh, 4)}·${fmt(i, 4)}) = ${fmt(v, 3)}`, v, u: 'м/с', ref: R.pav, kind: 'method' });
      tr.add({ t: 'Расход', f: 'q = v\\,\\omega', s: `q = ${fmt(v, 3)}·${fmt(w, 5)}·1000 = ${fmt(q, 2)}`, v: q, u: 'л/с', kind: 'calc' });
    }
    return { v, q, R: Rh, w, a };
  }
  // СП 399 прил. Б: по (Б.1)–(Б.6) — скорость полного наполнения Vп, по (Б.7) — скорость при наполнении a.
  function sp399(dmm, a, i, mat, opt = {}, tr) {
    const d = dmm / 1000, ke = (mat.ke != null ? mat.ke : 0.014), keM = ke / 1000, nu = opt.nu || viscosity(opt.t, opt.ss);
    const Rp = d / 4, alpha = 0.3124 * Math.pow(ke, 0.0516), lam = 0.2 * Math.pow(keM / (4 * Rp), alpha);
    const Rekv = 500 * 4 * Rp / keM;
    let V = 1, b = 2;
    for (let k = 0; k < 60; k++) {
      const Ref = V * 4 * Rp / nu;
      b = Math.min(2, 3 - Math.log10(Rekv) / Math.log10(Math.max(Ref, 10)));
      const Vn = Math.pow(i * 2 * G * 4 * Rp / lam, 1 / b);
      if (Math.abs(Vn - V) < 1e-9) { V = Vn; break; }
      V = Vn;
    }
    const g = geom(a), Rn = g.r * d, w = g.w * d * d, ratio = Rn / Rp, v = V * Math.pow(ratio, (1 + alpha) / b), q = v * w * 1000;
    if (tr) {
      tr.add({ t: 'Коэффициент эквивалентной шероховатости', f: 'K_э', s: `${mat.n}: Kэ = ${fmt(ke, 3)}`, v: ke, u: 'мм', ref: R.a1, kind: 'norm' });
      tr.add({ t: 'Кинематическая вязкость сточной воды', f: '\\nu', s: `t = ${fmt(opt.t ?? 15, 1)} °С, взвешенные вещества ${fmt(opt.ss ?? 200, 0)} мг/л → ν = ${fmt(nu * 1e6, 3)}·10⁻⁶`,
        v: nu, u: 'м²/с', ref: R.visc, kind: 'norm', note: ASSUMPTIONS.visc });
      tr.add({ t: 'Показатель α', f: '\\alpha = 0{,}3124\\,K_э^{0{,}0516}', s: `α = 0,3124·${fmt(ke, 3)}^0,0516 = ${fmt(alpha, 4)}`, v: alpha, u: '', ref: R.b2, kind: 'assume', note: ASSUMPTIONS.keunit });
      tr.add({ t: 'Коэффициент гидравлического сопротивления при полном наполнении', f: '\\lambda_п = 0{,}2\\left(\\dfrac{K_э}{4R_п}\\right)^{\\alpha}',
        s: `Rп = d/4 = ${fmt(Rp, 4)} м; λп = 0,2·(${fmt(keM, 7)}/${fmt(4 * Rp, 3)})^${fmt(alpha, 4)} = ${fmt(lam, 5)}`, v: lam, u: '', ref: R.b2, kind: 'norm' });
      tr.add({ t: 'Режим течения b (итерации по скорости)', f: 'b = 3 - \\dfrac{\\lg Re_{кв}}{\\lg Re_ф},\\; Re_{кв} = \\dfrac{500\\cdot 4R}{K_э},\\; Re_ф = \\dfrac{V\\cdot 4R}{\\nu}',
        s: `Reкв = ${fmt(Rekv, 0)}, Reф = ${fmt(V * 4 * Rp / nu, 0)} → b = ${fmt(b, 4)} (при b > 2 принимают 2)`, v: b, u: '', ref: R.b4, kind: 'norm', note: ASSUMPTIONS.rp });
      tr.add({ t: 'Скорость при полном наполнении (из уклона)', f: 'i = \\dfrac{\\lambda V^{b}}{2g\\,4R} \\Rightarrow V_п = \\left(\\dfrac{2g\\,4R_п\\,i}{\\lambda_п}\\right)^{1/b}',
        s: `Vп = (2·9,81·${fmt(4 * Rp, 3)}·${fmt(i, 4)}/${fmt(lam, 5)})^(1/${fmt(b, 4)}) = ${fmt(V, 3)}`, v: V, u: 'м/с', ref: R.b1, kind: 'norm' });
      tr.add({ t: 'Гидравлический радиус и живое сечение при h/d = ' + fmt(a, 2), f: 'R_н,\\; \\omega = K_\\omega d^2',
        s: `Rн = ${fmt(Rn, 4)} м, Rн/Rп = ${fmt(ratio, 4)}, ω = ${fmt(w, 5)} м²`, v: Rn, u: '', ref: R.b8, kind: 'assume', note: ASSUMPTIONS.geom });
      tr.add({ t: 'Скорость при неполном наполнении', f: 'V_н = V_п\\left(\\dfrac{R_н}{R_п}\\right)^{(1+\\alpha)/b}',
        s: `Vн = ${fmt(V, 3)}·${fmt(ratio, 4)}^(${fmt(1 + alpha, 4)}/${fmt(b, 4)}) = ${fmt(v, 3)}`, v, u: 'м/с', ref: R.b7, kind: 'norm' });
      tr.add({ t: 'Расход', f: 'q_н = V_н\\,\\omega', s: `q = ${fmt(v, 3)}·${fmt(w, 5)}·1000 = ${fmt(q, 2)}`, v: q, u: 'л/с', ref: R.b8, kind: 'norm' });
    }
    return { v, q, R: Rn, w, a, lam, alpha, b, Vp: V };
  }
  // единая точка входа: скорость и расход трубы d при наполнении a и уклоне i
  function flow(dmm, a, i, matKey = 'pe', opt = {}, tr) {
    const mat = MATERIALS[matKey] || MATERIALS.pe;
    if (tr) tr.add({ t: 'Метод гидравлического расчёта', f: '', s: mat.method === 'sp399'
      ? 'Трубы из полимерных материалов — по СП 399.1325800.2018, прил. Б (отсылка СП 32 п. 5.2.1)'
      : 'Неполимерные трубы — по таблицам, составленным по формуле Н. Н. Павловского при n = 0,014 (СП 32 п. 5.2.1 «по таблицам…»; СНиП 2.04.03-85 п. 2.29; таблицы Лукиных)',
      v: null, u: '', ref: mat.method === 'sp399' ? R.poly : R.hyd, kind: mat.method === 'sp399' ? 'norm' : 'method' });
    return mat.method === 'sp399' ? sp399(dmm, a, i, mat, opt, tr) : pavlovsky(dmm, a, i, mat.nr, tr);
  }
  // наполнение h/d, при котором труба пропускает расход q (л/с); a ≤ 0,938 — максимум пропускной способности
  const A_MAX = 0.938;
  function fillFor(q, dmm, i, matKey, opt) {
    const qmax = flow(dmm, A_MAX, i, matKey, opt).q;
    if (q > qmax) return { a: Infinity, over: true, qmax };
    let lo = 1e-4, hi = A_MAX;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (flow(dmm, m, i, matKey, opt).q < q) lo = m; else hi = m; }
    return { a: (lo + hi) / 2, over: false, qmax };
  }

  /* ---------- нормы СП 32 ---------- */
  // табл. 1: средний расход, л/с → Kmax, Kmin для 99-го и 95-го процентилей
  const T1Q = [5, 10, 20, 50, 100, 300, 500, 1000, 5000];
  const T1 = { 99: { max: [3.0, 2.7, 2.5, 2.2, 2.0, 1.8, 1.75, 1.7, 1.6], min: [0.2, 0.23, 0.26, 0.3, 0.35, 0.4, 0.45, 0.51, 0.56] },
    95: { max: [2.5, 2.1, 1.9, 1.7, 1.6, 1.55, 1.5, 1.47, 1.44], min: [0.38, 0.46, 0.5, 0.55, 0.59, 0.62, 0.66, 0.69, 0.71] } };
  function kTable(qavg, pct = 95, kind = 'max', tr) {
    const pts = T1Q.map((x, k) => [x, T1[pct][kind][k]]);
    const k = (kind === 'max' && qavg < 5) ? 3 : interp(pts, qavg);
    if (tr) tr.add({ t: `Коэффициент неравномерности Kнер (${pct}-й процентиль, ${kind === 'max' ? 'максимальный' : 'минимальный'})`, f: 'K_{нер} = f(q_{ср})\\;\\text{по табл. 1}',
      s: `qср = ${fmt(qavg, 2)} л/с → Kнер = ${fmt(k, 3)}`, v: k, u: '', ref: R.t1, kind: 'norm',
      note: qavg < 5 && kind === 'max' ? ASSUMPTIONS.k5 : ASSUMPTIONS.interp });
    return k;
  }
  // дополнительный приток qad = a·L·√md, md ≤ 30 мм
  const A_COEF = { existing: 0.45, newAbove: 0.15, newBelow: 0.25 };
  function qAdditional({ Lkm, md = 30, place = 'existing' }, tr) {
    const a = A_COEF[place] ?? 0.45, mdc = Math.min(md, 30), q = a * Lkm * Math.sqrt(mdc);
    if (tr) tr.add({ t: 'Дополнительный приток поверхностных и грунтовых вод', f: 'q_{ad} = a\\,L\\sqrt{m_d},\\; m_d \\le 30\\;мм',
      s: `a = ${fmt(a, 2)} (${{ existing: 'существующее поселение', newAbove: 'новый район, сети выше УГВ', newBelow: 'новый район, сети ниже УГВ' }[place] || place}), L = ${fmt(Lkm, 3)} км, md = ${fmt(md, 0)} мм${md > 30 ? ' → принято 30 мм' : ''} → qad = ${fmt(q, 3)}`,
      v: q, u: 'л/с', ref: R.qad, kind: 'norm' });
    return q;
  }
  // табл. 2: строка по диаметру → { vmin, fill }
  const T2 = [[250, 0.7, 0.6], [400, 0.8, 0.7], [500, 0.9, 0.75], [800, 1.0, 0.75], [900, 1.1, 0.75], [1200, 1.2, 0.8], [1500, 1.3, 0.8], [1900, 1.5, 0.8], [3000, 1.6, 0.8]];
  const T2_LISTED = [[150, 250], [300, 400], [450, 500], [600, 800], [900, 900], [1000, 1200], [1500, 1500], [1600, 1900], [2000, 3000]];
  function table2(dmm) {
    const row = T2.find(r => dmm <= r[0]) || T2[T2.length - 1];
    const listed = T2_LISTED.some(([a, b]) => dmm >= a && dmm <= b);
    return { vmin: row[1], fill: Math.min(row[2], 0.8), listed };
  }
  // наименьший уклон по п. 5.5.1 (только для 150 и 200 мм; local — пониженные значения «в зависимости от местных условий»)
  function slopeNorm(dmm, local) { if (dmm === 150) return local ? 0.007 : 0.008; if (dmm === 200) return local ? 0.005 : 0.007; return 0; }
  // наименьший диаметр: уличная 200 (150 при расходе до 300 м³/сут), внутриквартальная 150
  function dMin(kind, Qday) { return kind === 'yard' ? 150 : (Qday != null && Qday <= 300 ? 150 : 200); }
  // расстояние между колодцами на прямых участках
  const WELLS = [[150, 35], [450, 50], [600, 75], [900, 100], [1400, 150], [2000, 200], [Infinity, 250]];
  const wellSpacing = dmm => (WELLS.find(w => dmm <= w[0]) || WELLS[WELLS.length - 1])[1];
  // нормативная глубина промерзания d_fn = d0·√Mt (СП 22 п. 5.5.3)
  const D0 = { clay: 0.23, sandy: 0.28, sand: 0.30, coarse: 0.34 };
  function frostDepth({ soil = 'clay', Mt, dfn }, tr) {
    if (dfn != null) { if (tr) tr.add({ t: 'Глубина проникания нулевой температуры', f: '', s: `задана: ${fmt(dfn, 2)} м`, v: dfn, u: 'м', kind: 'input' }); return dfn; }
    const d0 = D0[soil] ?? 0.23, v = d0 * Math.sqrt(Mt);
    if (tr) tr.add({ t: 'Нормативная глубина сезонного промерзания', f: 'd_{fn} = d_0\\sqrt{M_t}', s: `d0 = ${fmt(d0, 2)} м, Mt = ${fmt(Mt, 1)} → dfn = ${fmt(v, 2)}`,
      v, u: 'м', ref: R.dfn, kind: 'norm', note: ASSUMPTIONS.zero });
    return v;
  }
  // наименьшая глубина лотка: выше глубины нулевой температуры на 0,3 (d ≤ 500) / 0,5 м, но не менее 0,7 м до верха трубы
  function minInvertDepth(dmm, dfn, tr) {
    const a = dfn - (dmm <= 500 ? 0.3 : 0.5), b = 0.7 + dmm / 1000, v = Math.max(a, b);
    if (tr) tr.add({ t: 'Наименьшая глубина заложения лотка', f: 'H_{min} = \\max(d_{fn} - \\Delta,\\; 0{,}7 + d)',
      s: `Δ = ${dmm <= 500 ? '0,3' : '0,5'} м: ${fmt(dfn, 2)} − ${dmm <= 500 ? '0,3' : '0,5'} = ${fmt(a, 2)}; 0,7 + ${fmt(dmm / 1000, 2)} = ${fmt(b, 2)} → ${fmt(v, 2)}`,
      v, u: 'м', ref: R.depth, kind: 'norm' });
    return v;
  }

  /* ---------- уклон, при котором при наибольшем наполнении скорость = Vmin ---------- */
  function selfCleanSlope(dmm, matKey, opt) {
    const { vmin, fill } = table2(dmm);
    let lo = 1e-5, hi = 0.2;
    for (let k = 0; k < 80; k++) { const m = Math.sqrt(lo * hi); if (flow(dmm, fill, m, matKey, opt).v < vmin) lo = m; else hi = m; }
    return hi;
  }

  /* ---------- расчёт сети ---------- */
  // net = { params, nodes: [{ id, z }], pipes: [{ id, a, b, L, people?, area?, conc?, mat?, kind?, d?, i? }] }
  // params: { qzh, density (чел/га), extra: { services, unaccounted }, md, place, soil, Mt | dfn, t, ss, hStart, localSlope }
  function solve(net) {
    const P = Object.assign({ qzh: 160, density: 250, md: 30, place: 'existing', soil: 'clay', Mt: 15.6, t: 15, ss: 200, hStart: 0, localSlope: false, mat: 'pe',
      extra: { services: 0.06, unaccounted: 0.04 } }, net.params || {});
    const errors = [], nodes = Object.fromEntries(net.nodes.map(n => [n.id, n]));
    const pipes = net.pipes.map(p => Object.assign({}, p));
    pipes.forEach(p => { if (!nodes[p.a] || !nodes[p.b]) errors.push(`Участок ${p.id}: нет узла ${!nodes[p.a] ? p.a : p.b}`); if (!(p.L > 0)) errors.push(`Участок ${p.id}: длина должна быть больше нуля`); });
    const out = {}; pipes.forEach(p => { (out[p.a] = out[p.a] || []).push(p); });
    pipes.forEach(p => { if ((out[p.a] || []).length > 1) errors.push(`Из узла ${p.a} выходит больше одного участка — самотечная сеть должна быть деревом`); });
    if (errors.length) return { ok: false, errors: [...new Set(errors)], pipes: [] };
    const inc = {}; pipes.forEach(p => { (inc[p.b] = inc[p.b] || []).push(p); });
    // порядок: от концевых участков к выпуску
    const order = [], done = new Set();
    const visit = (p, stack = new Set()) => {
      if (done.has(p.id)) return; if (stack.has(p.id)) { errors.push(`Цикл в сети через участок ${p.id}`); return; }
      stack.add(p.id); (inc[p.a] || []).forEach(u => visit(u, stack)); stack.delete(p.id); done.add(p.id); order.push(p);
    };
    pipes.forEach(p => visit(p));
    if (errors.length) return { ok: false, errors: [...new Set(errors)], pipes: [] };

    const glob = tracer();
    // исходные климатические данные — со ссылкой, откуда их взять (СП 131)
    if (P.dfn == null) glob.add({ t: 'Сумма абсолютных значений отрицательных среднемесячных температур', f: 'M_t = \\sum |t_{мес}|,\\; t_{мес} < 0',
      s: `Mt = ${fmt(P.Mt, 1)}${P.Mt === 15.6 ? ' (Санкт-Петербург)' : ''}`, v: P.Mt, u: '', ref: R.mt, kind: 'input' });
    glob.add({ t: 'Суточный максимум осадков', f: '', s: `md = ${fmt(P.md, 0)}`,
      v: P.md, u: 'мм', ref: R.md, kind: 'input', note: P.md > 30 ? 'В формулу (1) СП 32 входит md не более 30 мм (ред. изм. № 2), поэтому дополнительный приток считается по 30 мм.' : undefined });
    const dfn = frostDepth({ soil: P.soil, Mt: P.Mt, dfn: P.dfn }, glob);
    const extraK = 1 + (P.extra.services || 0) + (P.extra.unaccounted || 0);
    // расход поселения (для примечания 1 к п. 5.3.1: уличная сеть 150 мм при расходе до 300 м³/сут)
    const Qday = pipes.reduce((s, p) => s + (p.people != null ? p.people : (p.area || 0) * P.density), 0) * P.qzh / 1000 * extraK;
    const res = {};
    for (const p of order) {
      const tr = tracer(), checks = [], mk = p.mat || P.mat, mat = MATERIALS[mk] || MATERIALS.pe, opt = { t: P.t, ss: P.ss };
      const up = (inc[p.a] || []).map(u => res[u.id]);
      // 1. расходы
      const people = p.people != null ? p.people : (p.area || 0) * P.density;
      if (p.people == null && p.area) tr.add({ t: 'Население, обслуживаемое участком', f: 'N = F\\,p', s: `F = ${fmt(p.area, 2)} га, p = ${fmt(P.density, 0)} чел/га → N = ${fmt(people, 0)}`, v: people, u: 'чел.', kind: 'input' });
      const qOwn = tr.add({ t: 'Собственный средний расход участка (путевой)', f: 'q_{ср} = \\dfrac{N\\,q_ж}{86\\,400}\\,(1 + k_{т} + k_{н})',
        s: `N = ${fmt(people, 0)}, qж = ${fmt(P.qzh, 0)} л/сут (СП 31 табл. 1), доли п. 5.1.5: ${fmt(P.extra.services * 100, 0)} % + ${fmt(P.extra.unaccounted * 100, 0)} % → ${fmt(people * P.qzh / 86400 * extraK, 3)}`,
        v: people * P.qzh / 86400 * extraK, u: 'л/с', ref: R.add, kind: 'norm', note: ASSUMPTIONS.extra + ' ' + ASSUMPTIONS.path });
      const qTr = up.reduce((s, u) => s + u.qAvg, 0);
      const qAvg = tr.add({ t: 'Средний расход с учётом транзита', f: 'q_{ср} = q_{пут} + \\sum q_{тр}', s: `${fmt(qOwn, 3)} + ${fmt(qTr, 3)} = ${fmt(qOwn + qTr, 3)}`, v: qOwn + qTr, u: 'л/с', kind: 'calc' });
      const Lkm = (p.L + up.reduce((s, u) => s + u.Lup * 1000, 0)) / 1000;
      const qad = qAdditional({ Lkm, md: P.md, place: P.place }, tr);
      const k95 = kTable(qAvg, 95, 'max', tr), k99 = kTable(qAvg, 99, 'max');
      const kTot = qAvg > 0 ? k95 + qad / qAvg : 0;
      tr.add({ t: 'Общий коэффициент неравномерности', f: 'K_{общ} = K_{нер} + \\left(\\dfrac{q_{ср} + q_{ad}}{q_{ср}} - 1\\right)', s: `${fmt(k95, 3)} + ${fmt(qad, 3)}/${fmt(qAvg, 3)} = ${fmt(kTot, 3)}`, v: kTot, u: '', ref: R.k1a, kind: 'norm' });
      const qConc = up.reduce((s, u) => s + u.qConc, 0) + (p.conc || 0);
      const qDes = tr.add({ t: 'Расчётный максимальный расход', f: 'q_{max} = K_{общ}\\,q_{ср} + q_{соср}', s: `${fmt(kTot, 3)}·${fmt(qAvg, 3)} + ${fmt(qConc, 2)} = ${fmt(kTot * qAvg + qConc, 3)}`,
        v: kTot * qAvg + qConc, u: 'л/с', ref: R.k1a, kind: 'norm', note: qConc ? ASSUMPTIONS.conc : undefined });
      const q99 = k99 * qAvg + qad + qConc;
      // 2. подбор диаметра и уклона
      const za = nodes[p.a].z, zb = nodes[p.b].z, iGround = (za - zb) / p.L;
      const dUp = Math.max(0, ...up.map(u => u.d));
      const dLow = Math.max(dMin(p.kind, Qday), dUp);
      let d = p.d, i = p.i, why = '';
      const evalFor = (dd, ii) => { const fl = fillFor(qDes, dd, ii, mk, opt); return fl; };
      if (!d) {
        for (const dd of DIAMETERS.filter(x => x >= dLow)) {
          const iMin = Math.max(slopeNorm(dd, P.localSlope), selfCleanSlope(dd, mk, opt));
          const ii = i || Math.max(iMin, iGround);
          const fl = evalFor(dd, ii);
          if (!fl.over && fl.a <= table2(dd).fill + 1e-9) { d = dd; if (!i) i = ii; why = `наименьший диаметр не меньше ${dLow} мм, который пропускает расход при наполнении не больше ${fmt(table2(dd).fill, 2)} и уклоне ${fmt(ii, 4)}`; break; }
        }
        if (!d) { d = DIAMETERS[DIAMETERS.length - 1]; checks.push({ level: 'bad', text: 'Расход не проходит даже в трубе наибольшего диаметра каталога' }); }
      }
      const iMinD = Math.max(slopeNorm(d, P.localSlope), selfCleanSlope(d, mk, opt));
      if (!i) i = Math.max(iMinD, iGround);
      tr.add({ t: 'Наименьший уклон для диаметра ' + d + ' мм', f: 'i_{min} = \\max(i_{п.5.5.1},\\; i: v(h_{max}) = V_{min})',
        s: `п. 5.5.1: ${slopeNorm(d, P.localSlope) ? fmt(slopeNorm(d, P.localSlope), 3) : 'не нормирован числом'}; по самоочищающей скорости ${fmt(table2(d).vmin, 2)} м/с при h/d = ${fmt(table2(d).fill, 2)}: ${fmt(selfCleanSlope(d, mk, opt), 4)} → ${fmt(iMinD, 4)}`,
        v: iMinD, u: '', ref: R.imin, kind: 'norm' });
      tr.add({ t: 'Уклон поверхности земли', f: 'i_з = (z_н - z_к)/L', s: `(${fmt(za, 2)} − ${fmt(zb, 2)})/${fmt(p.L, 0)} = ${fmt(iGround, 4)}`, v: iGround, u: '', kind: 'calc' });
      tr.add({ t: 'Принятые диаметр и уклон', f: 'i = \\max(i_{min},\\; i_з)', s: p.d ? `заданы пользователем: d = ${d} мм, i = ${fmt(i, 4)}` : `d = ${d} мм (${why}); i = ${fmt(i, 4)}`,
        v: i, u: '', kind: p.d ? 'input' : 'calc', note: ASSUMPTIONS.dint });
      // 3. гидравлика при расчётном расходе
      const fl = evalFor(d, i), a = fl.a;
      const hyd = flow(d, Math.min(a, A_MAX), i, mk, opt, tr);
      const t2 = table2(d);
      tr.add({ t: 'Наполнение при расчётном расходе', f: 'h/d:\\; q(h/d) = q_{max}', s: fl.over ? `расход ${fmt(qDes, 2)} л/с больше пропускной способности ${fmt(fl.qmax, 2)} л/с` : `h/d = ${fmt(a, 3)}, h = ${fmt(a * d / 1000, 3)} м`,
        v: a, u: '', kind: 'calc' });
      // 4. проверки
      if (fl.over) checks.push({ level: 'bad', text: `Труба переполнена: ${fmt(qDes, 2)} л/с > ${fmt(fl.qmax, 2)} л/с`, ref: R.fill });
      else if (a > t2.fill + 1e-9) checks.push({ level: 'bad', text: `Наполнение ${fmt(a, 2)} больше наибольшего расчётного ${fmt(t2.fill, 2)}`, ref: R.fill, note: ASSUMPTIONS.fillcol });
      if (!t2.listed) checks.push({ level: 'info', text: `Диаметра ${d} мм нет в табл. 2 — Vmin и наполнение взяты по ближайшей большей строке`, ref: R.t2, note: ASSUMPTIONS.gap });
      if (hyd.v < t2.vmin - 1e-9) checks.push({ level: 'warn', text: `Скорость ${fmt(hyd.v, 2)} м/с меньше Vmin = ${fmt(t2.vmin, 2)} м/с: участок нерасчётный, уклон принят не меньше самоочищающего`, ref: R.t2, note: ASSUMPTIONS.small });
      if (hyd.v > mat.vmax) checks.push({ level: 'bad', text: `Скорость ${fmt(hyd.v, 2)} м/с больше наибольшей ${mat.vmax} м/с — уменьшить уклон и устроить перепадный колодец`, ref: R.vmax });
      if (i < slopeNorm(d, P.localSlope) - 1e-12) checks.push({ level: 'bad', text: `Уклон ${fmt(i, 4)} меньше наименьшего ${fmt(slopeNorm(d, P.localSlope), 3)}`, ref: R.imin });
      if (d < dMin(p.kind, Qday)) checks.push({ level: 'bad', text: `Диаметр ${d} мм меньше наименьшего ${dMin(p.kind, Qday)} мм`, ref: R.dmin });
      if (d < dUp) checks.push({ level: 'warn', text: `Диаметр ${d} мм меньше диаметра вышележащего участка ${dUp} мм`, ref: R.crown });
      const f99 = fillFor(q99, d, i, mk, opt);
      tr.add({ t: 'Проверка на пропуск увеличенного расхода', f: 'q_{99} = K_{99}\\,q_{ср} + q_{ad} + q_{соср};\\; h/d \\le 0{,}95',
        s: `K99 = ${fmt(k99, 3)}, q99 = ${fmt(q99, 3)} л/с → h/d = ${f99.over ? 'переполнение' : fmt(f99.a, 3)}`, v: f99.a, u: '', ref: R.check95, kind: 'norm', note: ASSUMPTIONS.q99 });
      if (f99.over || f99.a > 0.95) checks.push({ level: 'bad', text: `Увеличенный расход ${fmt(q99, 2)} л/с не проходит при наполнении 0,95`, ref: R.check95 });
      const nWells = Math.max(0, Math.ceil(p.L / wellSpacing(d)) - 1);
      if (nWells) checks.push({ level: 'info', text: `Длина ${fmt(p.L, 0)} м больше ${wellSpacing(d)} м: нужно промежуточных колодцев — ${nWells}`, ref: R.well });
      // 5. профиль: отметки лотка, соединение по шелыгам
      const hMin = minInvertDepth(d, dfn);
      const byDepth = za - Math.max(hMin, up.length ? 0 : (P.hStart || 0));
      const byCrown = up.length ? Math.min(...up.map(u => u.invEnd + u.d / 1000)) - d / 1000 : Infinity;
      const invStart = Math.min(byDepth, byCrown);
      tr.add({ t: 'Отметка лотка в начале участка', f: up.length ? 'z_{л} = \\min(z_з - H_{min},\\; \\min(z_{л,вх} + d_{вх}) - d)' : 'z_{л} = z_з - \\max(H_{min}, H_{нач})',
        s: up.length ? `по глубине ${fmt(byDepth, 3)}; по шелыгам ${fmt(byCrown, 3)} → ${fmt(invStart, 3)}` : `${fmt(za, 2)} − ${fmt(Math.max(hMin, P.hStart || 0), 2)} = ${fmt(invStart, 3)}`,
        v: invStart, u: 'м', ref: up.length ? R.crown : R.depth, kind: 'norm' });
      const invEnd = invStart - i * p.L;
      tr.add({ t: 'Отметка лотка в конце участка', f: 'z_{л,к} = z_{л,н} - i\\,L', s: `${fmt(invStart, 3)} − ${fmt(i, 4)}·${fmt(p.L, 0)} = ${fmt(invEnd, 3)}`, v: invEnd, u: 'м', kind: 'calc' });
      const depthA = za - invStart, depthB = zb - invEnd;
      if (depthB < minInvertDepth(d, dfn) - 1e-6) checks.push({ level: 'warn', text: `Глубина в конце ${fmt(depthB, 2)} м меньше наименьшей ${fmt(minInvertDepth(d, dfn), 2)} м`, ref: R.depth });
      res[p.id] = {
        id: p.id, a: p.a, b: p.b, L: p.L, mat: mk, kind: p.kind || 'street', people, qOwn, qAvg, qad, k95, k99, kTot, qDes, q99, qConc,
        Lup: Lkm, d, i, iGround, fill: a, h: isFinite(a) ? a * d / 1000 : null, v: hyd.v, vmin: t2.vmin, fillMax: t2.fill,
        invStart, invEnd, zA: za, zB: zb, depthA, depthB, crownStart: invStart + d / 1000, crownEnd: invEnd + d / 1000,
        waterStart: isFinite(a) ? invStart + a * d / 1000 : null, waterEnd: isFinite(a) ? invEnd + a * d / 1000 : null,
        wells: nWells, checks, steps: tr.steps, invEndCrown: invEnd + d / 1000
      };
    }
    const list = pipes.map(p => res[p.id]);
    glob.add({ t: 'Средний суточный расход поселения', f: 'Q = \\dfrac{N\\,q_ж}{1000}(1 + k_т + k_н)', s: `Q = ${fmt(Qday, 1)}`, v: Qday, u: 'м³/сут', ref: R.dmin, kind: 'norm',
      note: Qday <= 300 ? 'Расход поселения не больше 300 м³/сут: для уличной сети допускается диаметр 150 мм (примечание к п. 5.3.1).' : undefined });
    return { ok: !list.some(r => r.checks.some(c => c.level === 'bad')), errors: [], pipes: list, order: order.map(p => p.id), dfn, Qday, steps: glob.steps, params: P };
  }

  // Учебный пример: квартальная застройка, коллектор вдоль улицы и два боковых присоединения (отметки земли — м).
  const example = () => ({
    params: { qzh: 160, density: 300, md: 30, place: 'newAbove', soil: 'clay', Mt: 15.6, mat: 'pe', t: 15, ss: 200 },
    nodes: [{ id: '1', x: 0, y: 200, z: 30.0 }, { id: '2', x: 180, y: 200, z: 28.8 }, { id: '3', x: 380, y: 200, z: 27.5 }, { id: '4', x: 600, y: 200, z: 26.0 },
      { id: '5', x: 800, y: 200, z: 24.8 }, { id: '6', x: 180, y: 50, z: 30.5 }, { id: '7', x: 380, y: 360, z: 28.9 }, { id: 'В', x: 950, y: 200, z: 24.0, outlet: true }],
    pipes: [
      { id: '1-2', a: '1', b: '2', L: 180, area: 2.0 }, { id: '6-2', a: '6', b: '2', L: 150, area: 1.5, kind: 'yard' },
      { id: '2-3', a: '2', b: '3', L: 200, area: 2.5 }, { id: '7-3', a: '7', b: '3', L: 160, area: 1.8, kind: 'yard' },
      { id: '3-4', a: '3', b: '4', L: 220, area: 3.0 }, { id: '4-5', a: '4', b: '5', L: 200, area: 2.2 }, { id: '5-В', a: '5', b: 'В', L: 150, area: 0 }
    ]
  });

  // логика расчёта текстом (для отладки, печати и тестов)
  const KIND = { norm: 'норма', method: 'методика', assume: 'допущение', input: 'исходные данные', calc: 'расчёт' };
  function explain(steps) {
    return steps.map((s, k) => `${k + 1}. ${s.t}: ${s.s}${s.u ? ' ' + s.u : ''} [${KIND[s.kind] || s.kind}${s.ref ? '; ' + (DOCS[s.ref.doc] || s.ref.doc) + ', ' + s.ref.where + (s.ref.page ? ', с. ' + s.ref.page : '') : ''}]`).join('\n');
  }

  const api = { DOCS, REF: R, ASSUMPTIONS, MATERIALS, DIAMETERS, TB1, A3_SUSPECT, geom, viscosity, pavlovsky, sp399, flow, fillFor, kTable, qAdditional, table2, slopeNorm, dMin,
    wellSpacing, frostDepth, minInvertDepth, selfCleanSlope, solve, example, explain, tracer };
  root.SeshatSewer = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
