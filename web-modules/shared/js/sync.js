// ============================================================

// Herşeyi Kaydet (.hdb)
function maarifSaveAll(){
  requestDriveAccess(function(){
    let exportData = {
      type: 'hdb',
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(db))
    };
    
    let dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    const fileName = 'Kelebek_Yedek_' + dateStr + '.hdb';
    
    let blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
    
    let metadata = {name: fileName, mimeType: 'application/json'};
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    formData.append('file', blob);
    
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + driveAccessToken},
      body: formData
    }).then(function(r){
      if(r.ok) klbToast('Kaydedildi');
      else klbToast('Kaydetme hatası');
    }).catch(function(){ klbToast('Bağlantı hatası'); });
  });
}

// Sınavları Kaydet (.sdb)
function maarifSaveExams(){
  let exportData = {
    type: 'sdb',
    version: '1.0',
    timestamp: new Date().toISOString(),
    examGroups: db.examGroups || [],
    questions: db.questions || []
  };
  
  let dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  let blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Sinavlar_' + dateStr + '.sdb';
  a.click();
}

// Çalışma Kağıtlarını Kaydet (.cdb)
function maarifSaveWorksheets(){
  let exportData = {
    type: 'cdb',
    version: '1.0',
    timestamp: new Date().toISOString(),
    calismaQuestions: db.calismaQuestions || []
  };
  
  let dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  let blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CalismaKagitlari_' + dateStr + '.cdb';
  a.click();
}

// ============================================================
// PDF EXPORT
// ============================================================

