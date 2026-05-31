/* ============================================================
   PDF EDİTÖRÜ MODÜLÜ JS — Kelebek Platform V2
   Bağımsız çalışabilir. Ortak: ../shared/js/*
   ============================================================ */

// ── Cross-module stubs ──
function renderStats(){}
function showPage(){}

// ── Print Settings ──
function setMargin(v){db.settings.kenarBoslugu=v;saveDebounced();['dar','normal','genis'].forEach(m=>{const el=H('mar-'+m);if(el)el.classList.toggle('active',m===v);});}
function setImgSize(v){db.settings.resimBoyutu=v;saveDebounced();['kucuk','orta','buyuk','tam'].forEach(m=>{const el=H('img-'+m);if(el)el.classList.toggle('active',m===v);});}
function setSutun(n){db.settings.sutunSayisi=n;saveDebounced();[1,2,3].forEach(i=>{const el=H('col-'+i);if(el)el.classList.toggle('active',i===n);});}
function setColRule(v){db.settings.colRule=v;saveDebounced();['none','line','dash'].forEach(r=>{const el=H('cr-'+r);if(el)el.classList.toggle('active',r===v);});}
function setColText(){db.settings.colText=H('col-text')?.value||'';saveDebounced();}

function renderPrintSummary(){
  const ps=H('print-summary');if(!ps)return;
  const s=db.settings||{};
  const qs=(db.questions||[]).filter(q=>q.type!=='section');
  const assigned=getAssigned();
  ps.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
    <div><div class="lbl">SINAV</div><div style="font-weight:700">${s.sinavBasligi||'—'}</div></div>
    <div><div class="lbl">ÖĞRETMEN</div><div style="font-weight:700">${s.ogretmenAdi||'—'}</div></div>
    <div><div class="lbl">DERS</div><div style="font-weight:700">${s.dersAdi||'—'}</div></div>
    <div><div class="lbl">SORULAR</div><div style="font-weight:700">${qs.length} soru · ${qs.reduce((s,q)=>s+(q.puan||0),0)} puan</div></div>
    <div><div class="lbl">DAĞITIM</div><div style="font-weight:700">${assigned.length?assigned.length+' öğrenci':'Dağıtım yapılmadı'}</div></div>
    <div><div class="lbl">CEVAP ANH.</div><div style="font-weight:700">${{none:'Yok',page:'Her sayfaya',end:'En sona'}[s.cevapAnahtariPos||'none']}</div></div>
  </div>`;
}

function getAssigned(){
  if(!db.dagitim)return[];
  const seats=[];
  if(Array.isArray(db.dagitim)&&db.dagitim.length>0){
    if(Array.isArray(db.dagitim[0])&&Array.isArray(db.dagitim[0][0])){
      db.dagitim.forEach(grid=>{grid.forEach(row=>{row.forEach(seat=>{if(seat)seats.push(seat);});});});
    }else{
      db.dagitim.forEach(r=>{if(r.rows)r.rows.forEach(row=>row.forEach(s=>{if(s)seats.push(s);}));});
    }
  }
  return seats;
}
function makeFakeSeat(st){return{ogrenci:st,salon:'',sira:1,sutun:1};}

function cleanForPrint(html, sutun){
  const div=document.createElement('div');div.innerHTML=html;
  div.querySelectorAll('img').forEach(function(img){
    img.removeAttribute('title');img.removeAttribute('class');img.removeAttribute('onclick');
    img.style.cssText='display:block;width:100%;height:auto;max-width:100%;object-fit:contain;border:1px solid #ddd;margin:4pt 0;box-sizing:border-box';
  });
  const STRIP_PATTERNS=[/↑\s*Resme?\s*tıkla/i,/üzerine\s*çiz/i,/çizim\s*arac/i,/tıkla\s*→/i,/→\s*çiz/i];
  div.querySelectorAll('*').forEach(function(el){
    if(el.children.length===0){
      let t=el.textContent||'';
      if(STRIP_PATTERNS.some(function(p){return p.test(t);})){el.remove();}
    }
  });
  div.querySelectorAll('p,div,span').forEach(function(el){
    if(!el.children.length&&!(el.textContent||'').trim()&&!el.querySelector('img'))el.remove();
  });
  return div.innerHTML;
}

function buildAnswerKey(){
  const mcQs=(db.questions||[]).filter(q=>q.type==='mc');if(!mcQs.length)return'';
  let num=0;
  const rows=db.questions.map(q=>{
    if(q.type==='section')return'';num++;if(q.type!=='mc')return'';
    const ans=q.correct||'?';
    return`<span style="display:inline-flex;align-items:center;gap:2pt;margin:1pt 3pt;font-size:7.5pt"><b>${num}.</b><span style="width:14pt;height:14pt;border-radius:50%;background:${ans==='?'?'#aaa':'#1a7f37'};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:7pt">${ans}</span></span>`;
  }).join('');
  return`<div style="border-top:1px solid #555;margin-top:10pt;padding-top:5pt;font-size:7.5pt;color:#333"><b>CEVAP ANAHTARI:</b> ${rows}</div>`;
}
function buildAnswerKeyPage(){
  const mcQs=(db.questions||[]).filter(q=>q.type==='mc');if(!mcQs.length)return'';
  let num=0;
  const rows=db.questions.map(q=>{
    if(q.type==='section')return'';num++;if(q.type!=='mc')return'';
    const ans=q.correct||'?';
    return`<div style="display:inline-flex;align-items:center;gap:3pt;margin:3pt 5pt"><b style="font-size:.9em">${num}.</b><span style="width:18pt;height:18pt;border-radius:50%;background:${ans==='?'?'#aaa':'#1a7f37'};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:.8em">${ans}</span></div>`;
  }).join('');
  return`<div class="ppage" style="padding:15mm 20mm;page-break-before:always"><div style="font-size:13pt;font-weight:800;margin-bottom:10pt;border-bottom:2pt solid #333;padding-bottom:5pt">📋 CEVAP ANAHTARI — ${(db.settings||{}).sinavBasligi||'Sınav'}</div><div style="display:flex;flex-wrap:wrap">${rows}</div></div>`;
}

function buildPage(seat){
  const s=db.settings||{};
  const showSeat=H('opt-seat')?H('opt-seat').checked:true;
  const addLines=H('opt-lines')?H('opt-lines').checked:false;
  const sutun=s.sutunSayisi||1;
  const filigran=s.filigran||'';
  const wmOpacity=(s.filigranOpaklik||8)/100;
  const colRule=s.colRule||'none';
  const colText=s.colText||'';
  const dateStr=s.sinavTarihi?new Date(s.sinavTarihi).toLocaleDateString('tr-TR'):'';
  const marginMap={dar:'6mm 8mm',normal:'12mm 15mm',genis:'18mm 22mm'};
  const padding=marginMap[s.kenarBoslugu||'normal'];
  const wmHtml=filigran?`<div class="p-watermark" style="opacity:${wmOpacity}">${filigran}</div>`:'';

  // Mini oturma düzeni haritası (öğrencinin salondaki yeri) — orijinalden korundu
  let miniSeatingHtml='';
  if(showSeat&&seat.salon&&db.dagitim){
    let rows=null;
    // Yeni format (3D matrix [salon][row][col]) veya eski format ({salon,rows})
    if(Array.isArray(db.dagitim)&&db.dagitim.length>0&&Array.isArray(db.dagitim[0])&&Array.isArray(db.dagitim[0][0])){
      // 3D matrix: bu öğrencinin bulunduğu salon grid'ini, salon adından bul
      for(let si=0;si<db.dagitim.length;si++){
        const grid=db.dagitim[si];
        const salonAd=(db.salons&&db.salons[si])?(db.salons[si].ad||db.salons[si].name):null;
        if(salonAd===seat.salon||(!salonAd&&si===0)){ rows=grid; break; }
        // grid içinde bu seat var mı diye de bak
        let found=false;
        for(let r=0;r<grid.length&&!found;r++) for(let c=0;c<grid[r].length;c++){ const cell=grid[r][c]; if(cell&&cell.salon===seat.salon){ rows=grid; found=true; break; } }
        if(found) break;
      }
    } else {
      // Eski obje formatı
      const salonData=db.dagitim.find?db.dagitim.find(d=>d.salon===seat.salon):null;
      if(salonData) rows=salonData.rows;
    }
    if(rows&&rows.length){
      const myRow=seat.sira-1;
      const myCol=seat.sutun-1;
      const maxRows=Math.min(rows.length,10);
      const maxCols=rows[0]?Math.min(rows[0].length,10):0;
      miniSeatingHtml=`
        <div style="margin:6pt 0;padding:6pt;background:#f8f9fa;border:1px solid #ddd;border-radius:4pt">
          <div style="font-size:7pt;font-weight:700;margin-bottom:3pt;text-align:center">Oturma Düzeni - ${seat.salon}</div>
          <div style="display:grid;grid-template-columns:repeat(${maxCols},1fr);gap:1pt;max-width:80mm">
            ${rows.slice(0,maxRows).map((row,r)=>
              row.slice(0,maxCols).map((cell,c)=>{
                const isMe=r===myRow&&c===myCol;
                const isEmpty=!cell||!cell.ogrenci&&!cell.ad;
                const bg=isMe?'#22c55e':isEmpty?'#fff':'#e5e7eb';
                const border=isMe?'2pt solid #16a34a':'1pt solid #d1d5db';
                return `<div style="width:6mm;height:6mm;background:${bg};border:${border};border-radius:1pt;display:flex;align-items:center;justify-content:center;font-size:5pt;font-weight:${isMe?'900':'400'}">${isMe?'●':''}</div>`;
              }).join('')
            ).join('')}
          </div>
        </div>
      `;
    }
  }

  let questions=db.questions||[];
  if(seat.examGroup&&db.examGroups&&db.examGroups.length>0){
    const examGroup=db.examGroups.find(g=>g.id===seat.examGroup);
    if(examGroup&&examGroup.questions&&examGroup.questions.length>0) questions=examGroup.questions;
  }
  if(questions.length===0&&seat.examGroupIndex!==undefined&&db.examGroups){
    const examGroup=db.examGroups[seat.examGroupIndex];
    if(examGroup&&examGroup.questions&&examGroup.questions.length>0) questions=examGroup.questions;
  }

  let qNum=0;
  const qItems=questions.map((q,i)=>{
    if(q.type==='section')return`<div class="pq-section-title">${q.title||''}</div>`;
    qNum++;
    const hasText=q.text&&q.text.trim();
    const hasImgs=q.images&&q.images.length;
    const imgHtml=hasImgs?'<div class="pq-imgs">'+q.images.map(src=>`<img class="pq-img" src="${src}">`).join('')+'</div>':'';
    let opts='';
    if(q.type==='mc'&&!q.siklarResimde)opts='<div class="pq-opts">'+['A','B','C','D','E'].map(o=>'<div class="pq-opt"><b>'+o+')</b> '+((q.options&&q.options[o])||'')+'</div>').join('')+'</div>';
    let lines='';
    if((q.type==='open'||q.type==='fill')&&addLines){
      const lc=parseInt(s.linesCount)||6;
      lines=`<div class="pq-grid" style="height:${lc*6}mm"></div>`;
    }
    const bosluk=parseInt(q.bosluk)||0;
    const spaceHtml=bosluk>0?`<div style="height:${bosluk*18}pt"></div>`:'';
    const rawText=hasText?q.text:(hasImgs?'':'(Soru metni girilmedi)');
    const qText=rawText?cleanForPrint(rawText,sutun):rawText;
    const pqHeader='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:3pt"><span class="pq-n">'+qNum+'.</span>'+(q.aciklama?'<span style="font-size:8.5pt;color:#555;margin-left:4pt;font-weight:400">'+q.aciklama+'</span>':'')+(q.puan?'<span class="pq-p">('+q.puan+' puan)</span>':'')+'</div>';
    const pqBody=(qText?'<div class="pq-t">'+qText+'</div>':'')+imgHtml+opts+lines+spaceHtml;
    const fullwidthClass=q.fullwidth?' fullwidth':'';
    return'<div class="pq'+fullwidthClass+'">'+pqHeader+pqBody+'</div>';
  });

  let colRuleClass='';
  if(sutun>1){if(colRule==='line')colRuleClass=' pq-col-rule';else if(colRule==='dash')colRuleClass=' pq-col-rule-dash';}
  const colTextHtml=colText&&sutun>1?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);writing-mode:vertical-lr;text-orientation:upright;background:#fff;padding:6pt 2pt;font-size:7.5pt;color:#888;letter-spacing:4pt;z-index:2;white-space:nowrap;line-height:1">'+colText+'</div>':'';
  const smartLayout=H('opt-smart')&&H('opt-smart').checked;
  const smartStyle=smartLayout&&sutun>1?' style="column-fill:balance;orphans:3;widows:3"':'';
  const qsHtml='<div style="position:relative">'+colTextHtml+'<div class="pq-container cols-'+sutun+colRuleClass+'"'+smartStyle+'>'+qItems.join('')+'</div></div>';
  const akPos=s.cevapAnahtariPos||'none';
  const akPageHtml=akPos==='page'?buildAnswerKey():'';
  const examGroupInfo=seat.examGroupName?' | '+seat.examGroupName:'';

  return`<div class="ppage" style="padding:${padding}">${wmHtml}
    ${miniSeatingHtml}
    <div class="p-school">${s.okulAdi||''}${(()=>{const ts=s.teachers&&s.teachers.length?s.teachers.map(t=>t.unvan+' '+t.ad).join(' | '):(s.ogretmenAdi||'');return ts?' — '+ts:'';})()}</div>
    <div class="p-box"><div>
      <div class="p-name">${seat.ogrenci.ad}</div>
      <div class="p-info">No: ${seat.ogrenci.no} &nbsp;|&nbsp; Sınıf: ${seat.ogrenci.sinif}${showSeat&&seat.salon?' &nbsp;|&nbsp; '+seat.salon+' S:'+seat.sira+'-'+seat.sutun:''}${examGroupInfo}</div>
    </div></div>
    <div class="p-etitle">${s.sinavBasligi||'Sınav'}</div>
    <div class="p-emeta">${s.dersAdi?s.dersAdi+' · ':''}${dateStr?dateStr+' · ':''}${s.sinavSure?s.sinavSure+' dakika':''}</div>
    <hr class="p-div">
    ${qsHtml}${akPageHtml}
  </div>`;
}

function doPreview(){
  const ex=H('preview-modal');if(ex){ex.remove();return;}
  let sts=getAssigned().slice(0,2);
  if(!sts.length){const fakeSt={ad:'Örnek Öğrenci',no:'0000',sinif:'12-A'};sts=[makeFakeSeat(fakeSt)];}
  const pagesHtml=sts.map(s=>buildPage(s)).join('<div style="height:20px;background:#e0e0e0;margin:10px 0"></div>');
  const modal=document.createElement('div');modal.id='preview-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden';
  const hdr='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#0a1020;border-bottom:1px solid #1e2d4a;flex-shrink:0"><span style="font-weight:800;color:#e2e8f8">👁️ Önizleme</span><div style="display:flex;gap:8px"><button onclick="doPrint()" style="padding:5px 14px;border-radius:6px;background:#22c55e;border:none;color:#000;cursor:pointer;font-weight:700;font-size:.8rem">🖨️ Yazdır</button><button onclick="H(\'preview-modal\').remove()" style="padding:5px 12px;border-radius:6px;background:#ef4444;border:none;color:#fff;cursor:pointer;font-weight:700;font-size:.8rem">✕ Kapat</button></div></div>';
  const body='<div style="flex:1;overflow:auto;background:#ccc;padding:20px"><div id="pm-content" style="background:#fff;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.4);font-family:Arial,sans-serif;font-size:10pt;color:#000;line-height:1.5">'+pagesHtml+'</div></div>';
  modal.innerHTML=hdr+body;document.body.appendChild(modal);
}

function doPrint(){
  let sts=getAssigned();
  if(!sts.length){const fakeSt={ad:'Örnek Öğrenci',no:'0000',sinif:'12-A'};sts=[makeFakeSeat(fakeSt)];}
  const akPos=(db.settings||{}).cevapAnahtariPos||'none';
  H('print-output').innerHTML=sts.map(s=>buildPage(s)).join('')+(akPos==='end'?buildAnswerKeyPage():'');
  window.print();
}

function printSalonListCompact(){
  if(!db.dagitim||!db.dagitim.length){klbToast('⚠️ Önce Kelebek Dağıtımı yapın!');return;}
  const printWindow=window.open('','_blank');
  let html='';
  db.salons.forEach((salon,salonIdx)=>{
    const grid=db.dagitim[salonIdx];if(!grid)return;
    const gridHtml=grid.map((row,r)=>`<tr>${row.map((seat,c)=>{
      if(!seat)return`<td style="border:1px solid #ddd;padding:2px;text-align:center;background:#f5f5f5;font-size:6pt;color:#999;width:45px;height:35px">-</td>`;
      const parts=seat.ogrenci.ad.split(' ');const short=parts.map((w,i)=>i===0?w:w[0]+'.').join(' ');
      const groupColors=['#dbeafe','#d1fae5','#fef3c7','#e0e7ff'];const bgColor=groupColors[seat.examGroupIndex%4];
      return`<td style="border:1px solid #333;padding:2px;text-align:center;background:${bgColor};font-size:6pt;width:45px;height:35px"><div style="font-weight:700;font-size:6.5pt">${seat.ogrenci.no}</div><div style="font-size:5.5pt;margin:1px 0">${short}</div><div style="font-size:5pt;color:#666">${seat.examGroupName||''}</div></td>`;
    }).join('')}</tr>`).join('');
    const students=[];grid.forEach((row,r)=>{row.forEach((seat,c)=>{if(seat)students.push({...seat.ogrenci,sira:r+1,sutun:c+1,examGroup:seat.examGroupName||''});});});
    students.sort((a,b)=>a.no.localeCompare(b.no));
    html+=`<div style="page-break-after:always;padding:8mm;font-family:Arial,sans-serif"><div style="text-align:center;margin-bottom:4mm"><h1 style="margin:0;font-size:14pt;font-weight:700">${salon.ad} Salonu</h1><div style="font-size:9pt;color:#666;margin-top:1mm">${(db.settings||{}).sinavBasligi||'Sınav'} - ${students.length} Öğrenci</div></div><div style="margin-bottom:4mm"><h3 style="margin:0 0 2mm 0;font-size:9pt;font-weight:700">📍 Oturma Düzeni</h3><table style="border-collapse:collapse;margin:0 auto">${gridHtml}</table></div><div><h3 style="margin:0 0 2mm 0;font-size:9pt;font-weight:700">📋 Öğrenci Listesi</h3><table style="width:100%;border-collapse:collapse;font-size:6.5pt"><thead><tr style="background:#2563eb;color:#fff"><th style="border:1px solid #ddd;padding:1.5mm;text-align:left">No</th><th style="border:1px solid #ddd;padding:1.5mm;text-align:left">Ad Soyad</th><th style="border:1px solid #ddd;padding:1.5mm;text-align:left">Sınıf</th><th style="border:1px solid #ddd;padding:1.5mm;text-align:center">Sıra</th><th style="border:1px solid #ddd;padding:1.5mm;text-align:center">Sütun</th><th style="border:1px solid #ddd;padding:1.5mm;text-align:left">Sınav Grubu</th></tr></thead><tbody>${students.map((s,idx)=>`<tr style="background:${idx%2===0?'#f9fafb':'#fff'}"><td style="border:1px solid #ddd;padding:1mm;font-size:6.5pt">${s.no}</td><td style="border:1px solid #ddd;padding:1mm;font-size:6.5pt">${s.ad}</td><td style="border:1px solid #ddd;padding:1mm;font-size:6.5pt">${s.sinif}</td><td style="border:1px solid #ddd;padding:1mm;text-align:center;font-size:6.5pt">${s.sira}</td><td style="border:1px solid #ddd;padding:1mm;text-align:center;font-size:6.5pt">${s.sutun}</td><td style="border:1px solid #ddd;padding:1mm;font-size:6.5pt">${s.examGroup}</td></tr>`).join('')}</tbody></table></div></div>`;
  });
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Salon Oturma Planları</title><style>@media print{@page{margin:6mm;size:A4}body{margin:0}}</style></head><body>${html}</body></html>`);
  printWindow.document.close();printWindow.print();
}

