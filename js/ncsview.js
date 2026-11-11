// Расчёт стоимости строительства по НЦС 2026 на страницах сборников 19 и 14 и сверка схемы конструктора.
// Данные и формулы — js/ncs.js (SeshatNCS); здесь только разметка и обработчики.

const NCS_REGION_KEY = 'seshat-ncs-region';
function ncsRegion() { try { return localStorage.getItem(NCS_REGION_KEY) || 'Московская область'; } catch (e) { return 'Московская область'; } }
function ncsSetRegion(r) { try { localStorage.setItem(NCS_REGION_KEY, r); } catch (e) { /* без хранилища регион просто не запомнится */ } }
const ncsN = (v, d = 2) => v == null ? '—' : v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const ncsMln = v => v == null ? '—' : (v / 1000).toLocaleString('ru-RU', { maximumFractionDigits: v < 10000 ? 2 : 1 }) + ' млн ₽';
const ncsRegionSelect = (id, cur) => `<select id="${id}">${SeshatNCS.FO.map((fo, i) => `<optgroup label="${esc(fo)}">${SeshatNCS.KPER.filter(r => r[4] === i).map(r => `<option${r[0] === cur ? ' selected' : ''}>${esc(r[0])}</option>`).join('')}</optgroup>`).join('')}</select>`;
// поправочные коэффициенты, которые пользователь задаёт сам (по таблицам технической части)
const ncsKFields = (p, b) => `
  <label class="f" for="${p}-kzone"><span>Кпер/зон<small>${esc(b.kzone)}</small></span><input id="${p}-kzone" ${NUM_ATTRS} value="1"></label>
  <label class="f" for="${p}-kreg"><span>Крег<small>${esc(b.kreg)}</small></span><input id="${p}-kreg" ${NUM_ATTRS} value="1"></label>
  <label class="f" for="${p}-ks"><span>Кс, сейсмичность<small>${esc(b.ks)}</small></span><input id="${p}-ks" ${NUM_ATTRS} value="1"></label>`;
function ncsReadK(p) {
  const g = id => { const v = parseNum(document.getElementById(p + '-' + id).value); return v > 0 ? v : 1; };
  return { region: document.getElementById(p + '-reg').value, kzone: g('kzone'), kreg: g('kreg'), ks: g('ks') };
}
const ncsKLine = (k, kper) => `Кпер ${ncsN(kper)} (${esc(k.region)})${k.kzone !== 1 ? ` × Кпер/зон ${ncsN(k.kzone)}` : ''}${k.kreg !== 1 ? ` × Крег ${ncsN(k.kreg)}` : ''}${k.ks !== 1 ? ` × Кс ${ncsN(k.ks)}` : ''}`;
const NCS_MAT_GEN = { 'ВЧШГ': 'высокопрочных чугунных труб с шаровидным графитом (ВЧШГ)', 'стальные': 'стальных труб', 'железобетонные': 'железобетонных труб', 'железобетонные безнапорные раструбные': 'железобетонных безнапорных раструбных труб', 'полиэтиленовые': 'полиэтиленовых труб' };
const NCS_NOTE = 'Стоимость без НДС, без дополнительных затрат (Зр) и без индекса-дефлятора к году строительства — их добавляют по формуле технической части. Это укрупнённая оценка для сравнения вариантов, а не смета.';

