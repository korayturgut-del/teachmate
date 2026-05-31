/* ============================================================
   SINAV EDİTÖRÜ MODÜLÜ JS — Kelebek Platform V2
   Bağımsız çalışabilir. Ortak: ../shared/js/*
   Orijinalden birebir kopya: exam-groups.js + editor.js + zkitap.js
   ============================================================ */

// ── Cross-module stubs (bağımsızlık için) ──
function renderKChecks(){}  // Kelebek dağıtım stub
function saveS(){}          // Çıktı ayarları stub
function renderQuestions(){} // Ana editör stub (grup modunda çalışıyoruz)
function renderQuestionsCalisma(){} // Çalışma kağıdı stub
function updatePts(){}      // Ana editör puan stub
if(!window.cssAutoUpload) window.cssAutoUpload=function(){};
if(!window.cssUploadStudentsToCloud) window.cssUploadStudentsToCloud=function(){};

// ── State ──
var activeExamGroup = null;
var _activeQId = null;
var _weSavedRange = null;
var _qeditFullscreen = false;

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
// Event delegation for sym buttons
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
  for(let i=0;i<items.length;i++){
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
  let ex=H('frac-modal');if(ex)ex.remove();
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
// LİMİT / LOGARİTMA / EXP (students.js'ten)
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
    +'<button class="btn btn-primary" onclick="insertGraph()">✅ Editöre Ekle</button>'
    +'<button class="btn btn-ghost" onclick="H(\'graph-modal\').remove()">İptal</button>'
    +'</div></div>';
  modal.innerHTML=gModalHTML;
  document.body.appendChild(modal);
  modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
  setTimeout(function(){
    const gp=H('g-presets');
    if(gp){
      const presets=[['Doğru','x'],['Parabol','x*x'],['Sinüs','sin(x)'],['Kosinüs','cos(x)'],
        ['Mutlak','abs(x)'],['Kök','sqrt(abs(x))'],['Üstel','Math.exp(x)'],['1/x','1/x']];
      presets.forEach(function(p){
        const btn=document.createElement('button');
        btn.className='btn btn-ghost btn-xs';btn.textContent=p[0];
        btn.onclick=function(){gAddPreset(p[1]);};
        gp.appendChild(btn);
      });
    }
    drawGraph();H('gfn-input')&&H('gfn-input').focus();
  },80);
}

const GCOLS =['#e11d48','#2563eb','#16a34a','#ca8a04','#7c3aed','#0891b2'];
function gAddPreset(f){
  const inp=H('gfn-input');if(!inp)return;
  const cur=inp.value.trim();
  inp.value=cur?(cur+'\n'+f):f;
  drawGraph();
}
function drawGraph(){
  const canvas=H('graph-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H2=canvas.height;
  const xmin=parseFloat(H('gx-min').value)||-6;
  const xmax=parseFloat(H('gx-max').value)||6;
  const ymin=parseFloat(H('gy-min').value)||-4;
  const ymax=parseFloat(H('gy-max').value)||4;
  const showGrid=H('g-grid').checked;
  const showAxes=H('g-axes').checked;
  const showLabels=H('g-labels').checked;
  const errEl=H('graph-err');if(errEl)errEl.textContent='';

  ctx.clearRect(0,0,W,H2);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H2);

  const toX=function(x){return((x-xmin)/(xmax-xmin))*W;};
  const toY=function(y){return H2-((y-ymin)/(ymax-ymin))*H2;};
  const dx=(xmax-xmin),dy=(ymax-ymin);

  if(showGrid){
    ctx.strokeStyle='#e5e7eb';ctx.lineWidth=0.8;
    const gs=niceStep(dx/8);
    for(var x=Math.ceil(xmin/gs)*gs;x<=xmax;x+=gs){
      ctx.beginPath();ctx.moveTo(toX(x),0);ctx.lineTo(toX(x),H2);ctx.stroke();
    }
    const gsy=niceStep(dy/6);
    for(var y=Math.ceil(ymin/gsy)*gsy;y<=ymax;y+=gsy){
      ctx.beginPath();ctx.moveTo(0,toY(y));ctx.lineTo(W,toY(y));ctx.stroke();
    }
  }
  if(showAxes){
    ctx.strokeStyle='#374151';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,toY(0));ctx.lineTo(W,toY(0));ctx.stroke();
    ctx.beginPath();ctx.moveTo(toX(0),0);ctx.lineTo(toX(0),H2);ctx.stroke();
    ctx.fillStyle='#374151';
    ctx.beginPath();ctx.moveTo(W,toY(0));ctx.lineTo(W-8,toY(0)-4);ctx.lineTo(W-8,toY(0)+4);ctx.fill();
    ctx.beginPath();ctx.moveTo(toX(0),0);ctx.lineTo(toX(0)-4,8);ctx.lineTo(toX(0)+4,8);ctx.fill();
    if(showLabels){
      ctx.fillStyle='#374151';ctx.font='11px Arial';ctx.textAlign='center';
      const step=niceStep(dx/6);
      for(var x=Math.ceil(xmin/step)*step;x<=xmax;x+=step){
        if(Math.abs(x)<step*0.01)continue;
        const px=toX(x),py=toY(0);
        ctx.beginPath();ctx.moveTo(px,py-3);ctx.lineTo(px,py+3);ctx.stroke();
        if(py+16<H2)ctx.fillText(fmtNum(x),px,py+14);else ctx.fillText(fmtNum(x),px,py-6);
      }
      ctx.textAlign='right';
      const stepy=niceStep(dy/5);
      for(var y=Math.ceil(ymin/stepy)*stepy;y<=ymax;y+=stepy){
        if(Math.abs(y)<stepy*0.01)continue;
        const px=toX(0),py=toY(y);
        ctx.beginPath();ctx.moveTo(px-3,py);ctx.lineTo(px+3,py);ctx.stroke();
        if(px-5>0)ctx.fillText(fmtNum(y),px-5,py+4);
      }
      ctx.fillStyle='#1e40af';ctx.textAlign='left';
      ctx.font='bold 12px Arial';ctx.fillText('x',W-6,toY(0)-6);
      ctx.textAlign='center';ctx.fillText('y',toX(0)+10,8);
    }
  }

  const lines=(H('gfn-input').value||'').split('\n').map(function(l){return l.trim();}).filter(Boolean);
  const errs=[];
  lines.forEach(function(line,fi){
    var fn;
    try{
      const expr=line
        .replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan')
        .replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/ln/g,'Math.log')
        .replace(/log/g,'Math.log10').replace(/exp/g,'Math.exp').replace(/pi/g,'Math.PI')
        .replace(/e(?![a-zA-Z])/g,'Math.E').replace(/\^/g,'**');
      fn=new Function('x','return '+expr);
      fn(0);
    }catch(e){errs.push(line+': '+e.message);return;}
    ctx.strokeStyle=GCOLS[fi%GCOLS.length];ctx.lineWidth=2.2;ctx.lineJoin='round';
    ctx.beginPath();var first=true;
    const steps=W*2;
    for(var i=0;i<=steps;i++){
      const x=xmin+(i/steps)*(xmax-xmin);
      var y;try{y=fn(x);}catch(e){first=true;continue;}
      if(!isFinite(y)||isNaN(y)){first=true;continue;}
      const px=i/2,py=toY(y);
      if(py<-H2||py>H2*2){first=true;continue;}
      if(first){ctx.moveTo(px,py);first=false;}else ctx.lineTo(px,py);
    }
    ctx.stroke();
    if(showLabels){
      ctx.font='bold 11px Arial';ctx.fillStyle=GCOLS[fi%GCOLS.length];
      ctx.textAlign='left';
      ctx.fillText('f(x)='+line,6,14+fi*14);
    }
  });
  if(errs.length&&errEl)errEl.textContent='Hata: '+errs.join(' | ');
}
function niceStep(rough){
  const mag=Math.pow(10,Math.floor(Math.log10(Math.abs(rough))));
  const n=rough/mag;
  if(n<1.5)return mag;if(n<3)return 2*mag;if(n<7)return 5*mag;return 10*mag;
}
function fmtNum(n){
  if(Math.abs(n)<0.0001||Math.abs(n)>9999)return n.toExponential(1);
  return parseFloat(n.toFixed(3)).toString();
}
function insertGraph(){
  const canvas=H('graph-canvas');if(!canvas)return;
  const src=canvas.toDataURL('image/png');
  H('graph-modal').remove();
  const we=H('we-area');if(!we)return;
  we.focus();
  if(_weSavedRange){try{const s=window.getSelection();s.removeAllRanges();s.addRange(_weSavedRange);}catch(e){}}
  document.execCommand('insertHTML',false,'<img src="'+src+'" class="we-inline-img" style="display:block;margin:6px 0;max-width:100%;border:1px solid #ccc;border-radius:4px;cursor:pointer" title="Graf">');
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
// RESİM ÜZERİNE ÇİZİM (FABRIC.JS) — editor-canvas.js'ten birebir
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
        shape._startX = p.x;
        shape._startY = p.y;
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
  const arrowPath = new fabric.Path(feArrowPath(0, 20, 60, 20, 3), {
    fill: color, stroke: color, strokeWidth: 1
  });
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
// SORU DÜZENLEME PANELİ
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
  if(!silent){
    if(activeExamGroup){
      var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
      if(group)renderGroupQuestions(group);
    }
  }
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
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const we=H('we-area');
  if(!we)return;
  if(q.type==='section'){
    q.title=we.innerHTML||'';
  } else {
    q.text=we.innerHTML||'';
  }
  saveDebounced();
  renderGroupQuestions(group);
}

