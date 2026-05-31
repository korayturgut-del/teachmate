/**
 * Performans Ekranı — Maarif süreç değerlendirme.
 * Gözlem + opsiyonel foto → AI Maarif Muallimi değerlendirmesi.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { palette, ThemeMode, radius, spacing } from '../theme/theme';
import { api } from '../lib/api';
import { FileBar } from '../components/FileBar';

const GRADE_TYPES = [
  { key: 'sinifIciEtkinlik', label: 'Sınıf İçi Etkinlik', icon: '🎭' },
  { key: 'ozDegerlendirme', label: 'Öz Değerlendirme', icon: '🪞' },
  { key: 'proje', label: 'Dönem Projesi', icon: '🎨' },
];

export function PerformanceScreen({ mode }: { mode: ThemeMode }) {
  const c = palette(mode);
  const [gradeType, setGradeType] = useState('sinifIciEtkinlik');
  const [observation, setObservation] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('İzin', 'Galeri izni gerekli.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      setImage(res.assets[0].uri);
      setImageB64(res.assets[0].base64 || null);
    }
  };

  const evaluate = async () => {
    if (!observation.trim() && !imageB64) {
      Alert.alert('Eksik', 'En az gözlem yazın veya fotoğraf ekleyin.'); return;
    }
    setBusy(true); setResult(null);
    try {
      const r = await api.evaluatePerformance({
        grade_type: gradeType,
        observation: observation.trim(),
        student_name: 'Öğrenci',
        image_base64: imageB64 || undefined,
      });
      setResult(r);
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Değerlendirme başarısız');
    } finally {
      setBusy(false);
    }
  };

  const block = (title: string, text?: string) => {
    if (!text) return null;
    return (
      <View style={[styles.block, { borderColor: c.border, backgroundColor: c.bg }]}>
        <Text style={[styles.blockTitle, { color: c.accent }]}>{title}</Text>
        <Text style={{ color: c.text, lineHeight: 21, fontSize: 14 }}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* Tür seçimi */}
        <View style={styles.typeRow}>
          {GRADE_TYPES.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[
                styles.typeBtn,
                { backgroundColor: gradeType === g.key ? c.accent : c.bgElevated, borderColor: c.border },
              ]}
              onPress={() => setGradeType(g.key)}
            >
              <Text style={{ fontSize: 20 }}>{g.icon}</Text>
              <Text style={{
                color: gradeType === g.key ? '#fff' : c.textSoft,
                fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4,
              }}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gözlem */}
        <View style={[styles.card, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>👁 Öğretmen Gözlemi</Text>
          <TextInput
            style={[styles.textarea, { color: c.text, borderColor: c.border, backgroundColor: c.bgInput }]}
            placeholder="Öğrencinin süreçteki davranışını, katılımını, gelişimini yazın..."
            placeholderTextColor={c.textFaint}
            value={observation} onChangeText={setObservation}
            multiline numberOfLines={5} textAlignVertical="top"
          />
          {image && <Image source={{ uri: image }} style={styles.preview} resizeMode="contain" />}
          <TouchableOpacity style={[styles.photoBtn, { borderColor: c.border }]} onPress={pick}>
            <Text style={{ color: c.accent, fontWeight: '700' }}>
              {image ? '🖼 Fotoğrafı Değiştir' : '📷 Fotoğraf Ekle (opsiyonel)'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}
          onPress={evaluate} disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>🌸 Maarif Değerlendirmesi Yap</Text>}
        </TouchableOpacity>

        {/* Sonuç */}
        {result && (
          <View style={[styles.card, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
            <View style={styles.resultHead}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Değerlendirme</Text>
              <Text style={[styles.score, { color: c.success }]}>{result.score_100}/100</Text>
            </View>
            {block('🌸 Maarif Muallimi Yorumu', result.maarif_muallimi_yorumu)}
            {block('✨ Güçlü Yönler', result.guclu_yonler)}
            {block('🌱 Gelişim Alanları', result.gelisim_alanlari)}
            {block('💭 Yansıtıcı Sorular', result.yansitici_sorular)}
            {block('💌 Öğrenciye Mesaj', result.feedback_for_student)}
            <Text style={{ color: c.textFaint, fontSize: 11, marginTop: 4 }}>Motor: {result.provider}</Text>
          </View>
        )}
      </ScrollView>

      <FileBar mode={mode} onSaveLocal={() => {}} onLoadLocal={() => {}} onSaveDrive={() => {}} onLoadDrive={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeBtn: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  textarea: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: 14, minHeight: 110 },
  preview: { width: '100%', height: 160, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: '#0003' },
  photoBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  btn: { paddingVertical: 15, borderRadius: radius.pill, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  score: { fontSize: 22, fontWeight: '900' },
  block: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  blockTitle: { fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
});