Object.assign(DOC_WIDGETS, {
  // Сборник 19: здания и сооружения водоснабжения и канализации
  ncs19(box) {
    const N = SeshatNCS, B = N.BOOKS[19];
    const qDef = typeof state !== 'undefined' && state.q > 0 ? state.q : 10000;
    let gid = 'screens';
    const defM = g => g.u === 'м³/сут' ? qDef : g.u === 'м³/ч' ? Math.round(qDef / 24) : g.r[0][0];
    box.innerHTML = `<h2>Расчёт по сборнику: водоснабжение и канализация</h2>
      <p class="hint">Разделы 3 и 4 сборника — ${N.G19.length} групп показателей. Выберите сооружение и мощность; показатель для промежуточной мощности сборник велит находить интерполяцией (${B.interp}).</p>
      <div class="calc-grid ncs-grid">
        <label class="f ncs-wide" for="n19-g"><span>Здание или сооружение</span><select id="n19-g">${[['waste', 'Канализация (раздел 4)'], ['supply', 'Водоснабжение (раздел 3)']].map(([k, t]) => `<optgroup label="${t}">${N.G19.filter(g => g.k === k).map(g => `<option value="${g.id}"${g.id === gid ? ' selected' : ''}>${esc(g.n)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="f" for="n19-m"><span>Мощность<small id="n19-u"></small></span><input id="n19-m" ${NUM_ATTRS} value="${showNum(defM(N.G19.find(g => g.id === gid)))}"></label>
        <label class="f ncs-wide" for="n19-reg"><span>Субъект РФ<small>Кпер — ${esc(B.kper)}</small></span>${ncsRegionSelect('n19-reg', ncsRegion())}</label>
        ${ncsKFields('n19', B)}
      </div>
      <div class="calc-out" id="n19-out" aria-live="polite"></div>`;
    const calc = () => {
      const g = N.G19.find(x => x.id === document.getElementById('n19-g').value), M = parseNum(document.getElementById('n19-m').value), k = ncsReadK('n19');
      document.getElementById('n19-u').textContent = g.u;
      const out = document.getElementById('n19-out');
      if (!(M > 0)) { out.innerHTML = '<p>Введите мощность больше нуля.</p>'; return; }
      const r = N.cost19(g.id, M, k), kper = N.kperOf(k.region, 1);
      const used = new Set(r.p.rows.map(x => x[2]));
      const tbl = `<div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Показатель</th><th>Мощность</th><th>Норматив, тыс. руб.</th></tr></thead><tbody>${g.r.map(([m, v, n]) => `<tr class="${used.has(n) ? 'here' : ''}"><td class="p num">${N.G19.find(x => x.id === g.id).t}-${String(n).padStart(2, '0')}</td><td class="num">${ncsN(m, m % 1 ? 1 : 0)} ${esc(g.u)}</td><td class="num">${ncsN(v)}</td></tr>`).join('')}</tbody></table></div>`;
      const src = `<p class="hint">Таблица ${g.t}, с. ${g.pg[0]} сборника. Цены на ${N.DATE}, базовый район — Московская область.</p>`;
      if (r.unit == null) { out.innerHTML = `<p class="cat-res">Показатель не определяется: ${esc(N.HOW[r.p.how])}.</p>${tbl}${src}`; return; }
      out.innerHTML = `<p class="cat-res">Стоимость строительства ≈ <b>${ncsMln(r.total)}</b> <small>(${ncsN(r.total)} тыс. руб. без НДС)</small></p>
        <ol class="ncs-steps">
          <li>Показатель НЦС: <b>${ncsN(r.unit)}</b> тыс. руб. на 1 ${esc(g.u)} — ${esc(N.HOW[r.p.how])}${r.p.how === 'interp' ? ` (${r.codes.join(' и ')})` : ` (${r.codes[0]})`}.</li>
          <li>× мощность ${ncsN(M, M % 1 ? 2 : 0)} ${esc(g.u)} = ${ncsN(r.base)} тыс. руб. (Московская область).</li>
          <li>× ${ncsKLine(k, kper)} = ${ncsN(r.k, 3)} → <b>${ncsN(r.total)}</b> тыс. руб.</li>
        </ol>${tbl}${src}<p class="hint">${NCS_NOTE}</p>`;
    };
    box.addEventListener('change', ev => {
      if (ev.target.id === 'n19-g') { const g = N.G19.find(x => x.id === ev.target.value); document.getElementById('n19-m').value = showNum(defM(g)); }
      if (ev.target.id === 'n19-reg') ncsSetRegion(ev.target.value);
      calc();
    });
    box.addEventListener('input', ev => { if (ev.target.matches('input')) { markInvalid(ev.target, parseNum(ev.target.value)); calc(); } });
    calc();
  },
  // Сборник 14: наружные сети водоснабжения и канализации
  ncs14(box) {
    const N = SeshatNCS, B = N.BOOKS[14];
    const sel = { sys: 'kan', mat: 'полиэтиленовые', wet: 0, fix: 0, grp: '1-3' };
    const opts = (id, list, cur) => `<select id="${id}">${list.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    const tableId = () => { const t = N.nets(sel.sys).find(t => t.mat === sel.mat && t.wet === sel.wet && t.fix === sel.fix && t.grp === sel.grp); return t && t.id; };
    const draw = () => {
      const mats = [...new Set(N.nets(sel.sys).map(t => t.mat))];
      if (!mats.includes(sel.mat)) sel.mat = mats[0];
      const id = tableId(), ds = N.diameters(id);
      const dCur = document.getElementById('n14-d') ? +document.getElementById('n14-d').value : null;
      box.innerHTML = `<h2>Расчёт стоимости сети по сборнику</h2>
        <p class="hint">Сборник даёт стоимость 1 км трубопровода по системе, материалу, диаметру, глубине заложения и условиям разработки траншеи. Между диаметрами не интерполируют — только между глубинами (${B.interp}).</p>
        <div class="calc-grid ncs-grid">
          <label class="f" for="n14-sys"><span>Сеть</span>${opts('n14-sys', [['kan', 'Канализация'], ['vod', 'Водоснабжение']], sel.sys)}</label>
          <label class="f" for="n14-mat"><span>Трубы</span>${opts('n14-mat', mats.map(m => [m, m[0].toUpperCase() + m.slice(1)]), sel.mat)}</label>
          <label class="f" for="n14-wet"><span>Грунт</span>${opts('n14-wet', [[0, 'сухой'], [1, 'мокрый']], sel.wet)}</label>
          <label class="f" for="n14-fix"><span>Траншея</span>${opts('n14-fix', [[0, 'без креплений'], [1, 'с креплением стенок']], sel.fix)}</label>
          <label class="f" for="n14-grp"><span>Группа грунтов</span>${opts('n14-grp', [['1-3', '1–3'], ['4', '4']], sel.grp)}</label>
          <label class="f" for="n14-d"><span>Диаметр<small>мм</small></span>${opts('n14-d', ds.map(d => [d, d]), ds.includes(dCur) ? dCur : ds[Math.min(2, ds.length - 1)])}</label>
          <label class="f" for="n14-h"><span>Глубина заложения<small>м</small></span><input id="n14-h" ${NUM_ATTRS} value="${document.getElementById('n14-h') ? esc(document.getElementById('n14-h').value) : '2'}"></label>
          <label class="f" for="n14-l"><span>Длина трассы<small>км</small></span><input id="n14-l" ${NUM_ATTRS} value="${document.getElementById('n14-l') ? esc(document.getElementById('n14-l').value) : '1'}"></label>
          <label class="f ncs-wide" for="n14-reg"><span>Субъект РФ<small>Кпер — ${esc(B.kper)}</small></span>${ncsRegionSelect('n14-reg', ncsRegion())}</label>
          ${ncsKFields('n14', B)}
        </div>
        <div class="calc-out" id="n14-out" aria-live="polite"></div>`;
      calc();
    };
    const calc = () => {
      const id = tableId(), out = document.getElementById('n14-out');
      const d = +document.getElementById('n14-d').value, h = parseNum(document.getElementById('n14-h').value), L = parseNum(document.getElementById('n14-l').value), k = ncsReadK('n14');
      if (!(h > 0) || !(L > 0)) { out.innerHTML = '<p>Введите глубину и длину больше нуля.</p>'; return; }
      const r = N.net(id, d, h, L, k), t = N.T14[id], kper = N.kperOf(k.region, t[0] === 'kan' ? 3 : 2);
      const hs = (t[6].find(x => x[0] === d) || [0, []])[1];
      const usedH = new Set(r.used.map(x => x[0]));
      const tbl = `<div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Диаметр ${d} мм, глубина</th><th>тыс. руб. на 1 км</th></tr></thead><tbody>${hs.map(([hh, v]) => `<tr class="${usedH.has(hh) ? 'here' : ''}"><td class="p">${showNum(hh)} м</td><td class="num">${ncsN(v)}</td></tr>`).join('')}</tbody></table></div>`;
      const src = `<p class="hint">Таблица ${id} «${t[0] === 'kan' ? 'Наружные инженерные сети канализации' : 'Наружные инженерные сети водоснабжения'} из ${esc(NCS_MAT_GEN[t[1]] || t[1])}, ${t[2] ? 'мокрый' : 'сухой'} грунт, ${t[3] ? 'с креплением' : 'без креплений'}, группа грунтов ${t[4]}», с. ${t[5][0]} сборника. Цены на ${N.DATE}.</p>`;
      if (r.perKm == null) { out.innerHTML = `<p class="cat-res">Показатель не определяется: ${esc(N.NETHOW[r.how])}.</p>${tbl}${src}`; return; }
      out.innerHTML = `<p class="cat-res">Стоимость ≈ <b>${ncsMln(r.total)}</b> <small>(${ncsN(r.total)} тыс. руб. без НДС, ${ncsMln(r.total / L)} за 1 км)</small></p>
        <ol class="ncs-steps">
          <li>Показатель НЦС: <b>${ncsN(r.perKm)}</b> тыс. руб. на 1 км — ${esc(N.NETHOW[r.how])}.</li>
          <li>× длина ${ncsN(L, 3).replace(/,?0+$/, '')} км = ${ncsN(r.base)} тыс. руб. (Московская область).</li>
          <li>× ${ncsKLine(k, kper)} = ${ncsN(r.k, 3)} → <b>${ncsN(r.total)}</b> тыс. руб.</li>
        </ol>${tbl}${src}
        <p class="hint">Не учтены: прокладка в 2 и более нитки, вывоз грунта дальше 1 км и погрузка в самосвалы, футляры и переходы, стеснённые условия — для них в технической части сборника свои коэффициенты и таблицы (п. 17–18 и далее). ${NCS_NOTE}</p>`;
    };
    box.addEventListener('change', ev => {
      const t = ev.target;
      if (t.id === 'n14-reg') { ncsSetRegion(t.value); calc(); return; }
      if (['n14-sys', 'n14-mat', 'n14-wet', 'n14-fix', 'n14-grp'].includes(t.id)) {
        const k = t.id.slice(4); sel[k] = ['wet', 'fix'].includes(k) ? +t.value : t.value; draw(); return;
      }
      calc();
    });
    box.addEventListener('input', ev => { if (ev.target.matches('input')) { markInvalid(ev.target, parseNum(ev.target.value)); calc(); } });
    draw();
  }
});

/* ---------- сверка схемы конструктора со сборником 19 ---------- */
function renderNcsCheck(eco) {
  const box = document.getElementById('eco-ncs'); if (!box || !window.SeshatNCS) return;
  const N = SeshatNCS, reg = ncsRegion(), k = { region: reg };
  const rows = N.scheme(eco.steps.map(r => ({ u: r.u, q: r.q })), k);
  const hit = rows.filter(r => r.gid);
  let ncsSum = 0, modSum = 0;
  const tr = hit.map((r, i) => {
    const e = eco.steps[rows.indexOf(r)], c = r.c, g = N.G19.find(x => x.id === r.gid);
    if (c && c.total != null) { ncsSum += c.total / 1000; modSum += e.capex; }
    return `<tr><td class="p"><b>${esc(U[r.u].n.split(' (')[0])}</b><small>${esc(g.n)}${r.gid === 'aer' && r.u !== 'at' ? ' — ближайший аналог' : ''}</small></td><td class="num">${rub(r.q)}</td>
      <td class="p">${c && c.unit != null ? `${c.codes.join(', ')}<small>${esc(N.HOW[c.p.how])}</small>` : `<span class="hint">${esc(N.HOW[c ? c.p.how : 'below'])}</span>`}</td>
      <td class="num">${c && c.total != null ? ncsMln(c.total) : '—'}</td><td class="num">${mln(e.capex)}</td></tr>`;
  }).join('');
  box.innerHTML = `<div class="panel-head"><h3>Сверка с НЦС 2026</h3><a class="btn" href="#doc-ncs19">Расчёт по сборнику</a></div>
    <p class="hint">${hit.length ? `Для ${hit.length} из ${rows.length} ступеней` : 'Для ступеней этой схемы'} в сборнике НЦС 81-02-19-2026 есть таблицы показателей (здания решёток, песколовки, аэротенки, УФ-установки); посчитать по таблице можно, если расход через ступень попадает в её диапазон. Стоимость — ${esc(reg)} (Кпер ${ncsN(N.kperOf(reg, 1))}), без НДС. Ориентир Сешат — правило «шести десятых» от типовых затрат.</p>
    ${hit.length ? `<div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Ступень</th><th>м³/сут</th><th class="p">Показатель НЦС</th><th>По НЦС</th><th>Ориентир Сешат</th></tr></thead><tbody>${tr}
      ${ncsSum > 0 ? `<tr class="total"><td class="p"><b>Где есть показатель</b></td><td></td><td></td><td class="num">${mln(ncsSum)}</td><td class="num">${mln(modSum)}</td></tr>` : ''}</tbody></table></div>` : ''}
    <p class="hint">В сборнике нет показателей для станции целиком и для большинства технологий (МБР, SBR, доочистки): они собираются из отдельных сооружений, и для малых станций мощность часто ниже табличной. Регион меняется на странице сборника.</p>`;
}
if (typeof AFTER_UPDATE !== 'undefined') { AFTER_UPDATE.push((sim, e) => renderNcsCheck(e)); if (typeof eco !== 'undefined' && eco) renderNcsCheck(eco); }
