// Страница «Сешат»: сцена в духе экрана лидера и разговор. Ответы — из SeshatOracle.

const talk = { started: false, typing: null, busy: false };
const orb = document.getElementById('orb');

function oracleCtx() {
  return { page: PAGE, view: document.body.dataset.view, q: state.q, c: state.c, steps: state.steps, norm: state.norm, prices: state.prices, projects: store.list('project').length, hour: new Date().getHours() };
}

/* ---------- звёздное небо ---------- */
function drawSky() {
  const cv = document.getElementById('sky'); if (!cv) return;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = Math.round(r.width * r.height / 2600);
  for (let i = 0; i < n; i++) {
    const x = rnd() * r.width, y = rnd() * r.height * 0.78, s = rnd();
    g.fillStyle = `rgba(237,226,200,${0.25 + s * 0.6})`;
    g.beginPath(); g.arc(x, y, s < 0.92 ? 0.6 + s * 0.6 : 1.6, 0, Math.PI * 2); g.fill();
  }
  // семь звёзд — ковш Большой Медведицы, по нему сверяли север при разметке храма
  const dip = [[.70, .14], [.75, .12], [.80, .135], [.84, .16], [.86, .23], [.92, .225], [.93, .155]];
  g.strokeStyle = 'rgba(217,182,106,.25)'; g.lineWidth = 1; g.beginPath();
  dip.forEach(([x, y], i) => { const px = x * r.width, py = y * r.height; i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.stroke();
  dip.forEach(([x, y]) => { g.fillStyle = 'rgba(244,226,180,.95)'; g.beginPath(); g.arc(x * r.width, y * r.height, 1.9, 0, Math.PI * 2); g.fill(); });
}

/* ---------- разговор: одна история, два окна (страница Сешат и мини-окно) ---------- */
// История общая: начав разговор в мини-окне, его можно продолжить на странице и наоборот.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SURFACES = [
  { log: 'dlg-log', opts: 'dlg-options', form: 'dlg-ask', input: 'dlg-input', visible: () => document.body.dataset.view === 'seshat' },
  { log: 'mini-log', opts: 'mini-options', form: 'mini-ask', input: 'mini-input', visible: () => !document.getElementById('mini').hidden }
].map(s => ({ ...s, log: document.getElementById(s.log), opts: document.getElementById(s.opts), form: document.getElementById(s.form), input: document.getElementById(s.input) }))
  .filter(s => s.log); // на странице модуля полного окна разговора нет — только мини-окно
talk.history = [];      // [{ who: 'seshat'|'you', text }]
talk.reply = null;      // последний ответ Сешат: варианты и действие
talk.shown = 0;         // сколько символов последней реплики уже напечатано

function lineHtml(m, text) {
  return `<div class="dlg-line ${m.who === 'you' ? 'you-line' : 'seshat-line'}"><span class="dlg-who">${m.who === 'you' ? 'Вы' : 'Сешат'}</span><p>${esc(text)}</p></div>`;
}
function renderLogs() {
  const n = talk.history.length;
  for (const s of SURFACES) {
    s.log.innerHTML = talk.history.map((m, i) => lineHtml(m, i === n - 1 && m.who === 'seshat' ? m.text.slice(0, talk.shown) : m.text)).join('');
    s.log.scrollTop = s.log.scrollHeight;
  }
}
function updateTyping() {
  const last = talk.history[talk.history.length - 1]; if (!last) return;
  for (const s of SURFACES) {
    const p = s.log.querySelector('.dlg-line:last-child p'); if (p) p.textContent = last.text.slice(0, talk.shown);
    s.log.scrollTop = s.log.scrollHeight;
  }
}
function renderOptions() {
  const r = talk.typing ? null : talk.reply;
  const opts = r ? (r.options || []).map((o, i) => `<button type="button" class="dlg-opt" data-oid="${esc(o.id)}" data-label="${esc(o.label)}"><span class="dlg-num">${i + 1}</span>${esc(o.label)}</button>`) : [];
  if (r && r.action) opts.unshift(`<button type="button" class="dlg-opt dlg-act" data-act="1"><span class="dlg-num" aria-hidden="true">→</span>${esc(r.action.label)}</button>`);
  for (const s of SURFACES) s.opts.innerHTML = opts.join('');
}
function finishTyping() {
  if (!talk.typing) return;
  clearInterval(talk.typing); talk.typing = null;
  const last = talk.history[talk.history.length - 1]; talk.shown = last ? last.text.length : 0;
  updateTyping(); renderOptions();
}
function say(reply) {
  finishTyping();
  talk.history.push({ who: 'seshat', text: reply.text });
  talk.reply = reply;
  if (reduced()) { talk.shown = reply.text.length; renderLogs(); renderOptions(); return; }
  talk.shown = 0; renderLogs();
  talk.typing = setInterval(() => {
    talk.shown += 3; updateTyping();
    if (talk.shown >= reply.text.length) finishTyping();
  }, 16);
  renderOptions();
}
function you(text) { finishTyping(); talk.history.push({ who: 'you', text }); talk.shown = 0; renderLogs(); }
async function askSeshat(input, label) {
  if (talk.busy) return;
  you(label || input.text);
  talk.busy = true;
  try { say(await SeshatOracle.ask(input, oracleCtx())); } finally { talk.busy = false; }
}
function startTalk() {
  if (talk.started) return;
  talk.started = true;
  say(SeshatOracle.greet(oracleCtx()));
}
function runAction(a) {
  if (a.type === 'link') { go(a.view); return; }
  if (a.type === 'url') { if (a.page === PAGE) go(a.hash); else location.href = pageUrl(a.page, a.hash); return; }
  if (a.type === 'apply' && PAGE !== 'tlazolteotl') { // с главной: собрать схему на странице Тласольтеотль
    setPending({ steps: a.steps }); location.href = pageUrl('tlazolteotl', 'constructor'); return;
  }
  if (a.type === 'apply') {
    state.steps = a.steps.map(mk);
    state.ctx = null;
    if (state.ref.scheme && state.ref.scheme[0] !== 'b') state.ref.scheme = fresh().ref.scheme;
    update(); renderCtx();
    toast('Предложенная схема собрана в конструкторе. Сохраните её кнопкой «Создать схему».');
    go('constructor');
  }
}
for (const s of SURFACES) {
  s.opts.addEventListener('click', ev => {
    const b = ev.target.closest('.dlg-opt'); if (!b) return;
    if (b.dataset.act) { if (talk.reply && talk.reply.action) runAction(talk.reply.action); return; }
    askSeshat({ id: b.dataset.oid }, b.dataset.label);
  });
  s.form.addEventListener('submit', ev => {
    ev.preventDefault();
    const text = s.input.value.trim(); if (!text) return;
    s.input.value = '';
    askSeshat({ text });
  });
  s.log.addEventListener('click', finishTyping);
}
// цифры 1–9 выбирают вариант ответа
document.addEventListener('keydown', ev => {
  if (ev.target.closest('input,textarea,select') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const s = SURFACES.find(x => x.visible()); if (!s) return;
  const n = parseInt(ev.key, 10); if (!n) return;
  const opts = s.opts.querySelectorAll('.dlg-opt:not(.dlg-act)');
  if (opts[n - 1]) { ev.preventDefault(); opts[n - 1].click(); }
});
window.addEventListener('resize', () => { if (document.body.dataset.view === 'seshat') drawSky(); });

VIEW_RENDER.seshat = () => { closeMini(); drawSky(); startTalk(); renderLogs(); renderOptions(); };

/* ---------- мини-окно разговора у эмблемы ---------- */
const mini = document.getElementById('mini');
function openMini() {
  mini.hidden = false;
  orb.setAttribute('aria-expanded', 'true');
  startTalk(); renderLogs(); renderOptions();
  // на телефоне не открываем клавиатуру сразу — она закроет окно
  if (window.matchMedia('(pointer: fine)').matches) document.getElementById('mini-input').focus({ preventScroll: true });
}
function closeMini() {
  if (mini.hidden) return;
  mini.hidden = true;
  orb.setAttribute('aria-expanded', 'false');
}
document.getElementById('mini-close').addEventListener('click', () => { closeMini(); orb.focus(); });
document.getElementById('mini-full').addEventListener('click', () => go('seshat'));
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !mini.hidden) { closeMini(); orb.focus(); } });
document.addEventListener('pointerdown', ev => {
  if (mini.hidden || mini.contains(ev.target) || orb.contains(ev.target) || ev.target.closest('#toast')) return;
  closeMini();
});

