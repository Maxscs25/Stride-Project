import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { ChecklistCard } from '@/components/ChecklistCard';
import { InsightCard } from '@/components/InsightCard';
import { Card, ProgressBar, Screen, SectionHeader, StatTile } from '@/components/ui';
import { fmtLongDate, round1, todayKey, weekStartKey } from '@/lib/format';
import { useInsights } from '@/lib/insights';
import { buildInsight, shoeMiles, weeklyMiles } from '@/lib/load';
import { currentStreak } from '@/lib/streaks';
import { useAuth } from '@/lib/sync';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function Today() {
  const { colors } = useTheme();
  const runs = useApp((s) => s.runs);
  const cross = useApp((s) => s.cross);
  const journal = useApp((s) => s.journal);
  const shoes = useApp((s) => s.shoes);
  const checklistDefs = useApp((s) => s.checklistDefs);
  const completions = useApp((s) => s.completions);
  const profile = useApp((s) => s.profile);
  const toggleItem = useApp((s) => s.toggleItem);

  const today = todayKey();
  const remoteInsight = useInsights((s) => s.latest);
  const localInsight = useMemo(
    () => buildInsight({ runs, cross, journal, shoes }),
    [runs, cross, journal, shoes]
  );
  const insight = remoteInsight ?? localInsight;

  const week = weeklyMiles(runs, 0);
  const dow = new Date().getDay();
  const items = checklistDefs.filter((d) => !d.days || d.days.includes(dow));
  const done = completions[today] ?? {};
  const doneCount = items.filter((i) => done[i.key]).length;
  const streaks = Object.fromEntries(
    items.map((i) => [i.key, currentStreak(completions, i.key)])
  );

  const wornShoe = shoes.find(
    (s) => !s.retiredAt && shoeMiles(s, runs) / s.lifespanMiles >= 0.9
  );

  const runsThisWeek = useMemo(
    () => runs.filter((r) => r.date >= weekStartKey(today)).length,
    [runs, today]
  );

  const { session, ready } = useAuth();

  return (
    <Screen title="Today" subtitle={fmtLongDate(today)}>
      {ready && !session ? (
        <Card
          onPress={() => router.push('/auth')}
          style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name="cloud-upload"
            size={20}
            color={colors.accent}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              You're looking at demo data
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              Create a free account to start your real training log →
            </Text>
          </View>
        </Card>
      ) : null}
      <InsightCard insight={insight} />

      <SectionHeader title="This Week" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 }}>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>
            {round1(week)}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 14,
              fontWeight: '600',
              marginLeft: 6,
              marginBottom: 5,
            }}>
            of {profile.weeklyGoalMi} mi goal
          </Text>
        </View>
        <ProgressBar value={week / profile.weeklyGoalMi} />
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <StatTile label="Runs" value={String(runsThisWeek)} />
          <StatTile label="Goal progress" value={`${Math.round((week / profile.weeklyGoalMi) * 100)}%`} />
          <StatTile label="Checklist" value={`${doneCount}/${items.length}`} />
        </View>
      </Card>

      {wornShoe ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="alert-circle" size={22} color={colors.warn} style={{ marginRight: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {wornShoe.brand} {wornShoe.model}
            </Text>{' '}
            has ~{Math.max(0, Math.round(wornShoe.lifespanMiles - shoeMiles(wornShoe, runs)))} mi
            left. Time to start shopping for a replacement.
          </Text>
        </Card>
      ) : null}

      <SectionHeader
        title="Daily Checklist"
        right={
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>
            {doneCount}/{items.length} done
          </Text>
        }
      />
      <ChecklistCard
        items={items}
        done={done}
        streaks={streaks}
        onToggle={(key) => toggleItem(today, key)}
      />
    </Screen>
  );
}
