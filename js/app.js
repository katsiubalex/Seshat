// Интерфейс конструктора. Данные — в data.js, расчёт — в model.js, библиотека пользователя — в store.js.
const { PARAMS, SHORT, STAGES, UNITS, PRESETS, NORMS } = SeshatData;
const { fmt } = SeshatModel;
const U = Object.fromEntries(UNITS.map(u => [u.id, u]));
const STG = Object.fromEntries(STAGES.map(s => [s.id, s]));
const STATE_KEY = 'seshat-state';
const store = SeshatStore.createStore(SeshatStore.localAdapter('seshat-library'));
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const clone = o => JSON.parse(JSON.stringify(o));
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

function refItem(kind, ref) {
  if (!ref) return null;
  const [t, id] = [ref[0], ref.slice(2)];
  return t === 'b' ? KINDS[kind].builtins.find(b => b.id === id) || null : store.get(kind, id);
}
function sameData(kind, a, b) { const v = SeshatStore.validate[kind]; return JSON.stringify(v(a)) === JSON.stringify(v(b)); }
function isDirty(kind) { const it = refItem(kind, state.ref[kind]); return !it || !sameData(kind, KINDS[kind].get(), it.data); }

/* ---------- текущее состояние ---------- */
let state;
function fresh() {
  const p = PRESETS[0];
  return { q: p.q, c: { ...p.c }, steps: p.scheme.map(mk), norm: { ...NORMS.pdk.v }, ref: { influent: 'b:0', scheme: 'b:0', norm: 'b:pdk' } };
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
const ui = { draft: {}, confirmDel: {} };

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
  } else if (ui.confirmDel[kind] && isMine) {
    h += `<div class="saved-actions"><span class="ask">Удалить «${esc(cur.name)}»?</span>
      <button type="button" data-act="del-yes" class="danger">Удалить</button><button type="button" data-act="del-no">Отмена</button></div>`;
  } else {
    h += `<div class="saved-actions">
      <button type="button" data-act="create">${K.createLabel}</button>
      ${isMine ? `<button type="button" data-act="save" class="${dirty ? 'primary' : ''}" ${dirty ? '' : 'disabled title="Изменений нет"'}>Сохранить</button>
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
  delete ui.draft[kind]; delete ui.confirmDel[kind];
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
  delete ui.confirmDel[kind];
  state.ref[kind] = 'new';
  renderBar(kind);
  const inp = document.getElementById('name-' + kind); inp.focus(); inp.select();
}

function bindBar(kind) {
  const el = document.getElementById('bar-' + kind);
  el.addEventListener('change', ev => { if (ev.target.id === 'sel-' + kind && ev.target.value !== 'new') openItem(kind, ev.target.value); });
  el.addEventListener('input', ev => { if (ev.target.id === 'name-' + kind && ui.draft[kind]) ui.draft[kind].name = ev.target.value; });
  el.addEventListener('click', ev => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const K = KINDS[kind], ref = state.ref[kind], cur = refItem(kind, ref);
    if (act === 'create') { startDraft(kind); return; }
    if (act === 'save' && cur) {
      const it = store.save(kind, { id: ref.slice(2), name: cur.name, data: K.get() });
      if (it) toast(`Сохранено: «${it.name}»`);
    } else if (act === 'cancel') {
      const d = ui.draft[kind]; delete ui.draft[kind];
      state.ref[kind] = d.prev.ref;
      update();
      return;
    } else if (act === 'del') { ui.confirmDel[kind] = true; }
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
    const name = document.getElementById('name-' + kind).value.trim();
    if (!name) { toast('Введите название.'); return; }
    const it = store.save(kind, { name, data: KINDS[kind].get() });
    if (!it) { toast('Не удалось сохранить: данные заполнены неверно.'); return; }
    delete ui.draft[kind];
    state.ref[kind] = 'u:' + it.id;
    toast(`Сохранено: «${it.name}»`);
    renderBar(kind); saveState();
  });
  el.addEventListener('keydown', ev => { if (ev.key === 'Escape' && ui.draft[kind]) el.querySelector('[data-act=cancel]').click(); });
}

