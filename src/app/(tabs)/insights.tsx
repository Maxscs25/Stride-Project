import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { InsightCard } from '@/components/InsightCard';
import { BarChart, Heatmap, LoadChart, SparkBars } from '@/components/charts';
import { Card, Screen, SectionHeader } from '@/components/ui';
import { addDays, fmtDate, parseKey, todayKey } from '@/lib/format';
import { generateInsight, useInsights } from '@/lib/insights';
import { buildInsight, loadSeries, weeklyMileSeries } from '@/lib/load';
import { useAuth } from '@/lib/sync';
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
  const localInsight = useMemo(
    () => buildInsight({ runs, cross, journal, shoes }),
    [runs, cross, journal, shoes]
  );
  const { session } = useAuth();
  const { latest: remoteInsight, generating, error } = useInsights();
  const insight = remoteInsight ?? localInsight;

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

      <SectionHeader
        title="Weekly AI Report"
        right={
          session ? (
            <Pressable
              onPress={generateInsight}
              disabled={generating}
              style={{ flexDirection: 'row', alignItems: 'center' }}>
              {generating ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>
                  ✦ Generate
                </Text>
              )}
            </Pressable>
          ) : undefined
        }
      />
      {error ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>{error}</Text>
      ) : null}
      <InsightCard insight={insight} />
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: -6 }}>
        {remoteInsight
          ? `Written by your AI coach · ${fmtDate(remoteInsight.createdAt.slice(0, 10))}`
          : session
            ? 'On-device preview — tap Generate for your AI coach report.'
            : 'On-device preview — sign in to get AI coach reports.'}
      </Text>
    </Screen>
  );
}
