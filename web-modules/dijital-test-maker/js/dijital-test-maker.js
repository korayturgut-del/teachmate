/* ============================================================
   DİJİTAL TEST MAKER MODÜLÜ JS — Kelebek Platform V2
   Bağımsız çalışabilir. Ortak: ../shared/js/*
   ============================================================ */

// ── Cross-module stubs ──
function renderStats(){}
function showPage(){}
function renderKChecks(){}
function renderSalonList(){}

// ── State ──
// NOT: _activeQId ve _weSavedRange app-core.js'te tanımlı (çakışmayı önlemek için burada tekrar tanımlanmaz)
var _qeditFullscreen=false;

// ── SYMBOL SETS ──
const SYM_SETS={
  mat:[{s:'±'},{s:'×'},{s:'÷'},{s:'≠'},{s:'≤'},{s:'≥'},{s:'≈'},{s:'∞'},{s:'√'},{s:'∛'},{s:'½'},{s:'¼'},{s:'¾'},{s:'∑'},{s:'∫'},{s:'∂'},{s:'→'},{s:'←'},{s:'↔'},{s:'f(x)'},{s:'g(x)'},{s:'h(x)'},{lim:true},{logb:true},{eb:true},{s:'ln'},{s:'sin'},{s:'cos'},{s:'tan'},{s:'arcsin'},{s:'arccos'},{s:'arctan'},{s:'∈'},{s:'∉'},{s:'∪'},{s:'∩'},{k:'frac'},{g:true}],
  fiz:[{s:'α'},{s:'β'},{s:'γ'},{s:'θ'},{s:'λ'},{s:'μ'},{s:'σ'},{s:'ω'},{s:'φ'},{s:'Δ'},{s:'δ'},{s:'π'},{s:'ρ'},{s:'τ'},{s:'η'},{s:'ε'},{s:'κ'},{s:'ν'},{s:'⊥'},{s:'∥'},{s:'∠'},{s:'°'},{s:'N'},{s:'J'},{s:'W'},{s:'Pa'},{s:'Hz'},{s:'m/s'},{s:'m/s²'},{s:'Ω'},{s:'T'},{s:'V'},{s:'A'},{s:'C'},{s:'F'},{s:'g=10 m/s²'},{s:'c=3×10⁸ m/s'},{s:'h=6.63×10⁻³⁴ J·s'}],
  kim:[{s:'→'},{s:'⇌'},{s:'↑'},{s:'↓'},{s:'H₂O'},{s:'CO₂'},{s:'O₂'},{s:'H₂'},{s:'NaCl'},{s:'H₂SO₄'},{s:'HCl'},{s:'NaOH'},{s:'⁺'},{s:'⁻'},{s:'ΔH'},{s:'pH'},{s:'mol'},{s:'M'},{atom:true}]
};

// ── QUESTION MANAGEMENT ──
function addQuestion(type){
  const id='q_'+(qCnt++);
  db.questions.push({id,type,text:'',options:{A:'',B:'',C:'',D:'',E:''},puan:type==='mc'?5:10,correct:null,siklarResimde:false,bosluk:0,images:[]});
  saveDebounced();renderQuestions();openQEdit(id);
}
function addSection(){
  const title=prompt('Bölüm başlığı:','Bölüm 1');
  if(!title)return;
  const id='q_'+(qCnt++);
  db.questions.push({id,type:'section',title,puan:0});
  saveDebounced();renderQuestions();
}
function clearAllQuestions(){
  if(!db.questions.length)return;
  if(!confirm('Tüm sorular silinsin mi?'))return;
  db.questions=[];qCnt=0;saveDebounced();renderQuestions();updatePts();
}
function delQ(id){
  db.questions=db.questions.filter(q=>q.id!==id);
  saveDebounced();renderQuestions();if(_activeQId===id)closeQEdit();
}
function toggleQType(id){
  const q=db.questions.find(q=>q.id===id);if(!q)return;
  if(q.type==='mc'){q.type='open';q.options={A:'',B:'',C:'',D:'',E:''};q.correct=null;}
  else q.type='mc';
  saveDebounced();renderQuestions();
}
function toggleFullwidth(id){
  const q=db.questions.find(q=>q.id===id);if(!q)return;
  q.fullwidth=!q.fullwidth;saveDebounced();renderQuestions();
}
function moveQ(id,dir){
  const i=db.questions.findIndex(q=>q.id===id);
  const j=i+dir;if(j<0||j>=db.questions.length)return;
  [db.questions[i],db.questions[j]]=[db.questions[j],db.questions[i]];
  saveDebounced();renderQuestions();
}

