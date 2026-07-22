import { create } from 'zustand';

import { supabase } from './supabase';

/** AI-extracted symptom patterns (from symptom_tags, populated by the
 *  journal-extract Haiku function). Surfaces what the coach is noticing. */

export interface SymptomPattern {
  bodyPart: string;
  count: number;
  avgSeverity: number;
  lastType: string;
}

export const useSymptoms = create<{ patterns: SymptomPattern[]; loaded: boolean }>(() => ({
  patterns: [],
  loaded: false,
}));

const LABELS: Record<string, string> = {
  it_band: 'IT band',
  lower_back: 'lower back',
};
export const bodyPartLabel = (p: string) => LABELS[p] ?? p;

export async function fetchSymptomPatterns() {
  const cutoff = new Date(Date.now() - 21 * 864e5).toISOString();
  const { data } = await supabase
    .from('symptom_tags')
    .select('body_part, symptom_type, severity, created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  const byPart = new Map<string, { count: number; sev: number; lastType: string }>();
  for (const row of data ?? []) {
    const cur = byPart.get(row.body_part) ?? { count: 0, sev: 0, lastType: row.symptom_type };
    cur.count += 1;
    cur.sev += row.severity ?? 3;
    byPart.set(row.body_part, cur);
  }
  const patterns: SymptomPattern[] = [...byPart.entries()]
    .map(([bodyPart, v]) => ({
      bodyPart,
      count: v.count,
      avgSeverity: v.sev / v.count,
      lastType: v.lastType,
    }))
    .sort((a, b) => b.count - a.count);

  useSymptoms.setState({ patterns, loaded: true });
}

export function clearSymptoms() {
  useSymptoms.setState({ patterns: [], loaded: false });
}
