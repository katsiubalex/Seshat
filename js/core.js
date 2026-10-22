// Общее ядро экосистемы Сешат: подключается на главной странице и на страницах модулей.
// Справочники, мелкие помощники, библиотека пользователя, уведомления и маршрутизация между страницами.
// Страница описывает себя атрибутами <body data-page="hub|tlazolteotl" data-root="путь к корню сайта">.

/* ---------- справочники и помощники ---------- */
const { PARAMS, SHORT, STAGES, UNITS, PRESETS, NORMS } = SeshatData;
const { fmt } = SeshatModel;
const U = Object.fromEntries(UNITS.map(u => [u.id, u]));
const STG = Object.fromEntries(STAGES.map(s => [s.id, s]));
const STATE_KEY = 'seshat-state';
const PENDING_KEY = 'seshat-pending'; // действие, которое нужно выполнить на странице модуля после перехода
const store = SeshatStore.createStore(SeshatStore.localAdapter('seshat-library'));
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const clone = o => JSON.parse(JSON.stringify(o));
// Числа в полях: принимаем и точку, и запятую; показываем с запятой.
function parseNum(s) { const t = String(s).replace(/\s/g, '').replace(',', '.'); if (t === '') return null; const v = Number(t); return isFinite(v) && v >= 0 ? v : NaN; }
const showNum = v => v == null || v === '' ? '' : String(v).replace('.', ',');
const NUM_ATTRS = 'type="text" inputmode="decimal" autocomplete="off" spellcheck="false"';
function markInvalid(el, v) { if (Number.isNaN(v)) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
function mk(id) { return { u: id, eff: { ...U[id].eff } }; }
const rub = v => Math.round(v).toLocaleString('ru-RU');
function mln(v) {
  if (v >= 1000) return (v / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млрд ₽';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: v < 10 ? 1 : 0 }) + ' млн ₽';
}
function money(v) { // ₽ в сутки или в год, кратко
  if (v >= 1e9) return (v / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млрд ₽';
  if (v >= 1e6) return (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽';
  if (v >= 1e4) return (v / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' тыс. ₽';
  return rub(v) + ' ₽';
}

/* ---------- уведомления ---------- */
let toastTimer;
function toast(msg, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" id="toast-act">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) document.getElementById('toast-act').onclick = () => { action.run(); el.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 7000 : 2600);
}

/* ---------- страницы и разделы ---------- */
const PAGE = document.body.dataset.page || 'hub';
const ROOT = document.body.dataset.root || '';
// Какой странице принадлежит раздел. Ссылка на чужой раздел открывает нужную страницу.
// Модули в разработке: у каждого своя страница с обзором и историей божества
const DEV_MODULES = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina'];
const PAGE_PATH = { hub: '', tlazolteotl: 'tlazolteotl/' };
const PAGE_VIEWS = {
  hub: ['home', 'seshat', 'kb', 'docs', 'about'],
  tlazolteotl: ['constructor', 'projects', 'lore']
};
const DEFAULT_VIEW = { hub: 'home', tlazolteotl: 'constructor' };
for (const id of DEV_MODULES) { PAGE_PATH[id] = id + '/'; PAGE_VIEWS[id] = ['overview', 'lore']; DEFAULT_VIEW[id] = 'overview'; }
const VIEWS = PAGE_VIEWS[PAGE];
const VIEW_RENDER = Object.create(null); // разделы, которые перерисовываются при открытии
// адрес #… → [страница, раздел, параметр]
function parseView(h) {
  if (!h) return [PAGE, DEFAULT_VIEW[PAGE], null];
  if (h === 'genplan') h = 'constructor';                       // генплан теперь часть конструктора
  if (VIEWS.includes(h)) return [PAGE, h, null];                 // свои разделы страницы
  let m;
  if ((m = /^doc-([a-z0-9]+)$/.exec(h))) return ['hub', 'docs', m[1]];
  if ((m = /^kb-([a-zA-Z0-9-]+)$/.exec(h))) return ['hub', 'kb', m[1]];
  if ((m = /^m-([a-z]+)$/.exec(h)) && PAGE_PATH[m[1]] != null) return [m[1], DEFAULT_VIEW[m[1]], null];
  if ((m = /^lore-([a-z]+)$/.exec(h)) && PAGE_PATH[m[1]] != null) return [m[1], 'lore', null];
  for (const [p, list] of Object.entries(PAGE_VIEWS)) if (list.includes(h)) return [p, h, null];
  return [PAGE, DEFAULT_VIEW[PAGE], null];
}
const pageUrl = (page, hash) => {
  const [, view] = parseView(hash || '');
  return ROOT + PAGE_PATH[page] + (hash && !/^(m|lore)-/.test(hash) ? '#' + hash : view === 'lore' ? '#lore' : '');
};
function showView(h) {
  const [page, view, param] = parseView(h);
  if (page !== PAGE) { location.replace(pageUrl(page, h)); return; }
  for (const v of VIEWS) { const el = document.getElementById('view-' + v); if (el) el.hidden = v !== view; }
  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    const on = a.dataset.view === view && (!a.dataset.param || a.dataset.param === param);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.dataset.view = view;
  document.body.dataset.param = param || '';
  if (VIEW_RENDER[view]) VIEW_RENDER[view](param);
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('viewchange', { detail: view }));
}
function viewFromHash() { return location.hash.slice(1); }
window.addEventListener('hashchange', () => showView(viewFromHash()));
function go(h) {
  const [page] = parseView(h);
  if (page !== PAGE) { location.href = pageUrl(page, h); return; }
  if (viewFromHash() === h) showView(h); else location.hash = h;
}
// Отложенное действие для страницы модуля: например, «применить нормативы» с главной страницы.
function setPending(action) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(action)); } catch (e) {} }
function takePending() {
  try { const a = JSON.parse(localStorage.getItem(PENDING_KEY)); localStorage.removeItem(PENDING_KEY); return a; } catch (e) { return null; }
}

/* ---------- выгрузка и загрузка библиотеки ---------- */
if (document.getElementById('btn-export')) document.getElementById('btn-export').onclick = () => {
  if (!store.count()) { toast('В библиотеке пока ничего нет. Сохраните профиль, схему или нормативы.'); return; }
  const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `сешат-библиотека-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
document.getElementById('file-import')?.addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try {
    const r = store.importAll(JSON.parse(await f.text()));
    toast(`Загружено: ${r.added} новых, ${r.updated} обновлено${r.skipped ? `, ${r.skipped} пропущено с ошибками` : ''}.`);
    document.dispatchEvent(new CustomEvent('libraryimport'));
  } catch (e) { toast(e instanceof SyntaxError ? 'Файл повреждён: это не JSON.' : e.message); }
});

/* ---------- тема оформления: авто (как в системе), светлая, тёмная ---------- */
function setTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { if (t === 'light' || t === 'dark') localStorage.setItem('seshat-theme', t); else localStorage.removeItem('seshat-theme'); } catch (e) {}
  const cur = document.documentElement.dataset.theme || 'auto';
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === cur)));
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-theme-set]'); if (b) setTheme(b.dataset.themeSet); });
function storedTheme() { try { return localStorage.getItem('seshat-theme') || 'auto'; } catch (e) { return 'auto'; } }
setTheme(storedTheme());
// тему меняют только на главной Сешат; открытые страницы модулей подхватывают её сразу
window.addEventListener('storage', ev => { if (ev.key === 'seshat-theme') setTheme(storedTheme()); });
window.addEventListener('pageshow', () => setTheme(storedTheme()));

/* ---------- запуск страницы ---------- */
function startPage() {
  const v = document.querySelector('script[src*="js/core.js"]')?.src.match(/[?&]v=([\d.]+)/);
  document.querySelectorAll('[data-app-version]').forEach(e => { e.textContent = v ? v[1] : '—'; });
  // кнопки и ссылки внутри страниц, ведущие в разделы
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-go]'); if (!a) return;
    ev.preventDefault(); go(a.dataset.go);
  });
  // кнопки «Копировать» в контактах
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Скопировано: ' + b.dataset.copy); }
    catch (e) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Выделено — нажмите Ctrl+C'); }
  });
  showView(viewFromHash());
}
