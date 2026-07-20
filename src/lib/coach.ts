import { create } from 'zustand';

import { round1 } from './format';
import { supabase } from './supabase';
import type { JournalEntry, Run } from './types';

/** Coach sharing: athlete-generated invite codes, permission-scoped links,
 *  roster + athlete data for coaches. RLS enforces every scope server-side. */

export interface CoachPermissions {
  mileage: boolean;
  workouts: boolean;
  wellness: boolean;
  notes: boolean;
  nutrition: boolean;
  checklist: boolean;
}

export const DEFAULT_PERMISSIONS: CoachPermissions = {
  mileage: true,
  workouts: true,
  wellness: true,
  notes: false,
  nutrition: false,
  checklist: true,
};

export const PERMISSION_META: { key: keyof CoachPermissions; label: string; hint: string }[] = [
  { key: 'mileage', label: 'Mileage', hint: 'Weekly totals and trends' },
  { key: 'workouts', label: 'Workouts', hint: 'Individual runs and cross-training' },
  { key: 'wellness', label: 'Wellness', hint: 'Energy, soreness and sleep sliders' },
  { key: 'notes', label: 'Journal notes', hint: 'Your written journal text' },
  { key: 'nutrition', label: 'Nutrition', hint: 'Fuel and hydration logs' },
  { key: 'checklist', label: 'Checklist', hint: 'Daily habit completion' },
];

export interface CoachLink {
  id: string;
  coachId: string;
  athleteId: string;
  otherName: string;
  permissions: CoachPermissions;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export const useCoach = create<{
  myCoaches: CoachLink[];
  myAthletes: CoachLink[];
  openInvite: { code: string; permissions: CoachPermissions } | null;
  loaded: boolean;
}>(() => ({ myCoaches: [], myAthletes: [], openInvite: null, loaded: false }));

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function refreshCoach() {
  const me = await uid();
  if (!me) return;
  const [linksQ, invitesQ] = await Promise.all([
    supabase.from('coach_links').select('*').eq('status', 'active'),
    supabase
      .from('coach_invites')
      .select('code, permissions')
      .is('claimed_by', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  const rows = linksQ.data ?? [];
  const otherIds = [...new Set(rows.map((r) => (r.coach_id === me ? r.athlete_id : r.coach_id)))];
  const names = new Map<string, string>();
  if (otherIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', otherIds);
    for (const p of profiles ?? []) names.set(p.id, p.display_name ?? 'Runner');
  }
  const mapped: CoachLink[] = rows.map((r) => ({
    id: r.id,
    coachId: r.coach_id,
    athleteId: r.athlete_id,
    otherName: names.get(r.coach_id === me ? r.athlete_id : r.coach_id) ?? 'Runner',
    permissions: { ...DEFAULT_PERMISSIONS, ...(r.permissions ?? {}) },
  }));
  useCoach.setState({
    myCoaches: mapped.filter((l) => l.athleteId === me),
    myAthletes: mapped.filter((l) => l.coachId === me),
    openInvite: invitesQ.data?.[0]
      ? {
          code: invitesQ.data[0].code,
          permissions: { ...DEFAULT_PERMISSIONS, ...invitesQ.data[0].permissions },
        }
      : null,
    loaded: true,
  });
}

export async function createInvite(permissions: CoachPermissions): Promise<string | null> {
  const me = await uid();
  if (!me) return null;
  const { data, error } = await supabase
    .from('coach_invites')
    .insert({ athlete_id: me, permissions })
    .select('code')
    .single();
  if (error) {
    console.warn('invite failed:', error.message);
    return null;
  }
  await refreshCoach();
  return data.code;
}

export async function cancelInvite(code: string) {
  await supabase.from('coach_invites').delete().eq('code', code);
  await refreshCoach();
}

export async function redeemInvite(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('redeem_coach_invite', { p_code: code });
  if (error) return error.message;
  if (!data?.ok) return data?.error ?? 'Could not redeem code';
  await refreshCoach();
  return null; // success
}

export async function updateLinkPermissions(linkId: string, permissions: CoachPermissions) {
  await supabase.from('coach_links').update({ permissions }).eq('id', linkId);
  await refreshCoach();
}

export async function revokeLink(linkId: string) {
  await supabase.from('coach_links').update({ status: 'revoked' }).eq('id', linkId);
  await refreshCoach();
}

/** Coach view of an athlete — RLS returns only what their permissions allow. */
export async function fetchAthleteData(athleteId: string): Promise<{
  runs: Run[];
  journal: JournalEntry[];
}> {
  const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const [runsQ, journalQ] = await Promise.all([
    supabase
      .from('runs')
      .select('id, local_date, distance_m, duration_s, workout_type')
      .eq('user_id', athleteId)
      .gte('local_date', cutoff)
      .order('local_date', { ascending: true }),
    supabase
      .from('journal_entries')
      .select('id, local_date, energy, soreness, sleep_hours')
      .eq('user_id', athleteId)
      .gte('local_date', new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)),
  ]);
  const runs: Run[] = (runsQ.data ?? []).map((r) => ({
    id: r.id,
    date: r.local_date,
    distanceMi: round1(Number(r.distance_m) / 1609.34),
    durationS: r.duration_s,
    type: r.workout_type === 'fartlek' ? 'other' : r.workout_type,
  }));
  const journal: JournalEntry[] = (journalQ.data ?? []).map((j) => ({
    id: j.id,
    date: j.local_date,
    energy: j.energy ?? undefined,
    soreness: j.soreness ?? undefined,
    sleepHours: j.sleep_hours != null ? Number(j.sleep_hours) : undefined,
  }));
  return { runs, journal };
}

export async function fetchComments(linkId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('coach_comments')
    .select('id, author_id, body, created_at')
    .eq('coach_link_id', linkId)
    .order('created_at', { ascending: true })
    .limit(50);
  return (data ?? []).map((c) => ({
    id: c.id,
    authorId: c.author_id,
    body: c.body,
    createdAt: c.created_at,
  }));
}

export async function postComment(linkId: string, body: string): Promise<boolean> {
  const me = await uid();
  if (!me || !body.trim()) return false;
  const { error } = await supabase
    .from('coach_comments')
    .insert({ coach_link_id: linkId, author_id: me, ref_type: 'general', body: body.trim() });
  if (error) console.warn('comment failed:', error.message);
  return !error;
}
