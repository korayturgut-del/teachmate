/**
 * Teachmate — Dosya Kaydet/Yükle Çubuğu
 *
 * Her ekranda kullanılır. İki eylem grubu:
 *   KAYDET: [Cihaza Kaydet] [Drive simgesi]
 *   YÜKLE:  [Cihazdan Yükle] [Drive simgesi]
 *
 * Drive simgesine basılınca, o ana kadar Drive izni alınmadıysa
 * AYRI sorulur (ilk girişte değil). İsteyen cihaza, isteyen Drive'a.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette, ThemeMode, radius, spacing } from '../theme/theme';
import { requestDriveAccess } from '../lib/auth';

interface Props {
  mode: ThemeMode;
  onSaveLocal: () => void;
  onLoadLocal: () => void;
  onSaveDrive?: (token: string) => void;
  onLoadDrive?: (token: string) => void;
}

/** Resmi Google Drive üçgen logosu (renkli) */
function DriveIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 87.3 78" >
      <Path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <Path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <Path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <Path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <Path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <Path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </Svg>
  );
}

export function FileBar({ mode, onSaveLocal, onLoadLocal, onSaveDrive, onLoadDrive }: Props) {
  const c = palette(mode);

  const driveSave = async () => {
    try {
      const token = await requestDriveAccess();
      if (token && onSaveDrive) onSaveDrive(token);
      else if (!token) Alert.alert('Drive', 'Drive erişimi verilmedi.');
    } catch (e: any) {
      Alert.alert('Drive', e.message || 'Drive hatası');
    }
  };

  const driveLoad = async () => {
    try {
      const token = await requestDriveAccess();
      if (token && onLoadDrive) onLoadDrive(token);
      else if (!token) Alert.alert('Drive', 'Drive erişimi verilmedi.');
    } catch (e: any) {
      Alert.alert('Drive', e.message || 'Drive hatası');
    }
  };

  return (
    <View style={[styles.bar, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
      {/* KAYDET grubu */}
      <View style={styles.group}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.accent }]}
          onPress={onSaveLocal}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>💾 Kaydet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: c.border }]}
          onPress={driveSave}
          activeOpacity={0.7}
          accessibilityLabel="Google Drive'a kaydet"
        >
          <DriveIcon />
        </TouchableOpacity>
      </View>

      {/* YÜKLE grubu */}
      <View style={styles.group}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border }]}
          onPress={onLoadLocal}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: c.text }]}>📂 Yükle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: c.border }]}
          onPress={driveLoad}
          activeOpacity={0.7}
          accessibilityLabel="Google Drive'dan yükle"
        >
          <DriveIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
