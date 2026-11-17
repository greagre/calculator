/* ============================================================
   Б3-34 v2 — СОХРАНЕНИЕ И ФАЙЛЫ
   ------------------------------------------------------------
   Один ключ состояния в браузере: b334.state, а внутри поле
   version. Если модель данных поменяется, старые данные можно
   будет перевести миграцией, а не «сбросьте всё».

   Формат TXT — десятичные коды, ровно те, что набираются
   на клавишах: 96 → П→X, 91 → F L1. Адрес перехода записан
   двумя отдельными ячейками-цифрами, как в настоящем Б3-34.

   Импорт понимает:
     • новый вид — десятичные коды;
     • старый вид — hex-коды (определяется по буквам A–F
       в кодах или по строке «# формат: hex»);
     • JSON — и новый ({program:[…]}), и старый ({prog:[номера ячеек]}).
   ============================================================ */
(function(global){
"use strict";

var Core = global.B3Core;
var KEY = 'b334.state';
var VERSION = 2;

function ui(){ return global.B3UI || null; }
function st(){ var u = ui(); return u ? u.state : null; }
function norm(v){ return (Core && Core.norm) ? Core.norm(v) : v; }

function pad2(n){ n = Number(n) || 0; return (n < 10 ? '0' : '') + n; }

function say(text){
  var s = st();
  if(!s) return;
  s.msg = text;
  if(ui() && ui().render) ui().render();
}

function two(n){ n = Number(n); return (n < 10 ? '0' : '') + n; }

function stamp(){
  var d = new Date();
  return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) +
         '-' + two(d.getHours()) + two(d.getMinutes());
}

function fmtDate(iso){
  var d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear() +
         ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
}

/* ---------------- снимок состояния ---------------- */
function snapshot(){
  var s = st();
  if(!s) return null;

  var R = {}, i;
  for(i = 0; i < 14; i++) R[i] = s.m.R[i];

  return {
    app: 'b3-34',
    version: VERSION,
    savedAt: new Date().toISOString(),
    program: s.prog.map(function(it){
      return (it.jump != null) ? { jump: it.jump, to: it.to } : { c: it.c };
    }),
    registers: R,
    x: s.m.X
  };
}

/* ---------------- сборка программы из ячеек ---------------- */
/* На вход — массив кодов ячеек (как в памяти Б3-34).
   На выход — список инструкций, где у перехода адрес это
   НОМЕР ИНСТРУКЦИИ, а не три ячейки. */
function cellsToProgram(cells){
  var arr = cells.slice();
  var warnings = [];

  while(arr.length && (arr[arr.length - 1] | 0) === 0) arr.pop();

  var out = [], addrs = [], i = 0;
  while(i < arr.length){
    var c = arr[i] & 0xFF;
    addrs.push(i);

    if(Core.isJump(c)){
      if(i + 2 >= arr.length){
        warnings.push('у перехода ' + c + ' нет адреса');
        out.push({ c: c });
        i += 1;
        continue;
      }
      var d = (arr[i + 1] | 0) & 0x0F;
      var u = (arr[i + 2] | 0) & 0x0F;
      out.push({ jump: c, toAddr: d * 10 + u });
      i += 3;
    }else{
      out.push({ c: c });
      i += 1;
    }
  }

  out.forEach(function(it){
    if(it.jump == null) return;
    var idx = addrs.indexOf(it.toAddr);
    if(idx < 0){
      warnings.push('адрес ' + pad2(it.toAddr) + ' не найден');
      idx = 0;
    }
    it.to = idx;
    delete it.toAddr;
  });

  return { program: out, warnings: warnings };
}

/* ---------------- приведение загруженного к инструкциям ---------------- */
function normalizeProgram(raw){
  if(!raw || !Array.isArray(raw)) return null;

  var onlyNumbers = raw.length > 0 && raw.every(function(it){ return typeof it === 'number'; });
  if(onlyNumbers) return cellsToProgram(raw).program;

  var out = [];
  raw.forEach(function(it){
    if(it == null) return;
    if(typeof it === 'number'){ out.push({ c: it }); return; }
    if(typeof it.jump === 'number'){
      out.push({ jump: it.jump, to: Number(it.to) || 0 });
      return;
    }
    if(typeof it.c === 'number') out.push({ c: it });
  });
  return out;
}

/* ---------------- применить состояние ---------------- */
function apply(data){
  var s = st();
  if(!s) return { ok:false, error:'калькулятор ещё не готов' };
  if(!data || typeof data !== 'object') return { ok:false, error:'пустые данные' };

  var prog = normalizeProgram(data.program || data.prog);
  if(!prog) return { ok:false, error:'в файле нет программы' };

  s.prog = prog;

  var R = data.registers || data.R || {};
  for(var i = 0; i < 14; i++){
    var v = (typeof R[i] === 'number') ? R[i] : Number(R[i]);
    s.m.R[i] = isFinite(v) ? norm(v) : 0;
  }

  var x = (typeof data.x === 'number') ? data.x : Number(data.x);
  s.m.X = isFinite(x) ? norm(x) : 0;
  s.m.err = false;
  s.m.typing = false;
  s.m.input = '';
  s.buf = '';
  s.addr = '';
  s.waitAddr = 0;
  s.regAct = null;
  s.regProg = null;

  if(ui() && ui().render) ui().render();
  return { ok:true, count: prog.length };
}

/* ---------------- сохранение и восстановление ---------------- */
function save(silent){
  var data = snapshot();
  if(!data) return false;
  try{
    localStorage.setItem(KEY, JSON.stringify(data));
    setInfo('сохранено ' + fmtDate(data.savedAt) + ' · ' + data.program.length + ' инструкций');
    if(!silent) say('сохранено: ' + data.program.length + ' инструкций');
    return true;
  }catch(e){
    setInfo('не удалось сохранить: ' + e.message);
    if(!silent) say('не удалось сохранить: ' + e.message);
    return false;
  }
}

function load(){
  var raw;
  try{ raw = localStorage.getItem(KEY); }catch(e){ return null; }
  if(!raw) return null;

  var data;
  try{ data = JSON.parse(raw); }catch(e){ return null; }

  var res = apply(data);
  return res.ok ? data : null;
}

/* ---------------- TXT: выгрузка ---------------- */
function toText(){
  var s = st();
  if(!s) return '';

  var lines = [];
  lines.push('# Б3-34 v2 — программа');
  lines.push('# формат: decimal');
  lines.push('# инструкций: ' + s.prog.length);

  for(var i = 0; i < 14; i++){
    if(s.m.R[i]) lines.push('# R' + i + ': ' + s.m.R[i]);
  }

  var built = Core.compile(s.prog);
  lines.push('# ячеек: ' + built.length);
  if(built.errors && built.errors.length){
    lines.push('# внимание: ' + built.errors.join('; '));
  }
  lines.push('');

  Core.listing(built.cells, built.length).forEach(function(r){
    lines.push(pad2(r.addr) + ': ' + String(r.dec) + '   ' + r.name);
  });

  return lines.join('\n') + '\n';
}

/* ---------------- TXT: разбор ---------------- */
function fromText(text){
  var s = st();
  if(!s) return { ok:false, error:'калькулятор ещё не готов' };

  var lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  var hexMode = null;
  var rows = [];
  var regs = {};

  lines.forEach(function(raw){
    var t = raw.trim();
    if(!t) return;

    if(t.charAt(0) === '#'){
      var mf = /формат\s*:\s*([A-Za-zА-Яа-я]+)/.exec(t);
      if(mf){
        var w = mf[1].toLowerCase();
        if(w.indexOf('hex') === 0 || w.indexOf('16') === 0) hexMode = true;
        else if(w.indexOf('dec') === 0 || w.indexOf('дес') === 0) hexMode = false;
      }
      var mr = /^#\s*R(\d{1,2})\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i.exec(t);
      if(mr) regs[Number(mr[1])] = Number(mr[2].replace(',', '.'));
      return;
    }

    var mr2 = /^R(\d{1,2})\s*[:=]\s*(-?\d+(?:[.,]\d+)?)$/i.exec(t);
    if(mr2){
      regs[Number(mr2[1])] = Number(mr2[2].replace(',', '.'));
      return;
    }

    var m = /^(\d{1,2})\s*[:.)]\s*([0-9A-Fa-f]{1,3})(?=\s|$)/.exec(t);
    if(m) rows.push({ addr: Number(m[1]), token: m[2] });
  });

  if(!rows.length) return { ok:false, error:'в файле не нашлось строк вида «00: 96»' };

  if(hexMode === null){
    hexMode = rows.some(function(r){ return /[A-Fa-f]/.test(r.token); });
  }

  rows.sort(function(a, b){ return a.addr - b.addr; });

  var cells = rows.map(function(r){
    var v = hexMode ? parseInt(r.token, 16) : parseInt(r.token, 10);
    return isFinite(v) ? (v & 0xFF) : 0;
  });

  var parsed = cellsToProgram(cells);

  s.prog = parsed.program;
  for(var i = 0; i < 14; i++){
    if(regs[i] != null) s.m.R[i] = norm(regs[i]);
  }
  s.m.err = false;
  s.m.typing = false;
  s.m.input = '';
  s.buf = '';
  s.addr = '';
  s.waitAddr = 0;
  s.regAct = null;
  s.regProg = null;

  if(ui() && ui().render) ui().render();

  var out = { ok:true, count: parsed.program.length, warnings: parsed.warnings, hex: !!hexMode };
  var built = Core.compile(s.prog);
  if(built.errors && built.errors.length) out.warnings = out.warnings.concat(built.errors);
  return out;
}

