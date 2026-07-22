import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { SKELETON_BONES } from '@/lib/gait';
import { useTheme } from '@/theme';

/**
 * Animated playback of the detected pose. Draws the COCO-17 skeleton per frame
 * from packed [x,y,score] keypoints (normalized, y-down) and advances on a
 * timer, with play/pause and a scrubber. Pure SVG — no video needed.
 */
export function SkeletonPlayer({
  frames,
  fps,
  height = 300,
}: {
  frames: number[][][];
  fps: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    raf.current = setInterval(
      () => setIdx((i) => (i + 1) % frames.length),
      1000 / Math.min(Math.max(fps, 8), 20)
    );
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, [playing, frames.length, fps]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const frame = frames[idx] ?? frames[0];

  // Fit the normalized points to the view with a little padding.
  const px = (x: number) => 16 + x * (width - 32);
  const py = (y: number) => 12 + y * (height - 24);

  return (
    <View>
      <View
        onLayout={onLayout}
        style={{
          height,
          borderRadius: 14,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}>
        {width > 0 && frame ? (
          <Svg width={width} height={height}>
            {SKELETON_BONES.map(([a, b], i) => {
              const pa = frame[a];
              const pb = frame[b];
              if (!pa || !pb || pa[2] < 0.2 || pb[2] < 0.2) return null;
              return (
                <Line
                  key={i}
                  x1={px(pa[0])}
                  y1={py(pa[1])}
                  x2={px(pb[0])}
                  y2={py(pb[1])}
                  stroke={colors.accent}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {frame.map((p, i) =>
              p[2] < 0.2 ? null : (
                <Circle key={i} cx={px(p[0])} cy={py(p[1])} r={4} fill={colors.text} />
              )
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
        <View style={{ flex: 1 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${((idx + 1) / frames.length) * 100}%`,
                backgroundColor: colors.accent,
              }}
            />
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 10, fontWeight: '600' }}>
          {(idx / Math.min(Math.max(fps, 8), 20)).toFixed(1)}s
        </Text>
      </View>
    </View>
  );
}
