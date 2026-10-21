// Библиотека пользователя: сохранённые профили стоков, схемы очистки и наборы нормативов.
// Хранилище подключается через адаптер { read(), write(obj) }. Сейчас это localStorage браузера;
// для аккаунтов достаточно добавить адаптер, который синхронизирует тот же объект с сервером.
(function (root) {
  const D = root.SeshatData || (typeof require !== 'undefined' ? require('./data.js') : null);
  const KINDS = ['influent', 'scheme', 'norm'];
  const FORMAT = 'seshat-library';
  const VERSION = 1;

  const isNum = v => typeof v === 'number' && isFinite(v) && v >= 0;
  const unitIds = () => new Set(D.UNITS.map(u => u.id));
  const paramKeys = () => D.PARAMS.map(p => p.k);

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
      for (const s of d.steps) {
        if (!s || !ids.has(s.u)) return null;
        const eff = {};
        for (const [k, v] of Object.entries(s.eff || {})) if (typeof v === 'number' && isFinite(v)) eff[k] = Math.min(100, Math.max(0, v));
        steps.push({ u: s.u, eff });
      }
      return { steps };
    },
    norm(d) {
      if (!d || !d.v || typeof d.v !== 'object') return null;
      const v = {};
      for (const k of paramKeys()) v[k] = isNum(d.v[k]) ? d.v[k] : null;
      return { v };
    }
  };

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function empty() { return { influent: [], scheme: [], norm: [] }; }

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
        if (!obj || obj.format !== FORMAT) throw new Error('Это не файл библиотеки Seshat.');
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

  root.SeshatStore = { createStore, localAdapter, memoryAdapter, validate, KINDS };
  if (typeof module !== 'undefined') module.exports = root.SeshatStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
