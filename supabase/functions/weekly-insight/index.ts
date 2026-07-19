// Stride — weekly AI insight (Layer 3: Claude narrates the signal engine).
// Deploy:  supabase functions deploy weekly-insight --no-verify-jwt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
//
// Guardrails baked in:
//  - the model only sees precomputed signals + note excerpts, never raw math
//  - recommendations must be slugs from exercise_library (validated below)
//  - diagnosis language is forbidden by the system prompt and output contract

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You are Stride's running coach. You write short weekly training
insights for a runner based ONLY on the structured signals and journal excerpts
provided. Rules you must never break:
- You are not a medical professional. Never name a diagnosis or condition.
  Describe patterns ("recurring calf tightness"), not pathologies.
- Every claim must reference the provided evidence. Do not invent numbers.
- Recommend exercises ONLY by slug from the provided library list, max 3.
- If any symptom appears severe, persistent, or involves pain during running,
  set see_professional to true instead of escalating advice.
- Tone: knowledgeable, calm, encouraging — a coach, not an alarm. Celebrate
  consistency when the signals show it.
Respond with ONLY a JSON object, no markdown fences, matching:
{"title": string, "body_md": string (<=120 words), "status": "on_track"|"caution"|"high",
 "recommendations": [{"slug": string, "reason": string}], "see_professional": boolean}`;

// Deterministic, display-ready evidence lines from Layer-2 signals
function evidenceLine(s: { signal_type: string; evidence: Record<string, unknown> }): string {
  const e = s.evidence ?? {};
  switch (s.signal_type) {
    case 'acwr_high':
      return `Acute:chronic load ratio ${Number(e.acwr).toFixed(2)} — above the 0.8–1.3 adapted zone`;
    case 'ramp_spike':
      return `This week ${e.this_week_mi} mi vs ${e.last_week_mi} mi last week`;
    case 'symptom_cluster':
      return `"${e.body_part}" mentioned in ${e.mentions_14d} journal entries over 14 days`;
    case 'sleep_deficit':
      return `Averaging ${e.avg_sleep_7d}h sleep over the last 7 days`;
    case 'shoe_worn':
      return `${e.model}: ${e.miles} of ${e.lifespan} mi used`;
    case 'consistency_win':
      return `4+ runs in each of the last 3 weeks`;
    default:
      return s.signal_type;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401);
  const uid = userRes.user.id;

  // Layers 1 + 2 on demand, so the insight reflects today's training
  await supabase.rpc('refresh_training_load', { p_user: uid });
  await supabase.rpc('detect_signals', { p_user: uid });

  const [{ data: signals }, { data: notes }, { data: library }] = await Promise.all([
    supabase
      .from('ai_signals')
      .select('signal_type, severity, evidence')
      .eq('user_id', uid)
      .gte('date', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)),
    supabase
      .from('journal_entries')
      .select('local_date, body, energy, soreness, sleep_hours')
      .eq('user_id', uid)
      .order('local_date', { ascending: false })
      .limit(14),
    supabase.from('exercise_library').select('slug, name, category, target_areas'),
  ]);

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          signals: (signals ?? []).map((s) => ({ ...s, line: evidenceLine(s) })),
          recent_journal: notes,
          exercise_library: library,
        }),
      },
    ],
  });

  const text = msg.content.find((b) => b.type === 'text');
  let parsed: {
    title?: string;
    body_md?: string;
    status?: string;
    recommendations?: { slug: string; reason: string }[];
    see_professional?: boolean;
  };
  try {
    const raw = text?.type === 'text' ? text.text : '{}';
    parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, ''));
  } catch {
    return json({ error: 'Model returned invalid JSON' }, 502);
  }

  // Enforce the curated library and attach display names
  const byNameSlug = new Map((library ?? []).map((e) => [e.slug, e.name]));
  const recommendations = (parsed.recommendations ?? [])
    .filter((r) => byNameSlug.has(r.slug))
    .slice(0, 3)
    .map((r) => ({ slug: r.slug, name: byNameSlug.get(r.slug), reason: r.reason }));

  const status = ['on_track', 'caution', 'high'].includes(parsed.status ?? '')
    ? parsed.status
    : 'on_track';
  const evidenceLines = (signals ?? [])
    .filter((s) => s.signal_type !== 'consistency_win')
    .map(evidenceLine);

  const row = {
    user_id: uid,
    period_start: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    kind: 'weekly',
    title: parsed.title ?? 'Weekly training review',
    body_md: parsed.body_md ?? '',
    recommendations,
    evidence: { status, lines: evidenceLines, see_professional: !!parsed.see_professional },
  };
  const { data: inserted, error } = await supabase
    .from('ai_insights')
    .insert(row)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);

  return json(inserted);
});
