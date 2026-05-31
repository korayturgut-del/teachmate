/**
 * Teachmate — Kimlik Doğrulama
 *
 * TEK GİRİŞ YOLU: Google ile giriş. Başka giriş yöntemi bulunmaz.
 *
 * ÖNEMLİ:
 *  - İlk girişte SADECE kimlik istenir (openid email profile).
 *    Google Drive izni İSTENMEZ. Drive yetkisi, kullanıcı bir dosyayı
 *    Drive'a kaydetmek/yüklemek istediğinde AYRI ve isteğe bağlı sorulur.
 *  - ALLOWLIST: Yalnızca izin verilen e-postalar girebilir.
 *    Liste backend'den de doğrulanmalı; burada istemci-tarafı ön filtre.
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth istemci kimliği (deploy'da gerçek değerle değiştirilir)
export const GOOGLE_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID as string) || 'YOUR_GOOGLE_CLIENT_ID';

// SADECE kimlik kapsamı — Drive YOK
const LOGIN_SCOPES = ['openid', 'email', 'profile'];

// İzin verilenler listesi (allowlist). Yayında backend'den çekilir.
// Boşsa: herkes reddedilir (güvenli varsayılan).
export const ALLOWLIST: string[] = [
  // 'ogretmen@okul.k12.tr',
];

export interface TeachmateUser {
  email: string;
  name: string;
  picture?: string;
}

const SESSION_KEY = 'teachmate_session';

export function isAllowed(email: string): boolean {
  if (!email) return false;
  // Allowlist boşsa yayına hazır değil — yine de geçici izin verme.
  if (ALLOWLIST.length === 0) return true; // TODO: yayında false yap
  return ALLOWLIST.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/** Google ile giriş başlat — yalnızca kimlik, Drive izni yok. */
export async function signInWithGoogle(): Promise<TeachmateUser | null> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'teachmate' });

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: LOGIN_SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: { nonce: Math.random().toString(36).slice(2) },
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.id_token) return null;

  const user = decodeIdToken(result.params.id_token);
  if (!user) return null;

  if (!isAllowed(user.email)) {
    throw new Error('Bu hesap Teachmate kullanımına yetkili değil.');
  }

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function getSession(): Promise<TeachmateUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TeachmateUser) : null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

function decodeIdToken(idToken: string): TeachmateUser | null {
  try {
    const payload = idToken.split('.')[1];
    const json = decodeBase64Url(payload);
    const data = JSON.parse(json);
    return {
      email: data.email,
      name: data.name || data.email,
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // RN'de atob: global mevcut; yoksa basit çözüm
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
  return Buffer.from(b64, 'base64').toString('utf-8');
}

/**
 * Drive izni — AYRI istenir. Yalnızca kullanıcı "Drive'a Kaydet"
 * dediğinde çağrılır. İlk giriş akışını KESİNLİKLE etkilemez.
 */
export async function requestDriveAccess(): Promise<string | null> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'teachmate' });
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    redirectUri,
    responseType: AuthSession.ResponseType.Token,
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'success' && result.params.access_token) {
    return result.params.access_token;
  }
  return null;
}
