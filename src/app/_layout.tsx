import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { syncGoalReminders } from '@/lib/goalReminders';
import { initHealthKit } from '@/lib/healthkit';
import { initPurchases } from '@/lib/purchases';
import { startAuthSync } from '@/lib/sync';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { colors, dark } = useTheme();
  useEffect(() => {
    startAuthSync();
    initHealthKit();
    initPurchases();
    // Re-arm goal reminders each launch: the "every 3 days" cadence is a finite
    // batch of dated notifications, so this tops it back up.
    syncGoalReminders(useApp.getState().profile);
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
        <Stack.Screen name="form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
