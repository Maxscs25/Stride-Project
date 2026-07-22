// Stride — journal symptom extraction (the designed Haiku note-mining).
// Turns free-text journal notes into structured symptom_tags so the SQL
// signal engine's symptom_cluster detection and the weekly AI insight see
// real longitudinal symptom data. Cheap per-entry (Haiku).
//
// Deploy:  supabase functions deploy journal-extract --no-verify-jwt
// Secrets: ANTHROPIC_API_KEY (already set)

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Constrained vocabularies — the model must map onto these, keeping the data
// queryable and preventing free-form label drift.
const BODY_PARTS = [
  'calf', 'achilles', 'knee', 'shin', 'hamstring', 'hip', 'quad', 'glute',
  'it_band', 'ankle', 'foot', 'plantar', 'groin', 'lower_back', 'other',
];
const SYMPTOM_TYPES = ['tightness', 'soreness', 'pain', 'ache', 'stiffness', 'fatigue', 'cramp'];

const SYSTEM = `You extract musculoskeletal symptom mentions from a runner's
journal note. Return ONLY JSON: {"symptoms": [{"body_part": <one of the allowed
body parts>, "symptom_type": <one of the allowed types>, "severity": 1-5}]}.
Rules:
- Only include a symptom the runner actually reports about their OWN body.
- Map to the closest allowed body_part and symptom_type; use "other" for body
  parts not listed. Do not invent symptoms that aren't mentioned.
- severity: 1 mild/"a little", 3 moderate, 5 severe/"couldn't run".
- If the note reports no physical symptoms, return {"symptoms": []}.
- Never diagnose. You are only tagging what was written.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  if (Number(req.headers.get('content-length') ?? 0) > 20_000) {
    return json({ error: 'payload too large' }, 413);
  }

  let body: { journal_entry_id?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const note = (body.note ?? '').slice(0, 4000).trim();
  const entryId = body.journal_entry_id;
  if (!note || !entryId) return json({ error: 'note and journal_entry_id required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401);
  const uid = userRes.user.id;

  // Rate limit — cheap per call but still guard against abuse
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ok } = await admin.rpc('check_rate_limit', {
    p_user: uid,
    p_action: 'journal_extract',
    p_max: 60,
    p_window_seconds: 3600,
  });
  if (ok === false) return json({ error: 'rate limited' }, 429);

  // Confirm the journal entry belongs to this user (RLS also enforces on write)
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('id', entryId)
    .maybeSingle();
  if (!entry) return json({ error: 'entry not found' }, 404);

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  let symptoms: { body_part: string; symptom_type: string; severity: number }[] = [];
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            note,
            allowed_body_parts: BODY_PARTS,
            allowed_symptom_types: SYMPTOM_TYPES,
          }),
        },
      ],
    });
    const text = msg.content.find((b) => b.type === 'text');
    const raw = text?.type === 'text' ? text.text : '{}';
    const parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, ''));
    symptoms = Array.isArray(parsed.symptoms) ? parsed.symptoms : [];
  } catch (e) {
    console.warn('haiku extract failed', e);
    return json({ error: 'extraction failed' }, 502);
  }

  // Validate against the allowed vocab before writing
  const rows = symptoms
    .filter(
      (s) =>
        BODY_PARTS.includes(s.body_part) &&
        SYMPTOM_TYPES.includes(s.symptom_type) &&
        Number.isInteger(s.severity) &&
        s.severity >= 1 &&
        s.severity <= 5
    )
    .slice(0, 6)
    .map((s) => ({
      user_id: uid,
      journal_entry_id: entryId,
      body_part: s.body_part,
      symptom_type: s.symptom_type,
      severity: s.severity,
      extracted_by: 'ai',
    }));

  // Replace any prior extraction for this entry (idempotent re-runs)
  await supabase
    .from('symptom_tags')
    .delete()
    .eq('journal_entry_id', entryId)
    .eq('extracted_by', 'ai');
  if (rows.length) {
    const { error } = await supabase.from('symptom_tags').insert(rows);
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, symptoms: rows.map((r) => ({ body_part: r.body_part, symptom_type: r.symptom_type, severity: r.severity })) });
});
