/* ============================================================
   b3-34-panel.js — нижняя панель и библиотека сбоку (v8, ревизия 2)
   • верхние кнопки (.tools) убраны с экрана совсем — они в шторке ⋯
   • нижняя панель в две тонкие строки: разделы + действия
   • «Журнал» из строки действий убран (он есть среди разделов)
   • «С адреса 00» укорочена до «⟲ 00», чтобы не ломала строку
   • высота отступа под панель считается по факту, а не на глаз
   Ядро b3-34.js, отладчик b3-34-fix.js и b3-34-follow.js не тронуты.
   Откат — открыть b3-34-classic.html или b3-34-v7.html.
   ============================================================ */
(function(){
  'use strict';

  var KEY = 'b334.panel2.study';
  var study = false;
  try{ study = localStorage.getItem(KEY) === '1'; }catch(e){}

  /* ---------------- стили ---------------- */
  function css(){
    if(document.getElementById('pnlStyle')) return;
    var s = document.createElement('style');
    s.id = 'pnlStyle';
    s.textContent = [
      /* верхняя навигация и верхние кнопки уходят с экрана */
      '.tabs{display:none!important}',
      '.tools{display:none!important}',
      '#flwBar{display:none!important}',
      '#help{display:none!important}',
      '#hint{font-size:11px!important;opacity:.7}',

      /* сама панель */
      '#pnl{position:fixed;left:0;right:0;bottom:0;z-index:70;background:#191b17;border-top:1px solid #3c4238;'
        + 'padding:5px 6px calc(5px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:5px}',
      '#pnl .prow{display:flex;gap:5px;align-items:stretch;min-width:0}',
      '#pnl button,#pnl select,#pnl input{font-family:inherit;border-radius:9px;border:1px solid #454b3f;'
        + 'background:#2b2f28;color:#cfd6c4;font-size:12px;line-height:1.1;white-space:nowrap;'
        + 'overflow:hidden;text-overflow:ellipsis;padding:9px 3px}',
      '#pnl button:active{background:#3a4034}',

      /* строка разделов */
      '#pnl .flwtabs{display:flex;gap:5px;flex:1;min-width:0;margin:0!important}',
      '#pnl .flwtabs button{flex:1;min-width:0;padding:7px 2px;font-size:12px}',

      /* строка действий */
      '#pnl .dbgbar{display:flex;gap:5px;align-items:center;flex:1;min-width:0;margin:0!important;'
        + 'flex-wrap:nowrap!important;overflow:hidden}',
      '#pnl .dbgbar button{flex:1 1 0;min-width:0;padding:9px 2px}',
      '#pnl .dbgpc{display:none!important}',

      '#pnlLib,#pnlMore{flex:0 0 42px!important;font-size:16px;padding:9px 0}',

      /* шторка ⋯ и боковая библиотека */
      '#pnlSheet,#pnlDrawer{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);display:none}',
      '#pnlSheet.on,#pnlDrawer.on{display:block}',
      '.pnlCard{position:absolute;left:0;right:0;bottom:0;background:#20241d;border-top:1px solid #454b3f;'
        + 'border-radius:16px 16px 0 0;padding:12px 12px calc(14px + env(safe-area-inset-bottom));max-height:80vh;overflow:auto}',
      '#pnlDrawer .pnlCard{top:0;bottom:0;right:auto;width:88%;max-width:420px;border-radius:0 16px 16px 0;'
        + 'border-right:1px solid #454b3f;padding-top:calc(14px + env(safe-area-inset-top))}',
      '.pnlTop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;'
        + 'color:#b8e89c;font-size:13px;letter-spacing:.3px}',
      '.pnlTop button{background:#2b2f28;border:1px solid #454b3f;color:#cfd6c4;border-radius:8px;'
        + 'padding:6px 10px;font-family:inherit;font-size:13px}',
      '.pnlGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.pnlGrid button{background:#2b2f28;border:1px solid #454b3f;color:#cfd6c4;border-radius:10px;'
        + 'padding:12px 8px;font-family:inherit;font-size:13px;text-align:left;line-height:1.2;'
        + 'white-space:normal;overflow:visible}',
      '.pnlGrid button:active{background:#3a4034}',
      '.pnlGrid button.full{grid-column:1/-1;text-align:center;color:#b8e89c;border-color:#6f9c60}',
      'body.study .pnlManual{display:none!important}',
      '.pnlNote{color:#8b9382;font-size:11px;line-height:1.45;margin-top:10px}',
      '@media(min-width:760px){#pnl{left:auto;right:14px;bottom:14px;width:540px;border:1px solid #3c4238;border-radius:14px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- поиск кнопок по id или по слову ---------------- */
  function findBtn(id, word){
    var el = document.getElementById(id);
    if(el) return el;
    if(!word) return null;
    var scope = document.querySelector('.tools') || document;
    var btns = scope.querySelectorAll('button');
    for(var i = 0; i < btns.length; i++){
      var t = (btns[i].textContent || '').toLowerCase();
      if(t.indexOf(word) >= 0) return btns[i];
    }
    return null;
  }

  /* ---------------- сборка ---------------- */
  var tries = 0;

  function ready(){
    var flw = document.getElementById('flwBar');
    if(!flw){
      if(tries++ < 40) setTimeout(ready, 150);
      return;
    }
    try{ build(flw); }
    catch(e){ if(window.console) console.warn('panel: не собралось', e); }
  }

  function build(flw){
    if(document.getElementById('pnl')) return;
    css();

    var dbgbar = flw.querySelector('.dbgbar');
    var tabs   = flw.querySelector('.flwtabs');
    if(!dbgbar && !tabs) return;

    /* --- наводим порядок в строке действий --- */
    if(dbgbar){
      var bs = dbgbar.querySelectorAll('button');
      for(var i = 0; i < bs.length; i++){
        var b = bs[i];
        var t = (b.textContent || '').trim();
        if(/^журнал/i.test(t)){ b.style.display = 'none'; continue; }
        if(/с адреса/i.test(t)){ b.textContent = '⟲ 00'; b.title = t; }
      }
    }

    /* --- нижняя панель --- */
    var panel = document.createElement('div');
    panel.id = 'pnl';

    if(tabs){
      var r1 = document.createElement('div');
      r1.className = 'prow';
      r1.appendChild(tabs);
      panel.appendChild(r1);
    }

    var r2 = document.createElement('div');
    r2.className = 'prow';

    var lib = document.createElement('button');
    lib.id = 'pnlLib';
    lib.type = 'button';
    lib.textContent = '☰';
    lib.title = 'Библиотека программ';
    lib.addEventListener('click', openDrawer);
    r2.appendChild(lib);

    if(dbgbar) r2.appendChild(dbgbar);

    var more = document.createElement('button');
    more.id = 'pnlMore';
    more.type = 'button';
    more.textContent = '⋯';
    more.title = 'Ещё';
    more.addEventListener('click', openSheet);
    r2.appendChild(more);

    panel.appendChild(r2);
    document.body.appendChild(panel);

    /* --- шторка «Ещё» --- */
    var sheet = document.createElement('div');
    sheet.id = 'pnlSheet';
    sheet.innerHTML =
      '<div class="pnlCard">'
      + '<div class="pnlTop"><b>Ещё</b><button type="button" data-close="1">✕</button></div>'
      + '<div class="pnlGrid">'
      + proxy('btnRun',   '▶ Пуск',     'пуск')
      + proxy('btnStop',  '⏹ Стоп',     'стоп')
      + proxy('btnReset', '⏻ Сброс',    'сброс')
      + proxy('btnPick',  '📥 Пример…', 'пример')
      + '<button type="button" id="pnlFiles">💾 Файлы</button>'
      + proxy('btnSpeed', '🐢 Темп',    'темп')
      + proxy('btnSound', '🔊 Звук',    'звук',   'pnlManual')
      + proxy('btnVoice', '🗣 Голос',   'голос',  'pnlManual')
      + proxy('btnMic',   '🎤 Сказать', 'сказать','pnlManual')
      + proxy('btnHelp',  '❓ Справка', 'справка','pnlManual')
      + '<button type="button" id="pnlStudy" class="full"></button>'
      + '</div>'
      + '<div class="pnlNote" id="pnlNote"></div>'
      + '</div>';
    document.body.appendChild(sheet);

    /* --- боковая библиотека --- */
    var drawer = document.createElement('div');
    drawer.id = 'pnlDrawer';
    drawer.innerHTML =
      '<div class="pnlCard">'
      + '<div class="pnlTop"><b>📚 Библиотека</b><button type="button" data-close="1">✕</button></div>'
      + '<div id="pnlDrwBody"></div>'
      + '</div>';
    document.body.appendChild(drawer);

    var drwBody = drawer.querySelector('#pnlDrwBody');
    var mem = document.querySelector('.mem');
    if(mem) drwBody.appendChild(mem);

    var cat = document.getElementById('tabCatalog');
    if(cat){
      cat.style.display = '';
      var catTitle = document.createElement('div');
      catTitle.className = 'pnlNote';
      catTitle.textContent = 'Готовые программы и справочник команд';
      drwBody.appendChild(catTitle);
      drwBody.appendChild(cat);
    }

    function proxy(id, label, word, cls){
      return '<button type="button" data-proxy="' + id + '" data-word="' + (word || '') + '"'
        + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>';
    }

    sheet.addEventListener('click', function(e){
      if(e.target === sheet){ closeSheet(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;
      if(b.getAttribute('data-close')){ closeSheet(); return; }
      if(b.id === 'pnlFiles'){ closeSheet(); openDrawer(); return; }
      if(b.id === 'pnlStudy'){ toggleStudy(); return; }
      var src = b.getAttribute('data-proxy');
      if(src){
        var orig = findBtn(src, b.getAttribute('data-word'));
        if(orig) orig.click();
        else if(window.console) console.warn('panel: не нашла кнопку', src);
        setTimeout(closeSheet, 120);
      }
    });

    drawer.addEventListener('click', function(e){
      if(e.target === drawer){ closeDrawer(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if(b && b.getAttribute('data-close')) closeDrawer();
    });

    function openSheet(){
      applyStudy();
      syncProxies();
      sheet.classList.add('on');
    }
    function closeSheet(){ sheet.classList.remove('on'); }
    function openDrawer(){ drawer.classList.add('on'); }
    function closeDrawer(){ drawer.classList.remove('on'); }

    /* --- подписи кнопок в шторке берём у настоящих кнопок --- */
    function syncProxies(){
      var list = sheet.querySelectorAll('[data-proxy]');
      for(var i = 0; i < list.length; i++){
        var b = list[i];
        var orig = findBtn(b.getAttribute('data-proxy'), b.getAttribute('data-word'));
        if(!orig){ b.style.display = 'none'; continue; }
        b.style.display = '';
        var t = (orig.textContent || '').trim();
        if(t) b.textContent = t;
      }
    }

    /* --- учебный режим --- */
    function toggleStudy(){
      study = !study;
      try{ localStorage.setItem(KEY, study ? '1' : '0'); }catch(e){}
      applyStudy();
    }

    function applyStudy(){
      document.body.classList.toggle('study', study);
      var tools = document.querySelector('.tools');
      if(tools) tools.style.display = 'none';   /* верхние кнопки скрыты всегда */
      var b = document.getElementById('pnlStudy');
      if(b) b.textContent = study ? '⌨ Выйти из учебного режима' : '🎓 Учебный режим';
      var note = document.getElementById('pnlNote');
      if(note) note.textContent = study
        ? 'Учебный режим: прогоняем программу по шагам и смотрим, что меняется. Голос, микрофон и справка скрыты.'
        : 'Ручной режим: набор команд, голос и микрофон доступны.';
    }

    /* --- отступ под панель по фактической высоте --- */
    function fit(){
      document.body.style.paddingBottom = (panel.offsetHeight + 12) + 'px';
    }
    fit();
    setTimeout(fit, 250);
    setTimeout(fit, 1000);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function(){ setTimeout(fit, 300); });

    applyStudy();
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
