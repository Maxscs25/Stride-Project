import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { startAuthSync } from '@/lib/sync';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { colors, dark } = useTheme();
  useEffect(() => {
    startAuthSync();
  }, []);
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.surface,
      border: colors.border,
      primary: colors.accent,
      text: colors.text,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="coach" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
