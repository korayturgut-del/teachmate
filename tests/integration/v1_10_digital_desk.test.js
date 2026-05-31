// v1.10 KANIT TESTİ — perfect-freehand basınç + ısı haritası + toplu onay + çok sayfa
const dd = require('../../packages/digital-desk/src/index.js');
const qs = require('../../packages/question-segmentation/src/index.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name}`); fail++; }
}

console.log('\n[v1.10 — KALEM BASINCI]');
const events = [];
const emit = (e, p) => events.push({ e, p });
const ctrl = new dd.DigitalDeskController('exam-1', [
  { questionNo: 1, aiScore: 7, maxScore: 10, status: 'partial', bbox: [0,0,100,1000] },
  { questionNo: 2, aiScore: 10, maxScore: 10, status: 'correct', bbox: [100,0,200,1000] },
  { questionNo: 3, aiScore: 3, maxScore: 20, status: 'partial', bbox: [200,0,400,1000] },
], 'ogretmen-A', emit);

// Gerçek stylus girdisi — tutarlı değişken basınç
const stylusPts = [
  {x:10,y:10,pressure:0.4,t:0}, {x:12,y:14,pressure:0.55,t:16},
  {x:15,y:20,pressure:0.6,t:32}, {x:18,y:25,pressure:0.5,t:48},
];
const stroke = ctrl.addPressureStroke(stylusPts, { color:'#ef4444' });
check('Stylus darbesi kabul edildi', stroke !== null);
check('Basınçlı stroke depolandı', ctrl.pressureStrokes.length === 1);

// Palm rejection — avuç teması (hep pressure≈0 veya ≈1)
const palmPts = [
  {x:5,y:5,pressure:0.0,t:0}, {x:6,y:6,pressure:0.0,t:10},
  {x:7,y:7,pressure:0.99,t:20}, {x:8,y:8,pressure:0.0,t:30},
];
const rejected = ctrl.addPressureStroke(palmPts);
check('Avuç teması reddedildi (palm rejection)', rejected === null);
check('StrokeRejected event üretildi', events.some(e => e.e === 'StrokeRejected'));

console.log('\n[v1.10 — GÜVEN ISI HARİTASI]');
const words = [
  { text:'dört', confidence:0.95, bbox:[0,0,50,200] },
  { text:'Ankara', confidence:0.72, bbox:[50,0,100,200] },
  { text:'fotosentez', confidence:0.48, bbox:[100,0,150,200] },
];
const heat = dd.buildHeatMap(words);
check('3 ısı hücresi üretildi', heat.length === 3);
check('Yüksek güven → high band', heat[0].band === 'high');
check('Orta güven → mid band', heat[1].band === 'mid');
check('Düşük güven → low band', heat[2].band === 'low');
check('Düşük güven kırmızı renk', heat[2].color.includes('239,68,68'));
const summary = dd.heatMapSummary(heat);
check('Özet: 1 low kelime', summary.low === 1);
check('Risk oranı 1/3 ≈ 0.33', Math.abs(summary.riskRatio - 1/3) < 0.01);

console.log('\n[v1.10 — TOPLU ONAY]');
const confidences = { 1: 0.95, 2: 0.92, 3: 0.55 };
const bulk = ctrl.bulkApprove(confidences, 0.85);
check('Soru 1,2 onaylandı (yüksek güven)', bulk.approved.length === 2);
check('Soru 3 incelemeye kaldı (düşük güven)', bulk.needsReview.includes(3));
check('Onaylanan sorulara teacherScore atandı', ctrl.state.overlays[0].teacherScore === 7);
check('BulkApproved event üretildi', events.some(e => e.e === 'BulkApproved'));
// Toplu onay GradeOverridden ÜRETMEMELİ (öğretmen değiştirmedi, onayladı)
check('Toplu onay GradeOverridden üretmedi', !events.some(e => e.e === 'GradeOverridden'));

console.log('\n[v1.10 — ÇOK SAYFALI SEGMENTASYON]');
const pages = [
  { pageNumber: 1, pageWidth: 1000, pageHeight: 1400, detectedLines: [
    { text:'1. soru', bbox:[10,0,40,1000] },
    { text:'2. soru', bbox:[300,0,330,1000] },
  ]},
  { pageNumber: 2, pageWidth: 1000, pageHeight: 1400, detectedLines: [
    { text:'3. soru', bbox:[10,0,40,1000] },
    { text:'4. soru', bbox:[400,0,430,1000] },
  ]},
];
const mp = qs.segmentMultiPage(pages);
check('2 sayfa işlendi', mp.pageCount === 2);
check('Toplam 4 soru bölgesi', mp.totalQuestions === 4);
check('Sayfa 2 soruları süreklilik koruyor (3,4)',
  mp.regions.filter(r => r.pageNumber === 2).every(r => r.questionNo >= 3));
check('Soru numaraları benzersiz', new Set(mp.regions.map(r=>r.questionNo)).size === 4);

console.log(`\n=== v1.10 SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
process.exit(fail > 0 ? 1 : 0);
