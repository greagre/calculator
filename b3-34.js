(function(){
"use strict";

/* ============================================================
   Электроника Б3-34 — логика
   v6: условные переходы приведены к руководству Б3-34:
       условие ИСТИННО  -> следующая команда,
       условие ЛОЖНО    -> переход по адресу.
       То же правило применено к косвенным 7r / 9r / Cr / Er.
       Косвенный 9r подписан «К x≥0» (в v5 было ошибочно «К x≤0»).
       Демо «НОД» переписано: F x≠0 / F x≥0 вместо F x=0 / F x<0.
   v5: подписи косвенных пересылок К X→П r и К П→X r.
   v4: переходы занимают ТРИ ячейки — команда + две цифры адреса
       (десятки, единицы), как у настоящего Б3-34.
       Темп ~5 шагов/с, 8 значащих цифр + ЕГГОГ, панель регистров.
   ============================================================ */

var MAXDIG = 8;        /* значащих цифр мантиссы, как у оригинала */
var MAXEXP = 99;       /* порядок: от -99 до +99 */
var RUN_DELAY = 200;   /* мс на шаг -> ~5 операций в секунду */

var ST = {
  X:0, Y:0, Z:0, T:0, X1:0,
  R: new Array(14).fill(0),
  prog: new Array(98).fill(0x54),
  ip: 0,
  mode: 'AUT',
  run: false,
  sub: [],
  layer: 'main',
  await: null,
  kind: null,
  addrBuf: '',
  input: '',
  typing: false,
  exp: false,
  err: false,
  fast: false,
  soundOn: true,
  voiceOn: true,
  steps: 0
};

var lcd = document.getElementById('lcd');
var lMode = document.getElementById('lMode');
var lAddr = document.getElementById('lAddr');
var lPref = document.getElementById('lPref');
var stackEl = document.getElementById('stack');
var padEl = document.getElementById('pad');
var panelEl = document.getElementById('panel');
var hintEl = document.getElementById('hint');
var regsEl = document.getElementById('regs');

/* ---------- звук ---------- */
var ac = null;
function beep(freq, dur, type, vol){
  if(!ST.soundOn) return;
  try{
    if(!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if(ac.state === 'suspended') ac.resume();
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.value = freq || 880;
    g.gain.value = vol || 0.06;
    o.connect(g); g.connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.05));
    o.stop(ac.currentTime + (dur || 0.05));
  }catch(e){}
}
function clickKey(){ beep(1200, 0.03, 'square', 0.05); }
function clickOp(){ beep(700, 0.05, 'square', 0.06); }
function clickOk(){ beep(1000, 0.06, 'sine', 0.07); setTimeout(function(){ beep(1400, 0.07, 'sine', 0.06); }, 70); }
function clickErr(){ beep(220, 0.18, 'sawtooth', 0.08); }
function tickStep(){ beep(1900, 0.012, 'square', 0.016); }

/* ---------- голос ---------- */
function say(text){
  if(!ST.voiceOn || !window.speechSynthesis) return;
  try{
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ru-RU';
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- арифметика в духе Б3-34 ---------- */
function norm(x){
  if(typeof x !== 'number' || isNaN(x) || !isFinite(x)) return NaN;
  if(x === 0) return 0;
  var a = Math.abs(x);
  if(a >= 1e100) return NaN;      /* переполнение порядка */
  if(a < 1e-99) return NaN;       /* потеря порядка */
  var y = Number(x.toPrecision(MAXDIG));
  if(!isFinite(y) || Math.abs(y) >= 1e100) return NaN;
  return y;
}

function fmtNum(x){
  if(typeof x !== 'number' || isNaN(x) || !isFinite(x)) return 'ЕГГОГ';
  if(x === 0) return '0';
  var a = Math.abs(x), s;
  if(a >= 1e8 || a < 1e-2){
    var e = Math.floor(Math.log10(a));
    var m = x / Math.pow(10, e);
    var ms = m.toFixed(7).replace(/0+$/,'').replace(/\.$/,'');
    s = ms + ' ' + (e < 0 ? '-' : ' ') + String(Math.abs(e)).padStart(2,'0');
  }else{
    s = Number(x.toPrecision(MAXDIG)).toString();
  }
  return s;
}
function shortNum(x){
  var s = fmtNum(x);
  return s.length > 9 ? s.slice(0, 9) + '…' : s;
}
function speechNum(x){
  if(typeof x !== 'number' || !isFinite(x)) return 'ошибка';
  return String(Math.round(x * 100000) / 100000).replace('.', ' запятая ');
}
function codeStr(c){
  var hex = '0123456789-LCГE ';
  return hex[(c >> 4) & 15] + hex[c & 15];
}
function hex2(c){
  var s = (c & 255).toString(16).toUpperCase();
  return s.length < 2 ? '0' + s : s;
}
function p2(n){
  return (n < 10 ? '0' : '') + n;
}

var REG_NAMES = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d'];

var CMD_NAMES = {
  0x0A:'·', 0x0B:'/-/', 0x0C:'ВП', 0x0D:'Cx', 0x0E:'В↑', 0x0F:'Вx',
  0x10:'+', 0x11:'−', 0x12:'×', 0x13:'÷', 0x14:'↔',
  0x15:'10^x', 0x16:'e^x', 0x17:'lg', 0x18:'ln',
  0x19:'arcsin', 0x1A:'arccos', 0x1B:'arctg', 0x1C:'sin', 0x1D:'cos', 0x1E:'tg',
  0x20:'π', 0x21:'√', 0x22:'x²', 0x23:'1/x', 0x24:'x^y', 0x25:'F◯',
  0x50:'С/П', 0x51:'БП', 0x52:'В/О', 0x53:'ПП', 0x54:'К НОП',
  0x57:'F x≠0', 0x58:'F L2', 0x59:'F x≥0', 0x5A:'F L3', 0x5B:'F L1', 0x5C:'F x<0', 0x5D:'F L0', 0x5E:'F x=0'
};
function cmdName(c){
  if(c >= 0 && c <= 9) return String(c);
  if(CMD_NAMES[c]) return CMD_NAMES[c];
  if(c >= 0x40 && c <= 0x4D) return 'X→П ' + REG_NAMES[c & 15];
  if(c >= 0x60 && c <= 0x6D) return 'П→X ' + REG_NAMES[c & 15];
  if(c >= 0x70 && c <= 0x7D) return 'К x≠0 ' + REG_NAMES[c & 15];
  if(c >= 0x80 && c <= 0x8D) return 'К БП ' + REG_NAMES[c & 15];
  if(c >= 0x90 && c <= 0x9D) return 'К x≥0 ' + REG_NAMES[c & 15];
  if(c >= 0xA0 && c <= 0xAD) return 'К ПП ' + REG_NAMES[c & 15];
  if(c >= 0xB0 && c <= 0xBD) return 'К X→П ' + REG_NAMES[c & 15];
  if(c >= 0xC0 && c <= 0xCD) return 'К x<0 ' + REG_NAMES[c & 15];
  if(c >= 0xD0 && c <= 0xDD) return 'К П→X ' + REG_NAMES[c & 15];
  if(c >= 0xE0 && c <= 0xED) return 'К x=0 ' + REG_NAMES[c & 15];
  return '?';
}

/* Команды, после которых в программе идут ДВЕ ячейки с цифрами адреса.
   У настоящего Б3-34 такой переход занимает три шага:
   сама команда, десятки адреса, единицы адреса. */
function isJumpCmd(c){
  return c === 0x51 || c === 0x53 ||
         c === 0x57 || c === 0x59 || c === 0x5C || c === 0x5E ||
         c === 0x5D || c === 0x5B || c === 0x58 || c === 0x5A;
}

/* Прочитать адрес перехода, записанный двумя ячейками после команды.
   Возвращает -1, если в ячейках не цифры или адрес вне 0..97. */
function jumpAddr(ip){
  var a = ST.prog[(ip + 1) % 98];
  var b = ST.prog[(ip + 2) % 98];
  if(a > 9 || b > 9) return -1;
  var v = a * 10 + b;
  if(v < 0 || v > 97) return -1;
  return v;
}

/* ---------- стек ---------- */
function shiftUp(){
  ST.T = ST.Z; ST.Z = ST.Y; ST.Y = ST.X;
}
function pushValue(v){
  var n = norm(v);
  shiftUp();
  ST.X = isNaN(n) ? NaN : n;
  ST.typing = false;
  ST.input = '';
  ST.exp = false;
}

/* ---------- индикатор ---------- */
function render(){
  if(ST.mode === 'PRG'){
    var a = ST.ip;
    var c1 = codeStr(ST.prog[(a - 3 + 98) % 98]);
    var c2 = codeStr(ST.prog[(a - 2 + 98) % 98]);
    var c3 = codeStr(ST.prog[(a - 1 + 98) % 98]);
    lcd.className = 'lcd small' + (ST.err ? ' err' : '');
    lcd.textContent = c1 + ' ' + c2 + ' ' + c3 + ' ' + String(a).padStart(2, '0');
    lAddr.textContent = 'программа ' + String(a).padStart(2,'0') + '/97';
  }else if(ST.run){
    lcd.className = 'lcd' + (ST.err ? ' err' : '');
    lcd.textContent = ST.err ? 'ЕГГОГ' : fmtNum(ST.X);
    lAddr.textContent = '▶ ' + p2(ST.ip) + ' ' + codeStr(ST.prog[ST.ip]) + ' ' + cmdName(ST.prog[ST.ip]);
  }else{
    lcd.className = 'lcd' + (ST.err ? ' err' : '');
    lcd.textContent = ST.err ? 'ЕГГОГ' : (ST.typing ? (ST.input || '0') : fmtNum(ST.X));
    lAddr.textContent = ST.typing ? 'ввод' : '';
  }
  lMode.textContent = ST.mode === 'PRG' ? 'ПРГ' : 'АВТ';
  lPref.textContent = ST.layer === 'f' ? 'F' : (ST.layer === 'k' ? 'K' : '');
  stackEl.innerHTML =
    '<div><b>X</b> ' + fmtNum(ST.X) + '</div>' +
    '<div><b>Y</b> ' + fmtNum(ST.Y) + '</div>' +
    '<div><b>Z</b> ' + fmtNum(ST.Z) + '</div>' +
    '<div><b>T</b> ' + fmtNum(ST.T) + '</div>' +
    '<div><b>X1</b> ' + fmtNum(ST.X1) + '</div>';
  renderRegs();
  scheduleSave();
}

/* ---------- панель 14 регистров ---------- */
var regButtons = [];

function initRegs(){
  if(!regsEl) return;
  regsEl.innerHTML = '';
  regButtons = [];
  REG_NAMES.forEach(function(n, i){
    var b = document.createElement('button');
    b.innerHTML = '<b>R' + n + '</b><span class="v">0</span>';
    attachRegTouch(b, i);
    regsEl.appendChild(b);
    regButtons.push(b);
  });
}

function renderRegs(){
  for(var i = 0; i < regButtons.length; i++){
    var v = regButtons[i].querySelector('.v');
    if(v) v.textContent = shortNum(ST.R[i]);
  }
}

function flashReg(el){
  el.classList.add('flash');
  setTimeout(function(){ el.classList.remove('flash'); }, 220);
}

function readReg(i){
  pushValue(ST.R[i]);
  clickKey();
  hint('R' + REG_NAMES[i] + ' → X = ' + fmtNum(ST.R[i]) + ' (долгое нажатие — запись X в регистр)');
  render();
}

function writeReg(i, el){
  ST.R[i] = norm(ST.X);
  if(el) flashReg(el);
  clickOk();
  hint('X → R' + REG_NAMES[i] + ' = ' + fmtNum(ST.X));
  render();
}

function attachRegTouch(el, i){
  var timer = null, long = false;
  el.addEventListener('pointerdown', function(e){
    e.preventDefault();
    long = false;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){
      timer = null;
      long = true;
      writeReg(i, el);
    }, 550);
  });
  el.addEventListener('pointerup', function(e){
    e.preventDefault();
    if(timer){ clearTimeout(timer); timer = null; }
    if(!long) readReg(i);
  });
  el.addEventListener('pointercancel', function(){
    if(timer){ clearTimeout(timer); timer = null; }
  });
  el.addEventListener('pointerleave', function(){
    if(timer){ clearTimeout(timer); timer = null; }
  });
}

/* ---------- клавиатура ---------- */
var MAIN = [
  {t:'f', a:'pref-f', cls:'pref'},
  {t:'k', a:'pref-k', cls:'pref'},
  {t:'x→П', a:'stox'},
  {t:'П→X', a:'loadx'},
  {t:'↔', a:'code', c:0x14, cls:'dark'},
  {t:'В↑', a:'code', c:0x0E, cls:'dark'},

  {t:'С/П', a:'sp', cls:'red'},
  {t:'ПП', a:'pp', cls:'dark'},
  {t:'БП', a:'bp', cls:'dark'},
  {t:'В/О', a:'vo', cls:'dark'},
  {t:'Cx', a:'code', c:0x0D, cls:'red'},
  {t:'/-/', a:'code', c:0x0B, cls:'dark'},

  {t:'7', a:'digit', d:7, cls:'dark'},
  {t:'8', a:'digit', d:8, cls:'dark'},
  {t:'9', a:'digit', d:9, cls:'dark'},
  {t:'÷', a:'code', c:0x13, cls:'blue'},
  {t:'ВП', a:'code', c:0x0C},
  {t:'F◯', a:'code', c:0x25},

  {t:'4', a:'digit', d:4, cls:'dark'},
  {t:'5', a:'digit', d:5, cls:'dark'},
  {t:'6', a:'digit', d:6, cls:'dark'},
  {t:'×', a:'code', c:0x12, cls:'blue'},
  {t:'π', a:'code', c:0x20},
  {t:'√', a:'code', c:0x21},

  {t:'1', a:'digit', d:1, cls:'dark'},
  {t:'2', a:'digit', d:2, cls:'dark'},
  {t:'3', a:'digit', d:3, cls:'dark'},
  {t:'−', a:'code', c:0x11, cls:'blue'},
  {t:'x²', a:'code', c:0x22},
  {t:'1/x', a:'code', c:0x23},

  {t:'0', a:'digit', d:0, cls:'dark'},
  {t:'•', a:'dot', cls:'dark'},
  {t:'+', a:'code', c:0x10, cls:'blue'},
  {t:'x^y', a:'code', c:0x24},
  {t:'e^x', a:'code', c:0x16},
  {t:'ln', a:'code', c:0x18}
];

var FS = [
  {t:'sin', c:0x1C, cls:'dark'},
  {t:'cos', c:0x1D, cls:'dark'},
  {t:'tg', c:0x1E, cls:'dark'},
  {t:'arcsin', c:0x19, cls:'dark'},
  {t:'arccos', c:0x1A, cls:'dark'},
  {t:'arctg', c:0x1B, cls:'dark'},

  {t:'lg', c:0x17, cls:'dark'},
  {t:'10^x', c:0x15, cls:'dark'},
  {t:'e^x', c:0x16, cls:'dark'},
  {t:'x^y', c:0x24, cls:'dark'},
  {t:'π', c:0x20, cls:'dark'},
  {t:'√', c:0x21, cls:'dark'},

  {t:'x²', c:0x22, cls:'dark'},
  {t:'1/x', c:0x23, cls:'dark'},
  {t:'F◯', c:0x25, cls:'dark'},
  {t:'F Вx', c:0x0F, cls:'dark'},
  {t:'Cx', c:0x0D, cls:'dark'},
  {t:'CF', a:'cf', cls:'dark'},

  {t:'ПРГ', a:'prg', cls:'blue'},
  {t:'АВТ', a:'aut', cls:'blue'},
  {t:'x<0', c:0x5C, jump:1, cls:'dark'},
  {t:'x=0', c:0x5E, jump:1, cls:'dark'},
  {t:'x≥0', c:0x59, jump:1, cls:'dark'},
  {t:'x≠0', c:0x57, jump:1, cls:'dark'},

  {t:'L0', c:0x5D, jump:1, cls:'dark'},
  {t:'L1', c:0x5B, jump:1, cls:'dark'},
  {t:'L2', c:0x58, jump:1, cls:'dark'},
  {t:'L3', c:0x5A, jump:1, cls:'dark'},
  {t:'В↑', c:0x0E, cls:'dark'},
  {t:'↔', c:0x14, cls:'dark'}
];

var KS = [
  {t:'НОП', c:0x54, cls:'dark'},
  {t:'БП R', a:'kcmd', k:0x80, cls:'dark'},
  {t:'ПП R', a:'kcmd', k:0xA0, cls:'dark'},
  {t:'x≠0 R', a:'kcmd', k:0x70, cls:'dark'},
  {t:'x≥0 R', a:'kcmd', k:0x90, cls:'dark'},
  {t:'x<0 R', a:'kcmd', k:0xC0, cls:'dark'},
  {t:'x=0 R', a:'kcmd', k:0xE0, cls:'dark'}
];

function keysForLayer(){
  if(ST.layer === 'f') return FS;
  if(ST.layer === 'k') return KS;
  return MAIN;
}

function drawPad(){
  var list = keysForLayer();
  padEl.innerHTML = '';
  list.forEach(function(k){
    var b = document.createElement('button');
    b.className = 'key ' + (k.cls || '');
    b.textContent = k.t;
    b.addEventListener('click', function(){ onKey(k); });
    padEl.appendChild(b);
  });
}

function drawRegPick(mode){
  panelEl.style.display = 'block';
  panelEl.innerHTML = '<div class="lbl">ВЫБЕРИ РЕГИСТР</div><div class="regpick"></div>';
  var box = panelEl.querySelector('.regpick');
  REG_NAMES.forEach(function(n, i){
    var b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('click', function(){
      clickKey();
      panelEl.style.display = 'none';
      handleReg(mode, i);
    });
    box.appendChild(b);
  });
}

function handleReg(mode, r){
  if(ST.mode === 'PRG'){
    if(mode === 'sto') writeStep(0x40 | r);
    else if(mode === 'ld') writeStep(0x60 | r);
    else writeStep(ST.kind | r);
    ST.await = null; ST.kind = null;
    render();
    return;
  }
  if(mode === 'sto'){ ST.R[r] = norm(ST.X); hint('X → R' + REG_NAMES[r] + ' = ' + fmtNum(ST.X)); }
  else if(mode === 'ld'){ pushValue(ST.R[r]); hint('R' + REG_NAMES[r] + ' → X = ' + fmtNum(ST.R[r])); }
  ST.await = null; ST.kind = null;
  render();
}

/* ---------- ввод чисел ---------- */
function mantissaDigits(s){
  var m = String(s).split('e')[0].replace(/[^0-9]/g, '');
  return m.length;
}

function startTyping(){
  if(!ST.typing){
    shiftUp();
    ST.input = '';
    ST.typing = true;
    ST.exp = false;
  }
  ST.err = false;
}

function typeDigit(d){
  startTyping();
  if(ST.exp){
    var parts = ST.input.split('e');
    if((parts[1] || '').length >= 2){
      hint('Порядок — только 2 цифры, как у оригинала');
      return;
    }
  }else{
    if(mantissaDigits(ST.input) >= MAXDIG){
      hint('Мантисса — 8 цифр, как у оригинала. Дальше вводи порядок через ВП.');
      return;
    }
  }
  ST.input += String(d);
  var v = parseFloat(ST.input);
  ST.X = isNaN(v) ? 0 : v;
}

function typeDot(){
  startTyping();
  if(ST.exp) return;
  if(ST.input === '') ST.input = '0';
  if(ST.input.indexOf('.') < 0) ST.input += '.';
  ST.X = parseFloat(ST.input) || 0;
}

function typeExp(){
  startTyping();
  if(ST.input === '') ST.input = '0';
  if(ST.input.indexOf('e') < 0){ ST.input += 'e'; ST.exp = true; }
}

/* ---------- операции ---------- */
function setErr(){
  ST.err = true;
  clickErr();
  say('ошибка');
  render();
}

function unary(fn){
  var old = ST.X;
  var v = norm(fn(ST.X));
  if(isNaN(v)){ setErr(); return; }
  ST.X1 = old;
  ST.X = v;
  ST.typing = false; ST.input = ''; ST.exp = false;
}

function binary(fn){
  var x = ST.X, y = ST.Y;
  var v = norm(fn(y, x));
  if(isNaN(v)){ setErr(); return; }
  ST.X1 = x;
  ST.Y = ST.Z;
  ST.Z = ST.T;
  ST.X = v;
  ST.typing = false; ST.input = ''; ST.exp = false;
}

function toRad(v){ return v * Math.PI / 180; }
function fromRad(v){ return v * 180 / Math.PI; }

function execCode(code){
  var hi = (code >> 4) & 15, lo = code & 15;

  if(code >= 0x26 && code <= 0x2A) { setErr(); return; }
  if(code >= 0x30 && code <= 0x3B) { setErr(); return; }

  if(code >= 0x00 && code <= 0x09){ typeDigit(code); return; }
  if(code === 0x0A){ typeDot(); return; }
  if(code === 0x0B){ ST.X = -ST.X; if(ST.typing) ST.input = String(ST.X); clickOp(); return; }
  if(code === 0x0C){ typeExp(); return; }
  if(code === 0x0D){ ST.X = 0; ST.typing = false; ST.input = ''; ST.exp = false; clickOp(); return; }
  if(code === 0x0E){ shiftUp(); ST.typing = false; ST.input = ''; ST.exp = false; clickOp(); return; }
  if(code === 0x0F){ var t = ST.X1; ST.X1 = ST.X; ST.X = t; ST.typing = false; clickOp(); return; }

  if(code === 0x10){ binary(function(a,b){ return a + b; }); clickOp(); return; }
  if(code === 0x11){ binary(function(a,b){ return a - b; }); clickOp(); return; }
  if(code === 0x12){ binary(function(a,b){ return a * b; }); clickOp(); return; }
  if(code === 0x13){ binary(function(a,b){ return a / b; }); clickOp(); return; }
  if(code === 0x14){ var q = ST.X; ST.X = ST.Y; ST.Y = q; ST.typing = false; clickOp(); return; }

  if(code === 0x15){ unary(function(v){ return Math.pow(10, v); }); clickOp(); return; }
  if(code === 0x16){ unary(function(v){ return Math.exp(v); }); clickOp(); return; }
  if(code === 0x17){ unary(function(v){ return Math.log10(v); }); clickOp(); return; }
  if(code === 0x18){ unary(function(v){ return Math.log(v); }); clickOp(); return; }
  if(code === 0x19){ unary(function(v){ return fromRad(Math.asin(v)); }); clickOp(); return; }
  if(code === 0x1A){ unary(function(v){ return fromRad(Math.acos(v)); }); clickOp(); return; }
  if(code === 0x1B){ unary(function(v){ return fromRad(Math.atan(v)); }); clickOp(); return; }
  if(code === 0x1C){ unary(function(v){ return Math.sin(toRad(v)); }); clickOp(); return; }
  if(code === 0x1D){ unary(function(v){ return Math.cos(toRad(v)); }); clickOp(); return; }
  if(code === 0x1E){ unary(function(v){ return Math.tan(toRad(v)); }); clickOp(); return; }

  if(code === 0x20){ pushValue(Math.PI); clickOp(); return; }
  if(code === 0x21){ unary(function(v){ return Math.sqrt(v); }); clickOp(); return; }
  if(code === 0x22){ unary(function(v){ return v * v; }); clickOp(); return; }
  if(code === 0x23){ unary(function(v){ return 1 / v; }); clickOp(); return; }
  if(code === 0x24){ binary(function(a,b){ return Math.pow(a, b); }); clickOp(); return; }
  if(code === 0x25){
    var tx = ST.X;
    ST.X = ST.Y; ST.Y = ST.Z; ST.Z = ST.T; ST.T = tx;
    ST.typing = false; clickOp(); return;
  }

  if(hi === 4){ ST.R[lo] = norm(ST.X); hint('X → R' + REG_NAMES[lo]); clickOp(); return; }
  if(hi === 6){ pushValue(ST.R[lo]); hint('R' + REG_NAMES[lo] + ' → X'); clickOp(); return; }

  if(code === 0x50){ clickOk(); return; }
  if(code === 0x52){ if(ST.sub.length){ ST.ip = ST.sub.pop(); } else { ST.ip = 0; } return; }

  setErr();
}

/* ---------- запись программы ---------- */
function writeStep(code){
  if(ST.ip < 0 || ST.ip >= 98){ hint('Программная память заполнена (98 шагов)'); clickErr(); return; }
  ST.prog[ST.ip] = code;
  ST.ip = (ST.ip + 1) % 98;
}

/* Команда с адресом: занимает ТРИ ячейки — сама команда и две цифры адреса.
   После вызова этой функции эмулятор ждёт две цифры (десятки, единицы). */
function writeJump(code){
  if(ST.ip > 95){
    hint('Для перехода нужно три ячейки (команда + две цифры адреса). Свободного места не хватает.');
    clickErr();
    return;
  }
  ST.prog[ST.ip] = code;
  ST.ip = (ST.ip + 1) % 98;
  ST.await = 'addr';
  ST.addrBuf = '';
  hint('Введи адрес перехода двумя цифрами (десятки, затем единицы)');
  render();
}

/* ---------- выполнение программы ---------- */
function modAddr(v, r){
  var a;
  if(r >= 0 && r <= 3) a = (v - 1 + 100) % 100;
  else if(r >= 4 && r <= 6) a = (v + 1) % 100;
  else a = v;
  if(a < 0 || a > 97) a = ((a % 98) + 98) % 98;
  return a;
}

function badAddress(){
  hint('Ошибка в адресе перехода: после команды должны стоять две цифры (00–97)');
  ST.err = true;
  ST.run = false;
  clickErr();
  render();
  return 'stop';
}

function runStep(){
  var code = ST.prog[ST.ip];
  var hi = (code >> 4) & 15, lo = code & 15;
  var addr = -1;

  if(code === 0x50){ ST.run = false; clickOk(); return 'stop'; }
  if(code === 0x51){
    addr = jumpAddr(ST.ip);
    if(addr < 0) return badAddress();
    ST.ip = addr; return 'jump';
  }
  if(code === 0x52){ ST.ip = ST.sub.length ? ST.sub.pop() : 0; return 'jump'; }
  if(code === 0x53){
    addr = jumpAddr(ST.ip);
    if(addr < 0) return badAddress();
    ST.sub.push((ST.ip + 3) % 98);
    ST.ip = addr; return 'jump';
  }
  if(code === 0x54){ ST.ip++; return 'cont'; }

  /* Условные переходы: три ячейки.
     У руководства Б3-34 условие ИСТИННО -> выполняется следующая команда,
     условие ЛОЖНО -> переход по записанному адресу. */
  if(code === 0x57 || code === 0x59 || code === 0x5C || code === 0x5E){
    addr = jumpAddr(ST.ip);
    if(addr < 0) return badAddress();
    var ok = false;
    if(code === 0x57) ok = (ST.X !== 0);
    else if(code === 0x59) ok = (ST.X >= 0);
    else if(code === 0x5C) ok = (ST.X < 0);
    else ok = (ST.X === 0);
    ST.ip = ok ? ((ST.ip + 3) % 98) : addr;
    return 'jump';
  }

  /* Циклы L0–L3: тоже три ячейки.
     Регистр уменьшается; пока не ноль — переход по адресу. */
  if(code === 0x5D || code === 0x5B || code === 0x58 || code === 0x5A){
    addr = jumpAddr(ST.ip);
    if(addr < 0) return badAddress();
    var r = code === 0x5D ? 0 : (code === 0x5B ? 1 : (code === 0x58 ? 2 : 3));
    ST.R[r] = norm(ST.R[r] - 1);
    if(ST.R[r] !== 0){ ST.ip = addr; } else { ST.ip = (ST.ip + 3) % 98; }
    return 'jump';
  }

  /* Косвенные команды: адрес берётся из регистра, поэтому занимают ОДНУ ячейку */
  if(hi === 8){ ST.ip = modAddr(ST.R[lo], lo); return 'jump'; }
  if(hi === 0xA){ ST.sub.push((ST.ip + 1) % 98); ST.ip = modAddr(ST.R[lo], lo); return 'jump'; }
  if(hi === 0xB){ ST.R[modAddr(ST.R[lo], lo) % 14] = norm(ST.X); ST.ip++; return 'cont'; }
  if(hi === 0xD){ pushValue(ST.R[modAddr(ST.R[lo], lo) % 14]); ST.ip++; return 'cont'; }

  /* Косвенные условные: то же правило — истина ведёт к следующей команде.
     7r = К x≠0, 9r = К x≥0, Cr = К x<0, Er = К x=0. */
  if(hi === 7){ if(ST.X !== 0){ ST.ip++; } else { ST.ip = modAddr(ST.R[lo], lo); } return 'jump'; }
  if(hi === 9){ if(ST.X >= 0){ ST.ip++; } else { ST.ip = modAddr(ST.R[lo], lo); } return 'jump'; }
  if(hi === 0xC){ if(ST.X < 0){ ST.ip++; } else { ST.ip = modAddr(ST.R[lo], lo); } return 'jump'; }
  if(hi === 0xE){ if(ST.X === 0){ ST.ip++; } else { ST.ip = modAddr(ST.R[lo], lo); } return 'jump'; }

  if(code >= 0x26 && code <= 0x2A){ setErr(); ST.run = false; return 'stop'; }
  if(code >= 0x30 && code <= 0x3B){ setErr(); ST.run = false; return 'stop'; }

  execCode(code);
  if(ST.err){ ST.run = false; return 'stop'; }
  ST.ip++;
  if(ST.ip > 97) ST.ip = 0;
  return 'cont';
}

/* ---------- запуск в темпе оригинала ---------- */
var runTimer = null;

function finishRun(){
  ST.run = false;
  if(runTimer){ clearTimeout(runTimer); runTimer = null; }
  render();
  if(!ST.err) say(speechNum(ST.X));
}

function stopRun(msg){
  ST.run = false;
  if(runTimer){ clearTimeout(runTimer); runTimer = null; }
  render();
  if(msg) hint(msg);
}

function guardStop(){
  ST.run = false;
  if(runTimer){ clearTimeout(runTimer); runTimer = null; }
  hint('Остановлено: слишком много шагов — похоже на зацикливание (нет С/П в конце или L без счётчика)');
  setErr();
}

function tickRun(){
  runTimer = null;
  if(!ST.run) return;

  if(ST.fast){
    var guard = 0, stop = false;
    while(ST.run && guard < 1500 && !stop){
      var r = runStep();
      guard++;
      if(r === 'stop' || ST.err) stop = true;
    }
    ST.steps += guard;
    render();
    if(!ST.run || ST.err || stop){ finishRun(); return; }
    if(ST.steps > 400000){ guardStop(); return; }
    runTimer = setTimeout(tickRun, 0);
    return;
  }

  var res = runStep();
  ST.steps++;
  render();
  if(!ST.run || ST.err || res === 'stop'){ finishRun(); return; }
  if(ST.steps > 60000){ guardStop(); return; }
  tickStep();
  runTimer = setTimeout(tickRun, RUN_DELAY);
}

function startRun(fromZero){
  if(ST.run){ stopRun('Остановлено'); return; }
  ST.mode = 'AUT';
  if(fromZero){ ST.ip = 0; ST.sub = []; }
  ST.err = false;
  ST.typing = false; ST.input = ''; ST.exp = false;
  ST.run = true;
  ST.steps = 0;
  drawPad();
  render();
  hint(ST.fast ? 'Считаю быстро (без задержек)' : 'Считаю в темпе оригинала: ~5 шагов в секунду. Кнопка «Стоп» остановит.');
  runTimer = setTimeout(tickRun, ST.fast ? 0 : 120);
}

/* кнопка «Пуск»: то же, что f АВТ + В/О + С/П */
function runProgram(){
  startRun(true);
}

/* ---------- обработка клавиш ---------- */
function hint(t){ hintEl.textContent = t; }

function onKey(k){
  /* ввод адреса перехода: каждая цифра — своя ячейка программы */
  if(ST.await === 'addr' && k.a === 'digit'){
    clickKey();
    ST.prog[ST.ip] = k.d;
    ST.ip = (ST.ip + 1) % 98;
    ST.addrBuf += String(k.d);
    if(ST.addrBuf.length >= 2){
      var full = parseInt(ST.addrBuf, 10);
      hint('Адрес перехода записан: ' + p2(full));
      ST.addrBuf = '';
      ST.await = null;
    }else{
      hint('Адрес: ' + ST.addrBuf + '_ (вторая цифра)');
    }
    render();
    return;
  }

  if(k.a === 'pref-f'){
    clickKey();
    ST.layer = ST.layer === 'f' ? 'main' : 'f';
    drawPad(); render();
    return;
  }
  if(k.a === 'pref-k'){
    clickKey();
    ST.layer = ST.layer === 'k' ? 'main' : 'k';
    drawPad(); render();
    return;
  }

  if(k.a === 'digit'){
    clickKey();
    if(ST.mode === 'PRG'){ writeStep(k.d); hint('Код ' + codeStr(k.d)); }
    else { typeDigit(k.d); }
    render();
    ST.layer = 'main'; drawPad();
    return;
  }
  if(k.a === 'dot'){
    clickKey();
    if(ST.mode === 'PRG') writeStep(0x0A);
    else typeDot();
    render();
    ST.layer = 'main'; drawPad();
    return;
  }

  if(k.a === 'code'){
    clickOp();
    if(ST.mode === 'PRG'){
      if(k.jump){ writeJump(k.c); }
      else { writeStep(k.c); hint('Код ' + codeStr(k.c)); }
    }else{
      execCode(k.c);
      if(!ST.err && (k.c >= 0x10 && k.c <= 0x24)) say(speechNum(ST.X));
    }
    ST.layer = 'main'; drawPad(); render();
    return;
  }

  if(k.a === 'stox'){
    clickKey();
    if(ST.mode === 'PRG'){ ST.await = 'reg'; ST.kind = 0x40; drawRegPick('sto'); }
    else { ST.await = 'reg'; drawRegPick('sto'); }
    return;
  }
  if(k.a === 'loadx'){
    clickKey();
    if(ST.mode === 'PRG'){ ST.await = 'reg'; ST.kind = 0x60; drawRegPick('ld'); }
    else { ST.await = 'reg'; drawRegPick('ld'); }
    return;
  }
  if(k.a === 'kcmd'){
    clickKey();
    ST.kind = k.k;
    ST.await = 'reg';
    drawRegPick('k');
    return;
  }

  if(k.a === 'sp'){
    clickKey();
    if(ST.mode === 'PRG'){
      writeStep(0x50);
      hint('Код 50 (С/П)');
    }else if(ST.run){
      stopRun('Остановлено клавишей С/П на адресе ' + p2(ST.ip));
    }else{
      startRun(false);
    }
    ST.layer = 'main'; drawPad(); render();
    return;
  }
  if(k.a === 'pp'){
    clickKey();
    if(ST.mode === 'PRG'){ writeJump(0x53); }
    else {
      if(ST.run){ stopRun('Остановлено'); }
      var r = runStep();
      render();
      if(r === 'stop' && !ST.err) say(speechNum(ST.X));
    }
    ST.layer = 'main'; drawPad(); render();
    return;
  }
  if(k.a === 'bp'){
    clickKey();
    if(ST.mode === 'PRG'){ writeJump(0x51); }
    else { ST.await = 'addr'; ST.addrBuf = ''; hint('Введи адрес перехода двумя цифрами'); }
    ST.layer = 'main'; drawPad(); render();
    return;
  }
  if(k.a === 'vo'){
    clickKey();
    if(ST.mode === 'PRG'){ writeStep(0x52); }
    else { ST.ip = 0; ST.sub = []; hint('Адрес 00'); }
    ST.layer = 'main'; drawPad(); render();
    return;
  }
  if(k.a === 'prg'){
    clickKey();
    ST.mode = 'PRG';
    ST.typing = false; ST.exp = false;
    if(ST.run) stopRun();
    hint('Режим программирования: нажимай клавиши — их коды пишутся в память');
    ST.layer = 'main'; drawPad(); render();
    return;
  }
  if(k.a === 'aut'){
    clickKey();
    ST.mode = 'AUT';
    ST.err = false;
    hint('Автоматический режим');
    ST.layer = 'main'; drawPad(); render();
    return;
  }
  if(k.a === 'cf'){
    clickKey();
    ST.layer = 'main'; ST.await = null; ST.kind = null;
    panelEl.style.display = 'none';
    drawPad(); render();
    return;
  }
}

/* ---------- память: автосохранение ---------- */
var LS_STATE = 'b334.state.v3';
var LS_LIB = 'b334.programs.v2';
var saveTimer = null;

function scheduleSave(){
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStateNow, 250);
}