function qeditSavePuan(){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const pp=H('qedit-puan');
  if(!pp)return;
  q.puan=parseFloat(pp.value)||0;
  saveDebounced();
  updateGroupPts(group);
  renderGroupQuestions(group);
}

function qeditSaveAciklama(){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  q.aciklama=H('qedit-aciklama')?H('qedit-aciklama').value:'';
  saveDebounced();
}

function qeditSaveBosluk(){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const bp=H('qedit-bosluk');
  if(!bp)return;
  q.bosluk=parseInt(bp.value)||0;
  saveDebounced();
}

function qEditNav(dir){
  if(!_activeQId||!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const idx=group.questions.findIndex(function(q){return q.id===_activeQId;});
  const nidx=idx+dir;
  if(nidx<0||nidx>=group.questions.length)return;
  openGroupQEdit(group.questions[nidx].id);
}

// ============================================================
// RESİM YÖNETİMİ
// ============================================================
function qAddImgFile(inp){
  const file=inp.files[0];if(!file)return;
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  const reader=new FileReader();
  reader.onload=function(e){
    if(!q.images)q.images=[];
    q.images.push(e.target.result);
    saveDebounced();
    openGroupQEdit(_activeQId,true);
    renderGroupQuestions(group);
  };
  reader.readAsDataURL(file);
  inp.value='';
}

function qDelImgGroup(idx){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q||!q.images)return;
  q.images.splice(idx,1);
  saveDebounced();
  openGroupQEdit(_activeQId,true);
  renderGroupQuestions(group);
}

function qAddImgFileToGroup(inp,qid){
  const file=inp.files[0];
  if(!file)return;
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const id=qid||_activeQId;
  const q=group.questions.find(function(qq){return qq.id===id;});
  if(!q)return;
  const reader=new FileReader();
  reader.onload=function(e){
    if(!q.images)q.images=[];
    q.images.push(e.target.result);
    saveDebounced();
    openGroupQEdit(id,true);
    renderGroupQuestions(group);
  };
  reader.readAsDataURL(file);
  inp.value='';
}

