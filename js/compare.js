// Сравнение вариантов проекта: качество воды, затраты и вывод о лучшем варианте.
// Чистые функции над данными проекта, тестируются в Node.
(function (root) {
  const D = root.SeshatData || (typeof require !== 'undefined' ? require('./data.js') : null);
  const M = root.SeshatModel || (typeof require !== 'undefined' ? require('./model.js') : null);
  const E = root.SeshatEconomics || (typeof require !== 'undefined' ? require('./economics.js') : null);

  /** Посчитать один вариант на общих для проекта стоках, нормативах и ценах. */
  function evaluate(project, variant) {
    const input = { q: project.influent.q, c: project.influent.c, steps: variant.steps };
    const sim = M.simulate(input);
    const eco = E.costs(input, sim, project.prices);
    const out = sim.out;
    let pass = 0, tot = 0;
    const status = {};
    for (const p of D.PARAMS) {
      const n = project.norm.v[p.k];
      if (n == null) { status[p.k] = 'na'; continue; }
      tot++;
      if (out[p.k] <= n) { pass++; status[p.k] = 'ok'; } else status[p.k] = 'bad';
    }
    return {
      id: variant.id, name: variant.name, sim, eco, out, status, pass, tot,
      compliant: tot > 0 && pass === tot,
      warnings: sim.warns.reduce((s, w) => s + w.length, 0)
    };
  }

  /**
   * Сравнить все варианты проекта.
   * @returns {{rows:Object[], best:Object, verdict:Object|null}}
   *   best — для каждой метрики id лучших вариантов; verdict — вывод для заголовка сравнения
   */
  function compare(project) {
    const rows = project.variants.map(v => evaluate(project, v));
    const metrics = {
      capex: r => r.eco.total.capex,
      opex: r => r.eco.total.opex,
      perM3: r => r.eco.perM3,
      kwh: r => r.eco.total.kwh,
      sludge: r => r.sim.sludge,
      warnings: r => r.warnings,
      pass: r => -r.pass
    };
    for (const p of D.PARAMS) metrics['c_' + p.k] = r => r.out[p.k];
    const best = {};
    if (rows.length > 1) {
      for (const [k, f] of Object.entries(metrics)) {
        const vals = rows.map(f), min = Math.min(...vals);
        if (vals.every(v => Math.abs(v - min) < 1e-9)) { best[k] = []; continue; } // все равны — не подсвечиваем
        best[k] = rows.filter((r, i) => Math.abs(vals[i] - min) <= Math.max(1e-9, Math.abs(min) * 1e-6)).map(r => r.id);
      }
    }
    return { rows, best, verdict: verdict(rows) };
  }

  function verdict(rows) {
    if (!rows.length) return null;
    const ok = rows.filter(r => r.compliant);
    if (!ok.length) {
      const top = [...rows].sort((a, b) => b.pass - a.pass || a.eco.total.opex - b.eco.total.opex)[0];
      return { kind: 'none', closest: top.id, pass: top.pass, tot: top.tot };
    }
    const byOpex = [...ok].sort((a, b) => a.eco.total.opex - b.eco.total.opex);
    const byCapex = [...ok].sort((a, b) => a.eco.total.capex - b.eco.total.capex);
    const o = byOpex[0], c = byCapex[0];
    if (o.id === c.id) return { kind: 'single', best: o.id, compliant: ok.length };
    // Вариант, дешёвый в эксплуатации, дороже в строительстве: за сколько лет окупится разница.
    const dCapex = (o.eco.total.capex - c.eco.total.capex) * 1e6; // ₽
    const dOpexYear = (c.eco.total.opex - o.eco.total.opex) * 365; // ₽ в год
    return { kind: 'tradeoff', lowOpex: o.id, lowCapex: c.id, dCapex, dOpexYear, payback: dOpexYear > 0 ? dCapex / dOpexYear : Infinity, compliant: ok.length };
  }

  root.SeshatCompare = { compare, evaluate, verdict };
  if (typeof module !== 'undefined') module.exports = root.SeshatCompare;
})(typeof globalThis !== 'undefined' ? globalThis : this);
