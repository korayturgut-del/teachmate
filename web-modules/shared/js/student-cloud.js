/* ============================================================
   DİJİTAL ÖĞRETMEN ASİSTANI — ORTAK ÖĞRENCİ BULUT MODÜLÜ
   ------------------------------------------------------------
   • TEK KAYNAK: Google Drive (.doa uzantılı dosyalar)
   • Otomatik isim: "Ogrenci_Listesi_1.doa", "Ogrenci_Listesi_2.doa" ...
   • Tek kişilik sistem (rol/yetki yok)
   • Tüm modüller bu dosyayı kullanır → ortak öğrenci listesi
   ============================================================ */

// Dijital Öğretmen Asistanı — üç ayrı dosya türü
// .ogr = öğrenci listesi | .snv = sınav/yazılı | .clk = çalışma kağıdı
const DOA_EXT = '.ogr';                 // varsayılan: öğrenci listesi (geriye dönük)
const DOA_PREFIX = 'Ogrenci_Listesi_';
const DOA_TYPES = {
  ogrenci:  { ext: '.ogr', prefix: 'Ogrenci_Listesi_', label: 'Öğrenci Listesi' },
  sinav:    { ext: '.snv', prefix: 'Sinav_',           label: 'Sınav / Yazılı' },
  calisma:  { ext: '.clk', prefix: 'Calisma_Kagidi_',  label: 'Çalışma Kağıdı' }
};

/* ------------------------------------------------------------
   Drive erişim token kontrolü (auth-globals + sync ile uyumlu)
   ------------------------------------------------------------ */
function doaHasToken(){
  return (typeof driveAccessToken !== 'undefined' && driveAccessToken);
}

function doaRequireToken(){
  if(!doaHasToken()){
    if(typeof klbToast === 'function'){
      klbToast('⚠️ Önce Google hesabınızla giriş yapın.', 'error');
    } else {
      alert('⚠️ Önce Google hesabınızla giriş yapın.');
    }
    return false;
  }
  return true;
}

/* ------------------------------------------------------------
   Drive token isteme (sync.js'teki tokenClient'i kullanır)
   ------------------------------------------------------------ */
function doaEnsureToken(callback){
  if(doaHasToken()){ callback(); return; }
  if(typeof tokenClient !== 'undefined' && tokenClient){
    tokenClient.callback = function(resp){
      if(resp && resp.access_token){
        driveAccessToken = resp.access_token;
        callback();
      } else {
        if(typeof klbToast === 'function') klbToast('Drive erişimi reddedildi', 'error');
      }
    };
    tokenClient.requestAccessToken({prompt: ''});
  } else {
    doaRequireToken();
  }
}

/* ------------------------------------------------------------
   Sonraki otomatik dosya adını bul (Ogrenci_Listesi_N.doa)
   ------------------------------------------------------------ */
function doaNextFileName(callback){
  doaListFiles(function(files){
    var maxN = 0;
    files.forEach(function(f){
      var m = (f.name||'').match(/Ogrenci_Listesi_(\d+)\.doa$/i);
      if(m){ var n = parseInt(m[1],10); if(n > maxN) maxN = n; }
    });
    callback(DOA_PREFIX + (maxN + 1) + DOA_EXT);
  });
}

/* ------------------------------------------------------------
   ÖĞRENCİ LİSTESİNİ BULUTA KAYDET
   Her kayıt YENİ numaralı dosya oluşturur (üzerine yazmaz).
   classesObj: { "9-A":[{no,ad,sinif}, ...], ... }
   ------------------------------------------------------------ */
function doaSaveStudents(classesObj, onDone){
  doaEnsureToken(function(){
    doaNextFileName(function(fileName){
      var payload = {
        app: 'DijitalOgretmenAsistani',
        type: 'ogrenci-listesi',
        version: '1.0',
        ext: DOA_EXT,
        timestamp: new Date().toISOString(),
        classes: classesObj || {}
      };
      var blob = new Blob([JSON.stringify(payload)], {type: 'application/json'});
      var metadata = {name: fileName, mimeType: 'application/json'};
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type:'application/json'}));
      form.append('file', blob);

      fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + driveAccessToken},
        body: form
      }).then(function(r){
        if(r.ok){
          if(typeof klbToast === 'function') klbToast('☁️ ' + fileName + ' kaydedildi', 'success');
          if(onDone) onDone(true, fileName);
        } else {
          if(typeof klbToast === 'function') klbToast('Kaydetme hatası', 'error');
          if(onDone) onDone(false);
        }
      }).catch(function(){
        if(typeof klbToast === 'function') klbToast('Bağlantı hatası', 'error');
        if(onDone) onDone(false);
      });
    });
  });
}

