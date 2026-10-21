// Интерфейс конструктора. Данные — в data.js, расчёт — в model.js, библиотека пользователя — в store.js.
const { PARAMS, SHORT, STAGES, UNITS, PRESETS, NORMS } = SeshatData;
const { fmt } = SeshatModel;
const U = Object.fromEntries(UNITS.map(u => [u.id, u]));
const STG = Object.fromEntries(STAGES.map(s => [s.id, s]));
const STATE_KEY = 'seshat-state';
const store = SeshatStore.createStore(SeshatStore.localAdapter('seshat-library'));
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const clone = o => JSON.parse(JSON.stringify(o));
// Числа в полях: принимаем и точку, и запятую; показываем с запятой.
function parseNum(s) { const t = String(s).replace(/\s/g, '').replace(',', '.'); if (t === '') return null; const v = Number(t); return isFinite(v) && v >= 0 ? v : NaN; }
const showNum = v => v == null || v === '' ? '' : String(v).replace('.', ',');
const NUM_ATTRS = 'type="text" inputmode="decimal" autocomplete="off" spellcheck="false"';
function markInvalid(el, v) { if (Number.isNaN(v)) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
function mk(id) { return { u: id, eff: { ...U[id].eff } }; }

/* ---------- три вида сохраняемых данных ---------- */
// ref в state — какая запись сейчас открыта: 'b:<id>' — встроенный пример, 'u:<id>' — запись пользователя, null — без названия.
const KINDS = {
  influent: {
    label: 'Профиль стоков', createLabel: 'Создать профиль', newName: 'Новый профиль стоков', draftLabel: 'Новый профиль (не сохранён)',
    draftHint: 'Заполните показатели ниже и нажмите «Сохранить».',
    builtins: PRESETS.map((p, i) => ({ id: String(i), name: p.n, data: { q: p.q, c: { ...p.c } } })),
    get: () => ({ q: state.q, c: { ...state.c } }),
    apply: d => { state.q = d.q; state.c = { ...d.c }; renderInputs(); }
  },
  scheme: {
    label: 'Схема очистки', createLabel: 'Создать схему', newName: 'Новая схема', draftLabel: 'Новая схема (не сохранена)',
    draftHint: 'Добавьте ступени из каталога и нажмите «Сохранить».',
    builtins: PRESETS.map((p, i) => ({ id: String(i), name: p.sn, data: { steps: p.scheme.map(mk) } })),
    get: () => ({ steps: clone(state.steps) }),
    apply: d => { state.steps = clone(d.steps); }
  },
  norm: {
    label: 'Нормативы', createLabel: 'Создать норматив', newName: 'Новый норматив', draftLabel: 'Новый норматив (не сохранён)',
    draftHint: 'Впишите значения в столбец «Норматив» таблицы и нажмите «Сохранить».',
    builtins: Object.entries(NORMS).filter(([, v]) => v.v).map(([k, v]) => ({ id: k, name: v.n, data: { v: { ...v.v } } })),
    get: () => ({ v: { ...state.norm } }),
    apply: d => { state.norm = { ...d.v }; }
  }
};

// 'p:<проект>' и 'p:<проект>:<вариант>' — данные открытого в конструкторе варианта проекта.
function refItem(kind, ref) {
  if (!ref) return null;
  const [t, id] = [ref[0], ref.slice(2)];
  if (t === 'p') {
    const [pid, vid] = id.split(':'), pr = store.get('project', pid);
    if (!pr) return null;
    const d = pr.data;
    if (kind === 'influent') return { name: `${pr.name}: ${d.influent.name}`, data: { q: d.influent.q, c: d.influent.c } };
    if (kind === 'norm') return { name: `${pr.name}: ${d.norm.name}`, data: { v: d.norm.v } };
    const v = d.variants.find(x => x.id === vid);
    return v ? { name: `${pr.name}: ${v.name}`, data: { steps: v.steps } } : null;
  }
  return t === 'b' ? KINDS[kind].builtins.find(b => b.id === id) || null : store.get(kind, id);
}
function sameData(kind, a, b) { const v = SeshatStore.validate[kind]; return JSON.stringify(v(a)) === JSON.stringify(v(b)); }
function isDirty(kind) { const it = refItem(kind, state.ref[kind]); return !it || !sameData(kind, KINDS[kind].get(), it.data); }

/* ---------- текущее состояние ---------- */
let state;
function fresh() {
  const p = PRESETS[0];
  return { q: p.q, c: { ...p.c }, steps: p.scheme.map(mk), norm: { ...NORMS.pdk.v }, ref: { influent: 'b:0', scheme: 'b:0', norm: 'b:pdk' }, prices: SeshatEconomics.defaultPrices() };
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if (s && s.c && Array.isArray(s.steps) && s.steps.every(x => U[x.u]) && s.norm) {
      // Если запись не найдена (удалена, не сохранена до перезагрузки, старая версия) — открываем пример.
      s.ref = s.ref || {};
      const f = fresh();
      for (const k of Object.keys(KINDS)) if (!s.ref[k] || !refItem(k, s.ref[k])) {
        s.ref[k] = f.ref[k];
        Object.assign(s, k === 'influent' ? { q: f.q, c: f.c } : k === 'scheme' ? { steps: f.steps } : { norm: f.norm });
      }
      delete s.normSet;
      s.prices = { ...SeshatEconomics.defaultPrices(), ...(s.prices || {}) };
      return s;
    }
  } catch (e) {}
  return fresh();
}
function saveState() { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {} }
state = loadState();

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

