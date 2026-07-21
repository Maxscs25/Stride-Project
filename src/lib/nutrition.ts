import { addDays, todayKey } from './format';
import type { FoodLog, Profile, Run } from './types';

/** Mifflin-St Jeor BMR. */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === 'male' ? 5 : -161));
}

/** Approx. running energy cost: ~1.0 kcal per kg per km. */
export function runKcal(p: Profile, miles: number): number {
  return Math.round(miles * 1.60934 * p.weightKg);
}

export interface DailyNutrition {
  baseKcal: number;
  runKcal: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function dailyTargets(p: Profile, todayMiles: number): DailyNutrition {
  const base = Math.round(bmr(p) * 1.55); // moderately active baseline
  const run = runKcal(p, todayMiles);
  const target = base + run;
  const proteinG = Math.round(p.weightKg * 1.7);
  const carbsG = Math.round(p.weightKg * (todayMiles > 8 ? 7 : todayMiles > 0 ? 6 : 5));
  const fatG = Math.round(Math.max(0, target - proteinG * 4 - carbsG * 4) / 9);
  return { baseKcal: base, runKcal: run, targetKcal: target, proteinG, carbsG, fatG };
}

export interface FuelStatus {
  days: number;
  avgIntake: number;
  avgNeed: number;
  deficitPct: number;
  level: 'good' | 'low' | 'insufficient_data';
  message: string;
}

/**
 * Educational under-fueling check: compares logged intake against dynamic needs
 * over the last 7 days. Only speaks up when enough days are logged — otherwise
 * honestly reports "insufficient data" rather than guessing.
 */
export function fuelStatus(p: Profile, runs: Run[], food: FoodLog[]): FuelStatus {
  let loggedDays = 0;
  let sumIntake = 0;
  let sumNeed = 0;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(todayKey(), -i);
    const intake = food.filter((f) => f.date === d).reduce((a, f) => a + f.calories, 0);
    if (intake <= 0) continue; // only count days the runner actually logged
    const miles = runs.filter((r) => r.date === d).reduce((a, r) => a + r.distanceMi, 0);
    loggedDays++;
    sumIntake += intake;
    sumNeed += dailyTargets(p, miles).targetKcal;
  }

  if (loggedDays < 3) {
    return {
      days: loggedDays,
      avgIntake: 0,
      avgNeed: 0,
      deficitPct: 0,
      level: 'insufficient_data',
      message: 'Log a few full days of food and Stride will check whether you\'re fueling your training well.',
    };
  }

  const avgIntake = Math.round(sumIntake / loggedDays);
  const avgNeed = Math.round(sumNeed / loggedDays);
  const deficitPct = Math.round(((avgNeed - avgIntake) / avgNeed) * 100);

  if (deficitPct >= 15) {
    return {
      days: loggedDays,
      avgIntake,
      avgNeed,
      deficitPct,
      level: 'low',
      message: `Your training needed about ${avgNeed.toLocaleString()} kcal/day this week but you averaged ${avgIntake.toLocaleString()}. Consistently under-fueling during heavy training can slow recovery and raise injury and bone-health risk — consider adding an easy snack around your runs. This is educational guidance, not medical advice.`,
    };
  }

  return {
    days: loggedDays,
    avgIntake,
    avgNeed,
    deficitPct,
    level: 'good',
    message: `You've averaged ${avgIntake.toLocaleString()} kcal/day against a need of ~${avgNeed.toLocaleString()} — nicely matched to your training.`,
  };
}
