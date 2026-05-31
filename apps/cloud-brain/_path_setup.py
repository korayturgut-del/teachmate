"""Monorepo path köprüsü — repo kökünü sys.path'e ekler.

Bu sayede `from packages.event_bus import event_bus` çözülür.
main.py en başında import edilir. Standart monorepo deseni (hack değil).
"""
import sys
import pathlib

# apps/cloud-brain/_path_setup.py -> repo kökü 2 üst dizin
_repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))
