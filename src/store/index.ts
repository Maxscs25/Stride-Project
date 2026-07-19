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
} from '@/lib/types';

interface AppState extends SeedData {
  profile: Profile;
  logRun: (r: Omit<Run, 'id'>) => void;
  logCross: (c: Omit<CrossSession, 'id'>) => void;
  addJournal: (j: Omit<JournalEntry, 'id'>) => void;
  toggleItem: (date: string, key: string) => void;
  addWater: (ml: number) => void;
  setWeeklyGoal: (mi: number) => void;
  resetDemo: () => void;
}

const seed = buildSeed();

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...seed,
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
          runs: [...s.runs, { ...r, id: uid() }],
          completions: {
            ...s.completions,
            [r.date]: { ...(s.completions[r.date] ?? {}), run: true },
          },
        })),

      logCross: (c) => set((s) => ({ cross: [...s.cross, { ...c, id: uid() }] })),

      addJournal: (j) =>
        set((s) => ({
          journal: [...s.journal, { ...j, id: uid() }],
          completions: {
            ...s.completions,
            [j.date]: { ...(s.completions[j.date] ?? {}), journal: true },
          },
        })),

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

      resetDemo: () => set({ ...buildSeed() }),
    }),
    {
      name: 'stride-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
