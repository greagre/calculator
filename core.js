/* ============================================================
   Электроника Б3-34 — ЯДРО v2
   ------------------------------------------------------------
   Программа хранится как СПИСОК ИНСТРУКЦИЙ, а не как ячейки:

     {c: 0x60}             одна команда (1 ячейка)
     {num: 7}              число (столько ячеек, сколько нужно)
     {jump: 0x5B, to: 4}   переход: to — НОМЕР ИНСТРУКЦИИ, не адрес

   Адреса ячеек считает compile(). Поэтому при правках программы
   адреса сдвигаются сами, а «формат на 2 ячейки / на 3 ячейки»
   больше не существует — в исходнике адрес всегда число.
   ============================================================ */
(function(global){
"use strict";

var CELLS = 98;      /* шагов программной памяти, как у оригинала */
var NOP = 0x54;
var MAXDIG = 8;      /* значащих цифр мантиссы */

/* ---------- коды команд ---------- */
var C = {
  DOT:0x0A, NEG:0x0B, EXP:0x0C, CX:0x0D, UP:0x0E, XV:0x0F,
  ADD:0x10, SUB:0x11, MUL:0x12, DIV:0x13, SWAP:0x14,
  T10:0x15, EX:0x16, LG:0x17, LN:0x18,
  ASIN:0x19, ACOS:0x1A, ATAN:0x1B, SIN:0x1C, COS:0x1D, TG:0x1E,
  PI:0x20, SQRT:0x21, SQ:0x22, INV:0x23, POW:0x24, FO:0x25,
  SP:0x50, BP:0x51, VO:0x52, PP:0x53, NOP:0x54
};

/* переходы: команда + десятки адреса + единицы адреса — три ячейки */
function isJump(c){
  return c === 0x51 || c === 0x53 ||
         c === 0x57 || c === 0x59 || c === 0x5C || c === 0x5E ||
         c === 0x5D || c === 0x5B || c === 0x58 || c === 0x5A;
}

var RNAME = '0123456789abcd';

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

function cmdName(c){
  if(c >= 0 && c <= 9) return 'цифра ' + c;
  if(NAMES[c]) return NAMES[c];
  if(c >= 0x40 && c <= 0x4D) return 'X→П ' + RNAME.charAt(c & 15);
  if(c >= 0x60 && c <= 0x6D) return 'П→X ' + RNAME.charAt(c & 15);
  if(c >= 0x70 && c <= 0x7D) return 'К x≠0 ' + RNAME.charAt(c & 15);
  if(c >= 0x80 && c <= 0x8D) return 'К БП ' + RNAME.charAt(c & 15);
  if(c >= 0x90 && c <= 0x9D) return 'К x≥0 ' + RNAME.charAt(c & 15);
  if(c >= 0xA0 && c <= 0xAD) return 'К ПП ' + RNAME.charAt(c & 15);
  if(c >= 0xC0 && c <= 0xCD) return 'К x<0 ' + RNAME.charAt(c & 15);
  if(c >= 0xE0 && c <= 0xED) return 'К x=0 ' + RNAME.charAt(c & 15);
  return '?';
}

/* ---------- числа: запись цифрами ---------- */
/* Возвращает массив кодов ячеек: [-] цифры [· цифры] [ВП [-] п п] */
function encodeNum(v){
  if(typeof v !== 'number' || !isFinite(v)) return null;

  var codes = [];
  if(v < 0){ codes.push(C.NEG); v = -v; }
  if(v === 0){ codes.push(0); return codes; }

  var useExp = (v >= 1e8 || v < 1e-2);
  var str, exp = 0;

  if(useExp){
    var m = v, e = 0;
    while(m >= 10){ m /= 10; e++; }
    while(m < 1){ m *= 10; e--; }
    if(e < -99 || e > 99) return null;
    str = m.toPrecision(MAXDIG);
    exp = e;
  }else{
    str = String(v);
    if(str.indexOf('e') >= 0) return null;
  }

  if(str.indexOf('.') >= 0) str = str.replace(/0+$/, '').replace(/\.$/, '');

  for(var i = 0; i < str.length; i++){
    var ch = str.charAt(i);
    if(ch === '.') codes.push(C.DOT);
    else if(ch >= '0' && ch <= '9') codes.push(ch.charCodeAt(0) - 48);
    else return null;
  }

  if(useExp){
    codes.push(C.EXP);
    if(exp < 0) codes.push(C.NEG);
    var a = Math.abs(exp);
    codes.push(Math.floor(a / 10));
    codes.push(a % 10);
  }
  return codes;
}

/* ---------- компиляция инструкций в ячейки ---------- */
function compile(list){
  var addr = [], errors = [], p = 0, i;

  for(i = 0; i < list.length; i++){
    addr.push(p);
    var ins = list[i];
    if(ins.jump !== undefined) p += 3;
    else if(ins.num !== undefined){
      var enc = encodeNum(ins.num);
      p += enc ? enc.length : 1;
    }else{
      p += 1;
    }
  }

  if(p > CELLS) errors.push('программа занимает ' + p + ' ячеек, а памяти всего ' + CELLS);

  var cells = [];
  for(i = 0; i < CELLS; i++) cells.push(NOP);

  for(i = 0; i < list.length; i++){
    var item = list[i], at = addr[i];
    if(at >= CELLS){ errors.push('шаг ' + i + ' не влез в память'); break; }

    if(item.jump !== undefined){
      cells[at] = item.jump;
      var to = item.to;
      var target = (typeof to === 'number' && addr[to] !== undefined) ? addr[to] : -1;
      if(target < 0){ errors.push('переход на шаг ' + to + ' — такого шага нет'); target = 0; }
      if(target > 97){ errors.push('адрес ' + target + ' больше 97'); target = 0; }
      cells[at + 1] = Math.floor(target / 10);
      cells[at + 2] = target % 10;
    }else if(item.num !== undefined){
      var codes = encodeNum(item.num);
      if(!codes){ errors.push('число ' + item.num + ' не записать'); codes = [0]; }
      for(var q = 0; q < codes.length && at + q < CELLS; q++) cells[at + q] = codes[q];
    }else{
      cells[at] = item.c;
    }
  }

  return { cells:cells, addr:addr, length:p, errors:errors };
}

/* ---------- машинка ---------- */
function norm(x){
  if(typeof x !== 'number' || isNaN(x) || !isFinite(x)) return NaN;
  if(x === 0) return 0;
  var a = Math.abs(x);
  if(a >= 1e100 || a < 1e-99) return NaN;
  return Number(x.toPrecision(MAXDIG));
}

function fmt(x){
  if(typeof x !== 'number' || isNaN(x) || !isFinite(x)) return 'ЕГГОГ';
  if(x === 0) return '0';
  var a = Math.abs(x);
  if(a >= 1e8 || a < 1e-2){
    var e = Math.floor(Math.log10(a));
    var m = x / Math.pow(10, e);
    var ms = m.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
    return ms + ' ' + (e < 0 ? '-' : ' ') + String(Math.abs(e)).padStart(2, '0');
  }
  return String(Number(x.toPrecision(MAXDIG)));
}

function Machine(cells, opts){
  opts = opts || {};
  this.cells = [];
  for(var i = 0; i < CELLS; i++) this.cells.push(typeof cells[i] === 'number' ? cells[i] : NOP);

  this.X = typeof opts.X === 'number' ? opts.X : 0;
  this.Y = 0; this.Z = 0; this.T = 0; this.X1 = 0;

  this.R = [];
  for(var r = 0; r < 14; r++) this.R.push(0);
  if(opts.R){
    for(var k in opts.R){
      if(!opts.R.hasOwnProperty(k)) continue;
      var n = Number(k);
      if(n >= 0 && n < 14) this.R[n] = Number(opts.R[k]);
    }
  }

  this.ip = 0;
  this.sub = [];
  this.err = false;
  this.stopped = false;
  this.steps = 0;
  this.typing = false;
  this.input = '';
}

Machine.prototype.shiftUp = function(){
  this.T = this.Z; this.Z = this.Y; this.Y = this.X;
};

Machine.prototype.push = function(v){
  this.shiftUp();
  this.X = norm(v);
  this.typing = false;
  this.input = '';
};

Machine.prototype.typeDigit = function(d){
  if(!this.typing){
    this.shiftUp();
    this.input = '';
    this.typing = true;
  }
  if(this.input.replace(/[^0-9]/g, '').length >= MAXDIG) return;
  this.input += String(d);
  var v = parseFloat(this.input);
  this.X = isNaN(v) ? 0 : v;
};

Machine.prototype.binary = function(fn){
  var v = norm(fn(this.Y, this.X));
  if(isNaN(v)){ this.err = true; return; }
  this.X1 = this.X;
  this.Y = this.Z;
  this.Z = this.T;
  this.X = v;
  this.typing = false;
  this.input = '';
};

Machine.prototype.unary = function(fn){
  var old = this.X;
  var v = norm(fn(this.X));
  if(isNaN(v)){ this.err = true; return; }
  this.X1 = old;
  this.X = v;
  this.typing = false;
  this.input = '';
};

Machine.prototype.digits2 = function(ip){
  var a = this.cells[(ip + 1) % CELLS];
  var b = this.cells[(ip + 2) % CELLS];
  if(a > 9 || b > 9) return -1;
  var v = a * 10 + b;
  return (v >= 0 && v <= 97) ? v : -1;
};

Machine.prototype.step = function(){
  if(this.stopped || this.err) return 'stop';

  var code = this.cells[this.ip];
  var hi = (code >> 4) & 15, lo = code & 15;

  if(code === C.SP){ this.stopped = true; return 'stop'; }
  if(code === C.VO){ this.ip = this.sub.length ? this.sub.pop() : 0; return 'jump'; }
  if(code === C.NOP){ this.ip = (this.ip + 1) % CELLS; return 'cont'; }

  if(code === C.BP || code === C.PP){
    var addr = this.digits2(this.ip);
    if(addr < 0){ this.err = true; return 'stop'; }
    if(code === C.PP) this.sub.push((this.ip + 3) % CELLS);
    this.ip = addr;
    return 'jump';
  }

  if(code === 0x57 || code === 0x59 || code === 0x5C || code === 0x5E){
    var a2 = this.digits2(this.ip);
    if(a2 < 0){ this.err = true; return 'stop'; }
    var ok = false;
    if(code === 0x57) ok = (this.X !== 0);
    else if(code === 0x59) ok = (this.X >= 0);
    else if(code === 0x5C) ok = (this.X < 0);
    else ok = (this.X === 0);
    this.ip = ok ? a2 : (this.ip + 3) % CELLS;
    return 'jump';
  }

  if(code === 0x5D || code === 0x5B || code === 0x58 || code === 0x5A){
    var a3 = this.digits2(this.ip);
    if(a3 < 0){ this.err = true; return 'stop'; }
    var rg = code === 0x5D ? 0 : (code === 0x5B ? 1 : (code === 0x58 ? 2 : 3));
    this.R[rg] = norm(this.R[rg] - 1);
    this.ip = (this.R[rg] !== 0) ? a3 : (this.ip + 3) % CELLS;
    return 'jump';
  }

  /* косвенные команды: адрес в регистре, поэтому одна ячейка */
  if(hi === 8){ this.ip = this.modAddr(this.R[lo], lo); return 'jump'; }
  if(hi === 0xA){ this.sub.push((this.ip + 1) % CELLS); this.ip = this.modAddr(this.R[lo], lo); return 'jump'; }
  if(hi === 7){ if(this.X !== 0) this.ip = this.modAddr(this.R[lo], lo); else this.ip++; return 'jump'; }
  if(hi === 9){ if(this.X >= 0) this.ip = this.modAddr(this.R[lo], lo); else this.ip++; return 'jump'; }
  if(hi === 0xC){ if(this.X < 0) this.ip = this.modAddr(this.R[lo], lo); else this.ip++; return 'jump'; }
  if(hi === 0xE){ if(this.X === 0) this.ip = this.modAddr(this.R[lo], lo); else this.ip++; return 'jump'; }

  /* обычные команды */
  if(code >= 0 && code <= 9){ this.typeDigit(code); this.ip++; return 'cont'; }
  if(code === C.DOT){
    if(!this.typing){ this.shiftUp(); this.input = ''; this.typing = true; }
    if(this.input === '') this.input = '0';
    if(this.input.indexOf('.') < 0) this.input += '.';
    this.X = parseFloat(this.input) || 0;
    this.ip++; return 'cont';
  }
  if(code === C.NEG){ this.X = -this.X; if(this.typing) this.input = String(this.X); this.ip++; return 'cont'; }
  if(code === C.EXP){ this.ip++; return 'cont'; }
  if(code === C.CX){ this.X = 0; this.typing = false; this.input = ''; this.ip++; return 'cont'; }
  if(code === C.UP){ this.shiftUp(); this.typing = false; this.input = ''; this.ip++; return 'cont'; }
  if(code === C.XV){ var t1 = this.X1; this.X1 = this.X; this.X = t1; this.ip++; return 'cont'; }

  if(code === C.ADD){ this.binary(function(a,b){ return a + b; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.SUB){ this.binary(function(a,b){ return a - b; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.MUL){ this.binary(function(a,b){ return a * b; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.DIV){ this.binary(function(a,b){ return a / b; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.SWAP){ var q = this.X; this.X = this.Y; this.Y = q; this.ip++; return 'cont'; }

  if(code === C.T10){ this.unary(function(v){ return Math.pow(10, v); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.EX){ this.unary(function(v){ return Math.exp(v); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.LG){ this.unary(function(v){ return Math.log10(v); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.LN){ this.unary(function(v){ return Math.log(v); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.SIN){ this.unary(function(v){ return Math.sin(v * Math.PI / 180); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.COS){ this.unary(function(v){ return Math.cos(v * Math.PI / 180); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.TG){ this.unary(function(v){ return Math.tan(v * Math.PI / 180); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.ASIN){ this.unary(function(v){ return Math.asin(v) * 180 / Math.PI; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.ACOS){ this.unary(function(v){ return Math.acos(v) * 180 / Math.PI; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.ATAN){ this.unary(function(v){ return Math.atan(v) * 180 / Math.PI; }); this.ip++; return this.err ? 'stop' : 'cont'; }

  if(code === C.PI){ this.push(Math.PI); this.ip++; return 'cont'; }
  if(code === C.SQRT){ this.unary(function(v){ return Math.sqrt(v); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.SQ){ this.unary(function(v){ return v * v; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.INV){ this.unary(function(v){ return 1 / v; }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.POW){ this.binary(function(a,b){ return Math.pow(a, b); }); this.ip++; return this.err ? 'stop' : 'cont'; }
  if(code === C.FO){
    var tx = this.X;
    this.X = this.Y; this.Y = this.Z; this.Z = this.T; this.T = tx;
    this.ip++; return 'cont';
  }

  if(hi === 4){ this.R[lo] = norm(this.X); this.ip++; return 'cont'; }
  if(hi === 6){ this.push(this.R[lo]); this.ip++; return 'cont'; }

  this.err = true;
  return 'stop';
};

Machine.prototype.modAddr = function(v, r){
  var a;
  if(r >= 0 && r <= 3) a = (v - 1 + 100) % 100;
  else if(r >= 4 && r <= 6) a = (v + 1) % 100;
  else a = v;
  if(a < 0 || a > 97) a = ((a % 98) + 98) % 98;
  return a;
};

Machine.prototype.run = function(maxSteps){
  var limit = maxSteps || 200000, n = 0, res;
  while(n < limit){
    res = this.step();
    this.steps++;
    n++;
    if(res === 'stop' || this.err) break;
  }
  return {
    value: this.X,
    steps: this.steps,
    err: this.err,
    stopped: this.stopped,
    infinite: (n >= limit && !this.err && !this.stopped)
  };
};

/* ---------- удобный запуск программы ---------- */
function run(list, opts){
  opts = opts || {};
  var built = compile(list);
  if(built.errors.length){
    return { value:NaN, steps:0, err:true, errors:built.errors, cells:built.length };
  }
  var m = new Machine(built.cells, opts);
  var res = m.run(opts.maxSteps || 200000);
  res.cells = built.length;
  res.errors = [];
  return res;
}

/* ---------- листинг для человека: десятичные коды, как на клавишах ---------- */
function listing(cells, length){
  var last = typeof length === 'number' ? length - 1 : CELLS - 1;
  var isAddr = {};
  for(var i = 0; i <= last; i++){
    if(isJump(cells[i])){ isAddr[i + 1] = 'десятки'; isAddr[i + 2] = 'единицы'; }
  }
  var rows = [];
  for(var k = 0; k <= last; k++){
    var c = cells[k];
    rows.push({
      addr: k,
      dec: c,
      name: isAddr[k] ? ('адрес, ' + isAddr[k]) : cmdName(c),
      isAddr: !!isAddr[k]
    });
  }
  return rows;
}

global.B3Core = {
  CELLS: CELLS,
  NOP: NOP,
  C: C,
  isJump: isJump,
  cmdName: cmdName,
  encodeNum: encodeNum,
  compile: compile,
  Machine: Machine,
  run: run,
  listing: listing,
  fmt: fmt,
  norm: norm
};

})(window);
