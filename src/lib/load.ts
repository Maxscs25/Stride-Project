import { addDays, round1, todayKey, weekStartKey } from './format';
import type { CrossSession, JournalEntry, Run, Shoe, WorkoutType } from './types';

/**
 * Deterministic training-load signal engine (client-side mirror of the
 * Supabase SQL version in supabase/migrations/0003_signal_engine.sql).
 * The LLM layer narrates these outputs — it never invents the math.
 */

const TYPE_RPE: Record<WorkoutType, number> = {
  easy: 3,
  recovery: 2,
  long: 5,
  tempo: 7,
  intervals: 8,
  race: 9,
  hills: 6,
  other: 4,
};

/** Typical RPE for a workout type, used when a run has no explicitly logged RPE. */
export const typeRpe = (t: WorkoutType) => TYPE_RPE[t];

export const runLoad = (r: Run) => (r.durationS / 60) * (r.rpe ?? TYPE_RPE[r.type]);
// Cross-training counts at a reduced impact factor for injury-risk purposes.
export const crossLoad = (c: CrossSession) => c.minutes * (c.intensity ?? 3) * 0.6;

export function dailyLoads(runs: Run[], cross: CrossSession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of runs) map.set(r.date, (map.get(r.date) ?? 0) + runLoad(r));
  for (const c of cross) map.set(c.date, (map.get(c.date) ?? 0) + crossLoad(c));
  return map;
}

export interface LoadPoint {
  date: string;
  load: number;
  acute: number; // 7-day EWMA
  chronic: number; // 28-day EWMA
  acwr: number;
}

export function loadSeries(runs: Run[], cross: CrossSession[], days = 56): LoadPoint[] {
  const map = dailyLoads(runs, cross);
  const la = 2 / 8; // 7-day EWMA smoothing
  const lc = 2 / 29; // 28-day EWMA smoothing
  let acute = 0;
  let chronic = 0;
  const start = addDays(todayKey(), -89);
  const out: LoadPoint[] = [];
  for (let i = 0; i < 90; i++) {
    const k = addDays(start, i);
    const l = map.get(k) ?? 0;
    acute = la * l + (1 - la) * acute;
    chronic = lc * l + (1 - lc) * chronic;
    out.push({ date: k, load: l, acute, chronic, acwr: chronic > 5 ? acute / chronic : 1 });
  }
  return out.slice(-days);
}

/** Miles for the week containing today minus weeksBack weeks. */
export function weeklyMiles(runs: Run[], weeksBack: number): number {
  const start = addDays(weekStartKey(todayKey()), -7 * weeksBack);
  const end = addDays(start, 6);
  return round1(
    runs.filter((r) => r.date >= start && r.date <= end).reduce((a, r) => a + r.distanceMi, 0)
  );
}

export function weeklyMileSeries(runs: Run[], nWeeks: number) {
  const out: { weekStart: string; miles: number }[] = [];
  for (let i = nWeeks - 1; i >= 0; i--) {
    out.push({ weekStart: addDays(weekStartKey(todayKey()), -7 * i), miles: weeklyMiles(runs, i) });
  }
  return out;
}

export function shoeMiles(shoe: Shoe, runs: Run[]): number {
  return round1(
    shoe.startingMiles +
      runs.filter((r) => r.shoeId === shoe.id).reduce((a, r) => a + r.distanceMi, 0)
  );
}

const BODY_PARTS = [
  'calf',
  'knee',
  'shin',
  'hip',
  'hamstring',
  'achilles',
  'ankle',
  'foot',
  'quad',
  'it band',
  'glute',
];
const SYMPTOM_WORDS = ['tight', 'sore', 'pain', 'ache', 'stiff', 'tender', 'niggle'];

