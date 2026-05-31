/* ============================================================
   MAARİF PERFORMANS — NOT DEFTERİ (perf-gradebook.js)
   BLOK 2/4: GRADE_TYPES, not kartları, manuel puanlama, müfettiş detayı

   Eski HTML'deki gradeBook* fonksiyonlarının temizlenmiş,
   DÖA tasarımına uyarlanmış hali. Özellik kaybı yok.
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   DEĞERLENDİRME TÜRLERİ
   Veri yapısı: db.gradeBook[studentId][term] = {yazili1:85, ...}
   ────────────────────────────────────────────────────────── */
const GRADE_TYPES = [
  { key: 'yazili1', label: '1. Yazılı', icon: '📝', color: 'var(--blue)',
    desc: 'AI ile sınav kağıdı okutulabilir', mode: 'exam' },
  { key: 'yazili2', label: '2. Yazılı', icon: '📝', color: 'var(--blue)',
    desc: 'AI ile sınav kağıdı okutulabilir', mode: 'exam' },
  { key: 'sinifIciEtkinlik', label: 'Sınıf İçi Etkinlik', icon: '🎭',
    color: '#06b6d4', desc: 'Etkinlik fotoğrafı + AI gözlem', mode: 'maarif' },
  { key: 'ozDegerlendirme', label: 'Öz Değerlendirme', icon: '🪞',
    color: 'var(--green)', desc: 'Öğrenci yansıtma formu', mode: 'maarif' },
  { key: 'proje', label: 'Dönem Projesi', icon: '🎨', color: 'var(--amber)',
    desc: 'Proje sunumu + AI değerlendirme', mode: 'maarif' },
];

// Aktif seçili öğrenci
let perfSelectedStudentId = null;

/* ──────────────────────────────────────────────────────────
   NOT DEFTERİ VERİ ERİŞİMİ
   ────────────────────────────────────────────────────────── */

function gradeBookGetTerm() {
  const t = H('perf-term');
  return t ? t.value : window.PERF_CONFIG.currentTerm;
}

function gradeBookGet(studentId, term) {
  if (!window.db.gradeBook[studentId]) window.db.gradeBook[studentId] = {};
  if (!window.db.gradeBook[studentId][term]) {
    window.db.gradeBook[studentId][term] = {};
  }
  return window.db.gradeBook[studentId][term];
}

/** Puana göre renk — düşük kırmızı, yüksek yeşil. */
function gradeColor(value) {
  if (value < 50) return 'var(--red)';
  if (value < 70) return 'var(--amber)';
  if (value < 85) return 'var(--blue)';
  return 'var(--green)';
}

/* ──────────────────────────────────────────────────────────
   NOT KARTLARI RENDER
   ────────────────────────────────────────────────────────── */

