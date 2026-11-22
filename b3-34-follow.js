/* ============================================================
   b3-34-follow.js — режим трёх разделов (v6)
   Складывает страницу в три «поля»:
     1. Числа и регистры (сам калькулятор + состояние)
     2. Программа (листинг, текущий шаг)
     3. Журнал и маршрут
   И переключает их при каждом шаге: сверху липкая панель,
   а раздел меняется сам — как просил: «перемещение по трём
   разным полям, перерисовка на каждом шаге».
   Ядро b3-34.js не трогается. Откат — открыть v5.
   ============================================================ */
(function(){
  'use strict';
  var tries = 0;

  function css(){
    if(document.getElementById('flwStyle')) return;
    var s = document.createElement('style');
    s.id = 'flwStyle';
    s.textContent = [
      /* липкая панель управления */
      '.flw{position:sticky;top:0;z-index:40;background:#191b17;border:1px solid #3c4238;border-radius:14px;padding:8px;margin:12px 0 10px;box-shadow:0 8px 20px rgba(0,0,0,.5)}',
      '.flw .dbgbar{margin:0 0 8px}',
      '.flw .dbgpc{margin-left:auto}',
      '.flwtabs{display:flex;gap:6px;margin:0 0 7px}',
      '.flwtabs button{flex:1;background:#2b2f28;color:#cfd6c4;border:1px solid #454b3f;border-radius:9px;padding:9px 3px;font-size:12px;font-family:inherit;line-height:1.1}',
      '.flwtabs button:active{background:#3a4034}',
      '.flwtabs button.on{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      '.flwchk{display:inline-flex;align-items:center;gap:5px;color:#8b9382;font-size:11px;margin-right:10px}',
      /* разделы */
      '.fld{border:1px solid #3c4238;border-radius:14px;background:#191b17;margin:0 0 10px;overflow:hidden}',
      '.fldh{padding:9px 12px;color:#b8e89c;font-size:12px;letter-spacing:.3px;background:#20241d;border-bottom:1px solid #333a2e;cursor:pointer}',
      '.fldh:after{content:" ▾";color:#6f9c60}',
      '.fld[data-on="0"] .fldh:after{content:" ▸"}',
      '.fld[data-on="0"] > *:not(.fldh){display:none !important}',
      /* сам калькулятор уже в своей рамке — обёртку делаем прозрачной */
      '.fld.calc{background:transparent;border:0;overflow:visible}',
      '.fld.calc > .fldh{border-radius:12px;border:1px solid #3c4238;background:#20241d}',
      '.fld.calc[data-on="1"] > .case{margin-top:0}',
      /* подсветка раздела, к которому перешли */
      '.fld.on-air{box-shadow:0 0 0 2px #5b8a4c inset}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function ready(){
    var dbg = document.querySelector('.dbg');
    var caseEl = document.querySelector('.case');
    if((!dbg || !caseEl) && tries++ < 30){ setTimeout(ready, 200); return; }
    if(!dbg || !caseEl) return;
    try{ build(dbg, caseEl); }
    catch(e){ if(window.console) console.warn('follow: не построилось', e); }
  }

  function build(dbg, caseEl){
    if(document.getElementById('flwBar')) return;
    css();

    var tab = document.getElementById('tabCalc') || document.body;
    var bar = dbg.querySelector('.dbgbar');
    var regsEl = dbg.querySelector('#dbgRegs');
    var progEl = dbg.querySelector('#dbgProg');
    var logEl  = dbg.querySelector('#dbgLog');
    var routeEl= dbg.querySelector('#dbgRoute');
    var secs = [].slice.call(dbg.querySelectorAll('.dbgsec'));

    /* 1. липкая панель: кнопки шага + переключатель разделов */
    var fbar = document.createElement('div');
    fbar.className = 'flw';
    fbar.id = 'flwBar';
    fbar.innerHTML =
      '<div class="flwtabs">'
      + '<button data-s="calc" class="on">🧮 Числа</button>'
      + '<button data-s="prog">📜 Программа</button>'
      + '<button data-s="log">📋 Журнал</button>'
      + '</div>'
      + '<label class="flwchk"><input type="checkbox" id="flwFollow" checked> следить за шагом</label>'
      + '<label class="flwchk"><input type="checkbox" id="flwFold" checked> по одному</label>';
    tab.insertBefore(fbar, dbg);
    if(bar) fbar.appendChild(bar);

    /* 2. три раздела */
    function wrap(cls, title, nodes){
      var w = document.createElement('div');
      w.className = 'fld ' + cls;
      w.setAttribute('data-f', cls);
      var h = document.createElement('div');
      h.className = 'fldh';
      h.textContent = title;
      h.addEventListener('click', function(){ setActive(cls, true); });
      w.appendChild(h);
      nodes.forEach(function(n){ if(n) w.appendChild(n); });
      return w;
    }

    var calcSec = wrap('calc', '🧮 Числа и регистры', [caseEl, secs[0], regsEl]);
    var progSec = wrap('prog', '📜 Программа', [secs[1], progEl]);
    var logSec  = wrap('log',  '📋 Журнал и маршрут', [secs[2], logEl, secs[3], routeEl]);

    tab.insertBefore(calcSec, dbg);
    tab.insertBefore(progSec, dbg);
    tab.insertBefore(logSec, dbg);
    dbg.style.display = 'none';

    var map = { calc: calcSec, prog: progSec, log: logSec };
    var order = ['calc', 'prog', 'log'];
    var active = 'calc';

    function foldOn(){
      var c = document.getElementById('flwFold');
      return c ? c.checked : true;
    }

    function setActive(name, scroll){
      active = name;
      order.forEach(function(k){
        map[k].setAttribute('data-on', (foldOn() || k === name) ? '1' : '0');
        if(k === name) map[k].classList.add('on-air');
        else map[k].classList.remove('on-air');
      });
      [].forEach.call(fbar.querySelectorAll('.flwtabs button'), function(b){
        b.className = (b.getAttribute('data-s') === name) ? 'on' : '';
      });
      if(scroll){
        var top = fbar.getBoundingClientRect().height + 8;
        var y = map[name].getBoundingClientRect().top + window.pageYOffset - top;
        try{ window.scrollTo({ top: (y > 0 ? y : 0), behavior: 'smooth' }); }
        catch(e){ window.scrollTo(0, (y > 0 ? y : 0)); }
      }
    }

    fbar.addEventListener('click', function(e){
      var t = e.target;
      while(t && t !== fbar){
        if(t.tagName === 'BUTTON' && t.getAttribute('data-s')){
          setActive(t.getAttribute('data-s'), true);
          return;
        }
        t = t.parentNode;
      }
    });

    var foldC = document.getElementById('flwFold');
    if(foldC) foldC.addEventListener('change', function(){ setActive(active, false); });
    var folC = document.getElementById('flwFollow');
    if(folC) folC.addEventListener('change', function(){
      if(!this.checked) order.forEach(function(k){ map[k].classList.remove('on-air'); });
      else setActive(active, false);
    });

    /* 3. слежение: каждая новая строка журнала = новый шаг */
    var busy = false;
    function tick(){
      if(busy) return;
      var c = document.getElementById('flwFollow');
      if(!c || !c.checked) return;
      if(!logEl.querySelector('.dbgline')) return;
      busy = true;
      var i = order.indexOf(active);
      setActive(order[(i + 1) % 3], true);
      setTimeout(function(){ busy = false; }, 450);
    }

    var obs = new MutationObserver(function(){ setTimeout(tick, 70); });
    obs.observe(logEl, { childList: true });

    setActive('calc', false);
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
