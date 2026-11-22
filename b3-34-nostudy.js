/* ============================================================
   b3-34-nostudy.js — страховка чистого вида
   Подключается последним и гарантирует, что учебного режима
   на странице НЕТ: убирает кнопку, снимает скрытие с кнопок
   интерфейса и стирает запомненное состояние из браузера.
   Нужен, потому что b3-34-study.js хранит свою настройку в
   localStorage и включает себя сам, если её когда-то включали.
   Сам себя выключает через несколько секунд — дальше не мешает.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'b334.study';

  function clean() {
    try { localStorage.removeItem(KEY); } catch (e) {}

    /* 1. кнопка учебного режима */
    var b = document.getElementById('stBtn');
    if (b && b.parentNode) b.parentNode.removeChild(b);

    /* 2. класс на body, который прячет вкладку «Программы» */
    if (document.body) document.body.classList.remove('study');

    /* 3. скрытые блоки интерфейса */
    [].forEach.call(document.querySelectorAll('.st-hide'), function (el) {
      el.classList.remove('st-hide');
    });

    /* 4. стили учебного режима */
    var s = document.getElementById('stStyle');
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }

  if (document.readyState !== 'loading') clean();
  document.addEventListener('DOMContentLoaded', clean);
  [150, 500, 1200, 2500].forEach(function (t) { setTimeout(clean, t); });

  /* если учебный режим попробует включиться позже — снимаем сразу */
  if (window.MutationObserver && document.body) {
    var obs = new MutationObserver(function () {
      if (document.getElementById('stBtn')) clean();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 8000);
  }
})();
