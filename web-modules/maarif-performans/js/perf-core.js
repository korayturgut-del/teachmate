/* ============================================================
   MAARİF PERFORMANS — ÇEKİRDEK (perf-core.js)
   Dijital Öğretmen Asistanı · Süreç Odaklı Değerlendirme

   BLOK 1/4: Yapılandırma + bağımsızlık katmanı + öğrenci entegrasyonu

   Bu modül BAĞIMSIZ çalışır:
   - shared/js/* varsa onları kullanır
   - yoksa kendi minimal stub'larını üretir
   Klasör kesilip taşınsa bile çalışır.

   ESKİ SİSTEMDEN FARK:
   - GitHub Gist senkronizasyonu KALDIRILDI (eski teknoloji)
   - MAARIF_AI_WORKER (tanımsız → çöküyordu) → PERF_CONFIG.aiBase
   - Tüm AI mantığı cloud-brain Python servisine taşındı
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   YAPILANDIRMA — AI servisi adresi (gelişime açık)
   ────────────────────────────────────────────────────────── */
window.PERF_CONFIG = window.PERF_CONFIG || {
  // Cloud-brain Maarif endpoint'i.
  //  - Canlı (teachmate.com.tr): boş → aynı origin; Cloudflare Worker
  //    /api/* çağrılarını HF Spaces'e proxy'ler.
  //  - Lokal geliştirme: localhost:8000
  //  - Elle override: localStorage 'doa_ai_base'
  aiBase: (function () {
    var override = localStorage.getItem('doa_ai_base');
    if (override) return override;
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') {
      return 'http://localhost:8000';
    }
    return ''; // canlı: aynı origin
  })(),

  // Endpoint yolları
  endpoints: {
    evaluate: '/api/maarif/evaluate',   // performans değerlendirme
    exam:     '/api/maarif/exam',        // sınav okuma
    framework:'/api/maarif/framework',   // çerçeve bilgisi
    health:   '/api/maarif/health',
  },

  // Aktif dönem
  currentTerm: '2025-2026-1',
};

/** AI servisinin tam URL'ini üretir. */
function perfApiUrl(endpointKey) {
  const base = window.PERF_CONFIG.aiBase.replace(/\/$/, '');
  return base + window.PERF_CONFIG.endpoints[endpointKey];
}

/* ──────────────────────────────────────────────────────────
   BAĞIMSIZLIK KATMANI
   shared/js/* yüklüyse onu kullan, yoksa stub üret.
   ────────────────────────────────────────────────────────── */

// Element seçici
function H(id) { return document.getElementById(id); }

// Global veritabanı — shared/js/app-core.js'den gelir.
// Bağımsız çalışırken kendi minimal db'sini kurar.
if (typeof window.db === 'undefined') {
  window.db = {
    classes: {},      // { 'Sınıf': [{id, no, ad, sinif}] }
    gradeBook: {},    // { studentId: { term: { yazili1:.., ... } } }
  };
}
if (!window.db.classes)   window.db.classes = {};
if (!window.db.gradeBook) window.db.gradeBook = {};

// Toast bildirimi — shared varsa onu kullan
function perfToast(msg, type, ms) {
  if (typeof window.klbToast === 'function') {
    window.klbToast(msg, type, ms);
    return;
  }
  // Stub toast
  let box = H('perf-toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'perf-toast-box';
    box.style.cssText =
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'z-index:999999;display:flex;flex-direction:column;gap:8px;align-items:center';
    document.body.appendChild(box);
  }
  const colors = {
    success: 'var(--green,#10b981)',
    error:   'var(--red,#ef4444)',
    info:    'var(--blue,#38a8d8)',
  };
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText =
    'background:var(--bg2,#142226);color:var(--text,#eaf3f4);' +
    'padding:11px 20px;border-radius:var(--r,10px);font-size:.85rem;' +
    'font-weight:600;box-shadow:var(--shadow,0 8px 32px rgba(0,0,0,.4));' +
    'border-left:3px solid ' + (colors[type] || colors.info);
  box.appendChild(t);
  setTimeout(() => t.remove(), ms || 3500);
}

