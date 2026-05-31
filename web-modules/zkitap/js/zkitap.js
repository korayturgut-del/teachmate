/* ============================================================
   Z-KİTAP MODÜLÜ JS — Kelebek Platform V2
   PDF yükleme, kırpma, fullscreen çizim, çalışma kağıdı.
   Orijinal orjinalkelebek.html'den birebir taşındı.
   ============================================================ */

// ── Cross-module stubs ──
function renderStats(){}
function showPage(){}

// ── Z-KITAP STATE ──
let zkQuestions = [];
let zkCurrentIdx = 0;
let zkFabricCanvas = null;
let zkPanelOpen = false;
let zkDrawingMode = false;
let zkCurrentTool = 'pen';
let zkCurrentColor = '#222';
let zkBrushSize = 3;
let zkZoomed = false;
let zkSwipeStartX = 0, zkSwipeStartY = 0;
const ZK_STORAGE_KEY = 'zkitap_drawings_v2_';

// PDF state
let zkPdfDocs = [];
let zkPdfActiveDoc = 0;
let zkPdfPage = 1;
let zkPdfTotalPages = 0;
let zkPdfCrops = [];

// Worksheet state
let zkdQuestions = [];
let zkdCnt = 0;
let zkdColCount = 2;

// ── KLB/JSON DOSYA YÜKLEME ──
function zkLoadFile(){
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.klb,.kdb,.db,.json';
  input.onchange = function(e){
    const file = e.target.files[0]; if(!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    if(ext === 'klb'){
      reader.onload = function(ev){
        try {
          const data = klbDecode(ev.target.result);
          let qs = data.calismaQuestions || data.questions || [];
          if(!qs.length){ klbToast('⚠️ Soru bulunamadı!','error'); return; }
          zkQuestions = qs.map((q,i) => ({...q, _zkType:'html', id: q.id||('zk_'+i)}));
          zkRenderCards();
          H('zkitap-title').textContent = '📖 ' + (data.fileName || data.groupName || file.name);
          H('zkitap-meta').textContent = zkQuestions.filter(q=>q.type!=='section').length + ' soru';
          klbToast('✅ ' + zkQuestions.length + ' soru yüklendi', 'success');
        } catch(err){ klbToast('❌ ' + err.message, 'error'); }
      };
      reader.readAsText(file);
    } else if(ext === 'db'){ zkLoadDbFile(file); }
    else { zkLoadJsonFile(file); }
  };
  input.click();
}

function zkLoadJsonFile(file){
  const reader = new FileReader();
  reader.onload = function(ev){
    try {
      const data = JSON.parse(ev.target.result);
      let qs = data.calismaQuestions || data.questions || data.data?.calismaQuestions || data.data?.questions || [];
      if(!qs.length){ klbToast('⚠️ Soru yok!','error'); return; }
      zkQuestions = qs.map((q,i) => ({...q, _zkType:'html', id: q.id||('zk_'+i)}));
      zkRenderCards();
      H('zkitap-title').textContent = '📖 ' + (data.fileName || file.name);
      H('zkitap-meta').textContent = zkQuestions.filter(q=>q.type!=='section').length + ' soru';
      klbToast('✅ Yüklendi!', 'success');
    } catch(err){ klbToast('❌ ' + err.message, 'error'); }
  };
  reader.readAsText(file);
}

function zkLoadDbFile(file){
  const reader = new FileReader();
  reader.onload = function(ev){
    try {
      const buf = ev.target.result;
      const zipFiles = parseZipEntries(new Uint8Array(buf));
      if(!zipFiles['config.json']){ klbToast('⚠️ Geçersiz .db!','error'); return; }
      const config = JSON.parse(new TextDecoder('utf-8').decode(zipFiles['config.json']));
      if(!config.questions?.length){ klbToast('⚠️ Soru yok!','error'); return; }
      zkQuestions = config.questions.map((extQ, idx) => {
        let html = extQ.editor?.html || '';
        const rid = extQ.randomid || '';
        if(!html && rid && zipFiles[rid+'.jpg']){
          html = '<img src="data:image/jpeg;base64,'+uint8ToBase64(zipFiles[rid+'.jpg'])+'" style="max-width:100%">';
        }
        return {id:'zk_'+Date.now()+'_'+idx, _zkType:'html', type:'open', text:html, options:{}, images:[]};
      });
      zkRenderCards();
      H('zkitap-title').textContent = '📖 ' + file.name.replace(/\.[^.]+$/,'');
      H('zkitap-meta').textContent = zkQuestions.length + ' soru';
      klbToast('✅ Yüklendi', 'success');
    } catch(err){ klbToast('❌ ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function zkClearAll(){
  if(!zkQuestions.length && !zkPdfDocs.length) return;
  if(!confirm('Tüm Z-Kitap soruları ve PDF\'ler silinsin mi?')) return;
  zkQuestions = []; zkPdfDocs = []; zkPdfCrops = [];
  zkRenderCards(); zkUpdatePDFButtons();
  H('zkitap-title').textContent = 'Z-Kitap';
  H('zkitap-meta').textContent = 'Dosya yükleyerek başlayın';
}

// ── PDF YÜKLEME (çoklu) ──
function zkLoadPDF(){
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.pdf'; input.multiple = true;
  input.onchange = async function(e){
    const files = Array.from(e.target.files);
    if(!files.length) return;
    for(const file of files){
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({data:buf}).promise;
        zkPdfDocs.push({doc, name:file.name.replace(/\.pdf$/i,''), totalPages:doc.numPages});
      } catch(err){ klbToast('❌ '+file.name+': '+err.message,'error'); }
    }
    if(!zkPdfDocs.length) return;
    zkPdfActiveDoc = zkPdfDocs.length - files.length;
    zkPdfPage = 1; zkPdfTotalPages = zkPdfDocs[zkPdfActiveDoc].totalPages;
    H('zk-pdf-crop').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    zkPdfRenderTabs(); zkPdfRenderAllDocs(); zkPdfUpdateInfo();
    zkUpdatePDFButtons();
  };
  input.click();
}

function zkReopenPDFs(){
  if(!zkPdfDocs.length){ klbToast('⚠️ Yüklü PDF yok!','error'); return; }
  H('zk-pdf-crop').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  zkPdfRenderTabs(); zkPdfRenderAllDocs(); zkPdfUpdateInfo();
  klbToast('📄 '+zkPdfDocs.length+' PDF tekrar açıldı','success');
}

function zkUpdatePDFButtons(){
  const reopenBtn = H('zk-pdf-reopen-btn');
  const loadBtn = H('zk-pdf-load-btn');
  if(zkPdfDocs.length > 0){
    if(reopenBtn) reopenBtn.style.display = 'inline-flex';
    if(loadBtn) loadBtn.textContent = '📄 Yeni PDF Ekle';
  } else {
    if(reopenBtn) reopenBtn.style.display = 'none';
    if(loadBtn) loadBtn.textContent = '📄 PDF Yükle';
  }
}

function zkPdfAddMore(){
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.pdf'; input.multiple = true;
  input.onchange = async function(e){
    const files = Array.from(e.target.files);
    for(const file of files){
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({data:buf}).promise;
        zkPdfDocs.push({doc, name:file.name.replace(/\.pdf$/i,''), totalPages:doc.numPages});
      } catch(err){ klbToast('❌ '+file.name,'error'); }
    }
    zkPdfRenderTabs();
    klbToast('📄 '+files.length+' PDF eklendi','success');
  };
  input.click();
}

// ── PDF TAB YÖNETİMİ ──
function zkPdfSwitchDoc(idx){
  if(idx<0||idx>=zkPdfDocs.length) return;
  zkPdfActiveDoc = idx; zkPdfPage = 1;
  zkPdfTotalPages = zkPdfDocs[idx].totalPages;
  zkPdfRenderTabs(); zkPdfRenderPage(); zkPdfUpdateInfo();
}

function zkPdfRemoveDoc(idx){
  zkPdfDocs.splice(idx,1);
  zkPdfCrops = zkPdfCrops.filter(c=>c.docIdx!==idx).map(c=>({...c, docIdx:c.docIdx>idx?c.docIdx-1:c.docIdx}));
  if(!zkPdfDocs.length){ zkPdfCropClose(); return; }
  if(zkPdfActiveDoc>=zkPdfDocs.length) zkPdfActiveDoc=zkPdfDocs.length-1;
  zkPdfTotalPages = zkPdfDocs[zkPdfActiveDoc].totalPages;
  zkPdfPage = 1;
  zkPdfRenderTabs(); zkPdfRenderPage(); zkPdfUpdateInfo(); zkPdfRenderCropPreviews();
}

function zkPdfRenderTabs(){
  const el = H('zk-pdf-tabs'); if(!el) return;
  el.innerHTML = zkPdfDocs.map((d,i)=>
    '<div class="zk-pdf-tab'+(i===zkPdfActiveDoc?' active':'')+'" onclick="zkPdfSwitchDoc('+i+')">' +
    '<span>📄 '+d.name+'</span>' +
    '<span class="zk-tab-close" onclick="event.stopPropagation();zkPdfRemoveDoc('+i+')">✕</span></div>'
  ).join('');
}

async function zkPdfRenderPage(){
  if(!zkPdfDocs.length) return;
  const d = zkPdfDocs[zkPdfActiveDoc]; if(!d) return;
  const page = await d.doc.getPage(zkPdfPage);
  const scale = 2;
  const viewport = page.getViewport({scale});
  const canvas = H('zk-pdf-canvas'); if(!canvas) return;
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({canvasContext:ctx, viewport}).promise;
  // Kesilmiş bölgeleri çiz
  zkPdfCrops.forEach((crop,idx)=>{
    if(crop.docIdx!==zkPdfActiveDoc || crop.page!==zkPdfPage) return;
    ctx.strokeStyle='#10b981'; ctx.lineWidth=3; ctx.setLineDash([6,4]);
    ctx.strokeRect(crop.rect.x,crop.rect.y,crop.rect.w,crop.rect.h);
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(16,185,129,0.85)'; ctx.fillRect(crop.rect.x,crop.rect.y,28,20);
    ctx.fillStyle='#fff'; ctx.font='bold 13px sans-serif';
    ctx.fillText(String(idx+1),crop.rect.x+6,crop.rect.y+15);
  });
}

async function zkPdfRenderAllDocs(){
  const wrap = H('zk-pdf-canvas-wrap'); if(!wrap) return;
  wrap.querySelectorAll('.zk-pdf-extra-canvas').forEach(c=>c.remove());
  await zkPdfRenderPage();
  for(let i=0; i<zkPdfDocs.length; i++){
    if(i === zkPdfActiveDoc) continue;
    const d = zkPdfDocs[i];
    const page = await d.doc.getPage(1);
    const vp = page.getViewport({scale:1.2});
    const c = document.createElement('canvas');
    c.className = 'zk-pdf-extra-canvas';
    c.width = vp.width; c.height = vp.height;
    c.style.cssText = 'box-shadow:0 2px 12px rgba(0,0,0,.4);cursor:pointer;flex-shrink:0;opacity:0.7;transition:opacity .2s;border:2px solid transparent;border-radius:4px';
    c.onmouseenter = function(){ this.style.opacity='1'; this.style.borderColor='var(--accent)'; };
    c.onmouseleave = function(){ this.style.opacity='0.7'; this.style.borderColor='transparent'; };
    c.onclick = (function(idx){ return function(){ zkPdfSwitchDoc(idx); zkPdfRenderAllDocs(); }; })(i);
    const ctx = c.getContext('2d');
    await page.render({canvasContext:ctx, viewport:vp}).promise;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, vp.height-24, vp.width, 24);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText(d.name, 6, vp.height-8);
    wrap.appendChild(c);
  }
}

function zkPdfPrevPage(){ if(zkPdfPage<=1)return; zkPdfPage--; zkPdfRenderPage(); zkPdfUpdateInfo(); }
function zkPdfNextPage(){ if(zkPdfPage>=zkPdfTotalPages)return; zkPdfPage++; zkPdfRenderPage(); zkPdfUpdateInfo(); }
function zkPdfUpdateInfo(){
  const pi = H('zk-pdf-page-info'); if(pi) pi.textContent='Sayfa '+zkPdfPage+'/'+zkPdfTotalPages;
  const cc = H('zk-crop-count'); if(cc) cc.textContent=zkPdfCrops.length+' soru kesildi';
}

// ── PDF CROP RECTANGLE DRAWING ──
(function(){
  let started=false, sx=0, sy=0;
  document.addEventListener('DOMContentLoaded',function(){
    const wrap=document.getElementById('zk-pdf-canvas-wrap');
    if(!wrap) return;
    wrap.addEventListener('mousedown',onDown);
    wrap.addEventListener('touchstart',onDown,{passive:false});
    document.addEventListener('mousemove',onMove);
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('mouseup',onUp);
    document.addEventListener('touchend',onUp);

    function onDown(e){
      if(!zkPdfDocs.length) return;
      const canvas=document.getElementById('zk-pdf-canvas'); if(!canvas) return;
      const cr=canvas.getBoundingClientRect();
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const cy=e.touches?e.touches[0].clientY:e.clientY;
      if(cx<cr.left||cx>cr.right||cy<cr.top||cy>cr.bottom) return;
      if(e.touches) e.preventDefault();
      e.preventDefault();
      sx=(cx-cr.left)*(canvas.width/cr.width);
      sy=(cy-cr.top)*(canvas.height/cr.height);
      started=true;
      const rect = H('zk-crop-rect'); if(rect) rect.style.display='block';
    }
    function onMove(e){
      if(!started) return;
      if(e.touches) e.preventDefault();
      e.preventDefault();
      const canvas=document.getElementById('zk-pdf-canvas'); if(!canvas) return;
      const cr=canvas.getBoundingClientRect();
      const wrapR=H('zk-pdf-canvas-wrap').getBoundingClientRect();
      const scD=cr.width/canvas.width;
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const cy=e.touches?e.touches[0].clientY:e.clientY;
      const posX=(cx-cr.left)*(canvas.width/cr.width);
      const posY=(cy-cr.top)*(canvas.height/cr.height);
      const minX=Math.min(sx,posX), minY=Math.min(sy,posY);
      const w=Math.abs(posX-sx), h=Math.abs(posY-sy);
      const r=H('zk-crop-rect'); if(!r) return;
      r.style.left=(cr.left-wrapR.left+H('zk-pdf-canvas-wrap').scrollLeft+minX*scD)+'px';
      r.style.top=(cr.top-wrapR.top+H('zk-pdf-canvas-wrap').scrollTop+minY*scD)+'px';
      r.style.width=(w*scD)+'px';
      r.style.height=(h*scD)+'px';
    }
    function onUp(e){
      if(!started) return;
      started=false;
      const rect = H('zk-crop-rect'); if(rect) rect.style.display='none';
      const canvas=document.getElementById('zk-pdf-canvas'); if(!canvas) return;
      const cr=canvas.getBoundingClientRect();
      const ex=e.changedTouches?e.changedTouches[0].clientX:e.clientX;
      const ey=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
      const posX=(ex-cr.left)*(canvas.width/cr.width);
      const posY=(ey-cr.top)*(canvas.height/cr.height);
      const x=Math.min(sx,posX), y=Math.min(sy,posY);
      const w=Math.abs(posX-sx), h=Math.abs(posY-sy);
      if(w<30||h<30) return;
      const cc=document.createElement('canvas'); cc.width=w; cc.height=h;
      cc.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h);
      zkPdfCrops.push({dataUrl:cc.toDataURL('image/png'), page:zkPdfPage, docIdx:zkPdfActiveDoc, rect:{x,y,w,h}});
      zkPdfUpdateInfo(); zkPdfRenderPage(); zkPdfRenderCropPreviews();
      klbToast('✂️ Soru '+zkPdfCrops.length+' kesildi','success');
    }
  });
})();

