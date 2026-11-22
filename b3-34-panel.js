/* ============================================================
   b3-34-panel.js — нижняя панель и библиотека сбоку (v8)
   • верхние вкладки убраны, «Программы» переехали в боковую панель ☰
   • всё управление внизу: разделы, Шаг, Авто, 00, ⋯
   • в учебном режиме на виду остаётся только прогон программы:
     голос, микрофон, справка, звук, пример и темп уходят в ⋯
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
      '.tabs{display:none!important}',
      'body{padding-bottom:calc(136px + env(safe-area-inset-bottom))!important}',
      '#flwBar{display:none!important}',

      '#pnl{position:fixed;left:0;right:0;bottom:0;z-index:70;background:#191b17;border-top:1px solid #3c4238;'
        + 'padding:6px 8px calc(8px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px}',
      '#pnl .prow{display:flex;gap:6px;align-items:stretch}',
      '#pnl .prow>.dbgbar,#pnl .prow>.flwtabs{flex:1;min-width:0;margin:0!important}',
      '#pnl button{font-family:inherit;border-radius:10px;border:1px solid #454b3f;background:#2b2f28;'
        + 'color:#cfd6c4;padding:11px 4px;font-size:13px;line-height:1.1}',
      '#pnl button:active{background:#3a4034}',
      '#pnl .flwtabs{display:flex;gap:6px}',
      '#pnl .flwtabs button{flex:1}',
      '#pnl .flwtabs button.on{background:#4c7a41;border-color:#6f9c60;color:#eaffdc}',
      '#pnl .dbgbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
      '#pnl .dbgbar button{flex:1;min-width:64px}',
      '#pnl .dbgpc{margin-left:auto!important;font-size:11px;color:#8b9382}',
      '#pnlLib,#pnlMore{flex:0 0 46px!important;font-size:16px}',

      /* шторка ⋯ и боковая библиотека */
      '#pnlSheet,#pnlDrawer{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);display:none}',
      '#pnlSheet.on,#pnlDrawer.on{display:block}',
      '.pnlCard{position:absolute;left:0;right:0;bottom:0;background:#20241d;border-top:1px solid #454b3f;'
        + 'border-radius:16px 16px 0 0;padding:12px 12px calc(14px + env(safe-area-inset-bottom));max-height:78vh;overflow:auto}',
      '#pnlDrawer .pnlCard{top:0;bottom:0;right:auto;width:88%;max-width:420px;border-radius:0 16px 16px 0;'
        + 'border-right:1px solid #454b3f;padding-top:calc(14px + env(safe-area-inset-top))}',
      '.pnlTop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;'
        + 'color:#b8e89c;font-size:13px;letter-spacing:.3px}',
      '.pnlTop button{background:#2b2f28;border:1px solid #454b3f;color:#cfd6c4;border-radius:8px;'
        + 'padding:6px 10px;font-family:inherit;font-size:13px}',
      '.pnlGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.pnlGrid button{background:#2b2f28;border:1px solid #454b3f;color:#cfd6c4;border-radius:10px;'
        + 'padding:12px 8px;font-family:inherit;font-size:13px;text-align:left;line-height:1.2}',
      '.pnlGrid button:active{background:#3a4034}',
      '.pnlGrid button.full{grid-column:1/-1;text-align:center;color:#b8e89c;border-color:#6f9c60}',
      '.pnlNote{color:#8b9382;font-size:11px;line-height:1.45;margin-top:10px}',

      'body.study .pnlManual{display:none!important}',
      '@media(min-width:760px){#pnl{left:auto;right:14px;bottom:14px;width:540px;border:1px solid #3c4238;border-radius:14px}}'
    ].join('\n');
    document.head.appendChild(s);
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
    lib.addEventListener('click', function(){ openDrawer(); });
    r2.appendChild(lib);

    if(dbgbar) r2.appendChild(dbgbar);

    var more = document.createElement('button');
    more.id = 'pnlMore';
    more.type = 'button';
    more.textContent = '⋯';
    more.title = 'Ещё';
    more.addEventListener('click', function(){ openSheet(); });
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
      + proxy('btnRun',   '▶ Пуск')
      + proxy('btnStop',  '⏹ Стоп')
      + proxy('btnReset', '⏻ Сброс')
      + proxy('btnPick',  '📥 Пример…')
      + '<button type="button" id="pnlFiles">💾 Файлы</button>'
      + proxy('btnSpeed', '🐢 Темп')
      + proxy('btnSound', '🔊 Звук', 'pnlManual')
      + proxy('btnVoice', '🗣 Голос', 'pnlManual')
      + proxy('btnMic',   '🎤 Сказать', 'pnlManual')
      + proxy('btnHelp',  '❓ Справка', 'pnlManual')
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

    /* --- обработчики --- */
    function proxy(id, label, cls){
      return '<button type="button" data-proxy="' + id + '"'
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
        var orig = document.getElementById(src);
        if(orig) orig.click();
      }
    });

    drawer.addEventListener('click', function(e){
      if(e.target === drawer) closeDrawer();
      var b = e.target.closest ? e.target.closest('button') : null;
      if(b && b.getAttribute('data-close')) closeDrawer();
    });

    function openSheet(){
      applyStudy();
      sheet.classList.add('on');
      var b = document.getElementById('pnlStudy');
      if(b) b.textContent = study ? '⌨ Выйти из учебного режима' : '🎓 Учебный режим';
      var note = document.getElementById('pnlNote');
      if(note) note.textContent = study
        ? 'Учебный режим: программа прогоняется по шагам. Голос, микрофон и справка в этом режиме скрыты.'
        : 'Ручной режим: набор команд, голос и микрофон доступны.';
    }
    function closeSheet(){ sheet.classList.remove('on'); }
    function openDrawer(){ drawer.classList.add('on'); }
    function closeDrawer(){ drawer.classList.remove('on'); }

    /* --- учебный режим --- */
    function toggleStudy(){
      study = !study;
      try{ localStorage.setItem(KEY, study ? '1' : '0'); }catch(e){}
      applyStudy();
      var b = document.getElementById('pnlStudy');
      if(b) b.textContent = study ? '⌨ Выйти из учебного режима' : '🎓 Учебный режим';
      var note = document.getElementById('pnlNote');
      if(note) note.textContent = study
        ? 'Учебный режим: программа прогоняется по шагам. Голос, микрофон и справка в этом режиме скрыты.'
        : 'Ручной режим: набор команд, голос и микрофон доступны.';
    }

    function applyStudy(){
      document.body.classList.toggle('study', study);
      var tools = document.querySelector('.tools');
      if(tools) tools.style.display = study ? 'none' : '';
      var hint = document.getElementById('hint');
      if(hint) hint.style.display = study ? 'none' : '';
      var help = document.getElementById('help');
      if(help) help.style.display = study ? 'none' : '';
      var b = document.getElementById('pnlStudy');
      if(b) b.textContent = study ? '⌨ Выйти из учебного режима' : '🎓 Учебный режим';
    }

    applyStudy();
  }

  document.addEventListener('DOMContentLoaded', ready);
  if(document.readyState !== 'loading') ready();
})();
