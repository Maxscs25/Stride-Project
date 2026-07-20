// Stride — Terra sync (Garmin, COROS, Polar, Suunto, ...).
// One endpoint, four jobs:
//   POST {action:'start'} (authed)      → create Terra widget session, return URL
//   POST {action:'disconnect'} (authed) → deauth with Terra + drop connection
//   POST with terra-signature header    → webhook (auth / deauth / activity)
//   GET  ?result=success|failure        → post-widget landing page
//
// Deploy:  supabase functions deploy terra --no-verify-jwt
// Secrets: supabase secrets set TERRA_DEV_ID=... TERRA_API_KEY=... TERRA_SIGNING_SECRET=...
// Terra dashboard: set the webhook destination to this function's URL.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const FN_URL = `${SUPABASE_URL}/functions/v1/terra`;
const DEV_ID = Deno.env.get('TERRA_DEV_ID') ?? '';
const API_KEY = Deno.env.get('TERRA_API_KEY') ?? '';
const SIGNING_SECRET = Deno.env.get('TERRA_SIGNING_SECRET') ?? '';
const TERRA_API = 'https://api.tryterra.co/v2';

const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const terraHeaders = { 'dev-id': DEV_ID, 'x-api-key': API_KEY, 'Content-Type': 'application/json' };

// Terra activity type codes that count as runs
const RUN_TYPES = new Set([8, 56, 57, 58, 133, 149]);

interface TerraActivity {
  metadata?: {
    summary_id?: string;
    type?: number;
    name?: string;
    start_time?: string;
  };
  distance_data?: {
    summary?: { distance_meters?: number; elevation?: { gain_actual_meters?: number } };
  };
  active_durations_data?: { activity_seconds?: number };
  heart_rate_data?: { summary?: { avg_hr_bpm?: number } };
}

function mapActivity(a: TerraActivity, userId: string) {
  const start = a.metadata?.start_time ?? new Date().toISOString();
  return {
    user_id: userId,
    started_at: start,
    local_date: start.slice(0, 10),
    distance_m: a.distance_data?.summary?.distance_meters ?? 0,
    duration_s: Math.round(a.active_durations_data?.activity_seconds ?? 0),
    workout_type: 'easy',
    avg_hr: a.heart_rate_data?.summary?.avg_hr_bpm
      ? Math.round(a.heart_rate_data.summary.avg_hr_bpm)
      : null,
    elevation_gain_m: a.distance_data?.summary?.elevation?.gain_actual_meters ?? null,
    source: 'terra',
    external_id: a.metadata?.summary_id ?? null,
  };
}

const isRun = (a: TerraActivity) =>
  (RUN_TYPES.has(a.metadata?.type ?? -1) || /run/i.test(a.metadata?.name ?? '')) &&
  (a.distance_data?.summary?.distance_meters ?? 0) > 0 &&
  (a.active_durations_data?.activity_seconds ?? 0) > 0 &&
  a.metadata?.summary_id != null;

async function verifySignature(raw: string, header: string | null): Promise<boolean> {
  if (!header || !SIGNING_SECRET) return false;
  const parts = new Map(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !v1) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === v1.toLowerCase();
}

async function requestBackfill(terraUserId: string) {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  await fetch(
    `${TERRA_API}/activity?user_id=${terraUserId}&start_date=${start}&end_date=${end}&to_webhook=true`,
    { headers: terraHeaders }
  ).catch((e) => console.error('backfill request failed', e));
}

async function handleWebhookEvent(ev: {
  type?: string;
  status?: string;
  reference_id?: string;
  user?: { user_id?: string; provider?: string; reference_id?: string };
  data?: TerraActivity[];
}) {
  const terraUserId = ev.user?.user_id;

  if (ev.type === 'auth' && ev.status === 'success' && terraUserId) {
    const referenceId = ev.reference_id ?? ev.user?.reference_id;
    if (!referenceId) return;
    await admin.from('terra_connections').upsert({
      user_id: referenceId,
      terra_user_id: terraUserId,
      provider: ev.user?.provider ?? null,
    });
    await requestBackfill(terraUserId);
    return;
  }

  if (ev.type === 'deauth' && terraUserId) {
    await admin.from('terra_connections').delete().eq('terra_user_id', terraUserId);
    return;
  }

  if (ev.type === 'activity' && terraUserId && Array.isArray(ev.data)) {
    const { data: conn } = await admin
      .from('terra_connections')
      .select('user_id')
      .eq('terra_user_id', terraUserId)
      .maybeSingle();
    if (!conn) return;
    const rows = ev.data.filter(isRun).map((a) => mapActivity(a, conn.user_id));
    if (rows.length) {
      await admin.from('runs').upsert(rows, { onConflict: 'user_id,source,external_id' });
    }
  }
  // sleep / body / daily / healthcheck events: acknowledged, unused for now
}

function landingPage(ok: boolean, message: string) {
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stride</title></head>
<body style="font-family:-apple-system,sans-serif;background:#0B0F14;color:#F2F5F7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center">
<div><div style="font-size:56px">${ok ? '✅' : '⚠️'}</div>
<h2 style="margin:12px 0 6px">${ok ? 'Watch connected' : 'Connection failed'}</h2>
<p style="color:#9FB0BF;max-width:320px;line-height:1.5">${message}</p>
<p><a href="stride://terra-connected" style="color:#B7F04D;font-weight:700">Open Stride</a></p></div>
</body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const ok = url.searchParams.get('result') === 'success';
    return landingPage(
      ok,
      ok
        ? 'Your recent runs are importing now, and new watch runs will appear automatically. Head back to the app.'
        : 'The watch connection was cancelled or failed. You can retry from Stride.'
    );
  }

  if (req.method !== 'POST') return json({ error: 'not found' }, 404);

  const raw = await req.text();
  const signature = req.headers.get('terra-signature');

  // ---- Webhook path ----
  if (signature) {
    if (!(await verifySignature(raw, signature))) return json({ error: 'bad signature' }, 401);
    let ev: Parameters<typeof handleWebhookEvent>[0];
    try {
      ev = JSON.parse(raw);
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    const work = handleWebhookEvent(ev).catch((e) => console.error('terra webhook error', e));
    try {
      // @ts-ignore Supabase edge runtime API
      EdgeRuntime.waitUntil(work);
    } catch {
      await work;
    }
    return json({ ok: true });
  }

  // ---- App actions (authed) ----
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!DEV_ID || !API_KEY) {
    return json({ error: 'Terra is not configured yet (missing API secrets).' }, 503);
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: 'Unauthorized' }, 401);
  const uid = userRes.user.id;

  if (body.action === 'start') {
    const res = await fetch(`${TERRA_API}/auth/generateWidgetSession`, {
      method: 'POST',
      headers: terraHeaders,
      body: JSON.stringify({
        language: 'en',
        reference_id: uid,
        auth_success_redirect_url: `${FN_URL}?result=success`,
        auth_failure_redirect_url: `${FN_URL}?result=failure`,
      }),
    });
    if (!res.ok) return json({ error: `Terra session failed (${res.status})` }, 502);
    const session = await res.json();
    return json({ url: session.url });
  }

  if (body.action === 'disconnect') {
    const { data: conn } = await admin
      .from('terra_connections')
      .select('terra_user_id')
      .eq('user_id', uid)
      .maybeSingle();
    if (conn) {
      await fetch(`${TERRA_API}/auth/deauthenticateUser?user_id=${conn.terra_user_id}`, {
        method: 'DELETE',
        headers: terraHeaders,
      }).catch(() => {});
      await admin.from('terra_connections').delete().eq('user_id', uid);
    }
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
});
