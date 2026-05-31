# Dijital Öğretmen Asistanı — Event Kataloğu (FROZEN)

> Phase 2.5: TemplateVersionCreated ve StudentMatchRejected eklendi.
> Tüm yeni event'ler mevcut 5 aggregate'e (`exam, student, grade, scan, mobile_capture`) sığıyor.
> AGGREGATES seti değişmedi — Architecture Freeze korundu.

---

## MASAÜSTÜ — SORU KAĞIDI HAZIRLAMA

```
ExamCreated
  aggregate: exam
  payload: { exam_id, title, subject, total_questions, max_score }

ExamConfigured
  aggregate: exam
  payload: { exam_id, question_distribution, sections, settings }

QRCodeGenerated
  aggregate: exam
  payload: { exam_id, qr_id, qr_payload, qr_image_ref }

TemplateVersionCreated ⬅ Phase 2.5 (ADR-015)
  aggregate: exam
  payload: { exam_id, version, parent_version, version_hash, changes_summary, qr_payload }

TemplatePrinted
  aggregate: exam
  payload: { exam_id, version, copies, printer_settings }
```

## MASAÜSTÜ — ADF TOPLU TARAMA

```
ScanSessionStarted
  aggregate: scan
  payload: { session_id, total_pages, device_type }

PageScanned
  aggregate: scan
  payload: { session_id, page_no, image_ref, width, height, file_size_kb }

QRDetected
  aggregate: scan
  payload: { session_id, qr_data, qr_type, page_no }

StudentMatched
  aggregate: student
  payload: { session_id, student_id, student_name, match_confidence }

StudentMatchRejected ⬅ Phase 2.5 (MANTIK-HATASI-2)
  aggregate: student
  payload: { scan_id, reason, attempted_match, page_image_ref, resolved_by }

QuestionCropped
  aggregate: scan
  payload: { session_id, count, bboxes, page_no }

ImageEnhanced
  aggregate: scan
  payload: { session_id, method, before_size, after_size }

OCRCompleted
  aggregate: scan
  payload: { session_id, word_count, confidence_avg, latency_ms }
```

## MOBİL — TEK KAĞIT OKUMA

```
MobileCaptureStarted
  aggregate: mobile_capture
  payload: { capture_id, device_type, answer_key_version }

PhotoTaken
  aggregate: mobile_capture
  payload: { capture_id, photo_ref, file_size_kb, timestamp }

ImageValidated
  aggregate: mobile_capture
  payload: { capture_id, is_valid, reject_reason, quality_score }

QuickOCRCompleted
  aggregate: mobile_capture
  payload: { capture_id, student_name, student_no, latency_ms }

AIGradingSuggested
  aggregate: mobile_capture
  payload: { capture_id, suggested_score, confidence, confidence_band, review_required }

TeacherConfirmed
  aggregate: mobile_capture
  payload: { capture_id, confirmed_score, corrections, teacher_id }
```

## DEĞERLENDİRME — ORTAK

```
AIGradingQueued
  aggregate: grade
  payload: { job_id, exam_id, queue_size, model }

AIGradingStarted
  aggregate: grade
  payload: { job_id, model, timeout_seconds }

AIGradingCompleted
  aggregate: grade
  payload: { result_id, score, confidence, confidence_band, review_required }

GradingRoutedLocal ⬅ Phase 3 (ADR-018)
  aggregate: grade
  payload: { result_id, ocr_confidence, question_type, decision_reason }

GradingEscalatedCloud ⬅ Phase 3 (ADR-018)
  aggregate: grade
  payload: { result_id, ocr_confidence, question_type, provider, decision_reason }

TeacherReviewStarted
  aggregate: grade
  payload: { result_id, teacher_id, trigger } — trigger: "low_confidence" | "manual" | "appeal"

TeacherAnnotated
  aggregate: grade
  payload: { result_id, annotations, count }

GradeOverridden
  aggregate: grade
  payload: { result_id, old_score, new_score, question_no, reason }

GradeFinalized
  aggregate: grade
  payload: { result_id, final_score, student_id, exam_id, finalized_by }
```

## RAPORLAMA

```
PerformanceCalculated
  aggregate: exam
  payload: { exam_id, class_average, distribution, criteria_scores }

ReportGenerated
  aggregate: exam
  payload: { exam_id, format, template, file_size_kb }

ReportExported
  aggregate: exam
  payload: { exam_id, file_path, format, exported_by }
```

## SİSTEM

```
SyncStarted
  aggregate: exam
  payload: { direction, device_type, record_count }

SyncCompleted
  aggregate: exam
  payload: { synced, duration_ms, conflicts }

SyncFailed
  aggregate: exam
  payload: { error, retry_count, direction }

BackupCreated
  aggregate: exam
  payload: { backup_id, size_mb, path }

DatabaseMigrated
  aggregate: exam
  payload: { from_version, to_version, migration_count, duration_ms }
```

---

## Değişiklik Kaydı

| Tarih | Değişiklik | Freeze Etkisi |
|-------|-----------|---------------|
| 2026-05-25 (Phase 1) | İlk 20 event | — |
| 2026-05-25 (Phase 2.5) | +TemplateVersionCreated | ✅ Yeni event_type, aggregate='exam' mevcut |
| 2026-05-25 (Phase 2.5) | +StudentMatchRejected | ✅ Yeni event_type, aggregate='student' mevcut |
