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
   * Ступень: { u, eff, to?, dose? } — dose: 'fe' | 'al', ввод коагулянта для удаления фосфора в это сооружение (data.DOSE).
   * input.sludge — линия осадка { stab: 'none'|'aerobic'|'digest', reject: 'none'|'anammox'|'strip' } (data.SLUDGE):
   * возвратный поток от обезвоживания (фугат) возвращается в начало станции, расчёт повторяется до сходимости.
   * @returns {{prof:Object[], cin:Object[], out:Object, f:number[], warns:string[][], perStep:Object[], energy:number, sludge:number, reject:Object}}
   *   prof — исходные стоки (без возвратных потоков) и выход каждой ступени; cin — вход каждой ступени; out — смесь на выпуске;
   *   f — доля общего расхода через ступень; energy — кВт·ч на 1 м³ стоков; sludge — кг сухого вещества в сутки (до стабилизации);
   *   reject — возвратный поток: объём, нагрузки и прибавка к концентрациям на входе
   */
  function simulate(input, data) {
    data = data || D;
    const PK = data.PARAMS.map(p => p.k);
    const U = Object.fromEntries(data.UNITS.map(u => [u.id, u]));
    const steps = G.norm(input.steps), fl = G.flows(steps), anc = G.ancestors(steps);
    const raw = {};
    PK.forEach(k => (raw[k] = Math.max(0, +input.c[k] || 0)));
    const q = Math.max(0, +input.q || 0);
    const SL = data.SLUDGE, line = { stab: 'none', reject: 'none', ...(input.sludge || {}) };
    const stab = (SL && SL.stab[line.stab]) || null, rejT = (SL && SL.reject[line.reject]) || null;
    const bioP = steps.some(s => !s.idle && U[s.u] && U[s.u].eff.bioP);
    const add = { nh4: 0, no3: 0, p: 0, ss: 0 };
    let r = null, reject = null;
    // фугат зависит от количества осадка, а осадок — от нагрузки с фугатом: несколько проходов до сходимости
    for (let it = 0; it < (SL && steps.length ? 6 : 1); it++) {
      const inflow = { ...raw }; Object.keys(add).forEach(k => { inflow[k] += add[k]; });
      r = pass(inflow);
      if (!SL || !q || !stab) break;
      const ds = r.sludge, dsDig = ds * (1 - stab.massLoss);              // кг сухого вещества в сутки
      const V = Math.max(0, dsDig / (SL.dsBefore * 1000) - dsDig / ((data.ECON.cakeDry || 0.22) * 1000)); // м³/сут отжатой воды
      const nh4 = V * stab.nh4, p = V * (bioP && stab.pBio ? stab.pBio : stab.p), ss = V * SL.ssRej; // г/сут
      const rem = rejT ? nh4 * rejT.nh4 : 0, no3 = rejT ? rem * rejT.no3 : 0;
      const next = { nh4: (nh4 - rem) / q, no3: no3 / q, p: p / q, ss: ss / q };
      reject = { V, ds, dsDig, nh4: nh4 / 1000, nh4Back: (nh4 - rem) / 1000, removed: rem / 1000, p: p / 1000, ss: ss / 1000, add: next,
        share: raw.nh4 > 0 ? (nh4 - rem) / (raw.nh4 * q) : 0, en: rejT && rejT.en ? rejT.en * rem / 1000 : 0 };
      const done = Object.keys(add).every(k => Math.abs(next[k] - add[k]) < 1e-4);
      Object.assign(add, next);
      if (done) break;
    }
    if (reject && q > 0) r.energy += reject.en / q;
    r.prof[0] = { ...raw };
    r.reject = reject;
    return r;

    function pass(inflow) {
      const mix = parts => { const o = {}, tot = parts.reduce((s, [w]) => s + w, 0); PK.forEach(k => { o[k] = tot > 0 ? parts.reduce((s, [w, c]) => s + w * c[k], 0) / tot : 0; }); return o; };
      const prof = [{ ...inflow }], cin = [], warns = [], perStep = [];
      let energy = 0, sludge = 0;

      steps.forEach((st, si) => {
        const parts = fl.src[si] > 0 ? [[fl.src[si], inflow]] : [];
        fl.edges.forEach(e => { if (e.b === si) parts.push([e.f, prof[e.a + 1]]); });
        const c = mix(parts), fi = fl.f[si], before = [...anc[si]].map(j => steps[j].u);
        const later = steps.filter((_, j) => anc[j].has(si));
        const u = U[st.u], e = st.eff, w = [];
        if (st.idle) { // не подключено трубами: вода через сооружение не идёт
          cin.push({ ...inflow }); prof.push({ ...inflow }); warns.push(['Сооружение не подключено: проведите к нему трубу, чтобы оно заработало.']);
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
          if (ci.bod > 0 && (ci.nh4 < 0.05 * ci.bod || ci.p < 0.01 * ci.bod) && !u.anaer) w.push(`Биогенов меньше, чем БПК₅ : N : P = 100 : 5 : 1 (СП 32 п. 9.2.5.3): их нужно добавлять.`);
          if (!u.anaer && before.some(b => U[b].bio && !U[b].anaer)) w.push('Это вторая аэробная биологическая ступень подряд; проверьте, нужна ли она.');
          if (u.id === 'uasb' && ci.bod < 800) w.push(`UASB рассчитан на концентрированные стоки (БПК₅ от ~1 000 мг/л), здесь ${fmt(ci.bod)} мг/л: эффект будет слабым.`);
          if (u.id === 'uasb' && !later.some(x => U[x.u].bio && !U[x.u].anaer)) w.push('После анаэробного реактора нужна аэробная доочистка: на выходе остаётся органика и весь азот.');
          if (u.id === 'wetland' && input.q * fi > 2000) w.push(`Биоплато занимает 3–5 м² на 1 м³/сут; для ${fmt(input.q * fi)} м³/сут это очень большая площадь. Обычно его используют для малых посёлков или как доочистку.`);
          if (u.id === 'baf' && ci.ss > 150) w.push(`Биофильтр BAF забивается взвесью (${fmt(ci.ss)} мг/л); перед ним нужны первичные или ламельные отстойники.`);
          if (u.mlss && !later.some(x => U[x.u].sep)) w.push('После этого биореактора нужен вторичный отстойник: без илоотделения в водоём уходит иловая смесь (СП 32 п. 9.2.7.15).');
        }
        if (u.sep && !before.some(b => U[b].mlss)) w.push('Выше по течению нет биореактора с активным илом или биоплёнкой: вторичному отстойнику нечего отделять.');
        if (u.id === 'mbr' && !before.includes('screens') && !before.includes('drum')) w.push('Перед МБР нужны сита с отверстиями 1–3 мм после песколовок (СП 32 п. 9.2.1.1).');
        if (u.id === 'sand' && steps.some((x, j) => anc[j].has(si) && U[x.u].eff.bioP)) w.push('Аэрируемые песколовки не применяют перед биологическим удалением фосфора: воздух окисляет лёгкую органику, нужную фосфат-аккумулирующим бактериям (СП 32 п. 9.2.2.1).');
        if (u.id === 'equal' && input.q > 20000) w.push('Для городских сточных вод усреднитель на очистных сооружениях свыше 20 000 м³/сут не допускается (СП 32 п. 9.2.3.1); для промстоков — допустим.');
        if (u.id === 'lamella' && input.q > 10000 && !before.some(b => U[b].bio)) w.push('Тонкослойные первичные отстойники допускаются только на очистных сооружениях не выше средних — до 10 000 м³/сут (СП 32 п. 9.2.4.2).');
        if (u.id === 'anammox' && ci.nh4 < 100) w.push(`Анаммокс применяют для потоков с высоким аммонием (фугат, промстоки, сотни мг N/л); при ${fmt(ci.nh4)} мг/л он неэффективен. Для фугата городских очистных включите очистку фугата в линии осадка.`);
        if (u.id === 'strip' && ci.nh4 < 200) w.push(`Аммиачную отдувку применяют при аммонии выше ~200 мг N/л; при ${fmt(ci.nh4)} мг/л дешевле биологическая нитри-денитрификация.`);
        if (u.id === 'hypo' && ci.nh4 > 2) w.push(`Аммоний ${fmt(ci.nh4)} мг/л связывает хлор в хлорамины, расход гипохлорита вырастет.`);
        if (u.id === 'hypo') w.push(`Остаточный хлор токсичен для рыб: по СП 32 п. 9.2.11.2 нужна дехлорация до 0,2 мг/л (крупнейшие ОС — 0,1 мг/л); без неё — только новые ОС до малых (≤ 1 000 м³/сут). В водные объекты категории А — только УФ.`);
        if ((u.id === 'ix' || u.id === 'uf') && ci.ss > 10) w.push(`${u.id === 'ix' ? 'Ионообменные смолы' : 'Мембраны ультрафильтрации'} забиваются взвесью (${fmt(ci.ss)} мг/л); поставьте перед ними фильтры.`);
        if (u.id === 'neutral') w.push('pH в модели не рассчитывается: ступень показана для полноты схемы промышленных стоков.');
        if (u.id === 'ro' && ci.ss > 5) w.push(`На вход обратного осмоса нужно ВВ < 5 мг/л, сейчас ${fmt(ci.ss)}.`);
        if (u.id === 'gac' && ci.ss > 15) w.push(`Уголь быстро забьётся взвесью (${fmt(ci.ss)} мг/л); поставьте фильтры перед ним.`);
        if (['filter', 'disc'].includes(u.id) && ci.ss > 60) w.push(`Фильтры перегружены взвесью (${fmt(ci.ss)} мг/л); их ставят после отстаивания.`);
        if (u.id === 'uv' && ci.ss > 15) w.push(`Взвесь ${fmt(ci.ss)} мг/л снижает эффективность УФ; желательно < 10 мг/л.`);
        if (u.id === 'nitf' && ci.nh4 > 5) w.push(`Биофильтры доочистки рассчитаны на остаточный аммоний после основной биологии; при ${fmt(ci.nh4)} мг/л нитрификацию нужно вести в аэротенках (ИТС 10-2019, с. 98–99; СП 32 п. 9.2.10.2).`);
        if (u.id === 'nitf' && !later.some(x => ['filter', 'disc', 'uf'].includes(x.u))) w.push('Биофильтры доочистки, как правило, не снижают взвесь: после них ставят фильтры (ИТС 10-2019, с. 99).');
        if (u.id === 'denf') w.push('Требуется дозирование внешнего углерода (метанол, ацетат), это расход реагента.');

        // Прямое снижение концентраций
        PK.forEach(k => { if (e[k] != null) c[k] *= 1 - Math.min(100, Math.max(0, e[k])) / 100; });
        // Осветление: вместе со взвесью уходит органика взвеси — формула (18) СП 32 п. 9.2.4.4, kXX по прил. Г
        if (u.kss) { const dS = Math.max(0, ci.ss - c.ss); Object.entries(u.kss).forEach(([k, kk]) => { c[k] = Math.max(0, c[k] - kk * dS); }); }

        if (u.bio) {
          const dB = Math.max(0, ci.bod - c.bod);
          // Ассимиляция биогенов приростом ила: ~5% N и ~1% P от снятого БПК (БПК₅ : N : P = 100 : 5 : 1, СП 32 п. 9.2.5.3)
          const aN = Math.min(c.nh4, 0.05 * dB); c.nh4 -= aN;
          const aP = Math.min(c.p, 0.01 * dB); c.p -= aP;
          if (e.nit) { const n = c.nh4 * e.nit / 100; c.nh4 -= n; c.no3 += n * 0.98; c.no2 += n * 0.02; }
          if (e.den) {
            // Денитрификации нужно 3,5–4 мг БПК₅ на 1 мг N (СП 32 п. 9.2.5.11); в модели — 4
            const tot = c.no3 + c.no2, need = tot * e.den / 100, cap = ci.bod / 4, got = Math.min(need, cap);
            if (got < need - 0.5) w.push(`Не хватает органики для денитрификации: удалено ${fmt(got)} из ${fmt(need)} мг N/л. Нужен внешний углерод (5 кг ХПК на 1 кг N, СП 32 п. 9.2.5.11) или обход первичных отстойников.`);
            if (tot > 0) { const f = got / tot; c.no3 *= 1 - f; c.no2 *= 1 - f; }
          }
          if (e.bioP) {
            if (ci.p > 0 && ci.bod / ci.p < 20) w.push(`Для биоудаления фосфора мало органики: БПК₅/P = ${fmt(ci.bod / ci.p)} (нужно ≥ 20).`);
            c.p *= 1 - e.bioP / 100;
          }
          // взвесь на выходе: иловая смесь (нужен вторичный отстойник) или уже отделённая вода
          if (u.mlss) c.ss = u.mlss; else if (u.ssOut != null) c.ss = Math.min(c.ss, u.ssOut);
          sl += (u.yield ?? 0.6) * dB; // прирост ила, г/м³ (анаэробный и продлённая аэрация — меньше)
          if (e.bioP) sl += 3 * Math.max(0, ci.p - c.p); // дополнительный прирост при биоудалении P — 3 кг/кг P (СП 32 п. 9.2.5.7)
        }
        // Илоотделение: вынос взвеси зависит от биореактора выше по течению; ил не считается осадком — его избыток уже учтён приростом
        if (u.sep) {
          const ups = [...anc[si]].map(j => U[steps[j].u]).filter(x => x.mlss);
          if (ups.length) c.ss = Math.min(c.ss, Math.max(...ups.map(x => x.ssOut ?? 15)));
        }
        // Нитрификация в биофильтрах доочистки (биология без активного ила)
        if (!u.bio && e.nit) { const n = c.nh4 * e.nit / 100; c.nh4 -= n; c.no3 += n * 0.95; c.no2 += n * 0.05; }
        // Реагентное удаление фосфора в этом сооружении: доза = β × стехиометрия × ΔP (СП 32 п. 9.2.5.7)
        let dose = null;
        if (st.dose && u.doseAt && data.DOSE) {
          const pt = data.DOSE.points[u.doseAt], rg = data.DOSE.reagents[st.dose] || data.DOSE.reagents.fe;
          const dP = c.p * pt.pRem, metal = dP * pt.beta * rg.stoich;
          c.p -= dP; sl += metal * rg.sludge;
          dose = { r: st.dose in data.DOSE.reagents ? st.dose : 'fe', at: u.doseAt, dP, metal, product: metal / rg.product };
          if (u.doseAt === 'pre' && later.some(x => U[x.u].eff.den)) w.push('Коагулянт перед первичным осветлением снимает и органику, нужную для денитрификации: так дозируют только при достатке органических веществ (СП 32 п. 9.2.5.5).');
        }
        c.cod = Math.max(c.cod, c.bod);
        sl += Math.max(0, ci.ss - c.ss) * (u.bio || u.sep ? 0 : 1) + (u.chem ? 5 * Math.max(0, ci.p - c.p) : 0);
        sludge += sl * fi;
        energy += u.en * fi;
        perStep.push({
          en: u.en,                                          // кВт·ч/м³
          f: fi,                                             // доля общего расхода
          q: input.q * fi,                                   // расход через ступень, м³/сут
          sludge: sl * input.q * fi / 1000,                  // кг сухого вещества в сутки
          dP: Math.max(0, ci.p - c.p),                      // удалено фосфора, мг/л
          dNOx: Math.max(0, ci.no3 + ci.no2 - c.no3 - c.no2), // удалено азота нитратов и нитритов, мг/л
          dose                                               // ввод коагулянта: реагент, точка, снятый P, металл и товарный продукт, мг/л
        });
        prof.push({ ...c });
        warns.push(w);
      });

      // убираем погрешность двоичной арифметики (2,100000000000002 → 2,1), чтобы сравнение с нормативом было честным
      const tidy = o => { PK.forEach(k => { o[k] = +(+o[k]).toPrecision(12); }); return o; };
      prof.forEach(tidy);
      const out = tidy(steps.length ? mix(fl.sinks.map(i => [fl.f[i], prof[i + 1]])) : { ...inflow });
      return { prof, cin, out, f: fl.f, warns, perStep, energy, sludge: sludge * input.q / 1000 };
    }
  }

  root.SeshatModel = { simulate, fmt };
  if (typeof module !== 'undefined') module.exports = root.SeshatModel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
