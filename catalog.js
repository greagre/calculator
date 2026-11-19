/* ============================================================
   Б3-34 — справочник программ (вкладка «Программы»)
   Отдельный файл: движок калькулятора не трогает.
   Программа загружается в калькулятор записью состояния
   в localStorage (тот же ключ, что использует b3-34.js)
   и перезагрузкой страницы.
   Наружу отдаёт window.B334Cat — этим пользуется кнопка
   «📥 Пример…» на вкладке калькулятора.

   v2: условные переходы приведены к руководству Б3-34 —
       условие ИСТИННО -> следующая команда,
       условие ЛОЖНО -> переход по адресу.
       Из-за этого в НОД условия заменены:
       было F x=0 / F x<0, стало F x≠0 / F x≥0
       (адреса те же, длина команды та же — три шага).
       Косвенный переход 9r подписан К x≥0 (было К x≤0).
   ============================================================ */
(function(){
"use strict";

var LS_STATE = 'b334.state.v3';
var NOP = 0x54;
var REGS = '0123456789abcd';

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
  if(c >= 0x40 && c <= 0x4D) return 'X→П ' + REGS[c & 15];
  if(c >= 0x60 && c <= 0x6D) return 'П→X ' + REGS[c & 15];
  if(c >= 0x70 && c <= 0x7D) return 'К x≠0 ' + REGS[c & 15];
  if(c >= 0x80 && c <= 0x8D) return 'К БП ' + REGS[c & 15];
  if(c >= 0x90 && c <= 0x9D) return 'К x≥0 ' + REGS[c & 15];
  if(c >= 0xA0 && c <= 0xAD) return 'К ПП ' + REGS[c & 15];
  if(c >= 0xB0 && c <= 0xBD) return 'К X→П ' + REGS[c & 15];
  if(c >= 0xC0 && c <= 0xCD) return 'К x<0 ' + REGS[c & 15];
  if(c >= 0xD0 && c <= 0xDD) return 'К П→X ' + REGS[c & 15];
  if(c >= 0xE0 && c <= 0xED) return 'К x=0 ' + REGS[c & 15];
  return '?';
}

/* команды с адресом: занимают три ячейки — код и две цифры адреса */
function isJump(c){
  return c === 0x51 || c === 0x53 ||
         c === 0x57 || c === 0x59 || c === 0x5C || c === 0x5E ||
         c === 0x5D || c === 0x5B || c === 0x58 || c === 0x5A;
}

function hex2(c){
  var s = (c & 255).toString(16).toUpperCase();
  return s.length < 2 ? '0' + s : s;
}
function p2(n){ return (n < 10 ? '0' : '') + n; }

var CATS = [
  { id:'num', title:'Числа' },
  { id:'geo', title:'Геометрия' }
];

var PROGS = [

  /* ---------------- ЧИСЛА ---------------- */
  {
    id:'fact', cat:'num', icon:'📥',
    title:'n! — факториал',
    desc:'Считает факториал: 1·2·3·…·n.',
    formula:'n! = 1 · 2 · … · n',
    input:[['R0','n — целое число ≥ 1']],
    output:'X — значение n!',
    check:'n = 7 → 5040',
    data:{ 0:7 },
    note:'Цикл L1 стоит на адресе 08, адрес возврата 04 записан двумя ячейками — 09 (десятки) и 10 (единицы).',
    codes:[0x60,0x41,0x01,0x42,0x62,0x61,0x12,0x42,0x5B,0x00,0x04,0x62,0x50]
  },
  {
    id:'sum', cat:'num', icon:'➕',
    title:'Сумма 1…N',
    desc:'Сумма всех целых от 1 до N по формуле N(N+1)/2.',
    formula:'S = N · (N + 1) / 2',
    input:[['R0','N — целое число ≥ 1']],
    output:'X — сумма',
    check:'N = 10 → 55',
    data:{ 0:10 },
    note:'Без цикла: считается за один проход, поэтому мгновенно даже в темпе оригинала.',
    codes:[0x60,0x60,0x01,0x10,0x12,0x02,0x13,0x50]
  },
  {
    id:'gcd', cat:'num', icon:'🔢',
    title:'НОД четырёх чисел',
    desc:'Наибольший общий делитель чисел из R1–R4. Алгоритм Евклида вычитанием — функции остатка у Б3-34 нет.',
    formula:'НОД(a, b) = a при a = b, иначе вычитаем меньшее из большего',
    input:[['R1','a'], ['R2','b'], ['R3','c'], ['R4','d']],
    output:'X — НОД',
    check:'32, 124, 206, 1086 → 2',
    data:{ 1:32, 2:124, 3:206, 4:1086 },
    note:'Главная программа 00–14 (вызовы ПП 20), подпрограмма НОД с 20 по 40. Нужен быстрый темп: на 1086 вычитаний в оригинальном темпе уйдут минуты. Условия в подпрограмме записаны по руководству: F x≠0 и F x≥0, переход — когда условие НЕ выполняется.',
    codes:[
      0x53,0x02,0x00,
      0x63,
      0x42,
      0x53,0x02,0x00,
      0x64,
      0x42,
      0x53,0x02,0x00,
      0x61,
      0x50,
      0x54,0x54,0x54,0x54,0x54,
      0x61,
      0x62,
      0x11,
      0x57,0x04,0x00,
      0x59,0x03,0x03,
      0x41,
      0x51,0x02,0x00,
      0x62,
      0x61,
      0x11,
      0x42,
      0x51,0x02,0x00,
      0x52
    ]
  },

  /* ---------------- ГЕОМЕТРИЯ ---------------- */
  {
    id:'seg', cat:'geo', icon:'📐',
    title:'Длина отрезка',
    desc:'Расстояние между двумя точками на плоскости.',
    formula:'d = √((x₂−x₁)² + (y₂−y₁)²)',
    input:[['R1','x₂'], ['R2','x₁'], ['R3','y₂'], ['R4','y₁']],
    output:'X — длина',
    check:'(1;2) и (8;4) → 7.2801099',
    data:{ 1:8, 2:1, 3:4, 4:2 },
    note:'Переходов нет, поэтому адреса одинаковы в любом формате записи.',
    codes:[0x61,0x62,0x11,0x22,0x63,0x64,0x11,0x22,0x10,0x21,0x50]
  },
  {
    id:'geron', cat:'geo', icon:'🔺',
    title:'Формула Герона',
    desc:'Площадь треугольника по трём сторонам.',
    formula:'S = √(p(p−a)(p−b)(p−c)),  p = (a+b+c)/2',
    input:[['R1','a'], ['R2','b'], ['R3','c']],
    output:'X — площадь',
    check:'3, 4, 5 → 6',
    data:{ 1:3, 2:4, 3:5 },
    note:'Полупериметр p хранится в R4 и вызывается трижды. Переходов нет — считается мгновенно.',
    codes:[0x61,0x62,0x10,0x63,0x10,0x02,0x13,0x44,0x64,0x61,0x11,0x12,0x64,0x62,0x11,0x12,0x64,0x63,0x11,0x12,0x21,0x50]
  },
  {
    id:'circle', cat:'geo', icon:'⭕',
    title:'Площадь круга',
    desc:'Площадь круга по радиусу: πr².',
    formula:'S = π · r²',
    input:[['R1','r — радиус']],
    output:'X — площадь',
    check:'r = 2 → 12.566371',
    data:{ 1:2 },
    note:'Самая короткая программа справочника: пять шагов.',
    codes:[0x61,0x22,0x20,0x12,0x50]
  }
];

/* ---------------- листинг ---------------- */
function listing(p){
  var rows = [];
  var addrAt = {};
  for(var i = 0; i < p.codes.length; i++){
    if(isJump(p.codes[i])){
      addrAt[i + 1] = 'десятки';
      addrAt[i + 2] = 'единицы';
    }
  }
  for(var k = 0; k < p.codes.length; k++){
    var c = p.codes[k];
    if(addrAt[k]){
      rows.push({ a:k, hex:'—', dec:String(c), name:'адрес, ' + addrAt[k], addr:true });
    }else{
      rows.push({ a:k, hex:hex2(c), dec:String(c), name:cmdName(c), addr:false });
    }
  }
  return rows;
}

function listingText(p){
  var rows = listing(p);
  var out = ['=== ' + p.title + ' (' + p.codes.length + ' шагов) ==='];
  rows.forEach(function(r){
    out.push(p2(r.a) + ': ' + (r.addr ? String(r.dec) : r.hex) + '   ' + r.name);
  });
  return out.join('\n');
}

/* ---------------- отрисовка ---------------- */
var curCat = 'all';
var query = '';
var openId = null;

function el(tag, cls, text){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text !== undefined) e.textContent = text;
  return e;
}

