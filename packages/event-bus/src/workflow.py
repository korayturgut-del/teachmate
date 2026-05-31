"""Dijital Öğretmen Asistanı — Workflow Event Bağlantıları

Phase 2: Tüm workflow event'leri Event Bus'a bağlanır.
Bu modül, event kataloğundaki her event tipi için handler zincirini tanımlar.

Kullanım:
    from packages.event_bus.src.workflow import connect_all
    connect_all()  # Tüm workflow bağlantılarını kurar
"""

from packages.event_bus.src.bus import event_bus


def connect_workflow_events() -> None:
    """Tüm domain event handler'larını Event Bus'a bağla."""

    # ── MASAÜSTÜ: Sınav Hazırlama ────────────────────────────
    event_bus.on("ExamCreated", _on_exam_created)
    event_bus.on("ExamConfigured", _on_exam_configured)
    event_bus.on("QRCodeGenerated", _on_qr_generated)
    event_bus.on("TemplatePrinted", _on_template_printed)

    # ── MASAÜSTÜ: ADF Toplu Tarama ──────────────────────────
    event_bus.on("ScanSessionStarted", _on_scan_session_started)
    event_bus.on("PageScanned", _on_page_scanned)
    event_bus.on("QRDetected", _on_qr_detected)
    event_bus.on("StudentMatched", _on_student_matched)
    event_bus.on("QuestionCropped", _on_question_cropped)
    event_bus.on("ImageEnhanced", _on_image_enhanced)
    event_bus.on("OCRCompleted", _on_ocr_completed)

    # ── MOBİL: Tek Kağıt ────────────────────────────────────
    event_bus.on("MobileCaptureStarted", _on_mobile_capture_started)
    event_bus.on("PhotoTaken", _on_photo_taken)
    event_bus.on("ImageValidated", _on_image_validated)
    event_bus.on("QuickOCRCompleted", _on_quick_ocr_completed)
    event_bus.on("AIGradingSuggested", _on_ai_grading_suggested)
    event_bus.on("TeacherConfirmed", _on_teacher_confirmed)

    # ── DEĞERLENDİRME: Ortak ────────────────────────────────
    event_bus.on("AIGradingQueued", _on_ai_grading_queued)
    event_bus.on("AIGradingStarted", _on_ai_grading_started)
    event_bus.on("AIGradingCompleted", _on_ai_grading_completed)
    event_bus.on("TeacherReviewStarted", _on_teacher_review_started)
    event_bus.on("TeacherAnnotated", _on_teacher_annotated)
    event_bus.on("GradeOverridden", _on_grade_overridden)
    event_bus.on("GradeFinalized", _on_grade_finalized)

    # ── RAPORLAMA ───────────────────────────────────────────
    event_bus.on("PerformanceCalculated", _on_performance_calculated)
    event_bus.on("ReportGenerated", _on_report_generated)
    event_bus.on("ReportExported", _on_report_exported)

    # ── SİSTEM ──────────────────────────────────────────────
    event_bus.on("SyncStarted", _on_sync_started)
    event_bus.on("SyncCompleted", _on_sync_completed)
    event_bus.on("SyncFailed", _on_sync_failed)
    event_bus.on("BackupCreated", _on_backup_created)
    event_bus.on("DatabaseMigrated", _on_database_migrated)


# ── Handler Implementasyonları (Phase 2: log-level) ──────────────
# Phase 3-4: Gerçek iş mantığı eklenecek.

def _on_exam_created(evt_type, agg, payload, evt_id, meta):
    """Sınav oluşturuldu → Phase 3: QR kuyruğuna ekle."""
    print(f"[WORKFLOW] {evt_type}: exam_id={payload.get('exam_id')}")

def _on_exam_configured(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: questions={payload.get('question_count', 0)}")

def _on_qr_generated(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: qr_id={payload.get('qr_id')}")

def _on_template_printed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: copies={payload.get('copies', 0)}")

def _on_scan_session_started(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: pages={payload.get('total_pages', 0)}")

def _on_page_scanned(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: page={payload.get('page_no')}")

def _on_qr_detected(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: student={payload.get('student_id')}")

def _on_student_matched(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: match_confidence={payload.get('confidence')}")

def _on_question_cropped(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: questions={payload.get('count', 0)}")

def _on_image_enhanced(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: method={payload.get('method', 'auto')}")

def _on_ocr_completed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: words={payload.get('word_count', 0)}")

def _on_mobile_capture_started(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: device={meta.get('device_type') if meta else 'unknown'}")

def _on_photo_taken(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: size={payload.get('file_size_kb', 0)}KB")

def _on_image_validated(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: valid={payload.get('is_valid', False)}")

def _on_quick_ocr_completed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: latency_ms={payload.get('latency_ms', 0)}")

def _on_ai_grading_suggested(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: score={payload.get('suggested_score')}")

def _on_teacher_confirmed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: final_score={payload.get('final_score')}")

def _on_ai_grading_queued(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: queue_size={payload.get('queue_size', 0)}")

def _on_ai_grading_started(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: model={payload.get('model', 'mock')}")

def _on_ai_grading_completed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: answers_evaluated={payload.get('evaluated_count', 0)}")

def _on_teacher_review_started(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: reviewer={meta.get('teacher_id') if meta else 'unknown'}")

def _on_teacher_annotated(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: annotation_count={payload.get('count', 0)}")

def _on_grade_overridden(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: old={payload.get('old_score')} → new={payload.get('new_score')}")

def _on_grade_finalized(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: student={payload.get('student_id')}, score={payload.get('final_score')}")

def _on_performance_calculated(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: class_avg={payload.get('class_average')}")

def _on_report_generated(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: format={payload.get('format', 'pdf')}")

def _on_report_exported(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: path={payload.get('file_path')}")

def _on_sync_started(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: direction={payload.get('direction')}")

def _on_sync_completed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: records={payload.get('synced', 0)}")

def _on_sync_failed(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: error={payload.get('error')}")

def _on_backup_created(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: size_mb={payload.get('size_mb', 0)}")

def _on_database_migrated(evt_type, agg, payload, evt_id, meta):
    print(f"[WORKFLOW] {evt_type}: from_v{payload.get('from_version')} → v{payload.get('to_version')}")


# Auto-connect on import
connect_workflow_events()
