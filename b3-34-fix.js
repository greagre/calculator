/* ============================================================
   b3-34-fix.js — v2
   1) Патч ядра b3-34.js без правки самого файла:
      у клавиш слоёв F и K нет поля a (например {t:'sin', c:0x1C}),
      а onKey разбирает нажатие только по k.a. Отсюда молчали
      sin, cos, lg, x<0, L0–L3, К НОП и прочие.
   2) Отладчик: видно, что происходит внутри.
      Регистры X/Y/Z/T/X1 и R0–Rd, счётчик команд, листинг
      программы с подсветкой текущего шага, журнал каждой
      команды (что изменилось) и маршрут выполнения.

   Ядро b3-34.js не изменяется: текст читается, в него
   вставляются две строки (нормализация клавиши и экспорт
   состояния), затем скрипт исполняется. Откат — открыть v3/v4
   или убрать этот файл со страницы.
   ============================================================ */
(function(){
  'use strict';

  function loadText(path){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, false);           // синхронно: важен порядок запуска
    xhr.send(null);
    if(xhr.status && xhr.status >= 400){
      throw new Error(path + ' — HTTP ' + xhr.status);
    }
    return xhr.responseText;
  }

  function runCode(code){
    var s = document.createElement('script');
    /* закрывающий тег внутри текста не должен оборвать вставку */
    s.textContent = code.replace(/<\/script/gi, '<\\/script');
    document.body.appendChild(s);
  }

  function fatal(msg){
    var box = document.getElementById('hint');
    if(box){
      box.textContent = msg;
      box.style.color = '#ff8a7a';
    }
    if(window.console) console.error(msg);
  }

  var core;
  try{
    core = loadText('b3-34.js?v=7');
  }catch(e){
    fatal('Не удалось загрузить ядро калькулятора: ' + (e.message || 'ошибка'));
    return;
  }

  /* ---------- 1. клавиши слоёв F и K ---------- */
  var PATCH = 'function onKey(k){'
    + ' if(!k.a && typeof k.c === "number"){'
    + ' k = { t:k.t, a:"code", c:k.c, jump:k.jump, cls:k.cls }; }';

  var patched = core.replace(/function onKey\(k\)\{/, PATCH);

  if(patched === core){
    fatal('Патч не применился: в b3-34.js не найден обработчик onKey(k). '
        + 'Клавиши функций работать не будут — проверьте ядро.');
  }

  /* ---------- 2. отдать состояние наружу ---------- */
  var EXPORT = 'window.B334 = {'
    + ' get ST(){ return ST; },'
    + ' step: runStep, exec: execCode, render: render, onKey: onKey,'
    + ' cmdName: cmdName, codeStr: codeStr, hex2: hex2, p2: p2,'
    + ' isJumpCmd: isJumpCmd, jumpAddr: jumpAddr,'
    + ' fmtNum: fmtNum, shortNum: shortNum, REG_NAMES: REG_NAMES'
    + ' };';

  var pos = patched.lastIndexOf('})();');
  if(pos < 0){
    fatal('В ядре не найден конец скрипта — экспорт состояния не вставлен.');
  }else{
    /* экспорт ставится перед закрытием внешней функции, после init() */
    patched = patched.slice(0, pos) + EXPORT + patched.slice(pos);
  }

  try{
    runCode(patched);
  }catch(e){
    fatal('Ошибка при запуске ядра: ' + (e.message || 'ошибка'));
    return;
  }

  ['catalog.js?v=4', 'b3-34-export.js?v=1'].forEach(function(p){
    try{ runCode(loadText(p)); }
    catch(e){ if(window.console) console.warn('Не загрузился ' + p, e); }
  });

  /* ---------- 3. отладчик ---------- */
  function addStyles(){
    if(document.getElementById('dbgStyle')) return;
    var st = document.createElement('style');
    st.id = 'dbgStyle';
    st.textContent = [
      '.dbg{margin:14px 0 0;border:1px solid #3c4238;border-radius:14px;background:#191b17;color:#dfe3d5;padding:10px 10px 12px;font-size:13px}',
      '.dbg *{box-sizing:border-box}',
      '.dbghead{display:flex;align-items:center;gap:8px;margin:0 0 8px}',
      '.dbghead b{font-size:14px;letter-spacing:.3px}',
      '.dbgnote{flex:1;color:#8b9382;font-size:11px;line-height:1.2}',
      '.dbg button{background:#2b2f28;color:#dfe3d5;border:1px solid #454b3f;border-radius:8px;padding:7px 10px;font-size:12px;font-family:inherit}',
      '.dbg button:active{background:#3a4034}',
      '.dbgbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}',
      '.dbgbar .step{background:#2f4a2a;border-color:#4c7a41}',
      '.dbgbar .on{background:#4c7a41;border-color:#6f9c60}',
      '.dbgpc{margin-left:auto;font-family:ui-monospace,monospace;color:#9fd67a;font-size:12px}',
      '.dbgsec{margin:12px 0 5px;color:#8b9382;font-size:11px;letter-spacing:.6px;text-transform:uppercase}',
      '.dbgregs{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}',
      '.dbgcell{background:#22251f;border:1px solid #353a31;border-radius:7px;padding:4px 5px;min-width:0}',
      '.dbgcell i{display:block;font-style:normal;color:#8b9382;font-size:10px}',
      '.dbgcell b{display:block;font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dbgcell.ch{background:#2c3a26;border-color:#5b8a4c}',
      '.dbgcell.ch b{color:#b8e89c}',
      '.dbgcell.stk{border-color:#4a4433}',
      '.dbgprog{max-height:190px;overflow:auto;background:#22251f;border:1px solid #353a31;border-radius:8px;padding:4px}',
      '.dbgprow{display:flex;gap:8px;padding:3px 6px;border-radius:5px;font-family:ui-monospace,monospace;font-size:12px;cursor:pointer}',
      '.dbgprow .a{color:#7d8574;width:22px;flex:none}',
      '.dbgprow .c{color:#c8a24a;width:26px;flex:none}',
      '.dbgprow .n{color:#dfe3d5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dbgprow.past .n{color:#a9b39c}',
      '.dbgprow.cur{background:#3a5a2f}',
      '.dbgprow.cur .n,.dbgprow.cur .a,.dbgprow.cur .c{color:#e8ffd6}',
      '.dbglog{max-height:230px;overflow:auto;background:#22251f;border:1px solid #353a31;border-radius:8px;padding:5px}',
      '.dbgline{display:flex;gap:7px;padding:3px 5px;border-bottom:1px solid #2b2f28;font-size:12px;line-height:1.35}',
      '.dbgline:last-child{border-bottom:0}',
      '.dbgline .a{color:#7d8574;font-family:ui-monospace,monospace;width:20px;flex:none}',
      '.dbgline .c{color:#c8a24a;font-family:ui-monospace,monospace;width:24px;flex:none}',
      '.dbgline .n{width:76px;flex:none;color:#dfe3d5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dbgline .d{flex:1;color:#9fb894;font-size:11px;word-break:break-word}',
      '.dbgline.jmp .n{color:#7fb6e8}',
      '.dbgline.jmp .d{color:#8fc3ee}',
      '.dbgline.err .n{color:#ff8a7a}',
      '.dbgline.err .d{color:#ff8a7a}',
      '.dbgempty{color:#7d8574;font-size:12px;padding:6px}',
      '.dbgroute{background:#22251f;border:1px solid #353a31;border-radius:8px;padding:7px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.8;word-break:break-word}',
      '.dbgroute .ad{color:#dfe3d5}',
      '.dbgroute .ar{color:#6f7768;padding:0 2px}',
      '.dbgroute .jp{color:#7fb6e8}',
      '.dbgroute .cu{background:#3a5a2f;color:#e8ffd6;border-radius:4px;padding:1px 3px}',
      '.dbg[data-min="1"] .dbgbody{display:none}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function buildDebug(){
    var B = window.B334;
    if(!B || !B.ST){ return; }

    addStyles();

    var host = document.getElementById('tabCalc');
    if(!host) return;

    var box = document.createElement('div');
    box.className = 'dbg';
    box.innerHTML =
      '<div class="dbghead"><b>🔬 Отладчик</b>'
      + '<span class="dbgnote">что происходит внутри: регистры, шаги, маршрут</span>'
      + '<button id="dbgMin">Свернуть</button></div>'
      + '<div class="dbgbody">'
      + '  <div class="dbgbar">'
      + '    <button id="dbgStep" class="step">▶ Шаг</button>'
      + '    <button id="dbgAuto">⏵ Авто</button>'
      + '    <button id="dbgZero">⟲ С адреса 00</button>'
      + '    <button id="dbgClear">🗑 Журнал</button>'
      + '    <span class="dbgpc" id="dbgPc">PC 00</span>'
      + '  </div>'
      + '  <div class="dbgsec">Состояние</div>'
      + '  <div class="dbgregs" id="dbgRegs"></div>'
      + '  <div class="dbgsec">Программа <span id="dbgLen" style="color:#7d8574"></span></div>'
      + '  <div class="dbgprog" id="dbgProg"></div>'
      + '  <div class="dbgsec">Журнал шагов</div>'
      + '  <div class="dbglog" id="dbgLog"></div>'
      + '  <div class="dbgsec">Маршрут выполнения</div>'
      + '  <div class="dbgroute" id="dbgRoute"></div>'
      + '</div>';

    var hintEl = document.getElementById('hint');
    if(hintEl && hintEl.parentNode === host){
      host.insertBefore(box, hintEl.nextSibling);
    }else{
      host.appendChild(box);
    }

    var ST = B.ST;
    var els = {
      regs: box.querySelector('#dbgRegs'),
      prog: box.querySelector('#dbgProg'),
      log:  box.querySelector('#dbgLog'),
      route:box.querySelector('#dbgRoute'),
      pc:   box.querySelector('#dbgPc'),
      len:  box.querySelector('#dbgLen')
    };

    var log = [];         /* записи журнала */
    var route = [];       /* адреса по порядку */
    var visited = {};     /* какие адреса уже выполнялись */
    var autoTimer = null;
    var progKey = '';

    function n(v){ return B.fmtNum(v); }

    function snapshot(){
      return {
        X:ST.X, Y:ST.Y, Z:ST.Z, T:ST.T, X1:ST.X1,
        R:ST.R.slice(0, 14), ip:ST.ip
      };
    }

    function diff(a, b){
      var out = [];
      ['X','Y','Z','T','X1'].forEach(function(k){
        if(a[k] !== b[k]) out.push(k + ' ' + n(a[k]) + '→' + n(b[k]));
      });
      for(var i = 0; i < 14; i++){
        if(a.R[i] !== b.R[i]) out.push('R' + B.REG_NAMES[i] + ' ' + n(a.R[i]) + '→' + n(b.R[i]));
      }
      return out;
    }

    function progLast(){
      var last = -1;
      for(var i = 0; i < 98; i++){ if(ST.prog[i] !== 0x54) last = i; }
      return last;
    }

    function drawState(){
      var cells = [];
      var stack = [['X', ST.X], ['Y', ST.Y], ['Z', ST.Z], ['T', ST.T], ['X1', ST.X1]];
      stack.forEach(function(p){
        cells.push('<div class="dbgcell stk"><i>' + p[0] + '</i><b>' + n(p[1]) + '</b></div>');
      });
      for(var i = 0; i < 14; i++){
        cells.push('<div class="dbgcell"><i>R' + B.REG_NAMES[i] + '</i><b>' + n(ST.R[i]) + '</b></div>');
      }
      els.regs.innerHTML = cells.join('');

      els.pc.textContent = 'PC ' + B.p2(ST.ip) + ' · ' + B.cmdName(ST.prog[ST.ip]);
    }

    function drawProg(){
      var last = progLast();
      var key = last + '|' + ST.prog.slice(0, last + 1).join(',');
      if(key === progKey){
        /* программа не менялась — только переставим подсветку */
        var rowsNow = els.prog.children;
        for(var j = 0; j < rowsNow.length; j++){
          var a = parseInt(rowsNow[j].getAttribute('data-a'), 10);
          rowsNow[j].className = 'dbgprow' + (a === ST.ip ? ' cur' : (visited[a] ? ' past' : ''));
        }
        return;
      }
      progKey = key;

      els.len.textContent = last < 0 ? '(пусто)' : ('шагов: ' + (last + 1) + ' из 98');
      els.prog.innerHTML = '';
      if(last < 0){
        els.prog.innerHTML = '<div class="dbgempty">Программа пуста. Набери её в режиме ПРГ (f → ПРГ) или загрузи пример.</div>';
        return;
      }
      for(var i = 0; i <= last; i++){
        var code = ST.prog[i];
        var row = document.createElement('div');
        row.className = 'dbgprow' + (i === ST.ip ? ' cur' : (visited[i] ? ' past' : ''));
        row.setAttribute('data-a', String(i));
        row.innerHTML = '<span class="a">' + B.p2(i) + '</span>'
          + '<span class="c">' + B.hex2(code) + '</span>'
          + '<span class="n">' + B.cmdName(code) + '</span>';
        row.addEventListener('click', function(){
          var a = parseInt(this.getAttribute('data-a'), 10);
          stopAuto();
          ST.ip = a;
          drawState(); drawProg();
          box.querySelector('#dbgPc').textContent = 'PC ' + B.p2(ST.ip) + ' · ' + B.cmdName(ST.prog[ST.ip]);
        });
        els.prog.appendChild(row);
      }
    }

    function drawLog(){
      if(!log.length){
        els.log.innerHTML = '<div class="dbgempty">Пока пусто. Жми «▶ Шаг» — каждая команда появится здесь: что взяла и что изменила.</div>';
        return;
      }
      var html = [];
      var from = Math.max(0, log.length - 200);
      for(var i = from; i < log.length; i++){
        var r = log[i];
        var cls = 'dbgline';
        if(r.err) cls += ' err';
        else if(r.res === 'jump') cls += ' jmp';
        var d = r.d.length ? r.d.join(', ') : 'без изменений';
        if(r.note) d = r.note + (r.d.length ? ' · ' + d : '');
        if(r.res === 'jump' && r.ip !== r.pc + 1){
          d += ' · ⤵ переход на ' + B.p2(r.ip);
        }
        if(r.res === 'stop') d += ' · ⏹ остановка';
        html.push('<div class="' + cls + '">'
          + '<span class="a">' + B.p2(r.pc) + '</span>'
          + '<span class="c">' + B.hex2(r.code) + '</span>'
          + '<span class="n">' + r.name + '</span>'
          + '<span class="d">' + d + '</span></div>');
      }
      els.log.innerHTML = html.join('');
      els.log.scrollTop = els.log.scrollHeight;
    }

    function drawRoute(){
      if(!route.length){
        els.route.innerHTML = '<span class="dbgempty">Здесь появится путь программы: адреса по порядку и места, где она свернула.</span>';
        return;
      }
      var html = [];
      for(var i = 0; i < route.length; i++){
        var a = route[i];
        var lastOne = (i === route.length - 1);
        html.push('<span class="ad' + (lastOne ? ' cu' : '') + '">' + B.p2(a) + '</span>');
        if(!lastOne){
          var nx = route[i + 1];
          var jump = (nx !== a + 1) && (nx !== a + 2) && (nx !== a + 3);
          html.push('<span class="ar">→</span>');
          if(jump) html.push('<span class="jp">⤵</span>');
        }
      }
      els.route.innerHTML = html.join('');
    }

    function doStep(){
      if(ST.err){
        ST.err = false;
        log.push({ pc:ST.ip, code:ST.prog[ST.ip], name:'—', d:[], res:'cont',
                   note:'ЕГГОГ снят, продолжаем' });
      }
      if(ST.mode !== 'AUT'){ ST.mode = 'AUT'; }

      var pc = ST.ip;
      var code = ST.prog[pc];
      var before = snapshot();
      var res = B.step();
      var after = snapshot();

      log.push({
        pc: pc,
        code: code,
        name: B.cmdName(code),
        d: diff(before, after),
        res: res,
        ip: after.ip,
        err: !!ST.err
      });
      route.push(pc);
      visited[pc] = true;

      drawState(); drawProg(); drawLog(); drawRoute();

      if(res === 'stop' || ST.err){ stopAuto(); }

      try{ B.render(); }catch(e){}
    }

    function stopAuto(){
      if(autoTimer){ clearInterval(autoTimer); autoTimer = null; }
      var b = box.querySelector('#dbgAuto');
      if(b){ b.className = ''; b.textContent = '⏵ Авто'; }
    }

    function startAuto(){
      stopAuto();
      var b = box.querySelector('#dbgAuto');
      if(b){ b.className = 'on'; b.textContent = '⏸ Пауза'; }
      autoTimer = setInterval(function(){
        doStep();
      }, 700);
    }

    box.querySelector('#dbgStep').addEventListener('click', function(){
      stopAuto();
      doStep();
    });
    box.querySelector('#dbgAuto').addEventListener('click', function(){
      if(autoTimer) stopAuto(); else startAuto();
    });
    box.querySelector('#dbgZero').addEventListener('click', function(){
      stopAuto();
      ST.ip = 0;
      visited = {}; route = []; log = [];
      drawState(); drawProg(); drawLog(); drawRoute();
      try{ B.render(); }catch(e){}
    });
    box.querySelector('#dbgClear').addEventListener('click', function(){
      log = []; route = []; visited = {};
      drawProg(); drawLog(); drawRoute();
    });
    box.querySelector('#dbgMin').addEventListener('click', function(){
      var min = box.getAttribute('data-min') === '1';
      box.setAttribute('data-min', min ? '0' : '1');
      this.textContent = min ? 'Свернуть' : 'Развернуть';
    });

    drawState(); drawProg(); drawLog(); drawRoute();

    /* ядро рисует само; нам нужно подхватывать изменения после его нажатий */
    setInterval(function(){
      drawState();
      drawProg();
    }, 500);
  }

  try{
    buildDebug();
  }catch(e){
    if(window.console) console.warn('Отладчик не построен:', e);
  }
})();
