import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, Field } from '@/components/ui';
import { updateProfileRemote, useAuth } from '@/lib/sync';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const STEPS = ['About you', 'Your goals', 'Fuel targets', 'Daily checklist'] as const;
const EXPERIENCE = [
  { value: 'new', label: 'New to running' },
  { value: 'regular', label: 'Consistent runner' },
  { value: 'competitive', label: 'Competitive' },
] as const;
const RACES = ['5K', '10K', 'Half Marathon', 'Marathon', 'No race yet'];

export default function Onboarding() {
  const { colors } = useTheme();
  const profile = useApp((s) => s.profile);
  const checklistDefs = useApp((s) => s.checklistDefs);
  const setProfile = useApp((s) => s.setProfile);
  const setChecklistDisabled = useApp((s) => s.setChecklistDisabled);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name === 'Runner' ? '' : profile.name);
  const [experience, setExperience] = useState<typeof EXPERIENCE[number]['value']>(
    profile.experience ?? 'regular'
  );
  const [weeklyGoal, setWeeklyGoal] = useState(profile.weeklyGoalMi);
  const [raceGoal, setRaceGoal] = useState(profile.raceGoal);
  const [sex, setSex] = useState<'male' | 'female'>(profile.sex);
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(checklistDefs.map((d) => [d.key, !d.disabled]))
  );

  const finish = () => {
    const ft = parseFloat(heightFt);
    const inch = parseFloat(heightIn) || 0;
    const lb = parseFloat(weightLb);
    const heightCm = ft > 0 ? Math.round((ft * 12 + inch) * 2.54) : profile.heightCm;
    const weightKg = lb > 0 ? Math.round(lb * 0.4536) : profile.weightKg;
    const ageNum = parseInt(age, 10) || profile.age;
    const finalName = name.trim() || profile.name;

    setProfile({
      name: finalName,
      experience,
      weeklyGoalMi: weeklyGoal,
      raceGoal: raceGoal.trim() || 'No race yet',
      sex,
      age: ageNum,
      heightCm,
      weightKg,
    });
    for (const d of checklistDefs) {
      if (d.key !== 'run') setChecklistDisabled(d.key, !enabled[d.key]);
    }
    updateProfileRemote({
      display_name: finalName,
      experience_level: experience,
      weekly_goal_mi: weeklyGoal,
      race_goal: raceGoal.trim() || 'No race yet',
      gender: sex,
      age: ageNum,
      height_cm: heightCm,
      weight_kg: weightKg,
      onboarded_at: new Date().toISOString(),
    });
    useAuth.setState({ needsOnboarding: false });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 24,
                  height: 5,
                  borderRadius: 3,
                  marginRight: 6,
                  backgroundColor: i <= step ? colors.accent : colors.surfaceAlt,
                }}
              />
            ))}
          </View>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
            STEP {step + 1} OF {STEPS.length}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.6,
              marginTop: 4,
              marginBottom: 16,
            }}>
            {STEPS[step]}
          </Text>

          {step === 0 ? (
            <>
              <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="Your name" />
              <Label text="Where are you in your running?" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {EXPERIENCE.map((e) => (
                  <Chip
                    key={e.value}
                    label={e.label}
                    selected={experience === e.value}
                    onPress={() => setExperience(e.value)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Label text="Weekly mileage goal" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {[15, 25, 35, 45].map((mi) => (
                  <Chip
                    key={mi}
                    label={`${mi} mi`}
                    selected={weeklyGoal === mi}
                    onPress={() => setWeeklyGoal(mi)}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                <Stepper label="−" onPress={() => setWeeklyGoal(Math.max(5, weeklyGoal - 5))} />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 22,
                    fontWeight: '800',
                    marginHorizontal: 16,
                    minWidth: 70,
                    textAlign: 'center',
                  }}>
                  {weeklyGoal} mi
                </Text>
                <Stepper label="+" onPress={() => setWeeklyGoal(weeklyGoal + 5)} />
              </View>
              <Label text="Racing toward anything?" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {RACES.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    selected={raceGoal.startsWith(r)}
                    onPress={() => setRaceGoal(r === 'No race yet' ? 'No race yet' : r)}
                  />
                ))}
              </View>
              <Field
                label="Race goal (edit freely)"
                value={raceGoal}
                onChangeText={setRaceGoal}
                placeholder="e.g. Sub-19 5K · Oct 10"
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
                Used only to estimate your daily calorie and macro targets. All optional.
              </Text>
              <Label text="Sex" />
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <Chip label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
                <Chip label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
              </View>
              <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="19" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Height (ft)" value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" placeholder="5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="(in)" value={heightIn} onChangeText={setHeightIn} keyboardType="number-pad" placeholder="10" />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Field label="Weight (lb)" value={weightLb} onChangeText={setWeightLb} keyboardType="decimal-pad" placeholder="145" />
                </View>
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
                Your daily habit loop — tick these off each day to build streaks. Toggle off anything
                you don't want to track.
              </Text>
              {checklistDefs.map((d) => (
                <View
                  key={d.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginBottom: 8,
                  }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>
                    {d.label}
                    {d.days ? '  ·  2×/week' : ''}
                  </Text>
                  <Switch
                    value={d.key === 'run' ? true : enabled[d.key]}
                    disabled={d.key === 'run'}
                    onValueChange={(v) => setEnabled((e) => ({ ...e, [d.key]: v }))}
                    trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
          {step > 0 ? (
            <Pressable
              onPress={() => setStep(step - 1)}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 22,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
              }}>
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '800' }}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
            style={{
              flex: 1,
              paddingVertical: 15,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              alignItems: 'center',
            }}>
            <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '800' }}>
              {step === STEPS.length - 1 ? "Let's run" : 'Next'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
      {text}
    </Text>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
