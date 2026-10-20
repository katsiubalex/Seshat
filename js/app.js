// Интерфейс конструктора. Данные — в data.js, расчёт — в model.js.
const { PARAMS, SHORT, STAGES, UNITS, PRESETS, NORMS } = SeshatData;
const { fmt } = SeshatModel;
const U = Object.fromEntries(UNITS.map(u => [u.id, u]));
const STG = Object.fromEntries(STAGES.map(s => [s.id, s]));
const STORE_KEY = 'seshat-state';

let state;
function mk(id) { return { u: id, eff: { ...U[id].eff } }; }
function fresh(i = 0) { const p = PRESETS[i]; return { q: p.q, c: { ...p.c }, steps: p.scheme.map(mk), normSet: 'pdk', norm: { ...NORMS.pdk.v } }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.steps && s.c && s.steps.every(x => U[x.u])) return s; } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
state = load();

/* ---------- ввод ---------- */
function renderPresets(){
 const box=document.getElementById('presets');
 box.innerHTML=PRESETS.map((p,i)=>`<button type="button" data-p="${i}">${esc(p.n)}</button>`).join('');
 box.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const ns=fresh(+b.dataset.p);ns.normSet=state.normSet;ns.norm=state.norm;state=ns;renderInputs();update()};
}
function renderInputs(){
 const box=document.getElementById('inputs');
 box.innerHTML=`<label class="f qrow" for="in-q">Расход<small>м³/сут</small><input id="in-q" type="number" min="0" step="any" value="${state.q}"></label>`+
  PARAMS.map(p=>`<label class="f" for="in-${p.k}">${p.n}<small>${p.u}</small><input id="in-${p.k}" type="number" min="0" step="any" value="${state.c[p.k]}"></label>`).join('');
 box.oninput=ev=>{const t=ev.target;if(t.id==='in-q')state.q=+t.value||0;else state.c[t.id.slice(3)]=+t.value||0;update()};
}
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
function renderNormSelect(){
 const s=document.getElementById('norm-set');
 s.innerHTML=Object.entries(NORMS).map(([k,v])=>`<option value="${k}" ${state.normSet===k?'selected':''}>${v.n}</option>`).join('');
 s.onchange=()=>{state.normSet=s.value;if(NORMS[s.value].v)state.norm={...NORMS[s.value].v};update()};
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
 tbl.oninput=ev=>{const t=ev.target;if(!t.id.startsWith('n-'))return;state.norm[t.id.slice(2)]=t.value===''?null:+t.value;state.normSet='custom';document.getElementById('norm-set').value='custom';update()};
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

function update(keepScheme){const sim=SeshatModel.simulate(state);if(!keepScheme)renderScheme(sim);else{ // обновить только подписи без пересборки полей
  const box=document.getElementById('scheme');const open=box.querySelectorAll('details[open]');renderSchemeSoft(sim,open)}
 renderResults(sim);save()}
function renderSchemeSoft(sim){ // перерисовка с сохранением фокуса в поле эффективности
 const a=document.activeElement,id=a&&a.id;renderScheme(sim);if(id){const el=document.getElementById(id);if(el)el.focus()}}

document.getElementById('btn-reset').onclick=()=>{state=fresh();renderInputs();renderNormSelect();update()};
document.getElementById('btn-copy').onclick=async ev=>{
 const txt=JSON.stringify({q:state.q,influent:state.c,scheme:state.steps},null,2);
 try{await navigator.clipboard.writeText(txt);ev.target.textContent='Скопировано'}catch(e){ev.target.textContent='Не удалось скопировать'}
 setTimeout(()=>ev.target.textContent='Копировать схему (JSON)',1600)};

renderPresets();renderInputs();renderLibrary();renderNormSelect();update();
