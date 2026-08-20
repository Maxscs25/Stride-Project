import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setWeekStart, todayKey, uid } from '@/lib/format';
import { buildSeed, type SeedData } from '@/lib/seed';
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
} from '@/lib/types';
import { DEFAULT_WEEK_PLAN } from '@/lib/types';

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

interface RemoteData {
  runs: Run[];
  cross: CrossSession[];
  journal: JournalEntry[];
  shoes: Shoe[];
  foodLogs: FoodLog[];
  favoriteFoods: FavoriteFood[];
  weekPlan?: PlanDay[];
  profile?: Partial<Profile>;
}

interface AppState extends SeedData {
  profile: Profile;
  /** True while showing generated sample data (signed out). */
  demoMode: boolean;
  /** Recurring weekly template: what each weekday is for + target miles. */
  weekPlan: PlanDay[];
  setWeekPlan: (p: PlanDay[]) => void;
  /** Writes not yet confirmed on the server; replayed on the next sign-in. */
  pending: PendingWrite[];
  queueWrite: (w: PendingWrite) => void;
  clearPending: (ids: string[]) => void;
  logRun: (r: WithOptionalId<Run>) => void;
  updateRun: (r: Run) => void;
  deleteRun: (id: string) => void;
  updateShoe: (s: Shoe) => void;
  deleteShoe: (id: string) => void;
  logCross: (c: WithOptionalId<CrossSession>) => void;
  addJournal: (j: WithOptionalId<JournalEntry>) => void;
  addShoe: (s: WithOptionalId<Shoe>) => void;
  logFood: (f: WithOptionalId<FoodLog>) => void;
  deleteFood: (id: string) => void;
  addFavoriteFood: (f: WithOptionalId<FavoriteFood>) => void;
  removeFavoriteFood: (id: string) => void;
  toggleItem: (date: string, key: string) => void;
  addWater: (ml: number) => void;
  setWeeklyGoal: (mi: number) => void;
  setProfile: (p: Partial<Profile>) => void;
  setChecklistDisabled: (key: string, disabled: boolean) => void;
  /** Replace demo data with the signed-in user's cloud data. */
  hydrateRemote: (d: RemoteData) => void;
  resetDemo: () => void;
}

const seed = buildSeed();

/**
 * Merge server rows with local rows that are still queued for upload.
 *
 * A pull used to replace each list outright, so anything logged while offline
 * or signed out was silently destroyed the moment the app re-synced. Only rows
 * present in `pending` are carried over — seeded demo data is never queued, so
 * it can't leak into a real account.
 */
/**
 * Re-derive the auto-ticked "run" checklist item from the runs that actually
 * exist. Editing a run's date or deleting it must not leave a tick behind on a
 * day with no run; manually-toggled items are left alone.
 */
function recomputeRunTicks(
  completions: Record<string, Record<string, boolean>>,
  runs: Run[]
): Record<string, Record<string, boolean>> {
  const days = new Set(runs.map((r) => r.date));
  const next: Record<string, Record<string, boolean>> = {};
  for (const [date, items] of Object.entries(completions)) {
    const { run: _run, ...rest } = items;
    next[date] = days.has(date) ? { ...rest, run: true } : rest;
  }
  for (const date of days) {
    if (!next[date]) next[date] = { run: true };
  }
  return next;
}

function keepPending<T extends { id: string }>(
  server: T[],
  local: T[],
  table: PendingWrite['table'],
  pending: PendingWrite[]
): T[] {
  const queued = new Set(pending.filter((p) => p.table === table).map((p) => p.id));
  if (queued.size === 0) return server;
  const onServer = new Set(server.map((r) => r.id));
  return [...server, ...local.filter((r) => queued.has(r.id) && !onServer.has(r.id))];
}

