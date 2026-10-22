// Главная страница Сешат не содержит конструктора, но разговору, базе знаний и документам нужны
// данные пользователя: стоки, схема, нормативы. Здесь они читаются из сохранённого состояния модуля Тласольтеотль,
// а действия «применить в конструкторе» передаются на страницу модуля как отложенные.

function fresh() {
  const p = PRESETS[0];
  return { q: p.q, c: { ...p.c }, steps: p.scheme.map(mk), norm: { ...NORMS.pdk.v }, ref: { influent: 'b:0', scheme: 'b:0', norm: 'b:pdk' }, prices: SeshatEconomics.defaultPrices() };
}
let state = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if (s && s.c && Array.isArray(s.steps) && s.steps.every(x => U[x.u]) && s.norm) {
      s.prices = { ...SeshatEconomics.defaultPrices(), ...(s.prices || {}) };
      return s;
    }
  } catch (e) {}
  return fresh();
})();
// «Применить нормативы» и «Добавить сооружение» выполнятся, когда откроется Тласольтеотль
function openItem(kind, ref) { if (kind === 'norm') setPending({ norm: ref }); }
function addUnit(id) { setPending({ add: id }); }
