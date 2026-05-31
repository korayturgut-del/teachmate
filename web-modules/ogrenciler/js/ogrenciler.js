/* ============================================================
   ÖĞRENCİ MODÜLÜ JS — Kelebek Platform V2
   Bağımsız çalışabilir. Ortak: ../shared/js/* 
   ============================================================ */

// ── Cross-module stubs (bağımsızlık için) ──
function renderKChecks(){}  // Kelebek dağıtım stub
function saveS(){}          // Çıktı ayarları stub
// Eski GitHub Gist (CSS) sistemi kaldırıldı — artık .doa Drive sistemi kullanılıyor
if(!window.cssAutoUpload) window.cssAutoUpload=function(){};
if(!window.cssUploadStudentsToCloud) window.cssUploadStudentsToCloud=function(){};

// ── BULUTA KAYDET (.doa) ──
function ogrSaveToCloud(){
  if(typeof doaSaveStudents !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  if(!db.classes || Object.keys(db.classes).length===0){
    klbToast('Önce öğrenci listesi oluşturun','error'); return;
  }
  doaSaveStudents(db.classes, function(ok, fileName){
    if(ok) klbToast('☁️ Liste buluta kaydedildi: '+fileName, 'success');
  });
}

// ── BULUTTAN ÇEK (.doa) ──
function ogrLoadFromCloud(){
  if(typeof doaOpenCloudPicker !== 'function'){ klbToast('Bulut modülü yüklenemedi','error'); return; }
  doaOpenCloudPicker(function(classes){
    var added = doaMergeIntoDb(classes);
    renderClassTabs();
    if(activeClass) renderStudentTable();
    klbToast('✅ '+added+' öğrenci yüklendi', 'success');
  });
}

// ── Aktif sınıf ──
var activeClass = null;

// ── SINIF YÖNETİMİ ──
function renderClassTabs(){
  var cont = H('class-tabs'); if(!cont) return;
  var classes = Object.keys(db.classes||{}).sort();
  cont.innerHTML = classes.map(function(c){
    return '<div onclick="selectClass(\''+c.replace(/'/g,"\\'")+'\')" style="padding:8px 14px;border-radius:var(--r);cursor:pointer;font-weight:600;font-size:.85rem;'
      +'border:1px solid '+(activeClass===c?'var(--blue)':'var(--border)')+';'
      +'background:'+(activeClass===c?'var(--blue-glow)':'var(--bg2)')+';'
      +'color:'+(activeClass===c?'var(--blue)':'var(--text2)')+';'
      +'display:flex;justify-content:space-between;align-items:center;transition:all .15s">'
      +'<span>'+c+'</span>'
      +'<span style="font-size:.72rem;opacity:.6">'+(db.classes[c]||[]).length+' öğrenci</span>'
      +'</div>';
  }).join('');
  if(!classes.length){
    cont.innerHTML = '<div style="color:var(--text3);font-size:.82rem;padding:8px 0">Henüz sınıf yok.</div>';
  }
}

function selectClass(cls){
  activeClass = cls;
  H('student-panel').style.display = 'block';
  H('no-class-msg').style.display = 'none';
  H('st-class-title').textContent = cls;
  renderClassTabs();
  renderStudentTable();
}

function addClassDo(){
  var v = H('nc-branch').value.trim();
  if(!v){ klbToast('Şube adı girin!'); return; }
  if(db.classes[v]){ klbToast('Bu sınıf zaten var!'); return; }
  db.classes[v] = [];
  saveDebounced();
  H('nc-branch').value = '';
  renderClassTabs();
  renderKChecks();
  selectClass(v);
}

function deleteClass(){
  if(!activeClass) return;
  if(!confirm('"'+activeClass+'" sınıfını sil?')) return;
  delete db.classes[activeClass];
  activeClass = null;
  saveDebounced();
  H('student-panel').style.display = 'none';
  H('no-class-msg').style.display = '';
  renderClassTabs();
  renderKChecks();
}

// ── ÖĞRENCİ YÖNETİMİ ──
function addStudentDo(){
  if(window.CSS && window.CSS.isConfigured && window.CSS.isConfigured() && !window.CSS.canEditStudents()){
    klbToast('Yetkiniz yok! Sadece Admin, İdare ve Rehberlik öğrenci ekleyebilir.');
    return;
  }
  var no = H('st-no').value.trim();
  var ad = H('st-name').value.trim();
  if(!activeClass||!ad) return;
  if(!db.classes[activeClass]) db.classes[activeClass] = [];
  db.classes[activeClass].push({no:no||'—', ad:ad, sinif:activeClass});
  saveDebounced();
  H('st-no').value = ''; H('st-name').value = '';
  renderStudentTable();
  cssAutoUpload();
}

function importStudentsDo(){
  var raw = H('bulk-input').value.trim();
  if(!raw||!activeClass) return;
  var cnt = 0;
  var bulkSiraNo = 1;
  var lines = raw.split(/[✕\n]+/);

  lines.forEach(function(line){
    if(line.indexOf(',')!==-1){
      var parts = line.split(',');
      if(parts.length>=2){
        var no = parts[0].trim();
        var ad = parts.slice(1).join(',').trim();
        if(!no||no.length<3||!/^\d+$/.test(no)) return;
        if(ad&&no){
          db.classes[activeClass].push({no:no,ad:ad,sinif:activeClass});
          cnt++; return;
        }
      }
    }
    var trimmed = line.trim();
    if(!trimmed) return;
    if(/^#/.test(trimmed)){
      var hdm = trimmed.match(/^#[^0-9]*?(\d+[A-ZÇĞİÖŞÜa-zçğıöşü].*)$/);
      if(hdm){ trimmed = hdm[1]; } else { return; }
    }
    if(/^No\b|^Ad\b|^Soyad/i.test(trimmed)) return;
    var yasakli = ['öğrenci','sınav','dönem','mazereti','performan','proje','çalışma','teslim','etmeme','herhangi','olmadan','girmeme','durumunda','veya','bölümüne','yazılmalıdır'];
    var ll = trimmed.toLowerCase();
    var yasak = false;
    for(var yi=0;yi<yasakli.length;yi++){ if(ll.indexOf(yasakli[yi])!==-1){yasak=true;break;} }
    if(yasak) return;

    var eom = trimmed.match(/^\d{1,3}\s+(\d{3,})\s+(.+)$/);
    if(eom){
      var eNo = eom[1].trim();
      var eAd = eom[2].trim();
      eAd = eAd.replace(/(\s+\d+)+\s*$/,'').trim();
      eAd = eAd.replace(/[^\wğüşıöçĞÜŞİÖÇ\s-]/g,'').trim();
      if(eAd.length>=2&&eAd.length<=50&&eAd.split(/\s+/).length<=5){
        db.classes[activeClass].push({no:eNo,ad:eAd,sinif:activeClass}); cnt++; return;
      }
    }
    var bm = trimmed.match(/^(\d+)([A-ZÇĞİÖŞÜa-zçğıöşü].*)$/);
    if(bm){
      var nums = bm[1];
      var bAd = bm[2].trim();
      bAd = bAd.replace(/(\s+\d+)+\s*$/,'').trim();
      bAd = bAd.replace(/[^\wğüşıöçĞÜŞİÖÇ\s-]/g,'').trim();
      var bNo = '';
      var siraStr = String(bulkSiraNo);
      if(nums.length>siraStr.length&&nums.substring(0,siraStr.length)===siraStr){
        bNo = nums.substring(siraStr.length);
      }
      if(!bNo&&nums.length>=3) bNo = nums;
      if(bNo&&bNo.length>=3&&bAd.length>=2&&bAd.length<=50&&bAd.split(/\s+/).length<=5){
        db.classes[activeClass].push({no:bNo,ad:bAd,sinif:activeClass}); cnt++; bulkSiraNo++; return;
      }
    }
    if(bm) bulkSiraNo++;
    var m = trimmed.match(/^(\d{3,})\s+(.+)$/);
    if(m){
      var mNo = m[1].trim();
      var mAd = m[2].trim();
      mAd = mAd.replace(/(\s+\d+)+\s*$/,'').trim();
      mAd = mAd.replace(/[^\wğüşıöçĞÜŞİÖÇ\s-]/g,'').trim();
      if(mAd.length>50) return;
      var ks = mAd.split(/\s+/).length;
      if(!mAd||mAd.length<2||ks>4) return;
      db.classes[activeClass].push({no:mNo,ad:mAd,sinif:activeClass}); cnt++;
    }
  });

  saveDebounced(); H('bulk-input').value = '';
  renderStudentTable();
  klbToast('✅ '+cnt+' öğrenci eklendi.');
  cssAutoUpload();
}

function delStudent(i){
  if(window.CSS && window.CSS.isConfigured && window.CSS.isConfigured() && !window.CSS.canEditStudents()){
    klbToast('Yetkiniz yok! Sadece Admin, İdare ve Rehberlik öğrenci silebilir.');
    return;
  }
  if(!activeClass) return;
  db.classes[activeClass].splice(i,1);
  saveDebounced();
  renderStudentTable();
  cssAutoUpload();
}

function renderStudentTable(){
  var cont = H('student-table'); if(!cont) return;
  var sts = db.classes[activeClass]||[];
  if(!sts.length){
    cont.innerHTML = '<div style="color:var(--text3);font-size:.82rem">Öğrenci yok.</div>';
    return;
  }
  cont.innerHTML = '<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="border-bottom:1px solid var(--border);color:var(--text2);font-size:.75rem">'
    +'<th style="padding:6px 8px;text-align:left;font-weight:600">#</th>'
    +'<th style="padding:6px 8px;text-align:left;font-weight:600">No</th>'
    +'<th style="padding:6px 8px;text-align:left;font-weight:600">Ad Soyad</th>'
    +'<th style="padding:6px 8px"></th>'
    +'</tr></thead>'
    +'<tbody>'+sts.map(function(s,i){
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:5px 8px;color:var(--text3);font-size:.75rem">'+(i+1)+'</td>'
        +'<td style="padding:5px 8px;font-family:var(--mono);font-size:.8rem">'+s.no+'</td>'
        +'<td style="padding:5px 8px;font-size:.82rem">'+s.ad+'</td>'
        +'<td style="padding:5px 8px;text-align:right"><button class="btn btn-ghost btn-xs" onclick="delStudent('+i+')" style="color:var(--red)">✕</button></td>'
        +'</tr>';
    }).join('')+'</tbody></table>';
}

// ── READONLY MODE ──
function cssCheckStudentsPage(){
  if(!window.CSS || !window.CSS.isConfigured || !window.CSS.isConfigured()){
    H('css-students-banner') && (H('css-students-banner').style.display='none');
    H('css-readonly-banner') && (H('css-readonly-banner').style.display='none');
    return;
  }
  var status = window.CSS.getStatus();
  if(status && status.configured){
    H('css-students-banner') && (H('css-students-banner').style.display='block');
    var ro = !window.CSS.canEditStudents();
    if(ro){
      H('css-readonly-banner') && (H('css-readonly-banner').style.display='block');
      var ins = document.querySelectorAll('#st-no, #st-name, #nc-branch, #bulk-input');
      for(var i=0;i<ins.length;i++) ins[i].disabled = true;
      var bts = document.querySelectorAll('#student-panel button, #css-students-banner button');
      for(var i=0;i<bts.length;i++) bts[i].disabled = true;
    } else {
      H('css-readonly-banner') && (H('css-readonly-banner').style.display='none');
    }
  }
}

// ── KEYBOARD SHORTCUTS ──
function setupKeyboardListeners(){
  var el = H('nc-branch');
  if(el) el.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); addClassDo(); } });
  el = H('st-no');
  if(el) el.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); var nm=H('st-name'); if(nm) nm.focus(); } });
  el = H('st-name');
  if(el) el.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); addStudentDo(); } });
}

// ── MODÜL INIT ──
function initOgrenciler(){
  renderClassTabs();
  cssCheckStudentsPage();
  setupKeyboardListeners();
  if(activeClass){
    H('student-panel').style.display = 'block';
    H('no-class-msg').style.display = 'none';
    renderStudentTable();
  }
}

// ── PAGE READY ──
if(typeof H === 'function'){
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(initOgrenciler, 300);
  });
}
