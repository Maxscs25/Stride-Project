import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  good: string;
  warn: string;
  danger: string;
  info: string;
}

const darkColors: ThemeColors = {
  bg: '#0B0F14',
  surface: '#131A22',
  surfaceAlt: '#1B2430',
  border: '#243040',
  text: '#F2F5F7',
  textSecondary: '#9FB0BF',
  textMuted: '#5F7080',
  accent: '#B7F04D',
  onAccent: '#0B0F14',
  good: '#34D399',
  warn: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
};

const lightColors: ThemeColors = {
  bg: '#F4F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1F4',
  border: '#DFE6EB',
  text: '#0C1620',
  textSecondary: '#48596B',
  textMuted: '#8496A6',
  accent: '#5EA500',
  onAccent: '#FFFFFF',
  good: '#059669',
  warn: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };

export function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  return { colors: dark ? darkColors : lightColors, dark };
}