function match(p){
  if(curCat !== 'all' && p.cat !== curCat) return false;
  if(!query) return true;
  var q = query.toLowerCase();
  if(p.title.toLowerCase().indexOf(q) >= 0) return true;
  if((p.desc || '').toLowerCase().indexOf(q) >= 0) return true;
  for(var i = 0; i < p.codes.length; i++){
    if(hex2(p.codes[i]).toLowerCase() === q) return true;
    if(cmdName(p.codes[i]).toLowerCase().indexOf(q) >= 0) return true;
  }
  return false;
}

function drawBar(){
  var bar = document.getElementById('catBar');
  if(!bar) return;
  bar.innerHTML = '';
  var all = [{ id:'all', title:'Все' }].concat(CATS);
  all.forEach(function(c){
    var b = el('button', c.id === curCat ? 'on' : '', c.title);
    b.addEventListener('click', function(){
      curCat = c.id;
      drawBar();
      drawList();
    });
    bar.appendChild(b);
  });
}

function drawList(){
  var box = document.getElementById('catList');
  if(!box) return;
  box.innerHTML = '';

  var items = PROGS.filter(match);

  var intro = el('div', 'catintro');
  intro.textContent = 'Программы записаны кодами Б3-34 с переходами в три шага — адреса совпадают с бумажным оригиналом. ' +
                      'Условие выполняется — идём дальше, не выполняется — переход по адресу. ' +
                      'Нажми на название, чтобы раскрыть листинг.';
  box.appendChild(intro);

  if(!items.length){
    box.appendChild(el('div', 'catempty', 'Ничего не нашлось. Попробуй другое слово или код команды.'));
    return;
  }

  items.forEach(function(p){
    var card = el('div', 'card' + (openId === p.id ? ' open' : ''));

    var head = el('button', 'cardhead');
    head.appendChild(el('span', 'ico', p.icon));
    var ttl = el('span', 'ttl', p.title);
    var sub = el('span', 'sub', '');
    var catTitle = '';
    CATS.forEach(function(c){ if(c.id === p.cat) catTitle = c.title; });
    sub.textContent = catTitle + ' · ' + p.codes.length + ' шагов';
    ttl.appendChild(sub);
    head.appendChild(ttl);
    head.appendChild(el('span', 'chev', openId === p.id ? '⌃' : '⌄'));
    head.addEventListener('click', function(){
      openId = (openId === p.id) ? null : p.id;
      drawList();
    });
    card.appendChild(head);

    if(openId === p.id){
      var body = el('div', 'cardbody');

      body.appendChild(el('div', 'desc', p.desc));

      if(p.formula){
        var f = el('div', 'formula', p.formula);
        body.appendChild(f);
      }

      if(p.input && p.input.length){
        body.appendChild(el('div', 'row', 'Вход:'));
        p.input.forEach(function(pair){
          body.appendChild(el('div', 'row', '   ' + pair[0] + ' — ' + pair[1]));
        });
      }
      if(p.output) body.appendChild(el('div', 'row', 'Выход: ' + p.output));

      var table = el('table', 'lst');
      var thead = el('thead');
      var trh = el('tr');
      ['Адр','Hex','Dec','Команда'].forEach(function(h){
        trh.appendChild(el('th', '', h));
      });
      thead.appendChild(trh);
      table.appendChild(thead);
      var tbody = el('tbody');
      listing(p).forEach(function(r){
        var tr = el('tr');
        tr.appendChild(el('td', 'a', p2(r.a)));
        tr.appendChild(el('td', r.addr ? 'addr' : '', r.hex));
        tr.appendChild(el('td', r.addr ? 'addr' : '', r.dec));
        tr.appendChild(el('td', r.addr ? 'addr' : '', r.name));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      body.appendChild(table);

      if(p.check) body.appendChild(el('div', 'checkline', 'Проверка: ' + p.check));
      if(p.note) body.appendChild(el('div', 'row', p.note));

      var acts = el('div', 'acts');
      var bLoad = el('button', 'load', '▶ Загрузить в калькулятор');
      bLoad.addEventListener('click', function(){ loadIntoCalc(p); });
      var bCopy = el('button', 'copy', '📋 Скопировать коды');
      bCopy.addEventListener('click', function(){ copyText(listingText(p), bCopy); });
      acts.appendChild(bLoad);
      acts.appendChild(bCopy);
      body.appendChild(acts);

      card.appendChild(body);
    }

    box.appendChild(card);
  });
}

function copyText(text, btn){
  var done = function(){
    if(!btn) return;
    var old = btn.textContent;
    btn.textContent = '✓ Скопировано';
    setTimeout(function(){ btn.textContent = old; }, 1400);
  };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done, function(){ fallback(); });
      return;
    }
  }catch(e){}
  fallback();

  function fallback(){
    try{
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    }catch(e){}
  }
}