/* ---------- панель сохранения (одна на каждый вид данных) ---------- */
// Состояния панели: открыт пример → «Создать»; открыта своя запись → «Создать», «Сохранить», «Удалить»;
// создаётся новая запись (ref = 'new') → поле названия, «Сохранить», «Отмена».
const ui = { draft: {}, confirmDel: {}, rename: {} };

function uniqueName(kind, base) {
  const names = new Set(store.list(kind).map(it => it.name));
  if (!names.has(base)) return base;
  let i = 2; while (names.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function renderBar(kind) {
  const K = KINDS[kind], el = document.getElementById('bar-' + kind);
  const ref = state.ref[kind], cur = refItem(kind, ref), mine = store.list(kind);
  const draft = ui.draft[kind], isMine = !!cur && ref[0] === 'u', dirty = !!cur && isDirty(kind);
  const opt = (v, n) => `<option value="${esc(v)}" ${v === ref ? 'selected' : ''}>${esc(n)}</option>`;
  let h = `<div class="saved-row">
    <select id="sel-${kind}" aria-label="${K.label}: открыть">
      ${draft ? `<option value="new" selected>${esc(K.draftLabel)}</option>` : ''}
      ${!draft && ref && ref[0] === 'p' && cur ? `<optgroup label="Проект">${opt(ref, cur.name)}</optgroup>` : ''}
      ${mine.length ? `<optgroup label="Мои">${mine.map(it => opt('u:' + it.id, it.name)).join('')}</optgroup>` : ''}
      <optgroup label="Примеры">${K.builtins.map(b => opt('b:' + b.id, b.name)).join('')}</optgroup>
    </select>
    ${dirty ? '<span class="mod" title="Есть несохранённые изменения">изменено</span>' : ''}
  </div>`;
  if (draft) {
    h += `<form class="name-form" data-kind="${kind}">
      <input id="name-${kind}" type="text" maxlength="120" required placeholder="Название" aria-label="Название" value="${esc(draft.name)}">
      <button type="submit" class="primary">Сохранить</button><button type="button" data-act="cancel">Отмена</button>
    </form>
    <p class="saved-hint">${esc(K.draftHint)}</p>`;
  } else if (ui.rename[kind] != null && isMine) {
    h += `<form class="name-form" data-kind="${kind}" data-mode="rename">
      <input id="rename-${kind}" type="text" maxlength="120" required placeholder="Новое название" aria-label="Новое название" value="${esc(ui.rename[kind])}">
      <button type="submit" class="primary">Переименовать</button><button type="button" data-act="rename-cancel">Отмена</button>
    </form>`;
  } else if (ui.confirmDel[kind] && isMine) {
    h += `<div class="saved-actions"><span class="ask">Удалить «${esc(cur.name)}»?</span>
      <button type="button" data-act="del-yes" class="danger">Удалить</button><button type="button" data-act="del-no">Отмена</button></div>`;
  } else {
    h += `<div class="saved-actions">
      <button type="button" data-act="create">${K.createLabel}</button>
      ${isMine ? `<button type="button" data-act="save" class="${dirty ? 'primary' : ''}" ${dirty ? '' : 'disabled title="Изменений нет"'}>Сохранить</button>
      <button type="button" data-act="rename">Переименовать</button>
      <button type="button" data-act="del">Удалить</button>` : ''}
    </div>`;
  }
  el.innerHTML = h;
}
function renderBars() { Object.keys(KINDS).forEach(renderBar); }

function openItem(kind, ref) {
  const K = KINDS[kind], it = refItem(kind, ref);
  if (!it) return;
  const draft = ui.draft[kind];
  const prev = { data: K.get(), ref: state.ref[kind], draft };
  const lose = draft || isDirty(kind);
  delete ui.draft[kind]; delete ui.confirmDel[kind]; delete ui.rename[kind];
  K.apply(clone(it.data));
  state.ref[kind] = ref;
  update();
  if (lose) toast(`Открыто «${it.name}». Несохранённые изменения сброшены.`, { label: 'Вернуть', run: () => {
    K.apply(prev.data); state.ref[kind] = prev.ref; if (prev.draft) ui.draft[kind] = prev.draft; update();
  } });
}

function startDraft(kind) {
  const K = KINDS[kind];
  ui.draft[kind] = { name: uniqueName(kind, K.newName), prev: { data: K.get(), ref: state.ref[kind] } };
  delete ui.confirmDel[kind]; delete ui.rename[kind];
  state.ref[kind] = 'new';
  renderBar(kind);
  const inp = document.getElementById('name-' + kind); inp.focus(); inp.select();
}

function bindBar(kind) {
  const el = document.getElementById('bar-' + kind);
  el.addEventListener('change', ev => { if (ev.target.id === 'sel-' + kind && ev.target.value !== 'new') openItem(kind, ev.target.value); });
  el.addEventListener('input', ev => {
    if (ev.target.id === 'name-' + kind && ui.draft[kind]) ui.draft[kind].name = ev.target.value;
    if (ev.target.id === 'rename-' + kind && ui.rename[kind] != null) ui.rename[kind] = ev.target.value;
  });
  el.addEventListener('click', ev => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const K = KINDS[kind], ref = state.ref[kind], cur = refItem(kind, ref);
    if (act === 'create') { startDraft(kind); return; }
    if (act === 'rename' && cur) {
      delete ui.confirmDel[kind]; ui.rename[kind] = cur.name; renderBar(kind);
      const inp = document.getElementById('rename-' + kind); inp.focus(); inp.select();
      return;
    }
    if (act === 'rename-cancel') { delete ui.rename[kind]; renderBar(kind); return; }
    if (act === 'save' && cur) {
      const it = store.save(kind, { id: ref.slice(2), name: cur.name, data: K.get() });
      if (it) toast(`Сохранено: «${it.name}»`);
    } else if (act === 'cancel') {
      const d = ui.draft[kind]; delete ui.draft[kind];
      state.ref[kind] = d.prev.ref;
      update();
      return;
    } else if (act === 'del') { delete ui.rename[kind]; ui.confirmDel[kind] = true; }
    else if (act === 'del-no') { delete ui.confirmDel[kind]; }
    else if (act === 'del-yes' && cur) {
      delete ui.confirmDel[kind];
      const snapshot = clone(cur), data = K.get();
      store.remove(kind, ref.slice(2));
      const first = K.builtins[0];
      K.apply(clone(first.data)); state.ref[kind] = 'b:' + first.id;
      update();
      toast(`Удалено: «${snapshot.name}»`, { label: 'Восстановить', run: () => {
        const it = store.save(kind, { name: snapshot.name, data: snapshot.data });
        if (it) { K.apply(data); state.ref[kind] = 'u:' + it.id; update(); }
      } });
      return;
    }
    renderBar(kind); saveState();
  });
  el.addEventListener('submit', ev => {
    ev.preventDefault();
    if (ev.target.dataset.mode === 'rename') {
      const nm = document.getElementById('rename-' + kind).value.trim();
      if (!nm) { toast('Введите название.'); return; }
      const it = store.rename(kind, state.ref[kind].slice(2), nm);
      delete ui.rename[kind];
      if (it) toast(`Переименовано: «${it.name}»`);
      renderBar(kind);
      return;
    }
    const name = document.getElementById('name-' + kind).value.trim();
    if (!name) { toast('Введите название.'); return; }
    const it = store.save(kind, { name, data: KINDS[kind].get() });
    if (!it) { toast('Не удалось сохранить: данные заполнены неверно.'); return; }
    delete ui.draft[kind];
    state.ref[kind] = 'u:' + it.id;
    toast(`Сохранено: «${it.name}»`);
    renderBar(kind); saveState();
  });
  el.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (ui.draft[kind]) el.querySelector('[data-act=cancel]').click();
    else if (ui.rename[kind] != null) { delete ui.rename[kind]; renderBar(kind); }
  });
}

