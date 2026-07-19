import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { todayKey, uid } from '@/lib/format';
import { buildSeed, type SeedData } from '@/lib/seed';
import type {
  CrossSession,
  JournalEntry,
  Profile,
  Run,
  Shoe,
} from '@/lib/types';

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

interface RemoteData {
  runs: Run[];
  cross: CrossSession[];
  journal: JournalEntry[];
  shoes: Shoe[];
  name?: string;
}

interface AppState extends SeedData {
  profile: Profile;
  /** True while showing generated sample data (signed out). */
  demoMode: boolean;
  logRun: (r: WithOptionalId<Run>) => void;
  logCross: (c: WithOptionalId<CrossSession>) => void;
  addJournal: (j: WithOptionalId<JournalEntry>) => void;
  addShoe: (s: WithOptionalId<Shoe>) => void;
  toggleItem: (date: string, key: string) => void;
  addWater: (ml: number) => void;
  setWeeklyGoal: (mi: number) => void;
  /** Replace demo data with the signed-in user's cloud data. */
  hydrateRemote: (d: RemoteData) => void;
  resetDemo: () => void;
}

const seed = buildSeed();

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...seed,
      demoMode: true,
      profile: {
        name: 'Runner',
        weeklyGoalMi: 35,
        raceGoal: 'Sub-19 5K · Oct 10',
        heightCm: 178,
        weightKg: 66,
        age: 19,
        sex: 'male',
      },

      logRun: (r) =>
        set((s) => ({
          runs: [...s.runs, { ...r, id: r.id ?? uid() }],
          completions: {
            ...s.completions,
            [r.date]: { ...(s.completions[r.date] ?? {}), run: true },
          },
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

      hydrateRemote: (d) =>
        set((s) => {
          // Demo-only artifacts don't carry into a real account; auto-tracked
          // checklist items are re-derived from the pulled data.
          const completions = s.demoMode ? {} : { ...s.completions };
          for (const r of d.runs)
            completions[r.date] = { ...(completions[r.date] ?? {}), run: true };
          for (const j of d.journal)
            completions[j.date] = { ...(completions[j.date] ?? {}), journal: true };
          return {
            runs: d.runs,
            cross: d.cross,
            journal: d.journal,
            shoes: d.shoes,
            completions,
            hydration: s.demoMode ? {} : s.hydration,
            prs: s.demoMode ? [] : s.prs,
            demoMode: false,
            profile: d.name ? { ...s.profile, name: d.name } : s.profile,
          };
        }),

      resetDemo: () => set({ ...buildSeed(), demoMode: true }),
    }),
    {
      name: 'stride-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