// Tek öğrenci PDF
function maarifExportStudentPDF(className, sIdx){
  let student = db.classes[className][sIdx];
  if(!student) return;
  
  let studentName = student.ad || student.name || '';
  let studentNo = student.no || student.schoolNumber || '';
  if(!student.maarif) student.maarif = {};
  
  let maarifKeys = ['materyal','on_arastirma','kitap_etkinlik','bilimsel_sorgulama','tasarim','veri_analiz','raporlama','oz_elestiri','akran_deg','lab_etik'];
  let total = 0;
  maarifKeys.forEach(function(k){ total += (student.maarif[k] || 0); });
  
  let genelLabels = {
    yetkin:'Yetkin Uygulayıcı', aktif:'Aktif Katılımcı', gelisim:'Gelişim Yolunda',
    rehberlik_gerek:'Rehberlik Gerekli', odaklanma:'Odaklanma Sorunu', sosyal_takip:'Sosyal-Akademik Takip'
  };
  
  const genelDurum = genelLabels[student.maarif.genel_durum] || 'Belirlenmedi';
  
  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + studentName + ' - Performans</title>';
  html += '<style>body{font-family:Arial,sans-serif;padding:30px;color:#222;max-width:700px;margin:0 auto}';
  html += 'h1{font-size:20px;border-bottom:3px solid #333;padding-bottom:8px}';
  html += 'h2{font-size:16px;color:#555;margin-top:20px}';
  html += '.info{display:flex;justify-content:space-between;margin-bottom:20px;font-size:14px}';
  html += 'table{width:100%;border-collapse:collapse;margin-bottom:20px}';
  html += 'th,td{border:1px solid #ccc;padding:8px 12px;text-align:left;font-size:13px}';
  html += 'th{background:#f0f0f0;font-weight:700}';
  html += '.total-row{background:#e8f5e9;font-weight:700}';
  html += '.genel{margin-top:20px;padding:15px;border:2px solid #333;border-radius:8px}';
  html += '.note{background:#fff3e0;padding:10px;border-radius:6px;margin-top:10px;font-size:12px}';
  html += '@media print{body{padding:15px}}</style></head><body>';
  
  html += '<h1>Öğrenci Performans Raporu</h1>';
  html += '<div class="info"><span><b>Ad Soyad:</b> ' + studentName + '</span>';
  html += '<span><b>No:</b> ' + studentNo + '</span>';
  html += '<span><b>Sınıf:</b> ' + className + '</span>';
  html += '<span><b>Tarih:</b> ' + new Date().toLocaleDateString('tr-TR') + '</span></div>';
  
  // Süreç
  html += '<h2>Süreç Odaklı Ölçme (%40)</h2><table><tr><th>Kriter</th><th>Puan</th><th>Not</th></tr>';
  html += '<tr><td>Materyal/Kitap Uyumu</td><td>' + (student.maarif.materyal||0) + '</td><td>' + (student.maarif.materyal_note||'') + '</td></tr>';
  html += '<tr><td>Ön Araştırma Sunumu</td><td>' + (student.maarif.on_arastirma||0) + '</td><td>' + (student.maarif.on_arastirma_note||'') + '</td></tr>';
  html += '<tr><td>Kitap Etkinlikleri</td><td>' + (student.maarif.kitap_etkinlik||0) + '</td><td>' + (student.maarif.kitap_etkinlik_note||'') + '</td></tr>';
  html += '<tr><td>Bilimsel Sorgulama</td><td>' + (student.maarif.bilimsel_sorgulama||0) + '</td><td>' + (student.maarif.bilimsel_sorgulama_note||'') + '</td></tr>';
  html += '</table>';
  
  // Performans
  html += '<h2>Performans Görevi (%40)</h2><table><tr><th>Kriter</th><th>Puan</th><th>Not</th></tr>';
  html += '<tr><td>Tasarım ve Uygulama</td><td>' + (student.maarif.tasarim||0) + '</td><td>' + (student.maarif.tasarim_note||'') + '</td></tr>';
  html += '<tr><td>Veri Analizi</td><td>' + (student.maarif.veri_analiz||0) + '</td><td>' + (student.maarif.veri_analiz_note||'') + '</td></tr>';
  html += '<tr><td>Raporlama</td><td>' + (student.maarif.raporlama||0) + '</td><td>' + (student.maarif.raporlama_note||'') + '</td></tr>';
  html += '</table>';
  
  // Sosyal
  html += '<h2>Sosyal-Duyuşsal (%20)</h2><table><tr><th>Kriter</th><th>Puan</th><th>Not</th></tr>';
  html += '<tr><td>Dürüstlük ve Öz-Eleştiri</td><td>' + (student.maarif.oz_elestiri||0) + '</td><td>' + (student.maarif.oz_elestiri_note||'') + '</td></tr>';
  html += '<tr><td>Akran Değerlendirme</td><td>' + (student.maarif.akran_deg||0) + '</td><td>' + (student.maarif.akran_deg_note||'') + '</td></tr>';
  html += '<tr><td>Laboratuvar Etiği</td><td>' + (student.maarif.lab_etik||0) + '</td><td>' + (student.maarif.lab_etik_note||'') + '</td></tr>';
  html += '</table>';
  
  html += '<table><tr class="total-row"><td>TOPLAM PUAN</td><td colspan="2">' + total + '</td></tr></table>';
  
  html += '<div class="genel"><b>Genel Değerlendirme:</b> ' + genelDurum;
  if(student.maarif.rehberlik_notu){
    html += '<div class="note"><b>Rehberlik Notu:</b> ' + student.maarif.rehberlik_notu + '</div>';
  }
  html += '</div>';
  
  html += '<div style="margin-top:40px;display:flex;justify-content:space-between">';
  html += '<div style="text-align:center"><div style="border-top:1px solid #333;padding-top:5px;width:150px">Öğretmen</div></div>';
  html += '<div style="text-align:center"><div style="border-top:1px solid #333;padding-top:5px;width:150px">Müdür Yrd.</div></div>';
  html += '</div>';
  
  html += '</body></html>';
  
  let w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

// Sınıf toplu PDF
function maarifExportClassPDF(className){
  if(!className) return;
  const students = db.classes[className] || [];
  if(students.length === 0) return;
  
  let maarifKeys = ['materyal','on_arastirma','kitap_etkinlik','bilimsel_sorgulama','tasarim','veri_analiz','raporlama','oz_elestiri','akran_deg','lab_etik'];
  const maarifLabels = ['Materyal','Ön Araş.','Kitap Etk.','Bil. Sorg.','Tasarım','Veri An.','Rapor','Öz-Eleş.','Akran','Lab Etik'];
  
  let genelLabels = {
    yetkin:'💎 Yetkin', aktif:'⚡ Aktif', gelisim:'🔍 Gelişim',
    rehberlik_gerek:'🛠️ Rehberlik', odaklanma:'📉 Odaklanma', sosyal_takip:'🧩 Takip'
  };
  
  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + className + ' - Sınıf Raporu</title>';
  html += '<style>body{font-family:Arial,sans-serif;padding:20px;color:#222}';
  html += 'h1{font-size:18px;border-bottom:3px solid #333;padding-bottom:8px}';
  html += 'table{width:100%;border-collapse:collapse;font-size:11px}';
  html += 'th,td{border:1px solid #ccc;padding:5px 6px;text-align:center}';
  html += 'th{background:#f0f0f0;font-weight:700;font-size:10px}';
  html += 'td:first-child,td:nth-child(2){text-align:left}';
  html += '.total{font-weight:700;background:#e8f5e9}';
  html += '@media print{body{padding:10px;font-size:10px}}</style></head><body>';
  
  html += '<h1>' + className + ' Sınıfı - Maarif Modeli Performans Raporu</h1>';
  html += '<p style="font-size:12px;color:#666">Tarih: ' + new Date().toLocaleDateString('tr-TR') + '</p>';
  
  html += '<table><thead><tr><th>No</th><th>Ad Soyad</th>';
  maarifLabels.forEach(function(l){ html += '<th>' + l + '</th>'; });
  html += '<th class="total">Toplam</th><th>Durum</th></tr></thead><tbody>';
  
  students.forEach(function(student){
    let name = student.ad || student.name || '';
    let no = student.no || student.schoolNumber || '';
    let m = student.maarif || {};
    let total = 0;
    
    html += '<tr><td>' + no + '</td><td>' + name + '</td>';
    maarifKeys.forEach(function(k){
      const v = m[k] || 0;
      total += v;
      html += '<td>' + v + '</td>';
    });
    html += '<td class="total">' + total + '</td>';
    html += '<td>' + (genelLabels[m.genel_durum] || '-') + '</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  
  html += '<div style="margin-top:30px;display:flex;justify-content:space-between">';
  html += '<div style="text-align:center"><div style="border-top:1px solid #333;padding-top:5px;width:150px">Öğretmen</div></div>';
  html += '<div style="text-align:center"><div style="border-top:1px solid #333;padding-top:5px;width:150px">Müdür Yrd.</div></div>';
  html += '</div>';
  
  html += '</body></html>';
  
  let w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

// Accordion toggle
function maarifToggle(sIdx, branchKey){
  const el = document.getElementById('branch-' + sIdx + '-' + branchKey);
  if(el) el.classList.toggle('open');
}

// Genel Değerlendirme seç (eski uyumluluk)
function maarifGenelSec(className, sIdx, optKey){
  maarifGenelSecDetail(className, sIdx, optKey);
}

// Rehberlik notu
function maarifRehberlikNot(className, sIdx){
  let student = db.classes[className][sIdx];
  if(!student) return;
  if(!student.maarif) student.maarif = {};
  const current = student.maarif.rehberlik_notu || '';
  let html = '<h3 style="color:#a855f7;margin-bottom:12px;font-size:1rem">Rehberlik Notu</h3>' +
    '<textarea id="maarif-rehberlik-input" placeholder="Durumu yazın..." maxlength="500" ' +
    'style="width:100%;height:120px;padding:12px;border-radius:12px;background:#0d1117;border:1px solid rgba(168,85,247,0.3);color:#fff;font-size:0.9rem;resize:none">' + current + '</textarea>' +
    '<button onclick=\'maarifRehberlikSave("' + className + '",' + sIdx + ')\' ' +
    'style="width:100%;padding:12px;border-radius:12px;background:#a855f7;color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer;margin-top:12px">Kaydet</button>';
  mobileModal(html);
}

function maarifRehberlikSave(className, sIdx){
  let inp = document.getElementById('maarif-rehberlik-input');
  if(!inp) return;
  let student = db.classes[className][sIdx];
  if(!student) return;
  if(!student.maarif) student.maarif = {};
  student.maarif.rehberlik_notu = inp.value.trim();
  saveDebounced();
  mobileCloseModal();
  mobileRenderPerfDetail(className, sIdx);
  setTimeout(function(){
    let el = document.getElementById('branch-' + sIdx + '-genel');
    if(el) el.classList.add('open');
  }, 50);
}

// Not ekle
function maarifNote(className, sIdx, itemKey){
  const student = db.classes[className][sIdx];
  if(!student) return;
  if(!student.maarif) student.maarif = {};
  
  const noteKey = itemKey + '_note';
  const currentNote = student.maarif[noteKey] || '';
  
  const html = '<h3 style="color:#fff;margin-bottom:12px;font-size:1rem">Not Ekle</h3>' +
    '<textarea id="maarif-note-input" placeholder="Kısa not girin..." maxlength="100" ' +
    'style="width:100%;height:80px;padding:12px;border-radius:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;resize:none">' + currentNote + '</textarea>' +
    '<button onclick=\'maarifNoteSave("' + className + '",' + sIdx + ',"' + itemKey + '")\' ' +
    'style="width:100%;padding:12px;border-radius:12px;background:var(--accent);color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer;margin-top:12px">Kaydet</button>';
  
  mobileModal(html);
}

function maarifNoteSave(className, sIdx, itemKey){
  const inp = document.getElementById('maarif-note-input');
  if(!inp) return;
  
  const student = db.classes[className][sIdx];
  if(!student) return;
  if(!student.maarif) student.maarif = {};
  
  const noteKey = itemKey + '_note';
  student.maarif[noteKey] = inp.value.trim();
  saveDebounced();
  mobileCloseModal();
  mobileRenderPerformance(className);
}

// Custom Modal Sistemi (tarayıcı alert/confirm yerine)
function mobileModal(html, onClose){
  const overlay = document.createElement('div');
  overlay.id = 'mobile-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#161b22;border-radius:24px 24px 0 0;width:100%;max-width:500px;padding:24px;max-height:85vh;overflow-y:auto;animation:slideUpModal 0.3s ease';
  box.innerHTML = html;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay){
      overlay.remove();
      if(onClose) onClose();
    }
  });
  
  return overlay;
}

function mobileCloseModal(){
  const m = document.getElementById('mobile-modal-overlay');
  if(m) m.remove();
}

// Sınıf Ekle
function mobileAddClass(){
  const html = `
    <h3 style="color:#fff;margin-bottom:16px;font-size:1.2rem">Yeni Sınıf</h3>
    <input id="mobile-new-class-input" type="text" placeholder="Örn: 9/A, 12/B" 
      style="width:100%;padding:14px;border-radius:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:16px">
    <button onclick="mobileAddClassDo()" 
      style="width:100%;padding:14px;border-radius:12px;background:var(--accent);color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer">Ekle</button>
  `;
  mobileModal(html);
  setTimeout(() => { const inp = document.getElementById('mobile-new-class-input'); if(inp) inp.focus(); }, 100);
}

function mobileAddClassDo(){
  const inp = document.getElementById('mobile-new-class-input');
  if(!inp) return;
  const trimmed = inp.value.trim();
  if(!trimmed) return;
  
  if(db.classes[trimmed]){
    inp.style.borderColor = '#ef4444';
    inp.placeholder = 'Bu sınıf zaten var!';
    inp.value = '';
    return;
  }
  
  db.classes[trimmed] = [];
  saveDebounced();
  mobileCloseModal();
  mobileRenderClasses('students');
  renderClassTabs();
  renderStats();
}

// Öğrenci Ekle
function mobileAddStudent(className){
  const html = `
    <h3 style="color:#fff;margin-bottom:16px;font-size:1.2rem">${className} - Öğrenci Ekle</h3>
    <input id="mobile-new-student-no" type="text" inputmode="numeric" placeholder="Okul Numarası" 
      style="width:100%;padding:14px;border-radius:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:12px">
    <input id="mobile-new-student-name" type="text" placeholder="Ad Soyad" 
      style="width:100%;padding:14px;border-radius:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:16px">
    <button onclick='mobileAddStudentDo("${className}")' 
      style="width:100%;padding:14px;border-radius:12px;background:var(--green);color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer">Ekle</button>
  `;
  mobileModal(html);
  setTimeout(() => { const inp = document.getElementById('mobile-new-student-no'); if(inp) inp.focus(); }, 100);
}

function mobileAddStudentDo(className){
  const noInp = document.getElementById('mobile-new-student-no');
  const nameInp = document.getElementById('mobile-new-student-name');
  if(!noInp || !nameInp) return;
  
  const no = noInp.value.trim();
  const ad = nameInp.value.trim();
  if(!ad) { nameInp.style.borderColor = '#ef4444'; return; }
  
  if(!db.classes[className]) db.classes[className] = [];
  db.classes[className].push({no: no || '—', ad: ad, sinif: className});
  saveDebounced();
  mobileCloseModal();
  mobileRenderStudents(className);
  renderStudentTable();
  renderStats();
}

// Öğrenci Düzenle/Sil
function mobileEditStudent(className, idx){
  const student = db.classes[className][idx];
  if(!student) return;
  
  const studentName = student.ad || student.name || '';
  const studentNo = student.no || student.schoolNumber || '';
  
  const html = `
    <h3 style="color:#fff;margin-bottom:16px;font-size:1.2rem">${studentName}</h3>
    <input id="mobile-edit-student-no" type="text" value="${studentNo}" placeholder="Okul Numarası" 
      style="width:100%;padding:14px;border-radius:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:12px">
    <input id="mobile-edit-student-name" type="text" value="${studentName}" placeholder="Ad Soyad" 
      style="width:100%;padding:14px;border-radius:12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:1rem;margin-bottom:16px">
    <button onclick='mobileEditStudentDo("${className}", ${idx})' 
      style="width:100%;padding:14px;border-radius:12px;background:var(--accent);color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:10px">Kaydet</button>
    <button onclick='mobileDeleteStudent("${className}", ${idx})' 
      style="width:100%;padding:14px;border-radius:12px;background:transparent;color:#ef4444;border:1px solid #ef4444;font-size:1rem;font-weight:700;cursor:pointer">Sil</button>
  `;
  mobileModal(html);
}

function mobileEditStudentDo(className, idx){
  const noInp = document.getElementById('mobile-edit-student-no');
  const nameInp = document.getElementById('mobile-edit-student-name');
  if(!noInp || !nameInp) return;
  
  const student = db.classes[className][idx];
  if(!student) return;
  
  student.ad = nameInp.value.trim() || student.ad;
  student.name = student.ad;
  student.no = noInp.value.trim() || student.no;
  student.schoolNumber = student.no;
  
  saveDebounced();
  mobileCloseModal();
  mobileRenderStudents(className);
}

function mobileDeleteStudent(className, idx){
  db.classes[className].splice(idx, 1);
  saveDebounced();
  mobileCloseModal();
  mobileRenderStudents(className);
  renderStats();
}

// [doLogout auth-globals.js'te tanımlı]

// [initGoogleAuth/requestDriveAccess/requestNewToken auth-globals.js'e taşındı]

async function saveToDrive(){
  requestDriveAccess(async () => {
    try {
      const backup = {
        type: 'hdb',
        version: '2.0',
        timestamp: new Date().toISOString(),
        data: db
      };
      
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], {type: 'application/json'});
      
      const metadata = {
        name: 'Kelebek_Yedek_' + formatDate(new Date()) + '.hdb',
        mimeType: 'application/json'
      };
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
      form.append('file', blob);
      
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + driveAccessToken
        },
        body: form
      });
      
      if(response.ok){
        klbToast('Kaydedildi');
      } else {
        throw new Error('Upload failed');
      }
    } catch(e){
      console.error('Drive save error:', e);
      klbToast('Kaydetme hatası');
    }
  });
}

