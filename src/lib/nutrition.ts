import type { Profile } from './types';

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
