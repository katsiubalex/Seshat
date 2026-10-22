// Отображение раздела «Нормативные документы»: список и страница документа с интерактивными блоками.

const docsUI = { q: '', group: '' };
const DOCS_BY_ID = Object.fromEntries(SeshatDocs.DOCS.map(d => [d.id, d]));
const nf = (v, d = 2) => v == null ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: d });

/* ---------- список ---------- */
function renderDocList() {
  const root = document.getElementById('docs-root');
  const groups = [...new Set(SeshatDocs.DOCS.map(d => d.group))];
  root.innerHTML = `<header class="docs-head"><div>
      <h1>Нормативные документы</h1>
      <p class="sub">Законы, справочники наилучших доступных технологий, своды правил и нормативы качества воды, на которых строится расчёт очистных сооружений. Откройте документ, чтобы прочитать суть, посмотреть таблицы и перейти к оригиналу.</p>
    </div></header>
    <div class="docs-tools">
      <input id="docs-search" type="search" class="lib-search" placeholder="Найти: «НДТ», «ПДК», «санитарная зона», «1430»…" aria-label="Поиск по документам" value="${esc(docsUI.q)}">
      <div class="docs-chips" role="group" aria-label="Группы документов">
        <button type="button" class="chip-btn${docsUI.group ? '' : ' on'}" data-group="">Все</button>
        ${groups.map(g => `<button type="button" class="chip-btn${docsUI.group === g ? ' on' : ''}" data-group="${esc(g)}">${esc(g)}</button>`).join('')}
      </div>
    </div>
    <div class="docs-grid" id="docs-grid"></div>
    <p class="hint docs-note">Перед использованием документа в работе проверьте его действующую редакцию: нормативные акты регулярно изменяются.</p>`;
  renderDocCards();
}
function renderDocCards() {
  const q = docsUI.q.trim().toLowerCase().replace(/ё/g, 'е');
  const list = SeshatDocs.DOCS.filter(d => (!docsUI.group || d.group === docsUI.group) &&
    (!q || [d.short, d.title, d.type, d.about, d.num || '', ...d.points].join(' ').toLowerCase().replace(/ё/g, 'е').includes(q)));
  const grid = document.getElementById('docs-grid');
  grid.innerHTML = list.length ? list.map(d => `<a class="doc-card" href="#doc-${d.id}">
      <span class="doc-id">${esc(d.short)}</span>
      <span class="doc-card-type">${esc(d.type)} · ${esc(d.date)}</span>
      <b>${esc(d.title)}</b>
      <span class="doc-card-about">${esc(d.about.split('. ')[0])}.</span>
      <span class="doc-card-go">${d.interactive ? 'Открыть, есть интерактивная таблица' : 'Открыть'}</span>
    </a>`).join('') : `<div class="empty">Ничего не найдено по запросу «${esc(docsUI.q)}».</div>`;
}

