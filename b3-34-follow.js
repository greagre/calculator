/* ============================================================
   b3-34-follow.js — четыре экрана (ревизия 14)

   ЧТО БЫЛО СЛОМАНО В РЕВИЗИЯХ 12–13
   Раздел «Регистры» строил собственное зеркало и пытался угадать,
   где в разметке корпуса подпись, а где число. В ячейку попадала
   пустая строка — отсюда пустые квадраты и обрезки.

   ЧТО ТЕПЕРЬ
   Раздел «Регистры» не рисует ничего своего: он забирает готовый
   блок отладчика #dbgRegs, который b3-34-fix.js уже заполняет
   значениями из ядра (B334.ST + B.fmtNum). Тот блок — сетка 5 в ряд,
   как в корпусе. Оформление приведено к корпусу: тёмные плашки,
   зелёные цифры.

   • Показ ровно одного экрана из четырёх — через style.display,
     поэтому никакие сторонние стили не могут «раскрыть все сразу».
   • Листание по шагам — по новой строке в журнале отладчика.
   • Кнопки без символов, которых нет в системном шрифте телефона.

   Ядро b3-34.js и b3-34-fix.js не изменяются.
   ============================================================ */
(function(){
  'use strict';

  var ORDER = ['calc', 'regs', 'prog', 'log'];
  var map = {};
  var tabsEl = null, fbar = null, built = false, tries = 0;
  var active = 'calc';
  var pausedUntil = 0, lastStepAt = 0, lastSwitchAt = 0;

  function turnMode(){
    try{ return localStorage.getItem('b334.ui.turn2') || 'step'; }catch(e){ return 'step'; }
  }

  /* ---------------- стили ---------------- */
  function css(){
    if(document.getElementById('flwStyle')) return;
    var s = document.createElement('style');
    s.id = 'flwStyle';
    s.textContent = [
      /* панель разделов */
      '.flw{margin:0;padding:0;display:flex;flex-direction:column;gap:5px;min-width:0;width:100%}',
      '.flwchk{display:none!important}',
      '.flwtabs,.flw .flwtabs{display:flex;gap:5px;margin:0;width:100%}',
      '.flwtabs button,#pnl9 .flwtabs button{flex:1 1 0;min-width:0;min-height:42px;'
        + 'padding:8px 1px;border-radius:10px;border:1px solid #DCDCD5;background:#F1F0EA;'
        + 'color:#1B1B1B;font-family:inherit;font-size:12px;font-weight:600;letter-spacing:0;'
        + 'line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:clip;'
        + 'touch-action:manipulation}',
      '.flwtabs button.on,#pnl9 .flwtabs button.on{background:#2E7D32;border-color:#2E7D32;'
        + 'color:#fff;font-weight:700}',
      'body:not(.light) .flwtabs button,body:not(.light) #pnl9 .flwtabs button'
        + '{background:#2b2f28;color:#cfd6c4;border-color:#454b3f}',
      'body:not(.light) .flwtabs button.on,body:not(.light) #pnl9 .flwtabs button.on'
        + '{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',

      /* строки шагов внутри панели */
      '#pnl9 .dbgbar{display:flex!important;flex-wrap:nowrap!important;gap:5px;margin:0!important;min-width:0}',
      '#pnl9 .dbgbar button{flex:1 1 0;min-width:0;padding:9px 2px;font-size:12px}',
      '#pnl9 .dbgbar .step{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      'body.mode-work #pnl9 .dbgbar{display:none!important}',

      /* карточки разделов: виден ровно один, ширина — вся */
      '.fld{background:#fff;border:1px solid #DCDCD5;border-radius:14px;margin:0 0 10px;'
        + 'overflow:hidden;width:100%!important;max-width:100%!important;'
        + 'box-sizing:border-box;flex:0 0 auto;padding:10px}',
      '.fld>.fldh{display:none}',
      '.fld.calc{background:transparent;border:0;overflow:visible;margin:0 0 10px;padding:0}',
      'body:not(.light) .fld{background:#191b17;border-color:#3c4238}',

      /* ---- регистры: как в корпусе — тёмные плашки, зелёные цифры ---- */
      '#dbgRegs{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;'
        + 'gap:6px!important;width:100%!important;box-sizing:border-box}',
      '#dbgRegs .dbgcell{background:#20241c!important;border:1px solid #3a4232!important;'
        + 'border-radius:9px!important;padding:7px 2px!important;text-align:center;'
        + 'min-width:0;overflow:hidden;box-sizing:border-box}',
      '#dbgRegs .dbgcell i{display:block;color:#7fa88a!important;font-style:normal;'
        + 'font-size:10px!important;font-weight:700;letter-spacing:.5px;line-height:1.2;'
        + 'text-align:center;margin:0 0 2px}',
      '#dbgRegs .dbgcell b{display:block;color:#8dffab!important;font-size:14px!important;'
        + 'font-weight:700!important;font-family:ui-monospace,"SF Mono",Menlo,monospace;'
        + 'line-height:1.15;text-align:center;white-space:nowrap;overflow:hidden;'
        + 'text-overflow:ellipsis;text-shadow:0 0 7px rgba(141,255,171,.4)}',
      '#dbgRegs .dbgcell.stk{border-color:#4a4433!important}',
      '#dbgRegs .dbgcell.ch{background:#2c6b3f!important;border-color:#4d9a64!important}',
      '#dbgRegs .dbgcell.ch b{color:#eafff0!important}',
      '@media(max-width:345px){#dbgRegs{grid-template-columns:repeat(4,minmax(0,1fr))!important}}',

      /* ---- маркер текущей команды ---- */
      '#dbgProg{position:relative}',
      '#dbgProg .dbgprow{position:relative}',
      '#dbgProg .dbgprow.cur{background:#DDEFD2!important;box-shadow:inset 3px 0 0 #2E7D32!important;'
        + 'padding-left:16px!important}',
      '#dbgProg .dbgprow.cur::before{content:"\25B6";position:absolute;left:3px;top:50%;'
        + 'transform:translateY(-50%);font-size:9px;line-height:1;color:#2E7D32}',
      'body:not(.light) #dbgProg .dbgprow.cur{background:#2f4a2a!important;'
        + 'box-shadow:inset 3px 0 0 #8dffab!important}',
      'body:not(.light) #dbgProg .dbgprow.cur::before{color:#8dffab}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- показ экранов ---------------- */
  function setActive(name){
    if(!map[name]) return;
    active = name;
    ORDER.forEach(function(k){
      var n = map[k];
      if(!n) return;
      var on = (k === name);
      n.setAttribute('data-on', on ? '1' : '0');
      /* явно, чтобы никакие внешние стили не раскрыли скрытые разделы */
      n.style.display = on ? '' : 'none';
      if(on) n.classList.add('on-air'); else n.classList.remove('on-air');
    });
    if(tabsEl){
      [].forEach.call(tabsEl.querySelectorAll('button'), function(b){
        var on = (b.getAttribute('data-s') === name);
        if(on) b.classList.add('on'); else b.classList.remove('on');
      });
    }
  }

  function next(){
    var i = ORDER.indexOf(active);
    if(i < 0) i = 0;
    setActive(ORDER[(i + 1) % ORDER.length]);
  }

  /* ---------------- сборка ---------------- */
  function ready(){
    var dbg = document.querySelector('.dbg');
    var caseEl = document.querySelector('.case');
    if((!dbg || !caseEl) && tries++ < 40){ setTimeout(ready, 200); return; }
    if(!dbg || !caseEl){ return; }
    try{ build(dbg, caseEl); }
    catch(e){ if(window.console) console.warn('follow: не построилось', e); }
  }

  function sect(cls, nodes){
    var w = document.createElement('div');
    w.className = 'fld ' + cls;
    w.setAttribute('data-f', cls);
    w.setAttribute('data-on', '0');
    w.style.display = 'none';
    var h = document.createElement('div');
    h.className = 'fldh';
    w.appendChild(h);
    nodes.forEach(function(n){ if(n) w.appendChild(n); });
    return w;
  }

  /* символы, которых нет в шрифте телефона, заменяем словами */
  function fixBar(){
    var z = document.getElementById('dbgZero');
    if(z) z.textContent = 'На 00';
    var c = document.getElementById('dbgClear');
    if(c) c.textContent = 'Очистить';
    var a = document.getElementById('dbgAuto');
    if(a && a.className.indexOf('on') < 0) a.textContent = 'Авто';
    var st = document.getElementById('dbgStep');
    if(st) st.textContent = '\u25B6 Шаг';
  }

  function build(dbg, caseEl){
    if(built) return;
    built = true;
    css();

    var tab = document.getElementById('tabCalc') || document.body;
    var progEl = dbg.querySelector('#dbgProg');
    var logEl  = dbg.querySelector('#dbgLog');
    var routeEl= dbg.querySelector('#dbgRoute');
    var regsEl = dbg.querySelector('#dbgRegs');
    var secs = [].slice.call(dbg.querySelectorAll('.dbgsec'));

    /* панель с четырьмя кнопками */
    fbar = document.createElement('div');
    fbar.className = 'flw';
    fbar.id = 'flwBar';
    fbar.innerHTML = '<div class="flwtabs">'
      + '<button type="button" data-s="calc" class="on">Числа</button>'
      + '<button type="button" data-s="regs">Регистры</button>'
      + '<button type="button" data-s="prog">Код</button>'
      + '<button type="button" data-s="log">Журнал</button>'
      + '</div>';
    tabsEl = fbar.querySelector('.flwtabs');
    tab.insertBefore(fbar, dbg);

    var bar = dbg.querySelector('.dbgbar');
    if(bar) fbar.appendChild(bar);

    /* четыре карточки: Числа — корпус, Регистры — настоящий блок отладчика */
    map.calc = sect('calc', [caseEl]);
    map.regs = sect('regs', [secs[0], regsEl]);
    map.prog = sect('prog', [secs[1], progEl]);
    map.log  = sect('log',  [secs[2], logEl, secs[3], routeEl]);

    ORDER.forEach(function(k){ tab.insertBefore(map[k], dbg); });
    dbg.style.display = 'none';

    /* ручной выбор экрана */
    fbar.addEventListener('click', function(e){
      var t = e.target;
      while(t && t !== fbar){
        if(t.tagName === 'BUTTON' && t.getAttribute('data-s')){
          pausedUntil = Date.now() + 8000;
          setActive(t.getAttribute('data-s'));
          return;
        }
        t = t.parentNode;
      }
    });

    setActive('calc');

    /* ---- листание по шагам ---- */
    if(logEl){
      new MutationObserver(function(muts){
        var step = false;
        for(var i = 0; i < muts.length; i++){
          if(muts[i].addedNodes && muts[i].addedNodes.length){ step = true; break; }
        }
        if(!step) return;
        lastStepAt = Date.now();
        if(turnMode() !== 'step') return;
        if(Date.now() < pausedUntil) return;
        if(Date.now() - lastSwitchAt < 120) return;
        lastSwitchAt = Date.now();
        next();
      }).observe(logEl, { childList: true });
    }

    setInterval(function(){
      var t = turnMode();
      if(t === 'step' || t === 'off') return;
      var sec = parseFloat(t);
      if(!(sec > 0)) return;
      if(Date.now() - lastStepAt > 1500) return;
      if(Date.now() < pausedUntil) return;
      if(Date.now() - lastSwitchAt < sec * 1000) return;
      lastSwitchAt = Date.now();
      next();
    }, 250);

    /* ---- полоса до смены экрана ---- */
    setInterval(function(){
      var barEl = document.getElementById('p9turn');
      if(!barEl) return;
      var i = barEl.querySelector('i');
      if(!i) return;
      var t = turnMode();
      if(t === 'step' || t === 'off'){ i.style.width = '0'; return; }
      var sec = parseFloat(t);
      if(!(sec > 0)){ i.style.width = '0'; return; }
      var running = (Date.now() - lastStepAt) < 1500;
      var p = running ? Math.min(1, (Date.now() - lastSwitchAt) / (sec * 1000)) : 0;
      i.style.width = (p * 100).toFixed(0) + '%';
    }, 200);

    fixBar();
    setTimeout(fixBar, 1200);
    setTimeout(fixBar, 3000);

    window.B3Screens = {
      set: setActive,
      next: next,
      get current(){ return active; }
    };
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
