/* ============================================================
   Б3-34 v2 — ЭКРАН И КЛАВИАТУРА
   ------------------------------------------------------------
   Здесь только интерфейс: кнопки, индикатор, вкладки.
   Вся арифметика и исполнение программ — в core.js (B3Core).
   Список примеров — в programs.js (B3PROGS).

   В режиме ПРГ коды набираются двумя цифрами, как на настоящем
   Б3-34: жмёшь 9 и 1 — в программу идёт F L1 (код 0x5B).
   Адрес перехода тоже набирается двумя цифрами, но это НОМЕР
   ШАГА (адрес ячейки), а не номер инструкции: пересчёт делает
   ядро через compile().addr.

   Кнопки П→X и X→П работают в обоих режимах: в АВТ — выполняют
   операцию с выбранным регистром, в ПРГ — вставляют в программу
   команду с кодом 0x60+регистр или 0x40+регистр.

   ОТЛОЖЕННЫЕ ОПЕРАЦИИ (режим АВТ):
   как на настоящем Б3-34, нажатие + − × ÷ НЕ считает сразу.
   Сначала набранное число поднимается в Y, X очищается, а сама
   операция запоминается в S.pend. Она выполнится, когда нажмёшь
   следующую операцию (или С/П — он работает как «равно»).
   Поэтому 5 ÷ 2 ÷ даёт 2.5, а не 0. В программе операции,
   наоборот, выполняются немедленно — так и должно быть.

   ЕГГОГ: индикатор загорается только на настоящей ошибке
   вычисления и гаснет при Cx, при стирании программы и при
   пустом С/П. Рядом всегда написано словами, что именно
   случилось.
   ============================================================ */
