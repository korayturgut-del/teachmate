"""DÖA Event Bus — alt çizgili import köprüsü (Anayasa Madde 1: tireli dizin korunur).

Gerçek implementasyon `packages/event-bus/src/bus.py` içindedir. Tireli dizin adı
Python'da import edilemediği için bu köprü paketi onu yükler ve re-export eder.
"""
import importlib.util as _ilu
import pathlib as _pl

_bus_path = _pl.Path(__file__).resolve().parent.parent / "event-bus" / "src" / "bus.py"
_spec = _ilu.spec_from_file_location("doa_event_bus_impl", _bus_path)
_mod = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

EventBus = _mod.EventBus
event_bus = _mod.event_bus

__all__ = ["EventBus", "event_bus"]