function zkPdfRenderCropPreviews(){
  const wrap=H('zk-crop-previews'); if(!wrap) return;
  wrap.innerHTML=zkPdfCrops.map((c,i)=>
    '<div class="zk-crop-preview" onclick="zkPdfGoToCrop('+i+')">' +
    '<span class="zk-crop-num">'+(i+1)+'</span>' +
    '<span class="zk-crop-del" onclick="event.stopPropagation();zkPdfDeleteCrop('+i+')">✕</span>' +
    '<img src="'+c.dataUrl+'"></div>'
  ).join('');
}
function zkPdfDeleteCrop(idx){ zkPdfCrops.splice(idx,1); zkPdfUpdateInfo(); zkPdfRenderPage(); zkPdfRenderCropPreviews(); }
function zkPdfGoToCrop(idx){
  const c=zkPdfCrops[idx]; if(!c) return;
  if(c.docIdx!==zkPdfActiveDoc) zkPdfSwitchDoc(c.docIdx);
  if(c.page!==zkPdfPage){ zkPdfPage=c.page; zkPdfRenderPage(); zkPdfUpdateInfo(); }
}
function zkPdfUndoCrop(){
  if(!zkPdfCrops.length) return;
  zkPdfCrops.pop(); zkPdfUpdateInfo(); zkPdfRenderPage(); zkPdfRenderCropPreviews();
}
function zkPdfCropDone(){
  if(!zkPdfCrops.length){ klbToast('⚠️ Henüz soru kesilmedi!','error'); return; }
  const newQs=zkPdfCrops.map((crop,idx)=>({
    id:'zkpdf_'+Date.now()+'_'+idx, _zkType:'img', type:'open',
    _imgSrc:crop.dataUrl, text:'', options:{}, images:[]
  }));
  zkQuestions=zkQuestions.concat(newQs);
  zkRenderCards();
  H('zkitap-meta').textContent=zkQuestions.length+' soru';
  zkPdfCropClose();
  zkUpdatePDFButtons();
  klbToast('✅ '+newQs.length+' soru Z-Kitap\'a eklendi!','success');
}
function zkPdfCropClose(){
  H('zk-pdf-crop').style.display='none';
  document.body.style.overflow='';
  zkUpdatePDFButtons();
}
function zkPdfPreviewClose(){ H('zk-pdf-preview').style.display='none'; }