/* ------------------------------------------------------------
   DRIVE'DAKİ .doa DOSYALARINI LİSTELE (otomatik, arama yok)
   ------------------------------------------------------------ */
function doaListFiles(callback){
  if(!doaHasToken()){ callback([]); return; }
  // Sadece .doa uzantılı dosyalar — kullanıcı dosya aramaz
  var q = encodeURIComponent("name contains '" + DOA_EXT + "' and trashed = false");
  fetch('https://www.googleapis.com/drive/v3/files?q=' + q +
        '&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime,size)', {
    headers: {'Authorization': 'Bearer ' + driveAccessToken}
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(data){
    var files = (data.files || []).filter(function(f){
      return /\.doa$/i.test(f.name);
    });
    callback(files);
  }).catch(function(err){
    console.error('doaListFiles:', err);
    callback([]);
  });
}

/* ------------------------------------------------------------
   BELİRLİ BİR .doa DOSYASINI İNDİR → classes objesi döndür
   ------------------------------------------------------------ */
function doaLoadFile(fileId, callback){
  if(!doaRequireToken()) return;
  fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
    headers: {'Authorization': 'Bearer ' + driveAccessToken}
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(content){
    // Yeni .doa formatı veya eski .hdb/.koray uyumluluğu
    var classes = content.classes || (content.data && content.data.classes) || {};
    callback(classes, content);
  }).catch(function(err){
    console.error('doaLoadFile:', err);
    if(typeof klbToast === 'function') klbToast('Dosya yükleme hatası', 'error');
    callback(null);
  });
}

/* ------------------------------------------------------------
   ORTAK "BULUTTAN ÖĞRENCİ ÇEK" MODALI
   Her modül bunu çağırır. mergeCallback(classes) ile veriyi alır.
   ------------------------------------------------------------ */
function doaOpenCloudPicker(mergeCallback){
  doaEnsureToken(function(){
    var old = document.getElementById('doa-cloud-modal');
    if(old) old.remove();

    var modal = document.createElement('div');
    modal.id = 'doa-cloud-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg1,#0d1117);border:1px solid var(--border2,rgba(255,255,255,.15));border-radius:20px;width:100%;max-width:480px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.6)';

    box.innerHTML =
      '<div style="padding:20px 22px;border-bottom:1px solid var(--border,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:space-between">' +
        '<div><div style="font-size:1.05rem;font-weight:700;color:var(--text,#f0f6fc)">☁️ Buluttan Öğrenci Listesi</div>' +
        '<div style="font-size:.76rem;color:var(--text2,#8b949e);margin-top:2px">Drive\'daki <b>.doa</b> listeleriniz otomatik tarandı</div></div>' +
        '<button onclick="document.getElementById(\'doa-cloud-modal\').remove()" style="background:transparent;border:none;color:var(--text2,#8b949e);cursor:pointer;font-size:1.3rem;line-height:1">✕</button>' +
      '</div>' +
      '<div id="doa-cloud-list" style="flex:1;overflow-y:auto;padding:16px">' +
        '<div style="text-align:center;padding:40px;color:var(--text2,#8b949e)"><div style="font-size:2rem;margin-bottom:8px">🔍</div><div>Listeler taranıyor...</div></div>' +
      '</div>' +
      '<div style="padding:14px 20px;border-top:1px solid var(--border,rgba(255,255,255,.08))">' +
        '<button onclick="document.getElementById(\'doa-cloud-modal\').remove()" style="width:100%;padding:11px;border-radius:10px;background:var(--glass,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.12));color:var(--text2,#8b949e);cursor:pointer;font-size:.86rem">Kapat</button>' +
      '</div>';

    modal.appendChild(box);
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if(e.target === modal) modal.remove(); });

    doaListFiles(function(files){
      var listEl = document.getElementById('doa-cloud-list');
      if(!listEl) return;
      if(!files.length){
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2,#8b949e)">' +
          '<div style="font-size:2rem;margin-bottom:8px">📭</div>' +
          '<div>Henüz .doa öğrenci listesi yok</div>' +
          '<div style="font-size:.76rem;margin-top:6px;color:var(--text3,#484f58)">Öğrenci modülünden listenizi buluta kaydedin</div></div>';
        return;
      }
      listEl.innerHTML = files.map(function(f){
        var d = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('tr-TR') : '';
        var safeName = (f.name||'').replace(/'/g, "\\'");
        return '<div onclick="doaPickerLoad(\'' + f.id + '\',\'' + safeName + '\')" ' +
          'style="padding:14px;margin-bottom:8px;background:var(--bg2,#161b22);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .15s" ' +
          'onmouseover="this.style.borderColor=\'var(--accent,#6366f1)\'" onmouseout="this.style.borderColor=\'var(--border,rgba(255,255,255,.08))\'">' +
          '<div style="font-size:1.5rem;flex-shrink:0">📋</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="color:var(--text,#f0f6fc);font-weight:600;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + f.name + '</div>' +
            '<div style="color:var(--text2,#8b949e);font-size:.72rem">' + d + '</div>' +
          '</div>' +
          '<span style="color:var(--accent,#6366f1);font-size:1.2rem">→</span></div>';
      }).join('');
    });

    // Picker callback'i global olarak sakla
    window._doaMergeCallback = mergeCallback;
  });
}