function renderQuestions(){
  const wrap=H('qlist-wrap'),emp=H('q-empty');if(!wrap)return;
  const qs=db.questions||[];
  if(!qs.length){if(emp)emp.style.display='block';wrap.innerHTML='';updatePts();return;}
  if(emp)emp.style.display='none';
  let qNum=0;
  wrap.innerHTML=qs.map((q,i)=>{
    if(q.type==='section'){
      return`<div class="qcard section-card${_activeQId===q.id?' active':''}" id="qcard-${q.id}">
        <div class="qcard-head" onclick="openQEdit('${q.id}')"><span style="font-size:.9rem">📌</span><span class="qcard-type sec">BÖLÜM</span><span style="font-weight:700;color:var(--amber);flex:1">${q.title||''}</span></div>
        <div class="qcard-acts"><button class="qcard-act" onclick="event.stopPropagation();moveQ('${q.id}',-1)">↑</button><button class="qcard-act" onclick="event.stopPropagation();moveQ('${q.id}',1)">↓</button><button class="qcard-act del" onclick="event.stopPropagation();delQ('${q.id}')">🗑</button></div>
      </div>`;
    }
    qNum++;
    const tLabel={mc:'ÇS',open:'AÇ',fill:'BŞ'},tClass={mc:'mc',open:'open',fill:'fill'};
    const hasOpts=q.type==='mc',hasText=q.text&&q.text.replace(/<[^>]*>/g,'').trim();
    const preview=hasText?q.text:'(metin yok)',imgCount=(q.images||[]).length;
    const opts=hasOpts?`<div class="opts-bar">${['A','B','C','D','E'].map(o=>`<div class="opt-dot${q.correct===o?' correct':(q.options&&q.options[o])?' has':''}" title="${o}">${o}</div>`).join('')}</div>`:'';
    let firstImg=(q.images&&q.images.length)?q.images[0]:null;
    if(!firstImg&&hasText){const tmp=document.createElement('div');tmp.innerHTML=q.text;const inlineImg=tmp.querySelector('img');if(inlineImg)firstImg=inlineImg.src;}
    const imgPreview=firstImg?`<div class="qcard-img-wrap"><img src="${firstImg}"></div>`:'';
    return`<div class="qcard${_activeQId===q.id?' active':''}${q.fullwidth?' fullwidth':''}" id="qcard-${q.id}" onclick="openQEdit('${q.id}')">
      <div class="qcard-head"><span class="qcard-num">${qNum}.</span><span class="qcard-type ${tClass[q.type]||'mc'}">${tLabel[q.type]||''}</span>
        <span class="ml-a" style="display:flex;gap:4px;align-items:center">${q.fullwidth?`<span style="font-size:.65rem;color:var(--purple)" title="Tam genişlik">↔️</span>`:''}${imgCount?`<span style="font-size:.65rem;color:var(--blue)">📷${imgCount}</span>`:''}<span class="qcard-pts">${q.puan||0}p</span></span></div>
      <div class="qcard-content">${imgPreview}${hasText?`<div class="qcard-preview-text">${preview}</div>`:''}${!hasText&&!firstImg?'<div class="qcard-preview-text" style="color:var(--text3);font-style:italic">Metin veya resim ekle</div>':''}</div>${opts}
      <div class="qcard-acts"><button class="qcard-act" onclick="event.stopPropagation();moveQ('${q.id}',-1)">↑</button><button class="qcard-act" onclick="event.stopPropagation();moveQ('${q.id}',1)">↓</button><button class="qcard-act" onclick="event.stopPropagation();toggleQType('${q.id}')" style="font-size:.68rem">${q.type==='mc'?'→AÇ':'→ÇS'}</button><button class="qcard-act" onclick="event.stopPropagation();toggleFullwidth('${q.id}')">${q.fullwidth?'◧':'↔'}</button><label class="qcard-act" onclick="event.stopPropagation()">📷<input type="file" accept="image/*" style="display:none" onchange="qAddImgFile(this,'${q.id}')"></label><button class="qcard-act del" onclick="event.stopPropagation();delQ('${q.id}')">🗑</button></div>
    </div>`;
  }).join('');
  updatePts();if(_activeQId)openQEdit(_activeQId,true);
}