export function symptomMentions(journal: JournalEntry[], days = 14): Record<string, number> {
  const cutoff = addDays(todayKey(), -days);
  const counts: Record<string, number> = {};
  for (const j of journal) {
    if (j.date < cutoff || !j.note) continue;
    const t = j.note.toLowerCase();
    for (const part of BODY_PARTS) {
      if (t.includes(part) && SYMPTOM_WORDS.some((s) => t.includes(s))) {
        counts[part] = (counts[part] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export type Severity = 'info' | 'caution' | 'high';

export interface Signal {
  kind: 'ramp' | 'acwr' | 'symptom' | 'sleep' | 'shoe' | 'consistency';
  severity: Severity;
  title: string;
  detail: string;
}

interface EngineInput {
  runs: Run[];
  cross: CrossSession[];
  journal: JournalEntry[];
  shoes: Shoe[];
}

export function computeSignals({ runs, cross, journal, shoes }: EngineInput): Signal[] {
  const signals: Signal[] = [];

  // Weekly mileage ramp
  const cur = weeklyMiles(runs, 0);
  const prev = weeklyMiles(runs, 1);
  if (prev >= 10 && cur > prev * 1.25) {
    const pct = Math.round(((cur - prev) / prev) * 100);
    signals.push({
      kind: 'ramp',
      severity: cur > prev * 1.35 ? 'high' : 'caution',
      title: 'Mileage ramping fast',
      detail: `This week: ${cur} mi vs ${prev} mi last week (+${pct}%). Jumps above ~25% are associated with elevated injury risk.`,
    });
  }

  // Acute:chronic workload ratio
  const series = loadSeries(runs, cross, 1);
  const acwr = series[series.length - 1]?.acwr ?? 1;
  if (acwr > 1.3) {
    signals.push({
      kind: 'acwr',
      severity: acwr > 1.5 ? 'high' : 'caution',
      title: 'Training load above your base',
      detail: `Acute:chronic load ratio is ${acwr.toFixed(2)} — above the ~0.8–1.3 zone your body is adapted to.`,
    });
  }

  // Recurring symptoms from journal notes
  const mentions = symptomMentions(journal);
  for (const [part, n] of Object.entries(mentions)) {
    if (n >= 3) {
      signals.push({
        kind: 'symptom',
        severity: 'caution',
        title: `Recurring ${part} tightness`,
        detail: `You've mentioned your ${part} in ${n} journal entries over the last 14 days.`,
      });
    }
  }

  // Sleep debt
  const sleepVals = journal
    .filter((j) => j.date >= addDays(todayKey(), -7) && j.sleepHours != null)
    .map((j) => j.sleepHours as number);
  if (sleepVals.length >= 3) {
    const avg = sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length;
    if (avg < 6.75) {
      signals.push({
        kind: 'sleep',
        severity: 'caution',
        title: 'Sleep running low',
        detail: `Averaging ${avg.toFixed(1)}h over the last week while training load is up. Recovery happens in your sleep.`,
      });
    }
  }

  // Shoe wear
  for (const shoe of shoes) {
    if (shoe.retiredAt) continue;
    const miles = shoeMiles(shoe, runs);
    const pct = miles / shoe.lifespanMiles;
    if (pct >= 0.9) {
      signals.push({
        kind: 'shoe',
        severity: 'info',
        title: `${shoe.model} nearly worn out`,
        detail: `${Math.round(miles)} of ${shoe.lifespanMiles} mi used — about ${Math.max(0, Math.round(shoe.lifespanMiles - miles))} mi left. Worn cushioning increases impact loading.`,
      });
    }
  }

  // Consistency win
  const weeksWith4Runs = [1, 2, 3].every(
    (w) =>
      runs.filter(
        (r) =>
          r.date >= addDays(weekStartKey(todayKey()), -7 * w) &&
          r.date <= addDays(weekStartKey(todayKey()), -7 * w + 6)
      ).length >= 4
  );
  if (weeksWith4Runs) {
    signals.push({
      kind: 'consistency',
      severity: 'info',
      title: 'Three consistent weeks',
      detail: '4+ runs each of the last 3 weeks. Consistency is the single best predictor of long-term improvement.',
    });
  }

  return signals;
}

export interface Insight {
  status: 'on-track' | 'caution' | 'high';
  headline: string;
  body: string;
  evidence: string[];
  recs: { title: string; detail: string }[];
}

const REC_LIBRARY: Record<string, { title: string; detail: string }[]> = {
  ramp: [
    {
      title: 'Cap this week where it is',
      detail: 'Swap any remaining quality for easy miles and keep next week at or below this one.',
    },
    {
      title: 'Plan a down week',
      detail: 'Cut volume ~20% next week to let your body absorb the jump.',
    },
  ],
  acwr: [
    {
      title: 'Insert an extra easy day',
      detail: 'One more genuinely easy day this week brings your acute load back toward base.',
    },
  ],
  symptom_calf: [
    {
      title: 'Eccentric calf raises',
      detail: '3×15 slow lowers off a step, both legs, after easy runs.',
    },
    {
      title: 'Post-run calf stretch + roll',
      detail: '2 min per side, gastroc and soleus, while muscles are warm.',
    },
  ],
  symptom: [
    {
      title: 'Targeted mobility',
      detail: '5–10 min of focused mobility for the affected area after each run.',
    },
  ],
  sleep: [
    {
      title: 'Protect an 8-hour window',
      detail: 'Set a consistent lights-out time this week — adaptation happens overnight.',
    },
  ],
  shoe: [
    {
      title: 'Start rotating in a replacement',
      detail: 'Break in a new pair on short easy runs before this one retires.',
    },
  ],
};

export function buildInsight(input: EngineInput): Insight {
  const signals = computeSignals(input);
  const high = signals.filter((s) => s.severity === 'high');
  const caution = signals.filter((s) => s.severity === 'caution');
  const wins = signals.filter((s) => s.kind === 'consistency');

  const status: Insight['status'] = high.length ? 'high' : caution.length ? 'caution' : 'on-track';

  const recs: Insight['recs'] = [];
  for (const s of [...high, ...caution]) {
    const key =
      s.kind === 'symptom' && s.title.includes('calf') ? 'symptom_calf' : s.kind;
    for (const r of REC_LIBRARY[key] ?? []) {
      if (recs.length < 3 && !recs.some((x) => x.title === r.title)) recs.push(r);
    }
  }

  let headline: string;
  let body: string;
  if (status === 'on-track') {
    headline = wins.length ? 'Consistency looks great' : 'Training is on track';
    body =
      'Load, recovery and mileage are all inside your normal ranges. Keep stacking healthy weeks.';
  } else {
    const top = high[0] ?? caution[0];
    headline = top.title;
    const parts = [...high, ...caution]
      .slice(0, 2)
      .map((s) => s.detail.split('. ')[0].replace(/\.$/, ''));
    body =
      parts.join('. ') +
      '. Nothing here says stop — it says be deliberate for a few days.';
  }
  if (wins.length && status !== 'on-track') {
    body += ' Meanwhile: ' + wins[0].detail;
  }

  return {
    status,
    headline,
    body,
    evidence: signals.filter((s) => s.kind !== 'consistency').map((s) => s.detail),
    recs,
  };
}