/* ---------- ввод ---------- */
function renderInputs(){
 const box=document.getElementById('inputs');
 box.innerHTML=`<label class="f qrow" for="in-q"><span>Расход<small>м³/сут</small></span><input id="in-q" ${NUM_ATTRS} value="${showNum(state.q)}"></label>`+
  PARAMS.map(p=>`<label class="f" for="in-${p.k}"><span>${p.n}<small>${p.u}</small></span><input id="in-${p.k}" ${NUM_ATTRS} value="${showNum(state.c[p.k])}"></label>`).join('');
}
document.getElementById('inputs').addEventListener('input',ev=>{const t=ev.target,v=parseNum(t.value);markInvalid(t,v);if(Number.isNaN(v))return;if(t.id==='in-q')state.q=v||0;else state.c[t.id.slice(3)]=v||0;update()});
/* ---------- каталог ---------- */
function effChips(eff){return Object.entries(eff).filter(([,v])=>v>0).map(([k,v])=>`<span class="chip">${SHORT[k]} −${v}%</span>`).join('')}
function renderLibrary(){
 const box=document.getElementById('library');
 box.innerHTML=STAGES.map(s=>`<div class="stage"><div class="stage-name"><span class="dot" style="background:${s.c}"></span>${s.n}</div>`+
  UNITS.filter(u=>u.st===s.id).map(u=>`<div class="lib-item" style="--c:${s.c}">${SeshatIcons.icon(u.id,44)}<div><b>${esc(u.n)}</b><p>${esc(u.d)}</p></div><button type="button" data-add="${u.id}" aria-label="Добавить: ${esc(u.n)}">+</button></div>`).join('')+'</div>').join('');
 box.onclick=ev=>{const b=ev.target.closest('[data-add]');if(!b)return;state.steps.push(mk(b.dataset.add));update()};
}
/* ---------- схема ---------- */
function renderScheme(sim){
 const box=document.getElementById('scheme');
 document.getElementById('sch-count').textContent=state.steps.length?`${state.steps.length} ступ.`:'';
 if(!state.steps.length){box.innerHTML=`<div class="empty">Схема пуста. Добавьте ступени из каталога, начиная с механической очистки.</div>`;return}
 const open=new Set([...box.querySelectorAll('details[open]')].map(d=>d.dataset.i));
 let h=`<div class="terminal"><span>Вход: ${fmt(state.q)} м³/сут</span><span>БПК₅ ${fmt(state.c.bod)} · N-NH₄ ${fmt(state.c.nh4)} · P ${fmt(state.c.p)}</span></div>`;
 state.steps.forEach((st,i)=>{
  const u=U[st.u],s=STG[u.st],o=sim.prof[i+1];
  h+=`<div class="arrow"></div>
  <div class="node" style="--c:${s.c}"><div class="bar"></div><div class="node-body">
   <div class="node-top"><div class="node-head">${SeshatIcons.icon(u.id,52)}<div class="node-title">${i+1}. ${esc(u.n)}<small>${s.n}</small></div></div>
    <div class="node-ctrl"><button type="button" data-mv="${i}" data-d="-1" aria-label="Выше" ${i===0?'disabled':''}>↑</button><button type="button" data-mv="${i}" data-d="1" aria-label="Ниже" ${i===state.steps.length-1?'disabled':''}>↓</button><button type="button" data-rm="${i}" aria-label="Удалить">✕</button></div></div>
   <div class="effects">${effChips(st.eff)||'<span class="chip">без изменения химии</span>'}</div>
   ${eco?`<div class="node-cost"><span>Капзатраты ≈ <b>${mln(eco.steps[i].capex)}</b></span><span>Эксплуатация <b>${money(eco.steps[i].opex)}</b>/сут</span></div>`:''}
   ${sim.warns[i].length?`<div class="warns">${sim.warns[i].map(x=>`<div class="w">${esc(x)}</div>`).join('')}</div>`:''}
   ${Object.keys(st.eff).length?`<details class="tune" data-i="${i}" ${open.has(String(i))?'open':''}><summary>Настроить эффективность, %</summary><div class="tune-grid">${Object.keys(st.eff).map(k=>`<label for="t-${i}-${k}">${SHORT[k]}<input id="t-${i}-${k}" ${NUM_ATTRS} data-ti="${i}" data-tk="${k}" value="${showNum(st.eff[k])}"></label>`).join('')}</div></details>`:''}
  </div></div>
  ${i<state.steps.length-1?`<div class="arrow">БПК₅ ${fmt(o.bod)} · N-NH₄ ${fmt(o.nh4)} · P ${fmt(o.p)}</div>`:''}`;
 });
 const f=sim.prof[sim.prof.length-1];
 h+=`<div class="arrow"></div><div class="terminal"><span>Выпуск</span><span>БПК₅ ${fmt(f.bod)} · N-NH₄ ${fmt(f.nh4)} · N-NO₃ ${fmt(f.no3)} · P ${fmt(f.p)}</span></div>`;
 box.innerHTML=h;
}
document.getElementById('scheme').addEventListener('click',ev=>{
 const m=ev.target.closest('[data-mv]'),r=ev.target.closest('[data-rm]');
 if(m){const i=+m.dataset.mv,j=i+ +m.dataset.d;[state.steps[i],state.steps[j]]=[state.steps[j],state.steps[i]];update()}
 if(r){state.steps.splice(+r.dataset.rm,1);update()}
});
document.getElementById('scheme').addEventListener('change',ev=>{
 const t=ev.target;if(!t.dataset.ti)return;const v=parseNum(t.value);if(Number.isNaN(v)){markInvalid(t,v);return}state.steps[+t.dataset.ti].eff[t.dataset.tk]=Math.min(100,v||0);update(true);
});