async function loadFromDrive(){
  requestDriveAccess(async () => {
    try {
      // Drive'daki .koray dosyalarını listele
      const listResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=name contains \'.koray\' or name contains \'.hdb\'&orderBy=modifiedTime desc&pageSize=15',
        {
          headers: {
            'Authorization': 'Bearer ' + driveAccessToken
          }
        }
      );
      
      if(!listResponse.ok) throw new Error('Drive listesi alınamadı');
      
      const listData = await listResponse.json();
      
      if(!listData.files || listData.files.length === 0){
        klbToast('Drive\'da .koray yedek dosyası bulunamadı.');
        return;
      }
      
      // Custom modal ile dosya listesi göster
      showDriveFileModal(listData.files);
      
    } catch(e){
      console.error('Drive load error:', e);
      klbToast('Drive\'dan yükleme hatası: ' + e.message);
    }
  });
}

// Drive dosya seçim modalı
function showDriveFileModal(files){
  const modal = document.createElement('div');
  modal.id = 'drive-file-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#161b22;border-radius:20px;width:100%;max-width:500px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column';
  
  let html = '<div style="padding:20px;border-bottom:1px solid rgba(255,255,255,0.1)">';
  html += '<h2 style="color:#fff;margin:0;font-size:1.2rem">📁 Drive Yedekleri</h2>';
  html += '</div>';
  html += '<div style="overflow-y:auto;flex:1;padding:16px">';
  
  files.forEach(file => {
    const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('tr-TR') : '';
    html += `
      <div class="mobile-list-item" onclick="loadDriveFile('${file.id}')" style="margin-bottom:12px;cursor:pointer;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px">
        <div style="flex:1">
          <div style="color:#fff;font-weight:700;margin-bottom:4px">${file.name}</div>
          <div style="color:#8b949e;font-size:0.85rem">${date}</div>
        </div>
        <span style="color:#8b949e;font-size:1.5rem">›</span>
      </div>
    `;
  });
  
  html += '</div>';
  html += '<div style="padding:16px;border-top:1px solid rgba(255,255,255,0.1)">';
  html += '<button onclick="closeDriveModal()" style="width:100%;padding:12px;border-radius:12px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:1rem;cursor:pointer">Kapat</button>';
  html += '</div>';
  
  box.innerHTML = html;
  modal.appendChild(box);
  document.body.appendChild(modal);
  
  // Dışarıya tıklayınca kapat
  modal.addEventListener('click', function(e){
    if(e.target === modal) closeDriveModal();
  });
}

function closeDriveModal(){
  const modal = document.getElementById('drive-file-modal');
  if(modal) modal.remove();
}

async function loadDriveFile(fileId){
  try {
    // Dosyayı indir
    const downloadResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
      {
        headers: {
          'Authorization': 'Bearer ' + driveAccessToken
        }
      }
    );
    
    if(!downloadResponse.ok) throw new Error('Dosya indirilemedi');
    
    const content = await downloadResponse.json();
    
    if(!content.data){
      klbToast('Geçersiz yedek dosyası');
      return;
    }
    
    // Verileri yükle
    db = content.data;
    saveDebounced();
    closeDriveModal();
    klbToast('✅ Yüklendi');
    location.reload();
    
  } catch(e){
    console.error('Drive file load error:', e);
    klbToast('Dosya yükleme hatası: ' + e.message);
  }
}

// Yardımcı: Tarih formatla


// [Sayfa init auth-globals.js'te yapılıyor]

// ============================================================