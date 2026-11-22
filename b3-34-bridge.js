/* ============================================================
   b3-34-bridge.js — мост между отладчиком и нижней панелью (v1)

   Зачем нужен. b3-34-ui.js (ревизия 7) строит нижнюю панель #pnl9
   только после появления элемента #flwBar. Если за 9 секунд его
   нет — ui.js молча выходит, и на странице остаются:
     • старые .tabs и .tools со всеми кнопками подряд;
     • ни переключателя «Работа / Учёба», ни группировки.

   Поиск по репозиторию показывает: #flwBar не создаёт никто —
   ни b3-34-fix.js, ни b3-34-follow.js, ни b3-34-work.js.
   Поэтому панель не собиралась ни разу.

   Что делает этот файл:
     1. создаёт пустой #flwBar сразу при загрузке — ui.js его видит
        и строит панель (режимы, ☰, ⋯, счётчик шагов);
     2. кладёт в #flwBar четыре кнопки-прокси, которые нажимают
        настоящие кнопки отладчика: Шаг, Авто, На 00, Очистить;
     3. в режиме «Работа» строку шагов прячет — там своя строка
        ▶ Пуск / ⏩ Темп / ⏹ Стоп / 📂 Программа / ⟲ Сброс
        из b3-34-work.js.

   Ядро, fix.js, follow.js, ui.js и work.js не меняются.
   ============================================================ */
(function(){
  'use strict';

  if (document.getElementById('flwBar')) return;

  var flw = document.createElement('div');
  flw.id = 'flwBar';

  var style = document.createElement('style');
  style.id = 'brStyle';
  style.textContent = [
    '#flwBar{display:none!important;gap:5px;align-items:stretch;min-width:0}',
    'body.mode-study #flwBar{display:flex!important}',
    '#flwBar button{flex:1 1 0;min-width:0;font-family:inherit;border-radius:9px;'
      + 'border:1px solid #DCDCD5;background:#F1F0EA;color:#1B1B1B;font-size:12px;'
      + 'line-height:1.1;padding:9px 2px;white-space:nowrap;overflow:hidden;'
      + 'text-overflow:ellipsis}',
    '#flwBar button:active{background:#E6E5DE}',
    'body:not(.light) #flwBar button{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}'
  ].join('\n');
  document.head.appendChild(style);
  document.body.appendChild(flw);

  var SPEC = [
    { re: /шаг/i,            label: '\u25B6 Шаг' },
    { re: /авто/i,           label: 'Авто' },
    { re: /адрес|с 00|на 00/i, label: 'На 00' },
    { re: /журнал|очист/i,   label: 'Очистить' }
  ];

  function orig(re){
    var bs = document.querySelectorAll('.dbg button');
    for (var i = 0; i < bs.length; i++){
      var t = (bs[i].textContent || '').trim();
      if (re.test(t)) return bs[i];
    }
    return null;
  }

  SPEC.forEach(function(sp){
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = sp.label;
    b.setAttribute('data-br', sp.label);
    b.addEventListener('click', function(){
      var o = orig(sp.re);
      if (o) o.click();
    });
    flw.appendChild(b);
  });

  /* пока отладчик не поднялся, кнопки приглушены */
  setInterval(function(){
    var has = !!orig(/шаг/i);
    var bs = flw.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++){
      bs[i].style.opacity = has ? '' : '.45';
    }
  }, 1500);
})();
