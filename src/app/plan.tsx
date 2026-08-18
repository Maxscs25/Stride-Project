import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { Card } from '@/components/ui';
import { distributeMiles, planTotal, planTypeColor, planTypeLabel } from '@/lib/plan';
import { saveWeekPlan } from '@/lib/sync';
import { DOW_LABEL, WORKOUT_META, type PlanDay, type PlanDayType } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

/** Day types worth offering in a weekly template — 'other' adds nothing here. */
const TYPES: PlanDayType[] = [
  'rest',
  'easy',
  'recovery',
  'tempo',
  'intervals',
  'hills',
  'long',
];

export default function WeekPlan() {
  const { colors } = useTheme();
  const stored = useApp((s) => s.weekPlan);
  const goal = useApp((s) => s.profile.weeklyGoalMi);

  const [plan, setPlan] = useState<PlanDay[]>(stored);
  const [openDow, setOpenDow] = useState<number | null>(null);

  const total = planTotal(plan);
  const diff = Math.round((total - goal) * 10) / 10;

  const setDay = (dow: number, patch: Partial<PlanDay>) =>
    setPlan((p) => p.map((d) => (d.dow === dow ? { ...d, ...patch } : d)));

  const save = () => {
    saveWeekPlan(plan);
    router.back();
  };

  return (
    <ModalShell title="Weekly Plan">
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
        Set what each day is normally for, then let Stride split your{' '}
        {goal} mi goal across them. Today's target shows up on your home screen.
      </Text>

      <Pressable
        onPress={() => setPlan((p) => distributeMiles(p, goal))}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent + '18',
          borderWidth: 1,
          borderColor: colors.accent + '55',
          borderRadius: radius.md,
          paddingVertical: 13,
          marginBottom: 16,
        }}>
        <Ionicons name="sparkles" size={16} color={colors.accent} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>
          Fill in miles for me
        </Text>
      </Pressable>

      {plan.map((d) => {
        const open = openDow === d.dow;
        const rest = d.type === 'rest';
        return (
          <Card key={d.dow} style={{ paddingVertical: 12 }}>
            <Pressable
              onPress={() => setOpenDow(open ? null : d.dow)}
              style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: planTypeColor(d.type, colors.border),
                  marginRight: 10,
                }}
              />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                {DOW_LABEL[d.dow]}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginRight: 10 }}>
                {planTypeLabel(d.type)}
              </Text>
              <Text
                style={{
                  color: rest ? colors.textMuted : colors.text,
                  fontSize: 15,
                  fontWeight: '800',
                  minWidth: 52,
                  textAlign: 'right',
                }}>
                {rest ? '—' : `${d.miles} mi`}
              </Text>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.textMuted}
                style={{ marginLeft: 8 }}
              />
            </Pressable>

            {open ? (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                  {TYPES.map((t) => {
                    const on = d.type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() =>
                          setDay(d.dow, { type: t, ...(t === 'rest' ? { miles: 0 } : {}) })
                        }
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 999,
                          marginRight: 6,
                          marginBottom: 6,
                          backgroundColor: on
                            ? t === 'rest'
                              ? colors.textMuted
                              : WORKOUT_META[t].color
                            : colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: on ? 'transparent' : colors.border,
                        }}>
                        <Text
                          style={{
                            color: on ? colors.bg : colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '700',
                          }}>
                          {planTypeLabel(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {rest ? null : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
                      Target miles
                    </Text>
                    <Stepper
                      onPress={() => setDay(d.dow, { miles: Math.max(0, d.miles - 0.5) })}
                      icon="remove"
                    />
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: '800',
                        marginHorizontal: 14,
                        minWidth: 42,
                        textAlign: 'center',
                      }}>
                      {d.miles}
                    </Text>
                    <Stepper
                      onPress={() => setDay(d.dow, { miles: d.miles + 0.5 })}
                      icon="add"
                    />
                  </View>
                )}
              </View>
            ) : null}
          </Card>
        );
      })}

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
            {total} mi planned
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {diff === 0
              ? `Exactly your ${goal} mi goal`
              : `${diff > 0 ? '+' : ''}${diff} mi vs your ${goal} mi goal`}
          </Text>
        </View>
        <Ionicons
          name={diff === 0 ? 'checkmark-circle' : 'information-circle-outline'}
          size={22}
          color={diff === 0 ? colors.good : colors.textMuted}
        />
      </Card>

      <Pressable
        onPress={save}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 8,
        }}>
        <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>Save plan</Text>
      </Pressable>
    </ModalShell>
  );
}

function Stepper({ onPress, icon }: { onPress: () => void; icon: 'add' | 'remove' }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
