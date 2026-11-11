// Библиотека пользователя: сохранённые профили стоков, схемы очистки, наборы нормативов и проекты.
// Хранилище подключается через адаптер { read(), write(obj) }. Сейчас это localStorage браузера;
// для аккаунтов достаточно добавить адаптер, который синхронизирует тот же объект с сервером.
(function (root) {
  const D = root.SeshatData || (typeof require !== 'undefined' ? require('./data.js') : null);
  const G = root.SeshatGraph || (typeof require !== 'undefined' ? require('./graph.js') : null);
  const KINDS = ['influent', 'scheme', 'norm', 'project'];
  const MAX_VARIANTS = 6;
  const FORMAT = 'seshat-library';
  const VERSION = 1;

  const isNum = v => typeof v === 'number' && isFinite(v) && v >= 0;
  const unitIds = () => new Set(D.UNITS.map(u => u.id));
  const paramKeys = () => D.PARAMS.map(p => p.k);

  /**
   * Перевод схем, сохранённых до версии 0.50, на новый каталог (ИТС 10-2019, табл. 2.1: подпроцессы):
   * «Реагентная дефосфатация» (chemP) была отдельной ступенью — теперь это ввод коагулянта в сооружение-хозяина (dose);
   * вторичный отстойник был спрятан в аэротенке — теперь это отдельное сооружение sec после биореактора с илом.
   */
  function migrateSteps(input) {
    if (!Array.isArray(input)) return input;
    const U = Object.fromEntries(D.UNITS.map(u => [u.id, u]));
    let steps = G.norm(input.map(s => ({ ...s, eff: { ...(s && s.eff || {}) } })));
    for (let k = steps.findIndex(s => s.u === 'chemP'); k >= 0; k = steps.findIndex(s => s.u === 'chemP')) {
      const preds = G.preds(steps), seen = new Set([k]);
      let queue = [...preds[k]], host = -1;
      while (queue.length && host < 0) { const j = queue.shift(); if (seen.has(j)) continue; seen.add(j); if (U[steps[j].u] && U[steps[j].u].doseAt) host = j; else queue.push(...preds[j]); }
      if (host < 0) { queue = [...steps[k].to]; while (queue.length && host < 0) { const j = queue.shift(); if (seen.has(j)) continue; seen.add(j); if (U[steps[j].u] && U[steps[j].u].doseAt) host = j; else queue.push(...steps[j].to); } }
      if (host >= 0 && !steps[host].dose) steps[host] = { ...steps[host], dose: 'fe' };
      steps = G.remove(steps, k);
    }
    for (let i = 0; i < steps.length; i++) {
      const u = U[steps[i].u]; if (!u || !u.mlss || steps[i].idle) continue;
      const down = new Set(), q = [...steps[i].to];
      while (q.length) { const j = q.shift(); if (down.has(j)) continue; down.add(j); q.push(...steps[j].to); }
      if ([...down].some(j => U[steps[j].u] && U[steps[j].u].sep)) continue;
      steps = G.insertAfter(steps, i, { u: 'sec', eff: {} });
      const pos = G.lastPos(); i = pos[i];
    }
    return steps;
  }

  /** Линия осадка схемы: стабилизация и очистка фугата (data.SLUDGE); null — по умолчанию (без стабилизации и очистки) */
  function sludgeLine(v) {
    if (!v || typeof v !== 'object' || !D.SLUDGE) return null;
    const stab = D.SLUDGE.stab[v.stab] ? v.stab : 'none', reject = D.SLUDGE.reject[v.reject] ? v.reject : 'none';
    return stab === 'none' && reject === 'none' ? null : { stab, reject };
  }

  // Проверка и очистка данных: возвращает нормализованную копию или null, если данные негодны.
  const validate = {
    influent(d) {
      if (!d || !isNum(d.q) || !d.c || typeof d.c !== 'object') return null;
      const c = {};
      for (const k of paramKeys()) { const v = d.c[k]; c[k] = isNum(v) ? v : 0; }
      return { q: d.q, c };
    },
    scheme(d) {
      if (!d || !Array.isArray(d.steps)) return null;
      const ids = unitIds();
      const steps = [];
      for (const s of migrateSteps(d.steps.filter(Boolean))) {
        if (!s || !ids.has(s.u)) return null;
        const eff = {};
        for (const [k, v] of Object.entries(s.eff || {})) if (typeof v === 'number' && isFinite(v)) eff[k] = Math.min(100, Math.max(0, v));
        steps.push({ ...s, eff });
      }
      // трубы между ступенями и места на генплане (см. graph.js); линия осадка — если задана
      const out = { steps: G.norm(steps) }, sl = sludgeLine(d.sludge);
      if (sl) out.sludge = sl;
      return out;
    },
    norm(d) {
      if (!d || !d.v || typeof d.v !== 'object') return null;
      const v = {};
      for (const k of paramKeys()) v[k] = isNum(d.v[k]) ? d.v[k] : null;
      return { v };
    },
    // Проект: общие для всех вариантов стоки, нормативы и цены + до 6 вариантов схем (копии, не ссылки).
    project(d) {
      if (!d || !d.influent || !d.norm || !Array.isArray(d.variants)) return null;
      const inf = validate.influent(d.influent), nm = validate.norm(d.norm);
      if (!inf || !nm) return null;
      const prices = {};
      for (const [k, p] of Object.entries(D.ECON.prices)) prices[k] = isNum(d.prices && d.prices[k]) ? d.prices[k] : p.v;
      const variants = [];
      for (const v of d.variants.slice(0, MAX_VARIANTS)) {
        const sc = v && validate.scheme(v);
        if (!sc || !v.id || !String(v.name || '').trim()) return null;
        variants.push({ id: String(v.id), name: String(v.name).trim().slice(0, 80), steps: sc.steps, ...(sc.sludge ? { sludge: sc.sludge } : {}) });
      }
      const label = (o, def) => String((o && o.name) || def).trim().slice(0, 120) || def;
      return {
        influent: { name: label(d.influent, 'Стоки'), ...inf },
        norm: { name: label(d.norm, 'Нормативы'), ...nm },
        prices,
        variants
      };
    }
  };

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function empty() { return { influent: [], scheme: [], norm: [], project: [] }; }

  function createStore(adapter) {
    let lib = empty();
    try {
      const raw = adapter.read();
      if (raw) for (const k of KINDS) if (Array.isArray(raw[k])) lib[k] = raw[k].filter(it => it && it.id && it.name && validate[k](it.data));
    } catch (e) { /* пустая библиотека */ }

    const persist = () => { try { adapter.write(lib); return true; } catch (e) { return false; } };
    const sorted = kind => [...lib[kind]].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return {
      list: kind => sorted(kind),
      get: (kind, id) => lib[kind].find(it => it.id === id) || null,
      /** Создать (без id) или обновить запись. Возвращает запись или null, если данные негодны. */
      save(kind, { id, name, data }) {
        const clean = validate[kind](data);
        const nm = String(name || '').trim().slice(0, 120);
        if (!clean || !nm) return null;
        const now = new Date().toISOString();
        let it = id && lib[kind].find(x => x.id === id);
        if (it) Object.assign(it, { name: nm, data: clean, updated: now });
        else { it = { id: newId(), name: nm, data: clean, created: now, updated: now }; lib[kind].push(it); }
        persist();
        return it;
      },
      /** Переименовать запись, не трогая данные. Возвращает запись или null. */
      rename(kind, id, name) {
        const it = lib[kind].find(x => x.id === id), nm = String(name || '').trim().slice(0, 120);
        if (!it || !nm) return null;
        it.name = nm; it.updated = new Date().toISOString();
        persist();
        return it;
      },
      remove(kind, id) { const n = lib[kind].length; lib[kind] = lib[kind].filter(it => it.id !== id); persist(); return lib[kind].length < n; },
      count() { return KINDS.reduce((s, k) => s + lib[k].length, 0); },
      exportAll() { return { format: FORMAT, version: VERSION, exported: new Date().toISOString(), ...JSON.parse(JSON.stringify(lib)) }; },
      /** Добавить записи из файла. Записи с тем же id заменяются. Возвращает {added, updated, skipped}. */
      importAll(obj) {
        if (!obj || obj.format !== FORMAT) throw new Error('Это не файл библиотеки Сешат.');
        const res = { added: 0, updated: 0, skipped: 0 };
        for (const k of KINDS) for (const it of (Array.isArray(obj[k]) ? obj[k] : [])) {
          const clean = it && validate[k](it.data);
          if (!clean || !it.name || !it.id) { res.skipped++; continue; }
          const ex = lib[k].find(x => x.id === it.id);
          const rec = { id: String(it.id), name: String(it.name).slice(0, 120), data: clean, created: it.created || new Date().toISOString(), updated: it.updated || new Date().toISOString() };
          if (ex) { Object.assign(ex, rec); res.updated++; } else { lib[k].push(rec); res.added++; }
        }
        persist();
        return res;
      }
    };
  }

  function localAdapter(key) {
    return {
      read() { return JSON.parse(localStorage.getItem(key) || 'null'); },
      write(obj) { localStorage.setItem(key, JSON.stringify(obj)); }
    };
  }
  function memoryAdapter(init) { let v = init || null; return { read: () => v, write: o => { v = JSON.parse(JSON.stringify(o)); } }; }

  root.SeshatStore = { createStore, localAdapter, memoryAdapter, validate, migrateSteps, sludgeLine, KINDS, MAX_VARIANTS, newId };
  if (typeof module !== 'undefined') module.exports = root.SeshatStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
