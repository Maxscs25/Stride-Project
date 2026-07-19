import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { InsightCard } from '@/components/InsightCard';
import { BarChart, Heatmap, LoadChart, SparkBars } from '@/components/charts';
import { Card, Screen, SectionHeader } from '@/components/ui';
import { addDays, parseKey, todayKey } from '@/lib/format';
import { buildInsight, loadSeries, weeklyMileSeries } from '@/lib/load';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function Insights() {
  const { colors } = useTheme();
  const runs = useApp((s) => s.runs);
  const cross = useApp((s) => s.cross);
  const journal = useApp((s) => s.journal);
  const shoes = useApp((s) => s.shoes);
  const profile = useApp((s) => s.profile);

  const weekly = useMemo(() => weeklyMileSeries(runs, 8), [runs]);
  const series = useMemo(() => loadSeries(runs, cross, 56), [runs, cross]);
  const insight = useMemo(
    () => buildInsight({ runs, cross, journal, shoes }),
    [runs, cross, journal, shoes]
  );

  const dailyMiles = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs) m.set(r.date, (m.get(r.date) ?? 0) + r.distanceMi);
    return m;
  }, [runs]);

  // Last 14 days of journal wellness, oldest → newest
  const last14 = useMemo(() => {
    const out: { sleep?: number; energy?: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const k = addDays(todayKey(), -i);
      const j = journal.find((e) => e.date === k);
      out.push({ sleep: j?.sleepHours, energy: j?.energy });
    }
    return out;
  }, [journal]);
  const sleepVals = last14.map((d) => d.sleep).filter((v): v is number => v != null);
  const avgSleep = sleepVals.length
    ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1)
    : '—';

  return (
    <Screen title="Insights" subtitle="Trends & analysis">
      <SectionHeader title="Weekly Mileage" />
      <Card>
        <BarChart
          data={weekly.map((w, i) => ({
            label: `${parseKey(w.weekStart).getMonth() + 1}/${parseKey(w.weekStart).getDate()}`,
            value: w.miles,
            highlight: i === weekly.length - 1,
          }))}
          goal={profile.weeklyGoalMi}
        />
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
          Dashed line = your {profile.weeklyGoalMi} mi weekly goal
        </Text>
      </Card>

      <SectionHeader title="Training Load" />
      <Card>
        <LoadChart series={series} />
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 }}>
          Acute (recent) vs chronic (base) load. Staying in the 0.8–1.3 zone keeps ramp-up risk
          low.
        </Text>
      </Card>

      <SectionHeader title="Recovery" />
      <Card>
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              SLEEP · avg {avgSleep}h
            </Text>
            <SparkBars values={last14.map((d) => d.sleep)} maxValue={10} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              ENERGY · 1–5
            </Text>
            <SparkBars values={last14.map((d) => d.energy)} maxValue={5} color={colors.good} />
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>Last 14 days</Text>
      </Card>

      <SectionHeader title="Consistency" />
      <Card>
        <Heatmap dailyMiles={dailyMiles} />
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}>
          Run days, last 12 weeks
        </Text>
      </Card>

      <SectionHeader title="Weekly AI Report" />
      <InsightCard insight={insight} />
    </Screen>
  );
}
