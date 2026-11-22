/* ============================================================
   b3-34-work.js — кнопки управления в режиме «Работа» (v1)
   Раньше в Работе вообще нечем было запустить программу: панель
   показывала только «Работа | Учёба | ☰». Теперь под режимами
   стоит своя строка:
       ▶ Пуск   ⏩ Темп   ⏹ Стоп   📂 Программа   ⟲ Сброс
   Кнопки настоящие: они нажимают те же кнопки в .tools, что и раньше
   (Пуск, Темп, Стоп, Сброс), а «Программа» открывает библиотеку ☰.
   В Учёбе строка прячется — там свои Шаг / Авто / 00.

   Ничего в ядре и в b3-34-ui.js не меняется: файл только добавляет
   строку в готовую панель.
   ============================================================ */
(function(){
  'use strict';

  function css(){
    if(document.getElementById('wkStyle')) return;
    var s = document.createElement('style');
    s.id = 'wkStyle';
    s.textContent = [
      '#p9work{display:none;gap:5px;align-items:stretch;min-width:0}',
      'body.mode-work #p9work{display:flex}',
      'body.mode-study #p9work{display:none!important}',
      '#p9work button{flex:1 1 0;min-width:0;font-family:inherit;border-radius:9px;'
        + 'border:1px solid #DCDCD5;background:#F1F0EA;color:#1B1B1B;font-size:11px;'
        + 'line-height:1.1;padding:9px 2px;white-space:nowrap;overflow:hidden;'
        + 'text-overflow:ellipsis}',
      '#p9work button:active{background:#E6E5DE}',
      '#p9work button.run{background:#2E7D32;border-color:#2E7D32;color:#fff;font-weight:700}',
      '#p9work button.stop{background:#FBEAE7;border-color:#E0B4AC;color:#B3261E}',
      'body:not(.light) #p9work button{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) #p9work button.run{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      'body:not(.light) #p9work button.stop{background:#43251f;border-color:#8a4a42;color:#ffd6cf}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function findBtn(id, word){
    var el = document.getElementById(id);
    if(el) return el;
    if(!word) return null;
    var btns = document.querySelectorAll('.tools button, #flwBar .dbgbar button');
    for(var i = 0; i < btns.length; i++){
      if((btns[i].textContent || '').toLowerCase().indexOf(word.toLowerCase()) >= 0) return btns[i];
    }
    return null;
  }

  var moves = [
    { id: 'btnRun',   word: 'пуск',   label: '▶ Пуск',   cls: 'run' },
    { id: 'btnSpeed', word: 'темп',   label: '⏩ Темп',   cls: '' },
    { id: 'btnStop',  word: 'стоп',   label: '⏹ Стоп',   cls: 'stop' },
    { id: 'btnReset', word: 'сброс',  label: '⟲ Сброс',  cls: '' }
  ];

  function build(){
    if(document.getElementById('p9work')) return true;
    var pnl = document.getElementById('pnl9');
    if(!pnl) return false;
    var tabs = pnl.querySelector('.p9row');
    if(!tabs) return false;

    css();

    var row = document.createElement('div');
    row.id = 'p9work';

    moves.forEach(function(m){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = m.cls;
      b.textContent = m.label;
      b.setAttribute('data-mv', m.id);
      b.addEventListener('click', function(){
        var orig = findBtn(m.id, m.word);
        if(orig) orig.click();
        setTimeout(syncTexts, 140);
      });
      row.appendChild(b);
    });

    var lib = document.createElement('button');
    lib.type = 'button';
    lib.textContent = '📂 Программа';
    lib.addEventListener('click', function(){
      var l = document.getElementById('p9lib');
      if(l) l.click();
    });
    row.appendChild(lib);

    pnl.insertBefore(row, pnl.querySelector('#p9acts') || null);

    /* подписи кнопок берём у настоящих: «Темп: оригинал / ускоренный» */
    function syncTexts(){
      var speed = findBtn('btnSpeed', 'темп');
      if(speed){
        var t = (speed.textContent || '').trim();
        var b = row.querySelector('[data-mv="btnSpeed"]');
        if(b && t){
          var rest = t.replace(/^[^\s:]+\s*:?\s*/, '');
          b.textContent = '⏩ ' + (rest || 'темп');
        }
      }
    }
    syncTexts();
    setInterval(syncTexts, 1200);

    /* высота панели изменилась — пусть ui.js пересчитает отступ */
    window.dispatchEvent(new Event('resize'));
    setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 300);
    return true;
  }

  var tries = 0;
  function ready(){
    if(!build() && tries++ < 60) setTimeout(ready, 150);
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
