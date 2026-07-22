/**
 * Deterministic running-form metrics from a pose keypoint time-series.
 * Input is normalized 2D landmarks (x,y in [0,1], y increasing downward) per
 * frame, from whichever pose engine produced them (on-device or server). This
 * math is the real analytical core — the LLM only narrates these outputs.
 *
 * Keypoint indices follow the 17-point COCO/MoveNet convention.
 */

export const KP = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const;

export interface Landmark {
  x: number;
  y: number;
  score: number; // visibility/confidence 0..1
}
export type Frame = Landmark[]; // length 17
export interface PoseSeries {
  frames: Frame[];
  fps: number;
  view: 'side' | 'rear';
}

export type Rating = 'good' | 'fair' | 'watch' | 'unknown';

export interface Metric {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  rating: Rating;
  confidence: number; // 0..1
  note: string;
}

const mid = (a: Landmark, b: Landmark): Landmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  score: Math.min(a.score, b.score),
});

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
};

/**
 * Count ground contacts for one foot by counting oscillation cycles. y grows
 * downward, so a foot is planted at max y. We count each time the ankle rises
 * back to the high (planted) band after dipping to the low (swing) band —
 * hysteresis around the mean makes this robust to jitter and frame rate.
 */
function contactCount(ys: number[]): number {
  const amp = Math.max(...ys) - Math.min(...ys);
  if (amp < 1e-6) return 0;
  const m = avg(ys);
  const hi = m + amp * 0.1;
  const lo = m - amp * 0.1;
  let count = 0;
  let armed = false; // true once the foot has lifted (dipped to swing)
  for (const y of ys) {
    if (y < lo) armed = true;
    else if (y > hi && armed) {
      count++;
      armed = false;
    }
  }
  return count;
}

/** Average visibility of a set of keypoint indices across all frames. */
function seriesConfidence(frames: Frame[], idxs: number[]): number {
  const scores: number[] = [];
  for (const f of frames) for (const i of idxs) scores.push(f[i]?.score ?? 0);
  return avg(scores);
}

/** Estimate pixels(normalized)-per-cm from an assumed leg length, to report
 *  vertical oscillation in cm. Uses hip→ankle span and a nominal 85 cm leg. */
function normPerCm(frames: Frame[]): number {
  const spans: number[] = [];
  for (const f of frames) {
    const hip = mid(f[KP.leftHip], f[KP.rightHip]);
    const ankle = mid(f[KP.leftAnkle], f[KP.rightAnkle]);
    if (hip.score > 0.3 && ankle.score > 0.3) spans.push(Math.abs(ankle.y - hip.y));
  }
  const span = avg(spans);
  return span > 0 ? span / 85 : 0; // normalized units per cm
}

function rate(value: number, good: [number, number], fair: [number, number]): Rating {
  if (value >= good[0] && value <= good[1]) return 'good';
  if (value >= fair[0] && value <= fair[1]) return 'fair';
  return 'watch';
}

export function computeCadence(s: PoseSeries): Metric {
  const durationS = s.frames.length / s.fps;
  const conf = seriesConfidence(s.frames, [KP.leftAnkle, KP.rightAnkle]);
  if (durationS < 2 || conf < 0.3) {
    return metricUnknown('cadence', 'Cadence', 'spm', 'Not enough clear footage to measure.');
  }
  const leftYs = s.frames.map((f) => f[KP.leftAnkle].y);
  const rightYs = s.frames.map((f) => f[KP.rightAnkle].y);
  const steps = contactCount(leftYs) + contactCount(rightYs);
  const spm = Math.round((steps / durationS) * 60);
  return {
    key: 'cadence',
    label: 'Cadence',
    value: spm,
    unit: 'spm',
    rating: rate(spm, [170, 190], [160, 200]),
    confidence: conf,
    note:
      spm < 165
        ? 'On the lower side — a slightly quicker, lighter turnover often reduces overstriding.'
        : 'In a healthy range for efficient running.',
  };
}

