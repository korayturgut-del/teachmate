/**
 * Teachmate — Cloudflare Worker
 *
 * GÖREV:
 *  1. teachmate.com.tr/api/*  → Hugging Face Spaces beynine proxy
 *     (CORS çözülür, HF adresi gizlenir, mobil + web aynı /api'yi kullanır)
 *  2. Diğer tüm istekler → Cloudflare Pages statik siteye gider
 *     (Pages otomatik servis eder; Worker yalnızca /api/* yakalar)
 *
 * AYAR: HF_SPACE_URL aşağıda — kendi Space adresinle değiştir.
 * Veya Cloudflare Dashboard → Worker → Settings → Variables ile
 * HF_SPACE_URL ortam değişkeni olarak ver (kodu değiştirmeden).
 */

// ⚠️ KENDİ HF SPACE ADRESİNLE DEĞİŞTİR (sondaki / olmadan):
const DEFAULT_HF_SPACE_URL = 'https://KULLANICIADI-teachmate-brain.hf.space';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hfBase = (env && env.HF_SPACE_URL) || DEFAULT_HF_SPACE_URL;

    // Yalnızca /api/* isteklerini proxy'le
    if (url.pathname.startsWith('/api/')) {
      return handleApiProxy(request, url, hfBase);
    }

    // /api/* dışı → Pages statik içeriğe bırak.
    // (Worker route'u sadece /api/* için bağlanırsa buraya hiç düşmez;
    //  güvenlik için yine de origin'e geçiriyoruz.)
    return fetch(request);
  },
};

async function handleApiProxy(request, url, hfBase) {
  // CORS ön kontrol (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Hedef: HF Space + aynı path + query
  const target = hfBase.replace(/\/$/, '') + url.pathname + url.search;

  // İsteği aynen ilet (gövde, method, header'lar)
  const proxyReq = new Request(target, {
    method: request.method,
    headers: filterHeaders(request.headers),
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'follow',
  });

  let resp;
  try {
    resp = await fetch(proxyReq);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Beyin sunucusuna ulaşılamadı', detail: String(e) }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
    );
  }

  // Yanıta CORS başlıkları ekleyerek geri dön
  const headers = new Headers(resp.headers);
  const cors = corsHeaders();
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// HF'ye iletilmeyecek başlıkları temizle (Cloudflare'e özel olanlar)
function filterHeaders(headers) {
  const out = new Headers();
  for (const [k, v] of headers.entries()) {
    const lk = k.toLowerCase();
    if (lk.startsWith('cf-') || lk === 'host' || lk === 'x-forwarded-host') continue;
    out.set(k, v);
  }
  return out;
}