/* ---------- результаты ---------- */
function spark(vals,norm,st){
 const W=120,H=30,pad=3,pos=vals.map(v=>Math.max(v,1e-3));const all=norm?[...pos,norm]:pos;
 const lo=Math.log10(Math.min(...all))-0.1,hi=Math.log10(Math.max(...all))+0.1;
 const x=i=>pad+i*(W-2*pad)/Math.max(1,vals.length-1),y=v=>H-pad-(Math.log10(Math.max(v,1e-3))-lo)/(hi-lo||1)*(H-2*pad);
 const pts=pos.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
 const col=st==='ok'?'var(--ok)':st==='bad'?'var(--bad)':'var(--accent)';
 return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${norm?`<line x1="0" x2="${W}" y1="${y(norm)}" y2="${y(norm)}" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1"/>`:''}<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"/><circle cx="${x(vals.length-1)}" cy="${y(pos[pos.length-1])}" r="2.8" fill="${col}"/></svg>`;
}
function renderResults(sim){
 const f=sim.prof[sim.prof.length-1],tbl=document.getElementById('results');
 // Таблица перестраивается при каждом вводе: сохраняем набранный текст (например «0,») и положение курсора.
 const ae=document.activeElement,typing=ae&&ae.id&&ae.id.startsWith('n-')?{id:ae.id,raw:ae.value,pos:ae.selectionStart}:null;
 let pass=0,tot=0;const fails=[];
 let h=`<thead><tr><th class="p">Показатель</th><th>Профиль</th><th>Вход</th>${state.steps.map((s,i)=>`<th class="step">${i+1}. ${esc(U[s.u].n.split(' (')[0])}</th>`).join('')}<th>Выход</th><th>Эффект</th><th>Норматив</th><th>Статус</th></tr></thead><tbody>`;
 PARAMS.forEach(p=>{
  const n=state.norm[p.k],vals=sim.prof.map(c=>c[p.k]);let st='na';
  if(n!=null&&n!==''&&!isNaN(n)){tot++;if(f[p.k]<=n){st='ok';pass++}else{st='bad';fails.push(p.k)}}
  const inV=state.c[p.k],red=inV>0?(1-f[p.k]/inV)*100:null;
  h+=`<tr><td class="p"><b>${p.n}</b><small>${p.u}</small></td><td>${spark(vals,n,st)}</td><td class="num">${fmt(inV)}</td>${sim.prof.slice(1).map(c=>`<td class="num">${fmt(c[p.k])}</td>`).join('')}<td class="num out">${fmt(f[p.k])}</td><td class="num">${red==null?'—':(red<0?'+':'−')+Math.abs(red).toFixed(0)+'%'}</td><td class="norm"><input id="n-${p.k}" ${NUM_ATTRS} value="${showNum(n)}" placeholder="нет" aria-label="Норматив: ${p.n}"></td><td><span class="pill ${st}">${st==='ok'?'в норме':st==='bad'?'×'+fmt(f[p.k]/n):'не задан'}</span></td></tr>`;
 });
 tbl.innerHTML=h+'</tbody>';
 tbl.oninput=ev=>{const t=ev.target;if(!t.id.startsWith('n-'))return;const v=parseNum(t.value);markInvalid(t,v);if(Number.isNaN(v))return;state.norm[t.id.slice(2)]=v;update()};
 if(typing){const el=document.getElementById(typing.id);if(el){el.value=typing.raw;el.focus();el.setSelectionRange(typing.pos,typing.pos)}}
 const kwh=sim.energy*state.q;
 document.getElementById('summary').innerHTML=`
  <div class="kpi"><span>Соответствие нормативам</span><b style="color:${tot&&pass===tot?'var(--ok)':'var(--bad)'}">${pass} из ${tot}</b> <small>показателей</small></div>
  <div class="kpi"><span>Капитальные затраты</span><b>${mln(eco.total.capex)}</b> <small>${state.q>0?rub(eco.total.capex*1e6/state.q)+' ₽ на м³/сут':''}</small></div>
  <div class="kpi"><span>Эксплуатация</span><b>${money(eco.total.opex)}</b> <small>в сутки · ${money(eco.perYear)} в год</small></div>
  <div class="kpi"><span>Себестоимость очистки</span><b>${eco.perM3.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> <small>₽/м³</small></div>
  <div class="kpi"><span>Электроэнергия</span><b>${rub(kwh)}</b> <small>кВт·ч/сут · ${fmt(sim.energy)} кВт·ч/м³</small></div>
  <div class="kpi"><span>Осадок и ил (сухое в-во)</span><b>${fmt(sim.sludge/1000)}</b> <small>т/сут</small></div>`;
 // советы
 const have=new Set(state.steps.map(s=>s.u));
 const score=(u,k)=>k==='nh4'?(u.eff.nit||u.eff.nh4||0):k==='no3'||k==='no2'?Math.max(u.eff.den||0,u.eff[k]||0):k==='p'?Math.max(u.eff.bioP||0,u.eff.p||0):(u.eff[k]||0);
 document.getElementById('advice').innerHTML=fails.map(k=>{
  const p=PARAMS.find(x=>x.k===k);
  const cand=UNITS.filter(u=>!have.has(u.id)&&u.id!=='ro'&&score(u,k)>=40).sort((a,b)=>score(b,k)-score(a,k)).slice(0,2);
  if(!cand.length)cand.push(U.ro);
  return `<div><b>${p.n}</b>: на выходе ${fmt(f[k])} при нормативе ${fmt(state.norm[k])}. Попробуйте: ${cand.map(u=>`${esc(u.n)}<button type="button" data-add="${u.id}">+ добавить</button>`).join(', ')}</div>`;
 }).join('');
}
document.getElementById('advice').addEventListener('click',ev=>{const b=ev.target.closest('[data-add]');if(!b)return;
 const u=U[b.dataset.add];const order=['mech','bio','tert','dis'];
 let idx=state.steps.findIndex(s=>order.indexOf(U[s.u].st)>order.indexOf(u.st));if(idx<0)idx=state.steps.length;
 state.steps.splice(idx,0,mk(u.id));update()});