function printDistributionList(){
  if(!db.dagitim||!db.dagitim.length){klbToast('⚠️ Önce Kelebek Dağıtımı yapın!');return;}
  const byClass={};
  if(Array.isArray(db.dagitim[0])&&Array.isArray(db.dagitim[0][0])){
    db.dagitim.forEach((grid,salonIdx)=>{const salon=db.salons[salonIdx];grid.forEach(row=>{row.forEach(seat=>{if(seat&&seat.ogrenci){const className=seat.ogrenci.sinif;if(!byClass[className])byClass[className]=[];byClass[className].push({ad:seat.ogrenci.ad,no:seat.ogrenci.no,salon:seat.salon||salon.ad,sira:seat.sira,sutun:seat.sutun,examGroup:seat.examGroupName||''});}});});});
  }else{
    db.dagitim.forEach(salon=>{salon.rows.forEach(row=>{row.forEach(seat=>{if(seat&&seat.ogrenci){const className=seat.ogrenci.sinif;if(!byClass[className])byClass[className]=[];byClass[className].push({ad:seat.ogrenci.ad,no:seat.ogrenci.no,salon:seat.salon,sira:seat.sira,sutun:seat.sutun,examGroup:seat.examGroupName||''});}});});});
  }
  const sortedClasses=Object.keys(byClass).sort();
  let html=`<div style="font-family:Arial,sans-serif;padding:20mm;max-width:800px;margin:0 auto"><h1 style="text-align:center;margin-bottom:8mm">📋 Sınav Dağıtım Listesi</h1><div style="text-align:center;margin-bottom:12mm;color:#666">${(db.settings||{}).okulAdi||''} - ${(db.settings||{}).sinavBasligi||'Sınav'}</div>`;
  sortedClasses.forEach(className=>{
    const students=byClass[className].sort((a,b)=>a.no.localeCompare(b.no));
    html+=`<div style="page-break-inside:avoid;margin-bottom:12mm"><h2 style="background:#2563eb;color:#fff;padding:4mm;margin:0 0 4mm 0;border-radius:2mm">${className}</h2><table style="width:100%;border-collapse:collapse;font-size:10pt"><thead><tr style="background:#f3f4f6"><th style="border:1px solid #ddd;padding:2mm;text-align:left">No</th><th style="border:1px solid #ddd;padding:2mm;text-align:left">Ad Soyad</th><th style="border:1px solid #ddd;padding:2mm;text-align:left">Salon</th><th style="border:1px solid #ddd;padding:2mm;text-align:center">Sıra</th><th style="border:1px solid #ddd;padding:2mm;text-align:center">Sütun</th><th style="border:1px solid #ddd;padding:2mm;text-align:left">Sınav Grubu</th></tr></thead><tbody>${students.map(s=>`<tr><td style="border:1px solid #ddd;padding:2mm">${s.no}</td><td style="border:1px solid #ddd;padding:2mm">${s.ad}</td><td style="border:1px solid #ddd;padding:2mm">${s.salon}</td><td style="border:1px solid #ddd;padding:2mm;text-align:center">${s.sira}</td><td style="border:1px solid #ddd;padding:2mm;text-align:center">${s.sutun}</td><td style="border:1px solid #ddd;padding:2mm">${s.examGroup}</td></tr>`).join('')}</tbody></table><div style="margin-top:2mm;font-size:9pt;color:#666">Toplam: ${students.length} öğrenci</div></div>`;
  });
  html+=`<div style="margin-top:12mm;padding:4mm;background:#f9fafb;border:1px solid #ddd;border-radius:2mm;font-size:9pt;color:#666"><strong>Not:</strong> Bu listeyi sınavdan önce öğrencilere dağıtın.</div></div>`;
  const printWindow=window.open('','_blank');
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Dağıtım Listesi</title><style>@media print{@page{margin:15mm}body{margin:0}}</style></head><body>${html}</body></html>`);
  printWindow.document.close();printWindow.print();
}

// ── Fullscreen ──
let _fs=false;
function toggleFS(){
  const btn=H('fs-btn');
  if(document.fullscreenEnabled&&!document.fullscreenElement){
    document.documentElement.requestFullscreen();if(btn)btn.textContent='✕';
  }else if(document.fullscreenElement){
    document.exitFullscreen();if(btn)btn.textContent='⛶';
  }else{
    _fs=!_fs;document.body.classList.toggle('fs-mode',_fs);
    if(btn)btn.textContent=_fs?'✕':'⛶';
  }
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){const btn=H('fs-btn');if(btn)btn.textContent='⛶';}});

// ── Save/Load ──
function saveExamToFile(){
  const hasQuestions=(db.questions&&db.questions.length>0)||(db.examGroups&&db.examGroups.some(g=>g.questions&&g.questions.length>0));
  if(!hasQuestions){klbToast('⚠️ Kaydedilecek soru yok!');return;}
  const defName=((db.settings||{}).sinavBasligi||(db.settings||{}).okulAdi||'Sinav').replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_').trim()||'Sinav';
  klbAskName(defName,'Sınavı Kaydet',(name)=>{
    const payload={app:KLB_APP_ID,type:'exam',version:'2.0',savedAt:new Date().toISOString(),fileName:name,questions:db.questions||[],examGroups:db.examGroups||[],salons:db.salons||[],savedExams:db.savedExams||[],settings:{okulAdi:(db.settings||{}).okulAdi||'',dersAdi:(db.settings||{}).dersAdi||'',sinavBasligi:(db.settings||{}).sinavBasligi||'',sinavTarihi:(db.settings||{}).sinavTarihi||'',sinavSure:(db.settings||{}).sinavSure||'',sinifSube:(db.settings||{}).sinifSube||'',ogretmenAdi:(db.settings||{}).ogretmenAdi||'',filigran:(db.settings||{}).filigran||'',filigranOpaklik:(db.settings||{}).filigranOpaklik||8,teachers:(db.settings||{}).teachers||[]}};
    const content=klbEncode(payload);const safeFilename=name.replace(/[^\w\sğüşıöçĞÜŞİÖÇ-]/g,'_');
    klbDownload(content,safeFilename+'.klb');
    klbToast(`✅ Kaydedildi: ${safeFilename}.klb`,'success');
  });
}
function loadExamFromFile(){
  const input=document.createElement('input');input.type='file';input.accept='.klb,.json';
  input.onchange=function(e){
    const file=e.target.files[0];if(!file)return;
    const ext=file.name.split('.').pop().toLowerCase();const reader=new FileReader();
    reader.onload=function(event){
      try{let data;if(ext==='klb'){data=klbDecode(event.target.result);}else{data=JSON.parse(event.target.result);}
      db.questions=data.questions||[];db.examGroups=data.examGroups||[];db.salons=data.salons||[];
      if(data.settings)Object.assign(db.settings,data.settings);
      saveDebounced();loadSettings();renderPrintSummary();
      klbToast(`✅ Yüklendi: ${file.name}\n${(db.questions||[]).length} soru`,'success');
    }catch(err){klbToast('❌ '+err.message);}};reader.readAsText(file);
  };input.click();
}

// ── Init ──
function initPdfEditoru(){
  ['dar','normal','genis'].forEach(m=>{const el=H('mar-'+m);if(el)el.classList.toggle('active',m===(db.settings.kenarBoslugu||'normal'));});
  ['kucuk','orta','buyuk','tam'].forEach(m=>{const el=H('img-'+m);if(el)el.classList.toggle('active',m===(db.settings.resimBoyutu||'orta'));});
  const ss=db.settings.sutunSayisi||1;[1,2,3].forEach(i=>{const el=H('col-'+i);if(el)el.classList.toggle('active',i===ss);});
  const cr=db.settings.colRule||'none';['none','line','dash'].forEach(r=>{const el=H('cr-'+r);if(el)el.classList.toggle('active',r===cr);});
  const ct=H('col-text');if(ct)ct.value=db.settings.colText||'';
  const akp=H('ak-pos');if(akp)akp.value=db.settings.cevapAnahtariPos||'none';
  renderPrintSummary();
}
function updateAkPos(){db.settings.cevapAnahtariPos=H('ak-pos')?.value||'none';saveDebounced();}

if(typeof H === 'function'){
  document.addEventListener('DOMContentLoaded',function(){setTimeout(initPdfEditoru,300);});
}