function updatePts(){
  const el=H('total-pts');if(!el)return;
  const total=(db.questions||[]).reduce((s,q)=>s+(q.type==='section'?0:(parseFloat(q.puan)||0)),0);
  el.textContent=total+' puan';
}

// ── QUESTION EDITOR ──
function openQEdit(qid,silent){
  const q=db.questions.find(q=>q.id===qid);if(!q)return;
  _activeQId=qid;
  const panel=H('qedit-panel');if(!panel)return;
  if(!silent){
    const we=H('we-area');if(we){we.innerHTML=q.type==='section'?(q.title||''):(q.text||'');}
    const pp=H('qedit-puan');if(pp)pp.value=q.puan||0;
    const bp=H('qedit-bosluk');if(bp){bp.value=q.bosluk||0;const bv=H('bosluk-val');if(bv)bv.textContent=q.bosluk||0;}
    panel.style.display='flex';document.body.style.overflow='hidden';
    setTimeout(()=>{if(H('we-area'))H('we-area').focus();},80);
  }
  const typeLabel={mc:'🔵 Çoktan Seçmeli',open:'📝 Açık Uçlu',fill:'✏️ Boşluk',section:'📌 Bölüm Başlığı'};
  const qNum=db.questions.filter((qq,i)=>qq.id===qid?false:db.questions.indexOf(qq)<db.questions.indexOf(q)&&qq.type!=='section').length+1;
  const tl=H('qedit-title');if(tl)tl.textContent=q.type==='section'?'📌 Bölüm Başlığı Düzenle':`${qNum}. Soru — ${typeLabel[q.type]||''}`;
  const body=H('qedit-body');if(!body)return;
  if(q.type==='section'){body.innerHTML='<div style="color:var(--text2);font-size:.82rem">Yukarıdaki alanda bölüm başlığı metnini düzenleyin.</div>';return;}
  const mcOpts=q.type==='mc'?`<div style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:.78rem;font-weight:700;color:var(--text2)">Şıklar</span><label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.78rem;color:var(--text2)"><input type="checkbox" ${q.siklarResimde?'checked':''} onchange="updQ('${q.id}','siklarResimde',this.checked)">Şıklar resimde</label></div>
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:10px;flex-wrap:wrap"><span style="font-size:.72rem;color:var(--text2)">Doğru şık:</span>${['A','B','C','D','E'].map(o=>`<button onclick="updQ('${q.id}','correct','${o}');openQEdit('${q.id}',true)" style="width:28px;height:28px;border-radius:50%;border:2px solid ${q.correct===o?'var(--green)':'var(--border)'};background:${q.correct===o?'rgba(34,197,94,.15)':'var(--bg2)'};color:${q.correct===o?'var(--green)':'var(--text2)'};font-weight:800;font-size:.75rem;cursor:pointer">${o}</button>`).join('')}${q.correct?`<button onclick="updQ('${q.id}','correct',null);openQEdit('${q.id}',true)" style="font-size:.68rem;padding:2px 7px;border:1px solid var(--border);background:transparent;color:var(--text3);border-radius:4px;cursor:pointer">✕</button>`:''}</div>
    ${q.siklarResimde?`<div style="font-size:.75rem;color:var(--text3);padding:6px 10px;background:var(--bg0);border-radius:5px">ℹ️ Şıklar resimde — metin girişi gizlendi.</div>`:`<div style="display:flex;flex-direction:column;gap:5px">${['A','B','C','D','E'].map(o=>`<div style="display:flex;align-items:center;gap:8px"><span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${q.correct===o?'rgba(34,197,94,.15)':'var(--bg0)'};border:2px solid ${q.correct===o?'var(--green)':'var(--border)'};font-weight:800;font-size:.75rem;color:${q.correct===o?'var(--green)':'var(--blue)'};flex-shrink:0">${o}</span><input type="text" value="${((q.options||{})[o]||'').replace(/"/g,'&quot;')}" placeholder="${o} şıkkını yaz..." style="flex:1;background:var(--bg0);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-family:inherit;font-size:.85rem" oninput="updQ('${q.id}','o_${o}',this.value)"></div>`).join('')}</div>`}</div>`:'';
  const imgs=(q.images||[]).length?`<div style="margin-bottom:12px"><div style="font-size:.75rem;font-weight:700;color:var(--text2);margin-bottom:7px">📷 Resimler</div><div style="display:flex;flex-wrap:wrap;gap:8px">${q.images.map((src,ii)=>`<div style="position:relative"><img src="${src}" style="height:180px;width:auto;max-width:300px;border:1px solid var(--border);border-radius:6px;cursor:pointer;object-fit:contain;background:#fff" onclick="event.stopPropagation()"><button onclick="qDelImg('${q.id}',${ii})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);border:none;color:#fff;cursor:pointer;font-size:.65rem;padding:0;display:flex;align-items:center;justify-content:center">✕</button></div>`).join('')}</div></div>`:'';
  body.innerHTML=mcOpts+imgs;
  document.querySelectorAll('.qcard').forEach(c=>c.classList.remove('active'));
  const ac=H('qcard-'+qid);if(ac)ac.classList.add('active');
  weTabSwitch('mat',null);
}

