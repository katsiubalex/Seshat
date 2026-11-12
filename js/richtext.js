// Разметка статей базы знаний: формулы, сноски на источники, таблицы, схемы, ссылки и пометки «нужна статья».
// Работает и в браузере (статьи, редактор), и в Node (сборка, тесты).
//
// В тексте абзаца:
//   $C = Q/F$            — формула в строке (KaTeX)
//   [^3] или [^1,4]      — сноска на источник № 3 из раздела «Источники» статьи
//   [^?]                 — надёжного источника нет: так и показываем
//   [текст](#kb-p-id)    — ссылка на статью базы знаний или внешний адрес
//   ==текст==            — пометка: на эту тему нужна отдельная статья
//   **текст**            — выделение
// Блоки раздела:
//   $$ … $$              — формула отдельной строкой
//   ![подпись](fig/x.svg) — схема из content/kb/fig (встраивается при сборке)
//   | a | b |            — таблица (вторая строка — разделитель |---|)
//   - пункт, 1. пункт    — списки;  ### подзаголовок;  > цитата
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  let K = root.katex || null;
  if (!K && typeof require !== 'undefined') { try { K = require('../assets/katex/katex.min.js'); } catch (e) { K = null; } }

  /** Формула → HTML. Без KaTeX — моноширинный текст (так видно, что формула не потерялась). */
  function tex(src, display) {
    const k = K || root.katex;
    if (k) { try { return k.renderToString(src, { displayMode: !!display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }); } catch (e) { /* ниже */ } }
    return `<code class="tex">${esc(src)}</code>`;
  }
  /** Проверка формулы: текст ошибки или null (для тестов и редактора). */
  function texError(src) {
    const k = K || root.katex; if (!k) return null;
    try { k.renderToString(src, { throwOnError: true, strict: 'ignore' }); return null; } catch (e) { return String(e.message || e); }
  }

  // Разбить текст на куски: формулы ($…$, $$…$$), код (`…`) и обычный текст
  function split(text) {
    const out = [], re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|`([^`\n]+)`/g;
    let pos = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > pos) out.push({ t: 'txt', v: text.slice(pos, m.index) });
      if (m[1] != null) out.push({ t: 'math', v: m[1].trim(), d: true });
      else if (m[2] != null) out.push({ t: 'math', v: m[2].trim(), d: false });
      else out.push({ t: 'code', v: m[3] });
      pos = re.lastIndex;
    }
    if (pos < text.length) out.push({ t: 'txt', v: text.slice(pos) });
    return out;
  }

  const SAFE_HREF = /^(#[\w-]+(?:@[^\s)]*)?|https?:\/\/[^\s)]+|\.\.\/[\w/.-]+#?[\w-]*|[\w-]+\/#[\w-]+)$/;
  /**
   * Строка текста → HTML.
   * ctx.src — источники статьи [[doc, title, where, url]]; ctx.cite === false — сноски не показывать;
   * ctx.href(h) — поправить адрес ссылки (например, приставить путь к модулю).
   */
  function inline(text, ctx = {}) {
    return split(String(text || '')).map(p => {
      if (p.t === 'math') return tex(p.v, p.d);
      if (p.t === 'code') return `<code>${esc(p.v)}</code>`;
      let h = esc(p.v);
      // ссылки [текст](адрес)
      h = h.replace(/\[([^\]\n]+?)\]\(([^)\s]+)\)/g, (all, t, href) => {
        const raw = href.replace(/&amp;/g, '&');
        if (!SAFE_HREF.test(raw)) return all;
        const ext = /^https?:/.test(raw), to = ctx.href ? ctx.href(raw) : raw;
        return `<a href="${esc(to)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}${ext ? ' ↗' : ''}</a>`;
      });
      // сноски [^1], [^1,3], [^?]
      h = h.replace(/\[\^([\d,\s]+|\?)\]/g, (all, n) => {
        if (ctx.cite === false) return '';
        if (n === '?') return '<sup class="cite cite-none" title="Надёжный источник для этого утверждения не найден">[нет источника]</sup>';
        const nums = n.split(',').map(x => +x.trim()).filter(Boolean);
        return `<sup class="cite">${nums.map(k => { const s = ctx.src && ctx.src[k - 1]; return `<a href="#src-${k}" data-src="${k}" title="${s ? esc([s[1], s[2]].filter(Boolean).join(', ')) : 'источник ' + k}">${k}</a>`; }).join(',')}</sup>`;
      });
      // ==нужна статья==
      h = h.replace(/==([^=\n]+?)==/g, '<mark class="kb-want" title="Нужна отдельная статья базы знаний">$1</mark>');
      // **выделение**
      h = h.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>');
      return h;
    }).join('');
  }

  /* ---------- блоки раздела ---------- */
  const isTable = l => /^\s*\|.*\|\s*$/.test(l);
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const isVarDef = s => /^\$[^$]+\$(?:\s*,\s*\$[^$]+\$)*\s*[—–-]\s/.test(s.trim()); // «$x$ — смысл, единицы»
  /** Раздел Markdown → список блоков: {t:'p'|'ul'|'ol'|'table'|'math'|'fig'|'h3'|'quote', …} */
  function parse(raw) {
    const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n'), out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i], t = l.trim();
      if (!t) { i++; continue; }
      if (t.startsWith('$$')) { // формула отдельной строкой
        let body = t.slice(2);
        if (body.trimEnd().endsWith('$$') && body.trim().length > 2) { out.push({ t: 'math', v: body.trimEnd().slice(0, -2).trim() }); i++; continue; }
        const buf = [body]; i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) buf.push(lines[i++]);
        if (i < lines.length) buf.push(lines[i++].trim().slice(0, -2));
        out.push({ t: 'math', v: buf.join('\n').trim() }); continue;
      }
      let m;
      if ((m = /^!\[([^\]]*)\]\(fig\/([\w-]+)\.svg\)\s*$/.exec(t))) { out.push({ t: 'fig', cap: m[1], name: m[2] }); i++; continue; }
      if ((m = /^###\s+(.+)$/.exec(t))) { out.push({ t: 'h3', v: m[1] }); i++; continue; }
      if (isTable(l)) {
        const rows = [];
        while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
        const head = cells(rows[0]), body = rows.slice(1).filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(cells);
        out.push({ t: 'table', head, body }); continue;
      }
      if (/^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
        const ord = /^\d/.test(t), items = [];
        while (i < lines.length && lines[i].trim() && (ord ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
          let it = lines[i++].trim().replace(ord ? /^\d+[.)]\s+/ : /^[-*]\s+/, '');
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i])) it += ' ' + lines[i++].trim();
          items.push(it);
        }
        out.push({ t: ord ? 'ol' : 'ul', items }); continue;
      }
      if (t.startsWith('>')) {
        const buf = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) buf.push(lines[i++].trim().replace(/^>\s?/, ''));
        out.push({ t: 'quote', v: buf.join(' ') }); continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !isTable(lines[i]) && !/^\s*(\$\$|!\[|###\s|[-*]\s+|\d+[.)]\s+|>)/.test(lines[i])) buf.push(lines[i++].trim());
      out.push({ t: 'p', v: buf.join(' ') });
    }
    return out;
  }
  /** Раздел → HTML. ctx.figs — {имя: SVG}, остальное — как у inline. */
  function blocks(raw, ctx = {}) {
    const I = s => inline(s, ctx);
    return parse(raw).map(b => {
      if (b.t === 'p') return `<p>${I(b.v)}</p>`;
      if (b.t === 'h3') return `<h3>${I(b.v)}</h3>`;
      if (b.t === 'quote') return `<blockquote>${I(b.v)}</blockquote>`;
      if (b.t === 'math') return `<div class="kb-math">${tex(b.v, true)}</div>`;
      if (b.t === 'ul' || b.t === 'ol') {
        const vars = b.items.every(isVarDef);
        return `<${b.t}${vars ? ' class="kb-vars"' : ''}>${b.items.map(x => `<li>${I(x)}</li>`).join('')}</${b.t}>`;
      }
      if (b.t === 'table') return `<div class="tbl-wrap"><table class="kb-tbl"><thead><tr>${b.head.map(c => `<th>${I(c)}</th>`).join('')}</tr></thead><tbody>${b.body.map(r => `<tr>${r.map(c => `<td>${I(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      if (b.t === 'fig') {
        const svg = ctx.figs && ctx.figs[b.name];
        return `<figure class="kb-fig">${svg || `<div class="kb-fig-missing">Схема ${esc(b.name)}.svg</div>`}${b.cap ? `<figcaption>${I(b.cap)}</figcaption>` : ''}</figure>`;
      }
      return '';
    }).join('');
  }

  /** Простой текст без разметки — для поиска, подсказок и обратных ссылок. */
  function plain(text) {
    return String(text || '')
      .replace(/^\s*\|[\s:|-]+\|\s*$/gm, ' ').replace(/\$\$[\s\S]+?\$\$/g, ' ').replace(/\$([^$\n]+)\$/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]\n]+?)\]\([^)\s]+\)/g, '$1')
      .replace(/\[\^[^\]]*\]/g, '').replace(/==([^=\n]+?)==/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/^\s*(\||[-*]\s|\d+[.)]\s|###\s|>\s?)/gm, ' ').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Проверка обоснованности: у каждого абзаца, пункта списка и цитаты — сноска [^n] или честное [^?].
   * Исключения: формулы, схемы, подзаголовки, расшифровка обозначений формулы («$x$ — …»), таблицы (сноска — в абзаце перед таблицей или в ячейке).
   * @returns {{uncited:string[], bad:number[], used:Set<number>, tex:string[]}}
   */
  function audit(raw, nSrc) {
    const r = { uncited: [], bad: [], used: new Set(), tex: [] };
    const scan = s => { for (const m of String(s).matchAll(/\[\^([\d,\s]+)\]/g)) m[1].split(',').map(x => +x.trim()).filter(Boolean).forEach(k => { r.used.add(k); if (k > nSrc) r.bad.push(k); }); };
    const cited = s => /\[\^([\d,\s]+|\?)\]/.test(s);
    const texs = s => { for (const p of split(s)) if (p.t === 'math') { const e = texError(p.v); if (e) r.tex.push(`${p.v} → ${e}`); } };
    const bl = parse(raw);
    bl.forEach((b, k) => {
      if (b.t === 'p' || b.t === 'quote') { scan(b.v); texs(b.v); if (!cited(b.v) && !/^(где|здесь)\b/i.test(b.v.trim())) r.uncited.push(b.v.slice(0, 90)); }
      else if (b.t === 'ul' || b.t === 'ol') b.items.forEach(x => { scan(x); texs(x); if (!cited(x) && !isVarDef(x)) r.uncited.push(x.slice(0, 90)); });
      else if (b.t === 'table') { const all = [b.head, ...b.body].flat().join(' '); scan(all); texs(all); const prev = bl[k - 1]; if (!cited(all) && !(prev && prev.t === 'p' && cited(prev.v))) r.uncited.push('таблица: ' + b.head.join(' | ').slice(0, 80)); }
      else if (b.t === 'math') { const e = texError(b.v); if (e) r.tex.push(`${b.v} → ${e}`); }
      else if (b.t === 'h3' || b.t === 'fig') { scan(b.v || b.cap || ''); }
    });
    return r;
  }

  const api = { inline, blocks, parse, plain, audit, tex, texError, esc };
  root.SeshatRich = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