/* Picker'dan dosya seçilince çağrılır */
function doaPickerLoad(fileId, fileName){
  var listEl = document.getElementById('doa-cloud-list');
  if(listEl){
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2,#8b949e)"><div style="font-size:2rem;margin-bottom:8px">⏳</div><div>Yükleniyor...</div><div style="font-size:.72rem;margin-top:4px">' + fileName + '</div></div>';
  }
  doaLoadFile(fileId, function(classes, content){
    if(!classes || Object.keys(classes).length === 0){
      if(listEl) listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--amber,#f59e0b)"><div style="font-size:2rem;margin-bottom:8px">⚠️</div><div>Bu dosyada öğrenci/sınıf verisi yok</div></div>';
      return;
    }
    var count = 0;
    Object.keys(classes).forEach(function(c){ count += (classes[c]||[]).length; });

    // Önizleme + onay
    var preview = Object.keys(classes).sort().slice(0,8).map(function(c){
      return '<div style="display:flex;justify-content:space-between;padding:5px 10px;background:var(--glass,rgba(255,255,255,.03));border-radius:6px;margin-bottom:3px;font-size:.78rem"><span>' + c + '</span><span style="color:var(--accent,#6366f1)">' + (classes[c]||[]).length + ' öğr.</span></div>';
    }).join('');

    if(listEl){
      listEl.innerHTML = '<div style="text-align:center;margin-bottom:14px"><div style="font-size:2rem;margin-bottom:4px">✅</div>' +
        '<div style="font-weight:700;color:var(--text,#f0f6fc)">' + fileName + '</div>' +
        '<div style="font-size:.82rem;color:var(--accent,#6366f1);margin-top:4px">' + Object.keys(classes).length + ' sınıf · ' + count + ' öğrenci</div></div>' +
        '<div style="margin-bottom:14px">' + preview + '</div>' +
        '<button onclick="doaPickerConfirm()" style="width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,var(--accent,#6366f1),var(--blue,#0ea5e9));border:none;color:#fff;cursor:pointer;font-weight:700;font-size:.9rem">📥 Bu Listeyi Yükle</button>';
    }
    window._doaPendingClasses = classes;
  });
}

function doaPickerConfirm(){
  var classes = window._doaPendingClasses;
  var cb = window._doaMergeCallback;
  var modal = document.getElementById('doa-cloud-modal');
  if(modal) modal.remove();
  if(classes && typeof cb === 'function') cb(classes);
  window._doaPendingClasses = null;
}

