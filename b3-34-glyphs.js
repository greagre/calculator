/* ============================================================
   b3-34-glyphs.js — чистые подписи кнопок (ревизия 1)

   На части телефонов в системном шрифте нет символов ⏵ ⏸ ⟲ 🗑,
   и вместо них рисуется «тофу» — пустой прямоугольник. Кнопки
   в нижней панели выглядят сломанными.

   Здесь подписи ставятся заново, только проверенными символами:
   ▶ (есть в шрифте — им же рисуется маркер), кириллица и цифры.

   Логику кнопок файл не трогает: обработчики остаются те же,
   меняется только текст. Отключается удалением строки со скриптом.
   ============================================================ */
(function(){
  'use strict';

  function set(id, text, title){
    var el = document.getElementById(id);
    if(!el) return;
    if(el.textContent !== text) el.textContent = text;
    if(title && el.title !== title) el.title = title;
  }

  function apply(){
    set('dbgStep', '▶ Шаг', 'Выполнить одну команду');
    set('dbgZero', '00', 'С адреса 00');

    var clear = document.getElementById('dbgClear');
    if(clear) set('dbgClear', 'Очистить', 'Очистить журнал');

    var auto = document.getElementById('dbgAuto');
    if(auto){
      var running = (auto.className || '').indexOf('on') >= 0;
      set('dbgAuto', running ? 'Пауза' : 'Авто', running ? 'Остановить автопрогон' : 'Идти автоматически');
    }

    var more = document.getElementById('p9more');
    if(more) set('p9more', '⋯', 'Ещё');
  }

  function start(){
    apply();
    setInterval(apply, 400);
  }

  document.addEventListener('DOMContentLoaded', start);
  if(document.readyState !== 'loading') start();
})();