function imgEditorOpen(qid,idx){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===qid;});
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
// openGroupQEdit (zkitap.js'ten birebir)
// ============================================================
function openGroupQEdit(qid,silent){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===qid;});
  if(!q)return;
  _activeQId=qid;
  const panel=H('qedit-panel');
  if(!panel)return;

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
    const pp=H('qedit-puan');if(pp)pp.value=q.puan||0;
    const ac2=H('qedit-aciklama');if(ac2)ac2.value=q.aciklama||'';
    const bp=H('qedit-bosluk');if(bp){bp.value=q.bosluk||0;const bv=H('bosluk-val');if(bv)bv.textContent=q.bosluk||0;}
    panel.style.display='flex';
    document.body.style.overflow='hidden';
    setTimeout(function(){H('we-area')&&H('we-area').focus();},80);
  }

  const typeLabel={mc:'🔵 Çoktan Seçmeli',open:'📝 Açık Uçlu',fill:'✏️ Boşluk',section:'📌 Bölüm Başlığı'};
  const qNum=group.questions.filter(function(qq,i){return qq.id===qid?false:group.questions.indexOf(qq)<group.questions.indexOf(q)&&qq.type!=='section';}).length+1;
  const tl=H('qedit-title');
  if(tl)tl.textContent=q.type==='section'?'📌 Bölüm Başlığı Düzenle':(qNum+'. Soru — '+(typeLabel[q.type]||''));

  const wew=H('we-wrap');
  if(wew)wew.style.display='flex';

  const body=H('qedit-body');
  if(!body)return;

  if(q.type==='section'){
    body.innerHTML='<div style="color:var(--text2);font-size:.82rem">Yukarıdaki alanda bölüm başlığı metnini düzenleyin.</div>';
    return;
  }

  const mcOpts=q.type==='mc'?('<div style="margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
    +'<span style="font-size:.82rem;font-weight:700;color:var(--text)">Şıklar</span>'
    +'<span style="font-size:.72rem;color:var(--text3)">Doğru cevabı işaretle ↓</span>'
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:6px">'
    +['A','B','C','D','E'].map(function(opt){
      return '<div style="display:flex;align-items:start;gap:8px">'
        +'<input type="radio" name="qcorrect" value="'+opt+'" '+(q.correct===opt?'checked':'')+' '
        +'onchange="qSetCorrectGroup(\''+opt+'\')" '
        +'style="margin-top:4px;accent-color:var(--green)">'
        +'<label style="cursor:pointer;flex:1;min-height:28px;padding:4px 8px;border-radius:6px;background:var(--bg0);border:1px solid var(--border);display:flex;align-items:center;'+(q.correct===opt?'border-color:var(--green);background:rgba(34,197,94,.1)':'')+'"'
        +'onclick="this.previousElementSibling.checked=true;qSetCorrectGroup(\''+opt+'\')">'
        +'<span style="font-weight:700;margin-right:8px;color:var(--text2)">'+opt+')</span>'
        +'<input type="text" class="inp-ghost" value="'+((q.options&&q.options[opt])||'')+'" '
        +'onchange="qSetOptionGroup(\''+opt+'\',this.value)" '
        +'onclick="event.stopPropagation()" '
        +'placeholder="Şık metni" style="flex:1;font-size:.82rem">'
        +'</label></div>';
    }).join('')
    +'</div></div>'):'';

  const imgs=(q.images&&q.images.length)?('<div style="margin-bottom:14px">'
    +'<div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:8px">Ekli Resimler ('+q.images.length+')</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">'
    +q.images.map(function(src,idx){
      return '<div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)">'
        +'<img src="'+src+'" style="width:100%;height:100px;object-fit:cover;display:block">'
        +'<button onclick="qDelImgGroup('+idx+')" '
        +'style="position:absolute;top:4px;right:4px;background:var(--red);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>'
        +'</div>';
    }).join('')
    +'</div></div>'):'';

  body.innerHTML=mcOpts+imgs;
  weTabSwitch('mat',null);
}

function qSetCorrectGroup(opt){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  q.correct=opt;
  saveDebounced();
  renderGroupQuestions(group);
}

function qSetOptionGroup(opt,val){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===_activeQId;});
  if(!q)return;
  if(!q.options)q.options={};
  q.options[opt]=val;
  saveDebounced();
  renderGroupQuestions(group);
}

// ============================================================
// SINAV GRUPLARI SİSTEMİ
// ============================================================
function addExamGroup(){
  const nameInput=H('new-group-name');
  const name=nameInput?nameInput.value.trim():'';
  
  if(!name){
    klbToast('⚠️ Grup adı girin!');
    return;
  }
  
  const newGroup={
    id:'eg_'+Date.now(),
    name:name,
    classes:[],
    questions:[]
  };
  
  if(!db.examGroups)db.examGroups=[];
  db.examGroups.push(newGroup);
  saveDebounced();
  
  nameInput.value='';
  renderExamGroups();
  selectExamGroup(newGroup.id);
  
  klbToast('✅ "'+name+'" grubu oluşturuldu!');
}

function renderExamGroups(){
  const list=H('exam-groups-list');
  if(!list)return;
  
  if(!db.examGroups||db.examGroups.length===0){
    list.innerHTML='<div style="color:var(--text3);font-size:.82rem;padding:8px">Henüz grup yok. Yukarıdan ekleyin.</div>';
    return;
  }
  
  list.innerHTML=db.examGroups.map(function(grp,idx){
    const isActive=activeExamGroup===grp.id;
    const colorClass=['b9','b10','b11','b12'][idx%4];
    const qCount=(grp.questions&&grp.questions.length)||0;
    const clCount=(grp.classes&&grp.classes.length)||0;
    
    return '<div class="card" style="padding:10px 12px;cursor:pointer;border:2px solid '+(isActive?'var(--blue)':'var(--border)')+';background:'+(isActive?'var(--bg0)':'var(--bg1)')+'"'
      +' onclick="selectExamGroup(\''+grp.id+'\')">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
      +'<span class="badge '+colorClass+'" style="font-size:.7rem">'+(idx+1)+'</span>'
      +'<div style="font-weight:700;font-size:.85rem;flex:1">'+grp.name+'</div>'
      +'<button class="btn btn-ghost" style="padding:2px 6px;font-size:.7rem" '
      +'onclick="event.stopPropagation();deleteExamGroup(\''+grp.id+'\')" data-tip="Grubu sil">🗑️</button>'
      +'</div>'
      +'<div style="font-size:.72rem;color:var(--text3)">'
      +clCount+' sınıf, '+qCount+' soru'
      +'</div></div>';
  }).join('');
}

function selectExamGroup(groupId){
  activeExamGroup=groupId;
  const group=db.examGroups.find(function(g){return g.id===groupId;});
  
  if(!group){
    H('no-group-selected').style.display='block';
    H('group-editor').style.display='none';
    return;
  }
  
  H('no-group-selected').style.display='none';
  H('group-editor').style.display='block';
  
  renderExamGroups();
  renderGroupEditor(group);
}

function renderGroupEditor(group){
  const titleDisplay=H('group-title-display');
  if(titleDisplay)titleDisplay.textContent=group.name;
  updateGroupClassesDisplay(group);
  loadGroupSettings(group);
  renderGroupQuestions(group);
  updateGroupPts(group);
}

function updateGroupClassesDisplay(group){
  const displayDiv=H('group-classes-display');
  const badgesDiv=H('group-classes-badges');
  if(!displayDiv||!badgesDiv)return;
  if(!group.classes||group.classes.length===0){
    displayDiv.style.display='none';
    return;
  }
  displayDiv.style.display='block';
  badgesDiv.innerHTML=group.classes.map(function(cl,idx){
    const colorClass=['b9','b10','b11','b12'][idx%4];
    const count=(db.classes[cl]||[]).length;
    return '<span class="badge '+colorClass+'">'+cl+' ('+count+')</span>';
  }).join('');
}

