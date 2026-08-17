import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const hasSupabaseConfig = url.length > 0 && key.length > 0;

// Expo Router pre-renders routes in Node, where AsyncStorage's web backend
// (window.localStorage) doesn't exist — a bare AsyncStorage here crashes the
// dev server. No-op storage during SSR; real storage in the browser/native.
const isServer = typeof window === 'undefined';
const storage = {
  getItem: (k: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(k)),
  setItem: (k: string, v: string) => (isServer ? Promise.resolve() : AsyncStorage.setItem(k, v)),
  removeItem: (k: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(k)),
};

export const supabase = createClient(url, key, {
  auth: {
    storage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

/**
 * Drive token refresh from app foreground/background.
 *
 * On native, `autoRefreshToken` alone is NOT enough: it runs on a timer, and
 * iOS suspends timers for backgrounded apps. Come back after the access token
 * has expired and the refresh never fired — the session dies and Supabase
 * emits SIGNED_OUT, silently logging the user out mid-use. Supabase documents
 * startAutoRefresh/stopAutoRefresh as the required React Native pairing.
 */
if (!isServer && Platform.OS !== 'web') {
  supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
