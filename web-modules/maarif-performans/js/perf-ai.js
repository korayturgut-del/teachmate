/* ============================================================
   MAARİF PERFORMANS — AI DEĞERLENDİRME (perf-ai.js)
   BLOK 3/4: AI Maarif modalı + sınav okuma + bekleme animasyonu

   Eski HTML'deki maarifPhoto* ve exam* fonksiyonlarının
   temizlenmiş, bug'sız hali. AI mantığı cloud-brain Python
   servisine taşındı — buradan sadece çağrı yapılır.

   DÜZELTİLEN BUG'LAR:
   - MAARIF_AI_WORKER tanımsızdı → perfAiRequest() ile düzgün çağrı
   - maarifPhotoSaveResult'ta 'gt' tanımsızdı → düzeltildi
   - Çift save() çağrısı → tek çağrı
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   DÖA KELEBEK BEKLEME ANİMASYONU
   AI düşünürken gösterilir — markayı yansıtan kelebek işareti.
   ────────────────────────────────────────────────────────── */

/**
 * Marka bekleme ekranı açar (kanat çırpan kelebek + DÖA teal).
 * @param {string} title - ana mesaj
 * @param {string} sub - alt açıklama
 */
function perfShowWaiting(title, sub) {
  perfHideWaiting();
  const html =
'<div id="perf-waiting" class="perf-waiting">' +
  '<div class="perf-butterfly">' +
    // Kelebek SVG — kanatlar CSS ile çırpar
    '<svg viewBox="0 0 120 120" width="96" height="96">' +
      '<g class="perf-bf-wing perf-bf-wing-l">' +
        '<path d="M60 60 Q20 20 14 50 Q12 74 60 64 Z" ' +
          'fill="var(--accent,#14b8a6)" opacity="0.92"/>' +
        '<path d="M60 64 Q22 78 24 100 Q40 110 60 76 Z" ' +
          'fill="var(--blue,#38a8d8)" opacity="0.82"/>' +
      '</g>' +
      '<g class="perf-bf-wing perf-bf-wing-r">' +
        '<path d="M60 60 Q100 20 106 50 Q108 74 60 64 Z" ' +
          'fill="var(--accent,#14b8a6)" opacity="0.92"/>' +
        '<path d="M60 64 Q98 78 96 100 Q80 110 60 76 Z" ' +
          'fill="var(--blue,#38a8d8)" opacity="0.82"/>' +
      '</g>' +
      // Gövde
      '<ellipse cx="60" cy="66" rx="4" ry="20" fill="var(--text,#eaf3f4)"/>' +
      // Antenler
      '<path d="M60 48 Q54 36 48 34" stroke="var(--text,#eaf3f4)" ' +
        'stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M60 48 Q66 36 72 34" stroke="var(--text,#eaf3f4)" ' +
        'stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '</svg>' +
  '</div>' +
  '<div class="perf-waiting-title">' + escHtml(title || 'AI Düşünüyor') + '</div>' +
  '<div class="perf-waiting-sub">' + escHtml(sub || '') + '</div>' +
  '<div class="perf-waiting-dots"><span></span><span></span><span></span></div>' +
'</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function perfHideWaiting() {
  const w = H('perf-waiting');
  if (w) w.remove();
}

/* ──────────────────────────────────────────────────────────
   AI MAARİF DEĞERLENDİRME (sinifIciEtkinlik / ozDegerlendirme / proje)
   ────────────────────────────────────────────────────────── */

let _maarifActiveKey = null;
let _maarifPhotoBase64 = null;
let _maarifPendingResult = null;

const MAARIF_PLACEHOLDERS = {
  sinifIciEtkinlik: 'Örn: Grup çalışmasında lider rolü aldı, fikirlerini ' +
    'paylaştı, arkadaşlarını dinledi...',
  ozDegerlendirme: 'Örn: Öğrenci kendi gelişimini şöyle anlattı: "Bu konuyu ' +
    'zor bulmuştum ama tekrar ederek öğrendim..."',
  proje: 'Örn: Proje konusu, araştırma derinliği, sunum kalitesi, yaratıcılık...',
};

