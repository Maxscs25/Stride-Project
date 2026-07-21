// Stride — Strava sync: OAuth connect, activity webhook, backfill.
// One endpoint, four jobs (keeps Strava's callback domain simple):
//   GET  ?hub.challenge=...          → webhook subscription validation
//   GET  ?code=...&state=...         → OAuth callback (token exchange + backfill)
//   POST {action:'start'} (authed)   → mint state, return Strava authorize URL
//   POST {object_type:...}           → webhook event (new/updated/deleted activity)
//
// Deploy:  supabase functions deploy strava --no-verify-jwt
// Secrets: supabase secrets set STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=...

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const FN_URL = `${SUPABASE_URL}/functions/v1/strava`;
const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
const VERIFY_TOKEN = Deno.env.get('STRAVA_VERIFY_TOKEN') ?? 'stride-webhook';

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

interface StravaActivity {
  id: number;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  workout_type?: number | null;
  average_heartrate?: number;
  total_elevation_gain?: number;
}

function mapActivity(a: StravaActivity, userId: string) {
  const workout =
    a.workout_type === 1 ? 'race' : a.workout_type === 2 ? 'long' : a.workout_type === 3 ? 'intervals' : 'easy';
  return {
    user_id: userId,
    started_at: a.start_date,
    local_date: a.start_date_local.slice(0, 10),
    distance_m: a.distance,
    duration_s: a.moving_time,
    workout_type: workout,
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    source: 'strava',
    external_id: String(a.id),
  };
}

const isRun = (a: StravaActivity) =>
  ['Run', 'TrailRun', 'VirtualRun'].includes(a.type) && a.distance > 0 && a.moving_time > 0;

async function freshToken(conn: {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}): Promise<string | null> {
  if (new Date(conn.expires_at).getTime() > Date.now() + 60_000) return conn.access_token;
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  });
  if (!res.ok) return null;
  const tok = await res.json();
  await admin
    .from('strava_connections')
    .update({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(tok.expires_at * 1000).toISOString(),
    })
    .eq('user_id', conn.user_id);
  return tok.access_token;
}

async function backfill(userId: string, accessToken: string) {
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=60', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return;
  const activities: StravaActivity[] = await res.json();
  const rows = activities.filter(isRun).map((a) => mapActivity(a, userId));
  if (rows.length) {
    await admin.from('runs').upsert(rows, { onConflict: 'user_id,source,external_id' });
  }
}

async function ensureSubscription() {
  const creds = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  const existing = await fetch(`https://www.strava.com/api/v3/push_subscriptions?${creds}`);
  if (existing.ok && (await existing.json()).length > 0) return;
  await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `${creds}&callback_url=${encodeURIComponent(FN_URL)}&verify_token=${VERIFY_TOKEN}`,
  });
}

async function handleWebhookEvent(ev: {
  object_type: string;
  aspect_type: string;
  object_id: number;
  owner_id: number;
  updates?: Record<string, unknown>;
}) {
  // Athlete revoked access from Strava's side → drop the connection
  if (ev.object_type === 'athlete') {
    if (ev.updates?.authorized === 'false') {
      await admin.from('strava_connections').delete().eq('athlete_id', ev.owner_id);
    }
    return;
  }
  if (ev.object_type !== 'activity') return;

  const { data: conn } = await admin
    .from('strava_connections')
    .select('*')
    .eq('athlete_id', ev.owner_id)
    .maybeSingle();
  if (!conn) return;

  if (ev.aspect_type === 'delete') {
    await admin
      .from('runs')
      .delete()
      .eq('user_id', conn.user_id)
      .eq('source', 'strava')
      .eq('external_id', String(ev.object_id));
    return;
  }

  const token = await freshToken(conn);
  if (!token) return;
  const res = await fetch(`https://www.strava.com/api/v3/activities/${ev.object_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const activity: StravaActivity = await res.json();
  if (!isRun(activity)) return;
  await admin
    .from('runs')
    .upsert(mapActivity(activity, conn.user_id), { onConflict: 'user_id,source,external_id' });
}

function successPage(ok: boolean, message: string) {
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stride</title></head>
<body style="font-family:-apple-system,sans-serif;background:#0B0F14;color:#F2F5F7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center">
<div><div style="font-size:56px">${ok ? '✅' : '⚠️'}</div>
<h2 style="margin:12px 0 6px">${ok ? 'Strava connected' : 'Connection failed'}</h2>
<p style="color:#9FB0BF;max-width:320px;line-height:1.5">${message}</p>
<p><a href="stride://strava-connected" style="color:#B7F04D;font-weight:700">Open Stride</a></p></div>
</body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);

  // ---- Webhook subscription validation ----
  if (req.method === 'GET' && url.searchParams.has('hub.challenge')) {
    if (url.searchParams.get('hub.verify_token') !== VERIFY_TOKEN) {
      return json({ error: 'bad verify token' }, 403);
    }
    return json({ 'hub.challenge': url.searchParams.get('hub.challenge') });
  }

  // ---- OAuth callback ----
  if (req.method === 'GET' && url.searchParams.has('state')) {
    if (url.searchParams.get('error')) {
      return successPage(false, 'Strava authorization was declined. You can retry from Stride.');
    }
    const state = url.searchParams.get('state')!;
    const { data: st } = await admin.from('oauth_states').select('*').eq('state', state).maybeSingle();
    await admin.from('oauth_states').delete().eq('state', state);
    if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) {
      return successPage(false, 'This connection link expired. Tap Connect in Stride again.');
    }
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: url.searchParams.get('code'),
      }),
    });
    if (!res.ok) return successPage(false, 'Token exchange with Strava failed. Try again.');
    const tok = await res.json();
    await admin.from('strava_connections').upsert({
      user_id: st.user_id,
      athlete_id: tok.athlete.id,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(tok.expires_at * 1000).toISOString(),
      scope: url.searchParams.get('scope'),
    });
    await ensureSubscription();
    await backfill(st.user_id, tok.access_token);
    return successPage(
      true,
      'Your recent runs are importing now, and new watch runs will appear automatically. Head back to the app.'
    );
  }

  // ---- POSTs: app actions + webhook events ----
  if (req.method === 'POST') {
    if (Number(req.headers.get('content-length') ?? 0) > 100_000) {
      return json({ error: 'payload too large' }, 413);
    }
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad json' }, 400);
    }

    if (body.action === 'start') {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        return json({ error: 'Strava is not configured yet (missing API secrets).' }, 503);
      }
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      });
      const { data: userRes } = await userClient.auth.getUser();
      if (!userRes?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: ok } = await admin.rpc('check_rate_limit', {
        p_user: userRes.user.id,
        p_action: 'oauth_start',
        p_max: 15,
        p_window_seconds: 3600,
      });
      if (ok === false) return json({ error: 'Too many attempts — try again shortly.' }, 429);
      const { data: st, error } = await admin
        .from('oauth_states')
        .insert({ user_id: userRes.user.id })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      const authorize =
        `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(FN_URL)}&response_type=code` +
        `&approval_prompt=auto&scope=activity:read_all&state=${st.state}`;
      return json({ url: authorize });
    }

    if (body.object_type) {
      // Strava wants a fast 200; do the real work after responding when possible
      const work = handleWebhookEvent(body as Parameters<typeof handleWebhookEvent>[0]).catch(
        (e) => console.error('webhook error', e)
      );
      try {
        // @ts-ignore Supabase edge runtime API
        EdgeRuntime.waitUntil(work);
      } catch {
        await work;
      }
      return json({ ok: true });
    }
  }

  return json({ error: 'not found' }, 404);
});