function editGroupClasses(){
  if(!activeExamGroup){
    klbToast('⚠️ Önce bir grup seçin!');
    return;
  }
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const allClasses=Object.keys(db.classes||{}).sort();
  if(!allClasses.length){
    klbToast('⚠️ Önce öğrenci ekleyin!');
    return;
  }
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px';
  const content=document.createElement('div');
  content.style.cssText='background:var(--bg1);border:2px solid var(--border);border-radius:12px;padding:20px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto';
  content.innerHTML='<div style="font-size:1.1rem;font-weight:700;margin-bottom:12px;color:var(--text)">'+group.name+' - Sınıflar</div>'
    +'<div style="font-size:.8rem;color:var(--text2);margin-bottom:16px">Bu gruba girecek sınıfları seçin</div>'
    +'<div id="group-class-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">'
    +allClasses.map(function(cl){
      return '<label class="cbwrap">'
        +'<input type="checkbox" class="group-class-cb" value="'+cl+'" '+((group.classes||[]).indexOf(cl)!==-1?'checked':'')+'>'
        +'<span>'+cl+' <span style="color:var(--text3);font-size:.75rem">('+((db.classes[cl]||[]).length)+' öğrenci)</span></span>'
        +'</label>';
    }).join('')
    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button class="btn btn-primary" onclick="saveGroupClasses()">✅ Kaydet</button>'
    +'<button class="btn btn-ghost" onclick="this.closest(\'[style*=fixed]\').remove()">❌ İptal</button>'
    +'</div>';
  modal.appendChild(content);
  document.body.appendChild(modal);
  modal.onclick=function(e){if(e.target===modal)modal.remove();};
}

function saveGroupClasses(){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const selected=Array.from(document.querySelectorAll('.group-class-cb:checked')).map(function(cb){return cb.value;});
  group.classes=selected;
  saveDebounced();
  renderGroupEditor(group);
  renderExamGroups();
  const fixedEl=document.querySelector('[style*="position:fixed"]');
  if(fixedEl)fixedEl.remove();
  klbToast('✅ '+selected.length+' sınıf seçildi!');
}

function deleteExamGroup(groupId){
  const group=db.examGroups.find(function(g){return g.id===groupId;});
  if(!group)return;
  if(!confirm('"'+group.name+'" grubu silinsin mi?\n\nTüm soruları da silinecek!'))return;
  db.examGroups=db.examGroups.filter(function(g){return g.id!==groupId;});
  if(activeExamGroup===groupId){
    activeExamGroup=null;
    H('no-group-selected').style.display='block';
    H('group-editor').style.display='none';
  }
  saveDebounced();
  renderExamGroups();
  klbToast('✅ Grup silindi!');
}

