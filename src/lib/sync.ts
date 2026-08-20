import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { round1, uuid } from './format';
import { syncGoalReminders } from './goalReminders';
import { clearInsights, fetchLatestInsight } from './insights';
import { normalizePlan } from './plan';
import { loginPurchases, logoutPurchases } from './purchases';
import { checkStrava, clearStrava } from './strava';
import { clearSymptoms, fetchSymptomPatterns } from './symptoms';
import { checkTerra, clearTerra } from './terra';
import { supabase } from './supabase';
import type {
  CrossSession,
  FavoriteFood,
  FoodLog,
  JournalEntry,
  PendingWrite,
  PlanDay,
  Profile,
  Run,
  Shoe,
} from './types';
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
  /** Session dropped without the user asking — their data is intact locally
   *  and queued, but nothing will sync until they sign back in. */
  sessionLost: boolean;
  /** Last write failure, surfaced in the UI instead of only the console. */
  syncError: string | null;
}>(() => ({
  session: null,
  ready: false,
  needsOnboarding: false,
  sessionLost: false,
  syncError: null,
}));

let started = false;
let pulling = false;
/** Set only by signOut(), so an expired session isn't mistaken for intent. */
let userInitiatedSignOut = false;

/** Sign out deliberately — pushes anything queued first so it isn't discarded. */
export async function signOut() {
  try {
    await flushPending();
  } catch {
    // Best effort: never block sign-out on a failed flush.
  }
  userInitiatedSignOut = true;
  await supabase.auth.signOut();
}

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

      if (userInitiatedSignOut) {
        userInitiatedSignOut = false;
        useAuth.setState({ sessionLost: false, syncError: null });
        useApp.getState().resetDemo();
        // Cancels the outgoing account's reminders; demo mode has no goal to
        // remind about (resetDemo() already reset goalReminder to 'off').
        syncGoalReminders(useApp.getState().profile);
      } else {
        // Session expired or was revoked — the user didn't ask for this.
        // Wiping to demo data here is what made runs vanish and goals reset,
        // so keep everything and let them sign back in to resume syncing.
        useAuth.setState({ sessionLost: true });
      }
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
    // Push anything logged while offline or signed out BEFORE pulling, so the
    // pull returns it and local/remote agree.
    await flushPending();
    useAuth.setState({ sessionLost: false });
    await pullAll(name);
    await Promise.all([
      fetchLatestInsight(),
      checkStrava(),
      checkTerra(),
      fetchSymptomPatterns(),
      // Re-arm with THIS account's goal — otherwise switching accounts
      // without a cold app launch keeps the previous account's reminders
      // (with its goal text) scheduled until the app next restarts.
      syncGoalReminders(useApp.getState().profile),
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

  const [runsQ, crossQ, journalQ, shoesQ, foodQ, favoritesQ, profileQ] = await Promise.all([
    supabase.from('runs').select('*').order('local_date', { ascending: true }),
    supabase.from('cross_training').select('*').order('local_date', { ascending: true }),
    supabase.from('journal_entries').select('*').order('local_date', { ascending: true }),
    supabase.from('shoes').select('*'),
    supabase
      .from('food_logs')
      .select('*')
      .gte('local_date', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
    supabase.from('favorite_foods').select('*').order('created_at', { ascending: true }),
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
  const favoriteFoods: FavoriteFood[] = (favoritesQ.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    brand: f.brand ?? undefined,
    servingDesc: f.serving_desc ?? undefined,
    barcode: f.barcode ?? undefined,
    calories: Math.round(Number(f.calories ?? 0)),
    proteinG: Math.round(Number(f.protein_g ?? 0)),
    carbsG: Math.round(Number(f.carbs_g ?? 0)),
    fatG: Math.round(Number(f.fat_g ?? 0)),
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
    // Assigned unconditionally (unlike the fields above): these must always
    // overwrite on hydrate, even when absent from this account's row, or
    // switching accounts on the same device leaks the previous account's
    // goal into the merge in hydrateRemote().
    profile.personalGoal = p.personal_goal || undefined;
    profile.personalGoalDate = p.personal_goal_date || undefined;
    profile.goalReminder = ['off', 'daily', 'every3', 'weekly'].includes(p.goal_reminder)
      ? p.goal_reminder
      : 'off';
    profile.goalReminderMinute = p.goal_reminder_minute != null ? Number(p.goal_reminder_minute) : 480;
    profile.weekStartsOn = p.week_starts_on === 0 ? 0 : 1;
  } else if (fallbackName) {
    profile.name = fallbackName;
  }
  useAuth.setState({ needsOnboarding: !p?.onboarded_at });

  useApp.getState().hydrateRemote({
    runs,
    cross,
    journal,
    shoes,
    foodLogs,
    favoriteFoods,
    // Absent on accounts created before the plan existed — keep the local one.
    weekPlan: p?.week_plan ? normalizePlan(p.week_plan) : undefined,
    profile,
  });
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

/**
 * Write a row to Supabase, queueing it locally if that isn't possible.
 *
 * Previously these were fire-and-forget with a console.warn — a failed insert
 * was invisible, and the next pull would wipe the local row, so logged runs
 * just disappeared. Now every failure (and every write made while signed out)
 * is queued and replayed by flushPending().
 */
function push(
  table: PendingWrite['table'],
  id: string,
  row: Record<string, unknown>,
  label: string,
  op: PendingWrite['op'] = 'insert'
) {
  const queue = () =>
    useApp.getState().queueWrite({ id, table, op, row, queuedAt: new Date().toISOString() });

  const uid = userId();
  if (!uid) {
    queue();
    return;
  }
  runWrite(table, id, op, row, uid).then(({ error }) => {
    if (!error) return;
    console.warn(`${label} sync failed:`, error.message);
    queue();
    useAuth.setState({
      syncError: `Your ${label} is saved on this device but hasn't reached the cloud yet — it'll sync automatically.`,
    });
  });
}

/** Remove a row locally and remotely, queueing the delete if it can't happen now. */
function pushDelete(table: PendingWrite['table'], id: string, label: string) {
  // Drop any queued insert/update for this row — replaying it would resurrect it.
  useApp.getState().clearPending([id]);
  const uid = userId();
  if (!uid) {
    useApp
      .getState()
      .queueWrite({ id, table, op: 'delete', queuedAt: new Date().toISOString() });
    return;
  }
  runWrite(table, id, 'delete', undefined, uid).then(({ error }) => {
    if (!error) return;
    console.warn(`${label} delete sync failed:`, error.message);
    useApp
      .getState()
      .queueWrite({ id, table, op: 'delete', queuedAt: new Date().toISOString() });
  });
}

function runWrite(
  table: PendingWrite['table'],
  id: string,
  op: PendingWrite['op'],
  row: Record<string, unknown> | undefined,
  uid: string
): PromiseLike<{ error: { message: string } | null }> {
  if (op === 'delete') return supabase.from(table).delete().eq('id', id);
  // update touches only the supplied columns; insert replays as an upsert so a
  // retry after a partial failure can't collide on the primary key.
  if (op === 'update') return supabase.from(table).update(row ?? {}).eq('id', id);
  return supabase.from(table).upsert({ ...row, id, user_id: uid });
}

/** Replay queued writes in order. Every op is idempotent, so retries are safe. */
export async function flushPending(): Promise<number> {
  const uid = userId();
  if (!uid) return 0;
  const queue = useApp.getState().pending;
  if (queue.length === 0) return 0;

  const synced: string[] = [];
  for (const w of queue) {
    const { error } = await runWrite(w.table, w.id, w.op, w.row, uid);
    if (error) console.warn(`flush ${w.op} ${w.table} ${w.id} failed:`, error.message);
    else synced.push(w.id);
  }
  if (synced.length) useApp.getState().clearPending(synced);
  if (synced.length === queue.length) useAuth.setState({ syncError: null });
  return synced.length;
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

  push('runs', id, {
    started_at: `${input.date}T12:00:00Z`,
    local_date: input.date,
    distance_m: Math.round(input.distanceMi * M_PER_MI),
    duration_s: input.durationS,
    workout_type: input.type,
    shoe_id: input.shoeId ?? null,
    rpe: input.rpe ?? null,
    source: 'manual',
  }, 'run');

  if (input.note) {
    push('journal_entries', jid, {
      local_date: input.date,
      run_id: id,
      body: input.note,
    }, 'run note');
    if (userId()) extractSymptoms(jid, input.note);
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
  push('cross_training', id, {
    local_date: input.date,
    activity_type: input.activity,
    duration_min: input.minutes,
    intensity: input.intensity ?? null,
    notes: input.note ?? null,
  }, 'cross-training');
}

export function addJournal(input: Omit<JournalEntry, 'id'>) {
  const id = uuid();
  useApp.getState().addJournal({ ...input, id });
  push('journal_entries', id, {
    local_date: input.date,
    body: input.note ?? null,
    energy: input.energy ?? null,
    soreness: input.soreness ?? null,
    stress: input.stress ?? null,
    sleep_hours: input.sleepHours ?? null,
    sleep_quality: input.sleepQuality ?? null,
  }, 'journal');
  if (input.note && userId()) extractSymptoms(id, input.note);
}

export function addShoe(input: Omit<Shoe, 'id'>) {
  const id = uuid();
  useApp.getState().addShoe({ ...input, id });
  push('shoes', id, {
    brand: input.brand,
    model: input.model,
    lifespan_miles: input.lifespanMiles,
    starting_miles: input.startingMiles,
    color: input.color,
    is_default: input.isDefault ?? false,
  }, 'shoe');
}

export function logFood(input: Omit<FoodLog, 'id'>) {
  const id = uuid();
  useApp.getState().logFood({ ...input, id });
  push('food_logs', id, {
    local_date: input.date,
    meal: input.meal,
    custom_name: input.name.slice(0, 120),
    servings: input.servings,
    calories: input.calories,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
    entry_method: input.entryMethod,
  }, 'food');
}

export function deleteFood(id: string) {
  useApp.getState().deleteFood(id);
  pushDelete('food_logs', id, 'food');
}

export function addFavoriteFood(input: Omit<FavoriteFood, 'id'>) {
  const id = uuid();
  useApp.getState().addFavoriteFood({ ...input, id });
  push('favorite_foods', id, {
    name: input.name,
    brand: input.brand ?? null,
    serving_desc: input.servingDesc ?? null,
    barcode: input.barcode ?? null,
    calories: input.calories,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
  }, 'favorite food');
}

export function removeFavoriteFood(id: string) {
  useApp.getState().removeFavoriteFood(id);
  pushDelete('favorite_foods', id, 'favorite food');
}

/** Edit an existing run. Only editable columns are sent, so a run imported
 *  from Apple Health keeps its source and external_id (and stays deduped). */
export function updateRun(run: Run) {
  useApp.getState().updateRun(run);
  push(
    'runs',
    run.id,
    {
      started_at: `${run.date}T12:00:00Z`,
      local_date: run.date,
      distance_m: Math.round(run.distanceMi * M_PER_MI),
      duration_s: run.durationS,
      workout_type: run.type,
      shoe_id: run.shoeId ?? null,
      rpe: run.rpe ?? null,
    },
    'run',
    'update'
  );
}

export function deleteRun(id: string) {
  useApp.getState().deleteRun(id);
  pushDelete('runs', id, 'run');
}

/** Save the weekly template. Small enough to write whole rather than diff. */
export function saveWeekPlan(plan: PlanDay[]) {
  useApp.getState().setWeekPlan(plan);
  updateProfileRemote({ week_plan: plan });
}

export function updateShoe(shoe: Shoe) {
  useApp.getState().updateShoe(shoe);
  push(
    'shoes',
    shoe.id,
    {
      brand: shoe.brand,
      model: shoe.model,
      lifespan_miles: shoe.lifespanMiles,
      starting_miles: shoe.startingMiles,
      color: shoe.color,
      is_default: shoe.isDefault ?? false,
      retired_at: shoe.retiredAt ?? null,
    },
    'shoe',
    'update'
  );
}

export function deleteShoe(id: string) {
  useApp.getState().deleteShoe(id);
  pushDelete('shoes', id, 'shoe');
}
