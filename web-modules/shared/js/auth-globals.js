// ============================================================
// AUTH GLOBALS — Tüm modüller için Google OAuth + Session
// ============================================================
const AUTH_CLIENT_ID = "382416473789-4ar84tn08cjbvf2o30bkqu3fl97jmsem.apps.googleusercontent.com";
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
let currentUser = null;
let driveAccessToken = null;
let tokenClient = null;

function decodeJwtResponse(token){
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g,'+').replace(/_/g,'/');
  const json = atob(base64);
  return JSON.parse(json);
}

function handleCredentialResponse(response){
  try {
    const user = decodeJwtResponse(response.credential);
    currentUser = user;

    // Session kaydet
    sessionStorage.setItem('kelebek_user', JSON.stringify({
      name: user.name,
      email: user.email,
      picture: user.picture
    }));

    unlockApp(user);

    // Girişten HEMEN sonra Drive token'ını sessizce hazırla.
    // "Buluta Kaydet"e basınca ikinci izin penceresi açılmaz —
    // token zaten hazır olur (kesintisiz akış, atlama yok).
    _prewarmDriveToken();
  } catch(e){
    console.error('Auth hata:', e);
    const errEl = document.getElementById('login-error');
    if(errEl){errEl.style.display='block'; errEl.textContent='❌ Giriş başarısız: '+e.message;}
  }
}

// Drive token'ını arka planda sessizce ısıt (kullanıcıyı rahatsız etmez)
function _prewarmDriveToken(){
  try {
    if(driveAccessToken) return;
    if(!tokenClient) _initTokenClient();
    if(!tokenClient) return;
    tokenClient.callback = (resp) => {
      if(resp && resp.access_token){
        driveAccessToken = resp.access_token;
        console.log('Drive token önceden hazırlandı (sessiz)');
      }
    };
    tokenClient.requestAccessToken({prompt: ''});
  } catch(e){ /* sessiz */ }
}

function unlockApp(user){
  // Login ekranını gizle (farklı ID'leri destekle)
  const ls = document.getElementById('login-screen');
  if(ls) ls.style.display = 'none';

  // Ana içeriği göster (birden fazla ID'yi dene)
  const app = document.getElementById('main-app-content') 
    || document.getElementById('main-app') 
    || document.getElementById('main-hub');
  if(app) app.style.display = 'block';

  // Avatar ve isim göster (birden fazla ID'yi dene)
  const avatar = document.getElementById('topbar-avatar');
  const nameEl = document.getElementById('topbar-name');
  if(avatar && user.picture) avatar.src = user.picture;
  if(avatar) avatar.style.display = 'inline-block';
  if(nameEl) nameEl.textContent = user.name || user.email;
}

// Doğrudan Demo Giriş (Google OAuth bypass)
function directLogin(){
  const demoUser = {
    name: 'Koray',
    email: 'koray@kelebek.local',
    picture: ''
  };
  currentUser = demoUser;
  sessionStorage.setItem('kelebek_user', JSON.stringify(demoUser));
  unlockApp(demoUser);
}

function doLogout(){
  sessionStorage.removeItem('kelebek_user');
  currentUser = null;
  if(typeof google !== 'undefined' && google.accounts && google.accounts.id){
    google.accounts.id.disableAutoSelect();
  }
  location.reload();
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme')||'dark';
  const next = current==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.setItem('kelebek_theme',next);}catch(e){}
}

// ============================================================
// GOOGLE AUTH + DRIVE TOKEN — Tüm modüllerin ortak çekirdeği
// (önceden sync.js'teydi; sync.js olmayan modüller de kullansın diye taşındı)
// ============================================================
function initGoogleAuth(){
  if(typeof google === 'undefined' || !google.accounts){
    setTimeout(initGoogleAuth, 200);
    return;
  }
  // Session kontrolü
  const saved = sessionStorage.getItem('kelebek_user');
  if(saved){
    try{
      const user = JSON.parse(saved);
      currentUser = user;
      unlockApp(user);
      // Oturum açık olsa da Drive token client'ı hazırla
      _initTokenClient();
      return;
    }catch(e){}
  }
  // Google Sign-In butonu
  const btn = document.getElementById('google-login-btn');
  google.accounts.id.initialize({
    client_id: AUTH_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false
  });
  if(btn){
    google.accounts.id.renderButton(btn,
      { theme:"filled_blue", size:"large", shape:"pill", text:"continue_with", width:300 });
  }
  _initTokenClient();
}

function _initTokenClient(){
  if(typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return;
  if(tokenClient) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: AUTH_CLIENT_ID,
    scope: DRIVE_SCOPES,
    callback: (response) => {
      if(response.access_token){
        driveAccessToken = response.access_token;
        console.log('Drive token alındı');
      }
    }
  });
}

function requestDriveAccess(callback){
  if(driveAccessToken){
    fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { 'Authorization': 'Bearer ' + driveAccessToken }
    }).then(r => {
      if(r.ok){ callback(); }
      else { driveAccessToken = null; requestNewToken(callback); }
    }).catch(() => { driveAccessToken = null; requestNewToken(callback); });
    return;
  }
  requestNewToken(callback);
}

function requestNewToken(callback){
  if(!tokenClient) _initTokenClient();
  if(!tokenClient){
    if(typeof klbToast==='function') klbToast('Google servisleri yüklenemedi','error');
    return;
  }
  tokenClient.callback = (response) => {
    if(response.access_token){
      driveAccessToken = response.access_token;
      callback();
    } else {
      if(typeof klbToast==='function') klbToast('Drive erişimi reddedildi','error');
    }
  };
  tokenClient.requestAccessToken({prompt: ''});
}

// Sayfa hazır olunca auth başlat (tek nokta)
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initGoogleAuth);
} else {
  initGoogleAuth();
}
