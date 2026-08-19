import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';

import { ChecklistCard } from '@/components/ChecklistCard';
import { InsightCard } from '@/components/InsightCard';
import { Card, ProgressBar, Screen, SectionHeader, StatTile } from '@/components/ui';
import { fmtLongDate, round1, todayKey, weekStartKey } from '@/lib/format';
import { daysUntilGoal } from '@/lib/goalReminders';
import { plannedFor, planTotal, planTypeColor, planTypeLabel } from '@/lib/plan';
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
  const items = checklistDefs.filter(
    (d) => !d.disabled && (!d.days || d.days.includes(dow))
  );
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
  const needsOnboarding = useAuth((s) => s.needsOnboarding);
  const sessionLost = useAuth((s) => s.sessionLost);
  const pendingCount = useApp((s) => s.pending.length);

  useEffect(() => {
    if (needsOnboarding && session) {
      useAuth.setState({ needsOnboarding: false });
      router.push('/onboarding');
    }
  }, [needsOnboarding, session]);

  return (
    <Screen title="Today" subtitle={fmtLongDate(today)}>
      {ready && !session ? (
        <Card
          onPress={() => router.push('/auth')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            ...(sessionLost ? { borderLeftWidth: 3, borderLeftColor: colors.warn } : {}),
          }}>
          <Ionicons
            name={sessionLost ? 'cloud-offline' : 'cloud-upload'}
            size={20}
            color={sessionLost ? colors.warn : colors.accent}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              {sessionLost ? 'Signed out — nothing lost' : "You're looking at demo data"}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
              {sessionLost
                ? `Your training is safe on this device${
                    pendingCount ? ` (${pendingCount} waiting to sync)` : ''
                  }. Sign back in to resume syncing →`
                : 'Create a free account to start your real training log →'}
            </Text>
          </View>
        </Card>
      ) : null}
      <GoalCard />
      <InsightCard insight={insight} />

      <TodayPlanCard />

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

/** What today is for, per the weekly template, and how much of it is done. */
function TodayPlanCard() {
  const { colors } = useTheme();
  const weekPlan = useApp((s) => s.weekPlan);
  const runs = useApp((s) => s.runs);
  const today = todayKey();
  const plan = plannedFor(weekPlan, today);
  if (!plan) return null;

  const done = round1(runs.filter((r) => r.date === today).reduce((a, r) => a + r.distanceMi, 0));
  const rest = plan.type === 'rest';
  const left = round1(Math.max(0, plan.miles - done));
  const complete = !rest && done >= plan.miles && plan.miles > 0;
  // Fresh template: day types exist but no mileage yet. Showing "0 mi tempo"
  // would read as a target of zero, so prompt for targets instead.
  const unset = !rest && planTotal(weekPlan) === 0;

  return (
    <Card
      onPress={() => router.push('/plan')}
      style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: planTypeColor(plan.type, colors.textMuted) + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
        <Ionicons
          name={rest ? 'bed-outline' : complete ? 'checkmark' : 'walk'}
          size={19}
          color={planTypeColor(plan.type, colors.textMuted)}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
          TODAY'S PLAN
        </Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
          {rest
            ? 'Rest day'
            : unset
              ? `${planTypeLabel(plan.type)} day`
              : `${plan.miles} mi ${planTypeLabel(plan.type).toLowerCase()}`}
        </Text>
        {unset ? (
          <Text style={{ color: colors.accent, fontSize: 12, marginTop: 2 }}>
            Set your weekly mileage targets →
          </Text>
        ) : !rest && done > 0 ? (
          <Text style={{ color: complete ? colors.good : colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {complete ? `Done — ${done} mi logged` : `${done} mi logged · ${left} mi to go`}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </Card>
  );
}

/** The runner's "why", kept at the top of the home screen on purpose. */
function GoalCard() {
  const { colors } = useTheme();
  const profile = useApp((s) => s.profile);
  const goal = profile.personalGoal?.trim();
  const days = daysUntilGoal(profile);

  if (!goal) {
    return (
      <Card
        onPress={() => router.push('/goal')}
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="flag-outline" size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
          Set your goal — the reason behind the training.
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      </Card>
    );
  }

  return (
    <Card
      onPress={() => router.push('/goal')}
      style={{ borderLeftWidth: 3, borderLeftColor: colors.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons name="flag" size={13} color={colors.accent} style={{ marginRight: 6 }} />
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.8,
            flex: 1,
          }}>
          YOUR GOAL
        </Text>
        {days != null ? (
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
            {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 }}>
        {goal}
      </Text>
    </Card>
  );
}
