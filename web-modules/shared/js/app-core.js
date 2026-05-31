let _saveTimer=null;
function saveDebounced(delay=300){clearTimeout(_saveTimer);_saveTimer=setTimeout(save,delay);}
// ============================================================
// HELPERS
// ============================================================
const H=id=>{const el=document.getElementById(id);if(!el){console.warn("H(): #"+id+" bulunamadi");return null;}return el;};
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// ============================================================
// DATA
// ============================================================
const db ={
  settings:{},
  classes:{},
  questions:[],          // ESKİ - artık kullanılmayacak
  calismaQuestions:[],
  salons:[],
  dagitim:null,
  savedExams:[],
  savedCalisma:[],
  examGroups:[]          // YENİ - Her sınav grubu: {id, name, classes:[], questions:[]}
};
var activeClass =null,salonCnt=0,qCnt=0,calismaCnt=0,currentExamName='',currentCalismaName='',currentExamGroup=[],activeExamGroup=null;
var _activeQId =null,_weSavedRange=null;

function save(){try{localStorage.setItem('kelebek_db2',JSON.stringify(db));}catch(e){console.error('SAVE HATASI:',e.message);klbToast('Veri kaydedilemedi! Depolama dolu olabilir.','error');}}

// ============================================================
// MERKEZI ÖĞRENCİ SİSTEMİ - UI FONKSİYONLARI
// ============================================================

function cssCheckAndShowSetup(){
  // Merkezi sistem UI artık kullanılmıyor (tek-kaynak Drive moduna geçildi).
  // Element yoksa sessizce atla — null hatası engellenir.
  var setupCard = H('css-setup-card');
  var statusCard = H('css-status-card');
  if(!setupCard && !statusCard) return;
  if(window.CSS && window.CSS.isConfigured && window.CSS.isConfigured()){
    if(setupCard) setupCard.style.display='none';
    if(statusCard) statusCard.style.display='block';
    cssUpdateStatus();
  } else {
    if(setupCard) setupCard.style.display='block';
    if(statusCard) statusCard.style.display='none';
  }
}

function cssUpdateStatus(){
  if(!window.CSS || !window.CSS.getStatus) return;
  if(!H('css-status-school')) return;
  const status=window.CSS.getStatus();
  H('css-status-school').textContent=status.school;
  H('css-status-role').textContent=status.role==='admin'?'Admin':status.role==='idare'?'İdare':status.role==='rehberlik'?'Rehberlik':'Öğretmen';
  H('css-status-students').textContent=status.studentCount+' öğrenci';
  H('css-status-notif').textContent=status.notificationCount+' yeni bildirim';
  H('css-status-sync').textContent=status.lastSync?new Date(status.lastSync).toLocaleString():'Henüz yapılmadı';
}

async function cssSetupSystem(){
  const school=H('css-school').value.trim();
  const username=H('css-username').value.trim();
  const role=H('css-role').value;
  const token=H('css-token').value.trim();
  
  if(!school||!username||!token){
    klbToast('Lütfen tüm alanları doldurun!');
    return;
  }
  
  if(!token.startsWith('ghp_')){
    klbToast('Geçersiz GitHub token! Token "ghp_" ile başlamalı.');
    return;
  }
  
  try{
    await window.CSS.setup({
      schoolName:school,
      userName:username,
      userRole:role,
      githubToken:token
    });
    
    klbToast('✅ Merkezi sistem başarıyla kuruldu!','success');
    cssCheckAndShowSetup();
  }catch(e){
    klbToast('Kurulum hatası: '+e.message);
    console.error(e);
  }
}

