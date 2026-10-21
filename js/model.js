// Расчётная модель: коэффициентная модель очистки с балансами азота, фосфора и органики.
// Чистые функции без обращения к странице, поэтому их можно тестировать в Node.
(function (root) {
  const D = root.SeshatData || (typeof require !== 'undefined' ? require('./data.js') : null);

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
   * @param {{q:number, c:Object, steps:{u:string, eff:Object}[]}} input
   * @returns {{prof:Object[], warns:string[][], perStep:Object[], energy:number, sludge:number}}
   *   prof — концентрации на входе и после каждой ступени; energy — кВт·ч/м³; sludge — кг сухого вещества в сутки
   */
  function simulate(input, data) {
    data = data || D;
    const PK = data.PARAMS.map(p => p.k);
    const U = Object.fromEntries(data.UNITS.map(u => [u.id, u]));
    const c = {};
    PK.forEach(k => (c[k] = Math.max(0, +input.c[k] || 0)));
    const prof = [{ ...c }], warns = [], before = [], perStep = [];
    let energy = 0, sludge = 0;

    input.steps.forEach(st => {
      const u = U[st.u], e = st.eff, cin = { ...c }, w = [];
      let sl = 0; // осадок ступени, г сухого вещества на 1 м³

      // Проверки применимости технологии
      if (u.bio) {
        if (cin.bod > 0 && cin.cod / cin.bod > 3) w.push(`Стоки трудно биоразлагаемы: ХПК/БПК₅ = ${fmt(cin.cod / cin.bod)} (норма ≤ 2,5–3).`);
        if (cin.oil > 20) w.push(`Нефтепродукты на входе ${fmt(cin.oil)} мг/л угнетают активный ил; нужна нефтеловушка или флотация до биологии.`);
        if (cin.fat > 100) w.push(`Жиры ${fmt(cin.fat)} мг/л на входе в биологию; поставьте жироуловитель или флотацию.`);
        if (cin.bod < 40) w.push('Мало органики для устойчивой работы активного ила.');
        if (!u.anaer && before.some(b => U[b].bio && !U[b].anaer)) w.push('Это вторая аэробная биологическая ступень подряд; проверьте, нужна ли она.');
        if (u.id === 'uasb' && cin.bod < 800) w.push(`UASB рассчитан на концентрированные стоки (БПК₅ от ~1 000 мг/л), здесь ${fmt(cin.bod)} мг/л: эффект будет слабым.`);
        if (u.id === 'uasb' && !input.steps.slice(input.steps.indexOf(st) + 1).some(x => U[x.u].bio && !U[x.u].anaer)) w.push('После анаэробного реактора нужна аэробная доочистка: на выходе остаётся органика и весь азот.');
        if (u.id === 'wetland' && input.q > 2000) w.push(`Биоплато занимает 3–5 м² на 1 м³/сут; для ${fmt(input.q)} м³/сут это очень большая площадь. Обычно его используют для малых посёлков или как доочистку.`);
        if (u.id === 'baf' && cin.ss > 150) w.push(`Биофильтр BAF забивается взвесью (${fmt(cin.ss)} мг/л); перед ним нужны первичные или ламельные отстойники.`);
      }
      if (u.id === 'mbr' && !before.includes('screens') && !before.includes('drum')) w.push('Перед МБР нужны тонкие решётки или барабанные сита (≤ 2–3 мм) для защиты мембран.');
      if (u.id === 'anammox' && cin.nh4 < 100) w.push(`Анаммокс применяют для потоков с высоким аммонием (фугат, промстоки, обычно > 300 мг N/л); при ${fmt(cin.nh4)} мг/л он неэффективен.`);
      if (u.id === 'strip' && cin.nh4 < 200) w.push(`Аммиачную отдувку применяют при аммонии выше ~200 мг N/л; при ${fmt(cin.nh4)} мг/л дешевле биологическая нитри-денитрификация.`);
      if (u.id === 'hypo' && cin.nh4 > 2) w.push(`Аммоний ${fmt(cin.nh4)} мг/л связывает хлор в хлорамины, расход гипохлорита вырастет.`);
      if (u.id === 'hypo') w.push('Остаточный хлор токсичен для рыб: при сбросе в рыбохозяйственный водоём нужна дехлорация.');
      if ((u.id === 'ix' || u.id === 'uf') && cin.ss > 10) w.push(`${u.id === 'ix' ? 'Ионообменные смолы' : 'Мембраны ультрафильтрации'} забиваются взвесью (${fmt(cin.ss)} мг/л); поставьте перед ними фильтры.`);
      if (u.id === 'neutral') w.push('pH в модели не рассчитывается: ступень показана для полноты схемы промышленных стоков.');
      if (u.id === 'ro' && cin.ss > 5) w.push(`На вход обратного осмоса нужно ВВ < 5 мг/л, сейчас ${fmt(cin.ss)}.`);
      if (u.id === 'gac' && cin.ss > 15) w.push(`Уголь быстро забьётся взвесью (${fmt(cin.ss)} мг/л); поставьте фильтры перед ним.`);
      if (u.id === 'filter' && cin.ss > 60) w.push(`Фильтры перегружены взвесью (${fmt(cin.ss)} мг/л); обычно их ставят после отстаивания.`);
      if (u.id === 'uv' && cin.ss > 15) w.push(`Взвесь ${fmt(cin.ss)} мг/л снижает эффективность УФ; желательно < 10 мг/л.`);
      if (u.id === 'denf') w.push('Требуется дозирование внешнего углерода (метанол, ацетат), это расход реагента.');

      // Прямое снижение концентраций
      PK.forEach(k => { if (e[k] != null) c[k] *= 1 - Math.min(100, Math.max(0, e[k])) / 100; });

      if (u.bio) {
        const dB = Math.max(0, cin.bod - c.bod);
        // Ассимиляция биогенов приростом ила: ~5% N и ~1% P от снятого БПК
        const aN = Math.min(c.nh4, 0.05 * dB); c.nh4 -= aN;
        const aP = Math.min(c.p, 0.01 * dB); c.p -= aP;
        if (e.nit) { const n = c.nh4 * e.nit / 100; c.nh4 -= n; c.no3 += n * 0.98; c.no2 += n * 0.02; }
        if (e.den) {
          // Денитрификации нужно ≈ 4 мг БПК₅ на 1 мг N
          const tot = c.no3 + c.no2, need = tot * e.den / 100, cap = cin.bod / 4, got = Math.min(need, cap);
          if (got < need - 0.5) w.push(`Не хватает органики для денитрификации: удалено ${fmt(got)} из ${fmt(need)} мг N/л. Нужен внешний углерод или обход первичных отстойников.`);
          if (tot > 0) { const f = got / tot; c.no3 *= 1 - f; c.no2 *= 1 - f; }
        }
        if (e.bioP) {
          if (cin.p > 0 && cin.bod / cin.p < 20) w.push(`Для биоудаления фосфора мало органики: БПК₅/P = ${fmt(cin.bod / cin.p)} (нужно ≥ 20).`);
          c.p *= 1 - e.bioP / 100;
        }
        if (u.ssOut != null) c.ss = Math.min(c.ss, u.ssOut);
        sl += (u.yield ?? 0.6) * dB; // прирост ила, г/м³ (анаэробный и продлённая аэрация — меньше)
      }
      c.cod = Math.max(c.cod, c.bod);
      sl += Math.max(0, cin.ss - c.ss) * (u.bio ? 0 : 1) + (u.chem ? 5 * Math.max(0, cin.p - c.p) : 0);
      sludge += sl;
      energy += u.en;
      perStep.push({
        en: u.en,                                          // кВт·ч/м³
        sludge: sl * input.q / 1000,                       // кг сухого вещества в сутки
        dP: Math.max(0, cin.p - c.p),                      // удалено фосфора, мг/л
        dNOx: Math.max(0, cin.no3 + cin.no2 - c.no3 - c.no2) // удалено азота нитратов и нитритов, мг/л
      });
      before.push(u.id);
      prof.push({ ...c });
      warns.push(w);
    });

    return { prof, warns, perStep, energy, sludge: sludge * input.q / 1000 };
  }

  root.SeshatModel = { simulate, fmt };
  if (typeof module !== 'undefined') module.exports = root.SeshatModel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
