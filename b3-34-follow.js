/* ============================================================
   b3-34-follow.js — четыре экрана (ревизия 13)

   ЧТО БЫЛО СЛОМАНО В РЕВИЗИИ 12
   Регистры «зеркалили» разметку корпуса: брали дочерние элементы
   #stack и #regs и пытались угадать, где подпись, а где значение.
   В ячейке корпуса подпись и число лежат в разных узлах, поэтому
   в квадрат попадала пустая строка, а иногда всё содержимое сразу.
   Отсюда пустые ячейки и обрезки вместо чисел — сколько ни меняй
   шрифт и ширину.

   ЧТО ТЕПЕРЬ
   Значения берутся напрямую из ядра: window.B334.ST (X, Y, Z, T,
   X1 и массив R) и форматируются B.fmtNum — тем же способом, что
   в отладчике b3-34-fix.js. Разметка корпуса больше не участвует.
   Зеркало из DOM осталось только как запасной путь, если ядро
   ещё не поднялось.

   • Сетка 5 в ряд на всю ширину, квадратные ячейки.
   • Подпись 10px сверху, значение 16px моноширинным.
   • Длинные числа уменьшаются (12px / 9.5px), а не режутся.
   • Показывается ровно один экран из четырёх.
   • Листание по шагам — по новой строке в журнале отладчика.

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
      '.flwtabs button,#pnl9 .flwtabs button{flex:1 1 0;min-width:0;min-height:44px;'
        + 'padding:9px 1px;border-radius:10px;border:1px solid #DCDCD5;background:#F1F0EA;'
        + 'color:#1B1B1B;font-family:inherit;font-size:12.5px;font-weight:600;letter-spacing:0;'
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
      '#pnl9 .dbgbar button{flex:1 1 0;min-width:0;padding:9px 2px;font-size:12.5px}',
      '#pnl9 .dbgbar .step{background:#2E7D32;border-color:#2E7D32;color:#fff}',
      'body.mode-work #pnl9 .dbgbar{display:none!important}',

      /* карточки разделов: виден ровно один, ширина — вся */
      '.fld{background:#fff;border:1px solid #DCDCD5;border-radius:14px;margin:0 0 10px;'
        + 'overflow:hidden;width:100%!important;max-width:100%!important;'
        + 'box-sizing:border-box;flex:0 0 auto}',
      '.fld>.fldh{display:none}',
      '.fld[data-on="0"]{display:none!important}',
      '.fld.calc{background:transparent;border:0;overflow:visible;margin:0 0 10px}',
      'body:not(.light) .fld{background:#191b17;border-color:#3c4238}',
      'body.light .fld.on-air{box-shadow:0 0 0 2px #2E7D32 inset}',

      /* ---- регистры ---- */
      '.rgwrap{padding:10px 10px 14px;width:100%!important;max-width:100%!important;'
        + 'box-sizing:border-box;display:block}',
      '.rgsec{color:#5A5A5A;font-size:10.5px;letter-spacing:.9px;margin:0 2px 7px;'
        + 'display:block;font-weight:700}',
      '.rgsec~.rgsec{margin-top:14px}',
      '.rggrid,.rglist{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;'
        + 'gap:6px!important;width:100%!important;max-width:100%!important;box-sizing:border-box}',
      '.rgcell{display:flex!important;flex-direction:column;align-items:center;'
        + 'justify-content:center;gap:2px;width:auto!important;min-width:0;'
        + 'aspect-ratio:1/1;box-sizing:border-box;background:#F7F6F2;'
        + 'border:1px solid #E4E3DC;border-radius:10px;padding:2px;overflow:hidden}',
      '.rgcell i{display:block;font-style:normal;color:#6B6B63;font-size:10px;font-weight:700;'
        + 'letter-spacing:.3px;line-height:1;text-align:center;width:100%}',
      '.rgcell b{display:block;color:#1B1B1B;font-family:ui-monospace,"SF Mono",Menlo,monospace;'
        + 'font-size:16px;font-weight:700;line-height:1.05;text-align:center;'
        + 'font-variant-numeric:tabular-nums;max-width:100%;overflow:hidden;white-space:nowrap}',
      '.rgcell b.sm{font-size:12px}',
      '.rgcell b.xs{font-size:9.5px}',
      '.rgcell.ch{border-color:#9CC48C;background:#E6F2DF}',
      'body:not(.light) .rgcell{background:#20241c;border-color:#3a4232}',
      'body:not(.light) .rgsec,body:not(.light) .rgcell i{color:#7fa88a}',
      'body:not(.light) .rgcell b{color:#8dffab}',
      'body:not(.light) .rgcell.ch{background:#2b3d27;border-color:#5d8a4e}',

      /* на очень узком экране — четыре в ряд, чтобы цифры остались крупными */
      '@media(max-width:340px){.rggrid,.rglist{grid-template-columns:repeat(4,minmax(0,1fr))!important}}',

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

  /* ---------------- запасной путь: разметка корпуса ---------------- */
  function pick(c){
    var b = c.querySelector('b');
    var txt = (c.textContent || '').replace(/\s+/g, ' ').trim();
    var lab = '', val = txt;
    if(b){
      lab = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if(lab) val = txt.replace(lab, '').trim();
    }
    if(!val){
      var m = /^(.*?)([-+]?\d[\d\s.,eE+\-]*|∞|ЕГГОГ)$/.exec(txt);
      if(m){ if(!lab) lab = m[1].trim(); val = m[2].trim(); }
    }
    return { lab: lab, val: val || '' };
  }

  function cells(el){
    var out = [];
    if(!el) return out;
    [].forEach.call(el.children, function(c){ out.push(pick(c)); });
    return out;
  }

  function sizeCls(v){
    if(v.length > 12) return 'xs';
    if(v.length > 8) return 'sm';
    return '';
  }

  /* одна ячейка-квадрат */
  function cellBox(it, active){
    var d = document.createElement('div');
    d.className = 'rgcell' + (active ? ' ch' : '');
    var i = document.createElement('i');
    i.textContent = it.lab || '';
    var b = document.createElement('b');
    b.textContent = it.val;
    var cls = sizeCls(it.val);
    if(cls) b.className = cls;
    d.appendChild(i); d.appendChild(b);
    return d;
  }

  function drawStack(host, items){
    host.innerHTML = '';
    items.forEach(function(it, idx){
      host.appendChild(cellBox(it, idx === 0));
    });
  }

  function drawGrid(host, items){
    host.innerHTML = '';
    items.forEach(function(it){ host.appendChild(cellBox(it, false)); });
  }

  /* ---------------- регистры: значения из ядра ---------------- */
  function normRegName(name, i){
    if(name === undefined || name === null || name === '') return String(i);
    return String(name);
  }

  function makeMirror(){
    var box = document.createElement('div');
    box.className = 'rgwrap';

    var h1 = document.createElement('div');
    h1.className = 'rgsec';
    h1.textContent = 'СТЕК X · Y · Z · T · X1';
    var stEl = document.createElement('div');
    stEl.className = 'rglist';

    var h2 = document.createElement('div');
    h2.className = 'rgsec';
    h2.textContent = 'РЕГИСТРЫ R0–Rd';
    var rgEl = document.createElement('div');
    rgEl.className = 'rggrid';

    box.appendChild(h1); box.appendChild(stEl);
    box.appendChild(h2); box.appendChild(rgEl);

    var lastKey = '';

    function fmtNum(B, v){
      try{
        if(B && typeof B.fmtNum === 'function') return String(B.fmtNum(v));
      }catch(e){}
      if(typeof v === 'number'){
        if(!isFinite(v)) return 'ЕГГОГ';
        return String(Math.round(v * 1e8) / 1e8);
      }
      return String(v);
    }

    function readCore(){
      var B = window.B334;
      if(!B || !B.ST) return null;
      var ST = B.ST;
      var stack = [
        ['X', ST.X], ['Y', ST.Y], ['Z', ST.Z], ['T', ST.T], ['X1', ST.X1]
      ];
      var regs = [];
      var names = B.REG_NAMES || [];
      var arr = ST.R || [];
      var n = arr.length ? arr.length : 14;
      for(var i = 0; i < n; i++){
        regs.push(['R' + normRegName(names[i], i), arr[i]]);
      }
      return { stack: stack, regs: regs, B: B };
    }

    function renderCore(s){
      stEl.innerHTML = '';
      s.stack.forEach(function(p, idx){
        stEl.appendChild(cellBox({ lab: p[0], val: fmtNum(s.B, p[1]) }, idx === 0));
      });
      rgEl.innerHTML = '';
      s.regs.forEach(function(p){
        rgEl.appendChild(cellBox({ lab: p[0], val: fmtNum(s.B, p[1]) }, false));
      });
    }

    function sync(){
      var s = readCore();
      if(s){
        var key = 'core|' + JSON.stringify([
          s.stack.map(function(p){ return String(p[1]); }),
          s.regs.map(function(p){ return String(p[1]); })
        ]);
        if(key === lastKey) return;
        lastKey = key;
        renderCore(s);
        return;
      }
      /* ядро ещё не поднялось — берём разметку корпуса */
      var sCells = cells(document.getElementById('stack'));
      var rCells = cells(document.getElementById('regs'));
      var domKey = 'dom|' + JSON.stringify([sCells, rCells]);
      if(domKey === lastKey) return;
      lastKey = domKey;
      drawStack(stEl, sCells);
      drawGrid(rgEl, rCells);
    }

    setInterval(sync, 300);
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

    window.B3Screens = {
      set: setActive,
      next: next,
      get current(){ return active; }
    };
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
