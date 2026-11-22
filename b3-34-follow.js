/* ============================================================
   b3-34-follow.js — четыре экрана (ревизия 11)

   ЧТО БЫЛО СЛОМАНО
   В ревизии 9 остался скрытый переключатель «по одному» (#flwFold),
   включённый по умолчанию. В сетке разделов стояло условие
   (foldOn() || k === name), то есть при включённом переключателе ВСЕ
   четыре раздела получали data-on="1" и были раскрыты одновременно.
   Переключение кнопкой лишь прокручивало страницу — экран не менялся.
   Отсюда и «разделы не переключаются даже вручную».

   ЧТО ТЕПЕРЬ
   • Показывается ровно один экран, остальные скрыты. Кнопки внизу
     переключают карточки, а не прокручивают страницу.
   • Регистры перерисованы: стек X/Y/Z/T/X1 — строками с крупным
     значением, R0–Rd — сеткой 3/4/5 в ряд в зависимости от ширины.
     Значения читаются из настоящих #stack и #regs.
   • Листание по шагам: каждая новая строка журнала = следующий экран
     по кругу Числа → Регистры → Код → Журнал → Числа.
   • Таймерные режимы (1/2/5/10 с) листают только пока идут шаги.
   • Своё нажатие по кнопке раздела приостанавливает листание на 8 с.
   • Маркер ▶ у выполняемой строки в листинге — здесь же, в стилях.

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
      '.flw{margin:0;padding:0;display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.flwchk{display:none!important}',
      '.flwtabs,.flw .flwtabs{display:flex;gap:5px;margin:0}',
      '.flwtabs button,#pnl9 .flwtabs button{flex:1 1 0;min-width:0;min-height:44px;'
        + 'padding:10px 2px;border-radius:10px;border:1px solid #DCDCD5;background:#F1F0EA;'
        + 'color:#1B1B1B;font-family:inherit;font-size:13px;font-weight:600;letter-spacing:0;'
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

      /* карточки разделов: виден ровно один */
      '.fld{background:#fff;border:1px solid #DCDCD5;border-radius:14px;margin:0 0 10px;overflow:hidden}',
      '.fld>.fldh{display:none}',
      '.fld[data-on="0"]{display:none!important}',
      '.fld.calc{background:transparent;border:0;overflow:visible;margin:0 0 10px}',
      'body:not(.light) .fld{background:#191b17;border-color:#3c4238}',
      'body.light .fld.on-air{box-shadow:0 0 0 2px #2E7D32 inset}',

      /* ---- регистры ---- */
      '.rgwrap{padding:10px 10px 14px}',
      '.rgsec{color:#5A5A5A;font-size:10.5px;letter-spacing:.9px;margin:0 2px 7px}',
      '.rgsec~.rgsec{margin-top:16px}',
      '.rglist{display:flex;flex-direction:column;gap:5px}',
      '.rgrow{display:flex;align-items:baseline;justify-content:space-between;gap:10px;'
        + 'background:#F7F6F2;border:1px solid #E4E3DC;border-radius:10px;padding:9px 12px}',
      '.rgrow i{font-style:normal;color:#6B6B63;font-size:12px;font-weight:700;letter-spacing:.5px}',
      '.rgrow b{color:#1B1B1B;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:18px;'
        + 'font-weight:700;line-height:1.15;text-align:right;font-variant-numeric:tabular-nums;'
        + 'word-break:break-all}',
      '.rggrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
      '@media(min-width:430px){.rggrid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
      '@media(min-width:560px){.rggrid{grid-template-columns:repeat(5,minmax(0,1fr))}}',
      '.rgcell{background:#F7F6F2;border:1px solid #E4E3DC;border-radius:10px;'
        + 'padding:8px 4px 9px;text-align:center;overflow:hidden}',
      '.rgcell i{display:block;font-style:normal;color:#6B6B63;font-size:10px;font-weight:700;'
        + 'letter-spacing:.4px;margin-bottom:2px}',
      '.rgcell b{display:block;color:#1B1B1B;font-family:ui-monospace,"SF Mono",Menlo,monospace;'
        + 'font-size:15px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums;'
        + 'word-break:break-all}',
      '.rgcell b.sm{font-size:12px}',
      '.rgcell b.xs{font-size:10.5px}',
      'body:not(.light) .rgrow,body:not(.light) .rgcell{background:#20241c;border-color:#3a4232}',
      'body:not(.light) .rgsec,body:not(.light) .rgrow i,body:not(.light) .rgcell i{color:#7fa88a}',
      'body:not(.light) .rgrow b,body:not(.light) .rgcell b{color:#8dffab}',

      /* ---- маркер текущей команды ---- */
      '#dbgProg{position:relative}',
      '#dbgProg .dbgprow{position:relative}',
      '#dbgProg .dbgprow.cur{background:#DDEFD2!important;box-shadow:inset 3px 0 0 #2E7D32!important;'
        + 'padding-left:16px!important}',
      '#dbgProg .dbgprow.cur::before{content:"▶";position:absolute;left:3px;top:50%;'
        + 'transform:translateY(-50%);font-size:9px;line-height:1;color:#2E7D32}',
      'body:not(.light) #dbgProg .dbgprow.cur{background:#2f4a2a!important;'
        + 'box-shadow:inset 3px 0 0 #8dffab!important}',
      'body:not(.light) #dbgProg .dbgprow.cur::before{color:#8dffab}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- чтение значений ---------------- */
  function pick(c){
    var b = c.querySelector('b');
    var txt = (c.textContent || '').replace(/\s+/g, ' ').trim();
    var lab = '', val = txt;
    if(b){
      lab = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if(lab) val = txt.replace(lab, '').trim();
    }
    if(!val){
      var m = /^(.*?)([-+]?\d[\d\s.,eE+\-]*|∞)$/.exec(txt);
      if(m){ if(!lab) lab = m[1].trim(); val = m[2].trim(); }
    }
    return { lab: lab, val: val || '—' };
  }

  function cells(el){
    var out = [];
    if(!el) return out;
    [].forEach.call(el.children, function(c){ out.push(pick(c)); });
    return out;
  }

  function drawStack(host, items){
    host.innerHTML = '';
    items.forEach(function(it){
      var d = document.createElement('div');
      d.className = 'rgrow';
      var i = document.createElement('i');
      i.textContent = it.lab || '—';
      var b = document.createElement('b');
      b.textContent = it.val;
      if(it.val.length > 10) b.className = 'sm';
      d.appendChild(i); d.appendChild(b);
      host.appendChild(d);
    });
  }

  function drawGrid(host, items){
    host.innerHTML = '';
    items.forEach(function(it){
      var d = document.createElement('div');
      d.className = 'rgcell';
      var i = document.createElement('i');
      i.textContent = it.lab || '—';
      var b = document.createElement('b');
      b.textContent = it.val;
      if(it.val.length > 10) b.className = 'xs';
      else if(it.val.length > 7) b.className = 'sm';
      d.appendChild(i); d.appendChild(b);
      host.appendChild(d);
    });
  }

  function makeMirror(){
    var box = document.createElement('div');
    box.className = 'rgwrap';

    var h1 = document.createElement('div');
    h1.className = 'rgsec';
    h1.textContent = 'СТЕК X · Y · Z · T · X1';
    var st = document.createElement('div');
    st.className = 'rglist';

    var h2 = document.createElement('div');
    h2.className = 'rgsec';
    h2.textContent = 'РЕГИСТРЫ R0–Rd';
    var rg = document.createElement('div');
    rg.className = 'rggrid';

    box.appendChild(h1); box.appendChild(st);
    box.appendChild(h2); box.appendChild(rg);

    var lastKey = '';
    function sync(){
      var sCells = cells(document.getElementById('stack'));
      var rCells = cells(document.getElementById('regs'));
      var key = JSON.stringify([sCells, rCells]);
      if(key === lastKey) return;
      lastKey = key;
      drawStack(st, sCells);
      drawGrid(rg, rCells);
    }

    var obs = new MutationObserver(sync);
    ['stack', 'regs'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
    setInterval(sync, 500);
    sync();
    return box;
  }

  /* ---------------- показ экранов ---------------- */
  function ensureVisible(el){
    if(!el || !el.getBoundingClientRect) return;
    var r = el.getBoundingClientRect();
    if(r.top < 8 || r.bottom > window.innerHeight - 8){
      var y = r.top + window.pageYOffset - 8;
      try{ window.scrollTo({ top: (y > 0 ? y : 0), behavior: 'smooth' }); }
      catch(e){ window.scrollTo(0, (y > 0 ? y : 0)); }
    }
  }

  function setActive(name){
    if(!map[name]) return;
    active = name;
    ORDER.forEach(function(k){
      var n = map[k];
      if(!n) return;
      n.setAttribute('data-on', (k === name) ? '1' : '0');
      if(k === name) n.classList.add('on-air');
      else n.classList.remove('on-air');
    });
    if(tabsEl){
      [].forEach.call(tabsEl.querySelectorAll('button'), function(b){
        var on = (b.getAttribute('data-s') === name);
        if(on) b.classList.add('on'); else b.classList.remove('on');
      });
    }
    ensureVisible(map[name]);
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
    if(!dbg || !caseEl) return;
    try{ build(dbg, caseEl); }
    catch(e){ if(window.console) console.warn('follow: не построилось', e); }
  }

  function sect(cls, nodes){
    var w = document.createElement('div');
    w.className = 'fld ' + cls;
    w.setAttribute('data-f', cls);
    w.setAttribute('data-on', '0');
    var h = document.createElement('div');
    h.className = 'fldh';
    w.appendChild(h);
    nodes.forEach(function(n){ if(n) w.appendChild(n); });
    return w;
  }

  function build(dbg, caseEl){
    if(built) return;
    built = true;
    css();

    var tab = document.getElementById('tabCalc') || document.body;
    var progEl = dbg.querySelector('#dbgProg');
    var logEl  = dbg.querySelector('#dbgLog');
    var routeEl= dbg.querySelector('#dbgRoute');
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

    /* четыре карточки */
    map.calc = sect('calc', [caseEl, secs[0]]);
    map.regs = sect('regs', [makeMirror()]);
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

    /* ---- листание ---- */
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
      if(Date.now() - lastStepAt > 1500) return;      /* прогон не идёт — стоим */
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
      if(t === 'step' || t === 'off'){
        i.style.width = '0';
        return;
      }
      var sec = parseFloat(t);
      if(!(sec > 0)){ i.style.width = '0'; return; }
      var running = (Date.now() - lastStepAt) < 1500;
      var p = running ? Math.min(1, (Date.now() - lastSwitchAt) / (sec * 1000)) : 0;
      i.style.width = (p * 100).toFixed(0) + '%';
    }, 200);

    window.B3Screens = {
      set: setActive,
      next: next,
      get current(){ return active; }
    };
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
