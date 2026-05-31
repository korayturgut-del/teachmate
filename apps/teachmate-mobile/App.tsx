/**
 * Teachmate — Ana Uygulama
 *
 * Akış:
 *   1. Oturum kontrolü (SecureStore)
 *   2. Yoksa → Login ekranı (SADECE Google girişi, başka yol yok)
 *   3. Varsa → 3 sekmeli ana uygulama (Öğrenciler / Yazılı Okuma / Performans)
 *
 * Tema: autoThemeMode() — saate göre otomatik gece/gündüz.
 * Kullanıcıya SORULMAZ, düğme YOK. Bir uygulamada gece ise hepsinde gece
 * (tek tema kaynağı buradan tüm ekranlara dağılır).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { autoThemeMode, palette, ThemeMode, radius, spacing } from './src/theme/theme';
import { TeachmateLogo, BRAND_NAME, BRAND_TAGLINE } from './src/components/TeachmateLogo';
import { signInWithGoogle, getSession, signOut, TeachmateUser } from './src/lib/auth';
import { StudentsScreen } from './src/screens/StudentsScreen';
import { ExamReadScreen } from './src/screens/ExamReadScreen';
import { PerformanceScreen } from './src/screens/PerformanceScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [mode, setMode] = useState<ThemeMode>(autoThemeMode());
  const [user, setUser] = useState<TeachmateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [err, setErr] = useState('');

  // Oturum kontrolü
  useEffect(() => {
    getSession().then((u) => { setUser(u); setLoading(false); });
  }, []);

  // Tema saate göre otomatik — her dakika kontrol, değişince tüm app güncellenir
  useEffect(() => {
    const t = setInterval(() => {
      const m = autoThemeMode();
      setMode((prev) => (prev !== m ? m : prev));
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const c = palette(mode);

  const doLogin = async () => {
    setErr(''); setSigningIn(true);
    try {
      const u = await signInWithGoogle();
      if (u) setUser(u);
      else setErr('Giriş tamamlanmadı.');
    } catch (e: any) {
      setErr(e.message || 'Giriş başarısız.');
    } finally {
      setSigningIn(false);
    }
  };

  const doLogout = async () => { await signOut(); setUser(null); };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <TeachmateLogo size={64} />
        <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} />
      </View>
    );
  }

  // ── LOGIN EKRANI — sadece Google ──
  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <View style={[styles.login, { backgroundColor: c.bg }]}>
          <View style={{ alignItems: 'center' }}>
            <TeachmateLogo size={96} />
            <Text style={[styles.brand, { color: c.text }]}>{BRAND_NAME}</Text>
            <Text style={[styles.tagline, { color: c.textSoft }]}>{BRAND_TAGLINE}</Text>
          </View>

          <View style={{ width: '100%', alignItems: 'center', marginTop: 48 }}>
            <TouchableOpacity
              style={[styles.googleBtn, { backgroundColor: c.bgElevated, borderColor: c.border }]}
              onPress={doLogin}
              disabled={signingIn}
              activeOpacity={0.85}
            >
              {signingIn ? (
                <ActivityIndicator color={c.accent} />
              ) : (
                <>
                  <GoogleG />
                  <Text style={[styles.googleText, { color: c.text }]}>Google ile Giriş Yap</Text>
                </>
              )}
            </TouchableOpacity>

            {!!err && <Text style={[styles.err, { color: c.danger }]}>{err}</Text>}

            <Text style={[styles.note, { color: c.textFaint }]}>
              Yalnızca yetkili öğretmenler giriş yapabilir.
            </Text>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  // ── ANA UYGULAMA — 3 sekme ──
  const navTheme = mode === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: c.bg, card: c.header } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: c.bg, card: c.header } };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme as any}>
        {/* WhatsApp tarzı üst başlık */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: c.header }}>
          <View style={styles.header}>
            <TeachmateLogo size={30} />
            <Text style={[styles.headerTitle, { color: c.headerText }]}>{BRAND_NAME}</Text>
            <TouchableOpacity onPress={doLogout} style={styles.logoutBtn}>
              <Text style={{ color: c.headerText, fontSize: 12 }}>Çıkış</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: c.tabActive,
            tabBarInactiveTintColor: c.tabInactive,
            tabBarStyle: { backgroundColor: c.bgElevated, borderTopColor: c.border, height: 60, paddingBottom: 8, paddingTop: 6 },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          }}
        >
          <Tab.Screen
            name="Ogrenciler"
            options={{ title: 'Öğrenciler', tabBarIcon: ({ color }) => <TabIcon emoji="👥" color={color} /> }}
          >
            {() => <StudentsScreen mode={mode} />}
          </Tab.Screen>
          <Tab.Screen
            name="YaziliOkuma"
            options={{ title: 'Yazılı Okuma', tabBarIcon: ({ color }) => <TabIcon emoji="📷" color={color} /> }}
          >
            {() => <ExamReadScreen mode={mode} />}
          </Tab.Screen>
          <Tab.Screen
            name="Performans"
            options={{ title: 'Performans', tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} /> }}
          >
            {() => <PerformanceScreen mode={mode} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, opacity: color === undefined ? 1 : 1 }}>{emoji}</Text>;
}

function GoogleG() {
  // Basit Google "G" rozeti
  return (
    <View style={styles.gWrap}>
      <Text style={{ fontWeight: '900', fontSize: 16, color: '#4285F4' }}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  login: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  brand: { fontSize: 34, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginTop: 6 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderWidth: 1, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 28,
    width: '100%', maxWidth: 320,
  },
  googleText: { fontSize: 15, fontWeight: '700' },
  gWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  err: { marginTop: 16, fontSize: 13, textAlign: 'center' },
  note: { marginTop: 24, fontSize: 12, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontSize: 19, fontWeight: '800', flex: 1 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
});
