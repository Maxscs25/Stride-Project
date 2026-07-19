import { create } from 'zustand';

import type { Insight } from './load';
import { supabase } from './supabase';

/**
 * Claude-written weekly insights (Layer 3), stored in ai_insights by the
 * weekly-insight edge function. Falls back to the on-device rule engine
 * (src/lib/load.ts) when signed out or before the first generation.
 */

export interface RemoteInsight extends Insight {
  createdAt: string;
}

interface InsightRow {
  title: string;
  body_md: string;
  created_at: string;
  recommendations: { slug: string; name?: string; reason: string }[] | null;
  evidence: { status?: string; lines?: string[]; see_professional?: boolean } | null;
}

function mapRow(row: InsightRow): RemoteInsight {
  const status =
    row.evidence?.status === 'caution'
      ? 'caution'
      : row.evidence?.status === 'high'
        ? 'high'
        : 'on-track';
  let body = row.body_md;
  if (row.evidence?.see_professional) {
    body +=
      ' If this pattern persists or involves pain while running, consider checking in with a sports-medicine professional.';
  }
  return {
    status,
    headline: row.title,
    body,
    evidence: row.evidence?.lines ?? [],
    recs: (row.recommendations ?? []).map((r) => ({
      title: r.name ?? r.slug,
      detail: r.reason,
    })),
    createdAt: row.created_at,
  };
}

export const useInsights = create<{
  latest: RemoteInsight | null;
  generating: boolean;
  error: string | null;
}>(() => ({ latest: null, generating: false, error: null }));

export async function fetchLatestInsight() {
  const { data } = await supabase
    .from('ai_insights')
    .select('title, body_md, created_at, recommendations, evidence')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) useInsights.setState({ latest: mapRow(data as InsightRow) });
}

export async function generateInsight() {
  if (useInsights.getState().generating) return;
  useInsights.setState({ generating: true, error: null });
  const { data, error } = await supabase.functions.invoke('weekly-insight');
  if (error || !data || data.error) {
    useInsights.setState({
      generating: false,
      error: 'Could not generate an insight — try again in a moment.',
    });
    console.warn('weekly-insight failed', error ?? data?.error);
    return;
  }
  useInsights.setState({ generating: false, latest: mapRow(data as InsightRow) });
}

export function clearInsights() {
  useInsights.setState({ latest: null, generating: false, error: null });
}
