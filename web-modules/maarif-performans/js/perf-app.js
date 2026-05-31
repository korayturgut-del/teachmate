/* ============================================================
   MAARİF PERFORMANS — UYGULAMA (perf-app.js)
   BLOK 4/4: Öğrenci seçim paneli + dönem seçici + başlatma

   Öğrenci listesi 'ogrenciler' modülünden gelir (db.classes).
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   ÖĞRENCİ SEÇİM PANELİ
   ────────────────────────────────────────────────────────── */

function perfRenderClassSelect() {
  const sel = H('perf-class');
  if (!sel) return;
  const classes = perfGetClasses();

  if (classes.length === 0) {
    sel.innerHTML = '<option value="">Sınıf yok</option>';
    return;
  }
  sel.innerHTML = classes
    .map(c => '<option value="' + escHtml(c) + '">' + escHtml(c) +
      ' (' + perfGetStudents(c).length + ')</option>')
    .join('');
  perfRenderStudentList();
}

function perfRenderStudentList() {
  const sel = H('perf-class');
  const list = H('perf-student-list');
  if (!sel || !list) return;

  const className = sel.value;
  const students = perfGetStudents(className);

  if (students.length === 0) {
    list.innerHTML =
      '<div class="perf-empty">' +
        'Bu sınıfta öğrenci yok.<br>' +
        '<a href="../ogrenciler/index.html" class="perf-link">' +
          '👥 Öğrenciler modülüne git</a>' +
      '</div>';
    return;
  }

  list.innerHTML = students.map(s => {
    perfEnsureStudentId(s, className);
    const active = (s.id === perfSelectedStudentId);
    return '<div class="perf-student-item' + (active ? ' active' : '') + '" ' +
      'onclick="perfSelectStudent(\'' + s.id + '\')">' +
      '<span class="perf-student-no">' + escHtml(s.no || '—') + '</span>' +
      '<span class="perf-student-name">' + escHtml(s.ad || 'İsimsiz') + '</span>' +
    '</div>';
  }).join('');
}

function perfSelectStudent(studentId) {
  perfSelectedStudentId = studentId;
  perfRenderStudentList();
  gradeBookRender();
}

/* ──────────────────────────────────────────────────────────
   BAŞLATMA
   ────────────────────────────────────────────────────────── */

function perfInit() {
  // Sınıf seçici değişince öğrenci listesi yenilensin
  const classSel = H('perf-class');
  if (classSel) {
    classSel.addEventListener('change', () => {
      perfSelectedStudentId = null;
      perfRenderStudentList();
      gradeBookRender();
    });
  }

  // Dönem seçici değişince not defteri yenilensin
  const termSel = H('perf-term');
  if (termSel) {
    termSel.value = window.PERF_CONFIG.currentTerm;
    termSel.addEventListener('change', gradeBookRender);
  }

  perfRenderClassSelect();
  gradeBookRender();

  // AI servis durumunu kontrol et — rozet göster
  perfAiHealthCheck().then(status => {
    const badge = H('perf-ai-status');
    if (!badge) return;
    if (status.ok) {
      badge.textContent = '🟢 AI: ' + (status.provider || 'hazır');
      badge.className = 'perf-ai-badge online';
    } else {
      badge.textContent = '🔴 AI servisi kapalı';
      badge.className = 'perf-ai-badge offline';
      badge.title = 'Cloud-brain çalışmıyor. AI özellikleri için ' +
        'cloud-brain başlatın: ' + window.PERF_CONFIG.aiBase;
    }
  });
}

// Sayfa hazır olunca başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', perfInit);
} else {
  perfInit();
}

// Global erişim
window.perfSelectStudent = perfSelectStudent;
window.perfRenderClassSelect = perfRenderClassSelect;