function gradeBookRender() {
  const grid = H('perf-grade-grid');
  const avgEl = H('perf-grade-avg');
  if (!grid) return;

  if (!perfSelectedStudentId) {
    grid.innerHTML =
      '<div class="perf-empty">👈 Soldan bir öğrenci seçin</div>';
    if (avgEl) avgEl.style.display = 'none';
    return;
  }

  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);

  grid.innerHTML = GRADE_TYPES.map(gt => {
    const value = grades[gt.key];
    const hasValue = (typeof value === 'number');
    const aiInfo = grades[gt.key + '_ai'];

    let valueHtml;
    if (hasValue) {
      const vc = gradeColor(value);
      valueHtml = '<div class="perf-card-score" style="color:' + vc + '">' +
        value + '</div>';
      if (aiInfo) {
        const srcLabel = aiInfo.source === 'ai_maarif' ? '🤖 AI Maarif'
          : aiInfo.source === 'ai' ? '📷 AI Sınav'
          : aiInfo.source === 'manuel' ? '✏️ Manuel' : '';
        valueHtml += '<div class="perf-card-src">' + srcLabel + '</div>';
      }
    } else {
      valueHtml = '<div class="perf-card-score perf-card-empty">—</div>';
    }

    // Aksiyon butonları — DÖA buton stili
    let actions = '';
    if (hasValue) {
      actions += '<button class="btn btn-ghost btn-sm" ' +
        'onclick="gradeBookShowDetail(\'' + gt.key + '\')">📋 Detay</button>';
    }
    if (gt.mode === 'exam') {
      actions += '<button class="btn btn-primary btn-sm" ' +
        'onclick="examOpenSetup(\'' + gt.key + '\')">📷 AI Sınav Oku</button>';
    } else {
      actions += '<button class="btn btn-primary btn-sm" ' +
        'onclick="maarifOpenEval(\'' + gt.key + '\')">🤖 AI Maarif Yorumu</button>';
    }
    actions += '<button class="btn btn-ghost btn-sm" ' +
      'onclick="gradeManualOpen(\'' + gt.key + '\')">' +
      (hasValue ? '✏️ Düzenle' : '✏️ Manuel Gir') + '</button>';

    return '' +
      '<div class="perf-card" style="border-color:' + gt.color + '">' +
        '<div class="perf-card-head">' +
          '<span class="perf-card-icon">' + gt.icon + '</span>' +
          '<span class="perf-card-label" style="color:' + gt.color + '">' +
            gt.label + '</span>' +
          (hasValue ? '<button class="perf-card-x" ' +
            'onclick="gradeBookClear(\'' + gt.key + '\')" title="Sil">✕</button>' : '') +
        '</div>' +
        '<div class="perf-card-body">' + valueHtml + '</div>' +
        '<div class="perf-card-actions">' + actions + '</div>' +
      '</div>';
  }).join('');

  // Dönem ortalaması
  const values = GRADE_TYPES
    .map(gt => grades[gt.key])
    .filter(v => typeof v === 'number');

  if (avgEl) {
    if (values.length > 0) {
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      const full = values.length === GRADE_TYPES.length;
      avgEl.innerHTML =
        '<div class="perf-avg-row">' +
          '<span class="perf-avg-label">📊 Dönem Ortalaması (' +
            values.length + '/' + GRADE_TYPES.length + ' not)</span>' +
          '<span class="perf-avg-value" style="color:' + gradeColor(avg) + '">' +
            avg + '</span>' +
        '</div>' +
        '<div class="perf-avg-note">' +
          (full ? '✓ Tüm notlar girildi'
                : '⚠️ Eksik notlar var — kısmi ortalama') +
        '</div>';
      avgEl.style.display = 'block';
    } else {
      avgEl.style.display = 'none';
    }
  }
}

/** Bir notu sil. */
function gradeBookClear(key) {
  if (!perfSelectedStudentId) return;
  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);
  if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
  delete grades[key];
  delete grades[key + '_ai'];
  perfSave();
  gradeBookRender();
  perfToast('Not silindi', 'info');
}

/* ──────────────────────────────────────────────────────────
   MANUEL PUAN GİRİŞİ
   ────────────────────────────────────────────────────────── */

function gradeManualOpen(key) {
  if (!perfSelectedStudentId) { perfToast('Önce öğrenci seçin', 'error'); return; }
  const gt = GRADE_TYPES.find(g => g.key === key);
  if (!gt) return;

  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);
  const current = (typeof grades[key] === 'number') ? grades[key] : '';
  const aiInfo = grades[key + '_ai'] || {};
  const currentObs = aiInfo.observation || '';

  const html =
