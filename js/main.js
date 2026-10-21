// Запуск: открыть раздел из адреса страницы и заполнить статичные страницы.
(function () {
  const v = document.querySelector('script[src*="js/app.js"]')?.src.match(/[?&]v=([\d.]+)/);
  document.querySelectorAll('[data-app-version]').forEach(e => { e.textContent = v ? v[1] : '—'; });
  // Кнопки и ссылки внутри страниц, ведущие в разделы
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-go]'); if (!a) return;
    ev.preventDefault(); go(a.dataset.go);
  });
  // Кнопки «Копировать» в контактах
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Скопировано: ' + b.dataset.copy); }
    catch (e) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Выделено — нажмите Ctrl+C'); }
  });
  showView(viewFromHash());
})();