/* ---------- эмблема: перелетает между центром экрана диалога и правым верхним углом ---------- */
const DOCK = 56;
function dockRect() {
  const v = document.getElementById('view-' + document.body.dataset.view), d = v && v.querySelector('[data-orb-dock]');
  const r = d && d.getBoundingClientRect();
  return r && r.width ? r : null;
}
function placeOrb(animate) {
  const big = document.body.dataset.view === 'seshat' && !!document.getElementById('orb-slot');
  const vw = document.documentElement.clientWidth;
  let x, y, size, dock = null;
  if (big) {
    const r = document.getElementById('orb-slot').getBoundingClientRect();
    x = r.left; y = r.top; size = r.width;
  } else if ((dock = dockRect())) {
    x = dock.left; y = dock.top; size = dock.width; // место в панели раздела, например в конструкторе
  } else {
    const small = vw <= 860; // на телефоне меню сверху — эмблема поменьше, в строке с логотипом
    size = small ? 38 : DOCK; x = vw - size - (small ? 12 : 16); y = small ? 9 : 16;
  }
  // окно разговора открывается под эмблемой, если она стоит в панели раздела
  mini.style.top = dock ? (y + size + 10) + 'px' : '';
  mini.style.maxHeight = dock ? `calc(100vh - ${Math.round(y + size + 26)}px)` : '';
  if (!animate) orb.classList.add('no-anim');
  orb.classList.toggle('big', big);
  orb.tabIndex = big ? -1 : 0;
  if (big) orb.setAttribute('aria-hidden', 'true'); else orb.removeAttribute('aria-hidden');
  Object.assign(orb.style, { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px' });
  if (!animate) { orb.getBoundingClientRect(); requestAnimationFrame(() => orb.classList.remove('no-anim')); }
}
let orbReady = false;
document.addEventListener('viewchange', () => { placeOrb(orbReady); orbReady = true; });
window.addEventListener('resize', () => placeOrb(false));
// место под эмблему может сдвинуться (шрифты, длина диалога) — следим за ним
if (window.ResizeObserver && document.getElementById('view-seshat')) new ResizeObserver(() => { if (document.body.dataset.view === 'seshat' && orbReady) placeOrb(false); }).observe(document.getElementById('view-seshat'));
if (window.ResizeObserver) document.querySelectorAll('[data-orb-dock]').forEach(d => new ResizeObserver(() => { if (orbReady) placeOrb(false); }).observe(d.parentElement));
window.addEventListener('scroll', () => { if (document.body.dataset.view === 'seshat') placeOrb(false); }, { passive: true });
orb.addEventListener('click', () => { if (document.body.dataset.view === 'seshat') return; if (mini.hidden) openMini(); else closeMini(); });
