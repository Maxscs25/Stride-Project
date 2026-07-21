import { addDays, todayKey, uid, weekStartKey } from './format';
import type {
  ChecklistDef,
  CrossSession,
  FoodLog,
  JournalEntry,
  PersonalRecord,
  Run,
  Shoe,
  WorkoutType,
} from './types';

/**
 * Deterministic demo data: 8 weeks of realistic training relative to "today",
 * shaped so the signal engine has something to say (a mileage ramp, recurring
 * calf tightness in the notes, a nearly worn-out shoe, a shortening sleep
 * pattern). Replaced by real user data once Supabase sync is wired up.
 */

const PACE_S: Record<WorkoutType, number> = {
  easy: 560,
  recovery: 590,
  long: 540,
  tempo: 440,
  intervals: 470,
  race: 390,
  hills: 550,
  other: 560,
};

const RPE: Partial<Record<WorkoutType, number>> = {
  easy: 3,
  recovery: 2,
  long: 5,
  tempo: 7,
  intervals: 8,
};

export interface SeedData {
  runs: Run[];
  cross: CrossSession[];
  journal: JournalEntry[];
  shoes: Shoe[];
  checklistDefs: ChecklistDef[];
  completions: Record<string, Record<string, boolean>>;
  hydration: Record<string, number>;
  prs: PersonalRecord[];
  foodLogs: FoodLog[];
}

