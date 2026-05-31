// v1.11 KANIT — learning-engine ↔ /api/learning bağlantısı (sahte fetch ile)
const le = require('../../packages/learning-engine/src/index.js');

let P=0,F=0;
const chk=(n,c)=>{console.log(`  ${c?'✅':'❌'} ${n}`);P+=c;F+=!c;};

console.log('\n[v1.11 — learning-engine BULUT BAĞLANTISI]');

// Sahte yerel sözlük deposu (in-memory)
function makeLocalStore() {
  const dict = new Map(), queue = [];
  return {
    _queue: queue,
    async get(w,ct){ return dict.get(w+'|'+ct) ?? null; },
    async upsert(e){ dict.set(e.wrong+'|'+e.contentType, e); },
    async pendingUploads(){ return [...queue]; },
    async markUploaded(ids){ for(const id of ids){ const i=queue.findIndex(c=>c.correctionId===id); if(i>=0)queue.splice(i,1);} },
    async enqueue(c){ queue.push(c); },
  };
}

// Sahte fetch — gerçek endpoint davranışını taklit eder
function makeFakeFetch(log) {
  return async (url, opts) => {
    log.push({ url, method: opts?.method ?? 'GET' });
    if (url.includes('/corrections/batch')) {
      const body = JSON.parse(opts.body);
      // izinsizleri say (endpoint davranışı)
      const consented = body.corrections.filter(c=>c.consent_to_train);
      return { ok:true, status:200, json: async()=>({status:'ok',accepted:consented.length}) };
    }
    if (url.includes('/corpus/stats')) {
      return { ok:true, status:200, json: async()=>({
        total_samples: 3, by_engine:{paddle_onnx:3}, by_content_type:{handwriting:3},
        new_since_last_train: 3, ready_to_train: false,
      })};
    }
    return { ok:false, status:404, json: async()=>({}) };
  };
}

(async () => {
  // TEST 1: Çevrimiçi — düzeltme anında buluta gider
  let log = [];
  let local = makeLocalStore();
  let store = new le.CloudCorrectionStore(local, 'https://fake.hf.space', ()=>true, makeFakeFetch(log));
  let engine = new le.LearningEngine(store);

  const corr = await engine.recordCorrection({
    ocrText:'kopru', correctedText:'köprü', engine:'paddle_onnx',
    ocrConfidence:0.55, contentType:'handwriting', teacherId:'t1', consentToTrain:true,
  });
  chk('recordCorrection OCRCorrection üretti', corr.correctionId.startsWith('corr_'));
  chk('çevrimiçi: bulut batch çağrıldı', log.some(l=>l.url.includes('/corrections/batch')));
  chk('yükleme sonrası kuyruk boşaldı', local._queue.length === 0);

  // TEST 2: Yerel sözlük anında öğrendi (2. kez aynı hata)
  await engine.recordCorrection({
    ocrText:'kopru', correctedText:'köprü', engine:'paddle_onnx',
    ocrConfidence:0.55, contentType:'handwriting', teacherId:'t1', consentToTrain:true,
  });
  const applied = await engine.applyLearnedCorrections('kopru','handwriting');
  chk('yerel sözlük: "kopru" → "köprü" anında düzeltti', applied.applied && applied.text==='köprü');

  // TEST 3: Çevrimdışı — buluta GİTMEZ, kuyrukta bekler
  log = []; local = makeLocalStore();
  store = new le.CloudCorrectionStore(local, 'https://fake.hf.space', ()=>false, makeFakeFetch(log));
  engine = new le.LearningEngine(store);
  await engine.recordCorrection({
    ocrText:'agac', correctedText:'ağaç', engine:'mlkit',
    ocrConfidence:0.6, contentType:'handwriting', teacherId:'t2', consentToTrain:true,
  });
  chk('çevrimdışı: bulut çağrılmadı', !log.some(l=>l.method==='POST'));
  chk('çevrimdışı: düzeltme kuyrukta bekliyor', local._queue.length === 1);

  // TEST 4: Bağlantı geldi → flush
  store = new le.CloudCorrectionStore(local, 'https://fake.hf.space', ()=>true, makeFakeFetch(log));
  const flush = await store.flushUploadQueue();
  chk('bağlantı gelince flush: 1 yüklendi', flush.uploaded === 1);
  chk('flush sonrası kuyruk boş', local._queue.length === 0);

  // TEST 5: KVKK — consentToTrain=false buluta hiç gitmez
  log = []; local = makeLocalStore();
  store = new le.CloudCorrectionStore(local, 'https://fake.hf.space', ()=>true, makeFakeFetch(log));
  engine = new le.LearningEngine(store);
  await engine.recordCorrection({
    ocrText:'test', correctedText:'sınav', engine:'mlkit',
    ocrConfidence:0.5, contentType:'printed', teacherId:'t3', consentToTrain:false,
  });
  chk('KVKK: izinsiz düzeltme buluta gitmedi', !log.some(l=>l.method==='POST'));

  // TEST 6: corpusStats endpoint'ten gerçek veri çekiyor
  store = new le.CloudCorrectionStore(makeLocalStore(),'https://fake.hf.space',()=>true,makeFakeFetch([]));
  engine = new le.LearningEngine(store);
  const stats = await engine.checkTrainingReadiness();
  chk('corpusStats bulut endpoint\'ten 3 örnek çekti', stats.totalSamples === 3);
  chk('500 eşiği altında → readyToTrain false', stats.readyToTrain === false);

  console.log(`\n=== v1.11 ENTEGRASYON: ${P} geçti, ${F} başarısız ===`);
  process.exit(F?1:0);
})();