async function cssConnectExisting(){
  const gistId=prompt('Mevcut sistemin Gist ID\'sini girin:');
  if(!gistId)return;
  
  const school=H('css-school').value.trim();
  const username=H('css-username').value.trim();
  const role=H('css-role').value;
  const token=H('css-token').value.trim();
  
  if(!school||!username||!token){
    klbToast('Lütfen tüm alanları doldurun!');
    return;
  }
  
  try{
    window.CSS.config={
      gistId:gistId,
      githubToken:token,
      schoolName:school,
      userName:username,
      userRole:role
    };
    window.CSS.saveConfig();
    
    await window.CSS.syncFromGist();
    klbToast('✅ Mevcut sisteme bağlanıldı!','success');
    cssCheckAndShowSetup();
    
    // Öğrencileri yerel db'ye kopyala
    db.classes=window.CSS.getStudents();
    saveDebounced();
    renderClassList();
  }catch(e){
    klbToast('Bağlantı hatası: '+e.message);
    console.error(e);
  }
}

function cssSkipSetup(){
  H('css-setup-card').style.display='none';
}

async function cssManualSync(){
  try{
    await window.CSS.syncFromGist();
    
    // Öğrencileri yerel db'ye kopyala
    db.classes=window.CSS.getStudents();
    saveDebounced();
    renderClassList();
    
    cssUpdateStatus();
    klbToast('✅ Senkronizasyon tamamlandı!','success');
  }catch(e){
    klbToast('Senkronizasyon hatası: '+e.message);
  }
}

function cssShowSettings(){
  const config=window.CSS.config;
  klbToast(`Sistem Ayarları:\n\nOkul: ${config.schoolName}\nKullanıcı: ${config.userName}\nRol: ${config.userRole}\nGist ID: ${config.gistId}`);
}

// Sayfa yüklendiğinde kontrol et
document.addEventListener('DOMContentLoaded',()=>{
  cssCheckAndShowSetup();
});

// Otomatik yükleme (debounced)
let cssUploadTimeout=null;
async function cssAutoUpload(){
  if(!window.CSS.isConfigured())return;
  if(!window.CSS.canEditStudents())return;
  
  clearTimeout(cssUploadTimeout);
  cssUploadTimeout=setTimeout(async ()=>{
    try{
      await window.CSS.uploadStudents(db.classes);
      console.log('✅ Öğrenciler merkezi sisteme yüklendi');
    }catch(e){
      console.error('Yükleme hatası:',e);
    }
  },2000); // 2 saniye bekle
}

// Manuel yükleme
async function cssUploadStudentsToCloud(){
  if(!window.CSS.canEditStudents()){
    klbToast('Yetkiniz yok!');
    return;
  }
  
  try{
    await window.CSS.uploadStudents(db.classes);
    klbToast('✅ Öğrenciler merkezi sisteme yüklendi!','success');
  }catch(e){
    klbToast('Yükleme hatası: '+e.message);
  }
}

// Öğrenciler sayfası açıldığında banner göster
function cssCheckStudentsPage(){
  if(!window.CSS || !window.CSS.isConfigured || !window.CSS.isConfigured()){
    if(H('css-students-banner')) H('css-students-banner').style.display='none';
    if(H('css-readonly-banner')) H('css-readonly-banner').style.display='none';
    return;
  }
  
  if(window.CSS.canEditStudents()){
    H('css-students-banner').style.display='block';
    H('css-readonly-banner').style.display='none';
  }else{
    H('css-students-banner').style.display='none';
    H('css-readonly-banner').style.display='block';
    
    // Salt okunur modu aktifleştir
    const inputs=document.querySelectorAll('#page-ogrenciler input, #page-ogrenciler textarea, #page-ogrenciler button');
    inputs.forEach(el=>{
      if(!el.id.startsWith('css-'))el.disabled=true;
    });
  }
}



// ============================================================

// ============================================================
// INIT - Sayfa Hazır
// ============================================================
window.addEventListener('DOMContentLoaded',function(){
  try{
    init();
  }catch(err){
    console.error('INIT hatasi:',err.message);
  }
});

