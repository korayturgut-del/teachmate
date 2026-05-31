// 5 boş paketin gerçek davranış testleri — "iskelet değil, çalışıyor" kanıtı
import { AuthEngine } from '../../dist-test/auth-engine/src/index.js'
import { SyncEngine } from '../../dist-test/sync-engine/src/index.js'
import { TemplateEngine, parseQrPayload, buildQrPayload } from '../../dist-test/template-engine/src/index.js'
import { DigitalDeskController, effectiveScore } from '../../dist-test/digital-desk/src/index.js'
import { WorkflowEngine } from '../../dist-test/workflow-engine/src/index.js'
import { webcrypto } from 'node:crypto'

// Node'da crypto.subtle için
if (!globalThis.crypto) globalThis.crypto = webcrypto

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log('  ✅', name) }
  else { fail++; console.log('  ❌', name) }
}

async function main() {
  // ── AUTH-ENGINE ──────────────────────────────────────────
  console.log('\n[auth-engine]')
  const fakeCrypto = {
    hashPassword: async (p) => 'hash:' + p,
    verifyPassword: async (p, h) => h === 'hash:' + p,
  }
  const teachers = new Map(), sessions = new Map()
  const store = {
    getTeacherByName: async (n) => teachers.get(n) ?? null,
    saveTeacher: async (id, hash) => teachers.set(id.displayName, { ...id, passwordHash: hash }),
    saveSession: async (s) => sessions.set(s.sessionId, s),
    getSession: async (id) => sessions.get(id) ?? null,
    deleteSession: async (id) => sessions.delete(id),
  }
  const auth = new AuthEngine(fakeCrypto, store)
  const reg = await auth.register('Ayşe Öğretmen', '1234', { schoolId: 'okul1' })
  check('kayıt başarılı + oturum döndü', reg.ok && !!reg.session)
  const badLogin = await auth.login('Ayşe Öğretmen', 'yanlis')
  check('yanlış PIN reddedildi', !badLogin.ok)
  const goodLogin = await auth.login('Ayşe Öğretmen', '1234')
  check('doğru PIN ile giriş', goodLogin.ok)
  const valid = await auth.validate(goodLogin.session.sessionId)
  check('oturum doğrulandı', valid !== null)
  await auth.logout(goodLogin.session.sessionId)
  const afterLogout = await auth.validate(goodLogin.session.sessionId)
  check('çıkış sonrası oturum geçersiz', afterLogout === null)
  const dup = await auth.register('Ayşe Öğretmen', '5678')
  check('aynı isim ikinci kez reddedildi', !dup.ok)

  // ── SYNC-ENGINE (ADR-013) ────────────────────────────────
  console.log('\n[sync-engine]')
  const jobs = []
  const queue = {
    enqueue: async (j) => jobs.push(j),
    listByStatus: async (s) => jobs.filter(j => j.status === s),
    update: async (id, patch) => { const j = jobs.find(x => x.jobId === id); Object.assign(j, patch) },
    count: async (s) => jobs.filter(j => j.status === s).length,
  }
  let cloudCalls = 0
  const cloud = { grade: async () => { cloudCalls++; return { score: 8, feedback: 'iyi' } } }
  const events = []
  const sync = new SyncEngine(queue, cloud, (e, p) => events.push({ e, p }))
  await sync.enqueue({ examId: 'e1', questionNo: 1, ocrText: 'cevap' })
  await sync.enqueue({ examId: 'e1', questionNo: 2, ocrText: 'cevap2' })
  check('2 iş kuyruğa alındı', await sync.pendingCount() === 2)
  const offlineResult = await sync.sync(false)
  check('çevrimdışıyken gönderim yok', offlineResult.sent === 0 && offlineResult.remaining === 2)
  const onlineResult = await sync.sync(true)
  check('internet gelince işler gönderildi', onlineResult.succeeded === 2 && cloudCalls === 2)
  check('kuyruk temizlendi', await sync.pendingCount() === 0)
  check('AIJobCompleted event üretildi', events.filter(x => x.e === 'AIJobCompleted').length === 2)

  // ── TEMPLATE-ENGINE (ADR-015) ────────────────────────────
  console.log('\n[template-engine]')
  check('QR yük oluştur', buildQrPayload('e0001', 2) === 'e0001-v2')
  const parsed = parseQrPayload('e0001-v2')
  check('QR yük çözümle', parsed.examId === 'e0001' && parsed.version === 2)
  const tmpl = new TemplateEngine()
  const exam = { examId: 'e0001', title: 'Matematik Sınavı', subject: 'Matematik', pageSize: 'A4P',
    questions: [{ questionNo: 1, type: 'closed', prompt: '2+2?', maxScore: 10 }] }
  const v1 = await tmpl.createVersion(exam, 1)
  check('versiyon 1 hash üretti', v1.version.contentHash.length === 64 && v1.changed)
  const v1again = await tmpl.createVersion(exam, 2, v1.version.contentHash)
  check('aynı içerik → changed=false', !v1again.changed)
  const exam2 = { ...exam, questions: [{ ...exam.questions[0], prompt: '3+3?' }] }
  const v2 = await tmpl.createVersion(exam2, 2, v1.version.contentHash)
  check('değişen içerik → changed=true + farklı hash', v2.changed && v2.version.contentHash !== v1.version.contentHash)
  const match = tmpl.verifyScan('e0001-v2', 2)
  check('versiyon eşleşti', match.matches)
  const mismatch = tmpl.verifyScan('e0001-v1', 2)
  check('versiyon uyuşmazlığı yakalandı', !mismatch.matches && mismatch.reason === 'version_mismatch')

  // ── DIGITAL-DESK (ADR-016) ───────────────────────────────
  console.log('\n[digital-desk]')
  const deskEvents = []
  const overlays = [
    { questionNo: 1, aiScore: 7, maxScore: 10, status: 'partial', bbox: [0,0,100,100] },
    { questionNo: 2, aiScore: 10, maxScore: 10, status: 'correct', bbox: [100,0,200,100] },
  ]
  const desk = new DigitalDeskController('e1', overlays, 'teacher1', (e, p) => deskEvents.push({ e, p }))
  check('başlangıç toplam = AI puanları (17)', desk.state.totalScore === 17)
  desk.overrideScore(1, 9)
  check('öğretmen düzeltmesi uygulandı (19)', desk.state.totalScore === 19)
  const ov = deskEvents.find(x => x.e === 'GradeOverridden')
  check('GradeOverridden event + delta=2 (ADR-016)', ov && ov.p.delta === 2)
  check('effectiveScore öğretmen puanını döndürür', effectiveScore(desk.state.overlays[0]) === 9)
  desk.overrideScore(1, 999)
  check('aşırı puan maxScore ile sınırlandı (10)', desk.state.overlays[0].teacherScore === 10)
  const ann = desk.addAnnotation('pen', [1,2,3,4])
  check('annotation eklendi', desk.state.annotations.length === 1 && ann.kind === 'pen')

  // ── WORKFLOW-ENGINE ──────────────────────────────────────
  console.log('\n[workflow-engine]')
  const wf = new WorkflowEngine('draft')
  const happy = wf.applySequence([
    'QRCodeGenerated', 'TemplatePrinted', 'ScanSessionStarted',
    'PageScanned', 'StudentMatched', 'OCRCompleted',
    'AIGradingStarted', 'AIGradingCompleted', 'GradeOverridden', 'ReportGenerated',
  ])
  check('tam akış geçerli (10 geçiş)', happy.every(r => r.ok) && wf.phase === 'completed')
  check('isCompleted true', wf.isCompleted)
  const wf2 = new WorkflowEngine('draft')
  const bad = wf2.apply('AIGradingStarted') // OCR'dan önce puanlama → geçersiz
  check('geçersiz sıra reddedildi (OCR öncesi grading)', !bad.ok && wf2.phase === 'draft')
  const wf3 = new WorkflowEngine('recognized')
  const queued = wf3.apply('AIGradingQueued') // çevrimdışı kuyruk geçerli
  check('çevrimdışı kuyruk geçişi geçerli (ADR-013)', queued.ok && wf3.phase === 'grading')

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('TEST HATASI:', e); process.exit(1) })
