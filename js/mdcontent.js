// Статьи Сешат в отдельных файлах: Markdown с заголовком (front matter) → данные для сайта и обратно.
// Один файл — одна статья: content/<коллекция>/<id>.md. Сборка: node tools/build-content.js → js/content.js.
// Здесь — разбор и запись файла и схемы коллекций; модуль работает и в браузере (редактор), и в Node (сборка, тесты).
//
// Формат файла:
//   ---
//   id: nitrification            ← поля заголовка: строки, списки (- …) и списки записей (- module: … / why: …)
//   title: Нитрификация
//   ---
//   Вводный абзац.               ← до первого заголовка «## …»
//
//   ## Медленные бактерии        ← раздел: абзацы, пункты списка «- …», цитата «> …»
//   Текст раздела.
//
// Текст хранится как есть: разметка внутри абзацев не используется, поэтому скобки, звёздочки и формулы безопасны.
(function (root) {
  /* ---------- заголовок: небольшое подмножество YAML ---------- */
  const unq = v => {
    v = v.trim();
    if (v.startsWith('"')) { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
    if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
    if (v === '[]') return [];
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(x => unq(x)).filter(x => x !== '');
    return v;
  };
  const indentOf = s => s.match(/^ */)[0].length;
  function parseYaml(text) {
    const lines = text.split('\n'), out = {};
    let i = 0;
    // блочная строка: | или > (с - или без) — последующие строки с большим отступом
    const block = (style, base) => {
      const buf = [];
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > base)) buf.push(lines[i++]);
      while (buf.length && buf[buf.length - 1].trim() === '') buf.pop();
      const ind = Math.min(...buf.filter(l => l.trim()).map(indentOf));
      const body = buf.map(l => l.slice(ind));
      return style.startsWith('|') ? body.join('\n') : body.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ');
    };
    const scalar = (v, base) => (/^[|>][+-]?$/.test(v.trim()) ? block(v.trim(), base) : unq(v));
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
      const m = /^([A-Za-z_][\w-]*):(?:\s(.*))?$/.exec(line);
      if (!m) { i++; continue; }
      const key = m[1], rest = (m[2] || '').trim(); i++;
      if (rest) { out[key] = scalar(rest, 0); continue; }
      // список или пусто
      const arr = [];
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0)) {
        const l = lines[i];
        if (!l.trim()) { i++; continue; }
        const lm = /^(\s*)-\s?(.*)$/.exec(l);
        if (!lm) { i++; continue; }
        const base = lm[1].length, item = lm[2]; i++;
        const km = /^([A-Za-z_][\w-]*):(?:\s(.*))?$/.exec(item);
        if (km) { // запись: ключи на этой и следующих строках с отступом
          const obj = { [km[1]]: scalar(km[2] || '', base + 2) };
          while (i < lines.length && lines[i].trim() && indentOf(lines[i]) > base && !/^\s*-\s/.test(lines[i])) {
            const om = /^\s*([A-Za-z_][\w-]*):(?:\s(.*))?$/.exec(lines[i]); i++;
            if (om) obj[om[1]] = scalar(om[2] || '', indentOf(lines[i - 1]));
          }
          arr.push(obj);
        } else arr.push(scalar(item, base + 2));
      }
      out[key] = arr;
    }
    return out;
  }
  const needsQuote = s => s === '' || /^[\s\-?:,\[\]{}#&*!|>'"%@`]|: |\s#|\s$|^(true|false|null|yes|no|~)$/i.test(s);
  const q = s => (typeof s === 'number' ? String(s) : needsQuote(String(s)) ? JSON.stringify(String(s)) : String(s));
  function dumpYaml(meta) {
    const out = [];
    for (const [k, v] of Object.entries(meta)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) {
        if (!v.length) continue;
        out.push(`${k}:`);
        v.forEach(x => {
          if (x && typeof x === 'object') { const e = Object.entries(x); out.push(`  - ${e[0][0]}: ${q(e[0][1])}`); e.slice(1).forEach(([a, b]) => out.push(`    ${a}: ${q(b)}`)); }
          else out.push(`  - ${q(x)}`);
        });
      } else out.push(`${k}: ${q(v)}`);
    }
    return out.join('\n');
  }

  /* ---------- тело: вводная часть и разделы ---------- */
  function parse(md) {
    const text = String(md).replace(/\r\n?/g, '\n').replace(/^﻿/, '');
    let meta = {}, body = text;
    const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
    if (fm) { meta = parseYaml(fm[1]); body = text.slice(fm[0].length); }
    const parts = body.split(/^## /m), lead = blocks(parts[0]);
    const sections = parts.slice(1).map(p => { const nl = p.indexOf('\n'); const h = (nl < 0 ? p : p.slice(0, nl)).trim(); return { h, ...blocks(nl < 0 ? '' : p.slice(nl + 1)) }; });
    return { meta, lead: lead.paras.join('\n\n'), sections };
  }
  // абзацы, пункты списка и цитата раздела
  function blocks(text) {
    const paras = [], items = [], quote = [];
    let cur = [], code = 0;
    const flush = () => { if (cur.length) { paras.push(cur.join(' ').trim()); cur = []; } };
    for (const raw of text.split('\n')) {
      const l = raw.trimEnd();
      if (!l.trim()) { flush(); continue; }
      if (/^\s*[-*]\s+/.test(l)) { flush(); const it = l.replace(/^\s*[-*]\s+/, ''); if (/^`.*`$/.test(it)) code++; items.push(it.replace(/^`(.*)`$/, '$1')); continue; }
      if (/^\s*>/.test(l)) { flush(); quote.push(l.replace(/^\s*>\s?/, '')); continue; }
      cur.push(l.trim());
    }
    flush();
    return { paras: paras.filter(Boolean), items, quote: quote.join(' ').trim(), code: items.length > 0 && code === items.length };
  }
  function serialize(doc) {
    const out = ['---', dumpYaml(doc.meta), '---', ''];
    if (doc.lead) out.push(doc.lead, '');
    doc.sections.forEach(s => {
      out.push(`## ${s.h}`);
      if (s.quote) out.push(`> ${s.quote}`, '');
      (s.paras || []).forEach(p => out.push(p, ''));
      if (s.items && s.items.length) { s.items.forEach(x => out.push(`- ${s.code ? '`' + x + '`' : x}`)); out.push(''); }
      if (!s.quote && !(s.paras || []).length && !(s.items || []).length) out.push('');
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  /* ---------- коллекции: файл ↔ данные сайта ---------- */
  const list = (doc, h) => { const s = doc.sections.find(x => x.h === h); return s ? s.items : undefined; };
  const rest = (doc, skip) => doc.sections.filter(s => !skip.includes(s.h)).map(s => [s.h, s.paras.join('\n\n')]);
  const book = s => s.split(/\s*\|\s*/).slice(0, 3);
  const src = doc => list(doc, 'Источники');
  const sec = (h, text) => ({ h, paras: String(text).split(/\n\n+/) });
  const items = (h, arr, code) => (arr && arr.length ? [{ h, items: arr, code }] : []);
  const opt = (o, k, v) => { if (v !== undefined && v !== null && !(Array.isArray(v) && !v.length)) o[k] = v; return o; };
  const COLLECTIONS = {
    processes: { label: 'Физика и химия процессов', dir: 'content/kb/processes', href: id => '#kb-p-' + id, page: 'tlazolteotl', kbKey: 'PROCESSES',
      fields: { id: 'адрес статьи (латиница)', title: 'название', group: 'группа процессов' }, special: ['Уравнения', 'Ключевые числа', 'Источники'],
      toData: d => { const o = { id: d.meta.id, t: d.meta.title, g: d.meta.group, lead: d.lead }; opt(o, 'f', list(d, 'Уравнения')); o.s = rest(d, ['Уравнения', 'Ключевые числа', 'Источники']); opt(o, 'n', list(d, 'Ключевые числа')); return opt(o, 'src', src(d)); },
      fromData: x => ({ meta: { id: x.id, title: x.t, group: x.g }, lead: x.lead, sections: [...items('Уравнения', x.f, true), ...x.s.map(([h, t]) => sec(h, t)), ...items('Ключевые числа', x.n), ...items('Источники', x.src)] }) },
    indicators: { label: 'Показатели качества воды', dir: 'content/kb/indicators', href: id => '#kb-i-' + id, page: 'tlazolteotl', kbKey: 'INDICATORS',
      fields: { id: 'адрес статьи', key: 'показатель в расчёте конструктора (если есть)', title: 'название', unit: 'единицы', typical: 'типичные значения в городских стоках' }, special: ['Что это', 'Почему важно', 'Как снижают', 'Источники'],
      toData: d => { const S = h => (d.sections.find(s => s.h === h) || { paras: [] }).paras.join('\n\n'); const o = { id: d.meta.id }; opt(o, 'k', d.meta.key); Object.assign(o, { t: d.meta.title, u: d.meta.unit, typ: d.meta.typical, what: S('Что это'), why: S('Почему важно'), how: S('Как снижают') }); return opt(o, 'src', src(d)); },
      fromData: x => ({ meta: { id: x.id, key: x.k, title: x.t, unit: x.u, typical: x.typ }, lead: '', sections: [sec('Что это', x.what), sec('Почему важно', x.why), sec('Как снижают', x.how), ...items('Источники', x.src)] }) },
    aux: { label: 'Вспомогательные здания', dir: 'content/kb/aux', href: id => '#kb-a-' + id, page: 'tlazolteotl', kbKey: 'AUX',
      fields: { id: 'адрес статьи', title: 'название', proc: 'процессы (id статей)' }, special: ['Ключевые числа', 'Источники'],
      toData: d => { const o = { id: d.meta.id, t: d.meta.title, lead: d.lead, s: rest(d, ['Ключевые числа', 'Источники']) }; opt(o, 'n', list(d, 'Ключевые числа')); opt(o, 'proc', d.meta.proc); return opt(o, 'src', src(d)); },
      fromData: x => ({ meta: { id: x.id, title: x.t, proc: x.proc }, lead: x.lead, sections: [...x.s.map(([h, t]) => sec(h, t)), ...items('Ключевые числа', x.n), ...items('Источники', x.src)] }) },
    fundamentals: { label: 'Основы: дисциплины', dir: 'content/kb/fundamentals', href: id => '#kb-f-' + id, page: 'hub', kbKey: 'FUNDAMENTALS',
      fields: { id: 'адрес статьи', title: 'название', home: 'модуль «Основ» (fundamentals или basics)', mods: 'где пригодится (модули)' }, special: ['Ключевые формулы', 'Учебники', 'Источники'],
      toData: d => { const o = { id: d.meta.id, home: d.meta.home, t: d.meta.title, lead: d.lead }; opt(o, 'f', list(d, 'Ключевые формулы')); o.s = rest(d, ['Ключевые формулы', 'Учебники', 'Источники']); o.books = (list(d, 'Учебники') || []).map(book); o.mods = d.meta.mods || []; return opt(o, 'src', src(d)); },
      fromData: x => ({ meta: { id: x.id, title: x.t, home: x.home, mods: x.mods }, lead: x.lead, sections: [...items('Ключевые формулы', x.f, true), ...x.s.map(([h, t]) => sec(h, t)), ...items('Учебники', x.books.map(b => b.join(' | '))), ...items('Источники', x.src)] }) },
    humanities: { label: 'Человек и вода', dir: 'content/kb/humanities', href: id => '#kb-h-' + id, page: 'humanities', kbKey: 'HUMANITIES',
      fields: { id: 'адрес статьи', title: 'название' }, special: ['Почитать', 'Источники'],
      toData: d => { const o = { id: d.meta.id, t: d.meta.title, lead: d.lead, s: rest(d, ['Почитать', 'Источники']), books: (list(d, 'Почитать') || []).map(book) }; return opt(o, 'src', src(d)); },
      fromData: x => ({ meta: { id: x.id, title: x.t }, lead: x.lead, sections: [...x.s.map(([h, t]) => sec(h, t)), ...items('Почитать', x.books.map(b => b.join(' | '))), ...items('Источники', x.src)] }) },
    // расчёт водопроводной сети («Сети водоснабжения»); источники — «документ | название | где | ссылка»
    network: { label: 'Расчёт водопроводной сети', dir: 'content/kb/network', href: id => '#kb-n-' + id, page: 'juturna', kbKey: 'NETWORK',
      fields: { id: 'адрес статьи', title: 'название', need: 'что ещё не подтверждено источником', tool: 'как попробовать в конструкторе' }, special: ['Формулы', 'Ключевые числа', 'Источники'],
      toData: d => { const o = { id: d.meta.id, t: d.meta.title, lead: d.lead }; opt(o, 'f', list(d, 'Формулы')); o.s = rest(d, ['Формулы', 'Ключевые числа', 'Источники']); opt(o, 'n', list(d, 'Ключевые числа'));
        o.src = (list(d, 'Источники') || []).map(x => { const [doc, t, where, url] = x.split(/\s*\|\s*/); const r = [doc && doc !== '—' ? doc : null, t || '', where || '']; if (url) r.push(url); return r; });
        opt(o, 'need', d.meta.need); return opt(o, 'tool', d.meta.tool); },
      fromData: x => ({ meta: { id: x.id, title: x.t, need: x.need, tool: x.tool }, lead: x.lead, sections: [...items('Формулы', x.f, true), ...x.s.map(([h, t]) => sec(h, t)), ...items('Ключевые числа', x.n),
        ...items('Источники', x.src.map(([doc, t, where, url]) => [doc || '—', t, where || ''].concat(url ? [url] : []).join(' | ')))] }) },
    myths: { label: 'Мифы о воде', dir: 'content/myths', href: id => '#lore-' + id, page: 'humanities',
      fields: { id: 'адрес статьи', name: 'имя', native: 'имя в оригинале', epithet: 'кто это (эпитет)', culture: 'культура', about: '«о боге», «о богине» или «о легенде»', legend: 'кратко, 1–2 предложения', mods: 'созвучные модули: module и why', sources: 'источники: title и url' },
      special: [],
      toData: d => ({ id: d.meta.id, culture: d.meta.culture, about: d.meta.about, legend: d.meta.legend, mods: (d.meta.mods || []).map(m => [m.module, m.why]),
        name: d.meta.name, native: d.meta.native, epithet: d.meta.epithet, lead: d.lead,
        chapters: d.sections.map(s => { const i = s.h.indexOf(': '); const c = { k: i < 0 ? s.h : s.h.slice(0, i), t: i < 0 ? s.h : s.h.slice(i + 2) }; if (s.quote) c.q = s.quote; c.p = s.paras; return c; }),
        sources: (d.meta.sources || []).map(s => [s.title, s.url || null]) }),
      fromData: x => ({ meta: { id: x.id, name: x.name, native: x.native, epithet: x.epithet, culture: x.culture, about: x.about, legend: x.legend,
        mods: x.mods.map(([module, why]) => ({ module, why })), sources: x.sources.map(([title, url]) => (url ? { title, url } : { title })) },
        lead: x.lead, sections: x.chapters.map(c => ({ h: `${c.k}: ${c.t}`, quote: c.q, paras: c.p })) }) }
  };
  // порядок статей задаёт поле order; без него — по id
  const ordered = docs => docs.slice().sort((a, b) => (Number(a.meta.order) || 1e9) - (Number(b.meta.order) || 1e9) || String(a.meta.id).localeCompare(String(b.meta.id)));

  // Проверка статьи: ошибки не дают собрать сайт, предупреждения — повод доработать
  function validate(coll, doc) {
    const C = COLLECTIONS[coll], err = [], warn = [];
    if (!C) return { err: ['Неизвестная коллекция: ' + coll], warn };
    if (!doc.meta.id || !/^[a-z0-9-]+$/.test(doc.meta.id)) err.push('Поле id: только латинские строчные буквы, цифры и дефис — это адрес статьи.');
    const nameKey = coll === 'myths' ? 'name' : 'title';
    if (!doc.meta[nameKey]) err.push(`Нет поля ${nameKey} — названия статьи.`);
    if (coll === 'indicators') ['Что это', 'Почему важно', 'Как снижают'].forEach(h => { if (!doc.sections.some(s => s.h === h && s.paras.length)) err.push(`Нет раздела «## ${h}».`); });
    else if (coll !== 'myths' && !doc.lead) err.push('Нет вводного абзаца перед первым разделом.');
    const body = doc.sections.filter(s => !(C.special || []).includes(s.h));
    if (coll !== 'indicators' && !body.length) err.push('Нет ни одного раздела «## …» с текстом.');
    body.forEach(s => { if (!s.paras.length && !s.items.length && !s.quote) warn.push(`Раздел «${s.h}» пустой.`); });
    if (coll === 'myths') {
      if (!(doc.meta.sources || []).some(s => s.url)) err.push('Укажите хотя бы один источник со ссылкой (sources: title и url).');
      if (!(doc.meta.mods || []).length) warn.push('Нет созвучных модулей (mods).');
    } else if (!(list(doc, 'Источники') || []).length) warn.push('Нет раздела «## Источники»: по правилам у каждого факта должен быть источник.');
    return { err, warn };
  }

  const api = { parse, serialize, parseYaml, dumpYaml, COLLECTIONS, ordered, validate };
  root.SeshatMD = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