export function computeTrunkLean(s: PoseSeries): Metric {
  const conf = seriesConfidence(s.frames, [
    KP.leftShoulder, KP.rightShoulder, KP.leftHip, KP.rightHip,
  ]);
  if (conf < 0.3) return metricUnknown('trunk_lean', 'Trunk lean', '°', 'Torso not clearly visible.');
  const angles: number[] = [];
  for (const f of s.frames) {
    const sh = mid(f[KP.leftShoulder], f[KP.rightShoulder]);
    const hip = mid(f[KP.leftHip], f[KP.rightHip]);
    // angle of hip→shoulder vector from vertical, degrees (forward = positive)
    const deg = (Math.atan2(sh.x - hip.x, hip.y - sh.y) * 180) / Math.PI;
    angles.push(deg);
  }
  const lean = Math.round(avg(angles) * 10) / 10;
  const mag = Math.abs(lean);
  return {
    key: 'trunk_lean',
    label: 'Trunk lean',
    value: lean,
    unit: '°',
    rating: rate(mag, [3, 12], [0, 16]),
    confidence: conf,
    note:
      lean < 2
        ? 'Fairly upright — a small lean from the ankles can aid forward momentum.'
        : mag > 16
          ? 'A pronounced lean — worth checking it comes from the ankles, not the waist.'
          : 'A slight forward lean, which is generally efficient.',
  };
}

export function computeVerticalOscillation(s: PoseSeries): Metric {
  const conf = seriesConfidence(s.frames, [KP.leftHip, KP.rightHip]);
  const perCm = normPerCm(s.frames);
  if (conf < 0.3 || perCm <= 0) {
    return metricUnknown('vertical_osc', 'Vertical oscillation', 'cm', 'Hips not clearly tracked.');
  }
  const hipYs = s.frames.map((f) => mid(f[KP.leftHip], f[KP.rightHip]).y);
  const range = Math.max(...hipYs) - Math.min(...hipYs);
  const cm = Math.round((range / perCm) * 10) / 10;
  return {
    key: 'vertical_osc',
    label: 'Vertical oscillation',
    value: cm,
    unit: 'cm',
    rating: rate(cm, [5, 9], [4, 11]),
    confidence: conf,
    note:
      cm > 11
        ? 'A fair bit of bounce — driving more forward than up can save energy.'
        : 'Reasonable bounce for efficient running.',
  };
}

export function computeArmCarriage(s: PoseSeries): Metric {
  const conf = seriesConfidence(s.frames, [
    KP.leftShoulder, KP.leftElbow, KP.leftWrist, KP.rightShoulder, KP.rightElbow, KP.rightWrist,
  ]);
  if (conf < 0.3) return metricUnknown('arm_angle', 'Arm carriage', '°', 'Arms not clearly visible.');
  const angleAt = (a: Landmark, b: Landmark, c: Landmark) => {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const m1 = Math.hypot(v1.x, v1.y);
    const m2 = Math.hypot(v2.x, v2.y);
    return m1 && m2 ? (Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180) / Math.PI : NaN;
  };
  const angles: number[] = [];
  for (const f of s.frames) {
    const l = angleAt(f[KP.leftShoulder], f[KP.leftElbow], f[KP.leftWrist]);
    const r = angleAt(f[KP.rightShoulder], f[KP.rightElbow], f[KP.rightWrist]);
    if (!isNaN(l)) angles.push(l);
    if (!isNaN(r)) angles.push(r);
  }
  const elbow = Math.round(avg(angles));
  return {
    key: 'arm_angle',
    label: 'Arm carriage',
    value: elbow,
    unit: '° elbow',
    rating: rate(elbow, [70, 100], [60, 115]),
    confidence: conf,
    note:
      elbow > 110
        ? 'Arms are fairly straight — a ~90° bend keeps the swing compact and relaxed.'
        : 'A compact, efficient arm bend.',
  };
}

