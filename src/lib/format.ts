import * as Crypto from 'expo-crypto';

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayKey = () => dateKey(new Date());

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** 0 = weeks start Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

/**
 * Which day weeks start on, mirrored from the user's profile.
 *
 * Held here rather than threaded through every caller: weekStartKey feeds a
 * dozen pure functions (weekly mileage, load series, heatmap, seed data), and
 * passing a preference through all of them would be noisy and easy to miss.
 * The store keeps the source of truth and pushes changes here via subscribe,
 * so React still re-renders — this is only a read cache for the math.
 */
let weekStart: WeekStart = 1;
export const setWeekStart = (d: WeekStart) => {
  weekStart = d;
};
export const getWeekStart = () => weekStart;

/** Start of the week containing k, per the user's week-start preference. */
export function weekStartKey(k: string, startsOn: WeekStart = weekStart): string {
  const d = parseKey(k);
  const dow = (d.getDay() - startsOn + 7) % 7;
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

/** Weekday indices (JS getDay()) in display order for the current preference. */
export function orderedDows(startsOn: WeekStart = weekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + startsOn) % 7);
}

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * A run duration typed either as clock time ("45:30", "1:05:20") or as plain
 * minutes ("45", "45.5"). Returns seconds, or null if it isn't a sensible
 * duration. Bare minutes stay supported so anyone used to the old field — or
 * re-typing a saved value — isn't forced to change how they enter it.
 */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (!t) return null;

  if (t.includes(':')) {
    const parts = t.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    // Number('') is 0, so an empty field would otherwise slip through and
    // ":30" would silently read as 30 seconds.
    if (parts.some((p) => p.length === 0)) return null;
    const n = parts.map(Number);
    if (n.some((x) => !Number.isFinite(x) || x < 0)) return null;
    // Everything after the first field is a two-digit sub-60 value, so "5:6"
    // and "5:75" are rejected rather than silently misread.
    if (parts.slice(1).some((p) => p.length !== 2)) return null;
    if (n.slice(1).some((x) => x >= 60)) return null;
    const secs = parts.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2];
    return secs > 0 ? secs : null;
  }

  const mins = Number(t);
  return Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60) : null;
}

export function fmtPace(mi: number, s: number): string {
  if (!mi || !s) return '—';
  const sp = s / mi;
  const m = Math.floor(sp / 60);
  const sec = Math.round(sp % 60);
  return `${m}:${String(sec).padStart(2, '0')}/mi`;
}

export function fmtDate(k: string): string {
  return parseKey(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtWeekday(k: string): string {
  return parseKey(k).toLocaleDateString('en-US', { weekday: 'short' });
}

export function fmtLongDate(k: string): string {
  return parseKey(k).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * RFC 4122 v4 UUID that also works outside secure contexts (plain-HTTP LAN
 * preview, older webviews), where crypto.randomUUID is unavailable.
 */
export function uuid(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    let bytes: Uint8Array;
    try {
      bytes = Crypto.getRandomBytes(16);
    } catch {
      bytes = new Uint8Array(16).map(() => Math.floor(Math.random() * 256));
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
