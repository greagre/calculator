/* ============================================================
   Патч к ядру b3-34.js — без правки самого ядра.
   Причина: клавиши слоёв F и K объявлены без поля a
   (например {t:'sin', c:0x1C}), а onKey разбирает нажатие
   только по k.a. Поэтому sin, cos, lg, x<0, x=0, L0–L3 и
   К НОП молчали: ни считали, ни писались в программу.

   Здесь ядро читается как текст, в начало onKey вставляется
   нормализация «есть код, нет действия -> действие code»,
   после чего скрипт исполняется. Файл b3-34.js не меняется,
   откат — просто убрать этот файл со страницы.
   ============================================================ */
(function(){
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

  var PATCH = 'function onKey(k){'
    + ' if(!k.a && typeof k.c === "number"){'
    + ' k = { t:k.t, a:"code", c:k.c, jump:k.jump, cls:k.cls }; }';

  var patched = core.replace(/function onKey\(k\)\{/, PATCH);

  if(patched === core){
    fatal('Патч не применился: в b3-34.js не найден обработчик onKey(k). '
        + 'Клавиши функций работать не будут — проверьте ядро.');
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
})();
