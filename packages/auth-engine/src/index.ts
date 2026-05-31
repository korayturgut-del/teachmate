/**
 * @doa/auth-engine
 *
 * Öğretmen Kimlik & Oturum Yönetimi.
 *
 * Tasarım ilkeleri (Anayasa Madde 4 — yerel öncelik):
 *  - Kimlik doğrulama TAMAMEN yereldir. Hiçbir parola/PIN buluta gitmez.
 *  - Parola hash'i Argon2 ile Rust tarafında (crypto.rs) hesaplanır; bu paket
 *    yalnızca Tauri IPC köprüsü üzerinden doğrulama ister.
 *  - Oturum token'ı bellekte + SQLCipher'da saklanır (storage-engine).
 *
 * Bu paket çevrimdışı çalışır — okul WiFi'si olmadan öğretmen giriş yapabilir.
 */

// ── Tipler ─────────────────────────────────────────────────────

export type AuthRole = 'teacher' | 'admin'

export interface TeacherIdentity {
  teacherId: string
  displayName: string
  role: AuthRole
  /** Bağlı olduğu okul (onboarding'de seçilir) */
  schoolId?: string
  createdAt: string
}

export interface AuthSession {
  sessionId: string
  teacherId: string
  /** ISO timestamp — oturum bitiş zamanı */
  expiresAt: string
  role: AuthRole
}

export interface AuthResult {
  ok: boolean
  session?: AuthSession
  error?: string
}

/** Tauri IPC köprüsü tipi — gerçek crypto.rs komutlarını çağırır. */
export interface CryptoBridge {
  /** Argon2 ile parola hash'i üret (kayıt için). */
  hashPassword(plain: string): Promise<string>
  /** Argon2 doğrulama (giriş için). */
  verifyPassword(plain: string, hash: string): Promise<boolean>
}

/** Kalıcılık köprüsü — storage-engine / SQLCipher ile konuşur. */
export interface AuthStore {
  getTeacherByName(displayName: string): Promise<(TeacherIdentity & { passwordHash: string }) | null>
  saveTeacher(identity: TeacherIdentity, passwordHash: string): Promise<void>
  saveSession(session: AuthSession): Promise<void>
  getSession(sessionId: string): Promise<AuthSession | null>
  deleteSession(sessionId: string): Promise<void>
}

// ── Sabitler ───────────────────────────────────────────────────

/** Oturum süresi — bir okul günü (saat). Çevrimdışı kullanım için uzun. */
const SESSION_HOURS = 12

// ── Yardımcılar ────────────────────────────────────────────────

function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

function sessionExpiry(hours = SESSION_HOURS): string {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

// ── Auth Engine ────────────────────────────────────────────────

export class AuthEngine {
  constructor(
    private crypto: CryptoBridge,
    private store: AuthStore,
  ) {}

  /**
   * Yeni öğretmen kaydı (onboarding'de bir kez).
   * Parola Argon2 ile hash'lenir, SQLCipher'a yazılır.
   */
  async register(
    displayName: string,
    password: string,
    opts: { role?: AuthRole; schoolId?: string } = {},
  ): Promise<AuthResult> {
    const name = displayName.trim()
    if (name.length < 2) {
      return { ok: false, error: 'İsim en az 2 karakter olmalı.' }
    }
    if (password.length < 4) {
      return { ok: false, error: 'Parola/PIN en az 4 karakter olmalı.' }
    }

    const existing = await this.store.getTeacherByName(name)
    if (existing) {
      return { ok: false, error: 'Bu isimde bir öğretmen zaten kayıtlı.' }
    }

    const passwordHash = await this.crypto.hashPassword(password)
    const identity: TeacherIdentity = {
      teacherId: newId('t'),
      displayName: name,
      role: opts.role ?? 'teacher',
      schoolId: opts.schoolId,
      createdAt: new Date().toISOString(),
    }
    await this.store.saveTeacher(identity, passwordHash)
    return this.startSession(identity)
  }

  /**
   * Giriş — isim + parola/PIN. Argon2 doğrulaması Rust tarafında.
   */
  async login(displayName: string, password: string): Promise<AuthResult> {
    const record = await this.store.getTeacherByName(displayName.trim())
    if (!record) {
      return { ok: false, error: 'Öğretmen bulunamadı.' }
    }
    const valid = await this.crypto.verifyPassword(password, record.passwordHash)
    if (!valid) {
      return { ok: false, error: 'Parola/PIN hatalı.' }
    }
    const { passwordHash: _omit, ...identity } = record
    return this.startSession(identity)
  }

  /** Oturum geçerli mi? Süresi dolmuşsa siler. */
  async validate(sessionId: string): Promise<AuthSession | null> {
    const session = await this.store.getSession(sessionId)
    if (!session) return null
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await this.store.deleteSession(sessionId)
      return null
    }
    return session
  }

  /** Çıkış — oturumu sil. */
  async logout(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId)
  }

  private async startSession(identity: TeacherIdentity): Promise<AuthResult> {
    const session: AuthSession = {
      sessionId: newId('s'),
      teacherId: identity.teacherId,
      expiresAt: sessionExpiry(),
      role: identity.role,
    }
    await this.store.saveSession(session)
    return { ok: true, session }
  }
}
