import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';

import { ModalShell } from '@/components/ModalShell';
import { Card, SectionHeader } from '@/components/ui';
import { useForm } from '@/lib/form';
import { useTheme } from '@/theme';

// Healthy zones per metric, for the shaded band on each trend.
const GOOD_BAND: Record<string, [number, number]> = {
  cadence: [170, 190],
  vertical_osc: [5, 9],
  arm_angle: [70, 100],
  symmetry: [90, 100],
};

interface Series {
  key: string;
  label: string;
  unit: string;
  values: number[];
  latest: number;
}

export default function FormTrends() {
  const { colors } = useTheme();
  const analyses = useForm((s) => s.analyses);

  // Real (non-sample) completed analyses, oldest → newest.
  const runs = useMemo(
    () =>
      analyses
        .filter((a) => a.status === 'complete' && !a.sample)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [analyses]
  );

  const series: Series[] = useMemo(() => {
    if (runs.length < 2) return [];
    const latest = runs[runs.length - 1];
    return latest.metrics
      .filter((m) => m.rating !== 'unknown')
      .map((m) => {
        const values = runs
          .map((a) => a.metrics.find((x) => x.key === m.key)?.value)
          .filter((v): v is number => typeof v === 'number');
        return { key: m.key, label: m.label, unit: m.unit, values, latest: m.value ?? 0 };
      })
      .filter((s) => s.values.length >= 2);
  }, [runs]);

  return (
    <ModalShell title="Form Trends">
      {series.length === 0 ? (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
            Record at least two running clips and your form trends show up here — cadence, posture,
            bounce and more, tracked over time.
          </Text>
        </Card>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
            {runs.length} analyses · oldest to newest. The green band is the healthy zone.
          </Text>
          {series.map((s) => (
            <View key={s.key} style={{ marginBottom: 4 }}>
              <SectionHeader
                title={s.label}
                right={
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                    {s.latest}
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}> {s.unit}</Text>
                  </Text>
                }
              />
              <Card>
                <TrendChart values={s.values} band={GOOD_BAND[s.key]} />
              </Card>
            </View>
          ))}
        </>
      )}
    </ModalShell>
  );
}

function TrendChart({ values, band }: { values: number[]; band?: [number, number] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 90;

  const lo = Math.min(...values, band ? band[0] : Infinity);
  const hi = Math.max(...values, band ? band[1] : -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;
  const x = (i: number) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * width);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {band ? (
            <Rect
              x={0}
              y={y(band[1])}
              width={width}
              height={Math.max(0, y(band[0]) - y(band[1]))}
              fill={colors.good}
              opacity={0.13}
            />
          ) : null}
          <Polyline
            points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2.5}
          />
          {values.map((v, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={i === values.length - 1 ? 5 : 3.5}
              fill={i === values.length - 1 ? colors.accent : colors.surface}
              stroke={colors.accent}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