function saveStateNow(){
  try{
    localStorage.setItem(LS_STATE, JSON.stringify({
      prog: ST.prog.slice(0),
      R: ST.R.slice(0, 14),
      sound: ST.soundOn,
      voice: ST.voiceOn,
      fast: ST.fast
    }));
  }catch(e){}
}

function loadState(){
  try{
    var raw = localStorage.getItem(LS_STATE);
    if(!raw) return false;
    var o = JSON.parse(raw);
    if(!o) return false;
    if(Array.isArray(o.prog)){
      for(var i = 0; i < 98; i++){
        ST.prog[i] = typeof o.prog[i] === 'number' ? (o.prog[i] & 255) : 0x54;
      }
    }
    if(Array.isArray(o.R)){
      for(var j = 0; j < 14; j++){
        ST.R[j] = typeof o.R[j] === 'number' ? o.R[j] : 0;
      }
    }
    if(typeof o.sound === 'boolean') ST.soundOn = o.sound;
    if(typeof o.voice === 'boolean') ST.voiceOn = o.voice;
    if(typeof o.fast === 'boolean') ST.fast = o.fast;
    return true;
  }catch(e){ return false; }
}

/* ---------- память: библиотека программ ---------- */
function getLib(){
  try{
    var raw = localStorage.getItem(LS_LIB);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}

function setLib(arr){
  try{
    localStorage.setItem(LS_LIB, JSON.stringify(arr));
    return true;
  }catch(e){
    hint('Не удалось записать в память браузера — она переполнена или недоступна');
    clickErr();
    return false;
  }
}

function normProg(arr){
  var p = new Array(98).fill(0x54);
  if(Array.isArray(arr)){
    for(var i = 0; i < 98; i++){
      if(typeof arr[i] === 'number' && isFinite(arr[i])){
        p[i] = Math.max(0, Math.min(255, Math.round(arr[i])));
      }
    }
  }
  return p;
}

function programHasData(prog){
  for(var i = 0; i < 98; i++){ if(prog[i] !== 0x54) return true; }
  return false;
}

function lastStep(prog){
  var last = -1;
  for(var i = 0; i < 98; i++){ if(prog[i] !== 0x54) last = i; }
  return last;
}

function renderLib(){
  var box = document.getElementById('progList');
  if(!box) return;
  var lib = getLib();
  box.innerHTML = '';
  if(!lib.length){
    var e = document.createElement('div');
    e.className = 'empty';
    e.textContent = 'Пока пусто. Набери программу в режиме ПРГ и нажми «Сохранить программу» — она останется здесь.';
    box.appendChild(e);
    return;
  }
  lib.forEach(function(item, idx){
    var row = document.createElement('div');
    row.className = 'progitem';

    var nm = document.createElement('span');
    nm.className = 'nm';
    var len = lastStep(normProg(item.prog)) + 1;
    nm.textContent = item.name;
    var st = document.createElement('span');
    st.className = 'st';
    st.textContent = len + ' ш.';
    nm.appendChild(st);

    var bLoad = document.createElement('button');
    bLoad.textContent = '▶';
    bLoad.addEventListener('click', function(){ loadFromLib(idx); });

    var bDel = document.createElement('button');
    bDel.className = 'del';
    bDel.textContent = '✕';
    bDel.addEventListener('click', function(){ deleteFromLib(idx); });

    row.appendChild(nm);
    row.appendChild(bLoad);
    row.appendChild(bDel);
    box.appendChild(row);
  });
}

function saveCurrentProgram(){
  if(!programHasData(ST.prog)){
    hint('Программа пуста: сначала набери её в режиме ПРГ');
    clickErr();
    return;
  }
  var lib = getLib();
  var def = 'Программа ' + (lib.length + 1);
  var name = window.prompt('Название программы:', def);
  if(name === null) return;
  name = String(name).trim().slice(0, 40) || def;

  var found = -1;
  for(var i = 0; i < lib.length; i++){ if(lib[i].name === name){ found = i; break; } }
  var item = { name: name, prog: ST.prog.slice(0), updated: new Date().toISOString() };
  if(found >= 0) lib[found] = item; else lib.unshift(item);

  if(setLib(lib)){
    renderLib();
    hint('Сохранено в память браузера: «' + name + '» (' + (lastStep(ST.prog) + 1) + ' шагов)');
    clickOk();
    say('сохранено');
  }
}

function loadFromLib(idx){
  var lib = getLib();
  if(!lib[idx]) return;
  if(ST.run) stopRun();
  ST.prog = normProg(lib[idx].prog);
  ST.ip = 0;
  ST.mode = 'AUT';
  ST.err = false;
  drawPad();
  render();
  hint('Программа «' + lib[idx].name + '» загружена. Запуск: «▶ Пуск» или f → АВТ, В/О, С/П');
  clickOk();
  say('программа загружена');
}

function deleteFromLib(idx){
  var lib = getLib();
  if(!lib[idx]) return;
  var name = lib[idx].name;
  if(!window.confirm('Удалить программу «' + name + '» из списка?')) return;
  lib.splice(idx, 1);
  if(setLib(lib)){
    renderLib();
    hint('Удалено из списка: «' + name + '»');
    clickKey();
  }
}

/* ---------- память: файлы ---------- */
function stamp(){
  var d = new Date();
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
}

function downloadFile(name, text, mime){
  try{
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
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
    hint('Браузер не дал сохранить файл: ' + (e.message || 'ошибка'));
    clickErr();
    return false;
  }
}

function exportJSON(){
  var data = {
    format: 'b3-34',
    version: 3,
    savedAt: new Date().toISOString(),
    registers: ST.R.slice(0, 14),
    settings: { sound: ST.soundOn, voice: ST.voiceOn, fast: ST.fast },
    current: {
      name: 'Текущая программа',
      length: lastStep(ST.prog) + 1,
      prog: ST.prog.slice(0)
    },
    programs: getLib().map(function(p){
      return { name: p.name, updated: p.updated || '', prog: normProg(p.prog) };
    })
  };
  if(downloadFile('b3-34_' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json')){
    hint('Файл JSON сохранён в «Загрузки»: ' + data.programs.length + ' программ + текущая');
    clickOk();
    say('файл джейсон сохранён');
  }
}

/* Листинг: у перехода две следующие ячейки — цифры адреса, их подписываем. */
function listProgram(name, prog){
  var out = ['=== ' + name + ' ==='];
  var last = lastStep(prog);
  if(last < 0){
    out.push('(программа пуста)');
  }else{
    var isAddr = {};
    for(var k = 0; k <= last; k++){
      if(isJumpCmd(prog[k])){ isAddr[k + 1] = true; isAddr[k + 2] = true; }
    }
    for(var i = 0; i <= last; i++){
      if(isAddr[i]){
        out.push(p2(i) + ': ' + (prog[i] & 15) + '   (цифра адреса перехода)');
      }else{
        out.push(p2(i) + ': ' + hex2(prog[i]) + '   ' + cmdName(prog[i]));
      }
    }
  }
  out.push('');
  return out.join('\n');
}

function exportTXT(){
  var parts = [];
  parts.push('ЭЛЕКТРОНИКА Б3-34 — листинг программ');
  parts.push('сохранено: ' + new Date().toLocaleString('ru-RU'));
  parts.push('переход занимает 3 шага: команда + десятки адреса + единицы адреса');
  parts.push('условие выполняется — идём дальше, не выполняется — переход по адресу');
  parts.push('формат строки: АДРЕС: КОД  НАЗВАНИЕ КОМАНДЫ');
  parts.push('');
  parts.push(listProgram('Текущая программа', ST.prog));
  getLib().forEach(function(p){
    parts.push(listProgram(p.name, normProg(p.prog)));
  });
  if(downloadFile('b3-34_' + stamp() + '.txt', parts.join('\n'), 'text/plain')){
    hint('Файл TXT сохранён в «Загрузки»');
    clickOk();
    say('файл тэ икс тэ сохранён');
  }
}

function importJSON(o){
  if(!o || typeof o !== 'object'){
    hint('В файле нет данных программы');
    clickErr();
    return;
  }
  var lib = getLib();
  var added = 0;

  if(Array.isArray(o.programs)){
    o.programs.forEach(function(p){
      if(!p || !Array.isArray(p.prog)) return;
      var name = String(p.name || 'Без названия').slice(0, 40);
      var found = -1;
      for(var i = 0; i < lib.length; i++){ if(lib[i].name === name){ found = i; break; } }
      var item = { name: name, prog: normProg(p.prog), updated: p.updated || new Date().toISOString() };
      if(found >= 0) lib[found] = item; else lib.unshift(item);
      added++;
    });
  }

  var cur = null;
  if(o.current && Array.isArray(o.current.prog)) cur = o.current.prog;
  else if(Array.isArray(o.prog)) cur = o.prog;

  if(cur){
    if(ST.run) stopRun();
    ST.prog = normProg(cur);
    ST.ip = 0;
    ST.mode = 'AUT';
    ST.err = false;
  }
  if(Array.isArray(o.registers)){
    for(var j = 0; j < 14; j++){
      if(typeof o.registers[j] === 'number') ST.R[j] = o.registers[j];
    }
  }
  if(o.settings){
    if(typeof o.settings.sound === 'boolean') ST.soundOn = o.settings.sound;
    if(typeof o.settings.voice === 'boolean') ST.voiceOn = o.settings.voice;
    if(typeof o.settings.fast === 'boolean') ST.fast = o.settings.fast;
  }

  setLib(lib);
  syncToggles();
  drawPad();
  renderLib();
  render();
  hint('Загружено из файла: программ — ' + added + (cur ? ', текущая программа в памяти' : '') +
       '. Внимание: файлы старого формата (до v3) могли сохранять переходы в 2 ячейки — проверь адреса.');
  clickOk();
  say('файл загружен');
}

function importTXT(text){
  var lines = text.split(/\r?\n/);
  var sections = [];
  var cur = { name: 'Импорт', prog: new Array(98).fill(0x54) };

  for(var i = 0; i < lines.length; i++){
    var line = lines[i];
    var head = line.match(/^\s*===\s*(.+?)\s*===\s*$/);
    if(head){
      sections.push(cur);
      cur = { name: String(head[1]).slice(0, 40), prog: new Array(98).fill(0x54) };
      continue;
    }
    var m = line.match(/^\s*(\d{1,2})\s*[:.\-]\s*([0-9A-Fa-f]{2})\b/);
    if(m){
      var idx = parseInt(m[1], 10);
      if(idx >= 0 && idx < 98){
        cur.prog[idx] = parseInt(m[2], 16) & 255;
      }
      continue;
    }
    var m2 = line.match(/^\s*(\d{1,2})\s*[:.\-]\s*(\d)\b/);
    if(m2){
      var idx2 = parseInt(m2[1], 10);
      if(idx2 >= 0 && idx2 < 98) cur.prog[idx2] = parseInt(m2[2], 10);
      continue;
    }
    var m3 = line.match(/^\s*(\d{1,2})\s*[:.\-]\s*([0-9A-Za-zА-Яа-я\-])\s*$/);
    if(m3){
      var idx3 = parseInt(m3[1], 10);
      var sym = m3[2];
      var table = '0123456789-LCГE ';
      var pos = table.indexOf(sym);
      if(pos < 0) pos = table.indexOf(sym.toUpperCase());
      if(idx3 >= 0 && idx3 < 98 && pos >= 0){
        cur.prog[idx3] = pos;
      }
    }
  }
  sections.push(cur);

  var useful = sections.filter(function(s){ return lastStep(s.prog) >= 0; });
  if(!useful.length){
    hint('В файле не нашлось кодов программы (строки вида «00: 60»)');
    clickErr();
    return;
  }

  if(useful.length === 1){
    if(ST.run) stopRun();
    ST.prog = useful[0].prog.slice(0);
    ST.ip = 0;
    ST.mode = 'AUT';
    ST.err = false;
    drawPad();
    render();
    hint('Программа из TXT загружена в память (' + (lastStep(ST.prog) + 1) + ' шагов)');
    clickOk();
    say('программа загружена');
    return;
  }

  var lib = getLib();
  var added = 0;
  useful.forEach(function(s){
    if(/текущая/i.test(s.name)){
      ST.prog = s.prog.slice(0);
      ST.ip = 0;
      ST.mode = 'AUT';
    }else{
      lib.unshift({ name: s.name, prog: s.prog, updated: new Date().toISOString() });
      added++;
    }
  });
  setLib(lib);
  drawPad();
  renderLib();
  render();
  hint('Из TXT добавлено программ: ' + added + '; текущая программа обновлена');
  clickOk();
  say('файл загружен');
}

function importFile(file){
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    var text = String(reader.result || '');
    var isJson = /\.json$/i.test(file.name) || /^\s*\{/.test(text);
    if(isJson){
      try{
        importJSON(JSON.parse(text));
      }catch(e){
        hint('Файл JSON не разобран: ' + (e.message || 'ошибка'));
        clickErr();
      }
    }else{
      importTXT(text);
    }
  };
  reader.onerror = function(){
    hint('Не удалось прочитать файл');
    clickErr();
  };
  reader.readAsText(file, 'utf-8');
}

/* ---------- голосовой ввод ---------- */
var NUMS = {
  'ноль':0,'нуль':0,'один':1,'одна':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,
  'десять':10,'одиннадцать':11,'двенадцать':12,'тринадцать':13,'четырнадцать':14,'пятнадцать':15,'шестнадцать':16,
  'семнадцать':17,'восемнадцать':18,'девятнадцать':19,
  'двадцать':20,'тридцать':30,'сорок':40,'пятьдесят':50,'шестьдесят':60,'семьдесят':70,'восемьдесят':80,'девяносто':90,
  'сто':100,'двести':200,'триста':300,'четыреста':400,'пятьсот':500,'шестьсот':600,'семьсот':700,'восемьсот':800,'девятьсот':900
};

function parseSpoken(text){
  var t = (text || '').toLowerCase().replace(/ё/g, 'е');
  t = t.replace(/[^a-zа-я0-9+\-*/. ,]/g, ' ');
  t = t.replace(/(\d)\s*[хx]\s*(\d)/g, '$1 * $2');
  t = t.replace(/умножить на|умножить|помножить на|помножить/g, ' * ');
  t = t.replace(/разделить на|разделить|поделить на|поделить|делить на|делить/g, ' / ');
  t = t.replace(/плюс|прибавить|сложить/g, ' + ');
  t = t.replace(/минус|вычесть|отнять/g, ' - ');
  t = t.replace(/запятая|запятой/g, ',');
  t = t.replace(/[^a-zа-я0-9+\-*/. ,]/g, ' ');

  var words = t.split(/\s+/).filter(function(w){ return w.length > 0; });
  var tokens = [];
  var acc = 0, has = false, lastArabic = false, dec = 0;

  function pushNum(){
    if(has || dec){
      tokens.push(dec ? dec : acc);
      acc = 0; has = false; dec = 0;
    }
  }

  for(var i = 0; i < words.length; i++){
    var w = words[i];
    if(w === 'х' || w === 'x' || w === 'икс' || w === 'звездочка'){
      pushNum(); tokens.push('*'); lastArabic = false; continue;
    }
    if(w === '+' || w === '-' || w === '*' || w === '/'){ pushNum(); tokens.push(w); lastArabic = false; continue; }
    if(/^\d+$/.test(w)){
      if(has || dec){ pushNum(); }
      acc = parseInt(w, 10); has = true; lastArabic = true; continue;
    }
    if(NUMS.hasOwnProperty(w)){
      var v = NUMS[w];
      if(lastArabic && (has || dec)){ pushNum(); }
      acc += v; has = true;
      lastArabic = false; continue;
    }
  }
  pushNum();
  return tokens;
}

function execOpChar(op, a, b){
  var v = null;
  if(op === '+') v = a + b;
  else if(op === '-') v = a - b;
  else if(op === '*') v = a * b;
  else if(op === '/') v = a / b;
  var n = norm(v);
  if(isNaN(n)) return null;
  return n;
}

function runSpoken(text){
  var tokens = parseSpoken(text);
  if(!tokens.length){ hint('Не поняла пример'); say('не поняла'); clickErr(); return; }
  var numbers = tokens.filter(function(t){ return typeof t === 'number'; });
  var ops = tokens.filter(function(t){ return typeof t === 'string'; });
  if(numbers.length < 2 || ops.length < 1){
    hint('Услышано: «' + text + '» · нужны два числа и действие');
    say('назови два числа и действие'); clickErr(); return;
  }
  if(ST.run) stopRun();
  ST.mode = 'AUT';
  ST.err = false;

  ST.X = 0; ST.Y = 0; ST.Z = 0; ST.T = 0;
  ST.X1 = 0;
  ST.typing = false; ST.exp = false;

  pushValue(numbers[0]);
  for(var i = 1; i < numbers.length; i++){
    shiftUp();
    pushValue(numbers[i]);
    var op = ops[i - 1];
    var v = execOpChar(op, ST.Y, ST.X);
    if(v === null){ setErr(); return; }
    ST.X = v;
    ST.typing = false;
  }
  ST.ip = 0;
  render();
  clickOk();
  var chain = tokens.map(function(t){ return typeof t === 'number' ? String(t) : t; }).join(' ');
  hint('Услышано: «' + text + '» · ' + chain + ' → ' + fmtNum(ST.X));
  say(speechNum(ST.X));
}

function startVoice(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ hint('В этом браузере распознавание речи недоступно'); clickErr(); return; }
  var rec = new SR();
  rec.lang = 'ru-RU';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  hint('Слушаю…');
  rec.onresult = function(e){
    var text = e.results[0][0].transcript;
    runSpoken(text);
  };
  rec.onerror = function(e){
    hint('Ошибка распознавания: ' + (e.error || 'неизвестно'));
    clickErr();
  };
  rec.onend = function(){
    if(hintEl.textContent === 'Слушаю…') hint('Ничего не услышала — попробуй ещё раз');
  };
  try{ rec.start(); }catch(err){ hint('Не удалось включить микрофон'); }
}

/* ---------- демо ---------- */
/* Загружает массив кодов, дополняя до 98 ячеек НОП. */
function loadCodes(codes){
  if(ST.run) stopRun();
  for(var i = 0; i < 98; i++) ST.prog[i] = 0x54;
  for(var j = 0; j < codes.length; j++) ST.prog[j] = codes[j];
  ST.mode = 'AUT';
  ST.ip = 0;
  ST.sub = [];
  ST.err = false;
  drawPad();
  render();
}

function loadDemo(){
  /* n! - 13 шагов (переход L1 занимает три ячейки: 08, 09, 10) */
  loadCodes([0x60,0x41,0x01,0x42,0x62,0x61,0x12,0x42,0x5B,0x00,0x04,0x62,0x50]);
  hint('Программа n! (адреса 00–12). Занеси n в R0: число → x→П → 0. Затем «▶ Пуск»');
  say('программа загружена');
}

function loadDemo2(){
  /* длина отрезка - 11 шагов, переходов нет */
  loadCodes([0x61,0x62,0x11,0x22,0x63,0x64,0x11,0x22,0x10,0x21,0x50]);
  ST.R[1] = 8;   /* x2 */
  ST.R[2] = 1;   /* x1 */
  ST.R[3] = 4;   /* y2 */
  ST.R[4] = 2;   /* y1 */
  render();
  hint('Длина отрезка. Данные уже в регистрах: x1=1 в R2, y1=2 в R4, x2=8 в R1, y2=4 в R3. Жми «▶ Пуск» → 7.2801099');
  say('программа загружена');
}

function loadDemo3(){
  /* НОД четырёх чисел (R1..R4), алгоритм Евклида вычитанием.
     Главная 00-14, подпрограмма НОД с адреса 20. Всего 41 ячейка.
     Условия записаны по руководству: F x≠0 и F x≥0 — переход идёт,
     когда условие НЕ выполняется. */
  loadCodes([
    0x53,0x02,0x00,   /* 00: ПП 20 */
    0x63,             /* 03: П→X 3 */
    0x42,             /* 04: X→П 2 */
    0x53,0x02,0x00,   /* 05: ПП 20 */
    0x64,             /* 08: П→X 4 */
    0x42,             /* 09: X→П 2 */
    0x53,0x02,0x00,   /* 10: ПП 20 */
    0x61,             /* 13: П→X 1 */
    0x50,             /* 14: С/П */

    0x54,0x54,0x54,0x54,0x54,  /* 15-19: К НОП */

    0x61,             /* 20: П→X 1 */
    0x62,             /* 21: П→X 2 */
    0x11,             /* 22: − */
    0x57,0x04,0x00,   /* 23: F x≠0 -> ложно, переход на 40 (В/О) */
    0x59,0x03,0x03,   /* 26: F x≥0 -> ложно, переход на 33 */
    0x41,             /* 29: X→П 1 */
    0x51,0x02,0x00,   /* 30: БП 20 */
    0x62,             /* 33: П→X 2 */
    0x61,             /* 34: П→X 1 */
    0x11,             /* 35: − */
    0x42,             /* 36: X→П 2 */
    0x51,0x02,0x00,   /* 37: БП 20 */
    0x52              /* 40: В/О */
  ]);
  ST.R[1] = 32;
  ST.R[2] = 124;
  ST.R[3] = 206;
  ST.R[4] = 1086;
  render();
  hint('НОД четырёх чисел. Числа уже в R1–R4 (32, 124, 206, 1086). Включи быстрый темп и жми «▶ Пуск» → 2');
  say('программа загружена');
}

/* ---------- сброс ---------- */
function resetAll(){
  if(ST.run) stopRun();
  ST.X = ST.Y = ST.Z = ST.T = ST.X1 = 0;
  ST.R = new Array(14).fill(0);
  ST.prog = new Array(98).fill(0x54);
  ST.ip = 0; ST.mode = 'AUT'; ST.sub = []; ST.layer = 'main';
  ST.typing = false; ST.input = ''; ST.exp = false; ST.err = false;
  panelEl.style.display = 'none';
  drawPad(); render();
  hint('Сброс: память и текущая программа очищены (сохранённые в списке остались)');
}

/* ---------- кнопки инструментов ---------- */
function syncToggles(){
  var bs = document.getElementById('btnSound');
  if(bs){
    bs.className = ST.soundOn ? 'on' : '';
    bs.textContent = ST.soundOn ? '🔊 Звук: вкл' : '🔇 Звук: выкл';
  }
  var bv = document.getElementById('btnVoice');
  if(bv){
    bv.className = ST.voiceOn ? 'on' : '';
    bv.textContent = ST.voiceOn ? '🗣 Голос: вкл' : '🔇 Голос: выкл';
  }
  var bsp = document.getElementById('btnSpeed');
  if(bsp){
    bsp.className = ST.fast ? 'on' : '';
    bsp.textContent = ST.fast ? '⏩ Темп: быстро' : '🐢 Темп: оригинал';
  }
}

function bind(id, fn){
  var el = document.getElementById(id);
  if(el) el.addEventListener('click', fn);
}

bind('btnRun', function(){
  clickOk();
  if(ST.run){ stopRun('Остановлено'); return; }
  runProgram();
});
bind('btnStop', function(){
  clickKey();
  if(ST.run) stopRun('Остановлено на адресе ' + p2(ST.ip));
  else hint('Программа не выполняется');
});
bind('btnSpeed', function(){
  ST.fast = !ST.fast;
  syncToggles();
  saveStateNow();
  hint(ST.fast ? 'Быстрый темп: программа считается без задержек' : 'Темп оригинала: примерно 5 шагов в секунду, как у настоящего Б3-34');
  clickKey();
});
bind('btnSound', function(){
  ST.soundOn = !ST.soundOn;
  syncToggles();
  saveStateNow();
  if(ST.soundOn) clickOk();
});
bind('btnVoice', function(){
  ST.voiceOn = !ST.voiceOn;
  syncToggles();
  saveStateNow();
  if(ST.voiceOn) say('голос включён');
});
bind('btnMic', startVoice);
bind('btnDemo', loadDemo);
bind('btnDemo2', loadDemo2);
bind('btnDemo3', loadDemo3);
bind('btnHelp', function(){
  var h = document.getElementById('help');
  h.style.display = h.style.display === 'block' ? 'none' : 'block';
});
bind('btnReset', resetAll);
bind('btnSaveProg', saveCurrentProgram);
bind('btnExportJson', exportJSON);
bind('btnExportTxt', exportTXT);
bind('btnImportFile', function(){
  document.getElementById('fileInput').click();
});

var fi = document.getElementById('fileInput');
if(fi) fi.addEventListener('change', function(){
  var f = this.files && this.files[0];
  if(f) importFile(f);
  this.value = '';
});

/* ---------- старт ---------- */
(function init(){
  var had = loadState();
  syncToggles();
  initRegs();
  renderLib();
  drawPad();
  render();
  if(had){
    hint('Восстановлена последняя программа и регистры. Темп: ' + (ST.fast ? 'быстрый' : 'оригинал (~5 шагов/с)') +
         '. Переходы занимают три шага, как у оригинала.');
  }
})();

})();
