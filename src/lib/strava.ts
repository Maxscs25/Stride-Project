import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from './supabase';

/** Strava connection state + actions. Runs recorded on Garmin/COROS/Apple
 *  Watch that sync to Strava are imported automatically via webhook. */

export const useStrava = create<{ connected: boolean | null; busy: boolean; error: string | null }>(
  () => ({ connected: null, busy: false, error: null })
);

export async function checkStrava() {
  const { data } = await supabase.from('strava_connections').select('athlete_id').maybeSingle();
  useStrava.setState({ connected: !!data });
}

export async function connectStrava(): Promise<boolean> {
  useStrava.setState({ busy: true, error: null });
  const { data, error } = await supabase.functions.invoke('strava', {
    body: { action: 'start' },
  });
  if (error || !data?.url) {
    useStrava.setState({
      busy: false,
      error: 'Strava is not configured yet — API secrets missing.',
    });
    return false;
  }
  if (Platform.OS === 'web') {
    window.open(data.url as string, '_blank');
  } else {
    await WebBrowser.openAuthSessionAsync(data.url as string, 'stride://strava-connected');
  }
  await checkStrava();
  useStrava.setState({ busy: false });
  return true;
}

export async function disconnectStrava() {
  await supabase.from('strava_connections').delete().neq('athlete_id', 0);
  useStrava.setState({ connected: false });
}

export function clearStrava() {
  useStrava.setState({ connected: null, busy: false, error: null });
}