function renderGroupQuestions(group){
  const wrap=H('group-qlist-wrap');
  const empty=H('group-q-empty');
  if(!wrap||!empty)return;
  const questions=group.questions||[];
  if(!questions.length){
    wrap.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  var qNum=0;
  wrap.innerHTML=questions.map(function(q,i){
    if(q.type==='section'){
      return '<div class="qcard section-card'+(_activeQId===q.id?' active':'')+'" id="qcard-'+q.id+'">'
        +'<div class="qcard-head" onclick="openGroupQEdit(\''+q.id+'\')">'
        +'<span style="font-size:.9rem">📌</span>'
        +'<span class="qcard-type sec">BÖLÜM</span>'
        +'<span style="font-weight:700;color:var(--amber);flex:1">'+(q.title||'')+'</span>'
        +'</div>'
        +'<div class="qcard-acts">'
        +'<button class="qcard-act" onclick="event.stopPropagation();moveGroupQ(\''+q.id+'\',-1)" data-tip="Yukarı">↑</button>'
        +'<button class="qcard-act" onclick="event.stopPropagation();moveGroupQ(\''+q.id+'\',1)" data-tip="Aşağı">↓</button>'
        +'<button class="qcard-act del" onclick="event.stopPropagation();delGroupQ(\''+q.id+'\')" data-tip="Sil">🗑</button>'
        +'</div></div>';
    }
    qNum++;
    const tLabel={mc:'ÇS',open:'AÇ',fill:'BŞ'};
    const tClass={mc:'mc',open:'open',fill:'fill'};
    const hasOpts=q.type==='mc';
    const hasText=q.text&&q.text.replace(/<[^>]*>/g,'').trim();
    const preview=hasText?q.text:'(metin yok)';
    const imgCount=(q.images||[]).length;
    const opts=hasOpts?'<div class="opts-bar">'+['A','B','C','D','E'].map(function(o){
      return '<div class="opt-dot'+(q.correct===o?' correct':(q.options&&q.options[o])?' has':'')+'" title="'+o+'">'+o+'</div>';
    }).join('')+'</div>':'';
    var firstImg=(q.images&&q.images.length)?q.images[0]:null;
    if(!firstImg&&hasText){
      const tmp =document.createElement('div');tmp.innerHTML=q.text;
      const inlineImg =tmp.querySelector('img');
      if(inlineImg)firstImg=inlineImg.src;
    }
    const imgPreview=firstImg?'<div class="qcard-img-wrap"><img src="'+firstImg+'"></div>':'';
    return '<div class="qcard'+(_activeQId===q.id?' active':'')+(q.fullwidth?' fullwidth':'')+'" id="qcard-'+q.id+'" onclick="openGroupQEdit(\''+q.id+'\')">'
      +'<div class="qcard-head">'
      +'<span class="qcard-num">'+qNum+'.</span>'
      +'<span class="qcard-type '+(tClass[q.type]||'mc')+'">'+(tLabel[q.type]||'')+'</span>'
      +'<span class="ml-a" style="display:flex;gap:4px;align-items:center">'
      +(q.fullwidth?'<span style="font-size:.65rem;color:var(--purple)" title="Tam genişlik">↔️</span>':'')
      +(imgCount?'<span style="font-size:.65rem;color:var(--blue)">📷'+imgCount+'</span>':'')
      +'<span class="qcard-pts">'+(q.puan||0)+'p</span>'
      +'</span>'
      +'</div>'
      +'<div class="qcard-content">'
      +imgPreview
      +(hasText?'<div class="qcard-preview-text">'+preview+'</div>':'')
      +(!hasText&&!firstImg?'<div class="qcard-preview-text" style="color:var(--text3);font-style:italic">Metin veya resim ekle</div>':'')
      +'</div>'
      +opts
      +'<div class="qcard-acts">'
      +'<button class="qcard-act" onclick="event.stopPropagation();moveGroupQ(\''+q.id+'\',-1)" data-tip="Yukarı">↑</button>'
      +'<button class="qcard-act" onclick="event.stopPropagation();moveGroupQ(\''+q.id+'\',1)" data-tip="Aşağı">↓</button>'
      +'<button class="qcard-act" onclick="event.stopPropagation();toggleGroupQType(\''+q.id+'\')" data-tip="Tip değiştir" style="font-size:.68rem">'+(q.type==='mc'?'→AÇ':'→ÇS')+'</button>'
      +'<button class="qcard-act" onclick="event.stopPropagation();toggleGroupQFullwidth(\''+q.id+'\')" data-tip="Tam genişlik">'+(q.fullwidth?'◧':'↔')+'</button>'
      +'<label class="qcard-act" onclick="event.stopPropagation()" data-tip="Resim Ekle">📷'
      +'<input type="file" accept="image/*" style="display:none" onchange="qAddImgFileToGroup(this,\''+q.id+'\')">'
      +'</label>'
      +'<button class="qcard-act del" onclick="event.stopPropagation();delGroupQ(\''+q.id+'\')" data-tip="Sil">🗑</button>'
      +'</div></div>';
  }).join('');
  if(_activeQId)openGroupQEdit(_activeQId,true);
}

function updateGroupPts(group){
  const ptsEl=H('group-total-pts');
  if(!ptsEl)return;
  var total =0;
  (group.questions||[]).forEach(function(q){
    if(q.type!=='section')total+=(parseFloat(q.puan)||0);
  });
  ptsEl.textContent=total+' puan';
}

function addQuestionToGroup(type){
  if(!activeExamGroup){
    klbToast('⚠️ Önce bir grup seçin!');
    return;
  }
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const newQ={
    id:'q_'+Date.now(),
    type:type,
    text:type==='section'?'':'Yeni soru',
    title:type==='section'?'Bölüm Başlığı':'',
    puan:type==='section'?0:10,
    bosluk:0,
    options:{},
    correct:'',
    images:[],
    fullwidth:false
  };
  if(!group.questions)group.questions=[];
  group.questions.push(newQ);
  saveDebounced();
  renderGroupEditor(group);
  renderExamGroups();
  openGroupQEdit(newQ.id);
}

function addSectionToGroup(){
  addQuestionToGroup('section');
}

function clearGroupQuestions(){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  if(!group.questions||!group.questions.length){klbToast('Henüz soru yok.');return;}
  if(!confirm('Tüm sorular silinsin mi?'))return;
  group.questions=[];
  saveDebounced();
  renderGroupEditor(group);
  renderExamGroups();
  if(_activeQId)closeQEdit();
  klbToast('✅ Tüm sorular silindi!');
}

// ============================================================
// GRUP AYARLARI
// ============================================================
function toggleGroupSettings(){
  var panel=H('group-settings-panel');
  if(!panel)return;
  panel.style.display=panel.style.display==='none'?'block':'none';
}

function saveGroupSettings(){
  if(!activeExamGroup)return;
  var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  if(!group.settings)group.settings={};
  var gs=group.settings;
  var el;
  el=H('gs-baslik');if(el)gs.sinavBasligi=el.value;
  el=H('gs-ders');if(el)gs.dersAdi=el.value;
  el=H('gs-sinif');if(el)gs.sinifSube=el.value;
  el=H('gs-tarih');if(el)gs.sinavTarihi=el.value;
  el=H('gs-sure');if(el)gs.sinavSure=el.value;
  el=H('gs-ogretmen');if(el)gs.ogretmenAdi=el.value;
  el=H('gs-sutun');if(el)gs.sutunSayisi=el.value;
  el=H('gs-colRule');if(el)gs.colRule=el.value;
  el=H('gs-colText');if(el)gs.colText=el.value;
  el=H('gs-filigran');if(el)gs.filigran=el.value;
  saveDebounced();
}

function loadGroupSettings(group){
  if(!group)return;
  var gs=group.settings||{};
  var el;
  el=H('gs-baslik');if(el)el.value=gs.sinavBasligi||'';
  el=H('gs-ders');if(el)el.value=gs.dersAdi||'';
  el=H('gs-sinif');if(el)el.value=gs.sinifSube||'';
  el=H('gs-tarih');if(el)el.value=gs.sinavTarihi||'';
  el=H('gs-sure');if(el)el.value=gs.sinavSure||'';
  el=H('gs-ogretmen');if(el)el.value=gs.ogretmenAdi||'';
  el=H('gs-sutun');if(el)el.value=gs.sutunSayisi||'';
  el=H('gs-colRule');if(el)el.value=gs.colRule||'';
  el=H('gs-colText');if(el)el.value=gs.colText||'';
  el=H('gs-filigran');if(el)el.value=gs.filigran||'';
}

function getGroupSettings(group){
  var gs=group.settings||{};
  var s=db.settings||{};
  return {
    okulAdi:s.okulAdi||'',
    dersAdi:gs.dersAdi||s.dersAdi||'',
    sinavBasligi:gs.sinavBasligi||s.sinavBasligi||'',
    sinavTarihi:gs.sinavTarihi||s.sinavTarihi||'',
    sinavSure:gs.sinavSure||s.sinavSure||'',
    sinifSube:gs.sinifSube||s.sinifSube||'',
    ogretmenAdi:gs.ogretmenAdi||s.ogretmenAdi||'',
    notlar:gs.notlar||s.notlar||'',
    filigran:gs.filigran||s.filigran||'',
    filigranOpaklik:s.filigranOpaklik||8,
    kenarBoslugu:s.kenarBoslugu||'normal',
    resimBoyutu:s.resimBoyutu||'orta',
    sutunSayisi:gs.sutunSayisi||s.sutunSayisi||1,
    colRule:gs.colRule||s.colRule||'none',
    colText:gs.colText||s.colText||'',
    teachers:s.teachers||[],
    cevapAnahtariPos:s.cevapAnahtariPos||'none'
  };
}

// ============================================================
// GRUP SORU YÖNETİMİ
// ============================================================
function delGroupQ(qid){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  if(!confirm('Bu soru silinsin mi?'))return;
  group.questions=group.questions.filter(function(q){return q.id!==qid;});
  saveDebounced();
  renderGroupEditor(group);
  renderExamGroups();
  if(_activeQId===qid){closeQEdit();}
}

function moveGroupQ(qid,dir){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const idx=group.questions.findIndex(function(q){return q.id===qid;});
  if(idx<0)return;
  const nidx=idx+dir;
  if(nidx<0||nidx>=group.questions.length)return;
  var tmp=group.questions[idx];group.questions[idx]=group.questions[nidx];group.questions[nidx]=tmp;
  saveDebounced();
  renderGroupQuestions(group);
}

function toggleGroupQType(qid){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===qid;});
  if(!q)return;
  q.type=q.type==='mc'?'open':'mc';
  saveDebounced();
  renderGroupQuestions(group);
  if(_activeQId===qid){openGroupQEdit(qid);}
}

