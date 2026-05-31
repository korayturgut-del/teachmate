/**
 * Teachmate — Tema Sistemi
 *
 * WhatsApp tarzı temiz, modern. Marka rengi: derin teal (#0e7c86 / #14b8a6).
 * GECE/GÜNDÜZ OTOMATİK — saate göre, kullanıcıya sorulmaz, düğme yok.
 *   06:00–18:59 → gündüz
 *   19:00–05:59 → gece
 */

export type ThemeMode = 'light' | 'dark';

export function autoThemeMode(date: Date = new Date()): ThemeMode {
  const h = date.getHours();
  return h >= 6 && h < 19 ? 'light' : 'dark';
}

interface Palette {
  bg: string;
  bgElevated: string;
  bgInput: string;
  header: string;       // WhatsApp üst bar
  headerText: string;
  text: string;
  textSoft: string;
  textFaint: string;
  border: string;
  accent: string;
  accentSoft: string;
  bubbleMe: string;     // WhatsApp baloncuk
  bubbleOther: string;
  success: string;
  warn: string;
  danger: string;
  tabActive: string;
  tabInactive: string;
}

const LIGHT: Palette = {
  bg: '#eae6df',          // WhatsApp sohbet arka planı tonunda
  bgElevated: '#ffffff',
  bgInput: '#ffffff',
  header: '#0e7c86',
  headerText: '#ffffff',
  text: '#0f2a30',
  textSoft: '#5a6f74',
  textFaint: '#9aa8ab',
  border: 'rgba(0,0,0,0.08)',
  accent: '#0e7c86',
  accentSoft: 'rgba(14,124,134,0.12)',
  bubbleMe: '#d9fdd3',
  bubbleOther: '#ffffff',
  success: '#059669',
  warn: '#d97706',
  danger: '#dc2626',
  tabActive: '#0e7c86',
  tabInactive: '#9aa8ab',
};

const DARK: Palette = {
  bg: '#0b141a',          // WhatsApp koyu sohbet zemini
  bgElevated: '#1f2c34',
  bgInput: '#2a3942',
  header: '#1f2c34',
  headerText: '#e9edef',
  text: '#e9edef',
  textSoft: '#8696a0',
  textFaint: '#5d6b73',
  border: 'rgba(255,255,255,0.08)',
  accent: '#14b8a6',
  accentSoft: 'rgba(20,184,166,0.18)',
  bubbleMe: '#005c4b',
  bubbleOther: '#1f2c34',
  success: '#10b981',
  warn: '#f59e0b',
  danger: '#ef4444',
  tabActive: '#14b8a6',
  tabInactive: '#5d6b73',
};

export function palette(mode: ThemeMode): Palette {
  return mode === 'dark' ? DARK : LIGHT;
}

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
