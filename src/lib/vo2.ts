/**
 * VO2 max (VDOT) estimated from a race or time-trial performance, using the
 * Daniels–Gilbert model — the same maths behind Jack Daniels' VDOT tables.
 *
 * Kept dependency-free (no date/native imports) so it can be tested outside
 * the app, and deterministic like the rest of the signal engine: this is a
 * published formula, not something an LLM should be guessing at.
 *
 * It is an *estimate from performance*, not a lab measurement, and it's only
 * meaningful for a genuine maximal effort — a race or an all-out time trial.
 */

export const RACE_DISTANCES = [
  { key: '1mi', label: '1 mile', meters: 1609.34 },
  { key: '5k', label: '5K', meters: 5000 },
  { key: '10k', label: '10K', meters: 10000 },
  { key: '15k', label: '15K', meters: 15000 },
  { key: 'half', label: 'Half marathon', meters: 21097.5 },
  { key: 'marathon', label: 'Marathon', meters: 42195 },
] as const;

/** Oxygen cost (ml/kg/min) of running at v metres per minute. */
const oxygenCost = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;

/** Fraction of VO2 max sustainable for a effort lasting `minutes`. */
const sustainableFraction = (minutes: number) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);

/**
 * The model's value with no validity checks. Strictly decreasing in time
 * (slower run → lower VDOT), which is what makes the inversion below work.
 * It can go negative at absurdly slow paces, hence the guards in vdotFrom.
 */
const rawVdot = (meters: number, seconds: number) =>
  oxygenCost(meters / (seconds / 60)) / sustainableFraction(seconds / 60);

/** VDOT for covering `meters` in `seconds`. Returns null for absurd inputs. */
export function vdotFrom(meters: number, seconds: number): number | null {
  if (!(meters > 0) || !(seconds > 0)) return null;
  const minutes = seconds / 60;
  // Outside this range the model isn't meaningful (and the curve misbehaves).
  if (minutes < 3 || minutes > 300) return null;
  const vdot = rawVdot(meters, seconds);
  if (!Number.isFinite(vdot) || vdot <= 0 || vdot > 100) return null;
  return Math.round(vdot * 10) / 10;
}

/**
 * Time (seconds) this VDOT predicts for `meters`, found by bisection since the
 * model isn't algebraically invertible.
 *
 * Bisects on rawVdot rather than vdotFrom: vdotFrom returns null both for times
 * that are too fast AND too slow, so a null can't tell the search which way to
 * go. (Guessing "too fast" made the mile — whose search starts at times where
 * oxygen cost goes negative — walk the wrong way and never converge.) rawVdot
 * is monotonic everywhere, so the direction is never ambiguous; validity is
 * checked once at the end.
 */
export function predictedTime(vdot: number, meters: number): number | null {
  if (!(vdot > 0) || !(meters > 0)) return null;
  let lo = 60;
  let hi = 60 * 300;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (rawVdot(meters, mid) > vdot) lo = mid;
    else hi = mid;
  }
  const out = Math.round((lo + hi) / 2);
  return vdotFrom(meters, out) == null ? null : out;
}

/** "18:30" / "1:32:05" → seconds. Accepts m:ss, mm:ss, h:mm:ss. */
export function parseRaceTime(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.slice(1).some((p) => p.length !== 2)) return null;
  if (nums.slice(1).some((n) => n >= 60)) return null;
  const secs =
    parts.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
  return secs > 0 ? secs : null;
}

/** Seconds → "18:30" or "1:32:05". */
export function fmtRaceTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
