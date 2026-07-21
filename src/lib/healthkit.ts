import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { dateKey, round1, uuid } from './format';
import { supabase } from './supabase';
import { useApp } from '@/store';

/**
 * Apple Health sync — the free watch bridge. Garmin Connect, COROS, Polar and
 * Apple Watch all write workouts to Apple Health; we read running workouts and
 * import them like any other run. Requires the dev build (native module);
 * everything here no-ops gracefully in Expo Go and on web/Android.
 */

// Typed loosely on purpose: the native module only exists in the dev build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HK: any = null;
if (Platform.OS === 'ios') {
  try {
    HK = require('@kingstinct/react-native-healthkit');
  } catch {
    HK = null;
  }
}

const FLAG = 'stride-healthkit-connected';
const RUNNING = 37; // WorkoutActivityType.running

export const useHealthKit = create<{
  available: boolean;
  connected: boolean;
  busy: boolean;
  imported: number | null;
  error: string | null;
}>(() => ({
  available: !!HK,
  connected: false,
  busy: false,
  imported: null,
  error: null,
}));

export async function initHealthKit() {
  if (!HK) return;
  const flag = await AsyncStorage.getItem(FLAG);
  useHealthKit.setState({ connected: flag === '1' });
  if (flag === '1') syncHealthKitRuns().catch(() => {});
}

export async function connectHealthKit(): Promise<boolean> {
  if (!HK) {
    useHealthKit.setState({ error: 'Available in the iPhone dev build (not Expo Go).' });
    return false;
  }
  useHealthKit.setState({ busy: true, error: null });
  try {
    const available = await HK.isHealthDataAvailableAsync();
    if (!available) throw new Error('Health data unavailable on this device');
    await HK.requestAuthorization({
      toRead: [
        'HKWorkoutTypeIdentifier',
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
      ],
    });
    await AsyncStorage.setItem(FLAG, '1');
    useHealthKit.setState({ connected: true });
    await syncHealthKitRuns();
    return true;
  } catch (e) {
    console.warn('HealthKit connect failed', e);
    useHealthKit.setState({ error: 'Could not connect to Apple Health.' });
    return false;
  } finally {
    useHealthKit.setState({ busy: false });
  }
}

export async function disconnectHealthKit() {
  await AsyncStorage.removeItem(FLAG);
  useHealthKit.setState({ connected: false, imported: null });
}

interface QuantityLike {
  unit?: string;
  quantity?: number;
}

function toMeters(q?: QuantityLike | number): number {
  if (q == null) return 0;
  if (typeof q === 'number') return q;
  const v = q.quantity ?? 0;
  const u = (q.unit ?? 'm').toLowerCase();
  if (u === 'mi') return v * 1609.34;
  if (u === 'km') return v * 1000;
  return v; // meters
}

function toSeconds(q?: QuantityLike | number): number {
  if (q == null) return 0;
  if (typeof q === 'number') return q;
  const v = q.quantity ?? 0;
  const u = (q.unit ?? 's').toLowerCase();
  if (u === 'min') return v * 60;
  if (u === 'hr' || u === 'h') return v * 3600;
  return v; // seconds
}

interface RawWorkout {
  uuid: string;
  startDate: Date | string;
  duration?: QuantityLike;
  totalDistance?: QuantityLike;
  workoutActivityType?: number;
}

/** Import running workouts from the last 60 days; dedupe on workout UUID. */
export async function syncHealthKitRuns(): Promise<number> {
  if (!HK || !useHealthKit.getState().connected) return 0;

  // Query WITHOUT the native activity-type filter, then select runs in JS.
  // This is more robust than trusting the filter to match how every source
  // (Garmin, COROS, Apple Watch) tags a run, and lets us log what came back.
  let workouts: RawWorkout[] = [];
  try {
    workouts = await HK.queryWorkoutSamples({
      filter: { date: { startDate: new Date(Date.now() - 60 * 864e5) } },
      limit: 0, // all
      ascending: true,
    });
  } catch (e) {
    console.warn('[healthkit] query failed', e);
    useHealthKit.setState({ error: 'Could not read workouts from Apple Health.' });
    return 0;
  }

  const runs = workouts.filter((w) => (w.workoutActivityType ?? RUNNING) === RUNNING);
  console.log(
    `[healthkit] ${workouts.length} workouts in last 60d, ${runs.length} are runs`
  );
  if (workouts.length === 0) {
    // Either no data reached Apple Health, or read permission wasn't granted
    // (iOS hides read denials). Flag it so the UI can guide the user.
    useHealthKit.setState({ imported: 0, error: null });
  }

  const app = useApp.getState();
  const known = new Set(app.runs.map((r) => r.externalId).filter(Boolean));
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;

  let added = 0;
  const remoteRows: Record<string, unknown>[] = [];
  for (const w of runs) {
    const ext = String(w.uuid);
    if (!ext || known.has(ext)) continue;
    const meters = toMeters(w.totalDistance);
    const seconds = Math.round(toSeconds(w.duration));
    if (meters < 400 || seconds <= 0) {
      console.log(`[healthkit] skipped run ${ext.slice(0, 8)} (m=${meters}, s=${seconds})`);
      continue; // skip fragments
    }
    const start = new Date(w.startDate);
    const run = {
      id: uuid(),
      date: dateKey(start),
      distanceMi: round1(meters / 1609.34),
      durationS: seconds,
      type: 'easy' as const,
      externalId: ext,
    };
    app.logRun(run);
    known.add(ext);
    added++;
    if (uid) {
      remoteRows.push({
        id: run.id,
        user_id: uid,
        started_at: start.toISOString(),
        local_date: run.date,
        distance_m: Math.round(meters),
        duration_s: seconds,
        workout_type: 'easy',
        source: 'healthkit',
        external_id: ext,
      });
    }
  }

  if (remoteRows.length) {
    const { error } = await supabase
      .from('runs')
      .upsert(remoteRows, { onConflict: 'user_id,source,external_id' });
    if (error) console.warn('[healthkit] run sync failed:', error.message);
  }
  console.log(`[healthkit] imported ${added} new run(s)`);
  useHealthKit.setState({ imported: added });
  return added;
}