// Shared by the initial state and resetDemo() so signing out actually clears
// a previous account's profile — not just its runs/journal/etc — rather than
// leaving another account's name and goal visible in demo mode.
const DEFAULT_PROFILE: Profile = {
  name: 'Runner',
  weeklyGoalMi: 35,
  raceGoal: 'Sub-19 5K · Oct 10',
  weekStartsOn: 1,
  goalReminder: 'off',
  goalReminderMinute: 480,
  heightCm: 178,
  weightKg: 66,
  age: 19,
  sex: 'male',
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...seed,
      demoMode: true,
      profile: DEFAULT_PROFILE,
      weekPlan: DEFAULT_WEEK_PLAN,
      pending: [],

      setWeekPlan: (p) => set({ weekPlan: p }),

      queueWrite: (w) =>
        set((s) => ({ pending: [...s.pending.filter((p) => p.id !== w.id), w] })),

      clearPending: (ids) =>
        set((s) => ({ pending: s.pending.filter((p) => !ids.includes(p.id)) })),

      logRun: (r) =>
        set((s) => ({
          runs: [...s.runs, { ...r, id: r.id ?? uid() }],
          completions: {
            ...s.completions,
            [r.date]: { ...(s.completions[r.date] ?? {}), run: true },
          },
        })),

      updateRun: (run) =>
        set((s) => {
          const runs = s.runs.map((r) => (r.id === run.id ? run : r));
          // Moving a run to another day can leave the old day's auto-ticked
          // "run" checklist item set with nothing behind it.
          return { runs, completions: recomputeRunTicks(s.completions, runs) };
        }),

      deleteRun: (id) =>
        set((s) => {
          const runs = s.runs.filter((r) => r.id !== id);
          return { runs, completions: recomputeRunTicks(s.completions, runs) };
        }),

      updateShoe: (shoe) =>
        set((s) => ({ shoes: s.shoes.map((x) => (x.id === shoe.id ? shoe : x)) })),

      // Runs are kept; they just stop counting toward any shoe. The DB mirrors
      // this with `shoe_id ... on delete set null`. Splits have to be pruned
      // here too, or the deleted shoe's share would linger in the run's jsonb.
      deleteShoe: (id) =>
        set((s) => ({
          shoes: s.shoes.filter((x) => x.id !== id),
          runs: s.runs.map((r) => {
            if (r.shoeSplits?.some((sp) => sp.shoeId === id)) {
              const kept = r.shoeSplits.filter((sp) => sp.shoeId !== id);
              return { ...r, shoeSplits: kept.length ? kept : undefined };
            }
            return r.shoeId === id ? { ...r, shoeId: undefined } : r;
          }),
        })),

      logCross: (c) =>
        set((s) => ({ cross: [...s.cross, { ...c, id: c.id ?? uid() }] })),

      addJournal: (j) =>
        set((s) => ({
          journal: [...s.journal, { ...j, id: j.id ?? uid() }],
          completions: {
            ...s.completions,
            [j.date]: { ...(s.completions[j.date] ?? {}), journal: true },
          },
        })),

      addShoe: (shoe) =>
        set((s) => ({ shoes: [...s.shoes, { ...shoe, id: shoe.id ?? uid() }] })),

      logFood: (f) =>
        set((s) => ({ foodLogs: [...s.foodLogs, { ...f, id: f.id ?? uid() }] })),

      deleteFood: (id) =>
        set((s) => ({ foodLogs: s.foodLogs.filter((f) => f.id !== id) })),

      addFavoriteFood: (f) =>
        set((s) => ({ favoriteFoods: [...s.favoriteFoods, { ...f, id: f.id ?? uid() }] })),

      removeFavoriteFood: (id) =>
        set((s) => ({ favoriteFoods: s.favoriteFoods.filter((f) => f.id !== id) })),

      toggleItem: (date, key) =>
        set((s) => ({
          completions: {
            ...s.completions,
            [date]: {
              ...(s.completions[date] ?? {}),
              [key]: !s.completions[date]?.[key],
            },
          },
        })),

      addWater: (ml) =>
        set((s) => {
          const t = todayKey();
          return { hydration: { ...s.hydration, [t]: (s.hydration[t] ?? 0) + ml } };
        }),

      setWeeklyGoal: (mi) =>
        set((s) => ({ profile: { ...s.profile, weeklyGoalMi: Math.max(5, mi) } })),

      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

      setChecklistDisabled: (key, disabled) =>
        set((s) => ({
          checklistDefs: s.checklistDefs.map((d) => (d.key === key ? { ...d, disabled } : d)),
        })),

      hydrateRemote: (d) =>
        set((s) => {
          const p = s.pending;
          const runs = keepPending(d.runs, s.runs, 'runs', p);
          const journal = keepPending(d.journal, s.journal, 'journal_entries', p);
          // Demo-only artifacts don't carry into a real account; auto-tracked
          // checklist items are re-derived from the pulled data.
          const completions = s.demoMode ? {} : { ...s.completions };
          for (const r of runs)
            completions[r.date] = { ...(completions[r.date] ?? {}), run: true };
          for (const j of journal)
            completions[j.date] = { ...(completions[j.date] ?? {}), journal: true };
          return {
            runs,
            cross: keepPending(d.cross, s.cross, 'cross_training', p),
            journal,
            shoes: keepPending(d.shoes, s.shoes, 'shoes', p),
            foodLogs: keepPending(d.foodLogs, s.foodLogs, 'food_logs', p),
            favoriteFoods: keepPending(d.favoriteFoods, s.favoriteFoods, 'favorite_foods', p),
            weekPlan: d.weekPlan ?? s.weekPlan,
            completions,
            hydration: s.demoMode ? {} : s.hydration,
            prs: s.demoMode ? [] : s.prs,
            demoMode: false,
            profile: d.profile ? { ...s.profile, ...d.profile } : s.profile,
          };
        }),

      // Only reached on an *explicit* sign-out (sync.ts flushes pending writes
      // first). Clearing the queue here stops one account's unsynced rows from
      // being replayed into whichever account signs in next.
      resetDemo: () =>
        set({
          ...buildSeed(),
          demoMode: true,
          profile: DEFAULT_PROFILE,
          weekPlan: DEFAULT_WEEK_PLAN,
          pending: [],
        }),
    }),
    {
      name: 'stride-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Rehydrating from disk bypasses subscribe, so re-apply on load too.
      onRehydrateStorage: () => (state) => {
        if (state) setWeekStart(state.profile.weekStartsOn ?? 1);
      },
    }
  )
);

// Mirror the week-start preference into format.ts, which the week-boundary
// math reads. Subscribing (rather than threading a param through every caller)
// keeps this in step; the store stays the source of truth, so components still
// re-render off profile changes and then read the updated value.
setWeekStart(useApp.getState().profile.weekStartsOn ?? 1);
useApp.subscribe((s) => setWeekStart(s.profile.weekStartsOn ?? 1));