let eco=null;
function update(keepFocus){
 const sim=SeshatModel.simulate(state);
 eco=SeshatEconomics.costs(state,sim,state.prices);
 const a=document.activeElement,id=keepFocus&&a&&a.id;
 renderScheme(sim);
 if(id){const el=document.getElementById(id);if(el)el.focus()}
 renderDiagram(sim);renderResults(sim);renderEconomy(eco);renderBars();saveState();
 if(typeof renderCtx==='function')renderCtx();
}

/* ---------- экономика ---------- */
const ECO_ITEMS = [
  { k: 'energy', n: 'Электроэнергия', s: 'Энергия, ₽', c: 'var(--tert)' },
  { k: 'reagents', n: 'Реагенты', s: 'Реагенты', c: 'var(--dis)' },
  { k: 'consumables', n: 'Расходные материалы', s: 'Расходники', c: 'var(--warn)' },
  { k: 'sludge', n: 'Вывоз осадка', s: 'Осадок', c: 'var(--mech)' },
  { k: 'repair', n: 'Ремонт и обслуживание', s: 'Ремонт', c: 'var(--muted)' }
];
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

function renderPrices() {
  const box = document.getElementById('prices');
  box.innerHTML = Object.entries(SeshatData.ECON.prices).map(([k, p]) =>
    `<label class="f" for="pr-${k}"><span>${p.n}<small>${p.u}</small></span><input id="pr-${k}" ${NUM_ATTRS} value="${showNum(state.prices[k])}" placeholder="${showNum(p.v)}"></label>`).join('');
}
document.getElementById('prices').addEventListener('input', ev => {
  const t = ev.target; if (!t.id.startsWith('pr-')) return;
  const k = t.id.slice(3), v = parseNum(t.value);
  markInvalid(t, v); if (Number.isNaN(v)) return;
  state.prices[k] = v == null ? SeshatData.ECON.prices[k].v : v;
  update();
});
document.getElementById('btn-prices-reset').onclick = () => { state.prices = SeshatEconomics.defaultPrices(); renderPrices(); update(); };

