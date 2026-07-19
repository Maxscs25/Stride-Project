import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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
