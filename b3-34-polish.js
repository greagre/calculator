/* ============================================================
   b3-34-polish.js — правки вида и переключения разделов (v1)
   Подключается последним, перекрывает стили follow.js и ui.js.

   Что исправляет:
   1. Кнопки разделов были узкие и обрезали подписи — теперь крупные,
      текст не режется, высота 40 px.
   2. Раздел «Регистры»: сетка 4 в ряд, цифры 15 px, значения не
      обрезаются многоточием.
   3. Маркер в листинге: слева от текущей строки видна стрелка ▶ и
      зелёная полоса по краю — видно, какая команда выполняется.
   4. С кнопок сняты эмодзи: на части телефонов они рисовались
      посторонними значками вместо нужных символов.

   Ядро b3-34.js не трогается. Откат — b3-34-v9.html.
   ============================================================ */
(function(){
  'use strict';

  function css(){
    if(document.getElementById('polishStyle')) return;
    var s = document.createElement('style');
    s.id = 'polishStyle';
    s.textContent = [
      /* ---- кнопки разделов: крупно, без обрезки ---- */
      '#pnl9 .flwtabs{gap:5px!important;margin:0!important}',
      '#pnl9 .flwtabs button{flex:1 1 0!important;min-width:0!important;'
        + 'font-size:12.5px!important;line-height:1.15!important;padding:10px 2px!important;'
        + 'min-height:40px!important;border-radius:10px!important;letter-spacing:0!important;'
        + 'white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;'
        + 'touch-action:manipulation!important}',
      '#pnl9 .flwtabs button.on{background:#2E7D32!important;border-color:#2E7D32!important;'
        + 'color:#fff!important;font-weight:600!important}',
      'body:not(.light) #pnl9 .flwtabs button.on{background:#4c7a41!important;'
        + 'border-color:#6f9c60!important;color:#eaffdc!important}',

      /* ---- регистры: 4 в ряд, значения целиком ---- */
      '.rggrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important}',
      '.rgwrap{padding:6px 4px 10px!important}',
      '.rghd{font-size:10.5px!important;margin:0 4px 6px!important}',
      '.rgcell{padding:8px 4px 9px!important;border-radius:9px!important;text-align:center!important}',
      '.rgcell i{font-size:10px!important;margin-bottom:3px!important}',
      '.rgcell b{font-size:15px!important;line-height:1.3!important;'
        + 'white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;'
        + 'font-variant-numeric:tabular-nums}',
      '@media(min-width:520px){'
        + '.rggrid{grid-template-columns:repeat(5,minmax(0,1fr))!important}'
        + '.rgcell b{font-size:16px!important}'
        + '}',

      /* ---- маркер текущей команды в листинге ---- */
      '#dbgProg{position:relative}',
      '#dbgProg .dbgprow{position:relative}',
      '#dbgProg .dbgprow.cur{background:#DDEFD2!important;'
        + 'box-shadow:inset 3px 0 0 #2E7D32!important;padding-left:15px!important}',
      '#dbgProg .dbgprow.cur::before{content:"▶";position:absolute;left:3px;top:50%;'
        + 'transform:translateY(-50%);font-size:9px;line-height:1;color:#2E7D32}',
      'body:not(.light) #dbgProg .dbgprow.cur{background:#2f4a2a!important;'
        + 'box-shadow:inset 3px 0 0 #8dffab!important}',
      'body:not(.light) #dbgProg .dbgprow.cur::before{color:#8dffab}',

      /* ---- активный раздел виден отчётливее ---- */
      'body.light .fld.on-air{box-shadow:0 0 0 2px #2E7D32 inset!important}',
      '.fld[data-f="regs"]{min-height:120px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* подписи разделов без эмодзи */
  function cleanTabs(){
    var map = { calc: 'Числа', regs: 'Регистры', prog: 'Код', log: 'Журнал' };
    var tabs = document.querySelectorAll('#pnl9 .flwtabs button');
    for(var i = 0; i < tabs.length; i++){
      var k = tabs[i].getAttribute('data-s');
      if(k && map[k] && (tabs[i].textContent || '').trim() !== map[k]){
        tabs[i].textContent = map[k];
        tabs[i].title = map[k];
      }
    }
  }

  function ready(){
    css();
    cleanTabs();
    var n = 0;
    (function again(){
      cleanTabs();
      if(n++ < 40) setTimeout(again, 250);
    })();
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