'<div id="perf-manual-modal" class="perf-modal">' +
  '<div class="perf-modal-box" style="max-width:480px">' +
    '<div class="perf-modal-head" style="border-color:' + gt.color + '">' +
      '<span>' + gt.icon + ' ' + escHtml(gt.label) + ' — Manuel Not</span>' +
      '<button class="perf-modal-x" onclick="gradeManualClose()">✕</button>' +
    '</div>' +
    '<div class="perf-modal-body">' +
      '<label class="perf-label">Puan (0-100)</label>' +
      '<input type="number" id="perf-manual-score" min="0" max="100" ' +
        'value="' + current + '" class="perf-input perf-input-big" ' +
        'style="border-color:' + gt.color + '">' +
      '<label class="perf-label" style="margin-top:14px">' +
        'Gözlem / Not (opsiyonel)</label>' +
      '<textarea id="perf-manual-obs" class="perf-textarea" ' +
        'placeholder="Öğrenci hakkında gözleminizi yazın...">' +
        escHtml(currentObs) + '</textarea>' +
    '</div>' +
    '<div class="perf-modal-foot">' +
      '<button class="btn btn-ghost" onclick="gradeManualClose()" ' +
        'style="flex:1">İptal</button>' +
      '<button class="btn btn-success" onclick="gradeManualSave(\'' + key + '\')" ' +
        'style="flex:2">✓ Kaydet</button>' +
    '</div>' +
  '</div>' +
'</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function gradeManualClose() {
  const m = H('perf-manual-modal');
  if (m) m.remove();
}

function gradeManualSave(key) {
  const scoreEl = H('perf-manual-score');
  const obsEl = H('perf-manual-obs');
  const score = parseInt(scoreEl ? scoreEl.value : '', 10);

  if (isNaN(score) || score < 0 || score > 100) {
    perfToast('Puan 0-100 arası olmalı', 'error');
    return;
  }

  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);
  grades[key] = score;
  grades[key + '_ai'] = {
    source: 'manuel',
    date: new Date().toISOString(),
    observation: obsEl ? obsEl.value.trim() : '',
  };

  perfSave();
  gradeManualClose();
  gradeBookRender();
  const gt = GRADE_TYPES.find(g => g.key === key);
  perfToast('✅ ' + (gt ? gt.label : 'Not') + ' kaydedildi: ' + score, 'success');
}

/* ──────────────────────────────────────────────────────────
   MÜFETTİŞ DETAY RAPORU
   AI değerlendirme + manuel gözlem tek ekranda.
   ────────────────────────────────────────────────────────── */

function gradeBookShowDetail(key) {
  if (!perfSelectedStudentId) return;
  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);
  const value = grades[key];
  const aiInfo = grades[key + '_ai'] || {};
  const gt = GRADE_TYPES.find(g => g.key === key);
  const found = perfFindStudent(perfSelectedStudentId);
  const student = found ? found.student : {};

  // Maarif verisi (AI'dan geldiyse)
  const m = aiInfo.maarifData || {};
  const maarif = m.maarif || {};
  const cati = maarif.cati_degerler || [];
  const eEnt = (maarif.egilimler || {}).entelektuel || [];
  const eSos = (maarif.egilimler || {}).sosyal || [];
  const eBen = (maarif.egilimler || {}).benlik || [];
  const beceri = maarif.beceriler || [];

  const tagRow = (label, items, color) => {
    if (!items || !items.length) return '';
    return '<div class="perf-tag-group">' +
      '<div class="perf-tag-title" style="color:' + color + '">' + label + '</div>' +
      '<div>' + items.map(t =>
        '<span class="perf-tag" style="border-color:' + color +
        ';color:' + color + '">' + escHtml(t) + '</span>').join('') +
      '</div></div>';
  };

  const section = (title, content, color) => {
    if (!content) return '';
    return '<div class="perf-detail-section" style="border-color:' + color + '">' +
      '<div class="perf-detail-title" style="color:' + color + '">' + title + '</div>' +
      '<div class="perf-detail-text">' + escHtml(content) + '</div></div>';
  };

  const srcLabel = aiInfo.source === 'ai_maarif' ? '🤖 AI Maarif'
    : aiInfo.source === 'ai' ? '📷 AI Sınav'
    : aiInfo.source === 'manuel' ? '✏️ Manuel' : '—';

  const html =