(function(global){
"use strict";

var Core = global.B3Core;
var PROGS = global.B3PROGS || [];

var S = {
  tab: 'calc',
  mode: 'AUT',
  prog: [],
  buf: '',
  addr: '',
  waitAddr: 0,
  regAct: null,
  regProg: null,
  msg: '',
  errWhy: '',
  pend: null,     /* код отложенной операции (+ − × ÷ x^y) */
  fresh: false,   /* только что нажали операцию: X пуст, ввод пойдёт без подъёма */
  m: null
};

function blankCells(){
  var a = [], i;
  for(i = 0; i < Core.CELLS; i++) a.push(Core.NOP);
  return a;
}
S.m = new Core.Machine(blankCells(), {});

function $(id){ return document.getElementById(id); }

/* ---------------- причины ЕГГОГ по коду команды ---------------- */
function whyCode(code){
  if(code === 0x13 || code === 0x23) return 'деление на ноль';
  if(code === 0x21) return 'корень из отрицательного числа';
  if(code === 0x17 || code === 0x18) return 'логарифм нуля или отрицательного числа';
  if(code === 0x19 || code === 0x1A) return 'arcsin или arccos вне −1…1';
  if(code === 0x15 || code === 0x16 || code === 0x24) return 'слишком большое число';
  if(code === 0x10 || code === 0x11 || code === 0x12) return 'слишком большое число';
  if(Core.isJump(code)) return 'переход без адреса';
  return 'результат вне допустимого диапазона';
}

function clearErr(){
  if(S.m) S.m.err = false;
  S.errWhy = '';
}

/* ---------------- описание клавиатуры ---------------- */
var KEYS = [
  { title:'Числа', keys:[
    {t:'7', a:'digit', v:'7'}, {t:'8', a:'digit', v:'8'}, {t:'9', a:'digit', v:'9'},
    {t:'4', a:'digit', v:'4'}, {t:'5', a:'digit', v:'5'}, {t:'6', a:'digit', v:'6'},
    {t:'1', a:'digit', v:'1'}, {t:'2', a:'digit', v:'2'}, {t:'3', a:'digit', v:'3'},
    {t:'0', a:'digit', v:'0'}, {t:'·', a:'dot'}, {t:'/-/', a:'cmd', v:'0x0B'},
    {t:'ВП', a:'cmd', v:'0x0C'}, {t:'Cx', a:'cmd', v:'0x0D'}, {t:'В↑', a:'cmd', v:'0x0E'}
  ]},
  { title:'Арифметика', keys:[
    {t:'+', a:'cmd', v:'0x10'}, {t:'−', a:'cmd', v:'0x11'},
    {t:'×', a:'cmd', v:'0x12'}, {t:'÷', a:'cmd', v:'0x13'},
    {t:'↔', a:'cmd', v:'0x14'}, {t:'Вx', a:'cmd', v:'0x0F'}
  ]},
  { title:'Функции', keys:[
    {t:'π', a:'cmd', v:'0x20'}, {t:'√', a:'cmd', v:'0x21'},
    {t:'x²', a:'cmd', v:'0x22'}, {t:'1/x', a:'cmd', v:'0x23'},
    {t:'x^y', a:'cmd', v:'0x24'}, {t:'10^x', a:'cmd', v:'0x15'},
    {t:'e^x', a:'cmd', v:'0x16'}, {t:'lg', a:'cmd', v:'0x17'},
    {t:'ln', a:'cmd', v:'0x18'}, {t:'sin', a:'cmd', v:'0x1C'},
    {t:'cos', a:'cmd', v:'0x1D'}, {t:'tg', a:'cmd', v:'0x1E'},
    {t:'arcsin', a:'cmd', v:'0x19'}, {t:'arccos', a:'cmd', v:'0x1A'},
    {t:'arctg', a:'cmd', v:'0x1B'}
  ]},
  { title:'Регистры', keys:[
    {t:'П→X', a:'reg', v:'read'}, {t:'X→П', a:'reg', v:'write'},
    {t:'0', a:'regkey', v:'0'}, {t:'1', a:'regkey', v:'1'},
    {t:'2', a:'regkey', v:'2'}, {t:'3', a:'regkey', v:'3'},
    {t:'4', a:'regkey', v:'4'}, {t:'5', a:'regkey', v:'5'},
    {t:'6', a:'regkey', v:'6'}, {t:'7', a:'regkey', v:'7'},
    {t:'8', a:'regkey', v:'8'}, {t:'9', a:'regkey', v:'9'},
    {t:'a', a:'regkey', v:'10'}, {t:'b', a:'regkey', v:'11'},
    {t:'c', a:'regkey', v:'12'}, {t:'d', a:'regkey', v:'13'}
  ]},
  { title:'Программа', keys:[
    {t:'С/П', a:'cmd', v:'0x50'}, {t:'БП', a:'cmd', v:'0x51'},
    {t:'В/О', a:'cmd', v:'0x52'}, {t:'ПП', a:'cmd', v:'0x53'},
    {t:'НОП', a:'cmd', v:'0x54'},
    {t:'L0', a:'cmd', v:'0x5D'}, {t:'L1', a:'cmd', v:'0x5B'},
    {t:'L2', a:'cmd', v:'0x58'}, {t:'L3', a:'cmd', v:'0x5A'},
    {t:'x≠0', a:'cmd', v:'0x57'}, {t:'x≥0', a:'cmd', v:'0x59'},
    {t:'x<0', a:'cmd', v:'0x5C'}, {t:'x=0', a:'cmd', v:'0x5E'}
  ]}
];

/* ---------------- построение клавиатуры ---------------- */
function buildKeys(){
  var box = $('keys');
  if(!box) return;
  box.innerHTML = '';
  KEYS.forEach(function(g){
    var title = document.createElement('div');
    title.className = 'gtitle';
    title.textContent = g.title;
    box.appendChild(title);

    var row = document.createElement('div');
    row.className = 'krow';
    g.keys.forEach(function(k){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'key' + (k.a === 'cmd' ? ' cmd' : '') +
                    (k.a === 'reg' ? ' reg' : '') +
                    (k.a === 'regkey' ? ' regkey' : '');
      b.textContent = k.t;
      b.setAttribute('data-act', k.a);
      b.setAttribute('data-val', k.v || '');
      row.appendChild(b);
    });
    box.appendChild(row);
  });

  box.addEventListener('click', function(ev){
    var b = ev.target;
    while(b && b !== box && !(b.className && b.className.indexOf('key') === 0)){
      b = b.parentNode;
    }
    if(!b || b === box) return;
    press(b.getAttribute('data-act'), b.getAttribute('data-val'));
  });
}

/* ---------------- нажатия ---------------- */
function press(act, val){
  S.msg = '';

  /* в ПРГ ждём номер регистра для П→X / X→П */
  if(S.regProg != null && (act === 'digit' || act === 'regkey')){
    addRegCode(val);
    render();
    return;
  }
  /* любая другая кнопка отменяет это ожидание */
  if(S.regProg != null) S.regProg = null;

  if(act === 'digit' || act === 'regkey'){
    if(S.regAct){ doReg(val); render(); return; }
    if(S.mode === 'PRG'){ typeCode(val); render(); return; }
    autDigit(val);
    render();
    return;
  }

  if(act === 'dot'){
    if(S.mode === 'PRG'){ S.msg = 'в ПРГ набираются коды команд, а не числа'; render(); return; }
    autDot();
    render();
    return;
  }

  if(act === 'reg'){
    if(S.mode === 'PRG'){
      S.regProg = (val === 'read') ? 0x60 : 0x40;
      S.regAct = null;
      S.waitAddr = 0;
      S.addr = '';
      S.buf = '';
      S.msg = (val === 'read' ? 'П→X' : 'X→П') + ': выбери регистр 0…d';
      render();
      return;
    }
    S.regAct = val;
    S.msg = val === 'read' ? 'выбери регистр для П→X' : 'выбери регистр для X→П';
    render();
    return;
  }

  if(act === 'cmd'){
    var code = parseInt(val, 16);
    if(S.mode === 'PRG'){ addCode(code); render(); return; }
    exec(code);
    render();
    return;
  }
}

/* ---------------- режим АВТ: отложенные операции ---------------- */
var OPFN = {
  0x10: function(a, b){ return a + b; },
  0x11: function(a, b){ return a - b; },
  0x12: function(a, b){ return a * b; },
  0x13: function(a, b){ return a / b; },
  0x24: function(a, b){ return Math.pow(a, b); }
};

/* цифра: если только что нажали операцию, набор начинается в пустом X */
function autDigit(val){
  var m = S.m;
  if(S.fresh){
    m.X = 0;
    m.typing = true;
    m.input = '';
    S.fresh = false;
  }
  m.typeDigit(Number(val));
  S.msg = '';
}

function autDot(){
  var m = S.m;
  if(S.fresh){
    m.X = 0;
    m.typing = true;
    m.input = '';
    S.fresh = false;
  }
  typeDot();
  S.msg = '';
}

function autOp(code){
  var m = S.m;

  /* есть отложенная операция и второй операнд уже набран — считаем её */
  if(S.pend !== null && !S.fresh){
    var done = S.pend;
    m.binary(OPFN[done]);
    if(m.err){
      S.errWhy = whyCode(done);
      S.pend = null;
      S.fresh = false;
      S.msg = 'ЕГГОГ: ' + S.errWhy + ' — нажми Cx';
      return;
    }
    S.pend = code;
    S.fresh = false;
    S.msg = 'получилось ' + Core.fmt(m.X) + ' · ждёт ' + Core.cmdName(code);
    return;
  }

  /* операция нажата повторно, второй операнд ещё не введён */
  if(S.pend !== null && S.fresh){
    S.pend = code;
    S.msg = 'операция ' + Core.cmdName(code) + ': сначала введи второй операнд';
    return;
  }

  /* первая операция в цепочке: набранное число уходит в Y, X очищается */
  if(m.typing){ m.typing = false; m.input = ''; }
  m.shiftUp();
  m.X = 0;
  m.typing = false;
  m.input = '';
  S.pend = code;
  S.fresh = true;
  S.msg = Core.cmdName(code) + ': введи второй операнд · Y = ' + Core.fmt(m.Y);
}

/* завершить отложенную операцию (С/П работает как «равно») */
function finishAut(){
  var m = S.m;
  if(S.pend === null) return false;
  if(S.fresh){ S.pend = null; return false; }

  var code = S.pend;
  m.binary(OPFN[code]);
  S.pend = null;
  S.fresh = false;
  if(m.err){
    S.errWhy = whyCode(code);
    S.msg = 'ЕГГОГ: ' + S.errWhy + ' — нажми Cx';
    return true;
  }
  S.msg = 'результат: ' + Core.fmt(m.X);
  return true;
}

function typeDot(){
  var m = S.m;
  if(!m.typing){ m.shiftUp(); m.input = ''; m.typing = true; }
  if(m.input === '') m.input = '0';
  if(m.input.indexOf('.') < 0) m.input += '.';
  var v = parseFloat(m.input);
  m.X = isNaN(v) ? 0 : v;
}

function doReg(val){
  var r = Number(val);
  if(S.regAct === 'read') S.m.push(S.m.R[r]);
  else S.m.R[r] = Core.norm(S.m.X);
  S.msg = (S.regAct === 'read' ? 'П→X ' : 'X→П ') + 'R' + r;
  S.regAct = null;
  S.fresh = false;
  if(S.regAct === 'read') S.pend = null;
}

/* вставка команды обращения к регистру в программу (ПРГ) */
function addRegCode(val){
  var r = Number(val);
  var code = S.regProg + r;
  var name = Core.cmdName(code);
  if(name === '?'){ S.msg = 'кода ' + code + ' у Б3-34 нет'; S.regProg = null; return; }
  S.prog.push({ c: code });
  S.msg = 'добавлено: ' + name + ' (' + code + ')';
  S.regProg = null;
}

/* ---------------- режим АВТ: вычисления ---------------- */
function exec(code){
  var m = S.m;

  if(code === 0x50){ runProg(); return; }
  if(code === 0x0D){
    m.X = 0; m.typing = false; m.input = '';
    S.pend = null; S.fresh = false;
    clearErr();
    S.msg = 'X очищен';
    return;
  }

  if(m.err){
    S.msg = 'ЕГГОГ: ' + (S.errWhy || 'результат вне допустимого диапазона') + ' — нажми Cx';
    return;
  }

  switch(code){
    case 0x0B: m.X = -m.X; if(m.typing) m.input = String(m.X); break;
    case 0x0C: if(m.typing && m.input.indexOf('e') < 0) m.input += 'e';
               m.X = parseFloat(m.input) || 0; break;
    case 0x0E: m.shiftUp(); m.typing = false; m.input = ''; S.fresh = false; break;
    case 0x0F: var t = m.X1; m.X1 = m.X; m.X = t; S.fresh = false; break;

    case 0x10: case 0x11: case 0x12: case 0x13: case 0x24:
      autOp(code); return;

    case 0x14: var s = m.X; m.X = m.Y; m.Y = s; S.fresh = false; break;

    case 0x15: m.unary(function(v){ return Math.pow(10, v); }); S.fresh = false; break;
    case 0x16: m.unary(function(v){ return Math.exp(v); }); S.fresh = false; break;
    case 0x17: m.unary(function(v){ return Math.log(v) / Math.LN10; }); S.fresh = false; break;
    case 0x18: m.unary(function(v){ return Math.log(v); }); S.fresh = false; break;
    case 0x19: m.unary(function(v){ return Math.asin(v) * 180 / Math.PI; }); S.fresh = false; break;
    case 0x1A: m.unary(function(v){ return Math.acos(v) * 180 / Math.PI; }); S.fresh = false; break;
    case 0x1B: m.unary(function(v){ return Math.atan(v) * 180 / Math.PI; }); S.fresh = false; break;
    case 0x1C: m.unary(function(v){ return Math.sin(v * Math.PI / 180); }); S.fresh = false; break;
    case 0x1D: m.unary(function(v){ return Math.cos(v * Math.PI / 180); }); S.fresh = false; break;
    case 0x1E: m.unary(function(v){ return Math.tan(v * Math.PI / 180); }); S.fresh = false; break;

    case 0x20: m.push(Math.PI); S.fresh = false; break;
    case 0x21: m.unary(function(v){ return Math.sqrt(v); }); S.fresh = false; break;
    case 0x22: m.unary(function(v){ return v * v; }); S.fresh = false; break;
    case 0x23: m.unary(function(v){ return 1 / v; }); S.fresh = false; break;

    default:
      S.msg = 'в режиме АВТ эта команда не работает — переключись в ПРГ';
  }

  if(m.err){
    S.errWhy = whyCode(code);
    S.msg = 'ЕГГОГ: ' + S.errWhy + ' — нажми Cx';
  }
}

/* ---------------- режим ПРГ: набор программы ---------------- */
function typeCode(d){
  if(S.waitAddr){
    S.addr += d;
    if(S.addr.length === 2){
      var built = Core.compile(S.prog);
      var target = Number(S.addr);
      var idx = built.addr.indexOf(target);
      if(idx < 0){
        S.msg = 'шага с адресом ' + S.addr + ' нет — переход не записан';
      }else{
        S.prog.push({ jump: S.waitAddr, to: idx });
        S.msg = 'переход на шаг ' + S.addr + ' (адрес ячейки)';
      }
      S.waitAddr = 0;
      S.addr = '';
    }
    return;
  }

  S.buf += d;
  if(S.buf.length === 2){
    var code = Number(S.buf);
    S.buf = '';
    addCode(code);
  }
}

function addCode(code){
  if(isNaN(code) || code < 0 || code > 255){
    S.msg = 'код должен быть от 00 до 255';
    return;
  }
  if(Core.isJump(code)){
    S.waitAddr = code;
    S.addr = '';
    S.msg = Core.cmdName(code) + ': набери адрес (2 цифры)';
    return;
  }
  var name = Core.cmdName(code);
  if(name === '?'){ S.msg = 'кода ' + code + ' у Б3-34 нет'; return; }
  S.prog.push({ c: code });
  S.msg = 'добавлено: ' + name + ' (' + code + ')';
}

/* ---------------- запуск программы ---------------- */
function runProg(){
  var calc = finishAut();

  if(!S.prog.length){
    if(S.m.err){
      S.msg = 'ЕГГОГ: ' + (S.errWhy || 'результат вне допустимого диапазона') + ' — нажми Cx';
      return;
    }
    clearErr();
    S.msg = (calc ? 'результат: ' + Core.fmt(S.m.X) + '. ' : '') +
            'программы нет — набери её в режиме ПРГ или возьми пример';
    return;
  }

  var built = Core.compile(S.prog);
  if(built.errors.length){ S.msg = 'не собрать: ' + built.errors[0]; return; }

  var R = {}, i;
  for(i = 0; i < 14; i++) R[i] = S.m.R[i];

  var mach = new Core.Machine(built.cells, { X: S.m.X, R: R });
  var res = mach.run(400000);

  S.m = mach;
  S.pend = null;
  S.fresh = false;
  if(res.err){
    S.errWhy = whyCode(mach.cells[mach.ip % Core.CELLS]);
    S.msg = 'ЕГГОГ на шаге ' + mach.ip + ': ' + S.errWhy + ' — нажми Cx';
  }else if(res.infinite){
    clearErr();
    S.msg = 'программа не остановилась за ' + res.steps + ' шагов';
  }else{
    clearErr();
    S.msg = (calc ? 'результат: ' + Core.fmt(S.m.X) + '. ' : '') +
            'выполнено, шагов: ' + res.steps;
  }
}

/* ---------------- отрисовка ---------------- */
function render(){
  var disp = $('disp');
  if(disp) disp.textContent = S.m.err ? 'ЕГГОГ' : Core.fmt(S.m.X);

  var st = $('status');
  if(st){
    var p = [S.mode === 'PRG' ? 'ПРГ' : 'АВТ'];
    if(S.mode === 'PRG'){
      p.push('шагов в программе: ' + S.prog.length);
      if(S.regProg != null) p.push((S.regProg === 0x60 ? 'П→X' : 'X→П') + ': регистр?');
      else if(S.waitAddr) p.push('жду адрес: ' + (S.addr || '—'));
      else if(S.buf) p.push('код: ' + S.buf);
    }else if(S.m.err){
      p.push('ЕГГОГ — нажми Cx');
    }else if(S.pend !== null){
      p.push('Y = ' + Core.fmt(S.m.Y) + ' · ждёт: ' + Core.cmdName(S.pend));
    }
    if(S.regAct) p.push(S.regAct === 'read' ? 'П→X: регистр?' : 'X→П: регистр?');
    st.textContent = p.join(' · ');
  }

  var msg = $('msg');
  if(msg) msg.textContent = S.msg;

  var modeBtn = $('btnMode');
  if(modeBtn) modeBtn.textContent = S.mode === 'PRG' ? '→ АВТ' : '→ ПРГ';

  drawRegs();
  drawListing();
}

function drawRegs(){
  var box = $('regs');
  if(!box) return;
  box.innerHTML = '';
  for(var i = 0; i < 14; i++){
    var d = document.createElement('div');
    d.className = 'reg';
    var n = document.createElement('span');
    n.className = 'rn';
    n.textContent = 'R' + i;
    var v = document.createElement('span');
    v.className = 'rv';
    v.textContent = Core.fmt(S.m.R[i]);
    d.appendChild(n);
    d.appendChild(v);
    box.appendChild(d);
  }
}

function drawListing(){
  var box = $('listBox');
  if(!box) return;
  box.innerHTML = '';
  if(!S.prog.length){ box.style.display = 'none'; return; }
  box.style.display = '';

  var built = Core.compile(S.prog);
  var rows = Core.listing(built.cells, built.length);

  var head = document.createElement('div');
  head.className = 'lhead';
  head.textContent = 'Программа: ' + built.length + ' ячеек' +
    (built.errors.length ? ' · ' + built.errors.join('; ') : '');
  box.appendChild(head);

  var t = document.createElement('table');
  t.className = 'lst';
  var thead = document.createElement('thead');
  var trh = document.createElement('tr');
  ['Адр','Код','Команда'].forEach(function(h){
    var th = document.createElement('th');
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  t.appendChild(thead);

  var tb = document.createElement('tbody');
  rows.forEach(function(r){
    var tr = document.createElement('tr');
    if(r.isAddr) tr.className = 'addr';
    var a = document.createElement('td'); a.textContent = String(r.addr).padStart(2, '0');
    var c = document.createElement('td'); c.textContent = r.dec;
    var n = document.createElement('td'); n.textContent = r.name;
    tr.appendChild(a); tr.appendChild(c); tr.appendChild(n);
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  box.appendChild(t);
}

/* ---------------- вкладка «Программы» ---------------- */
function buildProgs(){
  var box = $('tab-progs');
  if(!box) return;
  box.innerHTML = '';

  var intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = 'Нажми «Загрузить» — программа и регистры встанут в калькулятор. ' +
                      'В листинге коды десятичные: ровно те, что набираются на клавишах.';
  box.appendChild(intro);

  PROGS.forEach(function(p){
    var card = document.createElement('div');
    card.className = 'card';

    var h = document.createElement('div');
    h.className = 'ctitle';
    h.textContent = p.title;
    card.appendChild(h);

    var info = document.createElement('div');
    info.className = 'cinfo';
    info.textContent = p.check + ' · ' + p.input;
    card.appendChild(info);

    var b = document.createElement('button');
    b.className = 'load';
    b.textContent = 'Загрузить';
    b.addEventListener('click', function(){ loadProg(p); });
    card.appendChild(b);

    box.appendChild(card);
  });
}

function loadProg(p){
  S.prog = p.code.slice();

  var R = {}, i;
  for(i = 0; i < 14; i++) R[i] = 0;
  if(p.data){
    Object.keys(p.data).forEach(function(k){ R[Number(k)] = p.data[k]; });
  }
  S.m = new Core.Machine(blankCells(), { R: R });
  S.mode = 'AUT';
  S.buf = '';
  S.addr = '';
  S.waitAddr = 0;
  S.regAct = null;
  S.regProg = null;
  S.errWhy = '';
  S.pend = null;
  S.fresh = false;
  S.msg = 'загружено: ' + p.title + '. Нажми С/П';
  setTab('calc');
}

/* ---------------- вкладка «Проверка» ---------------- */
function buildCheck(){
  var box = $('tab-check');
  if(!box) return;
  box.innerHTML = '';

  var btn = document.createElement('button');
  btn.className = 'load';
  btn.textContent = 'Прогнать проверку';
  box.appendChild(btn);

  var out = document.createElement('div');
  out.className = 'checkout';
  box.appendChild(out);

  btn.addEventListener('click', function(){
    out.innerHTML = '';
    var t = document.createElement('table');
    t.className = 'lst';
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    ['Программа','Ячеек','Ожидалось','Получилось','Шагов'].forEach(function(h){
      var th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    t.appendChild(thead);

    var tb = document.createElement('tbody');
    var bad = 0;
    PROGS.forEach(function(p){
      var res = Core.run(p.code, { R: p.data || {}, maxSteps: 400000 });
      var ok = !res.err && Math.abs(res.value - p.expect) <= Math.max(1e-6, Math.abs(p.expect) * 1e-7);
      if(!ok) bad++;

      var tr = document.createElement('tr');
      var c1 = document.createElement('td'); c1.textContent = p.title;
      var c2 = document.createElement('td'); c2.textContent = res.cells;
      var c3 = document.createElement('td'); c3.textContent = p.expect;
      var c4 = document.createElement('td'); c4.textContent = res.err ? 'ЕГГОГ' : Core.fmt(res.value);
      c4.className = ok ? 'ok' : 'bad';
      var c5 = document.createElement('td'); c5.textContent = res.steps;
      tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3); tr.appendChild(c4); tr.appendChild(c5);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    out.appendChild(t);

    var sum = document.createElement('div');
    sum.className = 'sum';
    sum.textContent = bad
      ? '⚠️ не сошлись: ' + bad + ' из ' + PROGS.length
      : '✅ все ' + PROGS.length + ' программ считаются верно';
    out.appendChild(sum);
  });
}

/* ---------------- вкладки ---------------- */
function setTab(id){
  S.tab = id;
  ['calc','progs','check'].forEach(function(t){
    var sec = $('tab-' + t);
    if(sec) sec.hidden = (t !== id);
  });
  var tabs = document.querySelectorAll('#tabs button');
  for(var i = 0; i < tabs.length; i++){
    tabs[i].className = (tabs[i].getAttribute('data-tab') === id) ? 'on' : '';
  }
}

/* ---------------- старт ---------------- */
function init(){
  buildKeys();
  buildProgs();
  buildCheck();

  var tabs = document.querySelectorAll('#tabs button');
  for(var i = 0; i < tabs.length; i++){
    (function(btn){
      btn.addEventListener('click', function(){ setTab(btn.getAttribute('data-tab')); });
    })(tabs[i]);
  }

  var mBtn = $('btnMode');
  if(mBtn) mBtn.addEventListener('click', function(){
    S.mode = (S.mode === 'PRG') ? 'AUT' : 'PRG';
    S.buf = ''; S.addr = ''; S.waitAddr = 0; S.regAct = null; S.regProg = null;
    S.pend = null; S.fresh = false;
    S.msg = S.mode === 'PRG' ? 'режим ПРГ: коды набираются двумя цифрами' : 'режим АВТ';
    render();
  });

  var cBtn = $('btnClear');
  if(cBtn) cBtn.addEventListener('click', function(){
    S.prog = []; S.buf = ''; S.addr = ''; S.waitAddr = 0; S.regProg = null;
    S.pend = null; S.fresh = false;
    clearErr();
    S.msg = 'программа стёрта, индикатор сброшен';
    render();
  });

  var rBtn = $('btnRun');
  if(rBtn) rBtn.addEventListener('click', function(){ runProg(); render(); });

  var regBtn = $('btnRegs');
  if(regBtn) regBtn.addEventListener('click', function(){
    var box = $('regs');
    if(box) box.hidden = !box.hidden;
  });

  setTab('calc');
  render();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

global.B3UI = { press: press, state: S, render: render };

})(window);