function renderEconomy(eco) {
  const T = eco.total;
  const parts = ECO_ITEMS.map(it => ({ ...it, v: T[it.k] })).filter(it => it.v > 0);
  const bar = T.opex > 0 ? parts.map(it => `<span style="flex-grow:${it.v};background:${it.c}" title="${it.n}: ${rub(it.v)} ₽/сут"></span>`).join('') : '';
  const legend = parts.map(it => `<li><span class="dot" style="background:${it.c}"></span>${it.n}<b>${rub(it.v)} ₽</b><small>${(it.v / T.opex * 100).toFixed(0)}%</small></li>`).join('');
  document.getElementById('eco-structure').innerHTML = T.opex > 0
    ? `<div class="eco-bar" role="img" aria-label="Структура эксплуатационных затрат">${bar}</div><ul class="eco-legend">${legend}</ul>`
    : '<p class="hint">Добавьте ступени в схему, чтобы увидеть затраты.</p>';

  const reagTitle = r => { const k = r.reagentKg, a = []; if (k.coag) a.push(`коагулянт ${rub(k.coag)} кг/сут`); if (k.floc) a.push(`флокулянт ${rub(k.floc)} кг/сут`); if (k.meth) a.push(`метанол ${rub(k.meth)} кг/сут`); return a.join(', '); };
  const cell = (v, title) => `<td class="num"${title ? ` title="${esc(title)}"` : ''}>${v > 0 ? rub(v) : '—'}</td>`;
  let h = `<thead><tr><th class="p">Ступень</th><th>Капзатраты</th><th>Энергия, кВт·ч</th>${ECO_ITEMS.map(it => `<th title="${it.n}">${it.s}</th>`).join('')}<th>Итого, ₽</th></tr></thead><tbody>`;
  eco.steps.forEach((r, i) => {
    h += `<tr><td class="p"><b>${i + 1}. ${esc(U[r.u].n.split(' (')[0])}</b></td><td class="num">${r.capex > 0 ? mln(r.capex) : '—'}</td>${cell(r.kwh)}${cell(r.energy)}${cell(r.reagents, reagTitle(r))}${cell(r.consumables)}${cell(r.sludge)}${cell(r.repair)}<td class="num out">${rub(r.opex)}</td></tr>`;
  });
  h += `<tr class="total"><td class="p"><b>Всего</b></td><td class="num">${mln(T.capex)}</td>${cell(T.kwh)}${ECO_ITEMS.map(it => cell(T[it.k])).join('')}<td class="num out">${rub(T.opex)}</td></tr></tbody>`;
  document.getElementById('eco-table').innerHTML = h;
}

