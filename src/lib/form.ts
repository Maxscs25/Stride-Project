import { create } from 'zustand';

import { uuid } from './format';
import { computeMetrics, overallConfidence, sampleSeries, type Metric } from './gait';
import { supabase } from './supabase';

/**
 * Running-form analysis data layer. The pipeline is:
 *   capture video → pose keypoints → gait metrics (gait.ts) → Claude report.
 * The pose-inference step is the one seam not yet wired (see runPose); the
 * rest — metrics engine, storage, report function — is live. A "sample"
 * path exercises the whole thing with synthetic keypoints for demonstration.
 */

export interface FormFindings {
  summary: string;
  highlights: string[];
  priorities: { metric_key: string; what: string; why: string }[];
  drills: { slug: string; name?: string; reason: string }[];
  disclaimer: string;
}

export interface FormAnalysis {
  id: string;
  createdAt: string;
  view: 'side' | 'rear';
  status: 'uploaded' | 'processing' | 'complete' | 'failed';
  metrics: Metric[];
  confidence: number;
  findings: FormFindings | null;
  sample: boolean;
}

export const useForm = create<{
  analyses: FormAnalysis[];
  loaded: boolean;
  busy: boolean;
  error: string | null;
}>(() => ({ analyses: [], loaded: false, busy: false, error: null }));

interface Row {
  id: string;
  created_at: string;
  view_angle: 'side' | 'rear' | null;
  status: FormAnalysis['status'];
  metrics: { metrics?: Metric[]; confidence?: number; sample?: boolean } | null;
  findings: FormFindings | null;
}

function mapRow(r: Row): FormAnalysis {
  return {
    id: r.id,
    createdAt: r.created_at,
    view: r.view_angle ?? 'side',
    status: r.status,
    metrics: r.metrics?.metrics ?? [],
    confidence: r.metrics?.confidence ?? 0,
    findings: r.findings,
    sample: !!r.metrics?.sample,
  };
}

export async function fetchAnalyses() {
  const { data } = await supabase
    .from('form_analyses')
    .select('id, created_at, view_angle, status, metrics, findings')
    .order('created_at', { ascending: false })
    .limit(20);
  useForm.setState({ analyses: (data ?? []).map((r) => mapRow(r as Row)), loaded: true });
}

export function clearForm() {
  useForm.setState({ analyses: [], loaded: false, error: null });
}

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Store metrics on a new row, then have Claude narrate the report. */
async function analyzeMetrics(
  metrics: Metric[],
  opts: { view: 'side' | 'rear'; sample: boolean; videoPath?: string }
): Promise<string | null> {
  const uid = await currentUid();
  if (!uid) {
    useForm.setState({ error: 'Sign in to analyze your running form.' });
    return null;
  }
  const id = uuid();
  const { error: insErr } = await supabase.from('form_analyses').insert({
    id,
    user_id: uid,
    view_angle: opts.view,
    status: 'processing',
    video_path: opts.videoPath ?? null,
    metrics: { metrics, confidence: overallConfidence(metrics), sample: opts.sample },
  });
  if (insErr) {
    useForm.setState({ error: insErr.message });
    return null;
  }
  await fetchAnalyses();
  const { data, error } = await supabase.functions.invoke('form-analysis', {
    body: { analysis_id: id },
  });
  if (error || data?.error) {
    useForm.setState({ error: 'Could not generate the form report — try again.' });
  }
  await fetchAnalyses();
  return id;
}

/** Demonstrate the full pipeline with synthetic keypoints (clearly a sample). */
export async function runSampleAnalysis(): Promise<string | null> {
  useForm.setState({ busy: true, error: null });
  try {
    const metrics = computeMetrics(sampleSeries());
    return await analyzeMetrics(metrics, { view: 'side', sample: true });
  } finally {
    useForm.setState({ busy: false });
  }
}

/**
 * Pose-inference seam. Given a recorded video URI, produce a PoseSeries.
 * On-device (Apple Vision / MoveNet) or a server GPU (Replicate/Modal) plugs
 * in here. Until then this is honest about being unavailable rather than
 * fabricating keypoints.
 */
export async function analyzeVideo(_videoUri: string): Promise<string | null> {
  useForm.setState({
    error:
      'Video pose analysis is coming next — the capture + metrics + coaching pipeline is ready and waiting on the pose engine. Try a sample analysis to see the output.',
  });
  return null;
}
