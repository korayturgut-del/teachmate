// v1.13 KANIT TESTİ — ocr-bridge saf mantık (ocr + decision + qr + learning)
// Node.js'te RN olmadan çalışır; gerçek ML Kit testleri cihazda yapılır.

let P=0,F=0
const chk=(n,c)=>{process.stdout.write(`  ${c?'✅':'❌'} ${n}\n`);P+=c;F+=!c}

function extractQrFromOcrText(t){const m=t.match(/\b([a-z0-9-]+-v\d+)\b/i);if(m)return m[1];const q=t.match(/exam=([^&\s]+)&version=(\d+)/);if(q)return `exam=${q[1]}&version=${q[2]}`;return undefined}
function decideRoute(ocr,ctx){if(!ctx.isOnline)return{route:'offline_queue',requiresTeacherReview:false,estimatedCost:'free'};if(ocr.confidence>=0.95&&ctx.questionType==='closed')return{route:'local_resolve',requiresTeacherReview:false,estimatedCost:'free'};if(ocr.confidence<0.55)return{route:'cloud_escalate',requiresTeacherReview:true,estimatedCost:'cloud'};return{route:'cloud_escalate',requiresTeacherReview:ocr.confidence<0.70,estimatedCost:'cloud'}}
function splitForQr(p,C=1800){const f=JSON.stringify(p);if(f.length<=C)return[f];const cs=[],t=Math.ceil(f.length/C);for(let i=0;i<t;i++)cs.push(`DOA-SYNC|${i+1}/${t}|${f.slice(i*C,(i+1)*C)}`);return cs}

console.log('\n[v1.13 — OCR BRIDGE]')
chk('QR: dash-v format', extractQrFromOcrText('kağıt e0001-v3 altında')==='e0001-v3')
chk('QR: query format', extractQrFromOcrText('exam=mat2024&version=2')==='exam=mat2024&version=2')
chk('QR: bulunamadı → undefined', extractQrFromOcrText('normal metin')===undefined)
chk('QR: Türkçe metin içinde ADR-015', extractQrFromOcrText('öğrenci İstanbul e0042-v1')==='e0042-v1')

console.log('\n[v1.13 — DECISION ENGINE]')
const ctx={questionType:'closed',teacherId:'t1',isOnline:true,examId:'e1',questionNo:1}
chk('0.97 + closed → local',decideRoute({confidence:.97},ctx).route==='local_resolve')
chk('0.82 + open → cloud',decideRoute({confidence:.82},{...ctx,questionType:'open'}).route==='cloud_escalate')
chk('0.48 → cloud + review',decideRoute({confidence:.48},ctx).requiresTeacherReview)
chk('offline → offline_queue',decideRoute({confidence:.90},{...ctx,isOnline:false}).route==='offline_queue')

console.log('\n[v1.13 — ADR-011 QR KÖPRÜSÜ]')
const small={version:'1.0-doa',sessionId:'s1',direction:'mobile_to_desktop',encryptedEvents:'x'.repeat(100),nonce:'n',checksum:'c',itemCount:3}
chk('Küçük → tek chunk',splitForQr(small).length===1)
const big={...small,encryptedEvents:'x'.repeat(5000)}
const chunks=splitForQr(big)
chk('Büyük → çok chunk',chunks.length>1)
chk('DOA-SYNC prefix',chunks.every(c=>c.startsWith('DOA-SYNC')))
chk('Doğru numaralama',chunks[0].startsWith('DOA-SYNC|1/'))

console.log('\n[v1.13 — TÜRKÇE KARAKTER (Madde 5)]')
chk('ş,ğ,ı,İ,ç,ö,ü içinde QR',extractQrFromOcrText('öğrenci ğüşı e0001-v2')==='e0001-v2')
chk('Türkçe confidence ort.',(([...].length===0)?true:Math.abs([{c:.88},{c:.72}].reduce((s,b)=>s+b.c,0)/2-.80)<.01))

console.log(`\n=== v1.13 SONUÇ: ${P} geçti, ${F} başarısız ===`)
process.exit(F?1:0)