'<div id="perf-detail-modal" class="perf-modal perf-modal-full">' +
  '<div class="perf-detail-head" style="border-color:' + gt.color + '">' +
    '<div class="perf-detail-head-left">' +
      '<div class="perf-detail-icon" style="background:' + gt.color + '">' +
        gt.icon + '</div>' +
      '<div>' +
        '<div class="perf-detail-kicker">Müfettiş Detay Raporu</div>' +
        '<div class="perf-detail-name" style="color:' + gt.color + '">' +
          escHtml(gt.label) + ' • ' + escHtml(student.ad || '') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="perf-detail-head-right">' +
      '<div class="perf-detail-score" style="color:' + gradeColor(value) + '">' +
        value + '<span>/100</span></div>' +
      '<div class="perf-detail-src">' + srcLabel + '</div>' +
      '<button class="perf-modal-x" onclick="gradeDetailClose()">✕</button>' +
    '</div>' +
  '</div>' +
  '<div class="perf-detail-body">' +
    '<div class="perf-detail-inner">' +
      // Bilgi kartı
      '<div class="perf-detail-info">' +
        '<div><b>Öğrenci:</b> ' + escHtml(student.ad || '—') + '</div>' +
        '<div><b>No:</b> ' + escHtml(student.no || '—') + '</div>' +
        '<div><b>Sınıf:</b> ' + escHtml(found ? found.className : '—') + '</div>' +
        '<div><b>Dönem:</b> ' + escHtml(term) + '</div>' +
        (aiInfo.date ? '<div><b>Tarih:</b> ' +
          new Date(aiInfo.date).toLocaleString('tr-TR') + '</div>' : '') +
      '</div>' +
      // Öğretmen gözlemi
      section('👁️ Öğretmen Gözlemi', aiInfo.observation, '#06b6d4') +
      // Maarif Muallimi yorumu
      section('🌸 Maarif Muallimi Yorumu', m.maarif_muallimi_yorumu, '#a855f7') +
      // Maarif etiketleri
      ((cati.length || eEnt.length || eSos.length || eBen.length || beceri.length) ?
        '<div class="perf-detail-section" style="border-color:#a855f7">' +
          '<div class="perf-detail-title" style="color:#a855f7">' +
            '🏛️ Maarif Modeli Çerçevesi</div>' +
          tagRow('🔱 Çatı Değerler', cati, '#a855f7') +
          tagRow('🧠 Entelektüel Eğilimler', eEnt, 'var(--blue)') +
          tagRow('👥 Sosyal Eğilimler', eSos, '#06b6d4') +
          tagRow('🌱 Benlik Eğilimleri', eBen, 'var(--green)') +
          tagRow('🎯 Beceriler', beceri, 'var(--amber)') +
        '</div>' : '') +
      // Güçlü yönler / gelişim / yansıtıcı / öğrenci mesajı
      section('✨ Güçlü Yönler', m.guclu_yonler, 'var(--green)') +
      section('🌱 Gelişim Alanları', m.gelisim_alanlari, 'var(--amber)') +
      section('💭 Yansıtıcı Sorular', m.yansitici_sorular, 'var(--blue)') +
      section('💌 Öğrenciye Mesaj', m.feedback_for_student, '#a855f7') +
    '</div>' +
  '</div>' +
'</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function gradeDetailClose() {
  const m = H('perf-detail-modal');
  if (m) m.remove();
}

// Global erişim (onclick için)
window.gradeBookRender = gradeBookRender;
window.gradeBookClear = gradeBookClear;
window.gradeBookShowDetail = gradeBookShowDetail;
window.gradeManualOpen = gradeManualOpen;
window.gradeManualClose = gradeManualClose;
window.gradeManualSave = gradeManualSave;
window.gradeDetailClose = gradeDetailClose;
