import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { WearBar } from '@/components/WearBar';
import { Card, Screen, SectionHeader } from '@/components/ui';
import { fmtDate, fmtDuration, fmtPace, fmtWeekday, round1 } from '@/lib/format';
import { shoeMiles, weeklyMiles } from '@/lib/load';
import { ACTIVITY_META, WORKOUT_META, type CrossSession, type Run } from '@/lib/types';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

type FeedItem =
  | { kind: 'run'; date: string; run: Run }
  | { kind: 'cross'; date: string; cross: CrossSession };

export default function Training() {
  const { colors } = useTheme();
  const runs = useApp((s) => s.runs);
  const cross = useApp((s) => s.cross);
  const shoes = useApp((s) => s.shoes);
  const prs = useApp((s) => s.prs);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...runs.map((r) => ({ kind: 'run' as const, date: r.date, run: r })),
      ...cross.map((c) => ({ kind: 'cross' as const, date: c.date, cross: c })),
    ];
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 25);
  }, [runs, cross]);

  const thisWeek = weeklyMiles(runs, 0);
  const lastWeek = weeklyMiles(runs, 1);
  const totalMiles = round1(runs.reduce((a, r) => a + r.distanceMi, 0));

  return (
    <Screen title="Training" subtitle="History & gear">
      <Card style={{ flexDirection: 'row' }}>
        <Stat label="This week" value={`${thisWeek} mi`} />
        <Stat label="Last week" value={`${lastWeek} mi`} />
        <Stat label="Logged total" value={`${Math.round(totalMiles)} mi`} />
      </Card>

      <SectionHeader
        title="Shoe Locker"
        right={
          <Link href="/log/shoe" asChild>
            <Pressable>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>+ Add</Text>
            </Pressable>
          </Link>
        }
      />
      {shoes.filter((s) => !s.retiredAt).length === 0 ? (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            No shoes yet — add your current pair to start tracking wear.
          </Text>
        </Card>
      ) : null}
      {shoes
        .filter((s) => !s.retiredAt)
        .map((shoe) => {
          const miles = shoeMiles(shoe, runs);
          return (
            <Card key={shoe.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: shoe.color + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}>
                  <Ionicons name="footsteps" size={16} color={shoe.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                    {shoe.brand} {shoe.model}
                  </Text>
                  {shoe.isDefault ? (
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                      Default shoe
                    </Text>
                  ) : null}
                </View>
              </View>
              <WearBar miles={miles} lifespan={shoe.lifespanMiles} />
            </Card>
          );
        })}

      <SectionHeader title="Recent Activity" />
      <Card style={{ paddingVertical: 4 }}>
        {feed.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 10 }}>
            Nothing logged yet — tap + to record your first run.
          </Text>
        ) : null}
        {feed.map((item, i) => (
          <View
            key={item.kind === 'run' ? item.run.id : item.cross.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 11,
              borderBottomWidth: i === feed.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}>
            {item.kind === 'run' ? (
              <RunRow run={item.run} />
            ) : (
              <CrossRow cross={item.cross} />
            )}
          </View>
        ))}
      </Card>

      <SectionHeader title="Personal Records" />
      <Card style={{ paddingVertical: 4 }}>
        {prs.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 10 }}>
            Race results will show up here.
          </Text>
        ) : null}
        {prs.map((pr, i) => (
          <View
            key={pr.dist}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: i === prs.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}>
            <Ionicons name="trophy" size={16} color={colors.warn} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
              {pr.dist}
            </Text>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '800', marginRight: 10 }}>
              {pr.time}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fmtDate(pr.date)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function RunRow({ run }: { run: Run }) {
  const { colors } = useTheme();
  const meta = WORKOUT_META[run.type];
  return (
    <>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: meta.color,
          marginRight: 12,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{meta.label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {fmtWeekday(run.date)} · {fmtDate(run.date)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
          {run.distanceMi} mi
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {fmtDuration(run.durationS)} · {fmtPace(run.distanceMi, run.durationS)}
        </Text>
      </View>
    </>
  );
}

function CrossRow({ cross }: { cross: CrossSession }) {
  const { colors } = useTheme();
  const meta = ACTIVITY_META[cross.activity];
  return (
    <>
      <Ionicons
        name={meta.icon as never}
        size={14}
        color={colors.info}
        style={{ marginRight: 10, width: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{meta.label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {fmtWeekday(cross.date)} · {fmtDate(cross.date)}
        </Text>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
        {cross.minutes} min
      </Text>
    </>
  );
}
