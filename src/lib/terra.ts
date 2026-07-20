import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from './supabase';

/** Terra connection state + actions — direct watch sync for Garmin, COROS,
 *  Polar, Suunto and more, without needing Strava. */

export const useTerra = create<{
  connected: boolean | null;
  provider: string | null;
  busy: boolean;
  error: string | null;
}>(() => ({ connected: null, provider: null, busy: false, error: null }));

export async function checkTerra() {
  const { data } = await supabase.from('terra_connections').select('provider').maybeSingle();
  useTerra.setState({ connected: !!data, provider: data?.provider ?? null });
}

export async function connectTerra(): Promise<boolean> {
  useTerra.setState({ busy: true, error: null });
  const { data, error } = await supabase.functions.invoke('terra', {
    body: { action: 'start' },
  });
  if (error || !data?.url) {
    useTerra.setState({
      busy: false,
      error: 'Watch sync is not configured yet — Terra API secrets missing.',
    });
    return false;
  }
  if (Platform.OS === 'web') {
    window.open(data.url as string, '_blank');
  } else {
    await WebBrowser.openAuthSessionAsync(data.url as string, 'stride://terra-connected');
  }
  await checkTerra();
  useTerra.setState({ busy: false });
  return true;
}

export async function disconnectTerra() {
  useTerra.setState({ busy: true });
  await supabase.functions.invoke('terra', { body: { action: 'disconnect' } });
  useTerra.setState({ connected: false, provider: null, busy: false });
}

export function clearTerra() {
  useTerra.setState({ connected: null, provider: null, busy: false, error: null });
}
