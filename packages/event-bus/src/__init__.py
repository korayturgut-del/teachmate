"""Dijital Öğretmen Asistanı — Event Bus Package

Phase 2: SQLite tabanlı Event Bus + Event Store.
Kullanım:
    from packages.event_bus import event_bus
    event_bus.emit("ExamCreated", "exam", {"exam_id": "e1"})
"""

from packages.event_bus.src.bus import EventBus, event_bus

__all__ = ["EventBus", "event_bus"]
