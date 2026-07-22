import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { SKELETON_BONES } from '@/lib/gait';
import { useTheme } from '@/theme';

interface Pt {
  x: number;
  y: number;
  present: boolean;
}

/**
 * Clean up raw pose for stable playback, per joint:
 *  1) linearly fill low-confidence gaps between detections (no pop-out),
 *  2) centered moving average to kill jitter WITHOUT the phase lag an EMA adds,
 *  3) a joint detected anywhere is shown for the whole clip, so nothing flickers.
 */
function smoothFrames(frames: number[][][]): Pt[][] {
  const J = 17;
  const N = frames.length;
  const R = 2; // centered window radius
  const out: Pt[][] = Array.from({ length: N }, () => new Array(J));

  for (let j = 0; j < J; j++) {
    const xs = new Array<number>(N);
    const ys = new Array<number>(N);
    const seen = new Array<boolean>(N).fill(false);
    for (let n = 0; n < N; n++) {
      const p = frames[n]?.[j];
      if (p && p[2] >= 0.2) {
        xs[n] = p[0];
        ys[n] = p[1];
        seen[n] = true;
      }
    }
    const first = seen.indexOf(true);
    const anyPresent = first !== -1;

    if (anyPresent) {
      const last = seen.lastIndexOf(true);
      for (let n = 0; n < first; n++) ((xs[n] = xs[first]), (ys[n] = ys[first]));
      for (let n = last + 1; n < N; n++) ((xs[n] = xs[last]), (ys[n] = ys[last]));
      let prev = first;
      let n = first + 1;
      while (n <= last) {
        if (seen[n]) {
          prev = n;
          n++;
          continue;
        }
        let m = n;
        while (m <= last && !seen[m]) m++;
        for (let k = n; k < m; k++) {
          const t = (k - prev) / (m - prev);
          xs[k] = xs[prev] + (xs[m] - xs[prev]) * t;
          ys[k] = ys[prev] + (ys[m] - ys[prev]) * t;
        }
        n = m;
      }
    }

    for (let n = 0; n < N; n++) {
      if (!anyPresent) {
        out[n][j] = { x: 0, y: 0, present: false };
        continue;
      }
      let sx = 0;
      let sy = 0;
      let c = 0;
      for (let k = -R; k <= R; k++) {
        const idx = n + k;
        if (idx >= 0 && idx < N) {
          sx += xs[idx];
          sy += ys[idx];
          c++;
        }
      }
      out[n][j] = { x: sx / c, y: sy / c, present: true };
    }
  }
  return out;
}

function interpolate(sm: Pt[][], f: number): Pt[] {
  const a = Math.floor(f);
  const b = Math.min(a + 1, sm.length - 1);
  const t = f - a;
  return sm[a].map((pa, j) => {
    const pb = sm[b][j];
    if (pa.present && pb.present) {
      return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, present: true };
    }
    return pa.present ? pa : pb;
  });
}

/** Draws one pose. `map` converts normalized (x,y) to pixel coordinates. */
function Skeleton({
  pose,
  map,
  stroke,
  jointFill,
}: {
  pose: Pt[];
  map: (x: number, y: number) => { x: number; y: number };
  stroke: string;
  jointFill: string;
}) {
  return (
    <>
      {SKELETON_BONES.map(([a, b], i) => {
        const pa = pose[a];
        const pb = pose[b];
        if (!pa?.present || !pb?.present) return null;
        const A = map(pa.x, pa.y);
        const B = map(pb.x, pb.y);
        return (
          <Line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
        );
      })}
      {pose.map((p, i) => {
        if (!p.present) return null;
        const P = map(p.x, p.y);
        return <Circle key={i} cx={P.x} cy={P.y} r={4} fill={jointFill} />;
      })}
    </>
  );
}

