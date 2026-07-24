import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Screen, SectionHeader, StatTile } from '@/components/ui';
import {
  addDays,
  fmtDate,
  fmtDuration,
  fmtLongDate,
  fmtPace,
  round1,
  todayKey,
  weekStartKey,
} from '@/lib/format';
import { typeRpe } from '@/lib/load';
import { crossKcal, dailyTargets, runKcal } from '@/lib/nutrition';
import { ACTIVITY_META, WORKOUT_META, type CrossSession, type Run } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const MAX_WEEKS_BACK = 25;

interface DayAgg {
  date: string;
  miles: number;
  runs: Run[];
  cross: CrossSession[];
  hasFelt: boolean;
}

export default function Week() {
  const { colors } = useTheme();
  const runs = useApp((s) => s.runs);
  const cross = useApp((s) => s.cross);
  const journal = useApp((s) => s.journal);
  const foodLogs = useApp((s) => s.foodLogs);
  const profile = useApp((s) => s.profile);

  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const weekStart = useMemo(
    () => addDays(weekStartKey(todayKey()), -7 * weekOffset),
    [weekOffset]
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const perDay = useMemo<DayAgg[]>(
    () =>
      days.map((d) => {
        const dayRuns = runs.filter((r) => r.date === d);
        const dayCross = cross.filter((c) => c.date === d);
        const hasFelt = journal.some(
          (j) =>
            j.date === d &&
            (j.energy != null ||
              j.soreness != null ||
              j.stress != null ||
              j.sleepHours != null ||
              !!j.note)
        );
        return {
          date: d,
          miles: round1(dayRuns.reduce((a, r) => a + r.distanceMi, 0)),
          runs: dayRuns,
          cross: dayCross,
          hasFelt,
        };
      }),
    [days, runs, cross, journal]
  );

  const totalMiles = round1(perDay.reduce((a, p) => a + p.miles, 0));
  const totalRuns = perDay.reduce((a, p) => a + p.runs.length, 0);
  const totalSecs = perDay.reduce(
    (a, p) => a + p.runs.reduce((x, r) => x + r.durationS, 0),
    0
  );
  const rpes = perDay.flatMap((p) => p.runs.map((r) => r.rpe ?? typeRpe(r.type)));
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0;

  // Default the drill-down to today (current week) or the last active day.
  const defaultKey = useMemo(() => {
    const t = todayKey();
    if (days.includes(t)) return t;
    for (let i = perDay.length - 1; i >= 0; i--) {
      const p = perDay[i];
      if (p.miles > 0 || p.cross.length || p.hasFelt) return p.date;
    }
    return days[6];
  }, [days, perDay]);
  const selectedKey = picked && days.includes(picked) ? picked : defaultKey;
  const detail = perDay.find((p) => p.date === selectedKey)!;

  const rangeLabel = `${fmtDate(days[0])} – ${fmtDate(days[6])}`;

  return (
    <Screen title="Week" subtitle="Day-by-day breakdown">
      {/* Week navigator */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
        <NavBtn
          icon="chevron-back"
          disabled={weekOffset >= MAX_WEEKS_BACK}
          onPress={() => {
            setPicked(null);
            setWeekOffset((w) => Math.min(MAX_WEEKS_BACK, w + 1));
          }}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{rangeLabel}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
            {weekOffset === 0
              ? 'This week'
              : weekOffset === 1
                ? 'Last week'
                : `${weekOffset} weeks ago`}
          </Text>
        </View>
        <NavBtn
          icon="chevron-forward"
          disabled={weekOffset === 0}
          onPress={() => {
            setPicked(null);
            setWeekOffset((w) => Math.max(0, w - 1));
          }}
        />
      </Card>

      {/* Weekly summary */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>
            {totalMiles}
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
        <View style={{ flexDirection: 'row' }}>
          <StatTile label="Runs" value={String(totalRuns)} />
          <StatTile label="Time" value={totalSecs ? fmtDuration(totalSecs) : '—'} />
          <StatTile label="Avg RPE" value={avgRpe ? avgRpe.toFixed(1) : '—'} />
        </View>
      </Card>

      {/* Interactive daily bar chart */}
      <Card>
        <WeekBars perDay={perDay} selectedKey={selectedKey} onSelect={setPicked} />
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          Tap a day for the full breakdown
        </Text>
      </Card>

      {/* Selected-day detail */}
      <SectionHeader title={fmtLongDate(selectedKey)} />
      <DayDetail
        day={detail}
        journal={journal}
        foodLogs={foodLogs}
        profile={profile}
        isToday={selectedKey === todayKey()}
      />
    </Screen>
  );
}

function NavBtn({
  icon,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceAlt,
        opacity: disabled ? 0.35 : 1,
      }}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CHART_H = 140;

function WeekBars({
  perDay,
  selectedKey,
  onSelect,
}: {
  perDay: DayAgg[];
  selectedKey: string;
  onSelect: (d: string) => void;
}) {
  const { colors } = useTheme();
  const today = todayKey();
  const max = Math.max(...perDay.map((p) => p.miles), 1) * 1.15;
  const barArea = CHART_H - 18; // leave room for the value label

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {perDay.map((p, i) => {
        const selected = p.date === selectedKey;
        const isToday = p.date === today;
        const runOnly = p.miles > 0;
        const crossOnly = p.miles === 0 && p.cross.length > 0;
        const barColor = selected
          ? colors.accent
          : runOnly
            ? colors.accent + '77'
            : crossOnly
              ? colors.info + '77'
              : colors.surfaceAlt;
        const h = runOnly ? Math.max(6, (p.miles / max) * barArea) : crossOnly ? 8 : 4;
        return (
          <Pressable
            key={p.date}
            onPress={() => onSelect(p.date)}
            style={{ flex: 1, alignItems: 'center' }}>
            {/* full-height tappable column */}
            <View style={{ height: CHART_H, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text
                style={{
                  color: selected ? colors.accent : colors.textMuted,
                  fontSize: 10,
                  fontWeight: '800',
                  marginBottom: 3,
                }}>
                {p.miles > 0 ? p.miles : ''}
              </Text>
              <View
                style={{
                  width: '58%',
                  height: h,
                  borderRadius: 6,
                  backgroundColor: barColor,
                  borderWidth: selected ? 0 : crossOnly || runOnly ? 0 : 1,
                  borderColor: colors.border,
                }}
              />
            </View>
            {/* weekday + indicator dots */}
            <Text
              style={{
                color: selected ? colors.accent : isToday ? colors.text : colors.textMuted,
                fontSize: 11,
                fontWeight: isToday || selected ? '800' : '600',
                marginTop: 6,
              }}>
              {WEEKDAYS[i]}
            </Text>
            <View style={{ flexDirection: 'row', height: 6, marginTop: 3 }}>
              {p.cross.length ? <Dot color={colors.info} /> : null}
              {p.hasFelt ? <Dot color={colors.good} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginHorizontal: 1.5 }} />;
}

function DayDetail({
  day,
  journal,
  foodLogs,
  profile,
  isToday,
}: {
  day: DayAgg;
  journal: ReturnType<typeof useApp.getState>['journal'];
  foodLogs: ReturnType<typeof useApp.getState>['foodLogs'];
  profile: ReturnType<typeof useApp.getState>['profile'];
  isToday: boolean;
}) {
  const { colors } = useTheme();

  const dayJournal = journal.filter((j) => j.date === day.date);
  const pick = <T,>(get: (j: (typeof dayJournal)[number]) => T | undefined | null): T | undefined => {
    for (let i = dayJournal.length - 1; i >= 0; i--) {
      const v = get(dayJournal[i]);
      if (v != null) return v as T;
    }
    return undefined;
  };
  const felt = {
    energy: pick((j) => j.energy),
    soreness: pick((j) => j.soreness),
    stress: pick((j) => j.stress),
    sleepHours: pick((j) => j.sleepHours),
  };
  const hasFelt =
    felt.energy != null || felt.soreness != null || felt.stress != null || felt.sleepHours != null;

  const notes = Array.from(
    new Set(
      [...dayJournal.map((j) => j.note), ...day.runs.map((r) => r.note)].filter(
        (n): n is string => !!n && n.trim().length > 0
      )
    )
  );

  const consumed = foodLogs.filter((f) => f.date === day.date).reduce((a, f) => a + f.calories, 0);
  const burned =
    day.runs.reduce((a, r) => a + runKcal(profile, r.distanceMi), 0) +
    day.cross.reduce((a, c) => a + crossKcal(profile, c), 0);
  const target = dailyTargets(profile, day.miles).targetKcal;

  const empty = day.runs.length === 0 && day.cross.length === 0 && !hasFelt && !notes.length;

  if (empty) {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <Ionicons name="bed-outline" size={26} color={colors.textMuted} />
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 8 }}>
          {isToday ? 'Nothing logged yet today' : 'Rest day'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
          No runs, cross-training, or check-in.
        </Text>
      </Card>
    );
  }

  return (
    <>
      {/* Sessions */}
      {day.runs.length || day.cross.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {day.runs.map((r, i) => {
            const meta = WORKOUT_META[r.type];
            const rpe = r.rpe ?? typeRpe(r.type);
            const explicit = r.rpe != null;
            return (
              <View
                key={r.id}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth:
                    i === day.runs.length - 1 && !day.cross.length ? 0 : 1,
                  borderBottomColor: colors.border,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: meta.color,
                      marginRight: 12,
                    }}
                  />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                    {meta.label} run
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                    {r.distanceMi} mi
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 22 }}>
                  <Meta text={fmtDuration(r.durationS)} colors={colors} />
                  <Meta text={fmtPace(r.distanceMi, r.durationS)} colors={colors} />
                  <View
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '800' }}>
                      RPE {explicit ? rpe : `~${rpe}`}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
          {day.cross.map((c, i) => {
            const meta = ACTIVITY_META[c.activity];
            return (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: i === day.cross.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}>
                <Ionicons
                  name={meta.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={colors.info}
                  style={{ marginRight: 10, width: 16 }}
                />
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                  {meta.label}
                </Text>
                {c.intensity ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 10 }}>
                    intensity {c.intensity}/5
                  </Text>
                ) : null}
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '800' }}>
                  {c.minutes} min
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* How you felt */}
      {hasFelt ? (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 }}>
            HOW YOU FELT
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {felt.energy != null ? <FeltTile label="Energy" value={`${felt.energy}/5`} colors={colors} /> : null}
            {felt.soreness != null ? (
              <FeltTile
                label="Soreness"
                value={`${felt.soreness}/5`}
                colors={colors}
                warn={felt.soreness >= 4}
              />
            ) : null}
            {felt.stress != null ? <FeltTile label="Stress" value={`${felt.stress}/5`} colors={colors} /> : null}
            {felt.sleepHours != null ? (
              <FeltTile label="Sleep" value={`${felt.sleepHours}h`} colors={colors} />
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* Notes / pain */}
      {notes.length ? (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>
            NOTES
          </Text>
          {notes.map((n, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', marginTop: i === 0 ? 0 : 8 }}>
              <Ionicons
                name="chatbox-ellipses-outline"
                size={15}
                color={colors.textMuted}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{n}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Calories */}
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 12 }}>
          CALORIES
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <StatTile
            label="Consumed"
            value={consumed ? consumed.toLocaleString() : '—'}
            sub={consumed ? `of ~${target.toLocaleString()} need` : 'not logged'}
          />
          <StatTile label="Burned" value={burned ? `+${burned.toLocaleString()}` : '—'} sub="run + cross" accent />
          <StatTile
            label="Net"
            value={consumed ? (consumed - burned).toLocaleString() : '—'}
            sub="intake − burn"
          />
        </View>
      </Card>
    </>
  );
}

function Meta({ text, colors }: { text: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 12 }}>
      {text}
    </Text>
  );
}

function FeltTile({
  label,
  value,
  colors,
  warn,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  warn?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginRight: 8,
        marginBottom: 8,
        minWidth: 76,
      }}>
      <Text style={{ color: warn ? colors.warn : colors.text, fontSize: 18, fontWeight: '800' }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}