function maarifOpenEval(key) {
  if (!perfSelectedStudentId) { perfToast('Önce öğrenci seçin', 'error'); return; }
  const gt = GRADE_TYPES.find(g => g.key === key);
  if (!gt) return;

  _maarifActiveKey = key;
  _maarifPhotoBase64 = null;

  const html =
'<div id="perf-maarif-modal" class="perf-modal">' +
  '<div class="perf-modal-box" style="max-width:680px">' +
    '<div class="perf-modal-head" style="border-color:' + gt.color + '">' +
      '<span>' + gt.icon + ' ' + escHtml(gt.label) + ' — AI Maarif Değerlendirmesi</span>' +
      '<button class="perf-modal-x" onclick="maarifEvalClose()">✕</button>' +
    '</div>' +
    '<div class="perf-modal-body">' +
      '<div class="perf-info-box" style="border-color:' + gt.color + '">' +
        '<b style="color:' + gt.color + '">📌 Türkiye Yüzyılı Maarif Modeli</b><br>' +
        'AI, çalışmayı <b>Erdem-Değer-Eylem</b> çerçevesinde, <b>21 eğilim</b> ' +
        've Maarif Muallimi üslubuyla değerlendirir.' +
      '</div>' +
      // Fotoğraf
      '<label class="perf-label">1 · Fotoğraf Kanıt (opsiyonel)</label>' +
      '<div class="perf-upload" style="border-color:' + gt.color + '" ' +
        'onclick="document.getElementById(\'perf-maarif-photo\').click()">' +
        '<input type="file" id="perf-maarif-photo" accept="image/*" ' +
          'capture="environment" style="display:none" ' +
          'onchange="maarifPhotoPick(event)">' +
        '<div id="perf-maarif-photo-empty">' +
          '<div style="font-size:2rem">📷</div>' +
          '<div style="font-weight:700;color:' + gt.color + '">Fotoğraf Yükle / Çek</div>' +
        '</div>' +
        '<img id="perf-maarif-photo-preview" style="display:none;' +
          'max-width:100%;max-height:240px;border-radius:8px;margin-top:8px">' +
      '</div>' +
      // Gözlem
      '<label class="perf-label" style="margin-top:14px">' +
        '2 · Öğretmen Gözlemi</label>' +
      '<textarea id="perf-maarif-obs" class="perf-textarea" ' +
        'placeholder="' + escHtml(MAARIF_PLACEHOLDERS[key] || '') + '"></textarea>' +
      '<div class="perf-hint">Detaylı yazın — AI ne kadar bağlam alırsa ' +
        'o kadar isabetli yorumlar.</div>' +
    '</div>' +
    '<div class="perf-modal-foot">' +
      '<button class="btn btn-ghost" onclick="maarifEvalClose()" ' +
        'style="flex:1">İptal</button>' +
      '<button class="btn btn-primary" onclick="maarifEvalStart()" ' +
        'style="flex:2">🤖 AI Maarif Yorumu Yap</button>' +
    '</div>' +
  '</div>' +
'</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function maarifEvalClose() {
  const m = H('perf-maarif-modal');
  if (m) m.remove();
  _maarifActiveKey = null;
  _maarifPhotoBase64 = null;
}

