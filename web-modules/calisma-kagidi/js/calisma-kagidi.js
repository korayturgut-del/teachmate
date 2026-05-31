/* ============================================================
   ÇALIŞMA KAĞIDI MODÜLÜ JS — Kelebek Platform V2
   Bağımsız çalışabilir. Ortak: ../shared/js/*
   Orijinalden birebir kopya: worksheet.js + exam-groups.js + zkitap.js + print.js
   ============================================================ */

// ── Cross-module stubs (bağımsızlık için) ──
function renderKChecks(){}   // Kelebek dağıtım stub
function renderQuestions(){}  // Ana editör stub
function updatePts(){}        // Ana editör puan stub
function renderPrintSummary(){} // Sınav özet stub
if(!window.cssAutoUpload) window.cssAutoUpload=function(){};
if(!window.cssUploadStudentsToCloud) window.cssUploadStudentsToCloud=function(){};

// ── State ──
var _activeQId = null;
var _isCalismaModu = true;
var _weSavedRange = null;
var _qeditFullscreen = false;
var calismaCnt = 0;
var currentCalismaName = '';

// ============================================================
// MATEMATİK SEMBOL EKLEYİCİLER
// ============================================================
const SYM_SETS ={
  mat:[
    {s:'±'},{s:'×'},{s:'÷'},{s:'≠'},{s:'≤'},{s:'≥'},{s:'≈'},{s:'∞'},
    {s:'√'},{s:'∛'},{s:'½'},{s:'¼'},{s:'¾'},
    {s:'∑'},{s:'∫'},{s:'∂'},{s:'→'},{s:'←'},{s:'↔'},
    {s:'f(x)'},{s:'g(x)'},{s:'h(x)'},
    {lim:true},{logb:true},{eb:true},
    {s:'ln'},{s:'sin'},{s:'cos'},{s:'tan'},{s:'arcsin'},{s:'arccos'},{s:'arctan'},
    {s:'∈'},{s:'∉'},{s:'∪'},{s:'∩'},
    {k:'frac'},{g:true},
  ],
  fiz:[
    {s:'α'},{s:'β'},{s:'γ'},{s:'θ'},{s:'λ'},{s:'μ'},{s:'σ'},{s:'ω'},{s:'φ'},
    {s:'Δ'},{s:'δ'},{s:'π'},{s:'ρ'},{s:'τ'},{s:'η'},{s:'ε'},{s:'κ'},{s:'ν'},
    {s:'⊥'},{s:'∥'},{s:'∠'},{s:'°'},
    {s:'N'},{s:'J'},{s:'W'},{s:'Pa'},{s:'Hz'},{s:'m/s'},{s:'m/s²'},{s:'Ω'},{s:'T'},{s:'V'},{s:'A'},{s:'C'},{s:'F'},
    {s:'g=10 m/s²'},{s:'c=3×10⁸ m/s'},{s:'h=6.63×10⁻³⁴ J·s'},
  ],
  kim:[
    {s:'→'},{s:'⇌'},{s:'↑'},{s:'↓'},
    {s:'H₂O'},{s:'CO₂'},{s:'O₂'},{s:'H₂'},{s:'NaCl'},{s:'H₂SO₄'},{s:'HCl'},{s:'NaOH'},
    {s:'⁺'},{s:'⁻'},{s:'ΔH'},{s:'pH'},{s:'mol'},{s:'M'},
    {atom:true},
  ]
};

// ============================================================
// WORD PROCESSOR FUNCTIONS
// ============================================================
function weSave(){
  const sel=window.getSelection();
  if(sel&&sel.rangeCount)_weSavedRange=sel.getRangeAt(0).cloneRange();
}
function weExec(cmd,val){
  const we=H('we-area');if(!we)return;
  we.focus();
  if(cmd==='fontSize'){
    weApplyFontSize(val);
  } else {
    document.execCommand(cmd,false,val||null);
  }
}

function weApplyFontSize(ptValue){
  const we=H('we-area');if(!we)return;
  const range =_weSavedRange;
  if(!range){
    we.focus();
    return;
  }
  const sel=window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  we.focus();
  if(!range.collapsed){
    const span=document.createElement('span');
    span.style.fontSize=ptValue+'pt';
    try{
      const contents=range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      const newRange=document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      _weSavedRange=newRange.cloneRange();
    }catch(e){
      console.error('Font size error:',e);
    }
  } else {
    const span=document.createElement('span');
    span.style.fontSize=ptValue+'pt';
    span.innerHTML='&#8203;';
    range.insertNode(span);
    range.setStartAfter(span);
    range.setEndAfter(span);
    sel.removeAllRanges();
    sel.addRange(range);
    _weSavedRange=range.cloneRange();
  }
  qeditSaveText();
}

function weTabSwitch(type,e){
  if(e)e.preventDefault();
  ['mat','fiz','kim'].forEach(t=>{
    const btn=H('we-tab-'+t);
    if(btn)btn.className='we-tab'+(t===type?' on':'');
  });
  const syms=SYM_SETS[type]||[];
  const cont=H('we-sym-btns');if(!cont)return;
  cont.innerHTML=syms.map(sym=>{
    if(sym.g)return'<button class="we-btn" onclick="weOpenGraph()" style="color:var(--blue);font-weight:700;font-size:.72rem" data-tip="Fonksiyon grafiği">📈 Grafik</button>';
    if(sym.k==='frac')return'<button class="we-btn" onclick="weInsertFrac()" style="color:var(--blue);font-weight:800" data-tip="Kesir ekle">a/b</button>';
    if(sym.atom)return'<button class="we-btn" onclick="weInsertAtom()" style="color:var(--green);font-weight:700;font-size:.72rem" data-tip="Atom gösterimi">ᴬ_Z X</button>';
    if(sym.lim)return'<button class="we-btn" onclick="weInsertLim()" style="color:var(--blue);font-weight:700" data-tip="Limit (lim x→0)">lim<sub style=\'font-size:.6em\'>x→</sub></button>';
    if(sym.logb)return'<button class="we-btn" onclick="weInsertLogBase()" style="color:var(--blue);font-weight:700" data-tip="Logaritma tabanı">log<sub style=\'font-size:.6em\'>a</sub></button>';
    if(sym.eb)return'<button class="we-btn" onclick="weInsertExp()" style="color:var(--blue);font-weight:700" data-tip="e üzeri x">e<sup style=\'font-size:.6em\'>x</sup></button>';
    return'<button class="we-sym-btn we-btn" data-sym="'+sym.s.replace(/"/g,'&quot;')+'" style="font-size:.7rem">'+sym.s+'</button>';
  }).join('');
}

// ── Event delegation for sym buttons ──
document.addEventListener('mousedown',function(e){
  const btn=e.target.closest('.we-sym-btn');
  if(!btn)return;
  e.preventDefault();
  const sym=btn.dataset.sym;if(!sym)return;
  const we=H('we-area');if(!we)return;
  we.focus();
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(ex){}}
  document.execCommand('insertText',false,sym);
  const s=window.getSelection();if(s&&s.rangeCount)_weSavedRange=s.getRangeAt(0).cloneRange();
});

document.addEventListener('selectionchange',function(){
  const we=H('we-area');if(!we)return;
  const sel=window.getSelection();if(!sel||!sel.rangeCount)return;
  const node=sel.getRangeAt(0).startContainer;
  if(we.contains(node))_weSavedRange=sel.getRangeAt(0).cloneRange();
});

function weHandlePaste(e){
  const items=e.clipboardData&&e.clipboardData.items;
  if(!items)return;
  for(var i=0;i<items.length;i++){
    if(items[i].type.startsWith('image/')){
      e.preventDefault();
      const blob=items[i].getAsFile();
      const reader=new FileReader();
      reader.onload=ev=>{
        const img=document.createElement('img');
        img.src=ev.target.result;img.className='we-inline-img';
        img.style.cssText='display:block;margin:4px 0;max-width:100%;border:2px dashed #3fb950;border-radius:4px;cursor:pointer';
        img.title='Tıkla → çizim aracını aç';
        img.addEventListener('click',function(){drawOnImg(this);});
        const sel=window.getSelection();
        if(sel&&sel.rangeCount){const r=sel.getRangeAt(0);r.collapse(false);r.insertNode(img);}
        qeditSaveText();
      };reader.readAsDataURL(blob);
      return;
    }
  }
}

function weBindImgHandlers(){
  const we=H('we-area');if(!we)return;
  we.querySelectorAll('img.we-inline-img,img').forEach(img=>{
    if(img._bound)return;
    img._bound=true;
    img.addEventListener('click',function(e){if(!img._dragged)drawOnImg(this);img._dragged=false;});
    img.setAttribute('draggable','true');
    img.addEventListener('dragstart',function(e){
      img._dragged=true;
      e.dataTransfer.effectAllowed='move';
      we.dataset.dragSrc=Array.from(we.querySelectorAll('img')).indexOf(img);
    });
    img.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='move';img.style.outline='2px solid var(--blue)';});
    img.addEventListener('dragleave',function(){img.style.outline='';});
    img.addEventListener('drop',function(e){
      e.preventDefault();img.style.outline='';
      const srcIdx=parseInt(we.dataset.dragSrc);
      const imgs=Array.from(we.querySelectorAll('img'));
      const tgtIdx=imgs.indexOf(img);
      if(srcIdx===tgtIdx||isNaN(srcIdx))return;
      const srcEl=imgs[srcIdx];
      if(srcIdx<tgtIdx)img.parentNode.insertBefore(srcEl,img.nextSibling);
      else img.parentNode.insertBefore(srcEl,img);
      qeditSaveText();
    });
  });
}

// ============================================================
// KESİR
// ============================================================
function weInsertFrac(){
  var ex=H('frac-modal');if(ex)ex.remove();
  const modal=document.createElement('div');
  modal.id='frac-modal';modal.className='modal-overlay';
  modal.innerHTML='<div class="modal-box">'
    +'<div class="modal-hd">'
    +'<span style="font-weight:800;color:var(--blue)">a/b — Kesir Oluştur</span>'
    +'<button class="btn btn-ghost btn-xs ml-a" onclick="H(\'frac-modal\').remove()">✕</button>'
    +'</div>'
    +'<div class="modal-bd">'
    +'<div style="text-align:center;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:12px;font-size:1.2em">'
    +'<span id="fp-pay" style="display:inline-block;padding:0 8px;border-bottom:2px solid var(--text)"></span><br>'
    +'<span id="fp-payda" style="display:inline-block;padding:0 8px"></span>'
    +'</div>'
    +'<div style="margin-bottom:10px;padding:6px;background:var(--bg0);border-radius:6px">'
    +'<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px">'
    +'<span style="font-size:.65rem;color:var(--text3);width:24px;padding-top:5px">Üs:</span>'
    +['²','³','⁴','⁵','⁶','ⁿ','⁰','¹','⁺','⁻'].map(function(s){return'<button class="we-btn frac-sym" data-s="'+s+'" style="font-size:.82rem">'+s+'</button>';}).join('')
    +'</div>'
    +'<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px">'
    +'<span style="font-size:.65rem;color:var(--text3);width:24px;padding-top:5px">Alt:</span>'
    +['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','₊','₋'].map(function(s){return'<button class="we-btn frac-sym" data-s="'+s+'" style="font-size:.82rem">'+s+'</button>';}).join('')
    +'</div>'
    +'<div style="display:flex;gap:3px;flex-wrap:wrap">'
    +'<span style="font-size:.65rem;color:var(--text3);width:24px;padding-top:5px">Sym:</span>'
    +['√','∛','∜','(',')','+','-','×','÷','π','θ','α','β','Δ','∞','±','°'].map(function(s){return'<button class="we-btn frac-sym" data-s="'+s+'" style="font-size:.82rem">'+s+'</button>';}).join('')
    +'</div>'
    +'</div>'
    +'<div style="margin-bottom:8px">'
    +'<label class="lbl" style="color:var(--blue)">▲ Pay (üst)</label>'
    +'<div id="frac-pay" contenteditable="true" style="min-height:36px;background:var(--bg0);border:2px solid var(--blue);border-radius:6px;padding:6px 10px;color:#111;background:#fff;font-family:\'Times New Roman\',serif;font-size:1rem;outline:none" oninput="fracPreview()" onfocus="fracFocus(\'pay\')"></div>'
    +'</div>'
    +'<div style="text-align:center;color:var(--text3);margin:-2px 0;font-size:1.2em">──────</div>'
    +'<div>'
    +'<label class="lbl" style="color:var(--blue)">▼ Payda (alt)</label>'
    +'<div id="frac-payda" contenteditable="true" style="min-height:36px;background:var(--bg0);border:2px solid var(--blue);border-radius:6px;padding:6px 10px;color:#111;background:#fff;font-family:\'Times New Roman\',serif;font-size:1rem;outline:none" oninput="fracPreview()" onfocus="fracFocus(\'payda\')"></div>'
    +'</div>'
    +'<div class="mt2" style="font-size:.75rem;color:var(--text3)">💡 <b>Örnek: 1/√x³</b> → Pay: 1 | Payda: √ tıkla, x yaz, ³ tıkla</div>'
    +'</div>'
    +'<div class="modal-ft">'
    +'<button class="btn btn-primary" onclick="fracInsert()">✅ Ekle</button>'
    +'<button class="btn btn-ghost" onclick="H(\'frac-modal\').remove()">İptal</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
  modal.addEventListener('mousedown',function(e){
    const btn=e.target.closest('.frac-sym');if(!btn)return;
    e.preventDefault();
    const sym=btn.dataset.s;
    const target=_fracFocus==='payda'?H('frac-payda'):H('frac-pay');
    if(!target)return;
    target.focus();
    if(_fracRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_fracRange);}catch(ex){}}
    document.execCommand('insertText',false,sym);
    const s=window.getSelection();if(s&&s.rangeCount)_fracRange=s.getRangeAt(0).cloneRange();
    fracPreview();
  },true);
  setTimeout(function(){H('frac-pay')&&H('frac-pay').focus();},80);
}
var _fracFocus='pay',_fracRange=null;
function fracFocus(w){_fracFocus=w;const el=H('frac-'+w);const s=window.getSelection();if(s&&s.rangeCount&&el&&el.contains(s.getRangeAt(0).startContainer))_fracRange=s.getRangeAt(0).cloneRange();}
document.addEventListener('selectionchange',function(){
  const pay=H('frac-pay'),payda=H('frac-payda');if(!pay&&!payda)return;
  const sel=window.getSelection();if(!sel||!sel.rangeCount)return;
  const node=sel.getRangeAt(0).startContainer;
  if(pay&&pay.contains(node)){_fracFocus='pay';_fracRange=sel.getRangeAt(0).cloneRange();}
  else if(payda&&payda.contains(node)){_fracFocus='payda';_fracRange=sel.getRangeAt(0).cloneRange();}
});
function fracPreview(){
  const fp=H('fp-pay'),fpd=H('fp-payda');
  if(fp)fp.innerHTML=H('frac-pay')?H('frac-pay').innerHTML:'&nbsp;';
  if(fpd)fpd.innerHTML=H('frac-payda')?H('frac-payda').innerHTML:'&nbsp;';
}
function fracInsert(){
  const pay=H('frac-pay'),payda=H('frac-payda');if(!pay||!payda)return;
  const html='<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 3px;font-size:.95em;line-height:1.1">'
    +'<span style="padding:0 4px;border-bottom:1.5px solid currentColor">'+pay.innerHTML+'</span>'
    +'<span style="padding:0 4px">'+payda.innerHTML+'</span>'+'</span>';
  H('frac-modal').remove();
  const we=H('we-area');if(!we)return;
  we.focus();
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(ex){}}
  const sentinel='<span id="frac-cur">\u200B</span>';
  document.execCommand('insertHTML',false,html+sentinel);
  const cur=we.querySelector('#frac-cur');
  if(cur){const r=document.createRange(),s=window.getSelection();r.setStartAfter(cur);r.collapse(true);s.removeAllRanges();s.addRange(r);cur.replaceWith(document.createTextNode('\u200B'));}
  qeditSaveText();
}