// Veri kaydetme — shared varsa onu kullan
function perfSave() {
  if (typeof window.save === 'function') { window.save(); return; }
  if (typeof window.doaSave === 'function') { window.doaSave(); return; }
  // Bağımsız: localStorage
  try {
    localStorage.setItem('doa_perf_db', JSON.stringify({
      gradeBook: window.db.gradeBook,
    }));
  } catch (e) {
    perfToast('Kayıt başarısız: depolama dolu olabilir', 'error');
  }
}

// Veri yükleme (bağımsız mod)
function perfLoad() {
  if (typeof window.save === 'function') return; // shared yönetiyor
  try {
    const raw = localStorage.getItem('doa_perf_db');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.gradeBook) window.db.gradeBook = data.gradeBook;
    }
  } catch (e) { /* ilk çalıştırma */ }
}

// HTML kaçışı — XSS koruması
function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ──────────────────────────────────────────────────────────
   ÖĞRENCİ ENTEGRASYONU
   Öğrenci listesi 'ogrenciler' modülünden gelir (db.classes).
   Bu modül SADECE OKUR — öğrenci ekleme/silme ogrenciler modülünde.
   ────────────────────────────────────────────────────────── */

/** Tüm sınıfların adlarını döndürür. */
function perfGetClasses() {
  return Object.keys(window.db.classes || {}).sort();
}

/** Bir sınıftaki öğrencileri döndürür. */
function perfGetStudents(className) {
  return (window.db.classes[className] || []).slice();
}

/** Öğrenciye benzersiz id ata (yoksa). */
function perfEnsureStudentId(student, className) {
  if (!student.id) {
    student.id = 'st_' +
      (student.no || '0') + '_' +
      (className || '').replace(/\s+/g, '') + '_' +
      Math.random().toString(36).slice(2, 7);
  }
  return student.id;
}

/** id ile öğrenci bul (tüm sınıflarda ara). */
function perfFindStudent(studentId) {
  for (const cls of perfGetClasses()) {
    const found = (window.db.classes[cls] || [])
      .find(s => s.id === studentId);
    if (found) return { student: found, className: cls };
  }
  return null;
}

/**
 * Öğrenci listesi boş mu? — UI uyarısı için.
 * Boşsa kullanıcı 'ogrenciler' modülüne yönlendirilir.
 */
function perfHasStudents() {
  return perfGetClasses().some(c => perfGetStudents(c).length > 0);
}

/* ──────────────────────────────────────────────────────────
   AI SERVİSİ — Bağlantı katmanı
   Eski MAARIF_AI_WORKER fetch'lerinin doğru, hatasız hali.
   ────────────────────────────────────────────────────────── */

/**
 * Cloud-brain Maarif servisine istek atar.
 * Hata yönetimi: ağ hatası / sunucu hatası ayrı ele alınır.
 * @returns {Promise<object>} servis yanıtı
 */
async function perfAiRequest(endpointKey, payload) {
  const url = perfApiUrl(endpointKey);
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    throw new Error(
      'AI servisine ulaşılamadı. Cloud-brain çalışıyor mu? (' +
      window.PERF_CONFIG.aiBase + ')'
    );
  }
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json()).detail || ''; }
    catch (e) { detail = await resp.text(); }
    throw new Error('AI servisi hatası ' + resp.status + ': ' +
      String(detail).slice(0, 160));
  }
  return resp.json();
}

/** AI servisinin ayakta olup olmadığını kontrol eder. */
async function perfAiHealthCheck() {
  try {
    const url = perfApiUrl('health');
    const resp = await fetch(url);
    if (!resp.ok) return { ok: false };
    const data = await resp.json();
    return { ok: true, provider: data.active_provider };
  } catch (e) {
    return { ok: false };
  }
}

// İlk yükleme
perfLoad();