function maarifPhotoPick(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    perfToast('Fotoğraf 10 MB\'tan büyük', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    _maarifPhotoBase64 = ev.target.result;
    const img = H('perf-maarif-photo-preview');
    const empty = H('perf-maarif-photo-empty');
    if (img) { img.src = ev.target.result; img.style.display = 'block'; }
    if (empty) empty.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function maarifEvalStart() {
  const obsEl = H('perf-maarif-obs');
  const obs = obsEl ? obsEl.value.trim() : '';

  if (!obs && !_maarifPhotoBase64) {
    perfToast('En az gözlem yazın veya fotoğraf ekleyin', 'error');
    return;
  }

  const key = _maarifActiveKey;
  const gt = GRADE_TYPES.find(g => g.key === key);
  const found = perfFindStudent(perfSelectedStudentId);
  const studentName = found ? found.student.ad : 'Öğrenci';

  maarifEvalClose();
  perfShowWaiting('Maarif Muallimi Değerlendiriyor',
    'EDE çerçevesi · 21 eğilim · şefkatli rehberlik');

  try {
    const result = await perfAiRequest('evaluate', {
      grade_type: key,
      observation: obs,
      student_name: studentName,
      image_base64: _maarifPhotoBase64,
    });
    perfHideWaiting();
    maarifShowResult(result, key, obs);
  } catch (err) {
    perfHideWaiting();
    perfToast(err.message, 'error', 6000);
  }
}

function maarifShowResult(data, key, obs) {
  const gt = GRADE_TYPES.find(g => g.key === key);
  const score = data.score_100 || 70;
  const sc = gradeColor(score);

  // Etiketleri topla
  const maarif = data.maarif || {};
  let tags = [];
  (maarif.cati_degerler || []).forEach(t => tags.push({ t: t, c: '#a855f7' }));
  const eg = maarif.egilimler || {};
  (eg.entelektuel || []).forEach(t => tags.push({ t: t, c: 'var(--blue)' }));
  (eg.sosyal || []).forEach(t => tags.push({ t: t, c: '#06b6d4' }));
  (eg.benlik || []).forEach(t => tags.push({ t: t, c: 'var(--green)' }));
  (maarif.beceriler || []).forEach(t => tags.push({ t: t, c: 'var(--amber)' }));

  const tagsHtml = tags.map(x =>
    '<span class="perf-tag" style="border-color:' + x.c + ';color:' + x.c + '">' +
    escHtml(x.t) + '</span>').join('');

  const block = (title, text, color) => {
    if (!text) return '';
    return '<div class="perf-result-block" style="border-color:' + color + '">' +
      '<div class="perf-result-title" style="color:' + color + '">' + title + '</div>' +
      '<div class="perf-result-text">' + escHtml(text) + '</div></div>';
  };

  const html =
'<div id="perf-maarif-result" class="perf-modal perf-modal-full">' +
  '<div class="perf-modal-head" style="border-color:' + gt.color + '">' +
    '<span>' + gt.icon + ' Maarif Muallimi Değerlendirmesi — ' +
      escHtml(gt.label) + '</span>' +
    '<div style="display:flex;align-items:center;gap:12px">' +
      '<span class="perf-result-score" style="color:' + sc + '">' +
        score + '<small>/100</small></span>' +
      '<button class="perf-modal-x" onclick="maarifResultClose()">✕</button>' +
    '</div>' +
  '</div>' +
  '<div class="perf-detail-body">' +
    '<div class="perf-detail-inner">' +
      // Sağlayıcı rozeti
      '<div class="perf-provider-badge">⚙️ Değerlendirme: ' +
        escHtml(data.provider || 'rubric') + '</div>' +
      block('🌸 Maarif Muallimi Yorumu', data.maarif_muallimi_yorumu, '#a855f7') +
      (tagsHtml ? '<div class="perf-result-block" style="border-color:#a855f7">' +
        '<div class="perf-result-title" style="color:#a855f7">' +
          'Tespit Edilen Eğilim ve Değerler</div>' +
        '<div>' + tagsHtml + '</div></div>' : '') +
      block('✨ Güçlü Yönler', data.guclu_yonler, 'var(--green)') +
      block('🌱 Gelişim Alanları', data.gelisim_alanlari, 'var(--amber)') +
      block('💭 Yansıtıcı Sorular', data.yansitici_sorular, 'var(--blue)') +
      block('💌 Öğrenciye Mesaj', data.feedback_for_student, '#a855f7') +
      // Düzenlenebilir not
      '<div class="perf-result-block" style="border-color:' + sc + '">' +
        '<div class="perf-result-title" style="color:' + sc + '">' +
          '📝 Not (düzenleyebilirsiniz)</div>' +
        '<input type="number" id="perf-final-score" min="0" max="100" ' +
          'value="' + score + '" class="perf-input perf-input-big" ' +
          'style="border-color:' + sc + '">' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="perf-modal-foot">' +
    '<button class="btn btn-ghost" onclick="maarifResultClose()" ' +
      'style="flex:1">Kapat</button>' +
    '<button class="btn btn-success" onclick="maarifResultSave()" ' +
      'style="flex:2">✓ Notu Kaydet</button>' +
  '</div>' +
'</div>';

  _maarifPendingResult = { data: data, key: key, obs: obs, score: score };
  document.body.insertAdjacentHTML('beforeend', html);
}

function maarifResultClose() {
  const m = H('perf-maarif-result');
  if (m) m.remove();
  _maarifPendingResult = null;
}

function maarifResultSave() {
  const pending = _maarifPendingResult;
  if (!pending || !perfSelectedStudentId) return;

  // BUG DÜZELTME: eski kodda 'gt' tanımsızdı — burada düzgün alınıyor
  const gt = GRADE_TYPES.find(g => g.key === pending.key);

  const scoreEl = H('perf-final-score');
  const finalScore = parseInt(scoreEl ? scoreEl.value : '', 10);
  if (isNaN(finalScore) || finalScore < 0 || finalScore > 100) {
    perfToast('Not 0-100 arası olmalı', 'error');
    return;
  }

  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);
  grades[pending.key] = finalScore;
  grades[pending.key + '_ai'] = {
    source: 'ai_maarif',
    date: new Date().toISOString(),
    aiScore: pending.score,
    finalScore: finalScore,
    observation: pending.obs,
    maarifData: pending.data,
  };

  perfSave();  // BUG DÜZELTME: tek çağrı (eski kodda çift vardı)
  maarifResultClose();
  gradeBookRender();
  perfToast('✅ ' + (gt ? gt.label : 'Not') + ' kaydedildi: ' + finalScore,
    'success', 4000);
}

/* ──────────────────────────────────────────────────────────
   AI SINAV OKUMA (yazili1 / yazili2)
   ────────────────────────────────────────────────────────── */

let _examKey = null;
let _examQuestions = [];
let _examImageBase64 = null;
let _examResult = null;

function examOpenSetup(key) {
  if (!perfSelectedStudentId) { perfToast('Önce öğrenci seçin', 'error'); return; }
  _examKey = key;
  _examQuestions = [
    { num: 1, soru: '', cevap: '', puan: 25 },
    { num: 2, soru: '', cevap: '', puan: 25 },
    { num: 3, soru: '', cevap: '', puan: 25 },
    { num: 4, soru: '', cevap: '', puan: 25 },
  ];
  _examImageBase64 = null;

  const html =
'<div id="perf-exam-modal" class="perf-modal perf-modal-full">' +
  '<div class="perf-modal-head" style="border-color:var(--blue)">' +
    '<span>📷 Sınav AI Okuma</span>' +
    '<button class="perf-modal-x" onclick="examClose()">✕</button>' +
  '</div>' +
  '<div class="perf-detail-body">' +
    '<div class="perf-detail-inner">' +
      '<label class="perf-label">1 · Sınav Kağıdı Fotoğrafı</label>' +
      '<div class="perf-upload" style="border-color:var(--blue)" ' +
        'onclick="document.getElementById(\'perf-exam-photo\').click()">' +
        '<input type="file" id="perf-exam-photo" accept="image/*" ' +
          'capture="environment" style="display:none" ' +
          'onchange="examPhotoPick(event)">' +
        '<div id="perf-exam-photo-empty">' +
          '<div style="font-size:2.2rem">📷</div>' +
          '<div style="font-weight:700;color:var(--blue)">Fotoğraf Yükle / Çek</div>' +
          '<div class="perf-hint">Dik açı · iyi ışık · max 10 MB</div>' +
        '</div>' +
        '<img id="perf-exam-photo-preview" style="display:none;' +
          'max-width:100%;max-height:280px;border-radius:8px;margin-top:8px">' +
      '</div>' +
      '<div class="perf-exam-q-head">' +
        '<label class="perf-label" style="margin:0">2 · Sorular ve Cevaplar</label>' +
        '<button class="btn btn-ghost btn-sm" onclick="examAddQ()">+ Soru</button>' +
      '</div>' +
      '<div id="perf-exam-questions"></div>' +
    '</div>' +
  '</div>' +
  '<div class="perf-modal-foot">' +
    '<button class="btn btn-ghost" onclick="examClose()" style="flex:1">İptal</button>' +
    '<button class="btn btn-primary" onclick="examStart()" style="flex:2">' +
      '🤖 AI ile Oku</button>' +
  '</div>' +
'</div>';
  document.body.insertAdjacentHTML('beforeend', html);
  examRenderQuestions();
}

function examClose() {
  const m = H('perf-exam-modal');
  if (m) m.remove();
  _examKey = null;
}

function examRenderQuestions() {
  const cont = H('perf-exam-questions');
  if (!cont) return;
  cont.innerHTML = _examQuestions.map((q, i) =>
    '<div class="perf-exam-q">' +
      '<div class="perf-exam-q-top">' +
        '<b>Soru ' + q.num + '</b>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<input type="number" value="' + q.puan + '" min="0" max="100" ' +
            'class="perf-input perf-input-sm" ' +
            'onchange="examUpdateQ(' + i + ',\'puan\',this.value)"> puan' +
          (_examQuestions.length > 1 ?
            '<button class="perf-card-x" onclick="examRemoveQ(' + i + ')">✕</button>'
            : '') +
        '</div>' +
      '</div>' +
      '<input type="text" value="' + escHtml(q.soru) + '" ' +
        'placeholder="Soru metni" class="perf-input" ' +
        'oninput="examUpdateQ(' + i + ',\'soru\',this.value)">' +
      '<input type="text" value="' + escHtml(q.cevap) + '" ' +
        'placeholder="Doğru cevap" class="perf-input" ' +
        'style="margin-top:6px" ' +
        'oninput="examUpdateQ(' + i + ',\'cevap\',this.value)">' +
    '</div>').join('');
}

function examAddQ() {
  _examQuestions.push({
    num: _examQuestions.length + 1, soru: '', cevap: '', puan: 10,
  });
  examRenderQuestions();
}

function examRemoveQ(i) {
  _examQuestions.splice(i, 1);
  _examQuestions.forEach((q, idx) => { q.num = idx + 1; });
  examRenderQuestions();
}

function examUpdateQ(i, field, value) {
  if (!_examQuestions[i]) return;
  _examQuestions[i][field] = (field === 'puan') ?
    (parseInt(value, 10) || 0) : value;
}

function examPhotoPick(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    perfToast('Fotoğraf 10 MB\'tan büyük', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    _examImageBase64 = ev.target.result;
    const img = H('perf-exam-photo-preview');
    const empty = H('perf-exam-photo-empty');
    if (img) { img.src = ev.target.result; img.style.display = 'block'; }
    if (empty) empty.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function examStart() {
  const validQs = _examQuestions.filter(q => q.soru.trim());
  if (validQs.length === 0) {
    perfToast('En az bir soru girin', 'error');
    return;
  }

  const found = perfFindStudent(perfSelectedStudentId);
  const studentName = found ? found.student.ad : 'Öğrenci';

  examClose();
  perfShowWaiting('AI Sınav Kağıdını Okuyor',
    'Soru tespiti · cevap eşleştirme · puanlama');

  try {
    const result = await perfAiRequest('exam', {
      questions: validQs,
      image_base64: _examImageBase64,
      student_name: studentName,
    });
    perfHideWaiting();
    examShowResult(result);
  } catch (err) {
    perfHideWaiting();
    perfToast(err.message, 'error', 6000);
  }
}

function examShowResult(data) {
  _examResult = data;
  const findings = data.findings || [];
  const total = data.total_score || 0;
  const max = data.max_score || 100;
  const percent = data.percent != null ? data.percent :
    (max ? Math.round(total / max * 100) : 0);
  const sc = gradeColor(percent);

  const findingsHtml = findings.map(f => {
    const q = _examQuestions.find(qq => String(qq.num) === String(f.questionId))
      || { puan: 10, soru: '' };
    const earned = f.score || 0;
    const ec = gradeColor(earned >= q.puan * 0.85 ? 90 :
      earned >= q.puan * 0.4 ? 65 : 30);
    return '<div class="perf-finding">' +
      '<div class="perf-finding-top">' +
        '<b style="color:var(--blue)">Soru ' + (f.questionId || '?') + '</b>' +
        '<span style="font-weight:800;color:' + ec + '">' +
          earned + '/' + q.puan + ' p</span>' +
      '</div>' +
      (q.soru ? '<div class="perf-finding-q">📝 ' + escHtml(q.soru) + '</div>' : '') +
      '<div class="perf-finding-ans">📖 Öğrenci yazdı: "' +
        escHtml(f.ocrText || '(okunamadı)') + '"</div>' +
      (f.critique ? '<div class="perf-finding-note">🧑‍🏫 ' +
        escHtml(f.critique) + '</div>' : '') +
    '</div>';
  }).join('');

  const html =
'<div id="perf-exam-result" class="perf-modal perf-modal-full">' +
  '<div class="perf-modal-head" style="border-color:var(--blue)">' +
    '<span>📷 Sınav Sonucu — ' + escHtml(data.studentName || 'Öğrenci') + '</span>' +
    '<div style="display:flex;align-items:center;gap:12px">' +
      '<span class="perf-result-score" style="color:' + sc + '">' +
        percent + '<small>/100</small></span>' +
      '<button class="perf-modal-x" onclick="examResultClose()">✕</button>' +
    '</div>' +
  '</div>' +
  '<div class="perf-detail-body">' +
    '<div class="perf-detail-inner">' +
      '<div class="perf-provider-badge">⚙️ ' +
        escHtml(data.provider || 'manual') + ' · ' +
        total + '/' + max + ' ham puan</div>' +
      (data.overall_feedback ?
        '<div class="perf-result-block" style="border-color:var(--blue)">' +
        '<div class="perf-result-text">' + escHtml(data.overall_feedback) +
        '</div></div>' : '') +
      findingsHtml +
    '</div>' +
  '</div>' +
  '<div class="perf-modal-foot">' +
    '<button class="btn btn-ghost" onclick="examResultClose()" ' +
      'style="flex:1">Kapat</button>' +
    '<button class="btn btn-success" onclick="examResultSave()" ' +
      'style="flex:2">✓ Notu Kaydet (' + percent + ')</button>' +
  '</div>' +
'</div>';

  _examResult.percent = percent;
  document.body.insertAdjacentHTML('beforeend', html);
}

function examResultClose() {
  const m = H('perf-exam-result');
  if (m) m.remove();
  _examResult = null;
}

function examResultSave() {
  if (!_examResult || !perfSelectedStudentId || !_examKey) return;
  const term = gradeBookGetTerm();
  const grades = gradeBookGet(perfSelectedStudentId, term);
  const percent = _examResult.percent;

  grades[_examKey] = percent;
  grades[_examKey + '_ai'] = {
    source: 'ai',
    date: new Date().toISOString(),
    totalScore: _examResult.total_score,
    maxScore: _examResult.max_score,
    findings: _examResult.findings,
    overall_feedback: _examResult.overall_feedback,
  };

  perfSave();
  const gt = GRADE_TYPES.find(g => g.key === _examKey);
  examResultClose();
  examClose();
  gradeBookRender();
  perfToast('✅ ' + (gt ? gt.label : 'Sınav') + ' kaydedildi: ' + percent,
    'success', 4000);
}

// Global erişim
window.maarifOpenEval = maarifOpenEval;
window.maarifEvalClose = maarifEvalClose;
window.maarifPhotoPick = maarifPhotoPick;
window.maarifEvalStart = maarifEvalStart;
window.maarifResultClose = maarifResultClose;
window.maarifResultSave = maarifResultSave;
window.examOpenSetup = examOpenSetup;
window.examClose = examClose;
window.examAddQ = examAddQ;
window.examRemoveQ = examRemoveQ;
window.examUpdateQ = examUpdateQ;
window.examPhotoPick = examPhotoPick;
window.examStart = examStart;
window.examResultClose = examResultClose;
window.examResultSave = examResultSave;
