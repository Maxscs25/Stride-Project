import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { round1, uuid } from './format';
import { clearInsights, fetchLatestInsight } from './insights';
import { loginPurchases, logoutPurchases } from './purchases';
import { checkStrava, clearStrava } from './strava';
import { clearSymptoms, fetchSymptomPatterns } from './symptoms';
import { checkTerra, clearTerra } from './terra';
import { supabase } from './supabase';
import type { CrossSession, FoodLog, JournalEntry, Profile, Run, Shoe } from './types';
import { useApp } from '@/store';

/**
 * Auth session + write-through sync.
 * Signed out: the app runs on local demo data. Signed in: every new entity is
 * written locally first (instant UI, works offline) and pushed to Supabase in
 * the background; on sign-in the store is hydrated from the cloud.
 */

export const useAuth = create<{
  session: Session | null;
  ready: boolean;
  needsOnboarding: boolean;
}>(() => ({
  session: null,
  ready: false,
  needsOnboarding: false,
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
    if (event === 'SIGNED_IN' && session) {
      bootstrap(session);
      loginPurchases(session.user.id);
    }
    if (event === 'SIGNED_OUT') {
      clearInsights();
      clearStrava();
      clearTerra();
      clearSymptoms();
      logoutPurchases();
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
    // Insert-if-missing only — never clobber an onboarded display name
    await supabase
      .from('profiles')
      .upsert({ id: uid, display_name: name }, { ignoreDuplicates: true });
    await pullAll(name);
    await Promise.all([
      fetchLatestInsight(),
      checkStrava(),
      checkTerra(),
      fetchSymptomPatterns(),
    ]);
  } catch (e) {
    console.warn('sync bootstrap failed', e);
  } finally {
    pulling = false;
  }
}

const M_PER_MI = 1609.34;

export async function pullAll(fallbackName?: string) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return;

  const [runsQ, crossQ, journalQ, shoesQ, foodQ, profileQ] = await Promise.all([
    supabase.from('runs').select('*').order('local_date', { ascending: true }),
    supabase.from('cross_training').select('*').order('local_date', { ascending: true }),
    supabase.from('journal_entries').select('*').order('local_date', { ascending: true }),
    supabase.from('shoes').select('*'),
    supabase
      .from('food_logs')
      .select('*')
      .gte('local_date', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
  ]);

  const runs: Run[] = (runsQ.data ?? []).map((r) => ({
    id: r.id,
    date: r.local_date,
    distanceMi: round1(Number(r.distance_m) / M_PER_MI),
    durationS: r.duration_s,
    type: r.workout_type === 'fartlek' ? 'other' : r.workout_type,
    shoeId: r.shoe_id ?? undefined,
    rpe: r.rpe ?? undefined,
    externalId: r.external_id ?? undefined,
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
  const foodLogs: FoodLog[] = (foodQ.data ?? []).map((f) => ({
    id: f.id,
    date: f.local_date,
    meal: f.meal ?? 'snack',
    name: f.custom_name ?? 'Food',
    servings: Number(f.servings ?? 1),
    calories: Math.round(Number(f.calories ?? 0)),
    proteinG: Math.round(Number(f.protein_g ?? 0)),
    carbsG: Math.round(Number(f.carbs_g ?? 0)),
    fatG: Math.round(Number(f.fat_g ?? 0)),
    entryMethod: f.entry_method ?? 'search',
  }));

  const p = profileQ.data;
  const profile: Partial<Profile> = {};
  if (p) {
    if (p.display_name) profile.name = p.display_name;
    if (p.weekly_goal_mi != null) profile.weeklyGoalMi = Number(p.weekly_goal_mi);
    if (p.race_goal) profile.raceGoal = p.race_goal;
    if (p.age != null) profile.age = p.age;
    if (p.height_cm != null) profile.heightCm = Number(p.height_cm);
    if (p.weight_kg != null) profile.weightKg = Number(p.weight_kg);
    if (p.gender === 'male' || p.gender === 'female') profile.sex = p.gender;
    if (p.experience_level === 'new' || p.experience_level === 'regular' || p.experience_level === 'competitive') {
      profile.experience = p.experience_level;
    }
  } else if (fallbackName) {
    profile.name = fallbackName;
  }
  useAuth.setState({ needsOnboarding: !p?.onboarded_at });

  useApp.getState().hydrateRemote({ runs, cross, journal, shoes, foodLogs, profile });
}

/** Push profile/goal fields (snake_case columns) to the signed-in user's row. */
export async function updateProfileRemote(fields: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  const { error } = await supabase.from('profiles').update(fields).eq('id', uid);
  if (error) console.warn('profile sync failed:', error.message);
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
    const note = input.note;
    supabase
      .from('journal_entries')
      .insert({ id: jid, user_id: uid, local_date: input.date, run_id: id, body: note })
      .then((r) => {
        warnOnError('run note')(r);
        if (!r.error) extractSymptoms(jid, note);
      });
  }
}

/** Fire-and-forget Claude Haiku symptom extraction for a journal note. */
function extractSymptoms(journalEntryId: string, note: string) {
  supabase.functions
    .invoke('journal-extract', { body: { journal_entry_id: journalEntryId, note } })
    .then(({ error }) => {
      if (error) console.warn('symptom extract failed:', error.message);
    });
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
    .then((r) => {
      warnOnError('journal')(r);
      if (!r.error && input.note) extractSymptoms(id, input.note);
    });
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

export function logFood(input: Omit<FoodLog, 'id'>) {
  const id = uuid();
  useApp.getState().logFood({ ...input, id });
  const uid = userId();
  if (!uid) return;
  supabase
    .from('food_logs')
    .insert({
      id,
      user_id: uid,
      local_date: input.date,
      meal: input.meal,
      custom_name: input.name.slice(0, 120),
      servings: input.servings,
      calories: input.calories,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      entry_method: input.entryMethod,
    })
    .then(warnOnError('food'));
}

export function deleteFood(id: string) {
  useApp.getState().deleteFood(id);
  if (!userId()) return;
  supabase.from('food_logs').delete().eq('id', id).then(warnOnError('food delete'));
}