function closeQEdit(silent){
  _activeQId=null;_qeditFullscreen=false;
  const inner=document.querySelector('.qedit-inner');if(inner){inner.style.width='';inner.style.maxHeight='';inner.style.margin='';inner.style.borderRadius='';}
  const panel=H('qedit-panel');if(panel){panel.style.display='none';panel.style.padding='';}
  document.body.style.overflow='';
  if(!silent)renderQuestions();
}

function updQ(qid,field,val){
  const q=db.questions.find(q=>q.id===qid);if(!q)return;
  if(field.startsWith('o_'))q.options[field.replace('o_','')]=val;
  else q[field]=val;
  saveDebounced();
}

function qeditSaveText(){
  const q=db.questions.find(q=>q.id===_activeQId);if(!q)return;
  const we=H('we-area');if(!we)return;
  if(q.type==='section')q.title=we.innerHTML||'';
  else q.text=we.innerHTML||'';
  saveDebounced();
}
function qeditSavePuan(){
  const q=db.questions.find(q=>q.id===_activeQId);if(!q)return;
  q.puan=parseInt(H('qedit-puan')?.value)||0;saveDebounced();updatePts();
}
function qeditSaveBosluk(){
  const q=db.questions.find(q=>q.id===_activeQId);if(!q)return;
  q.bosluk=parseInt(H('qedit-bosluk')?.value)||0;saveDebounced();
}
function qEditNav(dir){
  if(!_activeQId)return;
  const idx=db.questions.findIndex(q=>q.id===_activeQId);
  const nidx=idx+dir;if(nidx<0||nidx>=db.questions.length)return;
  openQEdit(db.questions[nidx].id);
}

