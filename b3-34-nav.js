/* ============================================================
   b3-34-nav.js — нижняя панель и четыре экрана (ревизия 1)

   Зачем этот файл
   Штатная панель собиралась цепочкой fix.js → follow.js → ui.js:
   fix.js строил отладчик, follow.js ждал его и создавал #flwBar,
   ui.js ждал #flwBar и собирал панель. Любое звено спотыкалось
   молча — и на экране оставались только старые кнопки
   .tools («▶ Пуск программы», «Стоп», «Темп»).

   Здесь панель собирается сама, без ожидания отладчика:
   • Работа / Учёба / ☰
   • четыре экрана: Числа · Регистры · Код · Журнал
   • ▶ Шаг · Авто · 00 · Очистить · ⋯

   Раздел «Регистры» показывает настоящие блоки корпуса #stack и #regs
   (они переносятся как есть, со своими id и стилями), поэтому вид
   ровно как в корпусе: пять в ряд, тёмные плашки, зелёные цифры.
   Никакой угадывания разметки и никаких капсул.

   Ядро b3-34.js, b3-34-fix.js, follow.js и ui.js не изменяются.
   Если штатная панель #pnl9 всё-таки собралась, этот файл ничего
   не делает и уступает ей.
   ============================================================ */
(function(){
  'use strict';

  var K_TURN = 'b334.nav.turn';
  var K_THEME = 'b334.nav.theme';

  var turnMode  = read(K_TURN, 'step');
  var themeMode = read(K_THEME, 'light');
  var mode = 'work';
  var scr  = 'calc';
  var autoT = null;
  var built = false;
  var lastSwitch = 0, lastStepAt = 0;

  var P = {};                 /* узлы панели */
  var caseEl = null, stackEl = null, regsEl = null, padEl = null;
  var parked = null;          /* где лежали #stack и #regs */

  function read(k, d){ try{ var v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } }
  function save(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function $(id){ return document.getElementById(id); }
  function B(){ return window.B334 || null; }

  /* ---------------- стили ---------------- */
  function css(){
    if($('nav9Style')) return;
    var st = document.createElement('style');
    st.id = 'nav9Style';
    st.textContent = [
      '.tabs{display:none!important}',
      '.tools{display:none!important}',

      '#nav9{position:fixed;left:0;right:0;bottom:0;z-index:80;background:#FFFFFF;'
        + 'border-top:1px solid #DCDCD5;box-shadow:0 -6px 18px rgba(0,0,0,.08);'
        + 'padding:5px 6px calc(6px + env(safe-area-inset-bottom));'
        + 'display:flex;flex-direction:column;gap:5px}',
      '#nav9 .row{display:flex;gap:5px;min-width:0}',
      '#nav9 button,#nav9 select{font-family:inherit;border:1px solid #DCDCD5;background:#F1F0EA;'
        + 'color:#1B1B1B;border-radius:9px;font-size:12px;line-height:1.1;padding:9px 4px;'
        + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}',
      '#nav9 button:active{background:#E6E5DE}',
      '#nav9 .mode{flex:1 1 0;font-size:13px;font-weight:600;padding:10px 2px}',
      '#nav9 .mode.on{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      '#nav9 .tab{flex:1 1 0;min-height:42px;font-weight:600}',
      '#nav9 .tab.on{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      '#nav9 .act{flex:1 1 0;min-height:40px}',
      '#nav9 .go{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      '#nav9 .lib{flex:0 0 46px;font-size:18px}',
      '#nav9 .more{flex:0 0 46px;font-size:16px}',

      '#nav9 .cnt{display:flex;align-items:center;gap:7px;font-size:11px;color:#5A5A5A;'
        + 'padding:0 2px;font-variant-numeric:tabular-nums}',
      '#nav9 .cnt .bar{flex:1;height:4px;background:#E6E5DE;border-radius:3px;overflow:hidden}',
      '#nav9 .cnt .bar i{display:block;height:4px;width:0;background:#2E7D32;border-radius:3px;'
        + 'transition:width .18s}',
      '#nav9 .cnt b{color:#1B1B1B;font-weight:600}',

      '#navScr{position:relative}',
      '#navScr > div{display:none}',
      '#navScr > div.on{display:block}',

      /* ---- регистры: как в корпусе ---- */
      '#sRegs #stack,#sRegs #regs{display:grid!important;'
        + 'grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;'
        + 'width:100%!important;box-sizing:border-box;margin:0 0 10px!important}',
      '#sRegs #stack .cell,#sRegs #regs .cell,#sRegs #stack div,#sRegs #regs div{min-width:0}',
      '#sRegs .navcap{color:#5A5A5A;font-size:10px;letter-spacing:.8px;margin:2px 2px 7px}',
      '@media(max-width:345px){#sRegs #stack,#sRegs #regs{grid-template-columns:repeat(4,minmax(0,1fr))!important}}',

      /* ---- код и журнал ---- */
      '#sProg .dbgprog,#sLog .dbglog{max-height:none!important;width:100%!important}',
      '#sProg .navempty,#sLog .navempty{color:#5A5A5A;font-size:12px;line-height:1.5;padding:10px}',
      '#sProg .navlist{font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.7;'
        + 'background:#FBFAF6;border:1px solid #E4E3DC;border-radius:10px;padding:8px}',
      '#sProg .navlist .r{display:flex;gap:8px;padding:2px 4px;border-radius:5px}',
      '#sProg .navlist .r.cur{background:#DDEFD2;box-shadow:inset 3px 0 0 #2E7D32;padding-left:10px}',
      '#sProg .navlist .a{color:#8A8A82;width:20px;flex:none}',
      '#sProg .navlist .c{color:#A9791B;width:24px;flex:none}',
      '#sProg .navlist .n{color:#1B1B1B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

      /* ---- шторка ⋯ ---- */
      '#navOv{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.45);display:none}',
      '#navOv.on{display:block}',
      '#navOv .card{position:absolute;left:0;right:0;bottom:0;background:#FFFFFF;color:#1B1B1B;'
        + 'border-radius:16px 16px 0 0;padding:12px 12px calc(16px + env(safe-area-inset-bottom));'
        + 'max-height:80vh;overflow:auto}',
      '#navOv .top{display:flex;justify-content:space-between;align-items:center;color:#2E7D32;'
        + 'font-size:13px;letter-spacing:.3px;margin-bottom:10px}',
      '#navOv .top button{padding:6px 10px;border-radius:8px;border:1px solid #DCDCD5;'
        + 'background:#F1F0EA;color:#1B1B1B;font-family:inherit;font-size:13px}',
      '#navOv .lbl{color:#5A5A5A;font-size:10px;letter-spacing:.8px;margin:12px 2px 5px}',
      '#navOv .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
      '#navOv .grid button{background:#F7F6F2;border:1px solid #DCDCD5;color:#1B1B1B;border-radius:10px;'
        + 'padding:12px 8px;font-family:inherit;font-size:13px;text-align:left;line-height:1.2;'
        + 'white-space:normal;overflow:visible}',
      '#navOv select{width:100%;padding:9px 6px;border-radius:9px;border:1px solid #DCDCD5;'
        + 'background:#F7F6F2;color:#1B1B1B;font-family:inherit;font-size:12px}',
      '#navOv .note{color:#5A5A5A;font-size:11px;line-height:1.45;margin-top:12px}',

      /* ---- светлая и тёмная обвязка ---- */
      'body.nav-light{background:#F6F5F1;color:#1B1B1B}',
      'body.nav-light .wrap{background:transparent;color:#1B1B1B}',
      'body.nav-light .hint{color:#5A5A5A}',
      'body:not(.nav-light) #nav9{background:#191b17;border-top-color:#3c4238}',
      'body:not(.nav-light) #nav9 button,body:not(.nav-light) #nav9 select'
        + '{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.nav-light) #nav9 .mode.on,body:not(.nav-light) #nav9 .tab.on,'
        + 'body:not(.nav-light) #nav9 .go{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      'body:not(.nav-light) #nav9 .cnt{color:#8b9382}',
      'body:not(.nav-light) #nav9 .cnt b{color:#dfe3d5}',
      'body:not(.nav-light) #nav9 .cnt .bar{background:#2b2f28}',
      'body:not(.nav-light) #navOv .card{background:#20241d;color:#cfd6c4}',
      'body:not(.nav-light) #navOv .grid button,#body:not(.nav-light) #navOv select'
        + '{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.nav-light) #sProg .navlist{background:#20241d;border-color:#3c4238}',
      'body:not(.nav-light) #sProg .navlist .n{color:#dfe3d5}',
      'body:not(.nav-light) #sProg .navlist .r.cur{background:#2f4a2a}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- тема ---------------- */
  function applyTheme(){
    var light = (themeMode === 'light');
    if(themeMode === 'system' && window.matchMedia){
      light = window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    document.body.classList.toggle('nav-light', light);
  }

  /* ---------------- экраны ---------------- */
  function restorePark(){
    if(!parked) return;
    if(parked.stack && parked.stack.p){
      parked.stack.p.insertBefore(stackEl, parked.stack.n);
    }
    if(parked.regs && parked.regs.p){
      parked.regs.p.insertBefore(regsEl, parked.regs.n);
    }
    parked = null;
  }

  function setScreen(name){
    scr = name;
    if(!P.screens) return;

    if(name !== 'regs') restorePark();

    ['calc', 'regs', 'prog', 'log'].forEach(function(k){
      var box = P.screens.querySelector('#s' + k.charAt(0).toUpperCase() + k.slice(1));
      if(box) box.classList.toggle('on', k === name);
    });

    if(caseEl) caseEl.style.display = (name === 'calc') ? '' : 'none';

    if(name !== 'calc'){
      var dbg = document.querySelector('.dbg');
      if(dbg) dbg.style.display = 'none';
    }

    if(name === 'regs'){
      if(!parked){
        parked = {
          stack: { p: stackEl ? stackEl.parentNode : null, n: stackEl ? stackEl.nextSibling : null },
          regs:  { p: regsEl ? regsEl.parentNode : null,  n: regsEl ? regsEl.nextSibling : null }
        };
      }
      var rb = P.screens.querySelector('#sRegs');
      if(rb){
        if(stackEl && stackEl.parentNode !== rb) rb.appendChild(stackEl);
        if(regsEl && regsEl.parentNode !== rb) rb.appendChild(regsEl);
      }
    }

    if(name === 'prog') drawProg();
    if(name === 'log') drawLog();

    updateCount();
    window.scrollTo(0, 0);
  }

  /* ---------------- код ---------------- */
  function coreProg(){
    var b = B();
    if(!b || !b.ST) return null;
    return b.ST.prog || null;
  }

  function drawProg(){
    var box = P.screens ? P.screens.querySelector('#sProg') : null;
    if(!box) return;
    var b = B();
    var prog = coreProg();
    if(!b || !prog){
      var dbgProg = document.getElementById('dbgProg');
      if(dbgProg && dbgProg.parentNode !== box){
        box.innerHTML = '';
        box.appendChild(dbgProg);
        return;
      }
      box.innerHTML = '<div class="navempty">Листинг появится, когда программа набрана. '
        + 'Набери её в режиме ПРГ (f → ПРГ) или загрузи пример через ⋯ → Пример.</div>';
      return;
    }
    var ip = (typeof b.ST.ip === 'number') ? b.ST.ip : 0;
    var last = -1;
    for(var i = 0; i < prog.length; i++){ if(prog[i] !== 0x54) last = i; }
    if(last < 0){
      box.innerHTML = '<div class="navempty">Программа пуста. Набери её в режиме ПРГ (f → ПРГ) '
        + 'или загрузи пример через ⋯ → Пример.</div>';
      return;
    }
    var html = ['<div class="navlist">'];
    for(var j = 0; j <= last; j++){
      html.push('<div class="r' + (j === ip ? ' cur' : '') + '">'
        + '<span class="a">' + b.p2(j) + '</span>'
        + '<span class="c">' + b.hex2(prog[j]) + '</span>'
        + '<span class="n">' + b.cmdName(prog[j]) + '</span></div>');
    }
    html.push('</div>');
    box.innerHTML = html.join('');
  }

  /* ---------------- журнал ---------------- */
  function drawLog(){
    var box = P.screens ? P.screens.querySelector('#sLog') : null;
    if(!box) return;
    var dbgLog = document.getElementById('dbgLog');
    if(dbgLog){
      if(dbgLog.parentNode !== box){
        box.innerHTML = '';
        box.appendChild(dbgLog);
      }
      return;
    }
    var lines = (P.screens.querySelectorAll('#sLog .dbgline') || []).length;
    if(!lines){
      box.innerHTML = '<div class="navempty">Журнал пуст. В режиме «Учёба» жми «▶ Шаг» — '
        + 'здесь будет видно, что взяла каждая команда и что изменила.</div>';
    }
  }

  /* ---------------- шаг и авто ---------------- */
  function clickIf(id){
    var el = document.getElementById(id);
    if(el){ el.click(); return true; }
    return false;
  }

  function doStep(){
    if(clickIf('dbgStep')) return;
    var b = B();
    if(!b || !b.ST) return;
    try{
      if(b.ST.err) b.ST.err = false;
      if(b.ST.mode !== 'AUT') b.ST.mode = 'AUT';
      b.step();
      if(b.render) b.render();
    }catch(e){}
  }

  function stopAuto(){
    if(autoT){ clearInterval(autoT); autoT = null; }
    var b = P.auto;
    if(b){ b.classList.remove('on'); b.textContent = 'Авто'; }
  }

  function startAuto(){
    stopAuto();
    if(P.auto){ P.auto.classList.add('on'); P.auto.textContent = 'Пауза'; }
    autoT = setInterval(function(){
      lastStepAt = Date.now();
      doStep();
      turnTick();
    }, 700);
    lastStepAt = Date.now();
  }

  /* ---------------- листание экранов ---------------- */
  function turnTick(){
    if(turnMode === 'step' || turnMode === 'off') return;
    var sec = parseFloat(turnMode);
    if(!(sec > 0)) return;
    if(Date.now() - lastStepAt > 1600) return;
    if(Date.now() - lastSwitch < sec * 1000) return;
    lastSwitch = Date.now();
    var order = ['calc', 'regs', 'prog', 'log'];
    var i = order.indexOf(scr);
    setScreen(order[(i + 1) % order.length]);
  }

  /* ---------------- счётчик ---------------- */
  function updateCount(){
    var logEl = document.getElementById('dbgLog');
    var progEl = document.getElementById('dbgProg');
    var steps = logEl ? logEl.querySelectorAll('.dbgline').length : 0;
    var rows = progEl ? progEl.querySelectorAll('.dbgprow').length : 0;
    var pc = 0;
    var b = B();
    if(b && b.ST && typeof b.ST.ip === 'number') pc = b.ST.ip;
    var pcEl = document.getElementById('dbgPc');
    if(pcEl){
      var m = /([0-9]{1,2})/.exec(pcEl.textContent || '');
      if(m) pc = parseInt(m[1], 10);
    }
    if(!rows){
      var prog = coreProg();
      if(prog){ for(var i = 0; i < prog.length; i++){ if(prog[i] !== 0x54) rows = i + 1; } }
    }
    if(P.step) P.step.textContent = steps;
    if(P.pc) P.pc.textContent = 'PC ' + (pc < 10 ? '0' + pc : pc) + (rows > 1 ? ' / ' + (rows - 1) : '');
    if(P.fill && rows > 1){
      var p = Math.max(0, Math.min(1, pc / (rows - 1)));
      P.fill.style.width = (p * 100).toFixed(1) + '%';
    }
    if(scr === 'prog') drawProg();
    if(scr === 'log') drawLog();
  }

  /* ---------------- режимы ---------------- */
  function applyMode(){
    document.body.classList.toggle('mode-work', mode === 'work');
    document.body.classList.toggle('mode-study', mode === 'study');
    if(P.btWork) P.btWork.classList.toggle('on', mode === 'work');
    if(P.btStudy) P.btStudy.classList.toggle('on', mode === 'study');
    if(P.rowTabs) P.rowTabs.style.display = (mode === 'study') ? '' : 'none';
    if(P.rowStep) P.rowStep.style.display = (mode === 'study') ? '' : 'none';
    if(P.rowWork) P.rowWork.style.display = (mode === 'work') ? '' : 'none';
    if(mode === 'work') stopAuto();
    fit();
  }

  function fit(){
    var h = P.pnl ? P.pnl.offsetHeight : 0;
    document.body.style.paddingBottom = (h + 16) + 'px';
  }

  /* ---------------- сборка ---------------- */
  function build(){
    css();
    applyTheme();

    caseEl  = document.querySelector('.case');
    stackEl = document.getElementById('stack');
    regsEl  = document.getElementById('regs');
    padEl   = document.getElementById('pad');
    if(!caseEl) return;

    var host = document.getElementById('tabCalc') || document.body;

    /* экраны: Числа — сам корпус, Регистры — #stack и #regs, Код и Журнал — блоки отладчика */
    var screens = document.createElement('div');
    screens.id = 'navScr';
    screens.innerHTML =
      '<div id="sCalc" class="on"></div>'
      + '<div id="sRegs"><div class="navcap">СТЕК X · Y · Z · T · X1</div>'
      + '<div class="navcap" style="margin-top:-2px">РЕГИСТРЫ R0–Rd</div></div>'
      + '<div id="sProg"></div>'
      + '<div id="sLog"></div>';
    host.appendChild(screens);
    P.screens = screens;

    /* шторка ⋯ */
    var ov = document.createElement('div');
    ov.id = 'navOv';
    ov.innerHTML =
      '<div class="card">'
      + '<div class="top"><b>Ещё</b><button type="button" data-x="1">✕</button></div>'
      + '<div class="lbl">ПРОГРАММА</div><div class="grid">'
      +   '<button type="button" data-px="btnRun">▶ Пуск</button>'
      +   '<button type="button" data-px="btnStop">⏹ Стоп</button>'
      +   '<button type="button" data-px="btnReset">Сброс</button>'
      +   '<button type="button" data-px="btnPick">Пример</button>'
      + '</div>'
      + '<div class="lbl">ЗВУК</div><div class="grid">'
      +   '<button type="button" data-px="btnSound">Звук</button>'
      +   '<button type="button" data-px="btnVoice">Голос</button>'
      +   '<button type="button" data-px="btnMic">Сказать</button>'
      +   '<button type="button" data-px="btnSpeed">Темп</button>'
      + '</div>'
      + '<div class="lbl">ЭКРАНЫ</div>'
      + '<label class="lbl">Меняются'
      +   '<select id="navTurn">'
      +     '<option value="step">по шагу</option>'
      +     '<option value="1">каждую 1 с</option>'
      +     '<option value="2">каждые 2 с</option>'
      +     '<option value="5">каждые 5 с</option>'
      +     '<option value="10">каждые 10 с</option>'
      +     '<option value="off">только вручную</option>'
      +   '</select></label>'
      + '<label class="lbl" style="display:block;margin-top:8px">Оформление'
      +   '<select id="navTheme">'
      +     '<option value="light">светлое</option>'
      +     '<option value="dark">тёмное</option>'
      +     '<option value="system">как в системе</option>'
      +   '</select></label>'
      + '<div class="lbl">ПРОЧЕЕ</div><div class="grid">'
      +   '<button type="button" data-px="btnHelp">Справка</button>'
      +   '<button type="button" data-px="btnHelp">?</button>'
      + '</div>'
      + '<div class="note">Учёба: идём по программе шагами и смотрим, что меняется. '
      + 'Работа: считаем и набираем программы.</div>'
      + '</div>';
    document.body.appendChild(ov);
    P.ov = ov;

    /* панель */
    var pnl = document.createElement('div');
    pnl.id = 'nav9';
    pnl.innerHTML =
      '<div class="cnt">шаг <b id="navStep">0</b>'
      + '<span class="bar"><i id="navFill"></i></span><span id="navPc">PC 00</span></div>'
      + '<div class="row">'
      +   '<button type="button" class="mode on" data-m="work">Работа</button>'
      +   '<button type="button" class="mode" data-m="study">Учёба</button>'
      +   '<button type="button" class="lib" id="navLib">☰</button>'
      + '</div>'
      + '<div class="row" id="navTabs" style="display:none">'
      +   '<button type="button" class="tab on" data-s="calc">Числа</button>'
      +   '<button type="button" class="tab" data-s="regs">Регистры</button>'
      +   '<button type="button" class="tab" data-s="prog">Код</button>'
      +   '<button type="button" class="tab" data-s="log">Журнал</button>'
      + '</div>'
      + '<div class="row" id="navStepRow" style="display:none">'
      +   '<button type="button" class="act go" id="navDo">▶ Шаг</button>'
      +   '<button type="button" class="act" id="navAuto">Авто</button>'
      +   '<button type="button" class="act" id="navZero">00</button>'
      +   '<button type="button" class="act" id="navClear">Очистить</button>'
      +   '<button type="button" class="more" id="navMore">⋯</button>'
      + '</div>'
      + '<div class="row" id="navWorkRow">'
      +   '<button type="button" class="act go" id="navRun">▶ Пуск</button>'
      +   '<button type="button" class="act" id="navTemp">Темп</button>'
      +   '<button type="button" class="act" id="navStop">Стоп</button>'
      +   '<button type="button" class="act" id="navPick">Программа</button>'
      +   '<button type="button" class="act" id="navReset">Сброс</button>'
      +   '<button type="button" class="more" id="navMore2">⋯</button>'
      + '</div>';
    document.body.appendChild(pnl);
    P.pnl = pnl;

    P.step   = pnl.querySelector('#navStep');
    P.pc     = pnl.querySelector('#navPc');
    P.fill   = pnl.querySelector('#navFill');
    P.btWork = pnl.querySelector('[data-m="work"]');
    P.btStudy= pnl.querySelector('[data-m="study"]');
    P.rowTabs= pnl.querySelector('#navTabs');
    P.rowStep= pnl.querySelector('#navStepRow');
    P.rowWork= pnl.querySelector('#navWorkRow');
    P.auto   = pnl.querySelector('#navAuto');

    /* ---- нажатия панели ---- */
    pnl.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;

      if(b.classList.contains('mode')){
        mode = b.getAttribute('data-m');
        applyMode();
        return;
      }
      if(b.classList.contains('tab')){
        setScreen(b.getAttribute('data-s'));
        [].forEach.call(pnl.querySelectorAll('.tab'), function(t){
          t.classList.toggle('on', t.getAttribute('data-s') === scr);
        });
        return;
      }
      switch(b.id){
        case 'navDo': stopAuto(); lastStepAt = Date.now(); doStep(); break;
        case 'navAuto': if(autoT) stopAuto(); else startAuto(); break;
        case 'navZero':
          stopAuto();
          if(!clickIf('dbgZero')){
            var c1 = B();
            if(c1 && c1.ST){ c1.ST.ip = 0; if(c1.render) c1.render(); }
          }
          updateCount();
          break;
        case 'navClear':
          if(!clickIf('dbgClear')){
            var lg = document.getElementById('dbgLog');
            if(lg) lg.innerHTML = '';
            var sc = P.screens.querySelector('#sLog');
            if(sc) sc.innerHTML = '';
          }
          updateCount();
          break;
        case 'navRun':   clickIf('btnRun');   break;
        case 'navStop':  clickIf('btnStop'); stopAuto(); break;
        case 'navTemp':  clickIf('btnSpeed'); break;
        case 'navPick':  clickIf('btnPick');  break;
        case 'navReset': clickIf('btnReset'); break;
        case 'navLib':   clickIf('btnPick');  break;
        case 'navMore':
        case 'navMore2': openSheet(); break;
      }
    });

    /* ---- шторка ---- */
    function openSheet(){
      P.ov.classList.add('on');
      var sel = P.ov.querySelector('#navTurn');
      if(sel) sel.value = turnMode;
      var th = P.ov.querySelector('#navTheme');
      if(th) th.value = themeMode;
    }
    function closeSheet(){ P.ov.classList.remove('on'); }

    P.ov.addEventListener('click', function(e){
      if(e.target === P.ov){ closeSheet(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;
      if(b.getAttribute('data-x')){ closeSheet(); return; }
      var id = b.getAttribute('data-px');
      if(!id) return;
      var orig = document.getElementById(id);
      if(orig) orig.click();
      setTimeout(closeSheet, 140);
    });

    var turnSel = P.ov.querySelector('#navTurn');
    if(turnSel) turnSel.addEventListener('change', function(){
      turnMode = this.value;
      save(K_TURN, turnMode);
    });
    var themeSel = P.ov.querySelector('#navTheme');
    if(themeSel) themeSel.addEventListener('change', function(){
      themeMode = this.value;
      save(K_THEME, themeMode);
      applyTheme();
    });

    /* ---- первый показ ---- */
    setScreen('calc');
    applyMode();
    updateCount();

    fit();
    setTimeout(fit, 300);
    setTimeout(fit, 1200);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function(){ setTimeout(fit, 300); });

    setInterval(updateCount, 600);
    setInterval(turnTick, 250);
  }

  function start(){
    if(built) return;
    if($('nav9') || $('pnl9')) return;    /* штатная панель собралась — уступаем */
    built = true;
    try{ build(); }
    catch(e){ if(window.console) console.warn('nav9: не собралось', e); }
  }

  /* штатная цепочка получает приоритет: ждём её, потом собираем своё */
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(start, 1600); });
  if(document.readyState !== 'loading'){ setTimeout(start, 1600); }
  window.B3Nav = { show: setScreen, get screen(){ return scr; } };
})();
