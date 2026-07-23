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

// Brand: deep cobalt blue (matches the ribbon-runner logo). Green is kept as
// the "good / healthy" accent (positive states, nutrition), and info shifts to
// cyan so it stays distinct from the primary blue in charts.
const darkColors: ThemeColors = {
  bg: '#0A0E17',
  surface: '#141C2B',
  surfaceAlt: '#1D2739',
  border: '#29354E',
  text: '#F1F4FA',
  textSecondary: '#A2B0C6',
  textMuted: '#647589',
  accent: '#4C7DF6',
  onAccent: '#FFFFFF',
  good: '#34D399',
  warn: '#FBBF24',
  danger: '#F87171',
  info: '#38BDF8',
};

const lightColors: ThemeColors = {
  bg: '#F3F6FC',
  surface: '#FFFFFF',
  surfaceAlt: '#EAF0FA',
  border: '#DBE4F1',
  text: '#0B1524',
  textSecondary: '#46586F',
  textMuted: '#8493A8',
  accent: '#2560EB',
  onAccent: '#FFFFFF',
  good: '#059669',
  warn: '#D97706',
  danger: '#DC2626',
  info: '#0EA5E9',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };

export function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  return { colors: dark ? darkColors : lightColors, dark };
}