/**
 * Skeleton overlaid on the actual video. The container is sized to the video's
 * exact aspect ratio (from the pose module), so contentFit="contain" fills it
 * with no letterboxing and normalized keypoints map straight onto it. The pose
 * is synced to the video's own playback clock.
 */
export function VideoOverlay({
  source,
  frames,
  duration,
  aspect,
}: {
  source: string;
  frames: number[][][];
  duration: number;
  aspect: number;
}) {
  const { colors } = useTheme();
  const smoothed = useMemo(() => smoothFrames(frames), [frames]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pose, setPose] = useState<Pt[]>(() => smoothed[0] ?? []);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const t = player.currentTime ?? 0;
      const f = Math.max(0, Math.min(smoothed.length - 1, (t / (duration || 1)) * (smoothed.length - 1)));
      setPose(interpolate(smoothed, f));
    }, 40);
    return () => clearInterval(iv);
  }, [player, smoothed, duration]);

  const map = (x: number, y: number) => ({ x: x * size.w, y: y * size.h });

  return (
    <View>
      <View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{
          width: '100%',
          aspectRatio: aspect || 0.5625,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}>
        <VideoView player={player} contentFit="contain" nativeControls={false} style={StyleSheet.absoluteFill} />
        {showSkeleton && size.w > 0 ? (
          <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
            <Skeleton pose={pose} map={map} stroke={colors.accent} jointFill="#fff" />
          </Svg>
        ) : null}
      </View>

      <Pressable
        onPress={() => setShowSkeleton((s) => !s)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          marginTop: 10,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        <Ionicons
          name={showSkeleton ? 'body' : 'body-outline'}
          size={15}
          color={showSkeleton ? colors.accent : colors.textMuted}
          style={{ marginRight: 6 }}
        />
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
          {showSkeleton ? 'Skeleton on' : 'Skeleton off'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Smooth animated playback of the detected pose. Renders at ~30fps by
 * interpolating between smoothed keyframes on a requestAnimationFrame clock,
 * so it stays fluid regardless of the stored keyframe rate.
 */
export function SkeletonPlayer({
  frames,
  duration,
  height = 300,
}: {
  frames: number[][][];
  duration: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [playing, setPlaying] = useState(true);
  const smoothed = useMemo(() => smoothFrames(frames), [frames]);
  const [pose, setPose] = useState<Pt[]>(() => smoothed[0] ?? []);
  const [progress, setProgress] = useState(0);

  const startRef = useRef(0);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    if (!playing || smoothed.length < 2) return;
    const total = smoothed.length;
    const durationMs = Math.max(1000, (duration || total / 12) * 1000);
    let raf = 0;
    startRef.current = 0;

    const loop = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const tMs = (now - startRef.current) % durationMs;
      const f = (tMs / durationMs) * (total - 1);
      if (now - lastRenderRef.current > 33) {
        // ~30fps render cadence
        setPose(interpolate(smoothed, f));
        setProgress(f / (total - 1));
        lastRenderRef.current = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, smoothed, duration]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const px = (x: number) => 16 + x * (width - 32);
  const py = (y: number) => 12 + y * (height - 24);

  return (
    <View>
      <View
        onLayout={onLayout}
        style={{ height, borderRadius: 14, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        {width > 0 && pose.length ? (
          <Svg width={width} height={height}>
            {SKELETON_BONES.map(([a, b], i) => {
              const pa = pose[a];
              const pb = pose[b];
              if (!pa?.present || !pb?.present) return null;
              return (
                <Line
                  key={i}
                  x1={px(pa.x)}
                  y1={py(pa.y)}
                  x2={px(pb.x)}
                  y2={py(pb.y)}
                  stroke={colors.accent}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {pose.map((p, i) =>
              p.present ? <Circle key={i} cx={px(p.x)} cy={py(p.y)} r={4} fill={colors.text} /> : null
            )}
          </Svg>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Pressable
          onPress={() => setPlaying((p) => !p)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color={colors.onAccent} />
        </Pressable>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </View>
    </View>
  );
}