/* ---------------- загрузка в калькулятор ---------------- */
function loadIntoCalc(p){
  var ok = true;
  try{
    ok = window.confirm('Загрузить «' + p.title + '» в калькулятор?\n\nТекущая программа в памяти будет заменена.');
  }catch(e){}
  if(!ok) return;

  var prog = new Array(98).fill(NOP);
  for(var i = 0; i < p.codes.length && i < 98; i++) prog[i] = p.codes[i];

  var st = {};
  try{
    var raw = localStorage.getItem(LS_STATE);
    if(raw) st = JSON.parse(raw) || {};
  }catch(e){ st = {}; }
  if(typeof st !== 'object' || st === null) st = {};

  st.prog = prog;
  if(p.data){
    var R = new Array(14).fill(0);
    if(Array.isArray(st.R)){
      for(var j = 0; j < 14; j++){
        if(typeof st.R[j] === 'number') R[j] = st.R[j];
      }
    }
    Object.keys(p.data).forEach(function(k){ R[Number(k)] = p.data[k]; });
    st.R = R;
  }
  st.fast = true;

  try{
    localStorage.setItem(LS_STATE, JSON.stringify(st));
  }catch(e){
    alert('Не удалось записать программу в память браузера.');
    return;
  }

  showCalcTab();
  location.reload();
}

function showCalcTab(){
  var tc = document.getElementById('tabCalc');
  var tk = document.getElementById('tabCatalog');
  if(tc) tc.style.display = '';
  if(tk) tk.style.display = 'none';
}

/* ---------------- старт ---------------- */
function init(){
  var search = document.getElementById('catSearch');
  if(search){
    search.addEventListener('input', function(){
      query = String(this.value || '').trim();
      drawList();
    });
  }
  drawBar();
  drawList();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

/* Публичный интерфейс для кнопки «📥 Пример…» на вкладке калькулятора */
window.B334Cat = {
  progs: PROGS,
  load: loadIntoCalc,
  listing: listingText
};

})();
