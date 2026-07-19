// Stride — weekly AI insight (Layer 3: the LLM narrates the signal engine).
// Deploy: supabase functions deploy weekly-insight
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
//
// Guardrails baked in:
//  - the model only sees precomputed signals + note excerpts, never raw math
//  - recommendations must be slugs from exercise_library (validated below)
//  - diagnosis language is forbidden by the system prompt and the output schema

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const SYSTEM = `You are Stride's running coach. You write short weekly training
insights for a runner based ONLY on the structured signals and journal excerpts
provided. Rules you must never break:
- You are not a medical professional. Never name a diagnosis or condition.
  Describe patterns ("recurring calf tightness"), not pathologies.
- Every claim must reference the provided evidence. Do not invent numbers.
- Recommend exercises ONLY by slug from the provided library list.
- If any symptom appears severe, persistent (3+ weeks), or involves pain during
  running, include the see_professional flag instead of escalating advice.
- Tone: knowledgeable, calm, encouraging. Celebrate consistency when present.
Return JSON matching the provided schema. Nothing else.`;

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return new Response('Unauthorized', { status: 401 });
  const uid = userRes.user.id;

  // Signals (Layer 2), recent notes, and the allowed exercise slugs
  const [{ data: signals }, { data: notes }, { data: library }] = await Promise.all([
    supabase.from('ai_signals').select('*').eq('user_id', uid)
      .gte('date', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)),
    supabase.from('journal_entries').select('local_date, body, energy, soreness, sleep_hours')
      .eq('user_id', uid).order('local_date', { ascending: false }).limit(14),
    supabase.from('exercise_library').select('slug, name, category, target_areas'),
  ]);

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: JSON.stringify({
        signals,
        recent_journal: notes,
        exercise_library: library,
        output_schema: {
          title: 'string',
          body_md: 'string (<= 150 words)',
          status: 'on_track | caution | high',
          recommendations: [{ slug: 'string from exercise_library', reason: 'string' }],
          see_professional: 'boolean',
        },
      }),
    }],
  });

  const text = msg.content.find((b) => b.type === 'text');
  const parsed = JSON.parse(text?.type === 'text' ? text.text : '{}');

  // Validate: drop any recommendation whose slug isn't in the curated library
  const allowed = new Set((library ?? []).map((e) => e.slug));
  parsed.recommendations = (parsed.recommendations ?? []).filter(
    (r: { slug: string }) => allowed.has(r.slug)
  );

  const { error } = await supabase.from('ai_insights').insert({
    user_id: uid,
    period_start: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    kind: 'weekly',
    title: parsed.title ?? 'Weekly training review',
    body_md: parsed.body_md ?? '',
    recommendations: parsed.recommendations,
    evidence: { signals },
  });
  if (error) return new Response(error.message, { status: 500 });

  return Response.json(parsed);
});