/* ---------- ввод ---------- */
function renderInputs(){
 const box=document.getElementById('inputs');
 box.innerHTML=`<label class="f qrow" for="in-q"><span>Расход<small>м³/сут</small></span><input id="in-q" type="number" min="0" step="any" value="${state.q}"></label>`+
  PARAMS.map(p=>`<label class="f" for="in-${p.k}"><span>${p.n}<small>${p.u}</small></span><input id="in-${p.k}" type="number" min="0" step="any" value="${state.c[p.k]}"></label>`).join('');
}
document.getElementById('inputs').addEventListener('input',ev=>{const t=ev.target;if(t.id==='in-q')state.q=+t.value||0;else state.c[t.id.slice(3)]=+t.value||0;update()});
/* ---------- каталог ---------- */
function effChips(eff){return Object.entries(eff).filter(([,v])=>v>0).map(([k,v])=>`<span class="chip">${SHORT[k]} −${v}%</span>`).join('')}
function renderLibrary(){
 const box=document.getElementById('library');
 box.innerHTML=STAGES.map(s=>`<div class="stage"><div class="stage-name"><span class="dot" style="background:${s.c}"></span>${s.n}</div>`+
  UNITS.filter(u=>u.st===s.id).map(u=>`<div class="lib-item"><div><b>${esc(u.n)}</b><p>${esc(u.d)}</p></div><button type="button" data-add="${u.id}" aria-label="Добавить: ${esc(u.n)}">+</button></div>`).join('')+'</div>').join('');
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
   <div class="node-top"><div class="node-title">${i+1}. ${esc(u.n)}<small>${s.n}</small></div>
    <div class="node-ctrl"><button type="button" data-mv="${i}" data-d="-1" aria-label="Выше" ${i===0?'disabled':''}>↑</button><button type="button" data-mv="${i}" data-d="1" aria-label="Ниже" ${i===state.steps.length-1?'disabled':''}>↓</button><button type="button" data-rm="${i}" aria-label="Удалить">✕</button></div></div>
   <div class="effects">${effChips(st.eff)||'<span class="chip">без изменения химии</span>'}</div>
   ${sim.warns[i].length?`<div class="warns">${sim.warns[i].map(x=>`<div class="w">${esc(x)}</div>`).join('')}</div>`:''}
   ${Object.keys(st.eff).length?`<details class="tune" data-i="${i}" ${open.has(String(i))?'open':''}><summary>Настроить эффективность, %</summary><div class="tune-grid">${Object.keys(st.eff).map(k=>`<label for="t-${i}-${k}">${SHORT[k]}<input id="t-${i}-${k}" type="number" min="0" max="100" step="1" data-ti="${i}" data-tk="${k}" value="${st.eff[k]}"></label>`).join('')}</div></details>`:''}
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
 const t=ev.target;if(!t.dataset.ti)return;state.steps[+t.dataset.ti].eff[t.dataset.tk]=Math.min(100,Math.max(0,+t.value||0));update(true);
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
 const focus=document.activeElement&&document.activeElement.id;
 let pass=0,tot=0;const fails=[];
 let h=`<thead><tr><th class="p">Показатель</th><th>Профиль</th><th>Вход</th>${state.steps.map((s,i)=>`<th class="step">${i+1}. ${esc(U[s.u].n.split(' (')[0])}</th>`).join('')}<th>Выход</th><th>Эффект</th><th>Норматив</th><th>Статус</th></tr></thead><tbody>`;
 PARAMS.forEach(p=>{
  const n=state.norm[p.k],vals=sim.prof.map(c=>c[p.k]);let st='na';
  if(n!=null&&n!==''&&!isNaN(n)){tot++;if(f[p.k]<=n){st='ok';pass++}else{st='bad';fails.push(p.k)}}
  const inV=state.c[p.k],red=inV>0?(1-f[p.k]/inV)*100:null;
  h+=`<tr><td class="p"><b>${p.n}</b><small>${p.u}</small></td><td>${spark(vals,n,st)}</td><td class="num">${fmt(inV)}</td>${sim.prof.slice(1).map(c=>`<td class="num">${fmt(c[p.k])}</td>`).join('')}<td class="num out">${fmt(f[p.k])}</td><td class="num">${red==null?'—':(red<0?'+':'−')+Math.abs(red).toFixed(0)+'%'}</td><td class="norm"><input id="n-${p.k}" type="number" min="0" step="any" value="${n??''}" placeholder="нет" aria-label="Норматив: ${p.n}"></td><td><span class="pill ${st}">${st==='ok'?'в норме':st==='bad'?'×'+fmt(f[p.k]/n):'не задан'}</span></td></tr>`;
 });
 tbl.innerHTML=h+'</tbody>';
 tbl.oninput=ev=>{const t=ev.target;if(!t.id.startsWith('n-'))return;state.norm[t.id.slice(2)]=t.value===''?null:+t.value;update()};
 if(focus&&focus.startsWith('n-')){const el=document.getElementById(focus);if(el){el.focus();const v=el.value;el.value='';el.value=v}}
 const kwh=sim.energy*state.q;
 document.getElementById('summary').innerHTML=`
  <div class="kpi"><span>Соответствие нормативам</span><b style="color:${tot&&pass===tot?'var(--ok)':'var(--bad)'}">${pass} из ${tot}</b> <small>показателей</small></div>
  <div class="kpi"><span>Удельная энергия</span><b>${fmt(sim.energy)}</b> <small>кВт·ч/м³</small></div>
  <div class="kpi"><span>Энергия в сутки</span><b>${fmt(kwh)}</b> <small>кВт·ч/сут</small></div>
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


function update(keepFocus){
 const sim=SeshatModel.simulate(state);
 const a=document.activeElement,id=keepFocus&&a&&a.id;
 renderScheme(sim);
 if(id){const el=document.getElementById(id);if(el)el.focus()}
 renderResults(sim);renderBars();saveState();
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
renderInputs();renderLibrary();update();
