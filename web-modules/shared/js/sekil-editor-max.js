/* ============================================================
   ŞEKİL EDİTÖRÜ — Samsung Notes Tarzı Geliştirme (paylaşılan)
   ----------------------------------------------------------
   Mevcut FE/fabric mantığını DEĞİŞTİRMEZ. Açılışta canvas'ı
   ekrana sığdırır + daraltılabilir panel düğmesi ekler.

   Modüller drawOnImg içinde feDrawGrid()'ten sonra
   _sekilEditorMax() çağırır.
   ============================================================ */

function _sekilEditorMax() {
  try {
    var modal = document.getElementById('draw-modal');
    if (!modal || typeof FE === 'undefined' || !FE.canvas) return;

    // 1) Panel aç/kapa düğmesi
    var sidebar = document.getElementById('draw-sidebar');
    if (sidebar && !document.getElementById('draw-sidebar-toggle')) {
      var tgl = document.createElement('button');
      tgl.id = 'draw-sidebar-toggle';
      tgl.innerHTML = '\u2630'; // ☰
      tgl.title = 'Şekil panelini aç/kapat';
      tgl.onclick = function () {
        sidebar.classList.toggle('collapsed');
        tgl.innerHTML = sidebar.classList.contains('collapsed') ? '\u2630' : '\u2715';
        setTimeout(_sekilEditorFit, 320);
      };
      modal.appendChild(tgl);
    }

    // 2) Açılışta ekrana sığdır
    setTimeout(_sekilEditorFit, 60);

    // 3) Pencere yeniden boyutlanınca tekrar sığdır
    if (!window._sekilFitBound) {
      window._sekilFitBound = true;
      window.addEventListener('resize', function () {
        if (document.getElementById('draw-modal')) _sekilEditorFit();
      });
    }
  } catch (e) { /* sessiz — editör yine çalışır */ }
}

function _sekilEditorFit() {
  try {
    if (typeof FE === 'undefined' || !FE.canvas) return;
    var area = document.getElementById('draw-canvas-area');
    if (!area) return;

    // Orijinal A4 boyutunu sakla (ilk çağrıda)
    if (!FE._origW) {
      FE._origW = FE.canvas.getWidth();
      FE._origH = FE.canvas.getHeight();
    }
    var cw = FE._origW, ch = FE._origH;
    if (!cw || !ch) return;

    var availW = area.clientWidth - 80;
    var availH = area.clientHeight - 80;
    var fit = Math.min(availW / cw, availH / ch, 1.5);

    if (fit > 0 && isFinite(fit)) {
      FE.canvas.setZoom(fit);
      FE.canvas.setWidth(cw * fit);
      FE.canvas.setHeight(ch * fit);
      FE.canvas.renderAll();
    }
  } catch (e) {}
}

// Global erişim
window._sekilEditorMax = _sekilEditorMax;
window._sekilEditorFit = _sekilEditorFit;
