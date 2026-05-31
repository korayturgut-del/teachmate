/**
 * Teachmate — Cloud Brain API katmanı
 *
 * Beyin Hugging Face Spaces'te (ücretsiz tier). Bu dosya tüm
 * HTTP çağrılarını tek yerden yönetir.
 *
 * BASE_URL: deploy sonrası gerçek HF Spaces adresiyle değiştirilir.
 *   Geçici: app.config'ten EXPO_PUBLIC_API_BASE okunur.
 */

const BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE as string) ||
  'https://USERNAME-teachmate-brain.hf.space';

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE_URL.replace(/\/$/, '') + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch { detail = await res.text(); }
    throw new Error(`Sunucu hatası ${res.status}: ${String(detail).slice(0, 160)}`);
  }
  return res.json() as Promise<T>;
}

// ── Öğrenciler ──────────────────────────────────────────────
export interface Student {
  id: string;
  ad: string;
  no?: string;
  sinif?: string;
}

export const api = {
  base: BASE_URL,

  async health() {
    return req<{ status?: string }>('/api/health');
  },

  // Öğrenciler
  async students(): Promise<Student[]> {
    const r = await req<any>('/api/students/');
    return Array.isArray(r) ? r : r.students || [];
  },

  async studentHistory(id: string) {
    return req<any>(`/api/students/${id}/history`);
  },

  // Yazılı okuma (sınav kağıdı)
  async gradeExam(payload: {
    questions: Array<{ num: number; soru: string; cevap: string; puan: number }>;
    image_base64?: string;
    student_name?: string;
  }) {
    return req<any>('/api/maarif/exam', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Performans (Maarif)
  async evaluatePerformance(payload: {
    grade_type: string;
    observation: string;
    student_name?: string;
    image_base64?: string;
  }) {
    return req<any>('/api/maarif/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async maarifFramework() {
    return req<any>('/api/maarif/framework');
  },

  async maarifMeta() {
    return req<any>('/api/maarif/meta');
  },
};
