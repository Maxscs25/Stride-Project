import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { Card, ProgressBar, Screen, SectionHeader } from '@/components/ui';
import { todayKey } from '@/lib/format';
import { dailyTargets, fuelStatus } from '@/lib/nutrition';
import { deleteFood } from '@/lib/sync';
import { MEAL_META, type Meal } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const WATER_GOAL_ML = 1893; // 64 oz

export default function Fuel() {
  const { colors } = useTheme();
  const runs = useApp((s) => s.runs);
  const profile = useApp((s) => s.profile);
  const hydration = useApp((s) => s.hydration);
  const addWater = useApp((s) => s.addWater);
  const foodLogs = useApp((s) => s.foodLogs);

  const today = todayKey();
  const todayMiles = useMemo(
    () => runs.filter((r) => r.date === today).reduce((a, r) => a + r.distanceMi, 0),
    [runs, today]
  );
  const t = dailyTargets(profile, todayMiles);
  const waterMl = hydration[today] ?? 0;
  const waterOz = Math.round(waterMl / 29.574);

  const todayFood = useMemo(() => foodLogs.filter((f) => f.date === today), [foodLogs, today]);
  const eaten = useMemo(
    () =>
      todayFood.reduce(
        (a, f) => ({
          kcal: a.kcal + f.calories,
          p: a.p + f.proteinG,
          c: a.c + f.carbsG,
          fat: a.fat + f.fatG,
        }),
        { kcal: 0, p: 0, c: 0, fat: 0 }
      ),
    [todayFood]
  );
  const remaining = t.targetKcal - eaten.kcal;
  const status = useMemo(() => fuelStatus(profile, runs, foodLogs), [profile, runs, foodLogs]);

  return (
    <Screen title="Fuel" subtitle="Eat for your training">
      <SectionHeader
        title="Today"
        right={
          <Link href="/log/food" asChild>
            <Pressable>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>+ Log food</Text>
            </Pressable>
          </Link>
        }
      />
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ProgressRing
          size={110}
          stroke={11}
          progress={Math.min(1, eaten.kcal / t.targetKcal)}
          color={remaining < -200 ? colors.warn : colors.accent}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
              {eaten.kcal.toLocaleString()}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
              of {t.targetKcal.toLocaleString()}
            </Text>
          </View>
        </ProgressRing>
        <View style={{ flex: 1, marginLeft: 18 }}>
          <TargetRow
            label={remaining >= 0 ? 'Remaining' : 'Over'}
            value={`${Math.abs(remaining).toLocaleString()} kcal`}
            accent
          />
          <TargetRow label="Base needs" value={`${t.baseKcal.toLocaleString()} kcal`} />
          <TargetRow
            label={`Running ${todayMiles ? '(' + todayMiles + ' mi)' : '(rest)'}`}
            value={`+${t.runKcal.toLocaleString()}`}
          />
        </View>
      </Card>

      <SectionHeader title="Macros" />
      <Card>
        <Macro label="Carbs" grams={eaten.c} target={t.carbsG} color={colors.info} />
        <Macro label="Protein" grams={eaten.p} target={t.proteinG} color={colors.good} />
        <Macro label="Fat" grams={eaten.fat} target={t.fatG} color={colors.warn} />
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
          Logged vs endurance-athlete targets scaled to today's volume.
        </Text>
      </Card>

      {status.level !== 'insufficient_data' ? (
        <Card
          style={{
            borderLeftWidth: 3,
            borderLeftColor: status.level === 'low' ? colors.warn : colors.good,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons
              name={status.level === 'low' ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={status.level === 'low' ? colors.warn : colors.good}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
              {status.level === 'low' ? 'Fueling looks low' : 'Fueling on track'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {status.message}
          </Text>
        </Card>
      ) : null}

      <SectionHeader title="Meals" />
      <Card style={{ paddingVertical: 4 }}>
        {todayFood.length === 0 ? (
          <Link href="/log/food" asChild>
            <Pressable style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Nothing logged today — tap to add your first meal
              </Text>
            </Pressable>
          </Link>
        ) : (
          (['breakfast', 'lunch', 'dinner', 'snack'] as Meal[])
            .filter((m) => todayFood.some((f) => f.meal === m))
            .map((m) => (
              <View key={m} style={{ paddingVertical: 6 }}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 0.6,
                    marginBottom: 2,
                  }}>
                  {MEAL_META[m].label.toUpperCase()}
                </Text>
                {todayFood
                  .filter((f) => f.meal === m)
                  .map((f) => (
                    <Pressable
                      key={f.id}
                      onLongPress={() => deleteFood(f.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                          {f.name}
                          {f.servings !== 1 ? `  ×${f.servings}` : ''}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {f.proteinG}P · {f.carbsG}C · {f.fatG}F
                        </Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700' }}>
                        {f.calories}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            ))
        )}
        {todayFood.length > 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 11, paddingVertical: 6 }}>
            Long-press an item to remove it.
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="Hydration" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{waterOz}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', marginLeft: 5, marginBottom: 4 }}>
            of 64 oz
          </Text>
        </View>
        <ProgressBar value={waterMl / WATER_GOAL_ML} color={colors.info} />
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          {[8, 16, 24].map((oz) => (
            <Pressable
              key={oz}
              onPress={() => addWater(Math.round(oz * 29.574))}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginRight: 8,
              }}>
              <Text style={{ color: colors.info, fontSize: 13, fontWeight: '800' }}>+{oz} oz</Text>
            </Pressable>
          ))}
        </View>
      </Card>

    </Screen>
  );
}

function TargetRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: accent ? colors.accent : colors.text,
          fontSize: 13,
          fontWeight: '700',
        }}>
        {value}
      </Text>
    </View>
  );
}

function Macro({
  label,
  grams,
  target,
  color,
}: {
  label: string;
  grams: number;
  target: number;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
          {grams} / {target} g
        </Text>
      </View>
      <ProgressBar value={target > 0 ? grams / target : 0} color={color} height={7} />
    </View>
  );
}