// ============================================================
// ATOM GÖSTERİMİ
// ============================================================
function weInsertAtom(){
  const A=prompt('Kütle Numarası (A) — sol üst:','23');if(A===null)return;
  const Z=prompt('Atom Numarası (Z) — sol alt:','11');if(Z===null)return;
  const sym=prompt('Element sembolü:','Na');if(!sym)return;
  const val=prompt('Değerlik/Yük (örn: +, 2+, -, boş=yok):','');if(val===null)return;
  const leftCol=(A||Z)?
    '<span style="display:flex;flex-direction:column;justify-content:space-between;font-size:.65em;margin-right:1px;line-height:1.15;align-self:stretch">'+
    '<span style="align-self:flex-end">'+(A||'&nbsp;')+'</span><span style="align-self:flex-end">'+(Z||'&nbsp;')+'</span></span>':'';
  const html='<span style="display:inline-flex;align-items:stretch;vertical-align:middle;margin:0 2px">'+
    leftCol+'<span style="font-weight:700;align-self:center">'+sym+'</span>'+
    (val?'<span style="font-size:.65em;align-self:flex-start;margin-left:1px">'+val+'</span>':'')+'</span>';
  const we=H('we-area');if(!we)return;
  we.focus();
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(ex){}}
  const sentinel='<span id="atom-cur">\u200B</span>';
  document.execCommand('insertHTML',false,html+sentinel);
  const cur=we.querySelector('#atom-cur');
  if(cur){const r=document.createRange(),s=window.getSelection();r.setStartAfter(cur);r.collapse(true);s.removeAllRanges();s.addRange(r);cur.replaceWith(document.createTextNode('\u200B'));}
  qeditSaveText();
}

// ============================================================
// LİMİT / LOGARİTMA / EXP
// ============================================================
function weInsertLim(){
  const sub=prompt('Alt sınır (örn: x→0, n→∞):','x→0');
  if(sub===null)return;
  const html='<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:bottom;margin:0 2px">'
    +'<span style="font-weight:700">lim</span>'
    +'<span style="font-size:.62em;line-height:1">'+(sub||'')+'</span>'
    +'</span>';
  weInsertHTML(html);
}
function weInsertLogBase(){
  const base=prompt('Logaritma tabanı:','a');
  if(base===null)return;
  const html='log<sub>'+base+'</sub>';
  weInsertHTML(html);
}
function weInsertExp(){
  const exp=prompt('Üs (örn: x, 2, n+1):','x');
  if(exp===null)return;
  const html='e<sup>'+exp+'</sup>';
  weInsertHTML(html);
}
function weInsertHTML(html){
  const we=H('we-area');if(!we)return;
  we.focus();
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(e){}}
  document.execCommand('insertHTML',false,html+'​');
  const s=window.getSelection();if(s&&s.rangeCount)_weSavedRange=s.getRangeAt(0).cloneRange();
  qeditSaveText();
}

// ============================================================
// GRAFİK
// ============================================================
function weOpenGraph(){
  const ex=H('graph-modal');if(ex){ex.remove();return;}
  const modal=document.createElement('div');
  modal.id='graph-modal';modal.className='modal-overlay';
  const gModalHTML ='<div class="modal-box" style="width:min(640px,96vw)">'
    +'<div class="modal-hd">'
    +'<span style="font-weight:800;color:var(--blue)">📈 Fonksiyon Grafiği</span>'
    +'<button class="btn btn-ghost btn-xs ml-a" onclick="H(\'graph-modal\').remove()">✕</button>'
    +'</div>'
    +'<div class="modal-bd">'
    +'<div class="fg-2 fg" style="gap:8px;margin-bottom:10px">'
    +'<div>'
    +'<label class="lbl">f(x) = <span style="color:var(--text3);font-weight:400">(her satıra bir fonksiyon)</span></label>'
    +'<textarea id="gfn-input" class="inp" rows="4" placeholder="sin(x)" style="font-family:var(--mono);font-size:.85rem;resize:vertical"></textarea>'
    +'</div>'
    +'<div class="fg" style="gap:6px">'
    +'<div class="fg-2 fg" style="gap:6px">'
    +'<div><label class="lbl">x min</label><input class="inp inp-sm" id="gx-min" value="-6" type="number" step="0.5"></div>'
    +'<div><label class="lbl">x max</label><input class="inp inp-sm" id="gx-max" value="6" type="number" step="0.5"></div>'
    +'<div><label class="lbl">y min</label><input class="inp inp-sm" id="gy-min" value="-4" type="number" step="0.5"></div>'
    +'<div><label class="lbl">y max</label><input class="inp inp-sm" id="gy-max" value="4" type="number" step="0.5"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<label class="cbwrap" style="font-size:.78rem"><input type="checkbox" id="g-grid" checked> Izgara</label>'
    +'<label class="cbwrap" style="font-size:.78rem"><input type="checkbox" id="g-axes" checked> Eksenler</label>'
    +'<label class="cbwrap" style="font-size:.78rem"><input type="checkbox" id="g-labels" checked> Etiketler</label>'
    +'</div>'
    +'<div style="display:flex;gap:4px;flex-wrap:wrap" id="g-presets">'
    +'<span style="font-size:.72rem;color:var(--text3)">Şablon:</span>'
    +'</div>'
    +'</div></div>'
    +'<div style="text-align:center;margin-bottom:8px">'
    +'<button class="btn btn-primary" onclick="drawGraph()">▶ Çiz</button>'
    +'</div>'
    +'<canvas id="graph-canvas" width="560" height="320" style="width:100%;border:1px solid #30363d;border-radius:6px;background:#fff;display:block"></canvas>'
    +'<div id="graph-err" style="color:#ef4444;font-size:.75rem;margin-top:4px"></div>'
    +'</div>'
    +'<div class="modal-ft">'
    +'<button class="btn btn-primary" onclick="graphInsert()">✅ Ekle</button>'
    +'<button class="btn btn-ghost" onclick="H(\'graph-modal\').remove()">İptal</button>'
    +'</div>'
    +'</div>';
  modal.innerHTML=gModalHTML;
  document.body.appendChild(modal);
  modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
  // Presets
  const presets=['sin(x)','cos(x)','tan(x)','x^2','sqrt(x)','1/x','e^x','ln(x)','abs(x)','floor(x)'];
  const pw=H('g-presets');if(pw){
    presets.forEach(function(fn){
      const b=document.createElement('button');b.className='we-btn';b.textContent=fn;b.style.cssText='font-family:var(--mono);font-size:.7rem';
      b.onclick=function(){const ta=H('gfn-input');if(ta)ta.value+=fn+'\n';};
      pw.appendChild(b);
    });
  }
  setTimeout(function(){const ta=H('gfn-input');if(ta)ta.focus();},80);
}

function drawGraph(){
  const canvas=H('graph-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const errEl=H('graph-err');if(errEl)errEl.textContent='';
  const fnText=(H('gfn-input')?.value||'sin(x)').trim();
  const xMin=parseFloat(H('gx-min')?.value)||-6;
  const xMax=parseFloat(H('gx-max')?.value)||6;
  const yMin=parseFloat(H('gy-min')?.value)||-4;
  const yMax=parseFloat(H('gy-max')?.value)||4;
  const showGrid=H('g-grid')?.checked!==false;
  const showAxes=H('g-axes')?.checked!==false;
  const showLabels=H('g-labels')?.checked!==false;
  const W=canvas.width,H2=canvas.height;
  const xScale=W/(xMax-xMin),yScale=H2/(yMax-yMin);
  function toX(px){return xMin+px/xScale;}
  function toY(py){return yMax-py/yScale;}
  function toPx(x){return(x-xMin)*xScale;}
  function toPy(y){return(yMax-y)*yScale;}
  ctx.clearRect(0,0,W,H2);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H2);
  // Grid
  if(showGrid){
    ctx.strokeStyle='#e5e7eb';ctx.lineWidth=0.5;
    for(var x=Math.ceil(xMin);x<=xMax;x++){const px=toPx(x);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,H2);ctx.stroke();}
    for(var y=Math.ceil(yMin);y<=yMax;y++){const py=toPy(y);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(W,py);ctx.stroke();}
  }
  // Axes
  if(showAxes){
    ctx.strokeStyle='#333';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,toPy(0));ctx.lineTo(W,toPy(0));ctx.stroke();
    ctx.beginPath();ctx.moveTo(toPx(0),0);ctx.lineTo(toPx(0),H2);ctx.stroke();
    // Axis arrows
    ctx.fillStyle='#333';
    const ox=toPx(0),oy=toPy(0);
    ctx.beginPath();ctx.moveTo(W-10,oy-5);ctx.lineTo(W,oy);ctx.lineTo(W-10,oy+5);ctx.fill();
    ctx.beginPath();ctx.moveTo(ox-5,10);ctx.lineTo(ox,0);ctx.lineTo(ox+5,10);ctx.fill();
  }
  // Labels
  if(showLabels){
    ctx.fillStyle='#666';ctx.font='10px sans-serif';
    for(var x=Math.ceil(xMin);x<=xMax;x++){if(x!==0){const px=toPx(x),oy=toPy(0);ctx.fillText(x,px-6,oy+14);}}
    for(var y=Math.ceil(yMin);y<=yMax;y++){if(y!==0){const ox=toPx(0),py=toPy(y);ctx.fillText(y,ox+6,py+4);}}
  }
  // Functions
  const fns=fnText.split('\n').filter(Boolean);
  const colors=['#2563eb','#dc2626','#16a34a','#ca8a04','#9333ea','#06b6d4'];
  var fnIdx=0;
  fns.forEach(function(fnStr){
    fnStr=fnStr.trim();if(!fnStr)return;
    const idx=fnIdx++;const color=colors[idx%colors.length];
    try{
      const compiled=new Function('x','with(Math){return '+fnStr.replace(/\^/g,'**')+';}');
      ctx.strokeStyle=color;ctx.lineWidth=2;
      ctx.beginPath();
      var firstPoint=true;
      for(var px=0;px<=W;px+=1){
        const x=toX(px);
        try{
          const y=compiled(x);
          if(isNaN(y)||!isFinite(y)){firstPoint=true;continue;}
          const py=toPy(y);
          if(Math.abs(py-toPy(0))>H2*10){firstPoint=true;continue;}
          if(firstPoint){ctx.moveTo(px,py);firstPoint=false;}
          else ctx.lineTo(px,py);
        }catch(e){firstPoint=true;}
      }
      ctx.stroke();
    }catch(e){
      if(errEl)errEl.textContent+='⚠️ '+fnStr+': '+e.message+'\n';
    }
  });
}

function graphInsert(){
  const canvas=H('graph-canvas');if(!canvas)return;
  const src=canvas.toDataURL('image/png');
  const we=H('we-area');if(!we)return;
  we.focus();
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(ex){}}
  document.execCommand('insertHTML',false,'<img src="'+src+'" class="we-inline-img" style="display:block;margin:6px 0;border:2px dashed #3fb950;border-radius:4px;cursor:pointer;max-width:100%" title="Tıkla → çiz">');
  H('graph-modal').remove();
  qeditSaveText();
}

// ============================================================
// BOŞ ÇİZİM ALANI
// ============================================================
function idOpenBlank(){
  const sizeStr=prompt('Çizim alanı boyutu:\n400×280 (orta) | 500×350 (büyük) | 320×200 (küçük)','400×280');
  if(!sizeStr)return;
  const parts=sizeStr.replace('x','×').split('×');
  const W=Math.min(Math.max(parseInt(parts[0])||400,100),800);
  const H2=Math.min(Math.max(parseInt(parts[1])||280,80),600);
  const we=H('we-area');if(!we)return;
  we.focus();
  const c=document.createElement('canvas');c.width=W;c.height=H2;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H2);
  ctx.strokeStyle='#ccc';ctx.lineWidth=1;ctx.strokeRect(.5,.5,W-1,H2-1);
  const src=c.toDataURL('image/png');
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(ex){}}
  document.execCommand('insertHTML',false,'<img src="'+src+'" class="we-inline-img" style="display:block;margin:6px 0;border:2px dashed #3fb950;border-radius:4px;cursor:pointer;max-width:100%" title="Tıkla → çiz">');
  qeditSaveText();
  setTimeout(function(){const imgs=we.querySelectorAll('img.we-inline-img');if(imgs.length)drawOnImg(imgs[imgs.length-1]);},80);
}