function toggleGroupQFullwidth(qid){
  if(!activeExamGroup)return;
  const group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  const q=group.questions.find(function(qq){return qq.id===qid;});
  if(!q)return;
  q.fullwidth=!q.fullwidth;
  saveDebounced();
  renderGroupQuestions(group);
}

// ============================================================
// ÖNİZLEME / YAZDIRMA
// ============================================================
function buildGroupQsHtml(group,s){
  const questions =group.questions||[];
  var sutun=s.sutunSayisi||1;
  var qNum=0;
  return questions.map(function(q){
    if(q.type==='section')return'<div style="font-size:14pt;font-weight:700;color:#f59e0b;margin:20pt 0 10pt;border-bottom:2px solid #f59e0b;padding-bottom:4pt">'+q.title+'</div>';
    qNum++;
    var hasText=q.text&&q.text.trim();
    var hasImgs=q.images&&q.images.length;
    var imgHtml=hasImgs?'<div class="pq-imgs">'+q.images.map(function(src){return'<img class="pq-img" src="'+src+'">';}).join('')+'</div>':'';
    const boslukPt =parseInt(q.bosluk||0)*18+20;
    var html='<div class="pq'+(q.fullwidth?' fullwidth':'')+'" style="margin-bottom:'+boslukPt+'pt;page-break-inside:avoid">';
    html+='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6pt">';
    html+='<span style="font-weight:700;font-size:11pt">'+qNum+'.</span>';
    if(q.aciklama)html+='<span style="font-size:8.5pt;color:#555;margin-left:4pt;font-weight:400;flex:1">'+q.aciklama+'</span>';
    html+='<span style="font-size:7pt;color:#aaa">('+( q.puan||0)+' puan)</span>';
    html+='</div>';
    if(hasText){
      var qText=(typeof cleanForPrint==='function')?cleanForPrint(q.text,sutun):q.text;
      html+='<div style="margin-bottom:8pt;line-height:1.6">'+qText+'</div>';
    }
    if(hasImgs)html+=imgHtml;
    if(q.type==='mc'&&!q.siklarResimde){
      html+='<div class="pq-opts">';
      ['A','B','C','D','E'].forEach(function(k){
        if(q.options&&q.options[k])html+='<div class="pq-opt"><b>'+k+')</b> '+q.options[k]+'</div>';
      });
      html+='</div>';
    }
    html+='</div>';
    return html;
  }).join('');
}

function buildGroupHeaderHtml(group,s){
  var teachers=s.teachers||[];
  var teacherLine='';
  if(s.ogretmenAdi){
    teacherLine=s.ogretmenAdi;
  } else if(teachers.length){
    teacherLine=teachers.map(function(t){return(t.unvan||'')+' '+(t.ad||'');}).join(', ');
  }
  var html='';
  if(s.okulAdi)html+='<div style="text-align:center;font-size:14pt;font-weight:700;margin-bottom:4pt">'+s.okulAdi+'</div>';
  html+='<div style="text-align:center;font-size:13pt;font-weight:700;margin-bottom:4pt;color:#1a56db">'+(s.sinavBasligi||group.name||'Sınav')+'</div>';
  const meta =[];
  if(s.dersAdi)meta.push(s.dersAdi);
  if(s.sinifSube)meta.push(s.sinifSube);
  if(s.sinavTarihi){
    try{meta.push(new Date(s.sinavTarihi).toLocaleDateString('tr-TR'));}catch(e){meta.push(s.sinavTarihi);}
  }
  if(s.sinavSure)meta.push(s.sinavSure+' dk');
  if(meta.length)html+='<div style="text-align:center;font-size:9pt;color:#666;margin-bottom:8pt">'+meta.join(' &bull; ')+'</div>';
  html+='<div style="display:flex;gap:20pt;margin-bottom:8pt;border:1px solid #ccc;padding:6pt 10pt;border-radius:4pt">';
  html+='<div style="flex:1;font-size:9pt"><b>Ad Soyad:</b> ___________________________</div>';
  html+='<div style="font-size:9pt"><b>No:</b> ________</div>';
  html+='<div style="font-size:9pt"><b>Sınıf:</b> ________</div>';
  html+='</div>';
  html+='<hr style="border:none;border-top:2pt solid #ddd;margin:8pt 0">';
  return html;
}

function buildGroupFooterHtml(s){
  var teachers=s.teachers||[];
  var html='';
  const signers =[];
  if(s.ogretmenAdi){
    s.ogretmenAdi.split(/[,;|]/).forEach(function(part){
      part=part.trim();
      if(!part)return;
      const dashParts =part.split(/\s*[-–—]\s*/);
      if(dashParts.length>=2){
        signers.push({ad:dashParts[0].trim(), unvan:dashParts.slice(1).join(' - ').trim()});
      } else {
        signers.push({ad:part, unvan:''});
      }
    });
  } else if(teachers.length){
    teachers.forEach(function(t){
      var name=(t.ad||'').trim();
      var title=(t.brans||'');
      if(t.unvan && t.unvan.trim()){
        title=t.unvan.trim()+(title?' - '+title:'');
      }
      signers.push({ad:name, unvan:title});
    });
  }
  if(signers.length){
    html+='<div style="display:flex;justify-content:space-around;align-items:flex-start;margin-top:30pt;padding-top:10pt;border-top:1px solid #ddd">';
    signers.forEach(function(signer){
      html+='<div style="text-align:center;min-width:140pt">';
      html+='<div style="font-size:12pt;font-weight:700;color:#111">'+signer.ad+'</div>';
      if(signer.unvan)html+='<div style="font-size:10pt;color:#444;margin-top:3pt">'+signer.unvan+'</div>';
      html+='</div>';
    });
    html+='</div>';
  }
  return html;
}

