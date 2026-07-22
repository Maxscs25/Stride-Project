import { create } from 'zustand';

import { extractPose, isPoseAvailable } from '../../modules/expo-pose';
import { uuid } from './format';
import { computeMetrics, overallConfidence, sampleSeries, type Frame, type Metric } from './gait';
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
 * Real video → on-device pose (Apple Vision) → gait metrics → Claude report.
 * Degrades honestly when the native pose module isn't in the build.
 */
export async function analyzeVideo(videoUri: string): Promise<string | null> {
  if (!isPoseAvailable()) {
    useForm.setState({
      error:
        'Video analysis needs the latest app build (with the pose engine). Rebuild the app, or try a sample to see the output.',
    });
    return null;
  }
  useForm.setState({ busy: true, error: null });
  try {
    const raw = await extractPose(videoUri, 15);
    const frames: Frame[] = raw.frames.map((f) =>
      f.map(([x, y, score]) => ({ x, y, score }))
    );
    // Need a person tracked across enough of the clip to trust the metrics.
    const tracked = frames.filter(
      (f) => (f[15]?.score ?? 0) > 0.3 || (f[16]?.score ?? 0) > 0.3
    ).length;
    if (frames.length < 30 || tracked < frames.length * 0.25) {
      useForm.setState({
        error:
          "Couldn't track a runner clearly. Film side-on with your whole body in frame, in good light, for ~10–15s.",
      });
      return null;
    }
    const metrics = computeMetrics({ frames, fps: raw.fps, view: 'side' });
    return await analyzeMetrics(metrics, { view: 'side', sample: false });
  } catch (e) {
    console.warn('analyzeVideo failed', e);
    useForm.setState({ error: 'Analysis failed — try filming again side-on in good light.' });
    return null;
  } finally {
    useForm.setState({ busy: false });
  }
}
