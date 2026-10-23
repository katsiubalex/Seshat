// Мифы о воде: боги и легендарные герои, чья сфера созвучна модулям Сешат, и сама Сешат.
// Раздел «Гуманитарные аспекты». Статьи — content/myths/<id>.md, собираются в js/content.js (tools/build-content.js).
// mods — созвучные модули: [id модуля, чем созвучен]; sources — [название, ссылка].
(function (root) {
  const CT = root.SeshatContent || (typeof require !== 'undefined' ? require('./content.js') : {});
  const GODS = CT.myths || [];
  const ORDER = GODS.map(g => g.id);
  const BY = Object.fromEntries(GODS.map(g => [g.id, g]));
  // мифы, созвучные модулю
  const forModule = mid => GODS.filter(g => g.mods.some(([m]) => m === mid));
  root.SeshatMyths = { GODS, BY, ORDER, forModule };
  if (typeof module !== 'undefined') module.exports = root.SeshatMyths;
})(typeof globalThis !== 'undefined' ? globalThis : this);
