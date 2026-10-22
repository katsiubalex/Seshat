// Запуск страницы модуля Тласольтеотль: выполнить действие, отложенное на главной странице
// (применить нормативы, добавить сооружение, собрать предложенную схему), и открыть раздел из адреса.
(function () {
  const p = takePending();
  if (p && p.norm) openItem('norm', p.norm);
  if (p && p.add && U[p.add]) addUnit(p.add);
  if (p && Array.isArray(p.steps) && p.steps.every(id => U[id])) runAction({ type: 'apply', steps: p.steps });
  startPage();
})();