function init(){
  // Eski verilerden yardım metinlerini temizle
  function migrateCleanText(txt){
    if(!txt)return txt;
    const d=document.createElement('div');d.innerHTML=txt;
    const JUNK=[/↑\s*Resme?\s*tıkla/i,/üzerine\s*(çiz|düzenle)/i,/tıkla\s*→/i,/→\s*(çiz|düzenle)/i,/çizim\s*arac/i];
    d.querySelectorAll('*').forEach(function(el){
      if(!el.children.length){let t=el.textContent||'';if(JUNK.some(function(p){return p.test(t);}))el.remove();}
    });
    // title attribute temizle
    d.querySelectorAll('[title]').forEach(function(el){
      let t=el.getAttribute('title')||'';
      if(JUNK.some(function(p){return p.test(t);}))el.removeAttribute('title');
    });
    return d.innerHTML;
  }
  try{
    const s=localStorage.getItem('kelebek_db2');
    if(!s){
      // Eski versiyon?
      const old=localStorage.getItem('kelebek_db');
      if(old){const p=JSON.parse(old);Object.assign(db,p);}
    } else {
      const p=JSON.parse(s);Object.assign(db,p);
    }
    db.salons.forEach(s=>{const n=parseInt((s.id||'').replace('s_',''))||0;if(n>=salonCnt)salonCnt=n+1;});
    db.questions.forEach(q=>{
      const n=parseInt((q.id||'').replace('q_',''))||0;if(n>=qCnt)qCnt=n+1;
      if(q.text)q.text=migrateCleanText(q.text); // eski yardım metinlerini temizle
    });
    if(db.calismaQuestions){
      db.calismaQuestions.forEach(q=>{
        const n=parseInt((q.id||'').replace('c_',''))||0;if(n>=calismaCnt)calismaCnt=n+1;
        if(q.text)q.text=migrateCleanText(q.text);
      });
    }
  }catch(e){console.warn('DB load error:',e);}
  loadSettings();
  if(typeof renderStats==='function') renderStats();
  if(typeof renderClassTabs==='function') renderClassTabs();
  if(typeof renderQuestions==='function') renderQuestions();
  if(typeof renderQuestionsCalisma==='function') renderQuestionsCalisma();
  if(typeof renderSalonList==='function') renderSalonList();
  if(typeof renderKChecks==='function') renderKChecks();
  if(typeof renderPrintSummary==='function') renderPrintSummary();
  if(typeof updatePts==='function') updatePts();
  if(typeof renderTeachers==='function') renderTeachers();
  if(typeof updateExamTitle==='function') updateExamTitle();
  if(typeof updateCalismaTitle==='function') updateCalismaTitle();
  if(typeof renderExamGroups==='function') renderExamGroups();
}

// ============================================================

// ============================================================
// SETTINGS
// ============================================================
function saveS(){
  const s=db.settings;
  s.okulAdi=H('s-okul')?.value||'';
  s.dersAdi=H('s-ders')?.value||'';
  s.sinavBasligi=H('s-baslik')?.value||'';
  s.sinavTarihi=H('s-tarih')?.value||'';
  s.sinavSure=H('s-sure')?.value||'';
  s.sinifSube=H('s-sinif')?.value||'';
  s.ogretmenAdi=H('s-ogretmen')?.value||'';
  s.notlar=H('s-notlar')?.value||'';
  s.notlarCalisma=H('s-notlar-calisma')?.value||'';
  s.filigran=H('filigran-txt')?.value||'';
  s.filigranOpaklik=parseInt(H('filigran-op')?.value||'8');
  s.colText=H('col-text')?.value||'';
  s.linesCount=parseInt(H('opt-lines-count')?.value)||6;
  // Cevap anahtarı - hangi sayfa aktifse ondan oku
  const onCalismaPage = document.getElementById('page-calisma')?.classList.contains('active');
  const caName = onCalismaPage ? 'ca-calisma' : 'ca';
  const caEl=document.querySelector('input[name="'+caName+'"]:checked');
  s.cevapAnahtariPos=caEl?caEl.value:'none';
  if(H('fil-op-val'))H('fil-op-val').textContent=(s.filigranOpaklik||8)+'%';
  saveDebounced();
  updateEditorHeader();
}

