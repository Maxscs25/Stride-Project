import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { round1, uuid } from './format';
import { clearInsights, fetchLatestInsight } from './insights';
import { checkStrava, clearStrava } from './strava';
import { checkTerra, clearTerra } from './terra';
import { supabase } from './supabase';
import type { CrossSession, JournalEntry, Run, Shoe } from './types';
import { useApp } from '@/store';

/**
 * Auth session + write-through sync.
 * Signed out: the app runs on local demo data. Signed in: every new entity is
 * written locally first (instant UI, works offline) and pushed to Supabase in
 * the background; on sign-in the store is hydrated from the cloud.
 */

export const useAuth = create<{ session: Session | null; ready: boolean }>(() => ({
  session: null,
  ready: false,
}));

let started = false;
let pulling = false;

export function startAuthSync() {
  if (started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ session: data.session, ready: true });
    if (data.session) bootstrap(data.session);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    useAuth.setState({ session, ready: true });
    if (event === 'SIGNED_IN' && session) bootstrap(session);
    if (event === 'SIGNED_OUT') {
      clearInsights();
      clearStrava();
      clearTerra();
      useApp.getState().resetDemo();
    }
  });
}

async function bootstrap(session: Session) {
  if (pulling) return;
  pulling = true;
  try {
    const uid = session.user.id;
    const name = session.user.email?.split('@')[0] ?? 'Runner';
    await supabase.from('profiles').upsert({ id: uid, display_name: name });
    await pullAll(name);
    await Promise.all([fetchLatestInsight(), checkStrava(), checkTerra()]);
  } catch (e) {
    console.warn('sync bootstrap failed', e);
  } finally {
    pulling = false;
  }
}

const M_PER_MI = 1609.34;

export async function pullAll(name?: string) {
  const [runsQ, crossQ, journalQ, shoesQ] = await Promise.all([
    supabase.from('runs').select('*').order('local_date', { ascending: true }),
    supabase.from('cross_training').select('*').order('local_date', { ascending: true }),
    supabase.from('journal_entries').select('*').order('local_date', { ascending: true }),
    supabase.from('shoes').select('*'),
  ]);

  const runs: Run[] = (runsQ.data ?? []).map((r) => ({
    id: r.id,
    date: r.local_date,
    distanceMi: round1(Number(r.distance_m) / M_PER_MI),
    durationS: r.duration_s,
    type: r.workout_type === 'fartlek' ? 'other' : r.workout_type,
    shoeId: r.shoe_id ?? undefined,
    rpe: r.rpe ?? undefined,
  }));
  const cross: CrossSession[] = (crossQ.data ?? []).map((c) => ({
    id: c.id,
    date: c.local_date,
    activity: c.activity_type,
    minutes: c.duration_min,
    intensity: c.intensity ?? undefined,
    note: c.notes ?? undefined,
  }));
  const journal: JournalEntry[] = (journalQ.data ?? []).map((j) => ({
    id: j.id,
    date: j.local_date,
    energy: j.energy ?? undefined,
    soreness: j.soreness ?? undefined,
    stress: j.stress ?? undefined,
    sleepHours: j.sleep_hours != null ? Number(j.sleep_hours) : undefined,
    sleepQuality: j.sleep_quality ?? undefined,
    note: j.body ?? undefined,
  }));
  const shoes: Shoe[] = (shoesQ.data ?? []).map((s) => ({
    id: s.id,
    brand: s.brand,
    model: s.model,
    lifespanMiles: s.lifespan_miles,
    startingMiles: Number(s.starting_miles),
    color: s.color ?? '#60A5FA',
    isDefault: s.is_default,
    retiredAt: s.retired_at,
  }));

  useApp.getState().hydrateRemote({ runs, cross, journal, shoes, name });
}

function userId(): string | null {
  return useAuth.getState().session?.user.id ?? null;
}

function warnOnError(label: string) {
  return ({ error }: { error: { message: string } | null }) => {
    if (error) console.warn(`${label} sync failed:`, error.message);
  };
}

/** Log a run locally + push. A run note also becomes a journal entry so the
 *  AI symptom mining sees it. */
export function logRun(input: Omit<Run, 'id'>) {
  const id = uuid();
  useApp.getState().logRun({ ...input, id });
  const jid = uuid();
  if (input.note) {
    useApp.getState().addJournal({ date: input.date, note: input.note, id: jid });
  }

  const uid = userId();
  if (!uid) return;
  supabase
    .from('runs')
    .insert({
      id,
      user_id: uid,
      started_at: `${input.date}T12:00:00Z`,
      local_date: input.date,
      distance_m: Math.round(input.distanceMi * M_PER_MI),
      duration_s: input.durationS,
      workout_type: input.type,
      shoe_id: input.shoeId ?? null,
      rpe: input.rpe ?? null,
      source: 'manual',
    })
    .then(warnOnError('run'));
  if (input.note) {
    supabase
      .from('journal_entries')
      .insert({ id: jid, user_id: uid, local_date: input.date, run_id: id, body: input.note })
      .then(warnOnError('run note'));
  }
}

export function logCross(input: Omit<CrossSession, 'id'>) {
  const id = uuid();
  useApp.getState().logCross({ ...input, id });
  const uid = userId();
  if (!uid) return;
  supabase
    .from('cross_training')
    .insert({
      id,
      user_id: uid,
      local_date: input.date,
      activity_type: input.activity,
      duration_min: input.minutes,
      intensity: input.intensity ?? null,
      notes: input.note ?? null,
    })
    .then(warnOnError('cross-training'));
}

export function addJournal(input: Omit<JournalEntry, 'id'>) {
  const id = uuid();
  useApp.getState().addJournal({ ...input, id });
  const uid = userId();
  if (!uid) return;
  supabase
    .from('journal_entries')
    .insert({
      id,
      user_id: uid,
      local_date: input.date,
      body: input.note ?? null,
      energy: input.energy ?? null,
      soreness: input.soreness ?? null,
      stress: input.stress ?? null,
      sleep_hours: input.sleepHours ?? null,
      sleep_quality: input.sleepQuality ?? null,
    })
    .then(warnOnError('journal'));
}

export function addShoe(input: Omit<Shoe, 'id'>) {
  const id = uuid();
  useApp.getState().addShoe({ ...input, id });
  const uid = userId();
  if (!uid) return;
  supabase
    .from('shoes')
    .insert({
      id,
      user_id: uid,
      brand: input.brand,
      model: input.model,
      lifespan_miles: input.lifespanMiles,
      starting_miles: input.startingMiles,
      color: input.color,
      is_default: input.isDefault ?? false,
    })
    .then(warnOnError('shoe'));
}
