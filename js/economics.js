// Экономика схемы: капитальные затраты по ступеням и суточные эксплуатационные расходы.
// Чистая функция над результатом SeshatModel.simulate, тестируется в Node.
(function (root) {
  const D = root.SeshatData || (typeof require !== 'undefined' ? require('./data.js') : null);

  /** Цены по умолчанию в виде { kwh: 8, ... } */
  function defaultPrices(data) {
    data = data || D;
    return Object.fromEntries(Object.entries(data.ECON.prices).map(([k, p]) => [k, p.v]));
  }

  /**
   * @param {{q:number, steps:{u:string}[]}} input — расход и схема
   * @param {{perStep:Object[]}} sim — результат simulate
   * @param {Object} prices — { kwh, sludge, coag, floc, meth, repair, capexIdx }
   * @returns {{steps:Object[], total:Object, perM3:number, perYear:number}}
   *   capex — млн ₽; остальные статьи — ₽ в сутки
   */
  function costs(input, sim, prices, data) {
    data = data || D;
    const E = data.ECON, R = E.reagents, q = Math.max(0, input.q || 0);
    const pr = { ...defaultPrices(data), ...(prices || {}) };
    const U = Object.fromEntries(data.UNITS.map(u => [u.id, u]));
    const scale = q > 0 ? Math.pow(q / E.qRef, E.scale) : 0;
    const tm3 = q / 1000; // перевод мг/л × м³/сут → кг/сут

    const steps = input.steps.map((st, i) => {
      const u = U[st.u], ps = sim.perStep[i];
      const capex = (u.cx || 0) * scale * pr.capexIdx;
      const kwh = ps.en * q;
      let coag = 0, floc = 0, meth = 0;
      if (u.id === 'chemP') coag = R.coagPerP * ps.dP * tm3;
      if (u.id === 'daf') { coag = R.dafCoag * q; floc = R.dafFloc * q; }
      if (u.id === 'coag') { coag = R.coagDose * q; floc = R.coagFloc * q; }
      if (u.id === 'denf') meth = R.methPerN * ps.dNOx * tm3;
      const row = {
        u: u.id,
        capex,
        kwh,
        energy: kwh * pr.kwh,
        reagents: coag * pr.coag + floc * pr.floc + meth * pr.meth,
        reagentKg: { coag, floc, meth },
        consumables: (u.cons || 0) * q,
        sludge: ps.sludge / 1000 / E.cakeDry * pr.sludge,
        repair: capex * 1e6 * pr.repair / 100 / 365
      };
      row.opex = row.energy + row.reagents + row.consumables + row.sludge + row.repair;
      return row;
    });

    const keys = ['capex', 'kwh', 'energy', 'reagents', 'consumables', 'sludge', 'repair', 'opex'];
    const total = Object.fromEntries(keys.map(k => [k, steps.reduce((s, r) => s + r[k], 0)]));
    return { steps, total, perM3: q > 0 ? total.opex / q : 0, perYear: total.opex * 365 };
  }

  root.SeshatEconomics = { costs, defaultPrices };
  if (typeof module !== 'undefined') module.exports = root.SeshatEconomics;
})(typeof globalThis !== 'undefined' ? globalThis : this);