// ===== THEME TOGGLE =====
function toggleTheme(){
  const current=document.documentElement.getAttribute('data-theme')||'dark';
  const newTheme=current==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',newTheme);
  db.settings.theme=newTheme;
  saveDebounced();
}
function loadSettings(){
  const s=db.settings||{};
  const set=(id,v)=>{const el=H(id);if(el&&v!==undefined)el.value=v;};
  set('s-okul',s.okulAdi);set('s-ders',s.dersAdi);set('s-baslik',s.sinavBasligi);
  set('s-tarih',s.sinavTarihi);set('s-sure',s.sinavSure);set('s-sinif',s.sinifSube);
  set('s-ogretmen',s.ogretmenAdi);set('s-notlar',s.notlar);
  set('s-notlar-calisma',s.notlarCalisma);
  set('filigran-txt',s.filigran);set('filigran-op',s.filigranOpaklik||8);
  set('col-text',s.colText);
  set('opt-lines-count',s.linesCount||6);
  if(H('fil-op-val'))H('fil-op-val').textContent=(s.filigranOpaklik||8)+'%';
  // Margin
  ['dar','normal','genis'].forEach(m=>{const el=H('mar-'+m);if(el)el.classList.toggle('active',m===(s.kenarBoslugu||'normal'));});
  // Image size
  ['kucuk','orta','buyuk','tam'].forEach(m=>{const el=H('img-'+m);if(el)el.classList.toggle('active',m===(s.resimBoyutu||'orta'));});
  // Columns
  [1,2,3].forEach(n=>{const el=H('col-'+n);if(el)el.classList.toggle('active',n===(s.sutunSayisi||1));});
  // Col rule
  ['none','line','dash'].forEach(r=>{const el=H('cr-'+r);if(el)el.classList.toggle('active',r===(s.colRule||'none'));});
  // Answer key - her iki radio grup için de ayarla
  const ca=s.cevapAnahtariPos||'none';
  document.querySelectorAll('input[name="ca"]').forEach(r=>{r.checked=r.value===ca;});
  document.querySelectorAll('input[name="ca-calisma"]').forEach(r=>{r.checked=r.value===ca;});
  // Kelebek boşluk
  const kb=s.kelebek_bosluk||'yok';
  ['yok','az','orta','genis'].forEach(b=>{const el=H('kb-'+b);if(el)el.classList.toggle('active',b===kb);});
  // Theme
  const theme=s.theme||'dark';
  document.documentElement.setAttribute('data-theme',theme);
  updateEditorHeader();
}

function updateEditorHeader(){
  const s=db.settings||{};
  const t=H('editor-title-display');const m=H('editor-meta-display');
  if(t)t.textContent=s.sinavBasligi||'Sınav';
  if(m){
    const parts=[];
    if(s.dersAdi)parts.push(s.dersAdi);
    if(s.ogretmenAdi)parts.push(s.ogretmenAdi);
    if(s.sinavTarihi)parts.push(new Date(s.sinavTarihi).toLocaleDateString('tr-TR'));
    m.textContent=parts.join(' · ');
  }
}

// ============================================================

// ============================================================
// NAVIGATION
// ============================================================
function showPage(id){
  // Kapat: overlay, panel, modals
  const ov=H('id-overlay'),tb=H('id-toolbar');
  if(ov)ov.remove();if(tb)tb.remove();
  try{closeQEdit(true);}catch(e){}
  const pm=H('preview-modal');if(pm)pm.remove();
  const fm=H('frac-modal');if(fm)fm.remove();

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(n=>n.classList.remove('active'));
  const pg=H('page-'+id);if(pg)pg.classList.add('active');
  const nv=H('nav-'+id);if(nv)nv.classList.add('active');

  if(id==='anasayfa'){renderStats();}
  if(id==='kelebek'){renderKChecks();renderSalonList();}
  if(id==='cikti'){renderPrintSummary();}
  if(id==='sorular'){renderExamGroups();} // YENİ: Grup sistemi
  if(id==='performans'){perfInit();} // PERFORMANS SİSTEMİ
  if(id==='zkitap'){zkRenderCards();} // Z-KİTAP
  if(id==='zkduzenle'){zkdRenderList();} // Z-KİTAP DÜZENLE
}

// ============================================================
// STATS
// ============================================================