/* ---------------- JSON ---------------- */
function toJSON(){
  var data = snapshot();
  return data ? JSON.stringify(data, null, 2) + '\n' : '';
}

function fromJSON(text){
  var data;
  try{ data = JSON.parse(text); }
  catch(e){ return { ok:false, error:'это не JSON' }; }
  return apply(data);
}

/* ---------------- скачивание ---------------- */
function download(name, text, mime){
  try{
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      try{ URL.revokeObjectURL(url); }catch(e){}
      if(a.parentNode) a.parentNode.removeChild(a);
    }, 1500);
    return true;
  }catch(e){
    return false;
  }
}

/* ---------------- панель файлов ---------------- */
function setInfo(text){
  var el = document.getElementById('stInfo');
  if(el) el.textContent = text || '';
}

function buildPanel(){
  var host = document.getElementById('tab-calc');
  if(!host || document.getElementById('stBox')) return;

  var style = document.createElement('style');
  style.textContent =
    '.fbox{background:#fff;border:1px solid #d5dce3;border-radius:10px;padding:12px;margin-top:16px}' +
    '.fbox .ftitle{font-size:12px;font-weight:700;color:#5f6b78;margin:0 0 8px;' +
      'text-transform:uppercase;letter-spacing:.4px}' +
    '.frow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}' +
    '.frow button{font:inherit;font-size:12px;font-weight:600;padding:11px 2px;' +
      'border:1px solid #d5dce3;border-radius:9px;background:#f4f7fa;color:#14181d}' +
    '.frow button:active{transform:scale(.97)}' +
    '.finfo{font-size:12px;color:#5f6b78;margin-top:9px;min-height:15px;line-height:1.45}';
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.id = 'stBox';
  box.className = 'fbox';

  var title = document.createElement('div');
  title.className = 'ftitle';
  title.textContent = 'Сохранение и файлы';
  box.appendChild(title);

  var row = document.createElement('div');
  row.className = 'frow';

  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.json,text/plain,application/json';
  fileInput.style.display = 'none';
  box.appendChild(fileInput);

  function mkButton(text, handler){
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', handler);
    row.appendChild(b);
    return b;
  }

  mkButton('💾 Сохранить', function(){ save(false); });

  mkButton('⬇ TXT', function(){
    var text = toText();
    if(!text){ say('нечего выгружать'); return; }
    var ok = download('b334-' + stamp() + '.txt', text, 'text/plain;charset=utf-8');
    say(ok ? 'файл TXT готов — в загрузках телефона' : 'браузер не дал скачать файл');
  });

  mkButton('⬇ JSON', function(){
    var text = toJSON();
    if(!text){ say('нечего выгружать'); return; }
    var ok = download('b334-' + stamp() + '.json', text, 'application/json;charset=utf-8');
    say(ok ? 'файл JSON готов — в загрузках телефона' : 'браузер не дал скачать файл');
  });

  mkButton('⬆ Импорт', function(){ fileInput.click(); });

  box.appendChild(row);

  var info = document.createElement('div');
  info.id = 'stInfo';
  info.className = 'finfo';
  box.appendChild(info);

  host.appendChild(box);

  fileInput.addEventListener('change', function(){
    var f = fileInput.files && fileInput.files[0];
    if(!f) return;
    var reader = new FileReader();

    reader.onload = function(){
      var text = String(reader.result || '');
      var name = String(f.name || '').toLowerCase();
      var res;
      if(name.slice(-5) === '.json' || text.trim().charAt(0) === '{'){
        res = fromJSON(text);
      }else{
        res = fromText(text);
      }
      report(res);
      fileInput.value = '';
    };

    reader.onerror = function(){
      say('не удалось прочитать файл');
      fileInput.value = '';
    };

    reader.readAsText(f);
  });
}