/* ---------- принципиальная схема ---------- */
function renderDiagram(sim) {
  const box = document.getElementById('diagram');
  if (!state.steps.length) { box.innerHTML = '<p class="hint">Схема пуста.</p>'; return; }
  const arrow = '<svg class="pfd-arrow" viewBox="0 0 28 12" width="22" height="10" aria-hidden="true"><path d="M1 6h24M20 2l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const end = (t, sub) => `<div class="pfd-end"><b>${t}</b><small>${sub}</small></div>`;
  const f = sim.prof[sim.prof.length - 1];
  let h = end('Сточные воды', `${rub(state.q)} м³/сут`);
  state.steps.forEach((st, i) => {
    const u = U[st.u], s = STG[u.st], ps = sim.perStep[i];
    const sl = ps.sludge > 0.5 ? `<span class="pfd-sludge" title="Осадок: ${rub(ps.sludge)} кг сухого вещества в сутки">↓ осадок</span>` : '';
    h += arrow + `<figure class="pfd-step" style="--c:${s.c}"><span class="pfd-n">${i + 1}</span>${SeshatIcons.icon(u.id, 72, u.n)}<figcaption>${esc(u.n.split(' (')[0])}</figcaption>${sl}</figure>`;
  });
  h += arrow + end('Выпуск', `БПК₅ ${fmt(f.bod)} · N-NH₄ ${fmt(f.nh4)} · P ${fmt(f.p)}`);
  box.innerHTML = h;
}

/* ---------- выгрузка и загрузка библиотеки ---------- */
document.getElementById('btn-export').onclick=()=>{
 if(!store.count()){toast('В библиотеке пока ничего нет. Сохраните профиль, схему или нормативы.');return}
 const blob=new Blob([JSON.stringify(store.exportAll(),null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=`seshat-библиотека-${new Date().toISOString().slice(0,10)}.json`;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
document.getElementById('file-import').addEventListener('change',async ev=>{
 const f=ev.target.files[0];ev.target.value='';if(!f)return;
 try{
  const r=store.importAll(JSON.parse(await f.text()));
  toast(`Загружено: ${r.added} новых, ${r.updated} обновлено${r.skipped?`, ${r.skipped} пропущено с ошибками`:''}.`);
  renderBars();
 }catch(e){toast(e instanceof SyntaxError?'Файл повреждён: это не JSON.':e.message)}
});

Object.keys(KINDS).forEach(bindBar);
renderInputs();renderPrices();renderLibrary();update();