// ============================================================
// RESİM ÜZERİNE ÇİZİM (FABRIC.JS)
// ============================================================
const FE = {
  canvas: null,
  imgEl: null,
  tool: 'select',
  color: '#e11d48',
  strokeW: 3,
  customShapes: []
};
const A4_W = 794, A4_H = 1123;

function drawOnImg(imgEl) {
  if (H('draw-modal')) return;
  FE.imgEl = imgEl;
  FE.tool = 'select';

  const modal = document.createElement('div');
  modal.id = 'draw-modal';
  modal.innerHTML = '<div id="draw-editor">'
    +'<div id="draw-sidebar">'
    +'<div class="dcat"><div class="dcat-title">🖱️ Araçlar</div>'
    +'<div class="dgrid">'
    +'<button class="dbtn active" data-t="select" onclick="feT(\'select\')">↖ Seç</button>'
    +'<button class="dbtn" data-t="pencil" onclick="feT(\'pencil\')">✏️ Kalem</button>'
    +'<button class="dbtn" data-t="eraser" onclick="feT(\'eraser\')">🧹 Silgi</button>'
    +'<button class="dbtn" data-t="text" onclick="feT(\'text\')">T Metin</button>'
    +'</div></div>'
    +'<div class="dcat"><div class="dcat-title">⬜ Temel</div>'
    +'<div class="dgrid">'
    +'<button class="dbtn" data-t="rect" onclick="feT(\'rect\')">▭ Kutu</button>'
    +'<button class="dbtn" data-t="circle" onclick="feT(\'circle\')">○ Daire</button>'
    +'<button class="dbtn" data-t="line" onclick="feT(\'line\')">╱ Çizgi</button>'
    +'<button class="dbtn" data-t="arrow" onclick="feT(\'arrow\')">→ Ok</button>'
    +'</div></div>'
    +'<div class="dcat"><div class="dcat-title">📐 Matematik</div>'
    +'<div class="dgrid" id="dg-math">'
    +'<button class="dbtn" onclick="feS(\'numberLine\')">⟷ SayıD</button>'
    +'<button class="dbtn" onclick="feS(\'coordSystem\')">📈 Eksen</button>'
    +'<button class="dbtn" onclick="feS(\'fraction\')">⁄ Kesir</button>'
    +'<button class="dbtn" onclick="feS(\'sqrt\')">√ Kök</button>'
    +'</div></div>'
    +'<div class="dcat"><div class="dcat-title">📐 Geometri</div>'
    +'<div class="dgrid">'
    +'<button class="dbtn" onclick="feS(\'triangle\')">△ Üçgen</button>'
    +'<button class="dbtn" onclick="feS(\'rightTri\')">◿ DikÜçg</button>'
    +'<button class="dbtn" onclick="feS(\'parallel\')">▱ Paralel</button>'
    +'<button class="dbtn" onclick="feS(\'trapez\')">⏢ Yamuk</button>'
    +'<button class="dbtn" onclick="feS(\'pentagon\')">⬠ Beşgen</button>'
    +'<button class="dbtn" onclick="feS(\'hexagon\')">⬡ Altıgen</button>'
    +'</div></div>'
    +'<div class="dcat"><div class="dcat-title">➡️ Vektör</div>'
    +'<div class="dgrid">'
    +'<button class="dbtn" onclick="feS(\'vecF\')" style="color:#e11d48">→ Kuvvet</button>'
    +'<button class="dbtn" onclick="feS(\'vecV\')" style="color:#2563eb">→ Hız</button>'
    +'<button class="dbtn" onclick="feS(\'vecA\')" style="color:#16a34a">→ İvme</button>'
    +'<button class="dbtn" onclick="feS(\'vecG\')" style="color:#9333ea">↓ Yerçek</button>'
    +'<button class="dbtn" onclick="feS(\'vecN\')" style="color:#f59e0b">↑ Normal</button>'
    +'<button class="dbtn" onclick="feS(\'vecT\')" style="color:#06b6d4">→ Geril</button>'
    +'</div></div>'
    +'<div class="dcat"><div class="dcat-title">⚡ Elektrik</div>'
    +'<div class="dgrid">'
    +'<button class="dbtn" onclick="feS(\'battery\')">🔋 Pil</button>'
    +'<button class="dbtn" onclick="feS(\'resistor\')">⏥ Direnç</button>'
    +'<button class="dbtn" onclick="feS(\'bulb\')">💡 Lamba</button>'
    +'<button class="dbtn" onclick="feS(\'switch\')">⏻ Anaht</button>'
    +'<button class="dbtn" onclick="feS(\'capacitor\')">⊓ Kapa</button>'
    +'<button class="dbtn" onclick="feS(\'inductor\')">〰 Bobin</button>'
    +'</div></div>'
    +'<div class="dcat"><div class="dcat-title">📦 Özel Şekil</div>'
    +'<div class="dgrid" id="dg-custom">'
    +'<button class="dbtn" onclick="feAddCustom()" style="border:2px dashed #555">➕ Ekle</button>'
    +'</div></div>'
    +'</div>'
    +'<div id="draw-main">'
    +'<div id="draw-toolbar">'
    +'<div class="dtb-colors">'
    +'<span class="dtb-c" style="background:#e11d48" onclick="feC(\'#e11d48\')"></span>'
    +'<span class="dtb-c" style="background:#2563eb" onclick="feC(\'#2563eb\')"></span>'
    +'<span class="dtb-c" style="background:#16a34a" onclick="feC(\'#16a34a\')"></span>'
    +'<span class="dtb-c" style="background:#ca8a04" onclick="feC(\'#ca8a04\')"></span>'
    +'<span class="dtb-c" style="background:#111" onclick="feC(\'#111\')"></span>'
    +'<span class="dtb-c" style="background:#fff;border:1px solid #888" onclick="feC(\'#fff\')"></span>'
    +'<input type="color" value="#e11d48" onchange="feC(this.value)" style="width:24px;height:24px;border:none;cursor:pointer">'
    +'</div>'
    +'<select onchange="FE.strokeW=+this.value" style="padding:4px;border-radius:4px;background:#222;color:#fff;border:1px solid #444">'
    +'<option value="1">1px</option><option value="2">2px</option><option value="3" selected>3px</option>'
    +'<option value="5">5px</option><option value="8">8px</option><option value="12">12px</option>'
    +'</select>'
    +'<button class="tbtn" onclick="feUndo()">↩ Geri</button>'
    +'<button class="tbtn" onclick="feDel()">🗑 Sil</button>'
    +'<button class="tbtn" onclick="feDup()">📋 Kopyala</button>'
    +'<button class="tbtn" onclick="feGroup()">🔗 Grupla</button>'
    +'<button class="tbtn" onclick="feLock()" id="btn-lock" title="Seçili nesneyi sabitle">🔒 Sabitle</button>'
    +'<button class="tbtn" onclick="feUnlock()" title="Seçili nesnenin kilidini aç">🔓 Kilit Aç</button>'
    +'<button class="tbtn" onclick="feUnlockAll()" title="Tüm kilitleri aç">🔓 Tümü</button>'
    +'<span style="color:#888;margin:0 8px">|</span>'
    +'<span style="color:#aaa;font-size:11px">Tuval:</span>'
    +'<button class="tbtn" onclick="feResize()" title="Tuval boyutunu ayarla">📐 Boyut</button>'
    +'<button class="tbtn" onclick="feFitToImg()" title="Tuvali resme sığdır">🖼 Sığdır</button>'
    +'<button class="tbtn" onclick="feResetZoom()" title="Zoom\'u sıfırla (1:1)">🔍 Reset</button>'
    +'<span id="fe-zoom-display" style="color:#aaa;font-size:11px;min-width:50px;text-align:center">100%</span>'
    +'<label class="tbtn" style="cursor:pointer">📷 Resim<input type="file" accept="image/*" onchange="feLoadImg(this)" style="display:none"></label>'
    +'<div style="flex:1"></div>'
    +'<button class="tbtn" onclick="feDelAll()" style="background:#dc2626">🗑 Hepsini Sil</button>'
    +'<button class="tbtn" onclick="feClose()" style="background:#666">✕ İptal</button>'
    +'<button class="tbtn" onclick="feSave()" style="background:#16a34a;font-weight:700">✅ Kaydet</button>'
    +'</div>'
    +'<div id="draw-canvas-area">'
    +'<div id="draw-canvas-container">'
    +'<canvas id="fe-canvas"></canvas>'
    +'</div></div>'
    +'</div></div>';
  document.body.appendChild(modal);

  FE.canvas = new fabric.Canvas('fe-canvas', {
    width: A4_W,
    height: A4_H,
    backgroundColor: '#ffffff',
    selection: true,
    allowTouchScrolling: false,
    enablePointerEvents: true
  });

  const canvasEl = FE.canvas.upperCanvasEl;
  if(canvasEl){
    canvasEl.style.touchAction = 'none';
    canvasEl.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'pen' && e.pressure > 0){
        const baseWidth = FE.canvas.freeDrawingBrush ? FE.canvas.freeDrawingBrush.width : 2;
        FE.canvas.freeDrawingBrush.width = baseWidth * (0.5 + e.pressure);
      }
    });
  }

  feDrawGrid();
  if(typeof _sekilEditorMax==='function')_sekilEditorMax();

  if (imgEl && imgEl.src && imgEl.src.length > 100) {
    const img = new Image();
    img.onload = function() {
      const fImg = new fabric.Image(img);
      const scale = Math.min((A4_W - 40) / img.width, (A4_H - 40) / img.height, 1);
      fImg.scale(scale);
      fImg.set({ left: 20, top: 20 });
      FE.canvas.add(fImg);
      FE.canvas.renderAll();
      setTimeout(function(){
        if (confirm('Resmi sabitlemek ister misiniz?\n\nSabitlenen resim hareket etmez, üzerine çizim yapabilirsiniz.\n\n"🔓 Kilit Aç" ile daha sonra açabilirsiniz.')) {
          fImg.set({
            lockMovementX: true, lockMovementY: true, lockRotation: true,
            lockScalingX: true, lockScalingY: true, selectable: false,
            evented: false, isLocked: true, opacity: 1
          });
          FE.canvas.discardActiveObject();
          FE.canvas.renderAll();
        }
      }, 100);
    };
    img.src = imgEl.src;
  }

  feSetupEvents();

  const canvasArea = H('draw-canvas-area');
  const canvasContainer = H('draw-canvas-container');
  const upperCanvas = document.querySelector('.upper-canvas');
  
  const wheelHandler = function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!FE.canvas) return;
      const canvasEl = FE.canvas.upperCanvasEl;
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      var zoom = FE.canvas.getZoom();
      const delta = e.deltaY;
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;
      FE.canvas.zoomToPoint({ x: x, y: y }, zoom);
      const display = H('fe-zoom-display');
      if (display) display.textContent = Math.round(zoom * 100) + '%';
      return false;
    }
  };
  
  if (canvasArea) canvasArea.addEventListener('wheel', wheelHandler, { passive: false });
  if (canvasContainer) canvasContainer.addEventListener('wheel', wheelHandler, { passive: false });
  if (upperCanvas) upperCanvas.addEventListener('wheel', wheelHandler, { passive: false });
  
  setTimeout(function(){
    const uc = document.querySelector('#draw-canvas-container .upper-canvas');
    const lc = document.querySelector('#draw-canvas-container .lower-canvas');
    if (uc) uc.addEventListener('wheel', wheelHandler, { passive: false });
    if (lc) lc.addEventListener('wheel', wheelHandler, { passive: false });
  }, 100);

  modal.onclick = function(e){ if (e.target === modal) feClose(); };
  document.addEventListener('keydown', function feKey(e) {
    if (!H('draw-modal')) { document.removeEventListener('keydown', feKey); return; }
    if (e.key === 'Escape') feClose();
    if (e.key === 'Delete') feDel();
    if (e.ctrlKey && e.key === 'v') fePaste();
  });
  document.addEventListener('paste', fePasteHandler);
}

function fePasteHandler(e) {
  if (!FE.canvas) return;
  const items = e.clipboardData ? e.clipboardData.items : null;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      reader.onload = function(ev) {
        fabric.Image.fromURL(ev.target.result, function(img) {
          img.scale(0.5);
          img.set({ left: 100, top: 100 });
          FE.canvas.add(img);
          FE.canvas.setActiveObject(img);
          FE.canvas.renderAll();
        });
      };
      reader.readAsDataURL(blob);
      e.preventDefault();
      break;
    }
  }
}

function feDrawGrid() {
  const c = FE.canvas;
  for (var x = 0; x <= A4_W; x += 37.8) {
    c.add(new fabric.Line([x, 0, x, A4_H], { stroke: '#e5e5e5', strokeWidth: 0.5, selectable: false, evented: false, isGrid: true }));
  }
  for (var y = 0; y <= A4_H; y += 37.8) {
    c.add(new fabric.Line([0, y, A4_W, y], { stroke: '#e5e5e5', strokeWidth: 0.5, selectable: false, evented: false, isGrid: true }));
  }
}

