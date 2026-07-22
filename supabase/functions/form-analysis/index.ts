// Stride — running form report (Layer 3 for form analysis).
// The client computes gait metrics from pose keypoints (src/lib/gait.ts) and
// stores them on the form_analyses row; this function has Claude narrate them
// into a report with drills from the curated library. It never invents
// metrics, and low-confidence metrics are reported as "couldn't assess".
//
// Deploy:  supabase functions deploy form-analysis --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DISCLAIMER =
  'This analysis is for educational and training purposes only. It is not a medical evaluation or diagnosis. Running mechanics cannot be fully assessed from a phone camera, and recommendations should not replace evaluation by a qualified healthcare or sports-medicine professional.';

const SYSTEM = `You are Stride's running-form coach. You are given deterministic
gait metrics (each with a rating and a 0-1 confidence) computed from phone-video
pose estimation, plus a library of drills. Write an encouraging, concrete report.
Rules:
- Use ONLY the provided metrics and their ratings. Never invent numbers.
- For any metric with confidence < 0.4 or rating "unknown", say it couldn't be
  assessed reliably from this clip — do not guess.
- Lead with what looks good, then 1-3 priority areas.
- Recommend drills ONLY by slug from the provided library (max 3), each tied to
  a specific finding.
- Never diagnose or name a condition. This is training education.
Return ONLY JSON: {"summary": string, "highlights": [string], "priorities":
[{"metric_key": string, "what": string, "why": string}], "drills": [{"slug":
string, "reason": string}]}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  let body: { analysis_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!body.analysis_id) return json({ error: 'analysis_id required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401);
  const uid = userRes.user.id;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ok } = await admin.rpc('check_rate_limit', {
    p_user: uid,
    p_action: 'form_analysis',
    p_max: 10,
    p_window_seconds: 3600,
  });
  if (ok === false) return json({ error: 'rate limited' }, 429);

  const { data: analysis } = await supabase
    .from('form_analyses')
    .select('id, metrics, view_angle')
    .eq('id', body.analysis_id)
    .maybeSingle();
  if (!analysis) return json({ error: 'analysis not found' }, 404);
  const metrics = analysis.metrics?.metrics;
  if (!Array.isArray(metrics) || metrics.length === 0) {
    await supabase.from('form_analyses').update({ status: 'failed' }).eq('id', analysis.id);
    return json({ error: 'no metrics on this analysis' }, 400);
  }

  const { data: library } = await supabase
    .from('exercise_library')
    .select('slug, name, category, target_areas')
    .contains('target_areas', ['form']);

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  let parsed: {
    summary?: string;
    highlights?: string[];
    priorities?: { metric_key: string; what: string; why: string }[];
    drills?: { slug: string; reason: string }[];
  };
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1100,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ view: analysis.view_angle, metrics, drill_library: library }),
        },
      ],
    });
    const text = msg.content.find((b) => b.type === 'text');
    const raw = text?.type === 'text' ? text.text : '{}';
    parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, ''));
  } catch (e) {
    console.warn('form report failed', e);
    await supabase.from('form_analyses').update({ status: 'failed' }).eq('id', analysis.id);
    return json({ error: 'report generation failed' }, 502);
  }

  const allowed = new Map((library ?? []).map((e) => [e.slug, e.name]));
  const drills = (parsed.drills ?? [])
    .filter((d) => allowed.has(d.slug))
    .slice(0, 3)
    .map((d) => ({ slug: d.slug, name: allowed.get(d.slug), reason: d.reason }));

  const findings = {
    summary: parsed.summary ?? '',
    highlights: (parsed.highlights ?? []).slice(0, 4),
    priorities: (parsed.priorities ?? []).slice(0, 3),
    drills,
    disclaimer: DISCLAIMER,
  };

  const { error } = await supabase
    .from('form_analyses')
    .update({ findings, status: 'complete' })
    .eq('id', analysis.id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, findings });
});
