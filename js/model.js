// Расчётная модель: коэффициентная модель очистки с балансами азота, фосфора и органики.
// Чистые функции без обращения к странице, поэтому их можно тестировать в Node.
(function (root) {
  const D = root.SeshatData || (typeof require !== 'undefined' ? require('./data.js') : null);
  const G = root.SeshatGraph || (typeof require !== 'undefined' ? require('./graph.js') : null);

  function fmt(v) {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 100) return Math.round(v).toLocaleString('ru-RU');
    if (a >= 10) return v.toFixed(1).replace('.', ',');
    if (a >= 1) return v.toFixed(2).replace('.', ',');
    return v.toFixed(3).replace('.', ',');
  }

  /**
   * Рассчитать схему.
   * Ступени могут быть соединены параллельно (см. graph.js): на входе ступени потоки смешиваются по расходу.
   * @param {{q:number, c:Object, steps:{u:string, eff:Object, to?:number[]}[]}} input
   * @returns {{prof:Object[], cin:Object[], out:Object, f:number[], warns:string[][], perStep:Object[], energy:number, sludge:number}}
   *   prof — исходные стоки и выход каждой ступени; cin — вход каждой ступени; out — смесь на выпуске;
   *   f — доля общего расхода через ступень; energy — кВт·ч на 1 м³ стоков; sludge — кг сухого вещества в сутки
   */
  function simulate(input, data) {
    data = data || D;
    const PK = data.PARAMS.map(p => p.k);
    const U = Object.fromEntries(data.UNITS.map(u => [u.id, u]));
    const steps = G.norm(input.steps), fl = G.flows(steps), anc = G.ancestors(steps);
    const raw = {};
    PK.forEach(k => (raw[k] = Math.max(0, +input.c[k] || 0)));
    const mix = parts => { const o = {}, tot = parts.reduce((s, [w]) => s + w, 0); PK.forEach(k => { o[k] = tot > 0 ? parts.reduce((s, [w, c]) => s + w * c[k], 0) / tot : 0; }); return o; };
    const prof = [{ ...raw }], cin = [], warns = [], perStep = [];
    let energy = 0, sludge = 0;

    steps.forEach((st, si) => {
      const parts = fl.src[si] > 0 ? [[fl.src[si], raw]] : [];
      fl.edges.forEach(e => { if (e.b === si) parts.push([e.f, prof[e.a + 1]]); });
      const c = mix(parts), fi = fl.f[si], before = [...anc[si]].map(j => steps[j].u);
      const later = steps.filter((_, j) => anc[j].has(si));
      const u = U[st.u], e = st.eff, w = [];
      if (st.idle) { // не подключено трубами: вода через сооружение не идёт
        cin.push({ ...raw }); prof.push({ ...raw }); warns.push(['Сооружение не подключено: проведите к нему трубу, чтобы оно заработало.']);
        perStep.push({ en: u.en, f: 0, q: 0, sludge: 0, dP: 0, dNOx: 0, idle: true });
        return;
      }
      cin.push({ ...c }); const ci = cin[si];
      let sl = 0; // осадок ступени, г сухого вещества на 1 м³

      // Проверки применимости технологии
      if (u.bio) {
        if (ci.bod > 0 && ci.cod / ci.bod > 3) w.push(`Стоки трудно биоразлагаемы: ХПК/БПК₅ = ${fmt(ci.cod / ci.bod)} (норма ≤ 2,5–3).`);
        if (ci.oil > 20) w.push(`Нефтепродукты на входе ${fmt(ci.oil)} мг/л угнетают активный ил; нужна нефтеловушка или флотация до биологии.`);
        if (ci.fat > 100) w.push(`Жиры ${fmt(ci.fat)} мг/л на входе в биологию; поставьте жироуловитель или флотацию.`);
        if (ci.bod < 40) w.push('Мало органики для устойчивой работы активного ила.');
        if (!u.anaer && before.some(b => U[b].bio && !U[b].anaer)) w.push('Это вторая аэробная биологическая ступень подряд; проверьте, нужна ли она.');
        if (u.id === 'uasb' && ci.bod < 800) w.push(`UASB рассчитан на концентрированные стоки (БПК₅ от ~1 000 мг/л), здесь ${fmt(ci.bod)} мг/л: эффект будет слабым.`);
        if (u.id === 'uasb' && !later.some(x => U[x.u].bio && !U[x.u].anaer)) w.push('После анаэробного реактора нужна аэробная доочистка: на выходе остаётся органика и весь азот.');
        if (u.id === 'wetland' && input.q * fi > 2000) w.push(`Биоплато занимает 3–5 м² на 1 м³/сут; для ${fmt(input.q * fi)} м³/сут это очень большая площадь. Обычно его используют для малых посёлков или как доочистку.`);
        if (u.id === 'baf' && ci.ss > 150) w.push(`Биофильтр BAF забивается взвесью (${fmt(ci.ss)} мг/л); перед ним нужны первичные или ламельные отстойники.`);
      }
      if (u.id === 'mbr' && !before.includes('screens') && !before.includes('drum')) w.push('Перед МБР нужны тонкие решётки или барабанные сита (≤ 2–3 мм) для защиты мембран.');
      if (u.id === 'anammox' && ci.nh4 < 100) w.push(`Анаммокс применяют для потоков с высоким аммонием (фугат, промстоки, обычно > 300 мг N/л); при ${fmt(ci.nh4)} мг/л он неэффективен.`);
      if (u.id === 'strip' && ci.nh4 < 200) w.push(`Аммиачную отдувку применяют при аммонии выше ~200 мг N/л; при ${fmt(ci.nh4)} мг/л дешевле биологическая нитри-денитрификация.`);
      if (u.id === 'hypo' && ci.nh4 > 2) w.push(`Аммоний ${fmt(ci.nh4)} мг/л связывает хлор в хлорамины, расход гипохлорита вырастет.`);
      if (u.id === 'hypo') w.push('Остаточный хлор токсичен для рыб: при сбросе в рыбохозяйственный водоём нужна дехлорация.');
      if ((u.id === 'ix' || u.id === 'uf') && ci.ss > 10) w.push(`${u.id === 'ix' ? 'Ионообменные смолы' : 'Мембраны ультрафильтрации'} забиваются взвесью (${fmt(ci.ss)} мг/л); поставьте перед ними фильтры.`);
      if (u.id === 'neutral') w.push('pH в модели не рассчитывается: ступень показана для полноты схемы промышленных стоков.');
      if (u.id === 'ro' && ci.ss > 5) w.push(`На вход обратного осмоса нужно ВВ < 5 мг/л, сейчас ${fmt(ci.ss)}.`);
      if (u.id === 'gac' && ci.ss > 15) w.push(`Уголь быстро забьётся взвесью (${fmt(ci.ss)} мг/л); поставьте фильтры перед ним.`);
      if (u.id === 'filter' && ci.ss > 60) w.push(`Фильтры перегружены взвесью (${fmt(ci.ss)} мг/л); обычно их ставят после отстаивания.`);
      if (u.id === 'uv' && ci.ss > 15) w.push(`Взвесь ${fmt(ci.ss)} мг/л снижает эффективность УФ; желательно < 10 мг/л.`);
      if (u.id === 'nitf' && ci.nh4 > 5) w.push(`Биофильтры доочистки рассчитаны на остаточный аммоний после основной биологии; при ${fmt(ci.nh4)} мг/л нитрификацию нужно вести в аэротенках (ИТС 10-2019, с. 98–99).`);
      if (u.id === 'nitf' && !later.some(x => ['filter', 'disc', 'uf'].includes(x.u))) w.push('Биофильтры доочистки, как правило, не снижают взвесь: после них ставят фильтры (ИТС 10-2019, с. 99).');
      if (u.id === 'denf') w.push('Требуется дозирование внешнего углерода (метанол, ацетат), это расход реагента.');

      // Прямое снижение концентраций
      PK.forEach(k => { if (e[k] != null) c[k] *= 1 - Math.min(100, Math.max(0, e[k])) / 100; });

      if (u.bio) {
        const dB = Math.max(0, ci.bod - c.bod);
        // Ассимиляция биогенов приростом ила: ~5% N и ~1% P от снятого БПК
        const aN = Math.min(c.nh4, 0.05 * dB); c.nh4 -= aN;
        const aP = Math.min(c.p, 0.01 * dB); c.p -= aP;
        if (e.nit) { const n = c.nh4 * e.nit / 100; c.nh4 -= n; c.no3 += n * 0.98; c.no2 += n * 0.02; }
        if (e.den) {
          // Денитрификации нужно ≈ 4 мг БПК₅ на 1 мг N
          const tot = c.no3 + c.no2, need = tot * e.den / 100, cap = ci.bod / 4, got = Math.min(need, cap);
          if (got < need - 0.5) w.push(`Не хватает органики для денитрификации: удалено ${fmt(got)} из ${fmt(need)} мг N/л. Нужен внешний углерод или обход первичных отстойников.`);
          if (tot > 0) { const f = got / tot; c.no3 *= 1 - f; c.no2 *= 1 - f; }
        }
        if (e.bioP) {
          if (ci.p > 0 && ci.bod / ci.p < 20) w.push(`Для биоудаления фосфора мало органики: БПК₅/P = ${fmt(ci.bod / ci.p)} (нужно ≥ 20).`);
          c.p *= 1 - e.bioP / 100;
        }
        if (u.ssOut != null) c.ss = Math.min(c.ss, u.ssOut);
        sl += (u.yield ?? 0.6) * dB; // прирост ила, г/м³ (анаэробный и продлённая аэрация — меньше)
      }
      // Нитрификация в биофильтрах доочистки (биология без активного ила)
      if (!u.bio && e.nit) { const n = c.nh4 * e.nit / 100; c.nh4 -= n; c.no3 += n * 0.95; c.no2 += n * 0.05; }
      c.cod = Math.max(c.cod, c.bod);
      sl += Math.max(0, ci.ss - c.ss) * (u.bio ? 0 : 1) + (u.chem ? 5 * Math.max(0, ci.p - c.p) : 0);
      sludge += sl * fi;
      energy += u.en * fi;
      perStep.push({
        en: u.en,                                          // кВт·ч/м³
        f: fi,                                             // доля общего расхода
        q: input.q * fi,                                   // расход через ступень, м³/сут
        sludge: sl * input.q * fi / 1000,                  // кг сухого вещества в сутки
        dP: Math.max(0, ci.p - c.p),                      // удалено фосфора, мг/л
        dNOx: Math.max(0, ci.no3 + ci.no2 - c.no3 - c.no2) // удалено азота нитратов и нитритов, мг/л
      });
      prof.push({ ...c });
      warns.push(w);
    });

    // убираем погрешность двоичной арифметики (2,100000000000002 → 2,1), чтобы сравнение с нормативом было честным
    const tidy = o => { PK.forEach(k => { o[k] = +(+o[k]).toPrecision(12); }); return o; };
    prof.forEach(tidy);
    const out = tidy(steps.length ? mix(fl.sinks.map(i => [fl.f[i], prof[i + 1]])) : { ...raw });
    return { prof, cin, out, f: fl.f, warns, perStep, energy, sludge: sludge * input.q / 1000 };
  }

  root.SeshatModel = { simulate, fmt };
  if (typeof module !== 'undefined') module.exports = root.SeshatModel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
