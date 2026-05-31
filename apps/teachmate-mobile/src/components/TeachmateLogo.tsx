/**
 * Teachmate Logo — profesyonel marka işareti.
 *
 * Konsept: konuşma baloncuğu + onay/öğretim çizgisi (mate = yardımcı).
 * "Öğretmenin yanındaki akıllı yardımcı" fikri. Teal marka rengi.
 * Eski markalama tamamen kaldırıldı; yalnızca Teachmate kimliği.
 */
import React from 'react';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  variant?: 'mark' | 'full';
  dark?: boolean;
}

export function TeachmateLogo({ size = 48, variant = 'mark' }: Props) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="tm-grad" x1="0" y1="0" x2="64" y2="64">
          <Stop offset="0" stopColor="#14b8a6" />
          <Stop offset="1" stopColor="#0e7c86" />
        </LinearGradient>
      </Defs>
      {/* Konuşma baloncuğu gövde */}
      <Path
        d="M12 10 H52 a6 6 0 0 1 6 6 V40 a6 6 0 0 1 -6 6 H28 l-12 10 v-10 H12 a6 6 0 0 1 -6 -6 V16 a6 6 0 0 1 6 -6 Z"
        fill="url(#tm-grad)"
      />
      {/* Öğretim onay çizgisi (check) — beyaz */}
      <Path
        d="M20 28 l7 7 l16 -16"
        stroke="#ffffff"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Marka adı metni — logo yanında kullanılır */
export const BRAND_NAME = 'Teachmate';
export const BRAND_TAGLINE = 'Öğretmenin akıllı yardımcısı';