function feSetupEvents() {
  const c = FE.canvas;
  var drawing = false, startX, startY, shape;

  c.on('mouse:down', function(o) {
    const p = c.getPointer(o.e);
    startX = p.x; startY = p.y;

    if (FE.tool === 'eraser' && o.target && !o.target.isGrid) {
      c.remove(o.target);
      return;
    }

    if (FE.tool === 'text') {
      const t = new fabric.Textbox('Metin', { left: p.x, top: p.y, width: 120, fontSize: 18, fill: FE.color });
      c.add(t); c.setActiveObject(t); t.enterEditing();
      feT('select');
      return;
    }

    if (['rect', 'circle', 'line', 'arrow'].indexOf(FE.tool) !== -1) {
      drawing = true;
      if (FE.tool === 'rect') shape = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: 'transparent', stroke: FE.color, strokeWidth: FE.strokeW });
      else if (FE.tool === 'circle') shape = new fabric.Circle({ left: p.x, top: p.y, radius: 1, fill: 'transparent', stroke: FE.color, strokeWidth: FE.strokeW });
      else if (FE.tool === 'line') shape = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: FE.color, strokeWidth: FE.strokeW });
      else if (FE.tool === 'arrow') {
        shape = new fabric.Path(feArrowPath(p.x, p.y, p.x, p.y, FE.strokeW), { 
          fill: FE.color, stroke: FE.color, strokeWidth: 1, objectCaching: false
        });
        shape._startX = p.x; shape._startY = p.y;
      }
      if (shape) c.add(shape);
    }
  });

  c.on('mouse:move', function(o) {
    if (!drawing || !shape) return;
    const p = c.getPointer(o.e);
    if (FE.tool === 'rect') {
      shape.set({ width: Math.abs(p.x - startX), height: Math.abs(p.y - startY), left: Math.min(p.x, startX), top: Math.min(p.y, startY) });
    } else if (FE.tool === 'circle') {
      const r = Math.sqrt(Math.pow(p.x - startX, 2) + Math.pow(p.y - startY, 2)) / 2;
      shape.set({ radius: r, left: (startX + p.x) / 2 - r, top: (startY + p.y) / 2 - r });
    } else if (FE.tool === 'line') {
      shape.set({ x2: p.x, y2: p.y });
    } else if (FE.tool === 'arrow') {
      c.remove(shape);
      shape = new fabric.Path(feArrowPath(startX, startY, p.x, p.y, FE.strokeW), { 
        fill: FE.color, stroke: FE.color, strokeWidth: 1, objectCaching: false
      });
      c.add(shape);
    }
    c.renderAll();
  });

  c.on('mouse:up', function(o) {
    if (drawing && shape) {
      c.setActiveObject(shape);
    }
    drawing = false;
    shape = null;
    if (['rect', 'circle', 'line', 'arrow'].indexOf(FE.tool) !== -1) feT('select');
  });

  c.on('mouse:over', function(o) {
    if (FE.tool === 'eraser' && o.target && !o.target.isGrid) {
      o.target.set('opacity', 0.5);
      c.renderAll();
    }
  });
  c.on('mouse:out', function(o) {
    if (o.target && !o.target.isGrid) {
      o.target.set('opacity', 1);
      c.renderAll();
    }
  });
}

function feT(t) {
  FE.tool = t;
  document.querySelectorAll('.dbtn[data-t]').forEach(function(b){ b.classList.remove('active'); });
  var el = document.querySelector('.dbtn[data-t="'+t+'"]');
  if(el) el.classList.add('active');
  FE.canvas.isDrawingMode = (t === 'pencil');
  if (t === 'pencil') {
    FE.canvas.freeDrawingBrush.color = FE.color;
    FE.canvas.freeDrawingBrush.width = FE.strokeW;
  }
  FE.canvas.selection = (t === 'select');
}

function feC(c) {
  FE.color = c;
  if (FE.canvas.freeDrawingBrush) FE.canvas.freeDrawingBrush.color = c;
  const obj = FE.canvas.getActiveObject();
  if (obj) {
    if (obj.type === 'textbox') obj.set('fill', c);
    else obj.set('stroke', c);
    FE.canvas.renderAll();
  }
}

function feDel() {
  const objs = FE.canvas.getActiveObjects();
  objs.forEach(function(o){ if (!o.isGrid) FE.canvas.remove(o); });
  FE.canvas.discardActiveObject();
  FE.canvas.renderAll();
}

function feDup() {
  const obj = FE.canvas.getActiveObject();
  if (obj) obj.clone(function(c){ c.set({ left: c.left + 20, top: c.top + 20 }); FE.canvas.add(c); FE.canvas.setActiveObject(c); });
}

function feGroup() {
  const objs = FE.canvas.getActiveObjects();
  if (objs.length > 1) {
    const grp = new fabric.Group(objs);
    objs.forEach(function(o){ FE.canvas.remove(o); });
    FE.canvas.add(grp);
    FE.canvas.setActiveObject(grp);
  }
}

function feLock() {
  const obj = FE.canvas.getActiveObject();
  if (!obj) { klbToast('Önce bir nesne seçin!'); return; }
  obj.set({
    lockMovementX: true, lockMovementY: true, lockRotation: true,
    lockScalingX: true, lockScalingY: true, selectable: false,
    evented: false, isLocked: true
  });
  obj.set('opacity', 0.9);
  FE.canvas.discardActiveObject();
  FE.canvas.renderAll();
}

function feUnlock() {
  const objs = FE.canvas.getObjects();
  for (var i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.isLocked) {
      o.set({
        lockMovementX: false, lockMovementY: false, lockRotation: false,
        lockScalingX: false, lockScalingY: false, selectable: true,
        evented: true, isLocked: false, opacity: 1
      });
      FE.canvas.setActiveObject(o);
      FE.canvas.renderAll();
      return;
    }
  }
  klbToast('Kilitli nesne bulunamadı!');
}

function feUnlockAll() {
  const objs = FE.canvas.getObjects();
  var count = 0;
  objs.forEach(function(o){
    if (o.isLocked) {
      o.set({
        lockMovementX: false, lockMovementY: false, lockRotation: false,
        lockScalingX: false, lockScalingY: false, selectable: true,
        evented: true, isLocked: false, opacity: 1
      });
      count++;
    }
  });
  FE.canvas.renderAll();
  if (count > 0) klbToast(count + ' nesnenin kilidi açıldı');
  else klbToast('Kilitli nesne yok');
}

function feResize() {
  const currentW = FE.canvas.getWidth();
  const currentH = FE.canvas.getHeight();
  const input = prompt(
    'Tuval boyutunu girin (genişlik x yükseklik):\n\nÖrnekler:\n• 800x600 - Özel boyut\n• A4 - 794x1123 (dikey)\n• A4Y - 1123x794 (yatay)\n• A5 - 559x794\n\nŞu anki: ' + currentW + 'x' + currentH,
    currentW + 'x' + currentH
  );
  if (!input) return;
  var newW, newH;
  const val = input.toUpperCase().trim();
  if (val === 'A4') { newW = 794; newH = 1123; }
  else if (val === 'A4Y') { newW = 1123; newH = 794; }
  else if (val === 'A5') { newW = 559; newH = 794; }
  else {
    const parts = val.split('X');
    if (parts.length === 2) { newW = parseInt(parts[0]); newH = parseInt(parts[1]); }
  }
  if (newW && newH && newW > 100 && newH > 100) {
    feSetCanvasSize(newW, newH);
  } else {
    klbToast('Geçersiz boyut! Örnek: 800x600');
  }
}

function feFitToImg() {
  const objs = FE.canvas.getObjects();
  var maxW = 400, maxH = 300;
  objs.forEach(function(o){
    if (o.type === 'image' && !o.isGrid) {
      const w = o.width * o.scaleX;
      const h = o.height * o.scaleY;
      if (w > maxW) maxW = w;
      if (h > maxH) maxH = h;
    }
  });
  maxW = Math.ceil(maxW + 40);
  maxH = Math.ceil(maxH + 40);
  feSetCanvasSize(maxW, maxH);
}

function feSetCanvasSize(w, h) {
  const objs = FE.canvas.getObjects().filter(function(o){return !o.isGrid;});
  FE.canvas.setWidth(w);
  FE.canvas.setHeight(h);
  FE.canvas.backgroundColor = '#ffffff';
  FE.canvas.getObjects().filter(function(o){return o.isGrid;}).forEach(function(o){FE.canvas.remove(o);});
  for (var x = 0; x <= w; x += 37.8) {
    FE.canvas.add(new fabric.Line([x, 0, x, h], { stroke: '#e5e5e5', strokeWidth: 0.5, selectable: false, evented: false, isGrid: true }));
  }
  for (var y = 0; y <= h; y += 37.8) {
    FE.canvas.add(new fabric.Line([0, y, w, y], { stroke: '#e5e5e5', strokeWidth: 0.5, selectable: false, evented: false, isGrid: true }));
  }
  FE.canvas.getObjects().filter(function(o){return o.isGrid;}).forEach(function(o){FE.canvas.sendToBack(o);});
  FE.canvas.renderAll();
}

function feResetZoom() {
  FE.canvas.setZoom(1);
  FE.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  FE.canvas.renderAll();
  const display = H('fe-zoom-display');
  if (display) display.textContent = '100%';
}

function feUndo() {
  const objs = FE.canvas.getObjects();
  for (var i = objs.length - 1; i >= 0; i--) {
    if (!objs[i].isGrid) { FE.canvas.remove(objs[i]); break; }
  }
  FE.canvas.renderAll();
}

function feDelAll() {
  if (confirm('Tüm çizimleri silmek istediğinize emin misiniz?')) {
    FE.canvas.getObjects().forEach(function(o){ if (!o.isGrid) FE.canvas.remove(o); });
    FE.canvas.renderAll();
  }
}

function feLoadImg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    fabric.Image.fromURL(e.target.result, function(img) {
      const maxW = FE.canvas.getWidth() - 40;
      const maxH = FE.canvas.getHeight() - 40;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      img.scale(scale);
      img.set({ left: 20, top: 20 });
      FE.canvas.add(img);
      FE.canvas.setActiveObject(img);
      FE.canvas.renderAll();
      if (confirm('Resmi sabitlemek ister misiniz?\n\nSabitlenen resim hareket etmez, üzerine çizim yapabilirsiniz.\n\nDaha sonra "🔓 Kilit Aç" ile açabilirsiniz.')) {
        img.set({
          lockMovementX: true, lockMovementY: true, lockRotation: true,
          lockScalingX: true, lockScalingY: true, selectable: false,
          evented: false, isLocked: true, opacity: 1
        });
        FE.canvas.discardActiveObject();
        FE.canvas.renderAll();
      }
    });
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function feAddCustom() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const name = prompt('Şekil adı:', 'Şekil') || 'Şekil';
      const url = e.target.result;
      FE.customShapes.push({ name: name, url: url });
      const grid = H('dg-custom');
      const btn = document.createElement('button');
      btn.className = 'dbtn';
      btn.textContent = name;
      btn.onclick = function() {
        fabric.Image.fromURL(url, function(img) {
          img.scale(0.3);
          img.set({ left: 100, top: 100 });
          FE.canvas.add(img);
          FE.canvas.setActiveObject(img);
        });
      };
      if(grid) grid.insertBefore(btn, grid.lastElementChild);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function fePaste() {}

function feClose() {
  document.removeEventListener('paste', fePasteHandler);
  const m = H('draw-modal');
  if (m) m.remove();
  FE.canvas = null;
}

function feSave() {
  FE.canvas.discardActiveObject();
  FE.canvas.getObjects().forEach(function(o){ if (o.isGrid) o.visible = false; });
  FE.canvas.renderAll();
  const objs = FE.canvas.getObjects().filter(function(o){return !o.isGrid && o.visible !== false;});
  if (objs.length === 0) {
    const url = FE.canvas.toDataURL({ format: 'png', quality: 1 });
    if (FE.imgEl) FE.imgEl.src = url;
    if(typeof qeditSaveText === 'function') qeditSaveText();
    feClose();
    return;
  }
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  objs.forEach(function(o){
    const bound = o.getBoundingRect(true);
    if (bound.left < minX) minX = bound.left;
    if (bound.top < minY) minY = bound.top;
    if (bound.left + bound.width > maxX) maxX = bound.left + bound.width;
    if (bound.top + bound.height > maxY) maxY = bound.top + bound.height;
  });
  minX = Math.max(0, minX - 10);
  minY = Math.max(0, minY - 10);
  maxX = Math.min(FE.canvas.getWidth(), maxX + 10);
  maxY = Math.min(FE.canvas.getHeight(), maxY + 10);
  const cropW = maxX - minX;
  const cropH = maxY - minY;
  const url = FE.canvas.toDataURL({
    format: 'png', quality: 1, left: minX, top: minY, width: cropW, height: cropH
  });
  if (FE.imgEl) FE.imgEl.src = url;
  if(typeof qeditSaveText === 'function') qeditSaveText();
  feClose();
}