// ── PDF ÖNİZLEME & YAZDIRMA ──
function zkPdfPrint(){
  const content=H('zk-pdf-preview-content')?.querySelector('.ppage');
  if(!content) return;
  H('print-output').innerHTML=content.outerHTML;
  zkPdfPreviewClose(); zkPdfCropClose();
  setTimeout(()=>window.print(),300);
}

// ── KART RENDER ──
function zkRenderCards(){
  const wrap = H('zk-cards-wrap');
  const empty = H('zk-empty');
  if(!zkQuestions.length){
    if(wrap) wrap.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';
  let qNum = 0;
  wrap.innerHTML = zkQuestions.map((q, idx) => {
    if(q.type === 'section'){
      return '<div class="zk-card" style="grid-column:1/-1;height:auto;cursor:pointer;background:linear-gradient(90deg,rgba(245,158,11,.08),transparent);border-color:rgba(245,158,11,.25)" onclick="zkOpen('+idx+')">' +
        '<div class="zk-card-num"><span class="zk-badge sec">📌</span> <span style="font-weight:800;color:var(--amber)">'+(q.title||'Bölüm')+'</span></div></div>';
    }
    qNum++;
    const hasDraw = zkHasDrawing(idx);
    const drawIcon = hasDraw ? '<span class="zk-draw-indicator">✏️</span>' : '';
    
    if(q._zkType === 'img' && q._imgSrc){
      return '<div class="zk-card'+(hasDraw?' has-drawing':'')+'" onclick="zkOpen('+idx+')">' +
        '<div class="zk-card-num">S.'+qNum+' <span class="zk-badge open">PDF</span>'+drawIcon+'</div>' +
        '<div class="zk-card-img"><img src="'+q._imgSrc+'"></div></div>';
    }
    
    const typeBadge = q.type==='mc' ? '<span class="zk-badge mc">ÇS</span>' : 
                      q.type==='fill' ? '<span class="zk-badge fill">BD</span>' :
                      '<span class="zk-badge open">AÇ</span>';
    let preview = (q.text||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim();
    if(preview.length > 100) preview = preview.substring(0,100) + '...';
    if(!preview) preview = '<span style="opacity:.4">Boş</span>';
    
    return '<div class="zk-card'+(hasDraw?' has-drawing':'')+'" onclick="zkOpen('+idx+')">' +
      '<div class="zk-card-num">S.'+qNum+' '+typeBadge+drawIcon+'</div>' +
      '<div class="zk-card-body">'+preview+'</div></div>';
  }).join('');
}

function zkHasDrawing(idx){
  try { return !!localStorage.getItem(ZK_STORAGE_KEY + zkGetDrawKey(idx)); } catch(e){ return false; }
}
function zkGetDrawKey(idx){
  const q = zkQuestions[idx];
  return q?.id || ('idx_'+idx);
}

// ── TAM EKRAN ──
function zkOpen(idx){
  if(!zkQuestions.length) return;
  zkCurrentIdx = idx;
  H('zk-fullscreen').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  zkRenderQuestion();
  setTimeout(() => {
    zkInitCanvas();
    zkLoadDrawing();
  }, 150);
  zkUpdateMiniNav();
  
  const area = H('zk-swipe-area');
  area.removeEventListener('touchstart', zkTouchStart);
  area.removeEventListener('touchend', zkTouchEnd);
  area.addEventListener('touchstart', zkTouchStart, {passive:true});
  area.addEventListener('touchend', zkTouchEnd, {passive:true});
}

function zkClose(){
  zkSaveDrawing();
  H('zk-fullscreen').style.display = 'none';
  document.body.style.overflow = '';
  if(zkFabricCanvas){ zkFabricCanvas.dispose(); zkFabricCanvas = null; }
  zkPanelOpen = false; zkDrawingMode = false;
  const panel = H('zk-panel'); if(panel) panel.style.display = 'none';
  zkRenderCards();
}

function zkRenderQuestion(){
  const q = zkQuestions[zkCurrentIdx]; if(!q) return;
  const display = H('zk-question-display');
  const allReal = zkQuestions.filter(x => x.type !== 'section');
  const realIdx = allReal.indexOf(q);
  
  if(q.type === 'section'){
    display.innerHTML = '<div class="zk-q-section">' + (q.title||'Bölüm') + '</div>';
    H('zk-q-indicator').textContent = '📌 ' + (q.title||'Bölüm');
  } else if(q._zkType === 'img' && q._imgSrc){
    display.innerHTML = '<div style="text-align:center;padding:12px 0"><img src="'+q._imgSrc+'" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:6px"></div>';
    H('zk-q-indicator').textContent = (realIdx+1) + ' / ' + allReal.length;
  } else {
    let html = '<div style="margin-bottom:16px;font-weight:800;font-size:1.3rem;color:#4f46e5">Soru ' + (realIdx+1) + '</div>';
    html += '<div class="zk-q-text">' + (q.text||'<i style="opacity:.4">Soru metni boş</i>') + '</div>';
    if(q.type === 'mc' && !q.siklarResimde){
      html += '<div class="zk-q-opts">';
      ['A','B','C','D','E'].forEach(k => {
        if(q.options?.[k]) html += '<div class="zk-q-opt"><b>'+k+')</b> <span>'+q.options[k]+'</span></div>';
      });
      html += '</div>';
    }
    if(q.images?.length){
      html += '<div class="zk-q-images">';
      q.images.forEach(src => html += '<img src="'+src+'" style="max-width:100%">');
      html += '</div>';
    }
    display.innerHTML = html;
    H('zk-q-indicator').textContent = (realIdx+1) + ' / ' + allReal.length;
  }
  H('zk-swipe-area').scrollTop = 0;
}

// ── FABRIC.JS CANVAS ──
function zkInitCanvas(){
  if(zkFabricCanvas){ zkFabricCanvas.dispose(); zkFabricCanvas = null; }
  
  const wrap = H('zk-content-wrap');
  const canvasWrap = H('zk-canvas-wrap');
  const canvasEl = H('zk-draw-canvas');
  if(!wrap || !canvasWrap || !canvasEl) return;
  
  const w = wrap.offsetWidth;
  const h = wrap.offsetHeight;
  canvasEl.width = w; canvasEl.height = h;
  canvasWrap.style.width = w + 'px'; canvasWrap.style.height = h + 'px';
  
  try {
    zkFabricCanvas = new fabric.Canvas('zk-draw-canvas', {
      isDrawingMode: false, selection: false,
      backgroundColor: 'transparent', allowTouchScrolling: true,
      width: w, height: h
    });
    
    zkFabricCanvas.freeDrawingBrush = new fabric.PencilBrush(zkFabricCanvas);
    zkFabricCanvas.freeDrawingBrush.color = zkCurrentColor;
    zkFabricCanvas.freeDrawingBrush.width = zkBrushSize;
    
    canvasWrap.style.pointerEvents = 'none';
  } catch(e) { console.error('Fabric canvas init error:', e); }
}

function zkResizeCanvas(){
  const wrap = H('zk-content-wrap');
  const canvasWrap = H('zk-canvas-wrap');
  if(!wrap || !canvasWrap) return;
  const w = wrap.offsetWidth; const h = wrap.offsetHeight;
  canvasWrap.style.width = w + 'px'; canvasWrap.style.height = h + 'px';
  if(zkFabricCanvas){
    zkFabricCanvas.setWidth(w); zkFabricCanvas.setHeight(h); zkFabricCanvas.renderAll();
  }
}

// ── PANEL TOOLS ──
function zkTogglePanel(){
  zkPanelOpen = !zkPanelOpen;
  const panel = H('zk-panel');
  const canvasWrap = H('zk-canvas-wrap');
  const btn = H('zk-pen-toggle');
  const miniNav = H('zk-mini-nav');
  
  if(zkPanelOpen){
    if(panel) panel.style.display = 'block';
    if(miniNav) miniNav.style.display = 'flex';
    if(canvasWrap) canvasWrap.style.pointerEvents = 'auto';
    if(zkFabricCanvas) zkFabricCanvas.isDrawingMode = true;
    if(btn){ btn.style.background = 'rgba(99,102,241,0.15)'; btn.style.borderColor = 'var(--accent)'; }
    zkDrawingMode = true;
  } else {
    if(panel) panel.style.display = 'none';
    if(miniNav) miniNav.style.display = 'none';
    if(canvasWrap) canvasWrap.style.pointerEvents = 'none';
    if(zkFabricCanvas) zkFabricCanvas.isDrawingMode = false;
    if(btn){ btn.style.background = ''; btn.style.borderColor = ''; }
    zkDrawingMode = false;
  }
}

function zkSetTool(tool){
  zkCurrentTool = tool;
  document.querySelectorAll('.zk-tool-btn').forEach(b => b.classList.remove('active'));
  const el = H('zkt-'+tool); if(el) el.classList.add('active');
  if(!zkFabricCanvas) return;
  
  zkFabricCanvas.freeDrawingBrush = new fabric.PencilBrush(zkFabricCanvas);
  if(tool === 'eraser'){
    zkFabricCanvas.freeDrawingBrush.color = '#ffffff';
    zkFabricCanvas.freeDrawingBrush.width = zkBrushSize * 3;
  } else if(tool === 'highlight'){
    zkFabricCanvas.freeDrawingBrush.color = zkCurrentColor + '40';
    zkFabricCanvas.freeDrawingBrush.width = zkBrushSize * 4;
  } else {
    zkFabricCanvas.freeDrawingBrush.color = zkCurrentColor;
    zkFabricCanvas.freeDrawingBrush.width = zkBrushSize;
  }
  if(zkDrawingMode) zkFabricCanvas.isDrawingMode = true;
}

function zkSetColor(color, el){
  zkCurrentColor = color;
  document.querySelectorAll('.zk-color-dot').forEach(d => d.classList.remove('active'));
  if(el) el.classList.add('active');
  if(zkCurrentTool !== 'eraser') zkSetTool(zkCurrentTool);
}

function zkSetBrushSize(val){
  zkBrushSize = parseInt(val);
  const sv = H('zk-size-val'); if(sv) sv.textContent = val;
  if(zkFabricCanvas?.freeDrawingBrush){
    const mult = zkCurrentTool === 'eraser' ? 3 : zkCurrentTool === 'highlight' ? 4 : 1;
    zkFabricCanvas.freeDrawingBrush.width = zkBrushSize * mult;
  }
}

function zkUndo(){
  if(!zkFabricCanvas) return;
  const objs = zkFabricCanvas.getObjects();
  if(objs.length) { zkFabricCanvas.remove(objs[objs.length-1]); zkFabricCanvas.renderAll(); }
}

function zkClearDraw(){
  if(!zkFabricCanvas) return;
  if(!confirm('Çizimler silinsin mi?')) return;
  zkFabricCanvas.clear(); zkFabricCanvas.backgroundColor = 'transparent';
  zkFabricCanvas.renderAll();
  try { localStorage.removeItem(ZK_STORAGE_KEY + zkGetDrawKey(zkCurrentIdx)); } catch(e){}
}

// ── DRAWING SAVE/LOAD ──
function zkSaveDrawing(){
  if(!zkFabricCanvas) return;
  const key = ZK_STORAGE_KEY + zkGetDrawKey(zkCurrentIdx);
  const objs = zkFabricCanvas.getObjects();
  if(!objs.length){ try{localStorage.removeItem(key);}catch(e){} return; }
  try { localStorage.setItem(key, JSON.stringify(zkFabricCanvas.toJSON())); } catch(e){}
}

function zkLoadDrawing(){
  if(!zkFabricCanvas) return;
  const key = ZK_STORAGE_KEY + zkGetDrawKey(zkCurrentIdx);
  try {
    const json = localStorage.getItem(key);
    if(json){
      zkFabricCanvas.loadFromJSON(json, function(){
        zkFabricCanvas.backgroundColor = 'transparent';
        zkFabricCanvas.renderAll();
      });
    } else {
      zkFabricCanvas.clear(); zkFabricCanvas.backgroundColor = 'transparent';
    }
  } catch(e){ zkFabricCanvas.clear(); zkFabricCanvas.backgroundColor = 'transparent'; }
}

// ── NAVİGASYON ──
function zkPrev(){ if(zkCurrentIdx<=0)return; zkSaveDrawing(); zkCurrentIdx--; zkGo(); }
function zkNext(){ if(zkCurrentIdx>=zkQuestions.length-1)return; zkSaveDrawing(); zkCurrentIdx++; zkGo(); }
function zkGoTo(idx){ if(idx<0||idx>=zkQuestions.length)return; zkSaveDrawing(); zkCurrentIdx=idx; zkGo(); }
function zkGo(){
  zkRenderQuestion();
  setTimeout(() => { zkResizeCanvas(); zkLoadDrawing(); }, 100);
  zkUpdateMiniNav();
}

function zkTouchStart(e){ if(zkDrawingMode)return; zkSwipeStartX=e.changedTouches[0].clientX; zkSwipeStartY=e.changedTouches[0].clientY; }
function zkTouchEnd(e){
  if(zkDrawingMode)return;
  const dx=e.changedTouches[0].clientX-zkSwipeStartX;
  const dy=e.changedTouches[0].clientY-zkSwipeStartY;
  if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5){
    if(dx<0)zkNext(); else zkPrev();
  }
}

// Keyboard
document.addEventListener('keydown', function(e){
  const fs=H('zk-fullscreen'); if(!fs||fs.style.display==='none')return;
  if(e.key==='ArrowLeft'){e.preventDefault();zkPrev();}
  if(e.key==='ArrowRight'){e.preventDefault();zkNext();}
  if(e.key==='Escape')zkClose();
});

function zkUpdateMiniNav(){
  const wrap=H('zk-mini-nav'); if(!wrap)return;
  let n=0;
  wrap.innerHTML=zkQuestions.map((q,idx)=>{
    if(q.type==='section')return'';
    n++;
    return '<button class="zk-mini-btn'+(idx===zkCurrentIdx?' current':'')+(zkHasDrawing(idx)?' has-draw':'')+'" onclick="zkGoTo('+idx+')">'+n+'</button>';
  }).join('');
}

// Zoom
function zkToggleZoom(){
  zkZoomed=!zkZoomed;
  const d=H('zk-question-display'); const w=H('zk-content-wrap');
  const btn=H('zk-zoom-btn');
  if(zkZoomed){
    if(w) w.style.maxWidth='100%'; if(d) d.style.fontSize='1.4rem';
    if(btn){ btn.style.background='rgba(99,102,241,0.15)'; btn.style.borderColor='var(--accent)'; }
  } else {
    if(w) w.style.maxWidth='960px'; if(d) d.style.fontSize='';
    if(btn){ btn.style.background=''; btn.style.borderColor=''; }
  }
  setTimeout(()=>zkResizeCanvas(),100);
}

// Resize
window.addEventListener('resize',function(){
  const fs=H('zk-fullscreen');
  if(fs&&fs.style.display!=='none') setTimeout(()=>zkResizeCanvas(),100);
});

// ── Z-KİTAP ÇALIŞMA SAYFASI (zkd) ──
function zkShowWorksheet(){
  H('zk-worksheet-panel').style.display = 'block';
  H('zk-view-area').style.display = 'none';
  H('zk-main-actions').style.display = 'none';
  H('zk-worksheet-btn').style.display = 'none';
  H('zkitap-title').textContent = 'Çalışma Kağıdı Düzenle';
}

function zkBackToMain(){
  H('zk-worksheet-panel').style.display = 'none';
  H('zk-view-area').style.display = 'block';
  H('zk-main-actions').style.display = 'flex';
  H('zk-worksheet-btn').style.display = 'inline-flex';
  H('zkitap-title').textContent = 'Z-Kitap';
}

function zkdLoadFromZKitap(){
  if(!zkQuestions.length){ klbToast('⚠️ Z-Kitap\'ta soru yok!','error'); return; }
  if(zkdQuestions.length && !confirm('Mevcut sorular silinecek. Devam?')) return;
  zkdQuestions = JSON.parse(JSON.stringify(zkQuestions));
  zkdCnt = zkdQuestions.length;
  zkdRenderList();
  klbToast('✅ ' + zkdQuestions.length + ' soru aktarıldı','success');
}

function zkdAddQ(type){
  const id = 'zkd_' + (zkdCnt++);
  zkdQuestions.push({id, type, _zkType:'html', text:'', options:{A:'',B:'',C:'',D:'',E:''}, correct:null, siklarResimde:false, bosluk:0, images:[]});
  zkdRenderList();
  // Basit prompt ile metin düzenleme
  setTimeout(()=>{
    const q = zkdQuestions[zkdQuestions.length-1];
    const newText = prompt('Soru metni:', '');
    if(newText !== null) q.text = newText;
    zkdRenderList();
  },100);
}

function zkdAddSection(){
  const title = prompt('Bölüm başlığı:','Bölüm');
  if(!title) return;
  zkdQuestions.push({id:'zkd_'+(zkdCnt++), type:'section', title});
  zkdRenderList();
}

function zkdClearAll(){
  if(!zkdQuestions.length) return;
  if(!confirm('Tüm sorular silinsin mi?')) return;
  zkdQuestions = []; zkdCnt = 0; zkdRenderList();
}

function zkdDelQ(id){
  zkdQuestions = zkdQuestions.filter(q => q.id !== id);
  zkdRenderList();
}

function zkdMoveQ(id, dir){
  const i = zkdQuestions.findIndex(q => q.id === id);
  const j = i + dir;
  if(j < 0 || j >= zkdQuestions.length) return;
  [zkdQuestions[i], zkdQuestions[j]] = [zkdQuestions[j], zkdQuestions[i]];
  zkdRenderList();
}

function zkdSetCol(n){
  zkdColCount = n;
  document.querySelectorAll('[id^="zkd-col-"]').forEach(b => b.classList.remove('active'));
  const el = H('zkd-col-'+n); if(el) el.classList.add('active');
}

function zkdRenderList(){
  const wrap = H('zkd-qlist');
  const empty = H('zkd-empty');
  if(!wrap) return;
  if(!zkdQuestions.length){
    wrap.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';
  let qNum = 0;
  wrap.innerHTML = zkdQuestions.map((q, idx) => {
    if(q.type === 'section'){
      return '<div class="qcard section-card" style="height:auto">' +
        '<div class="qcard-head"><span style="font-weight:800;color:var(--amber)">📌 '+q.title+'</span>' +
        '<div style="margin-left:auto;display:flex;gap:4px">' +
        '<button class="qcard-act" onclick="zkdMoveQ(\''+q.id+'\',-1)">▲</button>' +
        '<button class="qcard-act" onclick="zkdMoveQ(\''+q.id+'\',1)">▼</button>' +
        '<button class="qcard-act del" onclick="zkdDelQ(\''+q.id+'\')">🗑️</button></div></div></div>';
    }
    qNum++;
    const hasImg = q._zkType === 'img' && q._imgSrc;
    let preview = hasImg
      ? '<img src="'+q._imgSrc+'" style="max-width:100%;max-height:140px;object-fit:contain">'
      : ((q.text||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').trim().substring(0,80) || '<span style="opacity:.4">Boş soru</span>');

    return '<div class="qcard" style="height:auto;min-height:100px;cursor:default">' +
      '<div class="qcard-head"><span class="qcard-num">S.'+qNum+'</span>' +
      '<span class="qcard-type '+(q.type==='mc'?'mc':'open')+'">'+
      (q.type==='mc'?'ÇS': hasImg?'PDF':'AÜ')+'</span>' +
      '<div style="margin-left:auto;display:flex;gap:4px">' +
      '<button class="qcard-act" onclick="zkdMoveQ(\''+q.id+'\',-1)">▲</button>' +
      '<button class="qcard-act" onclick="zkdMoveQ(\''+q.id+'\',1)">▼</button>' +
      '<button class="qcard-act del" onclick="zkdDelQ(\''+q.id+'\')">🗑️</button></div></div>' +
      '<div class="qcard-preview-text" style="padding:8px 12px">'+preview+'</div></div>';
  }).join('');
}

// ── ÖNİZLEME & YAZDIRMA ──
function zkdBuildPrintHTML(){
  const s = db.settings || {};
  const sutun = zkdColCount;
  const filigran = (H('zkd-filigran')||{}).value || '';
  const wmOpacity = (s.filigranOpaklik||8)/100;
  const marginMap = {dar:'6mm 8mm', normal:'12mm 15mm', genis:'18mm 22mm'};
  const padding = marginMap[s.kenarBoslugu||'normal'];
  const wmHtml = filigran ? '<div class="p-watermark" style="opacity:'+wmOpacity+'">'+filigran+'</div>' : '';

  let qNum = 0;
  const qsHtml = zkdQuestions.map(q => {
    if(q.type === 'section'){
      return '<div class="pq-section-title">'+q.title+'</div>';
    }
    qNum++;
    let html = '<div class="pq" style="margin-bottom:14pt;page-break-inside:avoid">';
    html += '<div style="font-weight:700;font-size:11pt;margin-bottom:6pt">'+qNum+'.</div>';
    if(q._zkType === 'img' && q._imgSrc){
      html += '<div><img src="'+q._imgSrc+'" style="max-width:100%;height:auto;border:1px solid #ddd"></div>';
    } else {
      if(q.text) html += '<div style="margin-bottom:6pt;line-height:1.5">'+q.text+'</div>';
      if(q.images?.length) q.images.forEach(src => html += '<img class="pq-img" src="'+src+'">');
      if(q.type === 'mc' && !q.siklarResimde){
        html += '<div class="pq-opts">';
        ['A','B','C','D','E'].forEach(k => { if(q.options?.[k]) html += '<div class="pq-opt"><b>'+k+')</b> '+q.options[k]+'</div>'; });
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }).join('');

  const colClass = sutun > 1 ? ' cols-'+sutun+' pq-col-rule' : '';
  return '<div class="ppage" style="padding:'+padding+'">'
    + wmHtml
    + '<div style="text-align:center;font-size:14pt;font-weight:700;margin-bottom:4pt">'+(s.okulAdi||'')+'</div>'
    + '<div style="text-align:center;font-size:12pt;font-weight:600;margin-bottom:8pt;color:#3b82f6">Z-Kitap Çalışma Sayfası</div>'
    + '<div style="text-align:center;font-size:10pt;color:#666;margin-bottom:12pt">'+(s.dersAdi||'')+' • '+new Date().toLocaleDateString('tr-TR')+'</div>'
    + '<hr style="border:none;border-top:2px solid #ddd;margin:12pt 0">'
    + '<div class="pq-container'+colClass+'">'+qsHtml+'</div>'
    + '</div>';
}

function zkdPreview(){
  if(!zkdQuestions.length){ klbToast('⚠️ Soru yok!','error'); return; }
  const html = zkdBuildPrintHTML();
  let ex = H('zkd-preview-modal'); if(ex) ex.remove();
  const m = document.createElement('div');
  m.id = 'zkd-preview-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  const pg = document.createElement('div');
  pg.style.cssText = 'background:#fff;width:min(800px,96vw);max-height:90vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,.8);border-radius:8px;position:relative';
  pg.innerHTML = '<div style="position:sticky;top:0;background:#fff;padding:8px 12px;border-bottom:1px solid #ddd;display:flex;gap:8px;z-index:2">' +
    '<button onclick="zkdPrint()" class="btn btn-primary btn-sm">🖨️ Yazdır / PDF</button>' +
    '<div style="flex:1"></div>' +
    '<button onclick="H(\'zkd-preview-modal\').remove()" class="btn btn-ghost btn-sm">✕ Kapat</button></div>' +
    html;
  m.appendChild(pg);
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target === m) m.remove(); });
}

function zkdPrint(){
  if(!zkdQuestions.length){ klbToast('⚠️ Soru yok!','error'); return; }
  const html = zkdBuildPrintHTML();
  H('print-output').innerHTML = html;
  const pm = H('zkd-preview-modal'); if(pm) pm.remove();
  setTimeout(() => window.print(), 300);
}

function zkPrintFromMain(){
  if(!zkQuestions.length){ klbToast('⚠️ Soru yok!','error'); return; }
  const s = db.settings || {};
  const padding = ({dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'})[s.kenarBoslugu||'normal'];
  let qNum = 0;
  const qsHtml = zkQuestions.filter(q=>q.type!=='section').map(q => {
    qNum++;
    let html = '<div class="pq" style="margin-bottom:14pt;page-break-inside:avoid">';
    html += '<div style="font-weight:700;font-size:11pt;margin-bottom:6pt">'+qNum+'.</div>';
    if(q._zkType==='img' && q._imgSrc){
      html += '<div><img src="'+q._imgSrc+'" style="max-width:100%;height:auto;border:1px solid #ddd"></div>';
    } else {
      if(q.text) html += '<div style="margin-bottom:6pt">'+q.text+'</div>';
      if(q.images?.length) q.images.forEach(src => html += '<img class="pq-img" src="'+src+'">');
      if(q.type==='mc' && !q.siklarResimde){
        html += '<div class="pq-opts">';
        ['A','B','C','D','E'].forEach(k=>{if(q.options?.[k])html+='<div class="pq-opt"><b>'+k+')</b> '+q.options[k]+'</div>';});
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }).join('');
  
  H('print-output').innerHTML = '<div class="ppage" style="padding:'+padding+'">'
    +'<div style="text-align:center;font-size:14pt;font-weight:700;margin-bottom:4pt">'+(s.okulAdi||'')+'</div>'
    +'<div style="text-align:center;font-size:12pt;font-weight:600;margin-bottom:8pt;color:#3b82f6">Z-Kitap</div>'
    +'<hr style="border:none;border-top:2px solid #ddd;margin:12pt 0">'
    +'<div class="pq-container cols-2 pq-col-rule">'+qsHtml+'</div></div>';
  setTimeout(()=>window.print(),300);
}

// ── PDF PREVIEW ──
function zkPdfPreview(){
  if(!zkPdfCrops.length){ klbToast('⚠️ Henüz soru kesilmedi!','error'); return; }
  const s=db.settings||{};
  const marginMap={dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'};
  const padding=marginMap[s.kenarBoslugu||'normal'];
  const filigran=s.filigran||'';
  const wmOpacity=(s.filigranOpaklik||8)/100;
  const wmHtml=filigran?'<div class="p-watermark" style="opacity:'+wmOpacity+'">'+filigran+'</div>':'';
  let qsHtml='';
  zkPdfCrops.forEach((crop,idx)=>{
    qsHtml+='<div class="pq" style="margin-bottom:14pt;page-break-inside:avoid">';
    qsHtml+='<div style="font-weight:700;font-size:11pt;margin-bottom:6pt">'+(idx+1)+'.</div>';
    qsHtml+='<div><img src="'+crop.dataUrl+'" style="max-width:100%;height:auto;border:1px solid #ddd"></div>';
    qsHtml+='</div>';
  });
  const pageHtml='<div class="ppage" style="padding:'+padding+'">'+wmHtml
    +'<div style="text-align:center;font-size:14pt;font-weight:700;margin-bottom:4pt">'+(s.okulAdi||'')+'</div>'
    +'<div style="text-align:center;font-size:12pt;font-weight:600;margin-bottom:8pt;color:#3b82f6">Z-Kitap Çalışma Sayfası</div>'
    +'<div style="text-align:center;font-size:10pt;color:#666;margin-bottom:12pt">'+(s.dersAdi||'')+' • '+new Date().toLocaleDateString('tr-TR')+'</div>'
    +'<hr style="border:none;border-top:2px solid #ddd;margin:12pt 0">'
    +'<div class="pq-container cols-2 pq-col-rule">'+qsHtml+'</div></div>';
  H('zk-pdf-preview-content').innerHTML='<div style="background:#fff;width:min(800px,96vw);box-shadow:0 8px 48px rgba(0,0,0,.8);border-radius:4px;overflow:auto">'+pageHtml+'</div>';
  H('zk-pdf-preview').style.display='flex';
}

// ── INIT ──
if(typeof H === 'function'){
  document.addEventListener('DOMContentLoaded', function(){
    zkUpdatePDFButtons();
  });
}