export function buildSeed(): SeedData {
  const today = todayKey();
  const curMonday = weekStartKey(today);

  // Per-week distances, index 0 (oldest) .. 7 (current week).
  const plan: { day: number; type: WorkoutType; mi: number[] }[] = [
    { day: 0, type: 'easy', mi: [4, 4, 4, 5, 4, 5, 5, 6] },
    { day: 1, type: 'intervals', mi: [5, 5, 5, 6, 5, 6, 6, 7] },
    { day: 2, type: 'easy', mi: [0, 0, 0, 0, 0, 0, 0, 5] },
    { day: 3, type: 'tempo', mi: [5, 5, 6, 6, 5, 6, 7, 8] },
    { day: 4, type: 'easy', mi: [3, 3, 3, 3, 3, 4, 4, 5] },
    { day: 5, type: 'long', mi: [7, 9, 9, 9, 8, 9, 10, 10] },
    { day: 6, type: 'recovery', mi: [0, 0, 0, 0, 4, 0, 0, 0] },
  ];

  const runs: Run[] = [];
  for (let w = 0; w < 8; w++) {
    const monday = addDays(curMonday, -7 * (7 - w));
    for (const spec of plan) {
      const mi = spec.mi[w];
      if (!mi) continue;
      const date = addDays(monday, spec.day);
      if (date > today) continue;
      const workout = spec.type === 'easy' && spec.day === 2 ? 'easy' : spec.type;
      runs.push({
        id: uid(),
        date,
        distanceMi: mi,
        durationS: Math.round(mi * PACE_S[workout]),
        type: workout,
        shoeId: workout === 'tempo' || workout === 'intervals' ? 'shoe-end' : 'shoe-peg',
        rpe: RPE[workout],
      });
    }
  }

  const cross: CrossSession[] = [2, 3, 5, 6].map((w) => ({
    id: uid(),
    date: addDays(curMonday, -7 * (7 - w) + 2),
    activity: 'strength',
    minutes: 40,
    intensity: 3,
    note: 'Lift: squats, calf raises, core.',
  }));

  const pegRun = runs
    .filter((r) => r.shoeId === 'shoe-peg')
    .reduce((a, r) => a + r.distanceMi, 0);
  const endRun = runs
    .filter((r) => r.shoeId === 'shoe-end')
    .reduce((a, r) => a + r.distanceMi, 0);

  const shoes: Shoe[] = [
    {
      id: 'shoe-peg',
      brand: 'Nike',
      model: 'Pegasus 41',
      lifespanMiles: 400,
      startingMiles: Math.max(0, 368 - pegRun),
      color: '#60A5FA',
      isDefault: true,
    },
    {
      id: 'shoe-end',
      brand: 'Saucony',
      model: 'Endorphin Speed 4',
      lifespanMiles: 300,
      startingMiles: Math.max(0, 141 - endRun),
      color: '#F87171',
    },
  ];

  const j = (
    daysAgo: number,
    note: string,
    vals: Partial<JournalEntry> = {}
  ): JournalEntry => ({
    id: uid(),
    date: addDays(today, -daysAgo),
    note,
    ...vals,
  });

  const journal: JournalEntry[] = [
    j(0, '10 miler done. Tired but satisfied. Right calf got tight again over the last couple miles.', {
      energy: 3,
      soreness: 3,
      sleepHours: 7,
      sleepQuality: 3,
    }),
    j(2, 'Tempo felt harder than it should have. Legs heavy — slept badly last night.', {
      energy: 2,
      soreness: 2,
      sleepHours: 5.5,
      sleepQuality: 2,
    }),
    j(4, 'Workout went fine. Calf a little stiff during warmup, loosened up after a mile.', {
      energy: 3,
      sleepHours: 6,
      sleepQuality: 3,
    }),
    j(5, 'Easy shakeout, calf still tight from the weekend. Rolled it out after.', {
      soreness: 3,
      sleepHours: 7,
      sleepQuality: 3,
    }),
    j(7, 'Long run solid. Right calf tightness showed up around mile 8 again.', {
      energy: 4,
      soreness: 3,
      sleepHours: 7.5,
      sleepQuality: 4,
    }),
    j(9, 'Nice easy day, felt smooth.', { energy: 4, sleepHours: 7, sleepQuality: 4 }),
    j(11, '8x400 went great — strong on the last two reps.', {
      energy: 5,
      sleepHours: 8,
      sleepQuality: 5,
    }),
    j(14, 'Long run: felt strong through 8, calf a touch tight late.', {
      energy: 4,
      soreness: 2,
      sleepHours: 7,
      sleepQuality: 4,
    }),
  ];

  const checklistDefs: ChecklistDef[] = [
    { key: 'run', label: 'Run', icon: 'walk', auto: 'run' },
    { key: 'stretch', label: 'Stretch 10 min', icon: 'body' },
    { key: 'strength', label: 'Strength / PT', icon: 'barbell', days: [2, 5] },
    { key: 'sleep', label: 'Sleep 8+ hours', icon: 'moon' },
    { key: 'water', label: 'Drink 64 oz water', icon: 'water' },
    { key: 'journal', label: 'Journal how you felt', icon: 'create', auto: 'journal' },
  ];

  const completions: Record<string, Record<string, boolean>> = {};
  const mark = (date: string, key: string) => {
    completions[date] = { ...(completions[date] ?? {}), [key]: true };
  };
  for (const r of runs) mark(r.date, 'run');
  for (const entry of journal) mark(entry.date, 'journal');
  for (let d = 1; d <= 16; d++) {
    const date = addDays(today, -d);
    if (d !== 13) mark(date, 'stretch');
    if (d <= 10) mark(date, 'water');
    if (d % 2 === 0) mark(date, 'sleep');
  }

  const hydration: Record<string, number> = { [today]: 750 };

  const prs: PersonalRecord[] = [
    { dist: '5K', time: '19:42', date: '2026-04-18' },
    { dist: '10K', time: '41:37', date: '2026-05-30' },
    { dist: 'Half Marathon', time: '1:33:05', date: '2026-03-08' },
  ];

  const foodLogs: FoodLog[] = [
    { id: uid(), date: today, meal: 'breakfast', name: 'Oatmeal with banana & peanut butter', servings: 1, calories: 420, proteinG: 14, carbsG: 62, fatG: 14, entryMethod: 'search' },
    { id: uid(), date: today, meal: 'lunch', name: 'Chicken burrito bowl', servings: 1, calories: 680, proteinG: 46, carbsG: 74, fatG: 22, entryMethod: 'search' },
    { id: uid(), date: today, meal: 'snack', name: 'Greek yogurt & granola', servings: 1, calories: 260, proteinG: 18, carbsG: 32, fatG: 6, entryMethod: 'search' },
  ];

  return { runs, cross, journal, shoes, checklistDefs, completions, hydration, prs, foodLogs };
}