/* ------------------------------------------------------------
   YEREL db.classes İLE BULUT VERİSİNİ BİRLEŞTİR (no bazında tekil)
   ------------------------------------------------------------ */
function doaMergeIntoDb(newClasses){
  if(typeof db === 'undefined') return 0;
  if(!db.classes) db.classes = {};
  var added = 0;
  Object.keys(newClasses).forEach(function(cn){
    if(!db.classes[cn]){
      db.classes[cn] = newClasses[cn];
      added += (newClasses[cn]||[]).length;
    } else {
      var existing = new Set(db.classes[cn].map(function(s){ return s.no || s.schoolNumber || ''; }));
      newClasses[cn].forEach(function(s){
        var sn = s.no || s.schoolNumber || '';
        if(!existing.has(sn)){ db.classes[cn].push(s); added++; }
      });
    }
  });
  if(typeof saveDebounced === 'function') saveDebounced();
  return added;
}

/* ============================================================
   GENEL AMAÇLI BULUT DOSYA SİSTEMİ (üç tür: ogrenci/sinav/calisma)
   typeKey: 'ogrenci' | 'sinav' | 'calisma'
   ============================================================ */

// Belirli türde sonraki otomatik dosya adını bul
function doaNextNameFor(typeKey, callback){
  var t = DOA_TYPES[typeKey] || DOA_TYPES.ogrenci;
  doaListFor(typeKey, function(files){
    var maxN = 0;
    var re = new RegExp(t.prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(\\d+)\\' + t.ext + '$', 'i');
    files.forEach(function(f){
      var m = (f.name||'').match(re);
      if(m){ var n = parseInt(m[1],10); if(n > maxN) maxN = n; }
    });
    callback(t.prefix + (maxN + 1) + t.ext);
  });
}

// Belirli türdeki dosyaları listele
function doaListFor(typeKey, callback){
  var t = DOA_TYPES[typeKey] || DOA_TYPES.ogrenci;
  if(!doaHasToken()){ callback([]); return; }
  var q = encodeURIComponent("name contains '" + t.ext + "' and trashed = false");
  fetch('https://www.googleapis.com/drive/v3/files?q=' + q +
        '&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime,size)', {
    headers: {'Authorization': 'Bearer ' + driveAccessToken}
  }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(data){
      var ext = t.ext.replace('.','\\.');
      var re = new RegExp(ext + '$', 'i');
      callback((data.files||[]).filter(function(f){ return re.test(f.name); }));
   }).catch(function(err){ console.error('doaListFor:', err); callback([]); });
}

// Belirli türde veri kaydet (payloadObj serbest içerik)
function doaSaveFor(typeKey, payloadObj, onDone){
  var t = DOA_TYPES[typeKey] || DOA_TYPES.ogrenci;
  doaEnsureToken(function(){
    doaNextNameFor(typeKey, function(fileName){
      var payload = {
        app: 'DijitalOgretmenAsistani',
        type: typeKey,
        ext: t.ext,
        version: '1.0',
        timestamp: new Date().toISOString(),
        payload: payloadObj
      };
      var blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
      var metadata = {name: fileName, mimeType:'application/json'};
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type:'application/json'}));
      form.append('file', blob);
      fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method:'POST', headers:{'Authorization':'Bearer '+driveAccessToken}, body:form
      }).then(function(r){
        if(r.ok){ if(typeof klbToast==='function') klbToast('☁️ '+fileName+' kaydedildi','success'); if(onDone) onDone(true,fileName); }
        else { if(typeof klbToast==='function') klbToast('Kaydetme hatası','error'); if(onDone) onDone(false); }
      }).catch(function(){ if(typeof klbToast==='function') klbToast('Bağlantı hatası','error'); if(onDone) onDone(false); });
    });
  });
}

