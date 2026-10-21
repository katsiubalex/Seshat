// Страница «Сешат»: сцена в духе экрана лидера и разговор. Ответы — из SeshatOracle.

const talk = { started: false, typing: null, busy: false };

function oracleCtx() {
  return { q: state.q, c: state.c, steps: state.steps, norm: state.norm, prices: state.prices, projects: store.list('project').length, hour: new Date().getHours() };
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

/* ---------- диалог ---------- */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function say(reply) {
  const log = document.getElementById('dlg-log');
  const line = document.createElement('div');
  line.className = 'dlg-line seshat-line';
  line.innerHTML = '<span class="dlg-who">Сешат</span><p></p>';
  log.appendChild(line);
  const p = line.querySelector('p');
  clearInterval(talk.typing);
  const done = () => { p.textContent = reply.text; renderOptions(reply); log.scrollTop = log.scrollHeight; };
  if (reduced()) { done(); return; }
  let i = 0; p.textContent = '';
  renderOptions({ options: [] });
  talk.typing = setInterval(() => {
    i += 3; p.textContent = reply.text.slice(0, i); log.scrollTop = log.scrollHeight;
    if (i >= reply.text.length) { clearInterval(talk.typing); talk.typing = null; done(); }
  }, 16);
  talk.finish = () => { clearInterval(talk.typing); talk.typing = null; done(); };
}
function you(text) {
  const log = document.getElementById('dlg-log');
  const line = document.createElement('div');
  line.className = 'dlg-line you-line';
  line.innerHTML = '<span class="dlg-who">Вы</span><p></p>';
  line.querySelector('p').textContent = text;
  log.appendChild(line); log.scrollTop = log.scrollHeight;
}
function renderOptions(reply) {
  const box = document.getElementById('dlg-options');
  talk.action = reply.action || null;
  const opts = (reply.options || []).map((o, i) => `<button type="button" class="dlg-opt" data-oid="${esc(o.id)}" data-label="${esc(o.label)}"><span class="dlg-num">${i + 1}</span>${esc(o.label)}</button>`);
  if (reply.action) opts.unshift(`<button type="button" class="dlg-opt dlg-act" data-act="1"><span class="dlg-num" aria-hidden="true">→</span>${esc(reply.action.label)}</button>`);
  box.innerHTML = opts.join('');
}
async function askSeshat(input, label) {
  if (talk.busy) return;
  if (talk.typing && talk.finish) talk.finish();
  you(label || input.text);
  talk.busy = true;
  try { say(await SeshatOracle.ask(input, oracleCtx())); } finally { talk.busy = false; }
}
function startTalk() {
  if (talk.started) return;
  talk.started = true;
  say(SeshatOracle.greet(oracleCtx()));
}

document.getElementById('dlg-options').addEventListener('click', ev => {
  const b = ev.target.closest('.dlg-opt'); if (!b) return;
  if (b.dataset.act) {
    const a = talk.action; if (!a) return;
    if (a.type === 'link') { go(a.view); return; }
    if (a.type === 'apply') {
      state.steps = a.steps.map(mk);
      state.ctx = null;
      if (state.ref.scheme && state.ref.scheme[0] !== 'b') state.ref.scheme = fresh().ref.scheme;
      update(); renderCtx();
      toast('Схема Сешат собрана в конструкторе. Сохраните её кнопкой «Создать схему».');
      go('constructor');
    }
    return;
  }
  askSeshat({ id: b.dataset.oid }, b.dataset.label);
});
document.getElementById('dlg-ask').addEventListener('submit', ev => {
  ev.preventDefault();
  const inp = document.getElementById('dlg-input'), text = inp.value.trim(); if (!text) return;
  inp.value = '';
  askSeshat({ text });
});
document.getElementById('dlg-log').addEventListener('click', () => { if (talk.typing && talk.finish) talk.finish(); });
// цифры 1–9 выбирают вариант ответа, как на экране лидера
document.addEventListener('keydown', ev => {
  if (document.body.dataset.view !== 'seshat' || ev.target.closest('input,textarea,select') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const n = parseInt(ev.key, 10); if (!n) return;
  const opts = document.querySelectorAll('#dlg-options .dlg-opt:not(.dlg-act)');
  if (opts[n - 1]) { ev.preventDefault(); opts[n - 1].click(); }
});
window.addEventListener('resize', () => { if (document.body.dataset.view === 'seshat') drawSky(); });

VIEW_RENDER.seshat = () => { drawSky(); startTalk(); };