/* ---------- страница документа ---------- */
function renderDocPage(id) {
  const d = DOCS_BY_ID[id], root = document.getElementById('docs-root');
  if (!d) { renderDocList(); return; }
  root.innerHTML = `<article class="doc-page">
    <a class="doc-back" href="#docs">← Все документы</a>
    <header class="doc-head">
      <span class="doc-id">${esc(d.short)}</span>
      <p class="doc-meta">${esc(d.type)} от ${esc(d.date)}${d.num ? ` № ${esc(d.num)}` : ''} · ${esc(d.group)}</p>
      <h1>${esc(d.title)}</h1>
      <p class="doc-lead">${esc(d.about)}</p>
    </header>
    <div class="doc-layout">
      <div class="doc-main">
        <section class="panel"><h2>Что важно для очистных сооружений</h2><ul class="doc-points">${d.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>
        ${d.interactive ? `<section class="panel doc-interactive" id="doc-int"></section>` : ''}
        <section class="panel doc-seshat"><h2>В Сешат</h2><p>${esc(d.seshat)}</p>${d.go ? `<p><a class="btn" href="#${d.go[0]}" data-go="${d.go[0]}">${esc(d.go[1])}</a></p>` : ''}</section>
      </div>
      <aside class="doc-side">
        <section class="panel"><h2>Оригинал</h2>
          <ul class="doc-links">${d.links.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a></li>`).join('')}</ul>
          <p class="hint">Полный текст и действующая редакция — по ссылкам. Здесь — краткое изложение для учебных целей.</p>
        </section>
        ${d.related && d.related.length ? `<section class="panel"><h2>Связанные документы</h2><ul class="doc-rel">${d.related.map(r => DOCS_BY_ID[r]).filter(Boolean).map(r => `<li><a href="#doc-${r.id}"><span class="doc-id">${esc(r.short)}</span>${esc(r.title.length > 80 ? r.title.slice(0, 78) + '…' : r.title)}</a></li>`).join('')}</ul></section>` : ''}
      </aside>
    </div>
  </article>`;
  if (d.interactive) DOC_WIDGETS[d.interactive](document.getElementById('doc-int'));
}

/* ---------- интерактивные блоки ---------- */
const DOC_WIDGETS = {
  // Справочник ИТС 10-2019: карта разделов, НДТ 7–9 и сверка каталога Сешат
  its(box) {
    const I = SeshatITS, U2 = Object.fromEntries(UNITS.map(u => [u.id, u]));
    let tab = 'map';
    const order = ['ndt', 'group', 'psv', 'persp', 'old', 'none'];
    const draw = () => {
      let body = '';
      if (tab === 'map') body = `<p class="hint">Номера страниц — сквозная нумерация документа. Ссылка открывает официальный PDF Бюро НДТ на этой странице.</p>
        <ol class="its-toc">${I.TOC.map(([t, p]) => `<li><span>${esc(t)}</span>${I.pg(p)}</li>`).join('')}</ol>`;
      else if (tab === 'ndt') {
        const codes = Object.keys(I.NDT).filter(c => /^[4-9]/.test(c));
        body = `<p class="hint">НДТ 4 — общие требования к технологиям очистки, НДТ 5–6 — поверхностный сток, НДТ 7–9 — выбор биологической очистки по мощности станции и категории водоёма. В последнем столбце — технологии каталога Сешат, которые справочник относит к этим НДТ.</p>
          <div class="tbl-wrap"><table class="doc-tbl its-ndt-tbl"><thead><tr><th class="p">НДТ</th><th class="p">Технология</th><th class="p">В каталоге</th></tr></thead><tbody>
          ${codes.map(c => { const us = Object.entries(I.UNITS).filter(([, v]) => (v.ndt || []).includes(c)).map(([k]) => k).filter(k => U2[k]);
            return `<tr><td class="p"><b>${esc(c)}</b> ${I.pg(I.NDT[c][1])}</td><td class="p">${esc(I.NDT[c][0])}</td><td class="p">${us.map(k => `<a href="#kb-u-${k}">${esc(U2[k].n.split(' (')[0])}</a>`).join(', ') || '—'}</td></tr>`; }).join('')}
          </tbody></table></div>`;
      } else {
        const counts = order.map(k => [k, UNITS.filter(u => I.UNITS[u.id] && I.UNITS[u.id].st === k).length]);
        body = `<p class="hint">Все ${UNITS.length} технологий каталога сверены со справочником. ${counts.map(([k, n]) => `<span class="its-badge its-${k}">${esc(I.STATUS[k].t)}</span> ${n}`).join(' · ')}</p>
          ${order.map(k => { const list = UNITS.filter(u => I.UNITS[u.id] && I.UNITS[u.id].st === k); if (!list.length) return '';
            return `<h3>${esc(I.STATUS[k].t)}</h3><p class="hint">${esc(I.STATUS[k].d)}</p><div class="tbl-wrap"><table class="doc-tbl"><tbody>${list.map(u => { const v = I.UNITS[u.id], r = v.refs[0];
              return `<tr><td class="p"><a href="#kb-u-${u.id}">${esc(u.n)}</a></td><td class="p">${esc(v.its)}</td><td class="p">${I.ndtChips(v.ndt)}</td><td>${I.pg(r[1])}</td></tr>`; }).join('')}</tbody></table></div>`; }).join('')}`;
      }
      box.innerHTML = `<h2>Справочник в Сешат</h2>
        <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab === 'map'}" data-tab="map">Карта справочника</button><button type="button" role="tab" aria-selected="${tab === 'ndt'}" data-tab="ndt">НДТ 4–9</button><button type="button" role="tab" aria-selected="${tab === 'cat'}" data-tab="cat">Сверка каталога</button></div>
        ${body}`;
    };
    box.addEventListener('click', ev => { const t = ev.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); } });
    draw();
  },
  // Технологические показатели НДТ: таблица, текущая категория по расходу, применение в конструкторе
  ndt(box) {
    const D = SeshatData, cols = [['ss', 'Взв. в-ва'], ['cod', 'ХПК'], ['bod', 'БПК₅'], ['nh4', 'N-NH₄'], ['no3', 'N-NO₃'], ['no2', 'N-NO₂'], ['p', 'P-PO₄']];
    const scols = [['ss', 'Взв. в-ва'], ['oil', 'Нефтепр.'], ['cod', 'ХПК'], ['bod', 'БПК₅'], ['p', 'P-PO₄']];
    let tab = 'm';
    const draw = () => {
      const q = state.q;
      const mixed = D.NDT_MIXED.map(([cat, cap, from, to, v, note], i) => {
        const here = D.ndtKey(q, cat) === 'ndt_m' + i;
        return `<tr class="${here ? 'here' : ''}"><td class="p"><b>${cat}</b></td><td class="p cap">${esc(cap)}${note ? `<small>${esc(note)}</small>` : ''}</td>${cols.map(([k]) => `<td class="num">${nf(v[k])}</td>`).join('')}<td><button type="button" class="apply" data-norm="ndt_m${i}">Применить</button></td></tr>`;
      }).join('');
      const surf = D.NDT_SURFACE.map(([cat, v]) => `<tr><td class="p"><b>${cat}</b></td>${scols.map(([k]) => `<td class="num">${nf(v[k])}</td>`).join('')}<td><button type="button" class="apply" data-norm="ndt_s${cat}">Применить</button></td></tr>`).join('');
      box.innerHTML = `<h2>Технологические показатели, мг/л</h2>
        <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab === 'm'}" data-tab="m">Городские стоки</button><button type="button" role="tab" aria-selected="${tab === 's'}" data-tab="s">Поверхностные стоки</button></div>
        ${tab === 'm' ? `<p class="hint">При расходе <b>${rub(q)} м³/сут</b> из конструктора очистные — <b>${D.capacityName(q)}</b>; подходящие строки выделены.</p>
          <div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Объект</th><th class="p">Очистные сооружения</th>${cols.map(([, n]) => `<th>${n}</th>`).join('')}<th></th></tr></thead><tbody>${mixed}</tbody></table></div>`
        : `<p class="hint">Для всех категорий очистных сооружений по мощности.</p>
          <div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Объект</th>${scols.map(([, n]) => `<th>${n}</th>`).join('')}<th></th></tr></thead><tbody>${surf}</tbody></table></div>`}
        <p class="hint">Среднегодовые концентрации, не более. Азот — в пересчёте на азот, фосфор — фосфор фосфатов. Для водоёмов — источников питьевого водоснабжения двух и более регионов ХПК не выше 40 мг/л.</p>`;
    };
    box.addEventListener('click', ev => {
      const t = ev.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
      const a = ev.target.closest('[data-norm]'); if (a) applyNorm(a.dataset.norm);
    });
    draw();
  },
  // Категория реки по критериям ПП № 1379
  rivercat(box) {
    box.innerHTML = `<h2>Какая категория у реки?</h2>
      <p class="hint">Критерии для рек — по качеству воды в замыкающем створе. Введите среднегодовые значения.</p>
      <div class="calc-grid">
        <label class="f" for="rc-p"><span>Фосфаты<small>мг P/л</small></span><input id="rc-p" ${NUM_ATTRS} value="0,1"></label>
        <label class="f" for="rc-n"><span>Сумма азотных ионов<small>мг/л</small></span><input id="rc-n" ${NUM_ATTRS} value="0,8"></label>
        <label class="f" for="rc-o1"><span>Кислород в июле<small>мг/л</small></span><input id="rc-o1" ${NUM_ATTRS} value="7"></label>
        <label class="f" for="rc-o2"><span>Кислород в январе<small>мг/л</small></span><input id="rc-o2" ${NUM_ATTRS} value="5"></label>
      </div>
      <div class="calc-out" id="rc-out" aria-live="polite"></div>
      <p class="hint">Озёра, водохранилища, моря и особо охраняемые территории относятся к категориям по своему типу, а не по этим критериям.</p>`;
    const calc = () => {
      const g = id => parseNum(document.getElementById(id).value);
      const p = g('rc-p'), n = g('rc-n'), o1 = g('rc-o1'), o2 = g('rc-o2');
      const out = document.getElementById('rc-out');
      if ([p, n, o1, o2].some(v => v == null || Number.isNaN(v))) { out.innerHTML = '<p>Заполните все четыре значения.</p>'; return; }
      const cat = p <= 0.05 && n <= 0.5 && o1 > 7.5 && o2 > 4 ? 'Г' : p <= 0.15 && n <= 1 && o1 > 6 && o2 > 4 ? 'В' : 'Б';
      const why = cat === 'Г' ? 'вода соответствует самым строгим критериям' : cat === 'В' ? 'фосфаты не выше 0,15, азот не выше 1, кислорода достаточно' : 'река не проходит критерии категорий В и Г';
      const key = SeshatData.ndtKey(state.q, cat);
      out.innerHTML = `<p class="cat-res">Категория <b>${cat}</b> — ${why}.</p>
        <button type="button" class="apply primary" data-norm="${key}">Применить НДТ категории ${cat} для ${rub(state.q)} м³/сут</button>`;
    };
    box.addEventListener('input', calc);
    box.addEventListener('click', ev => { const a = ev.target.closest('[data-norm]'); if (a) applyNorm(a.dataset.norm); });
    calc();
  },
  // Санитарно-защитная зона по таблице 7.1.2 СанПиН 2.2.1/2.1.1.1200-03
  szz(box) {
    const rows = [
      ['Механическая и биологическая очистка с иловыми площадками для сброженных осадков', [150, 200, 400, 500]],
      ['Механическая и биологическая очистка с термомеханической обработкой осадка в закрытых помещениях', [100, 150, 300, 400]],
      ['Насосные станции, аварийно-регулирующие резервуары, локальные очистные сооружения', [15, 20, 20, 30]],
      ['Поля фильтрации', [200, 300, 500, 1000]],
      ['Поля орошения', [150, 200, 400, 1000]],
      ['Биологические пруды', [200, 200, 300, 300]]
    ];
    const bands = ['до 0,2', 'более 0,2 до 5', 'более 5 до 50', 'более 50 до 280'];
    let row = 1;
    const draw = () => {
      const q = state.q, t = q / 1000, band = t <= 0.2 ? 0 : t <= 5 ? 1 : t <= 50 ? 2 : t <= 280 ? 3 : -1;
      const small = q <= 50 && row <= 1;
      const val = band < 0 ? null : small ? 100 : rows[row][1][band];
      box.innerHTML = `<h2>Санитарно-защитная зона</h2>
        <label class="f szz-sel" for="szz-row"><span>Тип сооружений</span><select id="szz-row">${rows.map((r, i) => `<option value="${i}" ${i === row ? 'selected' : ''}>${esc(r[0])}</option>`).join('')}</select></label>
        <p class="calc-out cat-res">${band < 0 ? `При ${rub(q)} м³/сут (больше 280 тыс.) размер зоны устанавливается индивидуально.` : `При ${rub(q)} м³/сут из конструктора санитарно-защитная зона — <b>${val} м</b>${small ? ' (сооружения до 50 м³/сут, примечание 2)' : ''}.`}</p>
        <div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Сооружения</th>${bands.map(b => `<th>${b} тыс. м³/сут</th>`).join('')}</tr></thead><tbody>
          ${rows.map((r, i) => `<tr class="${i === row ? 'sel-row' : ''}"><td class="p">${esc(r[0])}</td>${r[1].map((v, j) => `<td class="num${i === row && j === band ? ' here' : ''}">${v}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <p class="hint">Таблица 7.1.2, расстояния в метрах. Расход для расчёта меняется в конструкторе.</p>`;
    };
    box.addEventListener('change', ev => { if (ev.target.id === 'szz-row') { row = +ev.target.value; draw(); document.getElementById('szz-row').focus(); } });
    draw();
  },
  // Рыбохозяйственные нормативы: что проверено по приказу № 296 и что в наборе Сешат
  pdk(box) {
    const set = SeshatData.NORMS.pdk.v;
    const rows = [
      ['БПК₅', 'не более 2,1 мг O₂/л', set.bod, 'мг O₂/л'],
      ['БПК полн.', 'не более 3,0 мг O₂/л', null, ''],
      ['Взвешенные вещества', 'прирост к фону не более 0,25 мг/л (высшая и первая категории) или 0,75 мг/л (вторая)', set.ss, 'мг/л'],
      ['Растворённый кислород', 'не ниже 6,0 мг/л; подо льдом — 6,0 или 4,0 мг/л для второй категории', null, ''],
      ['pH', '6,5–8,5', null, ''],
      ['Температура', 'повышение не более чем на 5 °C', null, '']
    ];
    const old = [
      ['Аммоний-ион', '0,5 мг/л NH₄⁺', set.nh4, 'мг N/л'],
      ['Нитрит-ион', '0,08 мг/л NO₂⁻', set.no2, 'мг N/л'],
      ['Нитрат-ион', '40 мг/л NO₃⁻', set.no3, 'мг N/л'],
      ['Фосфаты', '0,05 / 0,15 / 0,2 мг P/л — олиго-, мезо- и эвтрофные водоёмы', set.p, 'мг P/л'],
      ['Нефтепродукты', '0,05 мг/л', set.oil, 'мг/л']
    ];
    const tr = ([n, norm, v, u]) => `<tr><td class="p"><b>${n}</b></td><td class="p">${esc(norm)}</td><td class="num">${v == null ? '<span class="hint">не задан</span>' : nf(v, 3) + ' ' + u}</td></tr>`;
    box.innerHTML = `<h2>Нормативы и набор в Сешат</h2>
      <div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Показатель</th><th class="p">Приказ № 296 (действует)</th><th>В наборе Сешат</th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div>
      <h3>Значения из приказа № 552 (утратил силу 01.09.2025)</h3>
      <div class="tbl-wrap"><table class="doc-tbl"><thead><tr><th class="p">Показатель</th><th class="p">ПДК по приказу № 552</th><th>В наборе Сешат</th></tr></thead><tbody>${old.map(tr).join('')}</tbody></table></div>
      <p class="hint">ПДК ионов в наборе пересчитаны на азот и фосфор. Сверьте их с приложением 2 к приказу № 296, а норматив по взвешенным веществам задайте сами: он зависит от фона водоёма.</p>
      <button type="button" class="apply primary" data-norm="pdk">Применить набор «ПДК рыбохоз.» в конструкторе</button>`;
    box.addEventListener('click', ev => { const a = ev.target.closest('[data-norm]'); if (a) applyNorm(a.dataset.norm); });
  }
};

function applyNorm(key) {
  if (!key || !SeshatData.NORMS[key]) return;
  openItem('norm', 'b:' + key);
  toast(`Нормативы «${SeshatData.NORMS[key].n}» применены в конструкторе`);
  go('constructor');
}

/* ---------- события и маршрут ---------- */
document.getElementById('docs-root').addEventListener('input', ev => {
  if (ev.target.id === 'docs-search') { docsUI.q = ev.target.value; renderDocCards(); }
});
document.getElementById('docs-root').addEventListener('click', ev => {
  const c = ev.target.closest('[data-group]'); if (!c) return;
  docsUI.group = c.dataset.group;
  document.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('on', b === c));
  renderDocCards();
});
VIEW_RENDER.docs = id => { if (id) renderDocPage(id); else renderDocList(); };
