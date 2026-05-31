// apps/mobile/src/screens/Archive.tsx
// Mobil salt-okuma arşiv — ADR-007 (sınırlı mobil özellik)

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'

interface ArchiveItem {
  id: string
  studentName: string
  subject: string
  score: number
  maxScore: number
  date: string
}

const Archive: React.FC = () => {
  const [items, setItems] = useState<ArchiveItem[]>([])

  useEffect(() => {
    // Phase 2: Mock veri. Phase 4: Event Store'dan.
    setItems([
      { id: '1', studentName: 'Ali Yılmaz', subject: 'Matematik', score: 87, maxScore: 100, date: '2026-05-20' },
      { id: '2', studentName: 'Ayşe Demir', subject: 'Fizik', score: 92, maxScore: 100, date: '2026-05-18' },
      { id: '3', studentName: 'Mehmet Kaya', subject: 'Kimya', score: 74, maxScore: 100, date: '2026-05-15' },
    ])
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗄 Arşiv</Text>
        <Text style={styles.subtitle}>{items.length} kayıt</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardName}>{item.studentName}</Text>
              <Text style={styles.cardMeta}>{item.subject} · {item.date}</Text>
            </View>
            <View style={styles.cardScore}>
              <Text style={[styles.scoreNum, item.score >= 85 ? styles.goodScore : styles.avgScore]}>
                {item.score}
              </Text>
              <Text style={styles.scoreMax}>/{item.maxScore}</Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLeft: { flex: 1 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  cardScore: { flexDirection: 'row', alignItems: 'baseline', marginLeft: 12 },
  scoreNum: { fontSize: 28, fontWeight: '900' },
  scoreMax: { color: '#64748b', fontSize: 13, marginLeft: 2 },
  goodScore: { color: '#10b981' },
  avgScore: { color: '#f59e0b' },
})

export default Archive
