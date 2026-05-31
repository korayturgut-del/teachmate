/**
 * Yazılı Okuma Ekranı — sınav kağıdı fotoğrafı çek/yükle → AI okur → puanlar.
 * WhatsApp tarzı: foto önizleme baloncuğu + sonuç kartları.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { palette, ThemeMode, radius, spacing } from '../theme/theme';
import { api } from '../lib/api';
import { FileBar } from '../components/FileBar';

interface Q { num: number; soru: string; cevap: string; puan: number; }

export function ExamReadScreen({ mode }: { mode: ThemeMode }) {
  const c = palette(mode);
  const [image, setImage] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([
    { num: 1, soru: '', cevap: '', puan: 25 },
    { num: 2, soru: '', cevap: '', puan: 25 },
    { num: 3, soru: '', cevap: '', puan: 25 },
    { num: 4, soru: '', cevap: '', puan: 25 },
  ]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pick = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('İzin', 'Kamera/galeri izni gerekli.'); return; }

    const res = camera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

    if (!res.canceled && res.assets?.[0]) {
      setImage(res.assets[0].uri);
      setImageB64(res.assets[0].base64 || null);
      setResult(null);
    }
  };

  const updateQ = (i: number, field: keyof Q, val: string) => {
    setQuestions((qs) => qs.map((q, idx) =>
      idx === i ? { ...q, [field]: field === 'puan' ? (parseInt(val) || 0) : val } : q));
  };

  const analyze = async () => {
    const valid = questions.filter((q) => q.soru.trim());
    if (valid.length === 0) { Alert.alert('Eksik', 'En az bir soru girin.'); return; }
    setBusy(true);
    setResult(null);
    try {
      const r = await api.gradeExam({
        questions: valid,
        image_base64: imageB64 || undefined,
        student_name: 'Öğrenci',
      });
      setResult(r);
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'AI okuma başarısız');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* Foto alanı */}
        <View style={[styles.card, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>📷 Sınav Kağıdı</Text>
          {image ? (
            <Image source={{ uri: image }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={[styles.placeholder, { borderColor: c.border }]}>
              <Text style={{ fontSize: 40 }}>📄</Text>
              <Text style={{ color: c.textSoft, marginTop: 6 }}>Kağıt fotoğrafı ekleyin</Text>
            </View>
          )}
          <View style={styles.photoBtns}>
            <TouchableOpacity style={[styles.pBtn, { backgroundColor: c.accent }]} onPress={() => pick(true)}>
              <Text style={styles.pBtnText}>📸 Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pBtn, { backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border }]} onPress={() => pick(false)}>
              <Text style={[styles.pBtnText, { color: c.text }]}>🖼 Galeri</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sorular */}
        <View style={[styles.card, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>📝 Sorular & Cevaplar</Text>
          {questions.map((q, i) => (
            <View key={i} style={[styles.qRow, { borderColor: c.border }]}>
              <View style={styles.qHead}>
                <Text style={[styles.qNum, { color: c.accent }]}>Soru {q.num}</Text>
                <TextInput
                  style={[styles.puanInp, { color: c.text, borderColor: c.border, backgroundColor: c.bgInput }]}
                  value={String(q.puan)} keyboardType="numeric"
                  onChangeText={(v) => updateQ(i, 'puan', v)}
                />
              </View>
              <TextInput
                style={[styles.inp, { color: c.text, borderColor: c.border, backgroundColor: c.bgInput }]}
                placeholder="Soru metni" placeholderTextColor={c.textFaint}
                value={q.soru} onChangeText={(v) => updateQ(i, 'soru', v)}
              />
              <TextInput
                style={[styles.inp, { color: c.text, borderColor: c.border, backgroundColor: c.bgInput, marginTop: 6 }]}
                placeholder="Doğru cevap" placeholderTextColor={c.textFaint}
                value={q.cevap} onChangeText={(v) => updateQ(i, 'cevap', v)}
              />
            </View>
          ))}
        </View>

        {/* AI Oku butonu */}
        <TouchableOpacity
          style={[styles.analyzeBtn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}
          onPress={analyze} disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>🤖 AI ile Oku & Puanla</Text>}
        </TouchableOpacity>

        {/* Sonuç */}
        {result && (
          <View style={[styles.card, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
            <View style={styles.resultHead}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Sonuç</Text>
              <Text style={[styles.score, { color: c.success }]}>
                {result.percent ?? result.total_score}/100
              </Text>
            </View>
            {(result.findings || []).map((f: any, i: number) => (
              <View key={i} style={[styles.finding, { borderColor: c.border, backgroundColor: c.bg }]}>
                <Text style={{ color: c.accent, fontWeight: '700' }}>Soru {f.questionId} — {f.score} p</Text>
                {!!f.ocrText && <Text style={{ color: c.textSoft, fontStyle: 'italic', marginTop: 4 }}>"{f.ocrText}"</Text>}
                {!!f.critique && <Text style={{ color: c.text, marginTop: 4, fontSize: 13 }}>{f.critique}</Text>}
              </View>
            ))}
            {!!result.overall_feedback && (
              <Text style={{ color: c.textSoft, marginTop: 8, fontSize: 13 }}>{result.overall_feedback}</Text>
            )}
            <Text style={{ color: c.textFaint, fontSize: 11, marginTop: 8 }}>Motor: {result.provider}</Text>
          </View>
        )}
      </ScrollView>

      <FileBar mode={mode} onSaveLocal={() => {}} onLoadLocal={() => {}} onSaveDrive={() => {}} onLoadDrive={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  preview: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: '#0003' },
  placeholder: { height: 160, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  pBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  pBtnText: { color: '#fff', fontWeight: '700' },
  qRow: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  qHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  qNum: { fontWeight: '700', fontSize: 14 },
  puanInp: { width: 56, textAlign: 'center', borderWidth: 1, borderRadius: radius.sm, paddingVertical: 4 },
  inp: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  analyzeBtn: { paddingVertical: 15, borderRadius: radius.pill, alignItems: 'center' },
  analyzeBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  score: { fontSize: 22, fontWeight: '900' },
  finding: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});