function feS(type) {
  const c = FE.color, w = FE.strokeW;
  var obj = null;

  switch(type) {
    case 'numberLine': obj = feGrp([
      new fabric.Line([0, 15, 120, 15], { stroke: c, strokeWidth: w }),
      new fabric.Triangle({ width: 10, height: 8, fill: c, left: 120, top: 11, angle: 90 }),
      new fabric.Line([20, 10, 20, 20], { stroke: c, strokeWidth: 1 }),
      new fabric.Line([40, 10, 40, 20], { stroke: c, strokeWidth: 1 }),
      new fabric.Line([60, 10, 60, 20], { stroke: c, strokeWidth: 1 }),
      new fabric.Line([80, 10, 80, 20], { stroke: c, strokeWidth: 1 }),
      new fabric.Line([100, 10, 100, 20], { stroke: c, strokeWidth: 1 })
    ]); break;
    case 'coordSystem': obj = feGrp([
      new fabric.Line([0, 50, 100, 50], { stroke: c, strokeWidth: w }),
      new fabric.Line([50, 0, 50, 100], { stroke: c, strokeWidth: w }),
      new fabric.Triangle({ width: 8, height: 6, fill: c, left: 100, top: 47, angle: 90 }),
      new fabric.Triangle({ width: 8, height: 6, fill: c, left: 47, top: 0 }),
      new fabric.Text('x', { fontSize: 12, fill: c, left: 90, top: 52 }),
      new fabric.Text('y', { fontSize: 12, fill: c, left: 54, top: 2 })
    ]); break;
    case 'fraction': obj = new fabric.Textbox('a\n─\nb', { fontSize: 20, fill: c, textAlign: 'center', width: 30 }); break;
    case 'sqrt': obj = new fabric.Textbox('√x', { fontSize: 24, fill: c }); break;
    case 'triangle': obj = new fabric.Triangle({ width: 60, height: 52, fill: 'transparent', stroke: c, strokeWidth: w }); break;
    case 'rightTri': obj = new fabric.Polygon([{x:0,y:50},{x:60,y:50},{x:0,y:0}], { fill: 'transparent', stroke: c, strokeWidth: w }); break;
    case 'parallel': obj = new fabric.Polygon([{x:15,y:0},{x:75,y:0},{x:60,y:40},{x:0,y:40}], { fill: 'transparent', stroke: c, strokeWidth: w }); break;
    case 'trapez': obj = new fabric.Polygon([{x:15,y:0},{x:55,y:0},{x:70,y:40},{x:0,y:40}], { fill: 'transparent', stroke: c, strokeWidth: w }); break;
    case 'pentagon': obj = fePoly(5, 30, c, w); break;
    case 'hexagon': obj = fePoly(6, 30, c, w); break;
    case 'vecF': obj = feVec('F', '#e11d48'); break;
    case 'vecV': obj = feVec('v', '#2563eb'); break;
    case 'vecA': obj = feVec('a', '#16a34a'); break;
    case 'vecG': obj = feVec('g', '#9333ea', 90); break;
    case 'vecN': obj = feVec('N', '#f59e0b', -90); break;
    case 'vecT': obj = feVec('T', '#06b6d4'); break;
    case 'battery': obj = feGrp([
      new fabric.Line([0, 20, 15, 20], { stroke: c, strokeWidth: w }),
      new fabric.Line([15, 8, 15, 32], { stroke: c, strokeWidth: w + 2 }),
      new fabric.Line([22, 13, 22, 27], { stroke: c, strokeWidth: w }),
      new fabric.Line([22, 20, 40, 20], { stroke: c, strokeWidth: w }),
      new fabric.Text('+', { fontSize: 10, fill: c, left: 8, top: 0 }),
      new fabric.Text('−', { fontSize: 10, fill: c, left: 23, top: 0 })
    ]); break;
    case 'resistor': obj = feGrp([
      new fabric.Line([0, 12, 8, 12], { stroke: c, strokeWidth: w }),
      new fabric.Polyline([{x:8,y:12},{x:12,y:4},{x:20,y:20},{x:28,y:4},{x:36,y:20},{x:44,y:4},{x:48,y:12}], { fill: null, stroke: c, strokeWidth: w }),
      new fabric.Line([48, 12, 56, 12], { stroke: c, strokeWidth: w })
    ]); break;
    case 'bulb': obj = feGrp([
      new fabric.Circle({ radius: 16, fill: 'transparent', stroke: c, strokeWidth: w }),
      new fabric.Line([5, 5, 27, 27], { stroke: c, strokeWidth: w }),
      new fabric.Line([5, 27, 27, 5], { stroke: c, strokeWidth: w }),
      new fabric.Line([-10, 16, 0, 16], { stroke: c, strokeWidth: w }),
      new fabric.Line([32, 16, 42, 16], { stroke: c, strokeWidth: w })
    ]); break;
    case 'switch': obj = feGrp([
      new fabric.Line([0, 15, 12, 15], { stroke: c, strokeWidth: w }),
      new fabric.Circle({ radius: 3, fill: c, left: 9, top: 12 }),
      new fabric.Line([12, 15, 35, 5], { stroke: c, strokeWidth: w }),
      new fabric.Circle({ radius: 3, fill: c, left: 32, top: 12 }),
      new fabric.Line([35, 15, 48, 15], { stroke: c, strokeWidth: w })
    ]); break;
    case 'capacitor': obj = feGrp([
      new fabric.Line([0, 15, 15, 15], { stroke: c, strokeWidth: w }),
      new fabric.Line([15, 5, 15, 25], { stroke: c, strokeWidth: w + 1 }),
      new fabric.Line([22, 5, 22, 25], { stroke: c, strokeWidth: w + 1 }),
      new fabric.Line([22, 15, 38, 15], { stroke: c, strokeWidth: w })
    ]); break;
    case 'inductor': obj = feGrp([
      new fabric.Line([0, 15, 8, 15], { stroke: c, strokeWidth: w }),
      new fabric.Circle({ radius: 6, fill: 'transparent', stroke: c, strokeWidth: w, left: 8, top: 9, startAngle: Math.PI, endAngle: 2 * Math.PI }),
      new fabric.Circle({ radius: 6, fill: 'transparent', stroke: c, strokeWidth: w, left: 18, top: 9, startAngle: Math.PI, endAngle: 2 * Math.PI }),
      new fabric.Circle({ radius: 6, fill: 'transparent', stroke: c, strokeWidth: w, left: 28, top: 9, startAngle: Math.PI, endAngle: 2 * Math.PI }),
      new fabric.Circle({ radius: 6, fill: 'transparent', stroke: c, strokeWidth: w, left: 38, top: 9, startAngle: Math.PI, endAngle: 2 * Math.PI }),
      new fabric.Line([48, 15, 56, 15], { stroke: c, strokeWidth: w })
    ]); break;
  }

  if (obj) {
    obj.set({ left: 100, top: 100 });
    FE.canvas.add(obj);
    FE.canvas.setActiveObject(obj);
    FE.canvas.renderAll();
    feT('select');
  }
}

function feGrp(items) { return new fabric.Group(items); }
function fePoly(sides, r, c, w) {
  const pts = [];
  for (var i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI / sides) - Math.PI / 2;
    pts.push({ x: r + r * Math.cos(a), y: r + r * Math.sin(a) });
  }
  return new fabric.Polygon(pts, { fill: 'transparent', stroke: c, strokeWidth: w });
}

function feVec(label, color, angle) {
  if(angle===undefined) angle=0;
  const vecText = new fabric.Text(label, { 
    fontSize: 18, fill: color, left: 25, top: 0, fontWeight: 'bold',
    fontFamily: 'Times New Roman, serif'
  });
  const vecArrow = new fabric.Text('→', { 
    fontSize: 12, fill: color, 
    left: vecText.left + (vecText.width / 2) - 5,
    top: vecText.top - 11,
    fontWeight: 'normal'
  });
  const arrowPath = new fabric.Path(feArrowPath(0, 20, 60, 20, 3), {
    fill: color, stroke: color, strokeWidth: 1
  });
  const g = new fabric.Group([arrowPath, vecText, vecArrow]);
  g.set({ angle: angle });
  return g;
}

function feArrowPath(x1, y1, x2, y2, strokeW) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return 'M '+x1+' '+y1+' L '+x2+' '+y2;
  const headLen = Math.min(Math.max(strokeW * 4, 12), 25);
  const headW = Math.min(Math.max(strokeW * 2.5, 8), 18);
  const bodyW = Math.max(strokeW / 2, 1);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const bx = x2 - ux * headLen;
  const by = y2 - uy * headLen;
  const p1x = x1 + nx * bodyW, p1y = y1 + ny * bodyW;
  const p2x = bx + nx * bodyW, p2y = by + ny * bodyW;
  const p3x = bx + nx * headW, p3y = by + ny * headW;
  const p4x = x2, p4y = y2;
  const p5x = bx - nx * headW, p5y = by - ny * headW;
  const p6x = bx - nx * bodyW, p6y = by - ny * bodyW;
  const p7x = x1 - nx * bodyW, p7y = y1 - ny * bodyW;
  return 'M '+p1x+' '+p1y+' L '+p2x+' '+p2y+' L '+p3x+' '+p3y+' L '+p4x+' '+p4y+' L '+p5x+' '+p5y+' L '+p6x+' '+p6y+' L '+p7x+' '+p7y+' Z';
}

// ============================================================
// CLEAN FOR PRINT (print.js'ten)
// ============================================================
function cleanForPrint(html, sutun){
  const div=document.createElement('div');
  div.innerHTML=html;
  div.querySelectorAll('img').forEach(function(img){
    img.removeAttribute('title');
    img.removeAttribute('class');
    img.removeAttribute('onclick');
    img.style.cssText='display:block;width:100%;height:auto;max-width:100%;object-fit:contain;border:1px solid #ddd;margin:4pt 0;box-sizing:border-box';
  });
  const STRIP_PATTERNS =[/↑\s*Resme?\s*tıkla/i,/üzerine\s*çiz/i,/çizim\s*arac/i,/tıkla\s*→/i,/→\s*çiz/i];
  div.querySelectorAll('*').forEach(function(el){
    if(el.children.length===0){
      var t=el.textContent||'';
      if(STRIP_PATTERNS.some(function(p){return p.test(t);})){el.remove();}
    }
  });
  div.querySelectorAll('p,div,span').forEach(function(el){
    if(!el.children.length&&!(el.textContent||'').trim()&&!el.querySelector('img'))el.remove();
  });
  return div.innerHTML;
}

// ============================================================
// SORU DÜZENLEME PANELİ (Çalışma Kağıdı adaptasyonlu)
// ============================================================
function toggleQEditMode(){
  _qeditFullscreen=!_qeditFullscreen;
  const inner=document.querySelector('.qedit-inner');
  const panel=H('qedit-panel');
  const btn=H('qedit-mode-btn');
  if(_qeditFullscreen){
    if(inner){
      inner.style.width='100vw';inner.style.maxHeight='100vh';
      inner.style.margin='0';inner.style.borderRadius='0';
    }
    if(panel){panel.style.padding='0';panel.style.alignItems='stretch';}
    if(btn){btn.textContent='✕';btn.setAttribute('data-tip','Normal Moda Dön');}
  } else {
    if(inner){inner.style.width='';inner.style.maxHeight='';inner.style.margin='';inner.style.borderRadius='';}
    if(panel){panel.style.padding='16px';panel.style.alignItems='';}
    if(btn){btn.textContent='⛶';btn.setAttribute('data-tip','Tam Ekran');}
  }
}

function closeQEdit(silent){
  _activeQId=null;
  _qeditFullscreen=false;
  const inner=document.querySelector('.qedit-inner');
  if(inner){inner.style.width='';inner.style.maxHeight='';inner.style.margin='';inner.style.borderRadius='';}
  const panel=H('qedit-panel');
  if(panel){panel.style.display='none';panel.style.padding='16px';panel.style.alignItems='';}
  document.body.style.overflow='';
  const btn=H('qedit-mode-btn');if(btn){btn.textContent='⛶';}
  document.querySelectorAll('.qcard').forEach(function(c){c.classList.remove('active');});
  if(!silent)renderQuestionsCalisma();
}

function qeditSaveAndClose(){
  qeditSaveText();
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.innerHTML = '✅ Kaydedildi';
  btn.style.background = '#16a34a';
  setTimeout(function(){
    btn.innerHTML = originalText;
    closeQEdit();
  }, 500);
}

function qeditSaveText(){
  const q=db.calismaQuestions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const we=H('we-area');
  if(!we)return;
  if(q.type==='section'){
    q.title=we.innerHTML||'';
  } else {
    q.text=we.innerHTML||'';
  }
  saveDebounced();
  renderQuestionsCalisma();
}

function qeditSavePuan(){
  const q=db.calismaQuestions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const pp=H('qedit-puan');
  if(!pp)return;
  q.puan=parseFloat(pp.value)||0;
  saveDebounced();
  renderQuestionsCalisma();
}

function qeditSaveAciklama(){
  const q=db.calismaQuestions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  q.aciklama=H('qedit-aciklama')?H('qedit-aciklama').value:'';
  saveDebounced();
}

function qeditSaveBosluk(){
  const q=db.calismaQuestions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const bp=H('qedit-bosluk');
  if(!bp)return;
  q.bosluk=parseInt(bp.value)||0;
  saveDebounced();
}

function qEditNav(dir){
  if(!_activeQId)return;
  const idx=db.calismaQuestions.findIndex(function(q){return q.id===_activeQId;});
  const nidx=idx+dir;
  if(nidx<0||nidx>=db.calismaQuestions.length)return;
  openQEditCalisma(db.calismaQuestions[nidx].id);
}

// ============================================================
// RESİM YÖNETİMİ (Çalışma Kağıdı)
// ============================================================
function qAddImgFile(inp){
  const file=inp.files[0];if(!file)return;
  const q=db.calismaQuestions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const reader=new FileReader();
  reader.onload=function(e){
    if(!q.images)q.images=[];
    q.images.push(e.target.result);
    saveDebounced();
    openQEditCalisma(_activeQId,true);
    renderQuestionsCalisma();
  };
  reader.readAsDataURL(file);
  inp.value='';
}

function qDelImgCalisma(qid,idx){
  const q=db.calismaQuestions.find(function(qq){return qq.id===qid;});
  if(!q||!q.images)return;
  q.images.splice(idx,1);
  saveDebounced();
  openQEditCalisma(qid,true);
}

function imgEditorOpen(qid,idx){
  const q=db.calismaQuestions.find(function(qq){return qq.id===qid;});
  if(!q||!q.images||!q.images[idx])return;
  const src=q.images[idx];
  const modal=document.createElement('div');
  modal.id='img-ed-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center';
  const img=document.createElement('img');
  img.src=src;img.style.cssText='max-width:90vw;max-height:80vh;border-radius:8px';
  const close=document.createElement('button');
  close.textContent='✕ Kapat';close.style.cssText='position:absolute;top:16px;right:16px;padding:6px 16px;border-radius:6px;background:var(--red);border:none;color:#fff;cursor:pointer;font-weight:700';
  close.onclick=function(){modal.remove();};
  modal.appendChild(img);modal.appendChild(close);
  modal.onclick=function(e){if(e.target===modal)modal.remove();};
  document.body.appendChild(modal);
}

