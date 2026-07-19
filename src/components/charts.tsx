import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import type { LoadPoint } from '@/lib/load';
import { addDays, todayKey, weekStartKey } from '@/lib/format';
import { useTheme } from '@/theme';

export function BarChart({
  data,
  goal,
  height = 130,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  goal?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), goal ?? 0, 1) * 1.15;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {goal ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (goal / max) * height,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.warn,
              opacity: 0.7,
            }}
          />
        ) : null}
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 3 }}>
              {d.value > 0 ? Math.round(d.value) : ''}
            </Text>
            <View
              style={{
                width: '55%',
                height: Math.max(3, (d.value / max) * height - 16),
                borderRadius: 6,
                backgroundColor: d.highlight ? colors.accent : colors.surfaceAlt,
                borderWidth: d.highlight ? 0 : 1,
                borderColor: colors.border,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: '600',
            }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function LoadChart({ series, height = 120 }: { series: LoadPoint[]; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(...series.map((p) => Math.max(p.acute, p.chronic)), 1) * 1.1;
  const pts = (key: 'acute' | 'chronic') =>
    series
      .map((p, i) => {
        const x = (i / (series.length - 1)) * width;
        const y = height - (p[key] / max) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  const acwr = series[series.length - 1]?.acwr ?? 1;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={pts('chronic')}
            fill="none"
            stroke={colors.info}
            strokeWidth={2}
            opacity={0.8}
          />
          <Polyline points={pts('acute')} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <LegendDot color={colors.accent} label="Acute (7d)" />
        <LegendDot color={colors.info} label="Chronic (28d)" />
        <View style={{ flex: 1 }} />
        <Text
          style={{
            color: acwr > 1.3 ? colors.warn : colors.good,
            fontSize: 13,
            fontWeight: '800',
          }}>
          A:C {acwr.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 5 }} />
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Heatmap({ dailyMiles }: { dailyMiles: Map<string, number> }) {
  const { colors } = useTheme();
  const weeks = 12;
  const start = addDays(weekStartKey(todayKey()), -7 * (weeks - 1));
  const max = Math.max(...dailyMiles.values(), 1);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {Array.from({ length: weeks }).map((_, w) => (
        <View key={w}>
          {Array.from({ length: 7 }).map((_, d) => {
            const key = addDays(start, w * 7 + d);
            const mi = dailyMiles.get(key) ?? 0;
            const future = key > todayKey();
            return (
              <View
                key={d}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  marginBottom: 4,
                  backgroundColor:
                    mi > 0 ? colors.accent : future ? 'transparent' : colors.surfaceAlt,
                  opacity: mi > 0 ? 0.35 + 0.65 * (mi / max) : 1,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function SparkBars({
  values,
  maxValue,
  color,
  height = 34,
}: {
  values: (number | undefined)[];
  maxValue: number;
  color: string;
  height?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 1.5,
            height: v ? Math.max(3, (v / maxValue) * height) : 3,
            borderRadius: 2,
            backgroundColor: v ? color : colors.surfaceAlt,
          }}
        />
      ))}
    </View>
  );
}