// Belirli bir dosyayı indir → payload döndür
function doaLoadFor(fileId, callback){
  if(!doaRequireToken()) return;
  fetch('https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media', {
    headers:{'Authorization':'Bearer '+driveAccessToken}
  }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
   .then(function(content){
      var data = content.payload || content.classes || (content.data && content.data.classes) || content;
      callback(data, content);
   }).catch(function(err){
      console.error('doaLoadFor:', err);
      if(typeof klbToast==='function') klbToast('Dosya yükleme hatası','error');
      callback(null);
   });
}

// Belirli tür için bulut seçim modalı (öğrenci picker'ının genel hali)
function doaOpenPickerFor(typeKey, mergeCallback){
  var t = DOA_TYPES[typeKey] || DOA_TYPES.ogrenci;
  doaEnsureToken(function(){
    var old = document.getElementById('doa-cloud-modal'); if(old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'doa-cloud-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg1,#0d181b);border:1px solid var(--border2,rgba(255,255,255,.15));border-radius:20px;width:100%;max-width:480px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.6)';
    box.innerHTML =
      '<div style="padding:20px 22px;border-bottom:1px solid var(--border,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:space-between">' +
        '<div><div style="font-size:1.05rem;font-weight:700;color:var(--text,#eaf3f4)">☁️ '+t.label+'</div>' +
        '<div style="font-size:.76rem;color:var(--text2,#8ba0a4);margin-top:2px">Drive\'daki <b>'+t.ext+'</b> dosyalarınız otomatik tarandı</div></div>' +
        '<button onclick="document.getElementById(\'doa-cloud-modal\').remove()" style="background:transparent;border:none;color:var(--text2,#8ba0a4);cursor:pointer;font-size:1.3rem;line-height:1">✕</button></div>' +
      '<div id="doa-cloud-list" style="flex:1;overflow-y:auto;padding:16px"><div style="text-align:center;padding:40px;color:var(--text2,#8ba0a4)"><div style="font-size:2rem;margin-bottom:8px">🔍</div><div>Taranıyor...</div></div></div>' +
      '<div style="padding:14px 20px;border-top:1px solid var(--border,rgba(255,255,255,.08))"><button onclick="document.getElementById(\'doa-cloud-modal\').remove()" style="width:100%;padding:11px;border-radius:10px;background:var(--glass,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.12));color:var(--text2,#8ba0a4);cursor:pointer;font-size:.86rem">Kapat</button></div>';
    modal.appendChild(box); document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });

    window._doaPickerType = typeKey;
    window._doaMergeCallback = mergeCallback;

    doaListFor(typeKey, function(files){
      var listEl = document.getElementById('doa-cloud-list'); if(!listEl) return;
      if(!files.length){
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2,#8ba0a4)"><div style="font-size:2rem;margin-bottom:8px">📭</div><div>Henüz '+t.ext+' dosyası yok</div></div>';
        return;
      }
      listEl.innerHTML = files.map(function(f){
        var d = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('tr-TR') : '';
        var sn = (f.name||'').replace(/'/g,"\\'");
        return '<div onclick="doaPickerLoadGeneric(\''+f.id+'\',\''+sn+'\')" style="padding:14px;margin-bottom:8px;background:var(--bg2,#142226);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:12px" onmouseover="this.style.borderColor=\'var(--accent,#14b8a6)\'" onmouseout="this.style.borderColor=\'var(--border,rgba(255,255,255,.08))\'">' +
          '<div style="font-size:1.5rem;flex-shrink:0">📄</div><div style="flex:1;min-width:0">' +
          '<div style="color:var(--text,#eaf3f4);font-weight:600;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+f.name+'</div>' +
          '<div style="color:var(--text2,#8ba0a4);font-size:.72rem">'+d+'</div></div>' +
          '<span style="color:var(--accent,#14b8a6);font-size:1.2rem">→</span></div>';
      }).join('');
    });
  });
}

function doaPickerLoadGeneric(fileId, fileName){
  var listEl = document.getElementById('doa-cloud-list');
  if(listEl) listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2,#8ba0a4)"><div style="font-size:2rem;margin-bottom:8px">⏳</div><div>Yükleniyor...</div></div>';
  doaLoadFor(fileId, function(data){
    var modal = document.getElementById('doa-cloud-modal');
    if(modal) modal.remove();
    var cb = window._doaMergeCallback;
    if(data && typeof cb === 'function') cb(data, fileName);
  });
}
