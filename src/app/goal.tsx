import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { ModalShell } from '@/components/ModalShell';
import { Chip, Field } from '@/components/ui';
import { addDays, fmtLongDate, todayKey } from '@/lib/format';
import {
  daysUntilGoal,
  isReminderAvailable,
  syncGoalReminders,
} from '@/lib/goalReminders';
import { updateProfileRemote } from '@/lib/sync';
import { GOAL_REMINDER_META, type GoalReminder } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const TIMES = [
  { minute: 360, label: '6:00 AM' },
  { minute: 420, label: '7:00 AM' },
  { minute: 480, label: '8:00 AM' },
  { minute: 720, label: '12:00 PM' },
  { minute: 1140, label: '7:00 PM' },
  { minute: 1260, label: '9:00 PM' },
];

export default function GoalScreen() {
  const { colors } = useTheme();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);

  const [goal, setGoal] = useState(profile.personalGoal ?? '');
  const [date, setDate] = useState(profile.personalGoalDate ?? '');
  const [showCal, setShowCal] = useState(false);
  const [reminder, setReminder] = useState<GoalReminder>(profile.goalReminder ?? 'off');
  const [minute, setMinute] = useState(profile.goalReminderMinute ?? 480);
  const [saving, setSaving] = useState(false);

  const trimmed = goal.trim();

  const save = async () => {
    setSaving(true);
    // Reminders need something to remind you about.
    const cadence: GoalReminder = trimmed ? reminder : 'off';
    const next = {
      personalGoal: trimmed || undefined,
      personalGoalDate: date || undefined,
      goalReminder: cadence,
      goalReminderMinute: minute,
    };
    setProfile(next);
    updateProfileRemote({
      personal_goal: trimmed || null,
      personal_goal_date: date || null,
      goal_reminder: cadence,
      goal_reminder_minute: minute,
    });

    const ok = await syncGoalReminders({ ...profile, ...next });
    setSaving(false);

    if (cadence !== 'off' && !ok && isReminderAvailable()) {
      Alert.alert(
        'Reminders need notification access',
        'Your goal is saved, but Stride can\'t send reminders until notifications are enabled in iOS Settings → Stride → Notifications.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }
    router.back();
  };

  const preview = date ? daysUntilGoal({ ...profile, personalGoalDate: date }) : null;

  return (
    <ModalShell title="Your Goal">
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
        The reason behind the training. Stride shows it on your home screen and can remind you on a
        schedule you pick.
      </Text>

      <Field
        label="Personal goal"
        value={goal}
        onChangeText={setGoal}
        placeholder="e.g. Top 10 at the state XC meet"
        maxLength={140}
        multiline
        autoFocus
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
        Target date (optional)
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        <Chip
          label={date ? fmtLongDate(date) : 'Pick a date'}
          selected={!!date}
          onPress={() => setShowCal((v) => !v)}
        />
        {date ? (
          <Chip
            label="Clear"
            onPress={() => {
              setDate('');
              setShowCal(false);
            }}
          />
        ) : null}
      </View>
      {preview != null ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
          {preview === 0 ? "That's today." : `${preview} day${preview === 1 ? '' : 's'} away.`}
        </Text>
      ) : null}
      {showCal ? (
        <DatePicker
          value={date || addDays(todayKey(), 30)}
          minKey={todayKey()}
          maxKey={addDays(todayKey(), 365 * 3)}
          onChange={(k) => {
            setDate(k);
            setShowCal(false);
          }}
        />
      ) : null}

      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
          marginTop: 10,
          marginBottom: 6,
        }}>
        Remind me
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(Object.keys(GOAL_REMINDER_META) as GoalReminder[]).map((k) => (
          <Chip
            key={k}
            label={GOAL_REMINDER_META[k].label}
            selected={reminder === k}
            onPress={() => setReminder(k)}
          />
        ))}
      </View>

      {reminder !== 'off' ? (
        <>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: '700',
              marginTop: 10,
              marginBottom: 6,
            }}>
            At
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TIMES.map((t) => (
              <Chip
                key={t.minute}
                label={t.label}
                selected={minute === t.minute}
                onPress={() => setMinute(t.minute)}
              />
            ))}
          </View>
        </>
      ) : null}

      {reminder !== 'off' && !trimmed ? (
        <Text style={{ color: colors.warn, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
          Add a goal above and reminders will turn on when you save.
        </Text>
      ) : null}

      <Pressable
        onPress={save}
        disabled={saving}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 22,
          opacity: saving ? 0.6 : 1,
        }}>
        <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>
          {saving ? 'Saving…' : 'Save goal'}
        </Text>
      </Pressable>

      {isReminderAvailable() ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 }}>
          <Ionicons
            name="information-circle-outline"
            size={15}
            color={colors.textMuted}
            style={{ marginRight: 8, marginTop: 1 }}
          />
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, flex: 1 }}>
            Your goal saves here, but reminder notifications only work on the iPhone app.
          </Text>
        </View>
      )}
    </ModalShell>
  );
}
