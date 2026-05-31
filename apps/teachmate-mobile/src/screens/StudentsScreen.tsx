/**
 * Öğrenciler Ekranı — WhatsApp sohbet listesi tarzı.
 * Her öğrenci bir "sohbet satırı" gibi: avatar + ad + alt bilgi.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { palette, ThemeMode, radius, spacing } from '../theme/theme';
import { api, Student } from '../lib/api';
import { FileBar } from '../components/FileBar';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#0e7c86', '#1e6fb8', '#d97706', '#059669', '#7c3aed', '#dc2626'];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function StudentsScreen({ mode }: { mode: ThemeMode }) {
  const c = palette(mode);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setErr('');
    try {
      const list = await api.students();
      setStudents(list);
    } catch (e: any) {
      setErr(e.message || 'Öğrenciler yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter(
    (s) => s.ad.toLowerCase().includes(query.toLowerCase()) ||
           (s.no || '').includes(query)
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Arama çubuğu — WhatsApp tarzı */}
      <View style={[styles.searchWrap, { backgroundColor: c.header }]}>
        <View style={[styles.search, { backgroundColor: c.bgInput }]}>
          <Text style={{ color: c.textFaint, fontSize: 16 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Öğrenci ara..."
            placeholderTextColor={c.textFaint}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={{ color: c.textSoft, marginTop: 12 }}>Öğrenciler yükleniyor...</Text>
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>📡</Text>
          <Text style={{ color: c.danger, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>
            {err}
          </Text>
          <TouchableOpacity onPress={load} style={[styles.retry, { backgroundColor: c.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>👥</Text>
          <Text style={{ color: c.textSoft, marginTop: 8 }}>
            {query ? 'Eşleşen öğrenci yok' : 'Henüz öğrenci yok'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={c.accent} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} activeOpacity={0.6}>
              <View style={[styles.avatar, { backgroundColor: avatarColor(item.id) }]}>
                <Text style={styles.avatarText}>{initials(item.ad)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]}>{item.ad}</Text>
                <Text style={[styles.sub, { color: c.textSoft }]}>
                  {item.sinif ? `${item.sinif}` : 'Sınıf —'}
                  {item.no ? ` · No: ${item.no}` : ''}
                </Text>
              </View>
              <Text style={{ color: c.textFaint, fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <FileBar
        mode={mode}
        onSaveLocal={() => {}}
        onLoadLocal={() => {}}
        onSaveDrive={() => {}}
        onLoadDrive={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, borderRadius: radius.pill, height: 42,
  },
  searchInput: { flex: 1, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  retry: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.pill },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
});