export function computeSymmetry(s: PoseSeries): Metric {
  const conf = seriesConfidence(s.frames, [KP.leftAnkle, KP.rightAnkle]);
  if (conf < 0.3) return metricUnknown('symmetry', 'L/R symmetry', '%', 'Both legs not clearly tracked.');
  const lAmp =
    Math.max(...s.frames.map((f) => f[KP.leftAnkle].y)) -
    Math.min(...s.frames.map((f) => f[KP.leftAnkle].y));
  const rAmp =
    Math.max(...s.frames.map((f) => f[KP.rightAnkle].y)) -
    Math.min(...s.frames.map((f) => f[KP.rightAnkle].y));
  const sym = Math.round((Math.min(lAmp, rAmp) / Math.max(lAmp, rAmp)) * 100);
  return {
    key: 'symmetry',
    label: 'L/R symmetry',
    value: sym,
    unit: '%',
    rating: rate(sym, [90, 100], [82, 100]),
    confidence: conf * 0.8, // a phone side-view can only estimate this loosely
    note:
      sym < 85
        ? 'Some left/right difference in stride — common, but worth noting if paired with one-sided soreness.'
        : 'Left and right strides look well matched.',
  };
}

function metricUnknown(key: string, label: string, unit: string, note: string): Metric {
  return { key, label, value: null, unit, rating: 'unknown', confidence: 0, note };
}

export function computeMetrics(s: PoseSeries): Metric[] {
  const all = [
    computeCadence(s),
    computeTrunkLean(s),
    computeVerticalOscillation(s),
    computeArmCarriage(s),
  ];
  if (s.view === 'rear' || true) all.push(computeSymmetry(s));
  return all;
}

/** Overall capture-quality confidence, for the "how reliable is this" banner. */
export function overallConfidence(metrics: Metric[]): number {
  const known = metrics.filter((m) => m.rating !== 'unknown');
  return known.length ? avg(known.map((m) => m.confidence)) : 0;
}

/**
 * Synthetic side-view runner for demonstrating the pipeline end-to-end
 * (real metrics engine + real Claude report) before on-device pose inference
 * is wired. Deliberately imperfect form so the coach has something to say:
 * ~162 spm cadence and a slightly upright trunk. Clearly a SAMPLE, never
 * presented as the user's real gait.
 */
export function sampleSeries(): PoseSeries {
  const fps = 30;
  const secs = 6;
  const strideHz = 1.35; // ~162 spm
  const frames: Frame[] = [];
  for (let n = 0; n < fps * secs; n++) {
    const t = n / fps;
    const f: Frame = Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, score: 0.86 }));
    const hipY = 0.55 + 0.028 * Math.cos(2 * Math.PI * strideHz * 2 * t);
    f[KP.leftHip] = { x: 0.475, y: hipY, score: 0.88 };
    f[KP.rightHip] = { x: 0.525, y: hipY, score: 0.88 };
    f[KP.leftShoulder] = { x: 0.472, y: 0.35, score: 0.87 };
    f[KP.rightShoulder] = { x: 0.528, y: 0.35, score: 0.87 };
    f[KP.leftAnkle] = { x: 0.47, y: 0.86 + 0.07 * Math.cos(2 * Math.PI * strideHz * t), score: 0.85 };
    f[KP.rightAnkle] = { x: 0.53, y: 0.86 + 0.07 * Math.cos(2 * Math.PI * strideHz * t + Math.PI), score: 0.85 };
    f[KP.leftKnee] = { x: 0.47, y: 0.70, score: 0.84 };
    f[KP.rightKnee] = { x: 0.53, y: 0.70, score: 0.84 };
    f[KP.leftElbow] = { x: 0.44, y: 0.46, score: 0.8 };
    f[KP.rightElbow] = { x: 0.56, y: 0.46, score: 0.8 };
    f[KP.leftWrist] = { x: 0.455, y: 0.55, score: 0.78 };
    f[KP.rightWrist] = { x: 0.545, y: 0.55, score: 0.78 };
    frames.push(f);
  }
  return { frames, fps, view: 'side' };
}
