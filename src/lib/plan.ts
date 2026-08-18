import { DEFAULT_WEEK_PLAN, WORKOUT_META, type PlanDay, type PlanDayType } from './types';

/**
 * Turns a weekly mileage goal into a per-day target.
 *
 * Deliberately deterministic rather than an LLM call: splitting a week's
 * volume across day types is arithmetic a coach does by rule of thumb, and
 * doing it locally means it's instant, free, works offline, and gives the same
 * answer every time. That matches how the rest of the app is built — the
 * signal engine computes, and Claude only narrates.
 */

/** Relative share of weekly volume per day type. Long runs carry the most,
 *  quality days sit in the middle, recovery days are deliberately short. */
const WEIGHT: Record<PlanDayType, number> = {
  long: 2,
  race: 1.6,
  tempo: 1.3,
  intervals: 1.3,
  hills: 1.3,
  easy: 1,
  other: 1,
  recovery: 0.6,
  rest: 0,
};

export function planTypeLabel(t: PlanDayType): string {
  return t === 'rest' ? 'Rest' : WORKOUT_META[t].label;
}

export function planTypeColor(t: PlanDayType, muted: string): string {
  return t === 'rest' ? muted : WORKOUT_META[t].color;
}

export const planTotal = (plan: PlanDay[]) =>
  Math.round(plan.reduce((a, d) => a + d.miles, 0) * 10) / 10;

/** The template row for a YYYY-MM-DD date. The date is parsed inline rather
 *  than via format.ts so this module stays pure arithmetic with no native
 *  dependencies — which also makes it testable outside the app. */
export function plannedFor(plan: PlanDay[], dateKey: string): PlanDay | undefined {
  const [y, m, d] = dateKey.split('-').map(Number);
  return plan.find((p) => p.dow === new Date(y, m - 1, d).getDay());
}

/**
 * Spread `weeklyGoal` across the plan by day-type weight, rounded to half
 * miles. Rounding drift is pushed onto the biggest day so the week still adds
 * up to exactly the goal.
 */
export function distributeMiles(plan: PlanDay[], weeklyGoal: number): PlanDay[] {
  const total = plan.reduce((a, d) => a + WEIGHT[d.type], 0);
  if (total <= 0 || weeklyGoal <= 0) return plan.map((d) => ({ ...d, miles: 0 }));

  const out = plan.map((d) => ({
    ...d,
    miles: Math.round(((weeklyGoal * WEIGHT[d.type]) / total) * 2) / 2,
  }));

  const drift = Math.round((weeklyGoal - planTotal(out)) * 2) / 2;
  if (drift !== 0) {
    let biggest = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i].type !== 'rest' && (biggest < 0 || out[i].miles > out[biggest].miles)) biggest = i;
    }
    if (biggest >= 0) out[biggest].miles = Math.max(0, out[biggest].miles + drift);
  }
  return out;
}

/** Normalize whatever came back from storage into exactly seven ordered days. */
export function normalizePlan(raw: unknown): PlanDay[] {
  if (!Array.isArray(raw)) return DEFAULT_WEEK_PLAN;
  return DEFAULT_WEEK_PLAN.map((fallback) => {
    const found = raw.find((d) => (d as PlanDay)?.dow === fallback.dow) as PlanDay | undefined;
    if (!found || !(found.type in WEIGHT)) return fallback;
    return { dow: fallback.dow, type: found.type, miles: Number(found.miles) || 0 };
  });
}