function previewGroup(){
  var ex=H('preview-modal');if(ex){ex.remove();return;}
  if(!activeExamGroup){klbToast('⚠️ Önce bir grup seçin!');return;}
  var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  if(!group.questions||!group.questions.length){klbToast('Henüz soru eklenmedi.');return;}
  var s=getGroupSettings(group);
  var sutun=s.sutunSayisi||1;
  var filigran=s.filigran||'';
  var wmOpacity=(s.filigranOpaklik||8)/100;
  var colRule=s.colRule||'none';
  var colText=s.colText||'';
  var wmHtml=filigran?'<div class="p-watermark" style="opacity:'+wmOpacity+'">'+filigran+'</div>':'';
  var qsHtml=buildGroupQsHtml(group,s);
  var headerHtml=buildGroupHeaderHtml(group,s);
  var footerHtml=buildGroupFooterHtml(s);
  var colRuleClass='';
  if(sutun>1){
    if(colRule==='line')colRuleClass=' pq-col-rule';
    else if(colRule==='dash')colRuleClass=' pq-col-rule-dash';
  }
  var colTextHtml=colText&&sutun>1?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);writing-mode:vertical-lr;text-orientation:upright;background:#fff;padding:6pt 2pt;font-size:7.5pt;color:#888;letter-spacing:4pt;z-index:2;white-space:nowrap;line-height:1">'+colText+'</div>':'';
  var marginMap={dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'};
  var padding=marginMap[s.kenarBoslugu||'normal'];
  var contentHtml='<div class="ppage" style="padding:'+padding+';background:#fff;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.4);position:relative">'
    +wmHtml+headerHtml
    +'<div style="position:relative">'+colTextHtml+'<div class="pq-container cols-'+sutun+colRuleClass+'">'+qsHtml+'</div></div>'
    +footerHtml+'</div>';
  var modal=document.createElement('div');modal.id='preview-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden';
  var hdr='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#0a1020;border-bottom:1px solid #1e2d4a;flex-shrink:0">'
    +'<span style="font-weight:800;color:#e2e8f8">👁️ Önizleme — '+group.name+'</span>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="printGroup()" style="padding:5px 14px;border-radius:6px;background:#22c55e;border:none;color:#000;cursor:pointer;font-weight:700;font-size:.8rem">🖨️ Yazdır</button>'
    +'<button onclick="H(\'preview-modal\').remove()" style="padding:5px 12px;border-radius:6px;background:#ef4444;border:none;color:#fff;cursor:pointer;font-weight:700;font-size:.8rem">✕ Kapat</button>'
    +'</div></div>';
  var body='<div style="flex:1;overflow:auto;background:#ccc;padding:20px">'+contentHtml+'</div>';
  modal.innerHTML=hdr+body;
  document.body.appendChild(modal);
}

function printGroup(){
  if(!activeExamGroup){klbToast('⚠️ Önce bir grup seçin!');return;}
  var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  if(!group.questions||!group.questions.length){klbToast('Henüz soru eklenmedi.');return;}
  var s=getGroupSettings(group);
  var sutun=s.sutunSayisi||1;
  var filigran=s.filigran||'';
  var wmOpacity=(s.filigranOpaklik||8)/100;
  var colRule=s.colRule||'none';
  var colText=s.colText||'';
  var wmHtml=filigran?'<div class="p-watermark" style="opacity:'+wmOpacity+'">'+filigran+'</div>':'';
  var qsHtml=buildGroupQsHtml(group,s);
  var headerHtml=buildGroupHeaderHtml(group,s);
  var footerHtml=buildGroupFooterHtml(s);
  var colRuleClass='';
  if(sutun>1){
    if(colRule==='line')colRuleClass=' pq-col-rule';
    else if(colRule==='dash')colRuleClass=' pq-col-rule-dash';
  }
  var colTextHtml=colText&&sutun>1?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);writing-mode:vertical-lr;text-orientation:upright;background:#fff;padding:6pt 2pt;font-size:7.5pt;color:#888;letter-spacing:4pt;z-index:2;white-space:nowrap;line-height:1">'+colText+'</div>':'';
  var marginMap={dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'};
  var padding=marginMap[s.kenarBoslugu||'normal'];
  var printHtml='<div class="ppage" style="padding:'+padding+'">'
    +wmHtml+headerHtml
    +'<div style="position:relative">'+colTextHtml+'<div class="pq-container cols-'+sutun+colRuleClass+'">'+qsHtml+'</div></div>'
    +footerHtml+'</div>';
  var ex=H('preview-modal');if(ex)ex.remove();
  H('print-output').innerHTML=printHtml;
  window.print();
}

// ============================================================
// İÇE/DıŞA AKTARMA
// ============================================================
function exportGroupDb(){
  if(!activeExamGroup){klbToast('⚠️ Önce bir grup seçin!');return;}
  var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
  if(!group)return;
  if(!group.questions||group.questions.length===0){klbToast('⚠️ Kaydedilecek soru yok!');return;}
  var defName=(group.name||'Sinav').replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_').trim() || 'Sinav';
  klbAskName(defName, 'Sınav Grubunu Kaydet', function(name){
    const eff =getGroupSettings(group);
    var payload={
      app: typeof KLB_APP_ID!=='undefined'?KLB_APP_ID:'kelebek',
      type: 'exam-group',
      version: '2.0',
      savedAt: new Date().toISOString(),
      fileName: name,
      groupId: group.id,
      groupName: group.name,
      groupClasses: group.classes||[],
      groupSettings: group.settings||{},
      settings: eff,
      questions: group.questions
    };
    var content=klbEncode(payload);
    const safe =name.replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_');
    klbDownload(content, safe+'.klb');
    klbToast('✅ Kaydedildi: '+safe+'.klb\n'+group.questions.length+' soru', 'success');
  });
}

function importGroupDb(){
  if(!activeExamGroup){klbToast('⚠️ Önce bir grup seçin!');return;}
  var input=document.createElement('input');
  input.type='file';
  input.accept='.klb,.kdb,.db,.json';
  input.onchange=function(e){
    var file=e.target.files[0];
    if(!file)return;
    var ext=file.name.split('.').pop().toLowerCase();
    if(ext==='klb'){
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          var data=klbDecode(ev.target.result);
          if(data.type!=='exam-group'&&data.type!=='exam')
            throw new Error('Bu dosya bir sınav grubu dosyası değil! (Tür: '+data.type+')');
          var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
          if(!group)return;
          if(group.questions&&group.questions.length>0){
            if(!confirm('Mevcut sorular silinecek. Devam edilsin mi?'))return;
          }
          group.questions=data.questions||[];
          if(data.groupSettings) group.settings=data.groupSettings;
          saveDebounced(); renderGroupEditor(group); renderExamGroups();
          klbToast('✅ Yüklendi: '+file.name+'\n'+group.questions.length+' soru', 'success');
        }catch(err){ klbToast('❌ '+err.message,'error'); }
      };
      reader.readAsText(file);
    } else if(ext==='db'){
      importDbZipFile(file);
    } else {
      importDbJsonFile(file);
    }
  };
  input.click();
}