// ============================================================
// ÇALIŞMA KAĞIDI QEDIT (exam-groups.js'ten)
// ============================================================
function openQEditCalisma(qid,silent){
  const q=db.calismaQuestions.find(function(qq){return qq.id===qid;});if(!q)return;
  _activeQId=qid;
  _isCalismaModu=true;
  const panel=H('qedit-panel');if(!panel)return;

  if(!silent){
    const we=H('we-area');
    if(we){
      if(q.type==='section'){
        we.innerHTML=q.title||'';
      } else {
        we.innerHTML=q.text||'';
      }
      weBindImgHandlers();
    }
    const pp=H('qedit-puan');if(pp){pp.style.display='none';if(pp.nextElementSibling)pp.nextElementSibling.style.display='none';}
    const bp=H('qedit-bosluk');if(bp){bp.value=q.bosluk||0;const bv=H('bosluk-val');if(bv)bv.textContent=q.bosluk||0;}
    panel.style.display='flex';
    document.body.style.overflow='hidden';
    setTimeout(function(){H('we-area')&&H('we-area').focus();},80);
  }

  const typeLabel={mc:'🔵 Çoktan Seçmeli',open:'📝 Açık Uçlu',fill:'✏️ Boşluk',section:'📌 Bölüm Başlığı'};
  const qNum=db.calismaQuestions.filter(function(qq,i){return qq.id===qid?false:db.calismaQuestions.indexOf(qq)<db.calismaQuestions.indexOf(q)&&qq.type!=='section';}).length+1;
  const tl=H('qedit-title');
  if(tl)tl.textContent=q.type==='section'?'📌 Bölüm Başlığı Düzenle':(qNum+'. Soru — '+typeLabel[q.type]||'');

  const wew=H('we-wrap');
  if(wew)wew.style.display='flex';

  const body=H('qedit-body');
  if(!body)return;

  if(q.type==='section'){
    body.innerHTML='<div style="color:var(--text2);font-size:.82rem">Yukarıdaki alanda bölüm başlığı metnini düzenleyin.</div>';
    return;
  }

  const mcOpts=q.type==='mc'?'<div style="margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
    +'<span style="font-size:.78rem;font-weight:700;color:var(--text2)">Şıklar</span>'
    +'<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.78rem;color:var(--text2)">'
    +'<input type="checkbox" '+(q.siklarResimde?'checked':'')+' onchange="updQCalisma(\''+q.id+'\',\'siklarResimde\',this.checked)">'
    +'Şıklar resimde</label></div>'
    +'<div style="display:flex;align-items:center;gap:5px;margin-bottom:10px;flex-wrap:wrap">'
    +'<span style="font-size:.72rem;color:var(--text2)">Doğru şık:</span>'
    +['A','B','C','D','E'].map(function(o){return '<button onclick="updQCalisma(\''+q.id+'\',\'correct\',\''+o+'\');openQEditCalisma(\''+q.id+'\',true)"'
      +'style="width:28px;height:28px;border-radius:50%;border:2px solid '+(q.correct===o?'var(--green)':'var(--border)')+';'
      +'background:'+(q.correct===o?'rgba(34,197,94,.15)':'var(--bg2)')+';color:'+(q.correct===o?'var(--green)':'var(--text2)')+';'
      +'font-weight:800;font-size:.75rem;cursor:pointer;transition:all .15s">'+o+'</button>';}).join('')
    +(q.correct?'<button onclick="updQCalisma(\''+q.id+'\',\'correct\',null);openQEditCalisma(\''+q.id+'\',true)"'
      +'style="font-size:.68rem;padding:2px 7px;border:1px solid var(--border);background:transparent;color:var(--text3);border-radius:4px;cursor:pointer">✕</button>':'')
    +'</div>'
    +(q.siklarResimde?'<div style="font-size:.75rem;color:var(--text3);padding:6px 10px;background:var(--bg0);border-radius:5px">ℹ️ Şıklar resimde — metin girişi gizlendi.</div>':'<div style="display:flex;flex-direction:column;gap:5px">'
    +['A','B','C','D','E'].map(function(o){return '<div style="display:flex;align-items:center;gap:8px">'
      +'<span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;'
      +'background:'+(q.correct===o?'rgba(34,197,94,.15)':'var(--bg0)')+';'
      +'border:2px solid '+(q.correct===o?'var(--green)':'var(--border)')+';'
      +'font-weight:800;font-size:.75rem;color:'+(q.correct===o?'var(--green)':'var(--blue)')+';flex-shrink:0">'+o+'</span>'
      +'<input type="text" value="'+((q.options||{})[o]||'').replace(/"/g,'&quot;')+'" placeholder="'+o+' şıkkını yaz..."'
      +'style="flex:1;background:var(--bg0);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-family:inherit;font-size:.85rem;outline:none"'
      +'onfocus="this.style.borderColor=\'var(--blue)\'" onblur="this.style.borderColor=\'var(--border)\';updQCalisma(\''+q.id+'\',\'o_'+o+'\',this.value)"'
      +'oninput="updQCalisma(\''+q.id+'\',\'o_'+o+'\',this.value)">'
      +'</div>';}).join('')
    +'</div>')
    +'</div>':'';

  const imgs=(q.images||[]).length?'<div style="margin-bottom:12px">'
    +'<div style="font-size:.75rem;font-weight:700;color:var(--text2);margin-bottom:7px">📷 Resimler</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px">'
    +q.images.map(function(src,ii){return '<div style="position:relative">'
      +'<img src="'+src+'" style="height:180px;width:auto;max-width:300px;border:1px solid var(--border);border-radius:6px;cursor:pointer;object-fit:contain;background:#fff"'
      +'onclick="event.stopPropagation();imgEditorOpen(\''+q.id+'\','+ii+')">'
      +'<button onclick="qDelImgCalisma(\''+q.id+'\','+ii+')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);border:none;color:#fff;cursor:pointer;font-size:.65rem;padding:0;display:flex;align-items:center;justify-content:center">✕</button>'
      +'</div>';}).join('')
    +'</div></div>':'';

  body.innerHTML=mcOpts+imgs;

  document.querySelectorAll('.qcard').forEach(function(c){c.classList.remove('active');});
  renderQuestionsCalisma();

  weTabSwitch('mat',null);
}

function updQCalisma(qid,field,val){
  const q=db.calismaQuestions.find(function(qq){return qq.id===qid;});if(!q)return;
  if(field.startsWith('o_'))q.options[field.replace('o_','')]=val;
  else q[field]=val;
  saveDebounced();
}

// ============================================================
// ÇALIŞMA KAĞIDI SORU FONKSİYONLARI (worksheet.js'ten)
// ============================================================
function addQuestionCalisma(type){
  const id='c_'+(calismaCnt++);
  db.calismaQuestions.push({id,type,text:'',options:{A:'',B:'',C:'',D:'',E:''},
    correct:null,siklarResimde:false,bosluk:0,images:[]});
  saveDebounced();renderQuestionsCalisma();openQEditCalisma(id);
}

function addSectionCalisma(){
  const title=prompt('Bölüm başlığı:','Bölüm 1');
  if(!title)return;
  const id='c_'+(calismaCnt++);
  db.calismaQuestions.push({id,type:'section',title});
  saveDebounced();renderQuestionsCalisma();
}

function clearAllQuestionsCalisma(){
  if(!db.calismaQuestions.length)return;
  if(!confirm('Tüm sorular silinsin mi?'))return;
  db.calismaQuestions=[];calismaCnt=0;saveDebounced();renderQuestionsCalisma();
}

function delQCalisma(id){
  db.calismaQuestions=db.calismaQuestions.filter(function(q){return q.id!==id;});
  saveDebounced();renderQuestionsCalisma();if(_activeQId===id)closeQEdit();
}

function toggleQTypeCalisma(id){
  const q=db.calismaQuestions.find(function(qq){return qq.id===id;});
  if(!q||q.type==='section')return;
  if(q.type==='mc'){
    q.type='open';
    q.options={A:'',B:'',C:'',D:'',E:''};
    q.correct=null;
  }else if(q.type==='open'||q.type==='fill'){
    q.type='mc';
  }
  saveDebounced();renderQuestionsCalisma();
}

function toggleFullwidthCalisma(id){
  const q=db.calismaQuestions.find(function(qq){return qq.id===id;});
  if(!q)return;
  q.fullwidth=!q.fullwidth;
  saveDebounced();renderQuestionsCalisma();
}

function moveQCalisma(id,dir){
  const i=db.calismaQuestions.findIndex(function(q){return q.id===id;});
  const j=i+dir;if(j<0||j>=db.calismaQuestions.length)return;
  var tmp=db.calismaQuestions[i];
  db.calismaQuestions[i]=db.calismaQuestions[j];
  db.calismaQuestions[j]=tmp;
  saveDebounced();renderQuestionsCalisma();
}

function renderQuestionsCalisma(){
  const w=H('qlist-wrap-calisma');if(!w)return;
  const emp=H('q-empty-calisma');
  if(!db.calismaQuestions.length){w.innerHTML='';if(emp)emp.style.display='block';return;}
  if(emp)emp.style.display='none';
  var qNum=0;
  w.innerHTML=db.calismaQuestions.map(function(q,idx){
    if(q.type==='section')return '<div class="qcard section-card">'
      +'<div class="qcard-head"><div class="qcard-num">'+(idx+1)+'.</div><div style="flex:1;font-weight:700;color:var(--amber)">'+(q.title||'Bölüm')+'</div>'
      +'<button class="qcard-act del" onclick="delQCalisma(\''+q.id+'\')" title="Sil">✕</button></div></div>';
    qNum++;
    const typeMap={mc:'ÇS',open:'AÇ',fill:'BD'};const typeLabel=typeMap[q.type]||'?';
    const typeClass=q.type==='mc'?'mc':q.type==='open'?'open':'fill';
    const hasText=q.text&&q.text.replace(/<[^>]*>/g,'').trim();
    const preview=hasText?q.text:'(metin yok)';
    const imgCount=(q.images||[]).length;
    
    var firstImg=(q.images&&q.images.length)?q.images[0]:null;
    if(!firstImg&&hasText){
      const tmp=document.createElement('div');tmp.innerHTML=q.text;
      const inlineImg=tmp.querySelector('img');
      if(inlineImg)firstImg=inlineImg.src;
    }
    
    const opts=q.type==='mc'?'<div class="opts-bar">'+['A','B','C','D','E'].map(function(o){
      return '<div class="opt-dot'+(q.correct===o?' correct':(q.options&&q.options[o])?' has':'')+'" title="'+o+'">'+o+'</div>';
    }).join('')+'</div>':'';
    
    const imgPreview=firstImg?'<div class="qcard-img-wrap"><img src="'+firstImg+'"></div>':'';
    
    return '<div class="qcard '+(_activeQId===q.id?'active':'')+(q.fullwidth?' fullwidth':'')+'" onclick="openQEditCalisma(\''+q.id+'\')">'
      +'<div class="qcard-head">'
      +'<div class="qcard-num">'+qNum+'.</div>'
      +'<div class="qcard-type '+typeClass+'">'+typeLabel+'</div>'
      +'<div class="ml-a" style="display:flex;gap:4px;align-items:center">'
      +(q.fullwidth?'<span style="font-size:.65rem;color:var(--purple)" title="Tam genişlik">↔️</span>':'')
      +(imgCount?'<span style="font-size:.65rem;color:var(--blue)">📷'+imgCount+'</span>':'')
      +'</div>'
      +'</div>'
      +'<div class="qcard-content">'
      +imgPreview
      +(hasText?'<div class="qcard-preview-text">'+preview+'</div>':'')
      +(!hasText&&!firstImg?'<div class="qcard-preview-text" style="color:var(--text3);font-style:italic">Metin veya resim ekle</div>':'')
      +'</div>'
      +opts
      +'<div class="qcard-acts">'
      +'<button class="qcard-act" onclick="event.stopPropagation();moveQCalisma(\''+q.id+'\',-1)" title="Yukarı">↑</button>'
      +'<button class="qcard-act" onclick="event.stopPropagation();moveQCalisma(\''+q.id+'\',1)" title="Aşağı">↓</button>'
      +'<button class="qcard-act" onclick="event.stopPropagation();toggleQTypeCalisma(\''+q.id+'\')" title="Tip değiştir" style="font-size:.68rem">'+(q.type==='mc'?'→AÇ':q.type==='open'?'→ÇS':'→ÇS')+'</button>'
      +'<button class="qcard-act" onclick="event.stopPropagation();toggleFullwidthCalisma(\''+q.id+'\')" title="Tam genişlik">'+(q.fullwidth?'◧':'↔')+'</button>'
      +'<button class="qcard-act del" onclick="event.stopPropagation();delQCalisma(\''+q.id+'\')" title="Sil">✕</button>'
      +'</div>'
      +'</div>';
  }).join('');
}

// ============================================================
// KAYDETME / YÜKLEME / YÖNETİM (zkitap.js'ten)
// ============================================================
function saveCalismaPrompt(){
  const name=prompt('Çalışma adı:',currentCalismaName||'Fotoelektrik Çalışması');
  if(!name)return;
  saveCalisma(name);
}

function saveCalisma(name){
  const existing=db.savedCalisma.find(function(e){return e.name===name;});
  const saveData={
    name,
    date:new Date().toLocaleString('tr-TR'),
    questions:JSON.parse(JSON.stringify(db.calismaQuestions))
  };
  if(existing){
    Object.assign(existing,saveData);
  }else{
    db.savedCalisma.push(saveData);
  }
  currentCalismaName=name;
  saveDebounced();
  updateCalismaTitle();
  klbToast('✅ Çalışma kağıdı kaydedildi: '+name);
}

function loadCalisma(name){
  const cal=db.savedCalisma.find(function(e){return e.name===name;});
  if(!cal)return;
  if(db.calismaQuestions.length>0){
    if(!confirm('Mevcut sorular silinecek. Devam edilsin mi?'))return;
  }
  db.calismaQuestions=JSON.parse(JSON.stringify(cal.questions));
  currentCalismaName=name;
  calismaCnt=0;
  db.calismaQuestions.forEach(function(q){
    const n=parseInt((q.id||'').replace('c_',''))||0;
    if(n>=calismaCnt)calismaCnt=n+1;
  });
  saveDebounced();
  renderQuestionsCalisma();
  updateCalismaTitle();
  const dd=H('calisma-list-dropdown');if(dd)dd.style.display='none';
}

function newCalisma(){
  if(db.calismaQuestions.length>0){
    if(!confirm('Yeni çalışma başlatılsın mı? Mevcut sorular silinecek.'))return;
  }
  db.calismaQuestions=[];
  calismaCnt=0;
  currentCalismaName='';
  saveDebounced();
  renderQuestionsCalisma();
  updateCalismaTitle();
}

function deleteCalisma(name){
  if(!confirm('Bu çalışma silinsin mi?\n'+name))return;
  db.savedCalisma=db.savedCalisma.filter(function(e){return e.name!==name;});
  if(currentCalismaName===name){
    currentCalismaName='';
    updateCalismaTitle();
  }
  saveDebounced();
  renderCalismaList();
}

function toggleCalismaList(){
  const dd=H('calisma-list-dropdown');
  if(!dd)return;
  if(dd.style.display==='block'){
    dd.style.display='none';
  }else{
    renderCalismaList();
    dd.style.display='block';
  }
}

function renderCalismaList(){
  const dd=H('calisma-list-dropdown');
  if(!dd)return;
  if(!db.savedCalisma.length){
    dd.innerHTML='<div style="padding:12px;color:var(--text3);font-size:.8rem">Henüz kayıtlı çalışma yok</div>';
    return;
  }
  dd.innerHTML='<div style="padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;font-weight:700;color:var(--text2)">Kayıtlı Çalışmalar</div>'+
    db.savedCalisma.map(function(e){
      return '<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;cursor:pointer;transition:background .15s"'
        +'onmouseover="this.style.background=\'var(--bg0)\'" onmouseout="this.style.background=\'\'"'
        +'onclick="loadCalisma(\''+e.name.replace(/'/g,"\\'")+'\')" title="'+e.date+'">'
        +'<div style="flex:1">'
        +'<div style="font-weight:600;font-size:.85rem;color:var(--text)">'+e.name+'</div>'
        +'<div style="font-size:.7rem;color:var(--text3);margin-top:2px">'+e.date+' • '+e.questions.filter(function(q){return q.type!=='section';}).length+' soru</div>'
        +'</div>'
        +'<button onclick="event.stopPropagation();deleteCalisma(\''+e.name.replace(/'/g,"\\'")+'\')"'
        +'style="width:24px;height:24px;border-radius:50%;background:transparent;border:1px solid var(--border);color:var(--red);cursor:pointer;font-size:.7rem;padding:0"'
        +'onmouseover="this.style.background=\'var(--red)\';this.style.color=\'#fff\'"'
        +'onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--red)\'">✕</button>'
        +'</div>';
    }).join('');
}

function updateCalismaTitle(){
  const t=H('calisma-title-display');
  if(!t)return;
  if(currentCalismaName){
    t.textContent='📝 '+currentCalismaName;
    t.style.color='var(--blue)';
  }else{
    t.textContent='Çalışma Kağıdı';
    t.style.color='';
  }
}

// ============================================================
// ÖNİZLEME VE YAZDIRMA (zkitap.js'ten)
// ============================================================
function doPreviewCalisma(){
  const ex=H('preview-modal');if(ex){ex.remove();return;}
  if(!db.calismaQuestions.length){klbToast('Henüz soru eklenmedi.');return;}
  
  const modal=document.createElement('div');modal.id='preview-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden';
  
  const s=db.settings||{};
  const addLines=H('opt-lines')?H('opt-lines').checked:false;
  const sutun=s.sutunSayisi||1;
  const filigran=s.filigran||'';
  const wmOpacity=(s.filigranOpaklik||8)/100;
  const colRule=s.colRule||'none';
  const colText=s.colText||'';
  const akPos=s.cevapAnahtariPos||'none';
  const wmHtml=filigran?'<div class="p-watermark" style="opacity:'+wmOpacity+'">'+filigran+'</div>':'';
  const smartLayout=H('opt-smart-calisma')&&H('opt-smart-calisma').checked;
  
  var qNum=0;
  const qsHtml=db.calismaQuestions.map(function(q){
    if(q.type==='section')return '<div style="font-size:14pt;font-weight:700;color:#f59e0b;margin:20pt 0 10pt;border-bottom:2px solid #f59e0b;padding-bottom:4pt">'+q.title+'</div>';
    qNum++;
    const hasText=q.text&&q.text.trim();
    const hasImgs=q.images&&q.images.length;
    const imgHtml=hasImgs?'<div class="pq-imgs">'+q.images.map(function(src){return '<img class="pq-img" src="'+src+'">';}).join('')+'</div>':'';
    
    var html='<div class="pq'+(q.fullwidth?' fullwidth':'')+'" style="margin-bottom:'+(parseInt(q.bosluk||0)*18+20)+'pt;page-break-inside:avoid">';
    html+='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6pt">';
    html+='<span style="font-weight:700;font-size:11pt">'+qNum+'.</span>';
    html+='</div>';
    
    if(hasText){
      const qText=cleanForPrint?cleanForPrint(q.text,sutun):q.text;
      html+='<div style="margin-bottom:8pt;line-height:1.6">'+qText+'</div>';
    }
    
    if(hasImgs)html+=imgHtml;
    
    if(q.type==='mc'&&!q.siklarResimde){
      html+='<div class="pq-opts">';
      ['A','B','C','D','E'].forEach(function(k){
        if(q.options[k])html+='<div class="pq-opt"><b>'+k+')</b> '+q.options[k]+'</div>';
      });
      html+='</div>';
    }
    
    if((q.type==='open'||q.type==='fill')&&addLines){
      const lc=parseInt(s.linesCount)||6;
      const gridH=lc*6;
      html+='<div class="pq-grid" style="height:'+gridH+'mm"></div>';
    }
    
    html+='</div>';
    return html;
  }).join('');
  
  var colRuleClass='';
  if(sutun>1){
    if(colRule==='line')colRuleClass=' pq-col-rule';
    else if(colRule==='dash')colRuleClass=' pq-col-rule-dash';
  }
  
  const colTextHtml=colText&&sutun>1?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);writing-mode:vertical-lr;text-orientation:upright;background:#fff;padding:6pt 2pt;font-size:7.5pt;color:#888;letter-spacing:4pt;z-index:2;white-space:nowrap;line-height:1">'+colText+'</div>':'';
  const smartStyle=smartLayout&&sutun>1?' style="column-fill:balance;orphans:3;widows:3"':'';
  const akPageHtml=akPos==='page'?buildAnswerKeyCalisma():'';
  
  const marginMap={dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'};
  const padding=marginMap[s.kenarBoslugu||'normal'];
  
  const contentHtml='<div class="ppage" style="padding:'+padding+';background:#fff;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.4);position:relative">'
    +wmHtml
    +'<div style="text-align:center;font-size:14pt;font-weight:700;margin-bottom:4pt">'+(s.okulAdi||'')+'</div>'
    +'<div style="text-align:center;font-size:12pt;font-weight:600;margin-bottom:8pt;color:#3b82f6">'+(currentCalismaName||'Çalışma Kağıdı')+'</div>'
    +'<div style="text-align:center;font-size:10pt;color:#666;margin-bottom:12pt">'+(s.dersAdi||'')+' • '+new Date().toLocaleDateString('tr-TR')+'</div>'
    +'<hr style="border:none;border-top:2px solid #ddd;margin:12pt 0">'
    +'<div style="position:relative">'+colTextHtml+'<div class="pq-container cols-'+sutun+colRuleClass+'"'+smartStyle+'>'+qsHtml+'</div></div>'
    +akPageHtml
    +'</div>';
  
  var hdr='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#0a1020;border-bottom:1px solid #1e2d4a;flex-shrink:0">'
    +'<span style="font-weight:800;color:#e2e8f8">👁️ Önizleme - Çalışma Kağıdı</span>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="doPrintCalisma()" style="padding:5px 14px;border-radius:6px;background:#22c55e;border:none;color:#000;cursor:pointer;font-weight:700;font-size:.8rem">🖨️ Yazdır</button>'
    +'<button onclick="H(\'preview-modal\').remove()" style="padding:5px 12px;border-radius:6px;background:#ef4444;border:none;color:#fff;cursor:pointer;font-weight:700;font-size:.8rem">✕ Kapat</button>'
    +'</div></div>';
  var body='<div style="flex:1;overflow:auto;background:#ccc;padding:20px">'+contentHtml+'</div>';
  modal.innerHTML=hdr+body;
  document.body.appendChild(modal);
}

function doPrintCalisma(){
  const s=db.settings||{};
  const addLines=H('opt-lines')?H('opt-lines').checked:false;
  const sutun=s.sutunSayisi||1;
  const filigran=s.filigran||'';
  const wmOpacity=(s.filigranOpaklik||8)/100;
  const colRule=s.colRule||'none';
  const colText=s.colText||'';
  const akPos=s.cevapAnahtariPos||'none';
  const marginMap={dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'};
  const padding=marginMap[s.kenarBoslugu||'normal'];
  const wmHtml=filigran?'<div class="p-watermark" style="opacity:'+wmOpacity+'">'+filigran+'</div>':'';
  const smartLayout=H('opt-smart-calisma')&&H('opt-smart-calisma').checked;
  
  var qNum=0;
  const qsHtml=db.calismaQuestions.map(function(q){
    if(q.type==='section')return '<div style="font-size:14pt;font-weight:700;color:#f59e0b;margin:20pt 0 10pt;border-bottom:2px solid #f59e0b;padding-bottom:4pt">'+q.title+'</div>';
    qNum++;
    const hasText=q.text&&q.text.trim();
    const hasImgs=q.images&&q.images.length;
    const imgHtml=hasImgs?'<div class="pq-imgs">'+q.images.map(function(src){return '<img class="pq-img" src="'+src+'">';}).join('')+'</div>':'';
    
    var html='<div class="pq'+(q.fullwidth?' fullwidth':'')+'" style="margin-bottom:'+(parseInt(q.bosluk||0)*18+20)+'pt;page-break-inside:avoid">';
    html+='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6pt">';
    html+='<span style="font-weight:700;font-size:11pt">'+qNum+'.</span>';
    html+='</div>';
    
    if(hasText){
      const qText=cleanForPrint?cleanForPrint(q.text,sutun):q.text;
      html+='<div style="margin-bottom:8pt;line-height:1.6">'+qText+'</div>';
    }
    
    if(hasImgs)html+=imgHtml;
    
    if(q.type==='mc'&&!q.siklarResimde){
      html+='<div class="pq-opts">';
      ['A','B','C','D','E'].forEach(function(k){
        if(q.options[k])html+='<div class="pq-opt"><b>'+k+')</b> '+q.options[k]+'</div>';
      });
      html+='</div>';
    }
    
    if((q.type==='open'||q.type==='fill')&&addLines){
      const lc=parseInt(s.linesCount)||6;
      const gridH=lc*6;
      html+='<div class="pq-grid" style="height:'+gridH+'mm"></div>';
    }
    
    html+='</div>';
    return html;
  }).join('');
  
  var colRuleClass='';
  if(sutun>1){
    if(colRule==='line')colRuleClass=' pq-col-rule';
    else if(colRule==='dash')colRuleClass=' pq-col-rule-dash';
  }
  
  const colTextHtml=colText&&sutun>1?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);writing-mode:vertical-lr;text-orientation:upright;background:#fff;padding:6pt 2pt;font-size:7.5pt;color:#888;letter-spacing:4pt;z-index:2;white-space:nowrap;line-height:1">'+colText+'</div>':'';
  const smartStyle=smartLayout&&sutun>1?' style="column-fill:balance;orphans:3;widows:3"':'';
  const akPageHtml=akPos==='page'?buildAnswerKeyCalisma():'';
  
  const printHtml='<div class="ppage" style="padding:'+padding+'">'
    +wmHtml
    +'<div style="text-align:center;font-size:14pt;font-weight:700;margin-bottom:4pt">'+(s.okulAdi||'')+'</div>'
    +'<div style="text-align:center;font-size:12pt;font-weight:600;margin-bottom:8pt;color:#3b82f6">'+(currentCalismaName||'Çalışma Kağıdı')+'</div>'
    +'<div style="text-align:center;font-size:10pt;color:#666;margin-bottom:12pt">'+(s.dersAdi||'')+' • '+new Date().toLocaleDateString('tr-TR')+'</div>'
    +'<hr style="border:none;border-top:2px solid #ddd;margin:12pt 0">'
    +'<div style="position:relative">'+colTextHtml+'<div class="pq-container cols-'+sutun+colRuleClass+'"'+smartStyle+'>'+qsHtml+'</div></div>'
    +akPageHtml
    +'</div>';
  
  const akEndPage=akPos==='end'?buildAnswerKeyPageCalisma():'';
  
  H('print-output').innerHTML=printHtml+akEndPage;
  window.print();
}

function buildAnswerKeyCalisma(){
  const mcQs=db.calismaQuestions.filter(function(q){return q.type==='mc';});
  if(!mcQs.length)return'';
  var num=0;
  const rows=db.calismaQuestions.map(function(q){
    if(q.type==='section')return'';
    num++;
    if(q.type!=='mc')return'';
    const ans=q.correct||'?';
    return '<span style="display:inline-flex;align-items:center;gap:2pt;margin:1pt 3pt;font-size:7.5pt">'
      +'<b>'+num+'.</b><span style="width:14pt;height:14pt;border-radius:50%;background:'+(ans==='?'?'#aaa':'#1a7f37')+';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:7pt">'+ans+'</span>'
      +'</span>';
  }).join('');
  return '<div style="border-top:1px solid #555;margin-top:10pt;padding-top:5pt;font-size:7.5pt;color:#333"><b>CEVAP ANAHTARI:</b> '+rows+'</div>';
}

function buildAnswerKeyPageCalisma(){
  const mcQs=db.calismaQuestions.filter(function(q){return q.type==='mc';});
  if(!mcQs.length)return'';
  var num=0;
  const rows=db.calismaQuestions.map(function(q){
    if(q.type==='section')return'';
    num++;
    if(q.type!=='mc')return'';
    const ans=q.correct||'?';
    return '<div style="display:inline-flex;align-items:center;gap:3pt;margin:3pt 5pt">'
      +'<b style="font-size:.9em">'+num+'.</b>'
      +'<span style="width:18pt;height:18pt;border-radius:50%;background:'+(ans==='?'?'#aaa':'#1a7f37')+';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:.8em">'+ans+'</span>'
      +'</div>';
  }).join('');
  return '<div class="ppage" style="padding:15mm 20mm;page-break-before:always">'
    +'<div style="font-size:13pt;font-weight:800;margin-bottom:10pt;border-bottom:2pt solid #333;padding-bottom:5pt">📋 CEVAP ANAHTARI — '+(currentCalismaName||'Çalışma Kağıdı')+'</div>'
    +'<div style="display:flex;flex-wrap:wrap">'+rows+'</div>'
    +'</div>';
}

// ============================================================
// PRINT AYARLARI (print.js'ten)
// ============================================================
function setMargin(v){db.settings.kenarBoslugu=v;saveDebounced();['dar','normal','genis'].forEach(function(m){const el=H('mar-'+m);if(el)el.classList.toggle('active',m===v);});}
function setSutun(n){db.settings.sutunSayisi=n;saveDebounced();[1,2,3].forEach(function(i){const el=H('col-'+i);if(el)el.classList.toggle('active',i===n);});}
function setColRule(v){db.settings.colRule=v;saveDebounced();['none','line','dash'].forEach(function(r){const el=H('cr-'+r);if(el)el.classList.toggle('active',r===v);});}

function saveS(){
  const s=db.settings||{};
  const setF=function(id){const el=H(id);if(el){s[id.replace('opt-lines-count','linesCount')]=el.value;}};
  if(H('filigran-txt'))s.filigran=H('filigran-txt').value;
  if(H('filigran-op'))s.filigranOpaklik=parseInt(H('filigran-op').value)||8;
  if(H('col-text'))s.colText=H('col-text').value;
  if(H('opt-lines'))s.linesAdd=H('opt-lines').checked;
  if(H('opt-lines-count'))s.linesCount=parseInt(H('opt-lines-count').value)||6;
  if(H('opt-smart-calisma'))s.smartLayout=H('opt-smart-calisma').checked;
  const caEl=document.querySelector('input[name="ca-calisma"]:checked');
  if(caEl)s.cevapAnahtariPos=caEl.value;
  saveDebounced();
}

function loadSettings(){
  const s=db.settings||{};
  const set=function(id,v){const el=H(id);if(el&&v!==undefined)el.value=v;};
  set('filigran-txt',s.filigran);set('filigran-op',s.filigranOpaklik||8);
  set('col-text',s.colText);
  set('opt-lines-count',s.linesCount||6);
  if(H('opt-lines'))H('opt-lines').checked=!!s.linesAdd;
  if(H('opt-smart-calisma'))H('opt-smart-calisma').checked=!!s.smartLayout;
  if(H('fil-op-val'))H('fil-op-val').textContent=(s.filigranOpaklik||8)+'%';
  // Margin
  ['dar','normal','genis'].forEach(function(m){const el=H('mar-'+m);if(el)el.classList.toggle('active',m===(s.kenarBoslugu||'normal'));});
  // Columns
  [1,2,3].forEach(function(n){const el=H('col-'+n);if(el)el.classList.toggle('active',n===(s.sutunSayisi||1));});
  // Col rule
  ['none','line','dash'].forEach(function(r){const el=H('cr-'+r);if(el)el.classList.toggle('active',r===(s.colRule||'none'));});
  // Answer key
  const ca=s.cevapAnahtariPos||'none';
  document.querySelectorAll('input[name="ca-calisma"]').forEach(function(r){r.checked=r.value===ca;});
}

// ============================================================
// DOSYAYA KAYDETME VE YÜKLEME (zkitap.js'ten)
// ============================================================
function saveCalismaToFile(){
  if(!db.calismaQuestions||db.calismaQuestions.length===0){
    klbToast('⚠️ Kaydedilecek soru yok!'); return;
  }
  
  const defName = (currentCalismaName||db.settings.sinavBasligi||'CalismaKagidi')
    .replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_').trim() || 'CalismaKagidi';

  klbAskName(defName, 'Çalışma Sayfasını Kaydet', function(name){
    const payload = {
      app: (typeof KLB_APP_ID !== 'undefined' ? KLB_APP_ID : 'kelebek'),
      type: 'worksheet',
      version: '2.0',
      savedAt: new Date().toISOString(),
      fileName: name,
      calismaQuestions: db.calismaQuestions||[],
      savedCalisma: db.savedCalisma||[],
      currentCalismaName: currentCalismaName,
      calismaCnt: calismaCnt,
      settings: {
        okulAdi: db.settings.okulAdi||'',
        dersAdi: db.settings.dersAdi||'',
        sinavBasligi: db.settings.sinavBasligi||'',
        sinavTarihi: db.settings.sinavTarihi||'',
        sinifSube: db.settings.sinifSube||'',
        ogretmenAdi: db.settings.ogretmenAdi||'',
        notlarCalisma: db.settings.notlarCalisma||'',
        filigran: db.settings.filigran||'',
        filigranOpaklik: db.settings.filigranOpaklik||8,
        teachers: db.settings.teachers||[]
      }
    };
    const content = (typeof klbEncode !== 'undefined' ? klbEncode(payload) : JSON.stringify(payload));
    const safeFilename = name.replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_');
    klbDownload(content, safeFilename + '.klb');
    klbToast('✅ Kaydedildi: '+safeFilename+'.klb', 'success');
  });
}

function loadCalismaFromFile(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='.klb,.json,.kdb,.db';
  
  input.onchange=function(e){
    const file=e.target.files[0];
    if(!file)return;
    
    var ext=file.name.split('.').pop().toLowerCase();
    
    if(ext==='klb'){
      const reader3=new FileReader();
      reader3.onload=function(ev3){
        try{
          var data=(typeof klbDecode !== 'undefined' ? klbDecode(ev3.target.result) : JSON.parse(ev3.target.result));
          var qs=data.calismaQuestions||data.questions||[];
          if(!qs.length){klbToast('⚠️ Dosyada soru bulunamadı!');return;}
          if(db.calismaQuestions.length>0){
            if(!confirm('Mevcut sorular silinecek. Devam?'))return;
          }
          db.calismaQuestions=qs;
          currentCalismaName=data.fileName||data.groupName||file.name.replace(/\.[^.]+$/,'');
          calismaCnt=0;
          qs.forEach(function(q){var n=parseInt((q.id||'').replace('c_',''))||0;if(n>=calismaCnt)calismaCnt=n+1;});
          if(data.settings)Object.assign(db.settings,data.settings);
          saveDebounced();loadSettings();renderQuestionsCalisma();updateCalismaTitle();
          klbToast('✅ KLB dosyasından yüklendi!\n'+qs.length+' soru');
        }catch(err){klbToast('❌ KLB dosyası okunamadı!\n'+err.message);}
      };
      reader3.readAsText(file);
      return;
    }
    
    if(ext==='db'){
      const reader2=new FileReader();
      reader2.onload=function(ev2){
        try{
          var buf=ev2.target.result;
          const zipFiles =(typeof parseZipEntries !== 'undefined' ? parseZipEntries(new Uint8Array(buf)) : {});
          if(!zipFiles['config.json']){klbToast('⚠️ Geçersiz .db dosyası!');return;}
          var config=JSON.parse(new TextDecoder('utf-8').decode(zipFiles['config.json']));
          if(!config.questions||!config.questions.length){klbToast('⚠️ Dosyada soru bulunamadı!');return;}
          if(db.calismaQuestions.length>0){
            if(!confirm('Mevcut sorular silinecek. .db dosyasından yüklensin mi?'))return;
          }
          const converted=[];
          config.questions.forEach(function(extQ,idx){
            var editorHtml=(extQ.editor&&extQ.editor.html)?extQ.editor.html:'';
            var rid=extQ.randomid||'';
            if(!editorHtml&&rid&&zipFiles[rid+'.jpg']){
              var b64=(typeof uint8ToBase64 !== 'undefined' ? uint8ToBase64(zipFiles[rid+'.jpg']) : '');
              editorHtml='<p><img src="data:image/jpeg;base64,'+b64+'" style="max-width:100%"></p>';
            }
            converted.push({
              id:'c_'+Date.now()+'_'+idx,type:'open',text:editorHtml,title:'',
              puan:Math.round((extQ.multiplier||1)*10),bosluk:0,options:{},correct:'',images:[],fullwidth:false
            });
          });
          db.calismaQuestions=converted;
          currentCalismaName=file.name.replace(/\.db$/i,'');
          calismaCnt=converted.length;
          saveDebounced();renderQuestionsCalisma();updateCalismaTitle();
          klbToast('✅ .db dosyasından yüklendi!\n'+converted.length+' soru');
        }catch(err){klbToast('❌ .db dosyası okunamadı!\n'+err.message);}
      };
      reader2.readAsArrayBuffer(file);
      return;
    }
    
    const reader=new FileReader();
    reader.onload=function(event){
      try{
        const data=JSON.parse(event.target.result);
        
        var qs = data.calismaQuestions || data.questions || [];
        if(!qs.length){
          klbToast('⚠️ Bu dosyada soru bulunamadı!');
          return;
        }
        
        if(db.calismaQuestions.length>0){
          if(!confirm('Mevcut sorular silinecek. Dosyadan yüklensin mi?'))return;
        }
        
        db.calismaQuestions=qs;
        currentCalismaName=data.fileName||data.name||data.groupName||file.name.replace(/\.[^.]+$/,'');
        
        if(data.settings){
          Object.assign(db.settings,data.settings);
        }
        
        calismaCnt=0;
        db.calismaQuestions.forEach(function(q){
          var n=parseInt((q.id||'').replace('c_',''))||0;
          if(n>=calismaCnt)calismaCnt=n+1;
        });
        
        saveDebounced();
        loadSettings();
        renderQuestionsCalisma();
        updateCalismaTitle();
        
        klbToast('✅ Dosyadan yüklendi: '+(data.name||file.name)+'\n'+db.calismaQuestions.length+' soru');
        
      }catch(err){
        klbToast('❌ Dosya okunamadı!\n'+err.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

// ============================================================
// KEYBOARD HANDLERS + EVENT LISTENERS
// ============================================================
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    const pm=H('preview-modal');if(pm){pm.remove();return;}
    const fm=H('frac-modal');if(fm){fm.remove();return;}
    const gm=H('graph-modal');if(gm){gm.remove();return;}
    if(_activeQId){closeQEdit();return;}
  }
  // we-area içinde backspace/delete — kesir/atom span'ını silme
  if((e.key==='Backspace'||e.key==='Delete')&&H('we-area')){
    const we=H('we-area');
    const sel=window.getSelection();if(!sel||!sel.rangeCount)return;
    const node=sel.getRangeAt(0).startContainer;
    if(!we.contains(node))return;
    var el=node.nodeType===3?node.parentElement:node;
    while(el&&el!==we){
      const ds=window.getComputedStyle(el).display;
      if(ds==='inline-flex'||ds==='flex'){
        e.preventDefault();el.remove();qeditSaveText();return;
      }
      el=el.parentElement;
    }
  }
});

// filigran opaklık live update
document.addEventListener('input',function(e){
  if(e.target.id==='filigran-op'){if(H('fil-op-val'))H('fil-op-val').textContent=e.target.value+'%';saveS();}
  if(e.target.id==='col-text'||e.target.id==='filigran-txt')saveS();
});

// ============================================================
// CTRL+V AUTO-PASTE SORU OLUŞTURMA (Çalışma Kağıdı)
// ============================================================
document.addEventListener('paste',function(e){
  const target=e.target;
  const qlistWrap=target.closest('#qlist-wrap-calisma');
  
  if(!qlistWrap)return;
  if(target.closest('#we-area'))return;
  
  const text=(e.clipboardData||window.clipboardData).getData('text');
  if(!text||text.trim().length===0)return;
  
  e.preventDefault();
  
  const id='c_'+(calismaCnt++);
  db.calismaQuestions.push({
    id,type:'open',text:text.trim(),options:{A:'',B:'',C:'',D:'',E:''},
    correct:null,siklarResimde:false,bosluk:0,images:[]
  });
  saveDebounced();
  renderQuestionsCalisma();
  openQEditCalisma(id);
});

// ============================================================
// INIT
// ============================================================
function initCalismaKagidi(){
  if(!db.calismaQuestions)db.calismaQuestions=[];
  if(!db.savedCalisma)db.savedCalisma=[];
  if(!db.settings)db.settings={};
  
  // Sayaçları senkronize et
  calismaCnt=0;
  db.calismaQuestions.forEach(function(q){
    var n=parseInt((q.id||'').replace('c_',''))||0;
    if(n>=calismaCnt)calismaCnt=n+1;
  });
  
  loadSettings();
  renderQuestionsCalisma();
  updateCalismaTitle();
  weTabSwitch('mat',null);
}

document.addEventListener('DOMContentLoaded',function(){
  initCalismaKagidi();
});

// ============================================================
// ☁️ BULUTA ÇALIŞMA KAĞIDI KAYDET / ÇEK (.clk) — ortak student-cloud.js
// ============================================================
function clkSaveToCloud(){
  if(typeof doaSaveFor !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  var qs = db.calismaQuestions || [];
  if(!qs.length){ klbToast('Önce çalışma kağıdına soru ekleyin','error'); return; }
  doaSaveFor('calisma', { calismaQuestions: qs, savedCalisma: db.savedCalisma || [], settings: db.settings || {} }, function(ok, fn){
    if(ok) klbToast('☁️ Çalışma kağıdı buluta kaydedildi: '+fn, 'success');
  });
}
function clkLoadFromCloud(){
  if(typeof doaOpenPickerFor !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  doaOpenPickerFor('calisma', function(data, fileName){
    var p = data.payload || data;
    var qs = p.calismaQuestions;
    if(!qs || !qs.length){ klbToast('Bu dosyada çalışma kağıdı verisi yok','error'); return; }
    db.calismaQuestions = qs;
    if(p.savedCalisma) db.savedCalisma = p.savedCalisma;
    if(p.settings) db.settings = Object.assign(db.settings || {}, p.settings);
    if(typeof saveDebounced === 'function') saveDebounced();
    if(typeof renderCalismaQuestions === 'function') renderCalismaQuestions();
    if(typeof renderCalisma === 'function') renderCalisma();
    klbToast('✅ '+qs.length+' soru yüklendi', 'success');
  });
}
