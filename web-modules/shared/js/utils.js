// ============================================================
// KLB DOSYA SİSTEMİ
// ============================================================
const KLB_MAGIC = 'KLBF\x01\x00';
const KLB_APP_ID = 'KorayKelebek2024';

function klbEncode(payload){
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return KLB_MAGIC + KLB_APP_ID + '\n' + b64;
}
function klbDecode(raw){
  if(!raw.startsWith(KLB_MAGIC + KLB_APP_ID)){
    throw new Error('Bu dosya geçerli bir Kelebek dosyası değil.\nSadece Koray Kelebek Sınav Editörü ile açılabilir.');
  }
  const b64 = raw.slice((KLB_MAGIC + KLB_APP_ID + '\n').length);
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}
function klbDownload(content, filename){
  const blob = new Blob([content], {type:'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function klbAskName(defaultName, title, onConfirm){
  const old = document.getElementById('klb-name-modal');
  if(old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'klb-name-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999999;
    display:flex;align-items:center;justify-content:center;
    backdrop-filter:blur(8px);animation:tipFade .25s ease;
  `;
  overlay.innerHTML = `
    <div style="
      background:var(--bg1);border:1px solid var(--border2);border-radius:20px;
      padding:32px;width:420px;max-width:92vw;
      box-shadow:0 24px 64px rgba(0,0,0,.6);
    ">
      <div style="font-size:1.15rem;font-weight:700;color:var(--text);margin-bottom:6px">
        💾 ${title}
      </div>
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:20px">
        Dosya adını girin — <b>.klb</b> uzantısı otomatik eklenecek
      </div>
      <input id="klb-name-input" type="text" value="${defaultName}"
        style="
          width:100%;padding:12px 16px;border-radius:10px;
          background:var(--bg2);border:1px solid var(--border2);
          color:var(--text);font-size:.95rem;outline:none;
          box-sizing:border-box;margin-bottom:20px;
        "
        placeholder="Dosya adı..."
      />
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="document.getElementById('klb-name-modal').remove()"
          style="
            padding:10px 22px;border-radius:10px;border:1px solid var(--border);
            background:var(--glass);color:var(--text2);cursor:pointer;font-size:.85rem;
          ">İptal</button>
        <button id="klb-confirm-btn"
          style="
            padding:10px 22px;border-radius:10px;border:none;
            background:linear-gradient(135deg,var(--accent),var(--blue));
            color:#fff;cursor:pointer;font-size:.85rem;font-weight:600;
          ">💾 Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = document.getElementById('klb-name-input');
  const confirmBtn = document.getElementById('klb-confirm-btn');
  setTimeout(()=>{ input.focus(); input.select(); }, 50);
  const doSave = ()=>{
    const name = input.value.trim();
    if(!name){ input.style.borderColor='#ef4444'; return; }
    overlay.remove();
    onConfirm(name);
  };
  confirmBtn.onclick = doSave;
  input.onkeydown = e=>{ if(e.key==='Enter') doSave(); if(e.key==='Escape') overlay.remove(); };
  overlay.onclick = e=>{ if(e.target===overlay) overlay.remove(); };
}
function klbToast(msg, type){
  const old = document.getElementById('klb-toast');
  if(old) old.remove();
  const colors = {
    success:'linear-gradient(135deg,#10b981,#059669)',
    error:'linear-gradient(135deg,#ef4444,#dc2626)',
    info:'linear-gradient(135deg,#6366f1,#4f46e5)'
  };
  const t = document.createElement('div');
  t.id = 'klb-toast';
  t.style.cssText = `
    position:fixed;top:80px;right:20px;z-index:999999;
    background:${colors[type]||colors.info};
    color:#fff;padding:14px 20px;border-radius:14px;
    font-size:.84rem;font-weight:600;line-height:1.5;
    box-shadow:0 16px 40px rgba(0,0,0,.35);
    animation:tipFade .3s cubic-bezier(.4,0,.2,1);
    white-space:pre-line;max-width:320px;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3000);
}
// ============================================================
// formatDate — sync.js tarafından kullanılır (eksikti, eklendi)
// ============================================================
function formatDate(d){
  if(!(d instanceof Date)) d = new Date(d);
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var yy = d.getFullYear();
  return yy + '-' + mm + '-' + dd;
}