// ── IMAGE MANAGEMENT ──
function qAddImgFile(inp,qid){
  const file=inp.files[0];if(!file)return;
  const id=qid||_activeQId;const q=db.questions.find(q=>q.id===id);if(!q)return;
  const reader=new FileReader();
  reader.onload=e=>{if(!q.images)q.images=[];q.images.push(e.target.result);saveDebounced();openQEdit(id,true);renderQuestions();};
  reader.readAsDataURL(file);inp.value='';
}
function qDelImg(qid,idx){
  const q=db.questions.find(q=>q.id===qid);if(!q||!q.images)return;
  q.images.splice(idx,1);saveDebounced();openQEdit(qid,true);renderQuestions();
}

// ── WORD PROCESSOR ──
function weSave(){
  const sel=window.getSelection();if(sel&&sel.rangeCount)_weSavedRange=sel.getRangeAt(0).cloneRange();
}
function weExec(cmd,val){
  const we=H('we-area');if(!we)return;we.focus();
  if(cmd==='fontSize'){weApplyFontSize(val);}
  else document.execCommand(cmd,false,val||null);
}
function weApplyFontSize(ptValue){
  const we=H('we-area');if(!we)return;
  const range=_weSavedRange;if(!range){we.focus();return;}
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);we.focus();
  if(!range.collapsed){
    const span=document.createElement('span');span.style.fontSize=ptValue+'pt';
    try{const contents=range.extractContents();span.appendChild(contents);range.insertNode(span);const newRange=document.createRange();newRange.selectNodeContents(span);sel.removeAllRanges();sel.addRange(newRange);_weSavedRange=newRange.cloneRange();}catch(e){}
  }else{
    const span=document.createElement('span');span.style.fontSize=ptValue+'pt';span.innerHTML='&#8203;';
    range.insertNode(span);range.setStartAfter(span);range.setEndAfter(span);
    sel.removeAllRanges();sel.addRange(range);_weSavedRange=range.cloneRange();
  }
  qeditSaveText();
}
function weTabSwitch(type,e){
  if(e)e.preventDefault();
  ['mat','fiz','kim'].forEach(t=>{const btn=H('we-tab-'+t);if(btn)btn.className='we-tab'+(t===type?' on':'');});
  const syms=SYM_SETS[type]||[];const cont=H('we-sym-btns');if(!cont)return;
  cont.innerHTML=syms.map(sym=>{
    if(sym.g)return'<button class="we-btn" onclick="weOpenGraph()" style="color:var(--blue);font-weight:700;font-size:.72rem">📈 Grafik</button>';
    if(sym.k==='frac')return'<button class="we-btn" onclick="weInsertFrac()" style="color:var(--blue);font-weight:800">a/b</button>';
    if(sym.atom)return'<button class="we-btn" onclick="weInsertAtom()" style="color:var(--green);font-weight:700;font-size:.72rem">ᴬ_Z X</button>';
    if(sym.lim)return'<button class="we-btn" onclick="weInsertLim()" style="color:var(--blue);font-weight:700">lim<sub style="font-size:.6em">x→</sub></button>';
    if(sym.logb)return'<button class="we-btn" onclick="weInsertLogBase()" style="color:var(--blue);font-weight:700">log<sub style="font-size:.6em">a</sub></button>';
    if(sym.eb)return'<button class="we-btn" onclick="weInsertExp()" style="color:var(--blue);font-weight:700">e<sup style="font-size:.6em">x</sup></button>';
    return'<button class="we-sym-btn we-btn" data-sym="'+sym.s.replace(/"/g,'&quot;')+'" style="font-size:.7rem">'+sym.s+'</button>';
  }).join('');
}
document.addEventListener('mousedown',function(e){
  const btn=e.target.closest('.we-sym-btn');if(!btn)return;
  e.preventDefault();const sym=btn.dataset.sym;if(!sym)return;
  const we=H('we-area');if(!we)return;we.focus();
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

// ── SIMPLE GRAPH ──
function weOpenGraph(){
  const ex=H('graph-modal');if(ex){ex.remove();return;}
  const modal=document.createElement('div');modal.id='graph-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center';
  const box=document.createElement('div');box.style.cssText='background:var(--bg1);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:600px;width:95%';
  box.innerHTML=`<div style="font-weight:800;margin-bottom:12px">📈 Fonksiyon Grafiği</div>
    <textarea id="gfn-input" class="inp" rows="3" placeholder="sin(x)" style="font-family:var(--mono);margin-bottom:8px"></textarea>
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <div><label class="lbl">x min</label><input class="inp inp-sm" id="gx-min" value="-6" type="number" step="0.5" style="width:70px"></div>
      <div><label class="lbl">x max</label><input class="inp inp-sm" id="gx-max" value="6" type="number" step="0.5" style="width:70px"></div>
      <div><label class="lbl">y min</label><input class="inp inp-sm" id="gy-min" value="-4" type="number" step="0.5" style="width:70px"></div>
      <div><label class="lbl">y max</label><input class="inp inp-sm" id="gy-max" value="4" type="number" step="0.5" style="width:70px"></div>
    </div>
    <div style="margin-bottom:8px"><button class="btn btn-primary btn-sm" onclick="drawGraph()">▶ Çiz</button></div>
    <canvas id="graph-canvas" width="560" height="320" style="width:100%;border:1px solid var(--border);border-radius:6px;background:#fff"></canvas>
    <div id="graph-err" style="color:#ef4444;font-size:.75rem;margin-top:4px"></div>
    <div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" onclick="insertGraph()">✅ Ekle</button><button class="btn btn-ghost btn-sm" onclick="H('graph-modal').remove()">İptal</button></div>`;
  modal.appendChild(box);document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  setTimeout(()=>{drawGraph();const inp=H('gfn-input');if(inp)inp.focus();},80);
}
function drawGraph(){
  const canvas=H('graph-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');const W=canvas.width,H2=canvas.height;
  const xmin=parseFloat(H('gx-min').value)||-6,xmax=parseFloat(H('gx-max').value)||6;
  const ymin=parseFloat(H('gy-min').value)||-4,ymax=parseFloat(H('gy-max').value)||4;
  const errEl=H('graph-err');if(errEl)errEl.textContent='';
  ctx.clearRect(0,0,W,H2);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H2);
  const toX=x=>((x-xmin)/(xmax-xmin))*W,toY=y=>H2-((y-ymin)/(ymax-ymin))*H2,dx=xmax-xmin,dy=ymax-ymin;
  ctx.strokeStyle='#e5e7eb';ctx.lineWidth=0.8;
  const gs=Math.pow(10,Math.floor(Math.log10(dx/8)));for(let x=Math.ceil(xmin/gs)*gs;x<=xmax;x+=gs){ctx.beginPath();ctx.moveTo(toX(x),0);ctx.lineTo(toX(x),H2);ctx.stroke();}
  const gsy=Math.pow(10,Math.floor(Math.log10(dy/6)));for(let y=Math.ceil(ymin/gsy)*gsy;y<=ymax;y+=gsy){ctx.beginPath();ctx.moveTo(0,toY(y));ctx.lineTo(W,toY(y));ctx.stroke();}
  ctx.strokeStyle='#374151';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,toY(0));ctx.lineTo(W,toY(0));ctx.stroke();
  ctx.beginPath();ctx.moveTo(toX(0),0);ctx.lineTo(toX(0),H2);ctx.stroke();
  const lines=(H('gfn-input').value||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const GCOLS=['#e11d48','#2563eb','#16a34a','#ca8a04','#7c3aed'];
  lines.forEach((line,fi)=>{
    try{
      const expr=line.replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/sqrt/g,'Math.sqrt').replace(/abs/g,'Math.abs').replace(/pi/g,'Math.PI').replace(/\^/g,'**');
      const fn=new Function('x','return '+expr);fn(0);
      ctx.strokeStyle=GCOLS[fi%GCOLS.length];ctx.lineWidth=2.2;ctx.lineJoin='round';
      ctx.beginPath();let first=true;
      for(let i=0;i<=W*2;i++){
        const x=xmin+(i/(W*2))*dx;let y;try{y=fn(x);}catch(e){first=true;continue;}
        if(!isFinite(y)||isNaN(y)){first=true;continue;}
        const px=i/2,py=toY(y);if(first){ctx.moveTo(px,py);first=false;}else ctx.lineTo(px,py);
      }
      ctx.stroke();
    }catch(e){if(errEl)errEl.textContent='Hata: '+line+' - '+e.message;}
  });
}
function insertGraph(){
  const canvas=H('graph-canvas');if(!canvas)return;
  const src=canvas.toDataURL('image/png');H('graph-modal').remove();
  const we=H('we-area');if(!we)return;we.focus();
  document.execCommand('insertHTML',false,'<img src="'+src+'" style="display:block;margin:6px 0;max-width:100%;border:1px solid #ccc;border-radius:4px">');
  qeditSaveText();
}

// ── SAVE/LOAD ──
function saveTestToFile(){
  if(!db.questions||!db.questions.length){klbToast('⚠️ Kaydedilecek soru yok!');return;}
  const defName=('Test').replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_').trim();
  klbAskName(defName,'Testi Kaydet',(name)=>{
    const payload={app:KLB_APP_ID,type:'exam',version:'2.0',savedAt:new Date().toISOString(),fileName:name,questions:db.questions||[],examGroups:db.examGroups||[],settings:{okulAdi:(db.settings||{}).okulAdi||'',dersAdi:(db.settings||{}).dersAdi||'',sinavBasligi:(db.settings||{}).sinavBasligi||''}};
    const content=klbEncode(payload);const safeFilename=name.replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_');
    klbDownload(content,safeFilename+'.klb');klbToast('✅ Kaydedildi: '+safeFilename+'.klb');
  });
}
function loadTestFromFile(){
  const input=document.createElement('input');input.type='file';input.accept='.klb,.json';
  input.onchange=function(e){
    const file=e.target.files[0];if(!file)return;
    const ext=file.name.split('.').pop().toLowerCase();const reader=new FileReader();
    reader.onload=function(event){
      try{
        let data;if(ext==='klb'){data=klbDecode(event.target.result);}else{data=JSON.parse(event.target.result);}
        if(db.questions&&db.questions.length>0){if(!confirm('⚠️ Mevcut sorular silinecek. Devam?'))return;}
        db.questions=data.questions||[];db.examGroups=data.examGroups||[];qCnt=data.qCnt||0;
        if(data.settings)Object.assign(db.settings,data.settings);
        saveDebounced();loadSettings();renderQuestions();updatePts();
        klbToast('✅ Yüklendi: '+file.name+'\n'+(db.questions||[]).length+' soru');
      }catch(err){klbToast('❌ '+err.message);}
    };reader.readAsText(file);
  };input.click();
}

// ── CTRL+V Quick Add ──
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='v'){
    const activeElement=document.activeElement;
    const isInEditor=activeElement&&(activeElement.id==='we-area'||activeElement.tagName==='INPUT'||activeElement.tagName==='TEXTAREA'||activeElement.isContentEditable);
    const editPanelOpen=H('qedit-panel')?.style.display==='flex';
    if(!isInEditor&&!editPanelOpen){e.preventDefault();addQuestion('mc');}
  }
});

// ── Init ──
function initDijitalTestMaker(){
  renderQuestions();
}

if(typeof H==='function'){
  document.addEventListener('DOMContentLoaded',function(){setTimeout(initDijitalTestMaker,300);});
}
