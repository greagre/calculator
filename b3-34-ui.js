/* ============================================================
   b3-34-ui.js — интерфейс v9
   • два режима внизу: Работа и Учёба (сегмент)
   • Шаг / Авто / 00 живут ТОЛЬКО в Учёбе
   • ☰ — библиотека сбоку (программы и файлы), ⋯ — кнопки по группам
   • светлая обвязка вокруг калькулятора (корпус, индикатор и клавиши не тронуты)
   • счётчик шагов и полоса положения в программе
   • маркер ▶ у текущей строки листинга + автопрокрутка
   • темп переключения разделов: по шагу, 1/2/5/10 с или только вручную
   Ядро b3-34.js, b3-34-fix.js и b3-34-follow.js не изменяются.
   Откат — открыть b3-34-v8.html.
   ============================================================ */
(function(){
  'use strict';

  function g(k, d){ try{ var v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } }
  function s(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

  var mode  = g('b334.ui.mode', 'work');     /* work | study */
  var theme = g('b334.ui.theme', 'light');   /* light | dark | system */
  var turn  = g('b334.ui.turn', '2');        /* step | 1 | 2 | 5 | 10 | off */

  var pnl = null, sheet = null, drawer = null;
  var turnTimer = null, pausedUntil = 0, lastCur = null;

  /* ---------------- стили ---------------- */
  function css(){
    if(document.getElementById('ui9Style')) return;
    var s1 = document.createElement('style');
    s1.id = 'ui9Style';
    s1.textContent = [
      /* --- верхняя навигация и старые кнопки не нужны --- */
      '.tabs{display:none!important}',
      '.tools{display:none!important}',
      '#help{display:none!important}',
      '#hint{font-size:11px!important;opacity:.75}',

      /* --- обёртка раздела «Числа» не должна рисовать вторую рамку --- */
      '.fld.calc{background:transparent!important;border:0!important;overflow:visible!important}',
      '.fld.calc>.fldh{border-radius:12px}',

      /* --- нижняя панель --- */
      '#pnl9{position:fixed;left:0;right:0;bottom:0;z-index:70;padding:5px 6px calc(6px + env(safe-area-inset-bottom));'
        + 'display:flex;flex-direction:column;gap:5px;border-top:1px solid #DCDCD5;background:#FFFFFF;'
        + 'box-shadow:0 -6px 18px rgba(0,0,0,.07)}',
      '#pnl9 .p9row{display:flex;gap:5px;align-items:stretch;min-width:0}',
      '#pnl9 button,#pnl9 select{font-family:inherit;border-radius:9px;border:1px solid #DCDCD5;background:#F1F0EA;'
        + 'color:#1B1B1B;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;'
        + 'text-overflow:ellipsis;padding:9px 4px}',
      '#pnl9 button:active{background:#E6E5DE}',
      '#pnl9 .modeBtn{flex:1 1 0;font-size:13px;padding:10px 2px}',
      '#pnl9 .modeBtn.on{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      '#p9lib{flex:0 0 44px;font-size:17px}',

      /* разделы и кнопки шага, перенесённые из follow.js */
      '#pnl9 #flwBar{position:static!important;margin:0!important;padding:0!important;background:transparent!important;'
        + 'border:0!important;box-shadow:none!important;display:flex;flex-direction:column;gap:5px;min-width:0}',
      '#pnl9 .flwchk{display:none!important}',
      '#pnl9 .flwtabs{display:flex;gap:5px;margin:0!important}',
      '#pnl9 .flwtabs button{flex:1 1 0;min-width:0;padding:8px 2px;font-size:12px;border-color:#DCDCD5;'
        + 'background:#F1F0EA;color:#1B1B1B}',
      '#pnl9 .flwtabs button.on{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      '#pnl9 .dbgbar{display:flex!important;flex-wrap:nowrap!important;gap:5px;margin:0!important;min-width:0}',
      '#pnl9 .dbgbar button{flex:1 1 0;min-width:0;padding:9px 2px}',
      '#pnl9 .dbgbar .step{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      '#pnl9 .dbgpc{display:none!important}',
      '#p9more{flex:0 0 44px!important;font-size:16px}',
      '#p9acts{display:flex;flex-direction:column;gap:5px}',

      /* счётчик шагов */
      '#p9count{display:flex;align-items:center;gap:7px;font-size:11px;color:#5A5A5A;padding:0 2px;'
        + 'font-variant-numeric:tabular-nums}',
      '#p9count .p9bar{flex:1;height:4px;border-radius:3px;background:#E6E5DE;overflow:hidden}',
      '#p9count .p9bar i{display:block;height:4px;width:0;background:#2E7D32;border-radius:3px;transition:width .18s}',
      '#p9count b{color:#1B1B1B;font-weight:600}',

      /* полоса до смены раздела */
      '#p9turn{height:2px;border-radius:2px;overflow:hidden;background:transparent}',
      '#p9turn i{display:block;height:2px;width:0;background:#2E7D32;border-radius:2px;opacity:.6}',
      '#p9turn.run i{animation:p9fill linear forwards;animation-duration:var(--p9dur,2000ms)}',
      '@keyframes p9fill{from{width:0}to{width:100%}}',

      /* --- шторка ⋯ и библиотека ☰ --- */
      '.p9ov{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.45);display:none}',
      '.p9ov.on{display:block}',
      '.p9card{position:absolute;left:0;right:0;bottom:0;background:#FFFFFF;border-top:1px solid #DCDCD5;'
        + 'border-radius:16px 16px 0 0;padding:12px 12px calc(16px + env(safe-area-inset-bottom));'
        + 'max-height:82vh;overflow:auto;color:#1B1B1B}',
      '.p9card.side{top:0;bottom:0;right:auto;width:92%;max-width:440px;border-radius:0 16px 16px 0;'
        + 'border-right:1px solid #DCDCD5;padding-top:calc(14px + env(safe-area-inset-top));'
        + 'padding-bottom:calc(20px + env(safe-area-inset-bottom))}',
      '.p9top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;'
        + 'color:#2E7D32;font-size:13px;letter-spacing:.3px}',
      '.p9top button{background:#F1F0EA;border:1px solid #DCDCD5;color:#1B1B1B;border-radius:8px;'
        + 'padding:6px 10px;font-family:inherit;font-size:13px}',
      '.p9grp{color:#5A5A5A;font-size:10px;letter-spacing:.8px;margin:12px 2px 5px}',
      '.p9grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
      '.p9grid button{background:#F7F6F2;border:1px solid #DCDCD5;color:#1B1B1B;border-radius:10px;'
        + 'padding:12px 8px;font-family:inherit;font-size:13px;text-align:left;line-height:1.2;'
        + 'white-space:normal;overflow:visible}',
      '.p9grid button:active{background:#E6E5DE}',
      '.p9grid button.full{grid-column:1/-1;text-align:center;color:#2E7D32;border-color:#A5CD97}',
      '.p9sel{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#5A5A5A}',
      '.p9sel select{background:#F7F6F2;border:1px solid #DCDCD5;color:#1B1B1B;border-radius:9px;'
        + 'padding:9px 6px;font-family:inherit;font-size:12px}',
      '.p9note{color:#5A5A5A;font-size:11px;line-height:1.45;margin-top:12px}',
      '.p9body{overflow:visible}',
      '.p9body .mem,.p9body #tabCatalog{background:transparent!important;border:0!important;padding:0!important;margin:0 0 14px!important}',

      /* --- светлая обвязка: фон, панели, отладчик --- */
      'body.light{background:#F6F5F1;color:#1B1B1B}',
      'body.light .wrap{background:transparent;color:#1B1B1B}',
      'body.light .hint{color:#5A5A5A}',
      'body.light .fld{background:#FFFFFF;border-color:#DCDCD5}',
      'body.light .fldh{background:#EFEEE8;color:#2E7D32;border-color:#DCDCD5}',
      'body.light .fld.on-air{box-shadow:0 0 0 2px #2E7D32 inset}',
      'body.light .flw{background:transparent;border:0;box-shadow:none}',
      'body.light .dbg{background:#FFFFFF;border-color:#DCDCD5;color:#1B1B1B}',
      'body.light .dbg button{background:#F1F0EA;color:#1B1B1B;border-color:#DCDCD5}',
      'body.light .dbgsec{color:#5A5A5A}',
      'body.light .dbgnote{color:#6B6B63}',
      'body.light .dbgcell{background:#F7F6F2;border-color:#E4E3DC}',
      'body.light .dbgcell i{color:#6B6B63}',
      'body.light .dbgcell b{color:#1B1B1B}',
      'body.light .dbgcell.ch{background:#E6F2DF;border-color:#9CC48C}',
      'body.light .dbgcell.ch b{color:#1B4D12}',
      'body.light .dbgprog,body.light .dbglog,body.light .dbgroute{background:#FBFAF6;border-color:#E4E3DC}',
      'body.light .dbgprow .a{color:#7A7A72}',
      'body.light .dbgprow .c{color:#A9791B}',
      'body.light .dbgprow .n{color:#1B1B1B}',
      'body.light .dbgprow.past .n{color:#6E6E66}',
      'body.light .dbgprow.cur{background:#DDEFD2}',
      'body.light .dbgprow.cur .n,body.light .dbgprow.cur .a,body.light .dbgprow.cur .c{color:#123B08}',
      'body.light .dbgline{border-color:#EDECE5}',
      'body.light .dbgline .a{color:#7A7A72}',
      'body.light .dbgline .c{color:#A9791B}',
      'body.light .dbgline .n{color:#1B1B1B}',
      'body.light .dbgline .d{color:#3F6B33}',
      'body.light .dbgroute .ad{color:#1B1B1B}',
      'body.light .dbgroute .ar{color:#8A8A82}',
      'body.light .dbgroute .jp{color:#1F6FB2}',
      'body.light .dbgroute .cu{background:#DDEFD2;color:#123B08}',
      'body.light .mem{background:#FFFFFF;border-color:#DCDCD5;color:#1B1B1B}',
      'body.light .mem .lbl{color:#2E7D32}',
      'body.light .memnote{color:#5A5A5A}',
      'body.light .proglist button{background:#F7F6F2;color:#1B1B1B;border-color:#E4E3DC}',
      'body.light .catsearch{background:#FFFFFF;color:#1B1B1B;border-color:#DCDCD5}',
      'body.light .catbar button{background:#F1F0EA;color:#1B1B1B;border-color:#DCDCD5}',
      'body.light .sheetbox{background:#FFFFFF;color:#1B1B1B}',
      'body.light .sheettop{color:#2E7D32}',
      'body.light .sheetitem{background:#F7F6F2;color:#1B1B1B;border-color:#E4E3DC}',

      /* --- тёмная тема для панели (если выберут) --- */
      'body:not(.light) #pnl9{background:#191b17;border-top-color:#3c4238}',
      'body:not(.light) #pnl9 button,body:not(.light) #pnl9 select{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) #pnl9 .flwtabs button{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) #pnl9 .flwtabs button.on{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      'body:not(.light) #pnl9 .modeBtn.on{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      'body:not(.light) #pnl9 .dbgbar .step{background:#2f4a2a;border-color:#4c7a41;color:#cfd6c4}',
      'body:not(.light) #p9count{color:#8b9382}',
      'body:not(.light) #p9count b{color:#dfe3d5}',
      'body:not(.light) #p9count .p9bar{background:#2b2f28}',
      'body:not(.light) .p9card{background:#20241d;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) .p9grid button{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) .p9sel select{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) .p9note{color:#8b9382}',

      /* --- режим Работа: разделы и шаги не нужны --- */
      'body.mode-work #flwBar{display:none!important}',
      'body.mode-work .fld[data-f="prog"],body.mode-work .fld[data-f="log"]{display:none!important}',
      'body.mode-work .fld[data-f="calc"]{display:block!important}',
      'body.mode-work .fld[data-f="calc"]>.fldh{display:none!important}',

      '@media(min-width:760px){#pnl9{left:auto;right:14px;bottom:14px;width:560px;border:1px solid #DCDCD5;'
        + 'border-radius:14px}}'
    ].join('\n');
    document.head.appendChild(s1);
  }

  /* ---------------- мелочи ---------------- */
  function findBtn(id, word){
    var el = document.getElementById(id);
    if(el) return el;
    if(!word) return null;
    var btns = document.querySelectorAll('.tools button');
    for(var i = 0; i < btns.length; i++){
      if((btns[i].textContent || '').toLowerCase().indexOf(word) >= 0) return btns[i];
    }
    return null;
  }
  function px(id, label, word){
    return '<button type="button" data-px="' + id + '" data-w="' + (word || '') + '">' + label + '</button>';
  }

  /* ---------------- тема ---------------- */
  function applyTheme(){
    var light = theme === 'light';
    if(theme === 'system' && window.matchMedia){
      light = window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    document.body.classList.toggle('light', light);
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', light ? '#F6F5F1' : '#23251f');
  }

  /* ---------------- сборка ---------------- */
  var tries = 0;

  function ready(){
    var flw = document.getElementById('flwBar');
    if(!flw){
      if(tries++ < 50) setTimeout(ready, 150);
      return;
    }
    try{ build(flw); }catch(e){ if(window.console) console.warn('ui9: не собралось', e); }
  }

  function build(flw){
    if(document.getElementById('pnl9')) return;
    css();
    applyTheme();
    document.body.classList.toggle('mode-work', mode === 'work');
    document.body.classList.toggle('mode-study', mode === 'study');

    var tabs   = flw.querySelector('.flwtabs');
    var dbgbar = flw.querySelector('.dbgbar');

    /* сокращаем подписи, чтобы влезло в одну строку */
    if(dbgbar){
      [].forEach.call(dbgbar.querySelectorAll('button'), function(b){
        var t = (b.textContent || '').trim();
        if(/с адреса/i.test(t)){ b.textContent = '⟲ 00'; b.title = t; }
        else if(/^журнал/i.test(t)){ b.textContent = '🗑'; b.title = 'Очистить журнал'; }
        else if(/авто/i.test(t)){ b.textContent = '⏵ Авто'; }
        else if(/шаг/i.test(t)){ b.textContent = '▶ Шаг'; }
      });
    }

    /* ---- панель ---- */
    pnl = document.createElement('div');
    pnl.id = 'pnl9';
    pnl.innerHTML =
      '<div id="p9turn"><i></i></div>'
      + '<div id="p9count" style="display:none">'
      +   '<span>шаг <b id="p9step">0</b></span>'
      +   '<span class="p9bar"><i id="p9fill"></i></span>'
      +   '<span id="p9pc">PC 00</span>'
      + '</div>'
      + '<div class="p9row">'
      +   '<button type="button" class="modeBtn" data-m="work">Работа</button>'
      +   '<button type="button" class="modeBtn" data-m="study">Учёба</button>'
      +   '<button type="button" id="p9lib" title="Библиотека программ">☰</button>'
      + '</div>'
      + '<div id="p9acts"></div>';
    document.body.appendChild(pnl);

    var acts = pnl.querySelector('#p9acts');
    acts.appendChild(flw);              /* разделы и строка Шаг/Авто/00 */

    if(dbgbar){
      var more = document.createElement('button');
      more.type = 'button';
      more.id = 'p9more';
      more.textContent = '⋯';
      more.title = 'Ещё';
      more.addEventListener('click', function(){ openSheet(); });
      dbgbar.appendChild(more);
    }

    /* ---- шторка ⋯ ---- */
    sheet = document.createElement('div');
    sheet.className = 'p9ov';
    sheet.innerHTML =
      '<div class="p9card">'
      + '<div class="p9top"><b>Ещё</b><button type="button" data-x="1">✕</button></div>'
      + '<div class="p9grp">ПРОГРАММА</div><div class="p9grid">'
      +   px('btnRun', '▶ Пуск') + px('btnStop', '⏹ Стоп')
      +   px('btnReset', '⏻ Сброс') + px('btnPick', '📥 Пример')
      + '</div>'
      + '<div class="p9grp">ЗВУК</div><div class="p9grid">'
      +   px('btnSound', '🔊 Звук') + px('btnVoice', '🗣 Голос') + px('btnMic', '🎤 Сказать')
      + '</div>'
      + '<div class="p9grp">ФАЙЛЫ</div><div class="p9grid">'
      +   '<button type="button" id="p9files" class="full">📚 Библиотека программ и файлы</button>'
      + '</div>'
      + '<div class="p9grp">ПОКАЗ</div><div class="p9grid">'
      +   '<label class="p9sel">Разделы меняются'
      +     '<select id="p9turnSel">'
      +       '<option value="step">по шагу</option>'
      +       '<option value="1">каждую 1 с</option>'
      +       '<option value="2">каждые 2 с</option>'
      +       '<option value="5">каждые 5 с</option>'
      +       '<option value="10">каждые 10 с</option>'
      +       '<option value="off">только вручную</option>'
      +     '</select></label>'
      +   '<label class="p9sel">Оформление'
      +     '<select id="p9themeSel">'
      +       '<option value="light">светлое</option>'
      +       '<option value="dark">тёмное</option>'
      +       '<option value="system">как в системе</option>'
      +     '</select></label>'
      + '</div>'
      + '<div class="p9grp">ПРОЧЕЕ</div><div class="p9grid">'
      +   px('btnSpeed', '🐢 Темп') + px('btnHelp', '❓ Справка')
      + '</div>'
      + '<div class="p9note" id="p9note"></div>'
      + '</div>';
    document.body.appendChild(sheet);

    /* ---- библиотека ☰ ---- */
    drawer = document.createElement('div');
    drawer.className = 'p9ov';
    drawer.innerHTML =
      '<div class="p9card side">'
      + '<div class="p9top"><b>📚 Библиотека</b><button type="button" data-x="1">✕</button></div>'
      + '<div class="p9body" id="p9body"></div>'
      + '</div>';
    document.body.appendChild(drawer);

    var body = drawer.querySelector('#p9body');
    var mem = document.querySelector('.mem');
    if(mem) body.appendChild(mem);
    var cat = document.getElementById('tabCatalog');
    if(cat){ cat.style.display = ''; body.appendChild(cat); }

    /* ---- обработчики ---- */
    pnl.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;
      if(b.classList.contains('modeBtn')){
        mode = b.getAttribute('data-m');
        s('b334.ui.mode', mode);
        applyMode();
        return;
      }
      if(b.id === 'p9lib'){ openDrawer(); }
    });

    sheet.addEventListener('click', function(e){
      if(e.target === sheet){ closeSheet(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;
      if(b.getAttribute('data-x')){ closeSheet(); return; }
      if(b.id === 'p9files'){ closeSheet(); openDrawer(); return; }
      var id = b.getAttribute('data-px');
      if(id){
        var orig = findBtn(id, b.getAttribute('data-w'));
        if(orig) orig.click();
        setTimeout(closeSheet, 130);
      }
    });

    drawer.addEventListener('click', function(e){
      if(e.target === drawer){ closeDrawer(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if(b && b.getAttribute('data-x')){ closeDrawer(); return; }
      /* выбор программы в библиотеке = сброс выполнения и возврат в Работу */
      if(b && (b.closest('.proglist') || b.closest('.sheetitem'))){
        setTimeout(function(){
          mode = 'work'; s('b334.ui.mode', 'work');
          applyMode();
          closeDrawer();
        }, 260);
      }
    });

    var turnSel = sheet.querySelector('#p9turnSel');
    if(turnSel){
      turnSel.value = turn;
      turnSel.addEventListener('change', function(){
        turn = this.value; s('b334.ui.turn', turn);
        applyFollow(); schedule();
      });
    }
    var themeSel = sheet.querySelector('#p9themeSel');
    if(themeSel){
      themeSel.value = theme;
      themeSel.addEventListener('change', function(){
        theme = this.value; s('b334.ui.theme', theme);
        applyTheme();
      });
    }

    if(tabs){
      tabs.addEventListener('click', function(){
        pausedUntil = Date.now() + 8000;
        schedule();
      }, true);
    }

    function openSheet(){
      syncProxies();
      var note = document.getElementById('p9note');
      if(note) note.textContent = mode === 'study'
        ? 'Учёба: идём по программе шагами и смотрим, что меняется. В работе шагов нет — там калькулятор.'
        : 'Работа: считаем и набираем программы. Для прогона по шагам переключись на «Учёба».';
      sheet.classList.add('on');
    }
    function closeSheet(){ sheet.classList.remove('on'); }
    function openDrawer(){ drawer.classList.add('on'); }
    function closeDrawer(){ drawer.classList.remove('on'); }

    function syncProxies(){
      var list = sheet.querySelectorAll('[data-px]');
      for(var i = 0; i < list.length; i++){
        var b = list[i];
        var orig = findBtn(b.getAttribute('data-px'), b.getAttribute('data-w'));
        if(!orig){ b.style.display = 'none'; continue; }
        b.style.display = '';
        var t = (orig.textContent || '').trim();
        if(t) b.textContent = t;
      }
    }

    /* ---- режимы ---- */
    function applyMode(){
      document.body.classList.toggle('mode-work', mode === 'work');
      document.body.classList.toggle('mode-study', mode === 'study');
      [].forEach.call(pnl.querySelectorAll('.modeBtn'), function(b){
        b.classList.toggle('on', b.getAttribute('data-m') === mode);
      });
      var cnt = document.getElementById('p9count');
      if(cnt) cnt.style.display = (mode === 'study') ? 'flex' : 'none';
      if(mode === 'work' && tabs){
        var c = tabs.querySelector('[data-s="calc"]');
        if(c) c.click();
      }
      applyFollow();
      schedule();
      fit();
      updateCount();
    }

    /* ---- темп переключения разделов ---- */
    function applyFollow(){
      var f = document.getElementById('flwFollow');
      if(f) f.checked = (turn === 'step');
    }
    var order = ['calc', 'prog', 'log'];
    function nextSection(){
      if(!tabs) return;
      var on = tabs.querySelector('button.on');
      var cur = on ? on.getAttribute('data-s') : 'calc';
      var i = order.indexOf(cur);
      if(i < 0) i = 0;
      var b = tabs.querySelector('[data-s="' + order[(i + 1) % 3] + '"]');
      if(b) b.click();
    }
    function schedule(){
      clearTimeout(turnTimer); turnTimer = null;
      var bar = document.getElementById('p9turn');
      if(bar){ bar.classList.remove('run'); var i2 = bar.querySelector('i'); if(i2) i2.style.width = '0'; }
      if(mode !== 'study') return;
      var sec = parseFloat(turn);
      if(!(sec > 0)) return;
      if(bar){
        bar.style.setProperty('--p9dur', (sec * 1000) + 'ms');
        void bar.offsetWidth;
        bar.classList.add('run');
      }
      turnTimer = setTimeout(function(){
        if(Date.now() < pausedUntil){ schedule(); return; }
        nextSection();
        schedule();
      }, sec * 1000);
    }

    /* ---- счётчик шагов ---- */
    function updateCount(){
      var logEl  = document.getElementById('dbgLog');
      var progEl = document.getElementById('dbgProg');
      var pcEl   = document.getElementById('dbgPc');
      var steps = logEl ? logEl.querySelectorAll('.dbgline').length : 0;
      var rows  = progEl ? progEl.querySelectorAll('.dbgprow').length : 0;
      var pc = 0;
      if(pcEl){
        var m = /([0-9]{1,2})/.exec(pcEl.textContent || '');
        if(m) pc = parseInt(m[1], 10);
      }
      var st = document.getElementById('p9step');
      if(st) st.textContent = steps;
      var pcT = document.getElementById('p9pc');
      if(pcT) pcT.textContent = 'PC ' + (pc < 10 ? '0' + pc : pc) + (rows ? ' / ' + (rows - 1) : '');
      var fill = document.getElementById('p9fill');
      if(fill && rows > 1){
        var p = Math.max(0, Math.min(1, pc / (rows - 1)));
        fill.style.width = (p * 100).toFixed(1) + '%';
      }
    }

    /* ---- маркер в листинге: автопрокрутка к текущей строке ---- */
    function watchProg(){
      var progEl = document.getElementById('dbgProg');
      if(!progEl) return;
      function look(){
        var cur = progEl.querySelector('.dbgprow.cur');
        if(!cur || cur === lastCur) return;
        lastCur = cur;
        var top = cur.offsetTop, h = progEl.clientHeight, ch = cur.offsetHeight;
        if(top < progEl.scrollTop || top + ch > progEl.scrollTop + h){
          progEl.scrollTop = Math.max(0, top - Math.round(h / 2) + Math.round(ch / 2));
        }
      }
      var obs = new MutationObserver(function(){
        look();
        updateCount();
      });
      obs.observe(progEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      look();
    }

    var logEl = document.getElementById('dbgLog');
    if(logEl){
      var obsLog = new MutationObserver(function(){ updateCount(); });
      obsLog.observe(logEl, { childList: true });
    }
    watchProg();
    updateCount();
    setInterval(updateCount, 700);

    /* ---- отступ под панель ---- */
    function fit(){
      document.body.style.paddingBottom = (pnl.offsetHeight + 14) + 'px';
    }
    fit();
    setTimeout(fit, 250);
    setTimeout(fit, 1200);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function(){ setTimeout(fit, 300); });

    applyFollow();
    applyMode();
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