function importDbJsonFile(file){
  var reader=new FileReader();
  reader.onload=function(event){
    try{
      var data=JSON.parse(event.target.result);
      if(data.type!=='kelebek-exam-group'&&data.type!=='exam'){
        klbToast('⚠️ Bu geçerli bir sınav dosyası değil!');
        return;
      }
      var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
      if(!group)return;
      if(group.questions&&group.questions.length>0){
        if(!confirm('Mevcut sorular silinecek. Dosyadan yüklensin mi?'))return;
      }
      group.questions=data.questions||[];
      if(data.groupSettings){
        group.settings=data.groupSettings;
      } else if(data.settings){
        group.settings={
          sinavBasligi:data.settings.sinavBasligi||'',
          dersAdi:data.settings.dersAdi||'',
          sinifSube:data.settings.sinifSube||'',
          sinavTarihi:data.settings.sinavTarihi||'',
          sinavSure:data.settings.sinavSure||'',
          notlar:data.settings.notlar||'',
          ogretmenAdi:data.settings.ogretmenAdi||''
        };
      }
      saveDebounced();
      renderGroupEditor(group);renderExamGroups();
      klbToast('✅ Yüklendi: '+(data.name||file.name)+'\n'+group.questions.length+' soru');
    }catch(err){
      klbToast('❌ Dosya okunamadı!\n'+err.message);
    }
  };
  reader.readAsText(file);
}

function importDbZipFile(file){
  var reader=new FileReader();
  reader.onload=function(event){
    try{
      var buf=event.target.result;
      var files=parseZipEntries(new Uint8Array(buf));
      var configEntry=null;
      const imageEntries ={};
      for(var fname in files){
        if(fname==='config.json'){
          configEntry=files[fname];
        } else if(fname.match(/\.(jpg|jpeg|png|gif|webp)$/i)){
          imageEntries[fname]=files[fname];
        }
      }
      if(!configEntry){
        klbToast('⚠️ Geçersiz .db dosyası: config.json bulunamadı!');
        return;
      }
      const configText =new TextDecoder('utf-8').decode(configEntry);
      var config=JSON.parse(configText);
      if(!config.questions||!config.questions.length){
        klbToast('⚠️ Dosyada soru bulunamadı!');
        return;
      }
      var group=db.examGroups.find(function(g){return g.id===activeExamGroup;});
      if(!group)return;
      if(group.questions&&group.questions.length>0){
        if(!confirm('Mevcut sorular silinecek. .db dosyasından yüklensin mi?\n\n'+config.questions.length+' soru bulundu.'))return;
      }
      const convertedQuestions =[];
      config.questions.forEach(function(extQ,idx){
        var editorHtml=(extQ.editor&&extQ.editor.html)?extQ.editor.html:'';
        var rid=extQ.randomid||'';
        if(!editorHtml&&rid&&imageEntries[rid+'.jpg']){
          const imgData =imageEntries[rid+'.jpg'];
          var b64=uint8ToBase64(imgData);
          editorHtml='<p><img src="data:image/jpeg;base64,'+b64+'" style="max-width:100%"></p>';
        }
        const newQ ={
          id:'q_'+Date.now()+'_'+idx,
          type:'open',
          text:editorHtml,
          title:'',
          puan:Math.round((extQ.multiplier||1)*10),
          bosluk:0,
          options:{},
          correct:'',
          images:[],
          fullwidth:false
        };
        var ans=extQ.answer;
        if(typeof ans==='number'&&ans>=0&&ans<=4){
          newQ.type='mc';
          const ansLetters =['A','B','C','D','E'];
          newQ.correct=ansLetters[ans];
          newQ.options={A:'',B:'',C:'',D:'',E:''};
        }
        convertedQuestions.push(newQ);
      });
      group.questions=convertedQuestions;
      saveDebounced();
      renderGroupEditor(group);renderExamGroups();
      klbToast('✅ .db dosyasından yüklendi!\n'+convertedQuestions.length+' soru aktarıldı.\n\nNot: Soru puanlarını ve tiplerini kontrol edin.');
    }catch(err){
      klbToast('❌ .db dosyası okunamadı!\n'+err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function uint8ToBase64(uint8){
  var binary ='';
  const len =uint8.length;
  const chunk =8192;
  for(var i=0;i<len;i+=chunk){
    const slice =uint8.subarray(i,Math.min(i+chunk,len));
    binary+=String.fromCharCode.apply(null,slice);
  }
  return btoa(binary);
}

function parseZipEntries(data){
  var files={};
  var pos=0;
  const dv =new DataView(data.buffer,data.byteOffset,data.byteLength);
  while(pos<data.length-4){
    const sig =dv.getUint32(pos,true);
    if(sig!==0x04034b50)break;
    const compressionMethod =dv.getUint16(pos+8,true);
    const compressedSize =dv.getUint32(pos+18,true);
    const uncompressedSize =dv.getUint32(pos+22,true);
    const fileNameLen =dv.getUint16(pos+26,true);
    const extraLen =dv.getUint16(pos+28,true);
    const fileNameBytes =data.subarray(pos+30,pos+30+fileNameLen);
    const fileName =new TextDecoder('utf-8').decode(fileNameBytes);
    const dataStart =pos+30+fileNameLen+extraLen;
    const dataSize =compressedSize||uncompressedSize;
    if(compressionMethod===0&&dataSize>0){
      files[fileName]=data.slice(dataStart,dataStart+dataSize);
    }
    pos=dataStart+dataSize;
  }
  return files;
}

// ============================================================
// MODÜL INIT
// ============================================================
function initSinavEditoru(){
  renderExamGroups();
  weTabSwitch('mat',null);
}

// ── PAGE READY ──
if(typeof H === 'function'){
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(initSinavEditoru, 300);
  });
}

// ============================================================
// ☁️ BULUTA SINAV KAYDET / ÇEK (.snv) — ortak student-cloud.js
// ============================================================
function snvSaveToCloud(){
  if(typeof doaSaveFor !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  if(!db.examGroups || !db.examGroups.length){ klbToast('Önce bir sınav grubu oluşturun','error'); return; }
  doaSaveFor('sinav', { examGroups: db.examGroups }, function(ok, fn){
    if(ok) klbToast('☁️ Sınav buluta kaydedildi: '+fn, 'success');
  });
}
function snvLoadFromCloud(){
  if(typeof doaOpenPickerFor !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  doaOpenPickerFor('sinav', function(data, fileName){
    var groups = (data && data.examGroups) || (data && data.payload && data.payload.examGroups);
    if(!groups || !groups.length){ klbToast('Bu dosyada sınav verisi yok','error'); return; }
    if(!db.examGroups) db.examGroups = [];
    var added = 0;
    groups.forEach(function(g){
      // Aynı id varsa atla, yoksa ekle
      if(!db.examGroups.find(function(x){ return x.id === g.id; })){
        db.examGroups.push(g); added++;
      }
    });
    if(typeof saveDebounced === 'function') saveDebounced();
    if(typeof renderExamGroups === 'function') renderExamGroups();
    if(typeof renderQuestions === 'function') renderQuestions();
    klbToast('✅ '+added+' sınav grubu yüklendi', 'success');
  });
}
