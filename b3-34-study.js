/* ============================================================
   b3-34-study.js — учебный режим (v7)
   Прячет кнопки ИНТЕРФЕЙСА, которые не относятся к работе программы:
   память и файлы, звук, голос, микрофон, примеры, справку,
   подсказку и вкладку «Программы».
   Остаются только те, что нужны при пошаговом разборе:
   ▶ Пуск, ⏹ Стоп, ▶ Шаг, ⏵ Авто, ⟲ 00, 🗑 Журнал и три раздела.
   Ядро b3-34.js не трогается. Откат — открыть b3-34-v6.html.
   ============================================================ */
(function(){
  'use strict';
  var KEY = 'b334.study';
  var tries = 0;
  var on = false;
  var btn = null;

  /* что именно убираем из учебного режима */
  var HIDE = [
    '.mem',          /* сохранение программ, JSON/TXT, загрузка файла */
    '.hint',         /* подсказка про RPN */
    '.help',         /* большая справка */
    '#btnSpeed',     /* темп */
    '#btnSound',     /* звук */
    '#btnVoice',     /* голос */
    '#btnMic',       /* микрофон */
    '#btnPick',      /* примеры */
    '#btnHelp'       /* кнопка справки */
  ];

  function css(){
    if(document.getElementById('stStyle')) return;
    var s = document.createElement('style');
    s.id = 'stStyle';
    s.textContent = [
      '.st-hide{display:none !important}',
      'body.study .tabs button[data-tab="catalog"]{display:none !important}',
      '#stBtn{display:block;width:100%;margin:8px 0 0;background:#2b2f28;color:#cfd6c4;',
      '  border:1px solid #454b3f;border-radius:9px;padding:9px 8px;font-size:12px;',
      '  font-family:inherit;line-height:1.2}',
      '#stBtn:active{background:#3a4034}',
      '#stBtn.on{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      'body.study .tools{padding-top:2px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function mark(){
    HIDE.forEach(function(sel){
      [].forEach.call(document.querySelectorAll(sel), function(el){
        el.classList.add('st-hide');
      });
    });
  }

  function apply(){
    document.body.classList.toggle('study', on);
    if(btn){
      btn.textContent = on
        ? '🎓 Учебный режим: вкл · показать всё'
        : '🎓 Учебный режим: выкл · убрать лишнее';
      btn.className = on ? 'on' : '';
    }
    try{ localStorage.setItem(KEY, on ? '1' : '0'); }catch(e){}
  }

  function set(v){
    on = !!v;
    apply();
    if(on){
      /* к первому разделу, чтобы не остаться на скрытом блоке */
      try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){ window.scrollTo(0, 0); }
    }
  }

  function build(){
    css();
    mark();

    var bar = document.getElementById('flwBar');
    var host = bar || document.querySelector('.wrap');
    if(!host){ if(tries++ < 30) setTimeout(build, 200); return; }

    btn = document.createElement('button');
    btn.id = 'stBtn';
    btn.type = 'button';
    btn.addEventListener('click', function(){ set(!on); });
    host.appendChild(btn);

    try{ on = (localStorage.getItem(KEY) === '1'); }catch(e){ on = false; }
    apply();
  }

  document.addEventListener('DOMContentLoaded', build);
  if(document.readyState !== 'loading') build();
})();
