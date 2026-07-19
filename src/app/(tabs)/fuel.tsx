import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { Card, ProgressBar, Screen, SectionHeader } from '@/components/ui';
import { todayKey } from '@/lib/format';
import { dailyTargets } from '@/lib/nutrition';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

const WATER_GOAL_ML = 1893; // 64 oz

export default function Fuel() {
  const { colors } = useTheme();
  const runs = useApp((s) => s.runs);
  const profile = useApp((s) => s.profile);
  const hydration = useApp((s) => s.hydration);
  const addWater = useApp((s) => s.addWater);

  const today = todayKey();
  const todayMiles = useMemo(
    () => runs.filter((r) => r.date === today).reduce((a, r) => a + r.distanceMi, 0),
    [runs, today]
  );
  const t = dailyTargets(profile, todayMiles);
  const waterMl = hydration[today] ?? 0;
  const waterOz = Math.round(waterMl / 29.574);

  return (
    <Screen title="Fuel" subtitle="Eat for your training">
      <SectionHeader title="Today's Targets" />
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ProgressRing size={110} stroke={11} progress={1} color={colors.accent}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
              {t.targetKcal.toLocaleString()}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>kcal</Text>
          </View>
        </ProgressRing>
        <View style={{ flex: 1, marginLeft: 18 }}>
          <TargetRow label="Base needs" value={`${t.baseKcal.toLocaleString()} kcal`} />
          <TargetRow
            label={`Running (${todayMiles ? todayMiles + ' mi' : 'rest day'})`}
            value={`+${t.runKcal.toLocaleString()} kcal`}
            accent
          />
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 15 }}>
            Estimated from your profile and today's logged mileage.
          </Text>
        </View>
      </Card>

      <SectionHeader title="Macro Guide" />
      <Card>
        <Macro label="Carbs" grams={t.carbsG} color={colors.info} max={t.carbsG} />
        <Macro label="Protein" grams={t.proteinG} color={colors.good} max={t.carbsG} />
        <Macro label="Fat" grams={t.fatG} color={colors.warn} max={t.carbsG} />
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
          Endurance-athlete guideline scaled to today's volume — carbs rise on bigger days.
        </Text>
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

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="barcode" size={22} color={colors.textMuted} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            Food logging is coming in Phase 2
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            Barcode scanning, photo logging and under-fueling alerts land with Supabase sync.
          </Text>
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
  color,
  max,
}: {
  label: string;
  grams: number;
  color: string;
  max: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
          {grams} g
        </Text>
      </View>
      <ProgressBar value={grams / max} color={color} height={7} />
    </View>
  );
}
