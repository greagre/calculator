/* ============================================================
   Б3-34 — надстройка над b3-34.js (версия 3)
   Меняет ТОЛЬКО представление программы в TXT:
     • коды десятичные (96, 65, 91), а не hex;
     • строка «Перед пуском: R0 = 7» — что и куда положить;
     • ожидаемый результат, если программа узнана в справочнике;
     • подписи команд справа.
   База не меняется: состояние читается из localStorage,
   импорт пишет состояние и перезагружает страницу.
   ============================================================ */
(function(){
"use strict";

var LS_STATE = 'b334.state.v3';
var LS_LIB   = 'b334.programs.v2';

var REG = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d'];

var NAMES = {
  0x0A:'·', 0x0B:'/-/', 0x0C:'ВП', 0x0D:'Cx', 0x0E:'В↑', 0x0F:'Вx',
  0x10:'+', 0x11:'−', 0x12:'×', 0x13:'÷', 0x14:'↔',
  0x15:'10^x', 0x16:'e^x', 0x17:'lg', 0x18:'ln',
  0x19:'arcsin', 0x1A:'arccos', 0x1B:'arctg', 0x1C:'sin', 0x1D:'cos', 0x1E:'tg',
  0x20:'π', 0x21:'√', 0x22:'x²', 0x23:'1/x', 0x24:'x^y', 0x25:'F◯',
  0x50:'С/П', 0x51:'БП', 0x52:'В/О', 0x53:'ПП', 0x54:'К НОП',
  0x57:'F x≠0', 0x58:'F L2', 0x59:'F x≥0', 0x5A:'F L3',
  0x5B:'F L1', 0x5C:'F x<0', 0x5D:'F L0', 0x5E:'F x=0'
};

function nameOf(c){
  if(c >= 0 && c <= 9) return String(c);
  if(NAMES[c]) return NAMES[c];
  if(c >= 0x40 && c <= 0x4D) return 'X→П ' + REG[c & 15];
  if(c >= 0x60 && c <= 0x6D) return 'П→X ' + REG[c & 15];
  if(c >= 0x70 && c <= 0x7D) return 'К x≠0 ' + REG[c & 15];
  if(c >= 0x80 && c <= 0x8D) return 'К БП ' + REG[c & 15];
  if(c >= 0x90 && c <= 0x9D) return 'К x≥0 ' + REG[c & 15];
  if(c >= 0xA0 && c <= 0xAD) return 'К ПП ' + REG[c & 15];
  if(c >= 0xC0 && c <= 0xCD) return 'К x<0 ' + REG[c & 15];
  if(c >= 0xE0 && c <= 0xED) return 'К x=0 ' + REG[c & 15];
  return '?';
}

function isJump(c){
  return c === 0x51 || c === 0x53 || c === 0x57 || c === 0x59 ||
         c === 0x5C || c === 0x5E || c === 0x5D || c === 0x5B ||
         c === 0x58 || c === 0x5A;
}

function p2(n){ return (n < 10 ? '0' : '') + n; }

function dcode(c){
  var s = String(Math.max(0, Math.min(255, c | 0)));
  return s.length < 2 ? '0' + s : s;
}

function numText(v){
  if(typeof v !== 'number' || !isFinite(v)) return '0';
  if(Math.abs(v) >= 1e8 || (Math.abs(v) < 1e-2 && v !== 0)){
    var e = Math.floor(Math.log10(Math.abs(v)));
    var m = v / Math.pow(10, e);
    return String(Number(m.toPrecision(8))) + 'e' + (e < 0 ? '-' : '+') + Math.abs(e);
  }
  return String(Number(v.toPrecision(8)));
}

/* ---------- чтение и запись состояния ---------- */
function getState(){
  try{
    var raw = localStorage.getItem(LS_STATE);
    var o = raw ? JSON.parse(raw) : null;
    return (o && typeof o === 'object') ? o : null;
  }catch(e){ return null; }
}

function getLib(){
  try{
    var raw = localStorage.getItem(LS_LIB);
    var a = raw ? JSON.parse(raw) : [];
    return Array.isArray(a) ? a : [];
  }catch(e){ return []; }
}

function saveLib(a){ try{ localStorage.setItem(LS_LIB, JSON.stringify(a)); return true; }catch(e){ return false; } }
function saveState(o){ try{ localStorage.setItem(LS_STATE, JSON.stringify(o)); return true; }catch(e){ return false; } }

function normProg(a){
  var p = new Array(98).fill(0x54);
  if(Array.isArray(a)){
    for(var i = 0; i < 98; i++){
      if(typeof a[i] === 'number' && isFinite(a[i])){
        p[i] = Math.max(0, Math.min(255, Math.round(a[i])));
      }
    }
  }
  return p;
}

function normRegs(a){
  var r = new Array(14).fill(0);
  if(Array.isArray(a)){
    for(var i = 0; i < 14; i++){
      if(typeof a[i] === 'number' && isFinite(a[i])) r[i] = a[i];
    }
  }
  return r;
}

function lastStep(prog){
  var last = -1;
  for(var i = 0; i < 98; i++){ if(prog[i] !== 0x54) last = i; }
  return last;
}

/* какие регистры программа читает — это и есть исходные данные */
function regsRead(prog){
  var last = lastStep(prog), skip = -1, seen = {}, order = [];
  function add(r){
    if(r >= 0 && r < 14 && !seen[r]){ seen[r] = 1; order.push(r); }
  }
  for(var i = 0; i <= last; i++){
    if(i <= skip) continue;
    var c = prog[i];
    if(isJump(c)) skip = i + 2;
    if(c >= 0x60 && c <= 0x6D) add(c & 15);                    /* П→X r */
    else if(c >= 0x70 && c <= 0x7D) add(c & 15);               /* К x≠0 r */
    else if(c >= 0x80 && c <= 0x8D) add(c & 15);               /* К БП r */
    else if(c >= 0x90 && c <= 0x9D) add(c & 15);               /* К x≥0 r */
    else if(c >= 0xA0 && c <= 0xAD) add(c & 15);               /* К ПП r */
    else if(c >= 0xC0 && c <= 0xCD) add(c & 15);               /* К x<0 r */
    else if(c >= 0xE0 && c <= 0xED) add(c & 15);               /* К x=0 r */
  }
  return order;
}

/* ожидаемый результат — если такая же программа есть в справочнике */
function expected(prog){
  var cat = window.B334Cat;
  if(!cat || !Array.isArray(cat.progs)) return '';
  var last = lastStep(prog);
  if(last < 0) return '';
  for(var k = 0; k < cat.progs.length; k++){
    var p = cat.progs[k];
    if(!p || !Array.isArray(p.codes)) continue;
    if(p.codes.length !== last + 1) continue;
    var same = true;
    for(var j = 0; j <= last; j++){
      if((p.codes[j] & 255) !== (prog[j] & 255)){ same = false; break; }
    }
    if(same) return p.check || '';
  }
  return '';
}

/* ---------- листинг одной программы ---------- */
function listProgram(name, prog, regs){
  var out = ['=== ' + name + ' ==='];
  var last = lastStep(prog);

  if(last < 0){
    out.push('(программа пуста)');
    out.push('');
    return out;
  }

  var rd = regsRead(prog);
  if(rd.length){
    var parts = [];
    for(var q = 0; q < rd.length; q++){
      var r = rd[q];
      parts.push('R' + REG[r] + ' = ' + numText(regs ? regs[r] : 0));
    }
    out.push('Перед пуском: ' + parts.join(', '));
  }else{
    out.push('Перед пуском: регистры не нужны');
  }

  var exp = expected(prog);
  if(exp) out.push('Ожидаемый результат: ' + exp);

  out.push('');

  /* какие ячейки — цифры адреса перехода */
  var addrOf = {};
  for(var k2 = 0; k2 <= last; k2++){
    if(isJump(prog[k2])){
      addrOf[k2 + 1] = k2;
      addrOf[k2 + 2] = k2;
    }
  }

  for(var i = 0; i <= last; i++){
    if(addrOf[i] !== undefined){
      var base = addrOf[i];
      var d1 = prog[base + 1], d2 = prog[base + 2];
      var full = (d1 >= 0 && d1 <= 9 && d2 >= 0 && d2 <= 9) ? (d1 * 10 + d2) : null;
      var note = 'адрес ' + (full !== null ? p2(full) : '??');
      note += (i === base + 1) ? ' · десятки' : ' · единицы';
      out.push(p2(i) + '  ' + dcode(prog[i]) + '  ' + note);
    }else{
      out.push(p2(i) + '  ' + dcode(prog[i]) + '  ' + nameOf(prog[i]));
    }
  }

  out.push('');
  return out;
}

/* ---------- имя файла ---------- */
function stamp(){
  var d = new Date();
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
         '_' + p2(d.getHours()) + p2(d.getMinutes());
}

function download(name, text){
  try{
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      if(a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
    return true;
  }catch(e){
    var h = document.getElementById('hint');
    if(h) h.textContent = 'Браузер не дал сохранить файл: ' + (e.message || 'ошибка');
    return false;
  }
}

/* ---------- экспорт TXT ---------- */
function exportTxt(){
  /* дать базе дописать автосохранение (у неё задержка 250 мс) */
  setTimeout(function(){
    var st = getState() || {};
    var regs = normRegs(st.R);
    var prog = normProg(st.prog);

    var parts = [];
    parts.push('ЭЛЕКТРОНИКА Б3-34 — листинг программ');
    parts.push('формат: АДРЕС  КОД  КОМАНДА   (коды десятичные)');
    parts.push('переход занимает 3 шага: команда, десятки адреса, единицы адреса');
    parts.push('сохранено: ' + new Date().toLocaleString('ru-RU'));
    parts.push('');

    parts.push(listProgram('Текущая программа', prog, regs).join('\n'));

    var lib = getLib();
    for(var i = 0; i < lib.length; i++){
      parts.push(listProgram(lib[i].name, normProg(lib[i].prog), regs).join('\n'));
    }

    if(download('b3-34_' + stamp() + '.txt', parts.join('\n'))){
      var h = document.getElementById('hint');
      if(h) h.textContent = 'Файл TXT сохранён в «Загрузки»: десятичные коды, блок «Перед пуском», подписи команд';
    }
  }, 350);
}

/* ---------- импорт ---------- */
function parseRegs(line, regs){
  var m = line.match(/^\s*Перед пуском:\s*(.+)$/i);
  if(!m) return;
  var pieces = m[1].split(',');
  for(var i = 0; i < pieces.length; i++){
    var mm = pieces[i].match(/R([0-9a-d])\s*=\s*(-?[\d.,eE+\-]+)/);
    if(!mm) continue;
    var r = REG.indexOf(mm[1].toLowerCase());
    var v = parseFloat(mm[2].replace(',', '.'));
    if(r >= 0 && isFinite(v)) regs[r] = v;
  }
}

function parseTxt(text, baseRegs){
  var isDec = /коды десятичные/i.test(text);
  var lines = text.split(/\r?\n/);
  var secs = [];
  var cur = { name: 'Импорт', prog: new Array(98).fill(0x54), regs: baseRegs.slice(0) };

  for(var i = 0; i < lines.length; i++){
    var line = lines[i];

    var head = line.match(/^\s*===\s*(.+?)\s*===\s*$/);
    if(head){
      secs.push(cur);
      cur = { name: String(head[1]).slice(0, 40), prog: new Array(98).fill(0x54), regs: baseRegs.slice(0) };
      continue;
    }

    if(/^\s*Перед пуском/i.test(line)){ parseRegs(line, cur.regs); continue; }

    var idx = -1, code = -1;

    /* новый десятичный вид: «00  96  П→X 0» */
    var mNew = line.match(/^\s*(\d{1,2})\s{2,}(\d{1,2})(?:\s{2,}|$)/);
    if(mNew && isDec){
      idx = parseInt(mNew[1], 10);
      code = parseInt(mNew[2], 10);
    }

    /* старый вид: «00: 60   X→П 0» — коды в hex */
    if(code < 0){
      var mOld = line.match(/^\s*(\d{1,2})\s*[:.\-]\s*([0-9A-Fa-f]{2})\b/);
      if(mOld){
        idx = parseInt(mOld[1], 10);
        code = isDec ? parseInt(mOld[2], 10) : parseInt(mOld[2], 16);
      }
    }

    /* одиночная цифра адреса: «09: 0   (цифра адреса)» */
    if(code < 0){
      var mOne = line.match(/^\s*(\d{1,2})\s*[:.\-]\s*(\d)\b/);
      if(mOne){
        idx = parseInt(mOne[1], 10);
        code = parseInt(mOne[2], 10);
      }
    }

    if(code >= 0 && idx >= 0 && idx < 98){
      cur.prog[idx] = code & 255;
    }
  }
  secs.push(cur);

  var useful = [];
  for(var s = 0; s < secs.length; s++){
    if(lastStep(secs[s].prog) >= 0) useful.push(secs[s]);
  }
  return useful;
}

function applyImport(secs){
  if(!secs.length){
    var h0 = document.getElementById('hint');
    if(h0) h0.textContent = 'В файле не нашлось кодов программы';
    return;
  }

  var st = getState() || {};
  var lib = getLib();
  var cur = null, added = 0;

  for(var i = 0; i < secs.length; i++){
    var s = secs[i];
    if(cur === null && /текущая/i.test(s.name)){
      cur = s;
      continue;
    }
    var found = -1;
    for(var k = 0; k < lib.length; k++){ if(lib[k].name === s.name){ found = k; break; } }
    var item = { name: s.name, prog: s.prog.slice(0), updated: new Date().toISOString() };
    if(found >= 0) lib[found] = item; else lib.unshift(item);
    added++;
  }

  if(cur === null){
    if(secs.length === 1 || added === 0){ cur = secs[0]; }
    else { cur = secs[0]; added = Math.max(0, added - 1); }
  }

  saveLib(lib);

  var next = {
    prog: cur.prog.slice(0),
    R: (cur.regs && cur.regs.length) ? cur.regs.slice(0, 14) : normRegs(st.R),
    sound: typeof st.sound === 'boolean' ? st.sound : true,
    voice: typeof st.voice === 'boolean' ? st.voice : true,
    fast: typeof st.fast === 'boolean' ? st.fast : false
  };

  if(saveState(next)){
    location.reload();
  }else{
    var h = document.getElementById('hint');
    if(h) h.textContent = 'Не удалось записать программу в память браузера';
  }
}

function importJson(o){
  if(!o || typeof o !== 'object') return false;
  var st = getState() || {};
  var lib = getLib();

  if(Array.isArray(o.programs)){
    for(var i = 0; i < o.programs.length; i++){
      var p = o.programs[i];
      if(!p || !Array.isArray(p.prog)) continue;
      var name = String(p.name || 'Без названия').slice(0, 40);
      var found = -1;
      for(var k = 0; k < lib.length; k++){ if(lib[k].name === name){ found = k; break; } }
      var item = { name: name, prog: normProg(p.prog), updated: p.updated || new Date().toISOString() };
      if(found >= 0) lib[found] = item; else lib.unshift(item);
    }
    saveLib(lib);
  }

  var cur = null;
  if(o.current && Array.isArray(o.current.prog)) cur = o.current.prog;
  else if(Array.isArray(o.prog)) cur = o.prog;

  var next = {
    prog: cur ? normProg(cur) : normProg(st.prog),
    R: Array.isArray(o.registers) ? normRegs(o.registers) : normRegs(st.R),
    sound: (o.settings && typeof o.settings.sound === 'boolean') ? o.settings.sound : (typeof st.sound === 'boolean' ? st.sound : true),
    voice: (o.settings && typeof o.settings.voice === 'boolean') ? o.settings.voice : (typeof st.voice === 'boolean' ? st.voice : true),
    fast: (o.settings && typeof o.settings.fast === 'boolean') ? o.settings.fast : (typeof st.fast === 'boolean' ? st.fast : false)
  };
  if(saveState(next)){ location.reload(); return true; }
  return false;
}

function importFile(file){
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    var text = String(reader.result || '');
    var h = document.getElementById('hint');
    var isJson = /\.json$/i.test(file.name) || /^\s*\{/.test(text);

    if(isJson){
      try{
        if(!importJson(JSON.parse(text)) && h) h.textContent = 'Файл JSON не применён';
      }catch(e){
        if(h) h.textContent = 'Файл JSON не разобран: ' + (e.message || 'ошибка');
      }
      return;
    }

    var st = getState() || {};
    var secs = parseTxt(text, normRegs(st.R));
    applyImport(secs);
  };
  reader.onerror = function(){
    var h = document.getElementById('hint');
    if(h) h.textContent = 'Не удалось прочитать файл';
  };
  reader.readAsText(file, 'utf-8');
}

/* ---------- подмена кнопок базы ---------- */
function swapButton(id, fn){
  var old = document.getElementById(id);
  if(!old || !old.parentNode) return false;
  var neu = old.cloneNode(true);
  old.parentNode.replaceChild(neu, old);
  neu.addEventListener('click', function(e){
    e.preventDefault();
    fn();
  });
  return true;
}

function swapFileInput(){
  var old = document.getElementById('fileInput');
  if(!old || !old.parentNode) return false;
  var neu = old.cloneNode(false);
  neu.value = '';
  old.parentNode.replaceChild(neu, old);
  neu.addEventListener('change', function(){
    var f = this.files && this.files[0];
    if(f) importFile(f);
    this.value = '';
  });
  return true;
}

function init(){
  swapButton('btnExportTxt', exportTxt);
  swapFileInput();

  var note = document.querySelector('.memnote');
  if(note && note.textContent.indexOf('десятичными') < 0){
    note.textContent = 'Список хранится в памяти браузера на этом телефоне. ' +
      'Файл TXT — десятичными кодами, с блоком «Перед пуском» (что положить в регистры) и подписями команд. ' +
      'Файл JSON — всё состояние сразу. Загрузка принимает оба формата.';
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

})();
