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

/** Monday-based start of the week containing k. */
export function weekStartKey(k: string): string {
  const d = parseKey(k);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
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