function report(res){
  if(!res || !res.ok){
    var why = (res && res.error) ? res.error : 'неизвестная причина';
    setInfo('импорт не удался: ' + why);
    say('импорт не удался: ' + why);
    return;
  }

  var s = st();
  var built = Core.compile(s.prog);
  var warn = (res.warnings && res.warnings.length) ? ' · ' + res.warnings.join('; ') : '';
  var kind = res.hex ? ' (hex)' : '';

  setInfo('импортировано' + kind + ': ' + res.count + ' инструкций, ' + built.length + ' ячеек' + warn);
  say('импортировано' + kind + ': ' + res.count + ' инструкций, ' + built.length + ' ячеек' + warn);
  save(true);
}

/* ---------------- автосохранение ---------------- */
var timer = null;
function scheduleSave(){
  if(timer) clearTimeout(timer);
  timer = setTimeout(function(){ timer = null; save(true); }, 500);
}

function init(){
  buildPanel();

  var data = load();
  if(data){
    var n = (data.program && data.program.length) ? data.program.length : 0;
    setInfo('восстановлено ' + (data.savedAt ? fmtDate(data.savedAt) : '') + ' · ' + n + ' инструкций');
    say('программа восстановлена из памяти браузера');
    startWatch();
    return;
  }

  setInfo('в памяти браузера сохранений пока нет');
  startWatch();
}

function startWatch(){
  document.addEventListener('click', scheduleSave, true);

  window.addEventListener('pagehide', function(){
    if(timer){ clearTimeout(timer); timer = null; }
    save(true);
  });

  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      if(timer){ clearTimeout(timer); timer = null; }
      save(true);
    }
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

global.B3Storage = {
  save: save,
  load: load,
  toText: toText,
  fromText: fromText,
  toJSON: toJSON,
  fromJSON: fromJSON,
  key: KEY,
  version: VERSION
};

})(window);
