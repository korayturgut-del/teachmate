/* ============================================================
   KELEBEK DAĞITIM MODÜLÜ JS — Kelebek Platform V2
   Bağımsız çalışabilir. Ortak: ../shared/js/*
   ============================================================ */

// ── Cross-module stubs (bağımsızlık için) ──
function saveS(){}               // Çıktı ayarları stub
function renderStats(){}         // Ana sayfa stats stub
function showPage(){}            // Ana sayfa sayfa geçiş stub
if(!window.cssAutoUpload) window.cssAutoUpload=function(){};
if(!window.cssUploadStudentsToCloud) window.cssUploadStudentsToCloud=function(){};

// ── Salon listesi (orijinalden birebir) ──
function renderSalonList(){
  const cont=H('salon-list');if(!cont)return;
  cont.innerHTML=(db.salons||[]).map(s=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r)">
      <span style="font-size:.82rem;flex:1"><b>${s.ad}</b> — ${s.satirSayisi}×${s.sutunSayisi}</span>
      <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="delSalon('${s.id}')">✕</button>
    </div>`).join('');
}

function addSalonDo(){
  const ad=H('salon-ad')?.value.trim();
  const satir=parseInt(H('salon-satir')?.value)||6;
  const sutun=parseInt(H('salon-sutun')?.value)||6;
  if(!ad){klbToast('Salon adı girin!');return;}
  const id='s_'+(salonCnt++);
  db.salons.push({id,ad,satirSayisi:satir,sutunSayisi:sutun});
  saveDebounced();renderSalonList();
}

function delSalon(id){
  db.salons=db.salons.filter(s=>s.id!==id);saveDebounced();renderSalonList();
}

function renderKChecks(){
  renderGrupSinifAtama();
}

// ── GRUPLARA SINIF ATAMA ARAYÜZÜ (orijinalden birebir) ──
function renderGrupSinifAtama(){
  const cont=H('grup-sinif-atama');
  if(!cont)return;
  
  if(!db.examGroups||db.examGroups.length===0){
    cont.innerHTML=`
      <div class="alert alert-warn" style="font-size:.82rem">
        ⚠️ <b>Sınav Editörü'nde hiç grup yok!</b><br>
        Önce Sınav Editörü sayfasında en az bir grup oluşturun.
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px" onclick="location.href='../sinav-editoru/index.html'">
        ✏️ Sınav Editörü'ne Git
      </button>
    `;
    return;
  }
  
  const allClasses=Object.keys(db.classes||{}).sort();
  
  if(allClasses.length===0){
    cont.innerHTML=`
      <div class="alert alert-warn" style="font-size:.82rem">
        ⚠️ <b>Hiç sınıf yok!</b><br>
        Önce Öğrenciler sayfasında sınıf oluşturun.
      </div>
    `;
    return;
  }
  
  let html='';
  
  db.examGroups.forEach((group,idx)=>{
    const colorClass=['b9','b10','b11','b12'][idx%4];
    const assignedClasses=group.classes||[];
    
    html+=`
      <div style="margin-bottom:12px;padding:10px;background:var(--bg0);border:1px solid var(--border);border-radius:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span class="badge ${colorClass}" style="font-size:.7rem">${idx+1}</span>
          <span style="font-weight:700;font-size:.85rem">${group.name}</span>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 140px;gap:8px">
          <div>
            <label class="lbl" style="font-size:.72rem;margin-bottom:4px">Sınıf seçin:</label>
            <select class="inp inp-sm" id="group-classes-${group.id}" multiple style="min-height:80px;font-size:.78rem" onchange="updateSelectedPreview('${group.id}')">
              ${allClasses.map(className=>{
                const selected=assignedClasses.includes(className)?'selected':'';
                const studentCount=(db.classes[className]||[]).length;
                return `<option value="${className}" ${selected}>${className} (${studentCount} öğr.)</option>`;
              }).join('')}
            </select>
          </div>
          
          <div>
            <label class="lbl" style="font-size:.72rem;margin-bottom:4px">Seçilenler:</label>
            <div id="selected-preview-${group.id}" style="min-height:80px;padding:6px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;font-size:.7rem;overflow-y:auto;max-height:80px">
              ${assignedClasses.length>0?assignedClasses.map(c=>`<div style="padding:2px 4px;background:var(--bg3);border-radius:3px;margin-bottom:2px">${c}</div>`).join(''):'<span style="color:var(--text3)">Boş</span>'}
            </div>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px">
          <button class="btn btn-ghost btn-xs" onclick="selectAllClasses('${group.id}')">
            ☑ Tümü
          </button>
          <button class="btn btn-ghost btn-xs" onclick="clearAllClasses('${group.id}')">
            ☐ Temizle
          </button>
          <button class="btn btn-ghost btn-xs" onclick="smartAutoAssign('${group.id}','${group.name}')">
            🧠 Akıllı
          </button>
        </div>
      </div>
    `;
  });
  
  cont.innerHTML=html;
}

// ── SEÇİLEN SINIFLARI ÖNİZLEME VE OTOMATİK KAYDETME (orijinalden birebir) ──
function updateSelectedPreview(groupId){
  const sel=H('group-classes-'+groupId);
  const preview=H('selected-preview-'+groupId);
  if(!sel||!preview)return;
  
  const selected=Array.from(sel.selectedOptions).map(opt=>opt.value);
  
  if(selected.length===0){
    preview.innerHTML='<span style="color:var(--text3)">Boş</span>';
  }else{
    preview.innerHTML=selected.map(c=>`<div style="padding:2px 4px;background:var(--bg3);border-radius:3px;margin-bottom:2px;font-size:.7rem">${c}</div>`).join('');
  }
  
  const group=db.examGroups.find(g=>g.id===groupId);
  if(group){
    group.classes=selected;
    saveDebounced();
  }
}

// ── AKILLI OTOMATİK ATAMA (orijinalden birebir) ──
function smartAutoAssign(groupId,groupName){
  const sel=H('group-classes-'+groupId);
  if(!sel)return;
  
  const levelMatch=groupName.match(/(\d+)/);
  if(!levelMatch){
    klbToast('⚠️ Grup adında sayı bulunamadı!\n\n"9. Sınıflar", "11" gibi bir ad kullanın.');
    return;
  }
  
  const targetLevel=levelMatch[1];
  
  Array.from(sel.options).forEach(opt=>{
    const className=opt.value;
    const classLevel=className.match(/^(\d+)/);
    if(classLevel&&classLevel[1]===targetLevel){
      opt.selected=true;
    }else{
      opt.selected=false;
    }
  });
  
  updateSelectedPreview(groupId);
  
  const selectedCount=Array.from(sel.selectedOptions).length;
  if(selectedCount>0){
    klbToast(`✅ ${selectedCount} sınıf otomatik seçildi ve kaydedildi!\n\n"${targetLevel}" ile başlayan tüm sınıflar.`);
  }else{
    klbToast(`⚠️ "${targetLevel}" ile başlayan sınıf bulunamadı!`);
  }
}

// ── TÜMÜNÜ SEÇ (orijinalden birebir) ──
function selectAllClasses(groupId){
  const sel=H('group-classes-'+groupId);
  if(!sel)return;
  Array.from(sel.options).forEach(opt=>opt.selected=true);
  updateSelectedPreview(groupId);
}

// ── TEMİZLE (orijinalden birebir) ──
function clearAllClasses(groupId){
  const sel=H('group-classes-'+groupId);
  if(!sel)return;
  Array.from(sel.options).forEach(opt=>opt.selected=false);
  updateSelectedPreview(groupId);
}

// ── TÜM SINIFLARI OTOMATİK DAĞIT (HTML'deki onclick) ──
function autoAssignClasses(){
  if(!db.examGroups||db.examGroups.length===0){
    klbToast('⚠️ Önce Sınav Editörü\'nde grup oluşturun!');
    return;
  }
  
  if(!db.classes||Object.keys(db.classes).length===0){
    klbToast('⚠️ Önce Öğrenciler sayfasında sınıf oluşturun!');
    return;
  }
  
  // Her grup için akıllı atama yap
  db.examGroups.forEach(group=>{
    smartAutoAssign(group.id, group.name);
  });
  
  // Son olarak hiç atanmamış sınıfları kalan gruplara dağıt
  const allClasses=Object.keys(db.classes||{}).sort();
  const assignedClasses=new Set();
  db.examGroups.forEach(g=>{
    (g.classes||[]).forEach(c=>assignedClasses.add(c));
  });
  
  const unassigned=allClasses.filter(c=>!assignedClasses.has(c));
  
  if(unassigned.length>0){
    unassigned.forEach((className,idx)=>{
      const targetGroup=db.examGroups[idx % db.examGroups.length];
      if(!targetGroup.classes) targetGroup.classes=[];
      if(!targetGroup.classes.includes(className)){
        targetGroup.classes.push(className);
      }
    });
    saveDebounced();
  }
  
  renderGrupSinifAtama();
  
  const totalAssigned=db.examGroups.reduce((sum,g)=>sum+(g.classes||[]).length,0);
  klbToast(`✅ Toplam ${totalAssigned} sınıf gruplara otomatik dağıtıldı!`);
}

// ── KELEBEK BOŞLUK AYARI (orijinalden birebir) ──
function setKBosluk(v){
  db.settings.kelebek_bosluk=v;saveDebounced();
  ['yok','az','orta','genis'].forEach(b=>{const el=H('kb-'+b);if(el)el.classList.toggle('active',b===v);});
}

// ── YENİ KELEBEK DAĞITIMI - GRUPLARA GÖRE (orijinalden birebir) ──
function runButterflyWithGroups(){
  if(!db.examGroups||db.examGroups.length===0){
    klbToast('⚠️ Sınav Editörü\'nde en az bir grup oluşturun!');
    location.href='../sinav-editoru/index.html';
    return;
  }
  
  const hasEmptyGroup=db.examGroups.some(g=>!g.classes||g.classes.length===0);
  if(hasEmptyGroup){
    klbToast('⚠️ Her gruba en az bir sınıf atayın!\n\nGrup listesinde sınıf seçin ve "Kaydet" butonuna basın.');
    return;
  }
  
  const allAssignedClasses=new Set();
  db.examGroups.forEach(group=>{
    (group.classes||[]).forEach(className=>{
      allAssignedClasses.add(className);
    });
  });
  
  if(allAssignedClasses.size===0){
    klbToast('⚠️ Hiçbir gruba sınıf atanmamış!');
    return;
  }
  
  const satirInput=H('salon-satir-global');
  const sutunInput=H('salon-sutun-global');
  const satir=satirInput?parseInt(satirInput.value)||5:5;
  const sutun=sutunInput?parseInt(sutunInput.value)||6:6;
  
  db.salons=[];
  Array.from(allAssignedClasses).sort().forEach(className=>{
    db.salons.push({
      id:'salon_'+Date.now()+'_'+Math.random().toString(36).substr(2,6),
      ad:className,
      satirSayisi:satir,
      sutunSayisi:sutun
    });
  });
  
  saveDebounced();
  
  const allStudents=[];
  const groupInfo=[];
  
  db.examGroups.forEach((group,idx)=>{
    let groupStudentCount=0;
    (group.classes||[]).forEach(className=>{
      const classStudents=db.classes[className]||[];
      classStudents.forEach(student=>{
        allStudents.push({
          ...student,
          examGroup:group.id,
          examGroupName:group.name,
          examGroupIndex:idx
        });
        groupStudentCount++;
      });
    });
    
    if(groupStudentCount>0){
      groupInfo.push({
        id:group.id,
        name:group.name,
        index:idx,
        totalStudents:groupStudentCount
      });
    }
  });
  
  const result=perfectButterflyDistribution(allStudents,db.salons);
  
  db.dagitim=result;
  db.dagitimGroupInfo=groupInfo;
  saveDebounced();
  
  renderKResultFromMatrix(result,groupInfo);
  renderSeatingFromMatrix(result,groupInfo);
  
  const totalPlaced=result.reduce((sum,salonGrid)=>{
    return sum+salonGrid.flat().filter(seat=>seat!==null).length;
  },0);
  
  const totalStudents=allStudents.length;
  const unplaced=totalStudents-totalPlaced;
  
  klbToast(`✅ Kelebek dağıtımı tamamlandı!\n\n📊 Özet:\n• ${db.salons.length} salon\n• ${db.examGroups.length} farklı sınav kağıdı\n• ${totalPlaced} öğrenci yerleştirildi${unplaced>0?'\n⚠️ '+unplaced+' öğrenci yerleştirilemedi (kapasite yetersiz)':''}\n\n🦋 Matris Deseni: Yan yana, çapraz VE ön-arka farklı grup!`);
}

// ── PROFESYONEL MATRİS DESENİ ALGORİTMASI (orijinalden birebir) ──
function perfectButterflyDistribution(students,salons){
  let groupsMap={};
  
  students.forEach(s=>{
    const groupIndex=s.examGroupIndex!==undefined?s.examGroupIndex:0;
    if(!groupsMap[groupIndex])groupsMap[groupIndex]=[];
    groupsMap[groupIndex].push(s);
  });
  
  let groupKeys=Object.keys(groupsMap);
  groupKeys.forEach(k=>groupsMap[k].sort(()=>Math.random()-0.5));
  
  groupKeys.sort((a,b)=>groupsMap[b].length-groupsMap[a].length);
  
  const totalCapacity=salons.reduce((sum,s)=>sum+(s.satirSayisi*s.sutunSayisi),0);
  const totalStudents=students.length;
  
  const salonTargets=salons.map(s=>{
    const capacity=s.satirSayisi*s.sutunSayisi;
    const ratio=capacity/totalCapacity;
    return Math.floor(totalStudents*ratio);
  });
  
  const assignedTotal=salonTargets.reduce((sum,t)=>sum+t,0);
  if(assignedTotal<totalStudents){
    salonTargets[0]+=(totalStudents-assignedTotal);
  }
  
  let pools=[[],[],[],[]];
  
  if(groupKeys.length===1){
    pools[0]=groupsMap[groupKeys[0]];
  }
  else if(groupKeys.length===2){
    let half0=Math.floor(groupsMap[groupKeys[0]].length/2);
    let half1=Math.floor(groupsMap[groupKeys[1]].length/2);
    pools[0]=groupsMap[groupKeys[0]].slice(0,half0);
    pools[3]=groupsMap[groupKeys[0]].slice(half0);
    pools[1]=groupsMap[groupKeys[1]].slice(0,half1);
    pools[2]=groupsMap[groupKeys[1]].slice(half1);
  }
  else if(groupKeys.length===3){
    let half=Math.floor(groupsMap[groupKeys[0]].length/2);
    pools[0]=groupsMap[groupKeys[0]].slice(0,half);
    pools[3]=groupsMap[groupKeys[0]].slice(half);
    pools[1]=groupsMap[groupKeys[1]];
    pools[2]=groupsMap[groupKeys[2]];
  }
  else{
    let currentPool=0;
    groupKeys.forEach(k=>{
      pools[currentPool%4].push(...groupsMap[k]);
      currentPool++;
    });
  }
  
  const distribution=[];
  
  salons.forEach((salon,salonIdx)=>{
    const grid=Array.from({length:salon.satirSayisi},()=>Array(salon.sutunSayisi).fill(null));
    const targetStudents=salonTargets[salonIdx];
    const isLastSalon=(salonIdx===salons.length-1);
    let salonPlaced=0;
    
    for(let r=0;r<salon.satirSayisi;r++){
      for(let c=0;c<salon.sutunSayisi;c++){
        if(!isLastSalon&&salonPlaced>=targetStudents)break;
        
        let poolIndex;
        if(r%2===0){
          poolIndex=(c%2===0)?0:1;
        }else{
          poolIndex=(c%2===0)?2:3;
        }
        
        let student=pools[poolIndex].pop();
        
        if(!student){
          let maxPoolIdx=0;
          let maxLen=-1;
          for(let p=0;p<4;p++){
            if(pools[p].length>maxLen){
              maxLen=pools[p].length;
              maxPoolIdx=p;
            }
          }
          if(maxLen>0){
            student=pools[maxPoolIdx].pop();
          }
        }
        
        if(student){
          grid[r][c]={
            ogrenci:student,
            examGroup:student.examGroup,
            examGroupName:student.examGroupName,
            examGroupIndex:student.examGroupIndex,
            salon:salon.ad,
            sira:r+1,
            sutun:c+1
          };
          salonPlaced++;
        }
      }
    }
    
    distribution.push(grid);
  });
  
  return distribution;
}

// ── MATRİS SONUÇLARINI GÖSTER (orijinalden birebir) ──
function renderKResultFromMatrix(salonGrids,groupInfo){
  let totalPlaced=0;
  let html='';
  
  salonGrids.forEach((grid,idx)=>{
    const salon=db.salons[idx];
    let n=0;
    const groupCount={};
    
    grid.flat().forEach(seat=>{
      if(seat){
        n++;
        totalPlaced++;
        const groupName=seat.examGroupName||'Bilinmeyen';
        groupCount[groupName]=(groupCount[groupName]||0)+1;
      }
    });
    
    const badges=Object.keys(groupCount).map((groupName,i)=>{
      const colorClass=['b9','b10','b11','b12'][i%4];
      return `<span class="badge ${colorClass}">${groupName}: ${groupCount[groupName]}</span>`;
    }).join(' ');
    
    html+=`<div style="margin-bottom:8px"><b>🚪 ${salon.ad}</b> — ${n} öğrenci &nbsp; ${badges}</div>`;
  });
  
  let groupSummary='';
  if(groupInfo&&groupInfo.length>0){
    groupSummary=`<div style="margin-top:12px;padding:10px;background:var(--bg0);border-radius:8px">
      <div style="font-size:.82rem;font-weight:700;margin-bottom:6px">📋 Sınav Grupları:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${groupInfo.map((g,idx)=>{
          const colorClass=['b9','b10','b11','b12'][idx%4];
          return `<span class="badge ${colorClass}">${g.name} (${g.totalStudents})</span>`;
        }).join('')}
      </div>
    </div>`;
  }
  
  const totalStudents=groupInfo.reduce((sum,g)=>sum+g.totalStudents,0);
  const remaining=totalStudents-totalPlaced;
  
  H('k-result').innerHTML=`
    <div class="alert ${remaining?'alert-warn':'alert-ok'}" style="margin-bottom:12px">
      ${remaining?'⚠️ '+remaining+' öğrenci yerleştirilemedi (kapasite yetersiz)':'✅ '+totalPlaced+' öğrenci başarıyla yerleştirildi!'}
    </div>
    ${html}
    ${groupSummary}
  `;
}

// ── MATRİS OTURMA PLANINI GÖSTER (orijinalden birebir) ──
function renderSeatingFromMatrix(salonGrids,groupInfo){
  const kb=db.settings.kelebek_bosluk||'yok';
  const boslukMap={yok:'0px',az:'4px',orta:'10px',genis:'18px'};
  const rowGap=boslukMap[kb]||'0px';
  
  const usedGroups=new Set();
  salonGrids.forEach(grid=>grid.flat().forEach(seat=>{
    if(seat&&seat.examGroupName)usedGroups.add(seat.examGroupName);
  }));
  
  const groupBadges=Array.from(usedGroups).map((groupName,idx)=>{
    const colorClass=['b9','b10','b11','b12'][idx%4];
    return `<span class="badge ${colorClass}">${groupName}</span>`;
  }).join('');
  
  H('seating-plans').innerHTML=salonGrids.map((grid,idx)=>{
    const salon=db.salons[idx];
    return `
      <div class="card mt3">
        <div class="card-header">
          <div class="card-title">🚪 ${salon.ad}</div>
          <div class="fx g2 fw">${groupBadges}</div>
        </div>
        <div style="overflow-x:auto">
          <div style="display:flex;flex-direction:column;gap:${rowGap}">
            ${grid.map(row=>`
              <div class="srow">
                ${row.map(seat=>{
                  if(!seat)return`<div class="seat sempty"></div>`;
                  const parts=seat.ogrenci.ad.split(' ');
                  const short=parts.map((w,i)=>i===0?w:w[0]+'.').join(' ');
                  const groupIdx=seat.examGroupIndex||0;
                  const colorClass=['s9','s10','s11','s12'][groupIdx%4];
                  
                  return`<div class="seat ${colorClass}" title="${seat.ogrenci.ad}\nNo: ${seat.ogrenci.no}\nSınıf: ${seat.ogrenci.sinif}\nSınav: ${seat.examGroupName||''}">
                    <div class="sno">${seat.ogrenci.no}</div>
                    <div class="sname">${short}</div>
                    <div class="scls">${seat.ogrenci.sinif}</div>
                    <div style="font-size:.6rem;color:var(--text3);margin-top:2px">${seat.examGroupName||''}</div>
                  </div>`;
                }).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── ESKİ KELEBEK DAĞITIMI (orijinalden birebir) ──
function runButterfly(){
  if(!db.examGroups||db.examGroups.length===0){
    klbToast('⚠️ Önce Sınav Editörü\'nde en az bir grup oluşturun!\n\nÖrnek:\n- 9. Sınıflar\n- 11. Sınıflar\n- 12. Sınıflar');
    return;
  }
  
  if(!db.salons||db.salons.length===0){
    klbToast('⚠️ En az bir salon ekleyin!');
    return;
  }
  
  const queues=[];
  const groupInfo=[];
  
  db.examGroups.forEach((group,idx)=>{
    const students=[];
    (group.classes||[]).forEach(className=>{
      const classStudents=db.classes[className]||[];
      classStudents.forEach(student=>{
        students.push({
          ...student,
          examGroup:group.id,
          examGroupName:group.name,
          examGroupIndex:idx
        });
      });
    });
    
    if(students.length>0){
      queues.push(shuffle(students));
      groupInfo.push({
        id:group.id,
        name:group.name,
        index:idx,
        totalStudents:students.length
      });
    }
  });
  
  if(queues.length===0){
    klbToast('⚠️ Sınav gruplarına sınıf ekleyin!\n\nSınav Editörü > Grup seç > 👥 Sınıflar');
    return;
  }
  
  const result=[];
  
  db.salons.forEach(salon=>{
    const rows=salon.satirSayisi;
    const cols=salon.sutunSayisi;
    const srows=[];
    
    for(let r=0;r<rows;r++){
      const row=[];
      for(let c=0;c<cols;c++){
        let patternIndex;
        if(queues.length===1){
          patternIndex=0;
        }else if(queues.length===2){
          patternIndex=(r+c)%2;
        }else if(queues.length===3){
          patternIndex=(r+c)%3;
        }else{
          const blockRow=Math.floor(r/2)%2;
          const blockCol=Math.floor(c/2)%2;
          const innerRow=r%2;
          const innerCol=c%2;
          patternIndex=(blockRow*2 + blockCol + innerRow*queues.length + innerCol)%queues.length;
        }
        
        const targetQueueIndex=patternIndex % queues.length;
        
        let seat=null;
        
        if(queues[targetQueueIndex]&&queues[targetQueueIndex].length>0){
          const student=queues[targetQueueIndex].shift();
          seat={
            ogrenci:student,
            examGroup:student.examGroup,
            examGroupName:student.examGroupName,
            examGroupIndex:student.examGroupIndex,
            salon:salon.ad,
            sira:r+1,
            sutun:c+1
          };
        } else {
          for(let qi=0;qi<queues.length;qi++){
            if(queues[qi]&&queues[qi].length>0){
              const student=queues[qi].shift();
              seat={
                ogrenci:student,
                examGroup:student.examGroup,
                examGroupName:student.examGroupName,
                examGroupIndex:student.examGroupIndex,
                salon:salon.ad,
                sira:r+1,
                sutun:c+1
              };
              break;
            }
          }
        }
        
        row.push(seat);
      }
      srows.push(row);
    }
    
    result.push({
      salon:salon.ad,
      salonId:salon.id,
      rows:srows
    });
  });
  
  db.dagitim=result;
  db.dagitimGroupInfo=groupInfo;
  saveDebounced();
  
  const remaining=queues.reduce((sum,q)=>sum+q.length,0);
  
  renderKResult(result,remaining,groupInfo);
  renderSeating(result,groupInfo);
}

function renderKResult(result,rem,groupInfo){
  let tot=0,html='';
  
  result.forEach(r=>{
    let n=0;
    const groupCount={};
    
    r.rows.forEach(row=>row.forEach(s=>{
      if(s){
        n++;tot++;
        const groupName=s.examGroupName||'Bilinmeyen';
        groupCount[groupName]=(groupCount[groupName]||0)+1;
      }
    }));
    
    const badges=Object.keys(groupCount).map((groupName,idx)=>{
      const colorClass=['b9','b10','b11','b12'][idx%4];
      return `<span class="badge ${colorClass}">${groupName}: ${groupCount[groupName]}</span>`;
    }).join(' ');
    
    html+=`<div style="margin-bottom:8px"><b>🚪 ${r.salon}</b> — ${n} öğrenci &nbsp; ${badges}</div>`;
  });
  
  let groupSummary='';
  if(groupInfo&&groupInfo.length>0){
    groupSummary=`<div style="margin-top:12px;padding:10px;background:var(--bg0);border-radius:8px">
      <div style="font-size:.82rem;font-weight:700;margin-bottom:6px">📋 Sınav Grupları:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${groupInfo.map((g,idx)=>{
          const colorClass=['b9','b10','b11','b12'][idx%4];
          return `<span class="badge ${colorClass}">${g.name} (${g.totalStudents})</span>`;
        }).join('')}
      </div>
    </div>`;
  }
  
  H('k-result').innerHTML=`
    <div class="alert ${rem?'alert-warn':'alert-ok'}" style="margin-bottom:12px">
      ${rem?'⚠️ '+rem+' öğrenci yerleştirilemedi!':'✅ '+tot+' öğrenci başarıyla yerleştirildi!'}
    </div>
    ${html}
    ${groupSummary}
  `;
}

function renderSeating(result,groupInfo){
  const kb=db.settings.kelebek_bosluk||'yok';
  const boslukMap={yok:'0px',az:'4px',orta:'10px',genis:'18px'};
  const rowGap=boslukMap[kb]||'0px';
  
  const usedGroups=new Set();
  result.forEach(r=>r.rows.forEach(row=>row.forEach(s=>{
    if(s&&s.examGroupName)usedGroups.add(s.examGroupName);
  })));
  
  const groupBadges=Array.from(usedGroups).map((groupName,idx)=>{
    const colorClass=['b9','b10','b11','b12'][idx%4];
    return `<span class="badge ${colorClass}">${groupName}</span>`;
  }).join('');
  
  H('seating-plans').innerHTML=result.map(r=>`
    <div class="card mt3">
      <div class="card-header"><div class="card-title">🚪 ${r.salon}</div>
        <div class="fx g2 fw">${groupBadges}</div>
      </div>
      <div style="overflow-x:auto"><div style="display:flex;flex-direction:column;gap:${rowGap}">
        ${r.rows.map(row=>`<div class="srow">${row.map(s=>{
          if(!s)return`<div class="seat sempty"></div>`;
          const parts=s.ogrenci.ad.split(' ');
          const short=parts.map((w,i)=>i===0?w:w[0]+'.').join(' ');
          
          const groupIdx=s.examGroupIndex||0;
          const colorClass=['s9','s10','s11','s12'][groupIdx%4];
          
          return`<div class="seat ${colorClass}" title="${s.ogrenci.ad}\nNo: ${s.ogrenci.no}\nSınıf: ${s.ogrenci.sinif}\nSınav: ${s.examGroupName||''}">
            <div class="sno">${s.ogrenci.no}</div>
            <div class="sname">${short}</div>
            <div class="scls">${s.ogrenci.sinif}</div>
            <div style="font-size:.6rem;color:var(--text3);margin-top:2px">${s.examGroupName||''}</div>
          </div>`;
        }).join('')}</div>`).join('')}
      </div></div>
    </div>`).join('');
}

// ── BULUTTAN ÖĞRENCİ ÇEK — Ortak .doa sistemi (student-cloud.js) ──
function pullStudentsFromCloud(){
  if(typeof doaOpenCloudPicker !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  doaOpenCloudPicker(function(classes){
    var added = doaMergeIntoDb(classes);
    klbToast('✅ '+added+' öğrenci yüklendi', 'success');
    if(typeof renderKChecks==='function') renderKChecks();
    if(typeof renderSalonList==='function') renderSalonList();
  });
}

// ── MODÜL INIT ──
function initKelebekDagitim(){
  renderKChecks();
  renderSalonList();
  
  // Mevcut kaydedilmiş boşluğu ayarla
  const kb=db.settings.kelebek_bosluk||'yok';
  ['yok','az','orta','genis'].forEach(b=>{const el=H('kb-'+b);if(el)el.classList.toggle('active',b===kb);});
}

// ── PAGE READY ──
if(typeof H === 'function'){
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(initKelebekDagitim, 300);
  });
}
