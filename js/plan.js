// Генплан: размеры сооружений в плане и их раскладка по ходу очистки.
// Площади — ориентировочные, по типовым удельным нагрузкам (время пребывания, гидравлическая нагрузка).
// Как работает сооружение и откуда цифры — в статьях базы знаний content/kb/units/<id>.md.
(function (root) {
  const G = root.SeshatGraph || (typeof require !== 'undefined' ? require('./graph.js') : null);
  // kind — как рисовать в плане: tank (резервуар), clar (радиальные отстойники), bld (здание),
  //        cells (фильтры-ячейки), cols (колонны), sbr (несколько реакторов), channel (канал)
  // a — м² на 1 м³/сут; min — минимальная площадь, м²; ratio — длина/ширина;
  // zones — доли зон резервуара
  const PLAN = {
    screens: { kind: 'bld', a: 0.004, min: 48, ratio: 1.6, label: 'Решётки' },
    sand: { kind: 'tank', a: 0.006, min: 36, ratio: 6, lines: 2, label: 'Песколовки', aer: true },
    grease: { kind: 'tank', a: 0.01, min: 24, ratio: 3, label: 'Жироуловитель', baffle: true },
    primary: { kind: 'clar', a: 0.028, min: 60, label: 'Первичные отстойники' },
    daf: { kind: 'tank', a: 0.015, min: 24, ratio: 2.5, label: 'Флотатор', float: true },
    at: { kind: 'tank', a: 0.067, min: 60, ratio: 3, label: 'Аэротенк', zones: [['АЭР', 1]] },
    mle: { kind: 'tank', a: 0.1, min: 80, ratio: 3, label: 'Аэротенк Д-Н', zones: [['АКС', 0.35], ['АЭР', 0.65]] },
    a2o: { kind: 'tank', a: 0.117, min: 90, ratio: 3, label: 'Аэротенк A²/O', zones: [['АН', 0.12], ['АКС', 0.28], ['АЭР', 0.6]] },
    sbr: { kind: 'sbr', a: 0.15, min: 80, ratio: 1.5, label: 'Реакторы SBR' },
    mbbr: { kind: 'tank', a: 0.042, min: 40, ratio: 2.5, label: 'Биореактор МББР', zones: [['МББР', 1]], carrier: true },
    mbr: { kind: 'tank', a: 0.058, min: 50, ratio: 2.5, label: 'Мембранный биореактор', zones: [['АЭР', 0.7], ['МБР', 0.3]] },
    sec: { kind: 'clar', a: 0.045, min: 60, label: 'Вторичные отстойники' },
    denf: { kind: 'cells', a: 0.012, min: 40, ratio: 2, label: 'Денитрификаторы' },
    filter: { kind: 'cells', a: 0.008, min: 36, ratio: 2, label: 'Песчаные фильтры' },
    gac: { kind: 'cols', a: 0.012, min: 30, ratio: 2.5, label: 'Угольные адсорберы' },
    ozone: { kind: 'tank', a: 0.006, min: 36, ratio: 2, label: 'Озонирование', zones: [['O₃', 1]], aer: true },
    ro: { kind: 'bld', a: 0.006, min: 60, ratio: 1.8, label: 'Обратный осмос' },
    uv: { kind: 'channel', a: 0.002, min: 30, ratio: 3, label: 'УФ-обеззараживание' },
    // ---- расширенный каталог ----
    coarse: { kind: 'channel', a: 0.0015, min: 24, ratio: 3, label: 'Грубые решётки' },
    drum: { kind: 'bld', a: 0.002, min: 30, ratio: 1.5, label: 'Сита' },
    sandv: { kind: 'cols', a: 0.002, min: 20, ratio: 2, label: 'Тангенциальные песколовки' },
    equal: { kind: 'tank', a: 0.06, min: 40, ratio: 2, label: 'Усреднитель', zones: [['АКС', 1]] },
    lamella: { kind: 'tank', a: 0.01, min: 24, ratio: 2, label: 'Ламельные отстойники', lamella: true },
    coag: { kind: 'tank', a: 0.03, min: 30, ratio: 3, label: 'Реагентное осветление', zones: [['СМ', 0.15], ['ФЛ', 0.25], ['ОТС', 0.6]] },
    neutral: { kind: 'tank', a: 0.01, min: 20, ratio: 2, label: 'Нейтрализация', zones: [['pH', 1]] },
    strip: { kind: 'cols', a: 0.004, min: 30, ratio: 2, label: 'Отдувочные колонны' },
    oxid: { kind: 'ditch', a: 0.2, min: 120, ratio: 2.4, label: 'Окислительный канал' },
    bardenpho: { kind: 'tank', a: 0.15, min: 120, ratio: 3.5, label: 'Bardenpho', zones: [['АН', 0.08], ['АКС', 0.25], ['АЭР', 0.4], ['АКС', 0.15], ['АЭР', 0.12]] },
    ifas: { kind: 'tank', a: 0.05, min: 50, ratio: 2.5, label: 'Аэротенк IFAS', zones: [['АКС', 0.3], ['МББР', 0.7]], carrier: true },
    ags: { kind: 'sbr', a: 0.06, min: 60, ratio: 1.5, label: 'Реакторы AGS', reactor: 'AGS' },
    tf: { kind: 'clar', a: 0.1, min: 60, label: 'Биофильтры' },
    baf: { kind: 'cells', a: 0.015, min: 40, ratio: 2, label: 'Биофильтры BAF' },
    nitf: { kind: 'cells', a: 0.008, min: 30, ratio: 2, label: 'Биофильтры доочистки' },
    uasb: { kind: 'tank', a: 0.05, min: 40, ratio: 1.5, label: 'Реактор UASB', zones: [['UASB', 1]] },
    anammox: { kind: 'tank', a: 0.01, min: 30, ratio: 2, label: 'Анаммокс', zones: [['АММ', 1]], carrier: true },
    wetland: { kind: 'wetland', a: 4, min: 200, ratio: 2, label: 'Биоплато' },
    disc: { kind: 'cells', a: 0.004, min: 24, ratio: 2, label: 'Дисковые фильтры' },
    uf: { kind: 'bld', a: 0.004, min: 40, ratio: 1.6, label: 'Ультрафильтрация' },
    aop: { kind: 'tank', a: 0.004, min: 24, ratio: 2, label: 'Окисление AOP', aer: true, zones: [['AOP', 1]] },
    ix: { kind: 'cols', a: 0.004, min: 30, ratio: 2, label: 'Ионообменные фильтры' },
    hypo: { kind: 'tank', a: 0.008, min: 30, ratio: 3, label: 'Контактный резервуар', baffle: true, zones: [['Cl', 1]] }
  };

  const GAP = 12;          // расстояние между сооружениями, м
  // вспомогательные здания: when(opts, steps) — когда здание нужно (без when — на любом генплане)
  const AUX = [
    { id: 'reag', label: 'Реагентное хозяйство', a: 0.002, min: 48, ratio: 1.5, when: (o, st) => st.some(s => s.dose) },
    { id: 'thick', label: 'Уплотнители ила', a: 0.004, min: 60, ratio: 1, when: o => o.sludge && o.sludge.stab !== 'none' },
    { id: 'digest', label: 'Метантенки', a: 0.02, min: 150, ratio: 1, when: o => o.sludge && o.sludge.stab === 'digest' },
    { id: 'aerostab', label: 'Аэробные стабилизаторы', a: 0.02, min: 100, ratio: 2.5, when: o => o.sludge && o.sludge.stab === 'aerobic' },
    { id: 'reject', label: 'Очистка фугата', a: 0.002, min: 40, ratio: 2, when: o => o.sludge && o.sludge.reject && o.sludge.reject !== 'none' },
    { id: 'sludge', label: 'Цех обезвоживания осадка', a: 0.003, min: 150, ratio: 1.6 },
    { id: 'abk', label: 'Административно-бытовой корпус', a: 0, min: 240, ratio: 2 }
  ];

  const round = v => Math.round(v * 10) / 10;
  function rect(area, ratio) { const w = Math.sqrt(area / ratio); return { w: round(area / w), h: round(w) }; }

  /** Размеры одной ступени в плане: основной блок + вторичные отстойники. */
  function unitSize(id, q) {
    const p = PLAN[id];
    const area = Math.max(p.min, p.a * q);
    const out = { id, area, parts: [] };
    if (p.kind === 'clar') {
      out.parts.push(clarifiers(area));
    } else {
      out.parts.push({ kind: p.kind, area, ...rect(area, p.ratio || 2) });
    }
    // общий габарит: части друг под другом, по ширине — максимальная
    out.w = Math.max(...out.parts.map(x => x.w));
    out.h = out.parts.reduce((s, x) => s + x.h, 0) + GAP * 0.6 * (out.parts.length - 1);
    return out;
  }
  function clarifiers(area, label) {
    const maxD = 40, n = Math.min(8, Math.max(2, Math.ceil(area / (Math.PI * (maxD / 2) ** 2))));
    const d = Math.max(6, round(Math.sqrt(4 * area / n / Math.PI)));
    const cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), g = Math.max(3, d * 0.2);
    return { kind: 'clar', n, d, cols, rows, area, label, w: round(cols * d + (cols - 1) * g), h: round(rows * d + (rows - 1) * g), g };
  }

  /**
   * Раскладка генплана. Ступени одной «колонки» схемы (параллельные линии) стоят друг под другом,
   * колонки идут по ходу воды «змейкой»; ниже — цех обезвоживания и АБК.
   * Если у ступени есть сохранённое место (x, y), она стоит там, где её поставил пользователь.
   * @param {number} q — расход станции, м³/сут
   * @param {(string|Object)[]} input — id технологий (последовательная схема) или ступени схемы
   * @returns {{blocks:Object[], aux:Object[], pipes:number[][][], edges:Object[], site:{w,h}, area:{structures,site}}}
   */
  function layout(q, input, opts) {
    const aspect = opts && opts.aspect > 0 ? opts.aspect : 1.6; // ширина/высота экрана: под узкий экран — больше рядов
    const steps = G.norm(input.map(s => typeof s === 'string' ? { u: s, eff: {} } : s));
    const fl = G.flows(steps), dep = G.depth(steps);
    const sizes = steps.map((s, i) => ({ ...unitSize(s.u, s.idle ? q : q * fl.f[i]), index: i, f: fl.f[i], idle: !!s.idle }));
    const margin = 22; // от ограды до сооружений (с учётом проезда)

    // автоматическая раскладка: колонки по глубине, колонки — рядами «змейкой»
    const layers = [];
    sizes.forEach((b, i) => { if (!b.idle) (layers[dep[i]] = layers[dep[i]] || []).push(b); });
    const cols = layers.filter(Boolean).map(list => ({ list, w: Math.max(...list.map(b => b.w)), h: list.reduce((s, b) => s + b.h, 0) + GAP * 1.2 * (list.length - 1) }));
    const total = cols.reduce((s, c) => s + c.w, 0) + GAP * Math.max(0, cols.length - 1);
    const maxH = Math.max(20, ...cols.map(c => c.h));
    const rowW = Math.max(120, Math.min(total, Math.sqrt(total * maxH) * 2.2 * Math.sqrt(Math.min(2.5, Math.max(0.4, aspect)) / 1.6)));
    const rows = [[]]; let x = 0;
    cols.forEach(c => { if (x > 0 && x + c.w > rowW) { rows.push([]); x = 0; } rows[rows.length - 1].push(c); x += c.w + GAP; });
    const auto = []; let y = margin;
    rows.forEach((row, ri) => {
      if (!row.length) return;
      const h = Math.max(...row.map(c => c.h)), w = row.reduce((s, c) => s + c.w, 0) + GAP * (row.length - 1);
      let cx = 0;
      row.forEach(c => {
        const colX = ri % 2 === 1 ? w - cx - c.w : cx; // обратный ход в нечётных рядах
        let yy = y + (h - c.h) / 2;
        c.list.forEach(b => { auto[b.index] = { x: margin + colX + (c.w - b.w) / 2, y: yy, row: ri }; yy += b.h + GAP * 1.2; });
        cx += c.w + GAP;
      });
      y += h + GAP * 2.2;
    });
    // неподключённые сооружения — отдельным рядом под схемой
    let ix = margin;
    sizes.forEach((b, i) => { if (b.idle) { auto[i] = { x: ix, y, row: rows.length }; ix += b.w + GAP; } });

    // сохранённые места; ступени без места — отдельным рядом ниже
    const placed = steps.map((s, i) => s.x != null ? { x: s.x, y: s.y, row: 0, fixed: true } : null);
    const anyFixed = placed.some(Boolean);
    if (anyFixed) {
      const bottom = Math.max(...placed.map((p, i) => p ? p.y + sizes[i].h : -Infinity));
      let nx = margin; const ny = bottom + GAP * 1.5;
      sizes.forEach((b, i) => { if (!placed[i]) { placed[i] = { x: nx, y: ny, row: 1 }; nx += b.w + GAP; } });
    }
    const blocks = sizes.map((b, i) => ({ ...b, ...(anyFixed ? placed[i] : auto[i]) }));
    // всё, что вытащили за левый или верхний край, сдвигаем внутрь участка
    if (blocks.length) {
      const dx = Math.max(0, margin - Math.min(...blocks.map(b => b.x))), dy = Math.max(0, margin - Math.min(...blocks.map(b => b.y)));
      blocks.forEach(b => { b.x += dx; b.y += dy; });
    }
    blocks.forEach(b => { b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2; });
    const right = blocks.length ? Math.max(...blocks.map(b => b.x + b.w)) : margin;
    const auxY = (blocks.length ? Math.max(...blocks.map(b => b.y + b.h)) : margin) + GAP * 2.2;
    let ax = margin;
    const aux = AUX.filter(a => !a.when || a.when(opts || {}, steps)).map(a => { const area = Math.max(a.min, a.a * q), r = rect(area, a.ratio); const o = { ...a, area, ...r, x: ax, y: auxY }; ax += r.w + GAP * 2; return o; });
    const auxH = Math.max(...aux.map(a => a.h));
    const site = { w: round(Math.max(right, ax - GAP * 2) + margin), h: round(auxY + auxH + margin) };
    const edges = fl.edges.map(e => ({ ...e, pts: route(blocks[e.a], blocks[e.b], site.w / 2, blocks) }));
    const structures = sizes.reduce((s, b) => s + b.area, 0) + aux.reduce((s, a) => s + a.area, 0);
    return { blocks, aux, edges, pipes: edges.map(e => e.pts), site, area: { structures, site: site.w * site.h }, sources: blocks.filter((_, i) => fl.src[i] > 0), sinks: fl.sinks.map(i => blocks[i]), steps };
  }

  /** Уровень воды в сооружении для рисования трубы: середина первой части */
  const flowY = b => b.y + b.parts[0].h / 2;
  /** Трасса трубы от выхода сооружения a ко входу сооружения b (ломаная из прямых участков).
   *  Если прямая трасса проходит сквозь другие сооружения, труба обходит их сверху или снизу. */
  function route(a, b, mid, blocks) {
    const ya = flowY(a), yb = flowY(b), ax2 = a.x + a.w, bx2 = b.x + b.w, g = GAP * 0.45;
    const others = (blocks || []).filter(o => o !== a && o !== b);
    const hits = pts => others.some(o => pts.slice(1).some((p, k) => {
      const [x1, y1] = pts[k], [x2, y2] = p;
      const lx = Math.min(x1, x2), hx = Math.max(x1, x2), ly = Math.min(y1, y2), hy = Math.max(y1, y2);
      return lx < o.x + o.w - 0.5 && hx > o.x + 0.5 && ly < o.y + o.h - 0.5 && hy > o.y + 0.5;
    }));
    const z = (x1, x2) => { const mx = (x1 + x2) / 2; return Math.abs(ya - yb) < 0.05 ? [[x1, ya], [x2, yb]] : [[x1, ya], [mx, ya], [mx, yb], [x2, yb]]; };
    let pts, fwd = null;
    if (b.x >= ax2 + 2) { pts = z(ax2, b.x); fwd = [ax2 + g, b.x - g]; }
    else if (bx2 <= a.x - 2) { pts = z(a.x, bx2); fwd = [a.x - g, bx2 + g]; }
    else if (a.cx >= mid) { const t = Math.max(ax2, bx2) + GAP * 0.8; pts = [[ax2, ya], [t, ya], [t, yb], [bx2, yb]]; }
    else { const t = Math.min(a.x, b.x) - GAP * 0.8; pts = [[a.x, ya], [t, ya], [t, yb], [b.x, yb]]; }
    if (!fwd || !hits(pts)) return pts;
    // обход: над или под сооружениями, которые лежат между a и b
    const lo = Math.min(fwd[0], fwd[1]), hi = Math.max(fwd[0], fwd[1]);
    const between = others.filter(o => o.x < hi && o.x + o.w > lo);
    const top = Math.min(a.y, b.y, ...between.map(o => o.y)) - g, bot = Math.max(a.y + a.h, b.y + b.h, ...between.map(o => o.y + o.h)) + g;
    const via = y => [pts[0], [fwd[0], ya], [fwd[0], y], [fwd[1], y], [fwd[1], yb], pts[pts.length - 1]];
    const up = via(top), down = via(bot);
    if (!hits(up)) return up;
    if (!hits(down)) return down;
    return up;
  }

  root.SeshatPlan = { PLAN, layout, route, flowY, unitSize, GAP };
  if (typeof module !== 'undefined') module.exports = root.SeshatPlan;
})(typeof globalThis !== 'undefined' ? globalThis : this);
