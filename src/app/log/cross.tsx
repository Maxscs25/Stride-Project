import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ModalShell, finishLogging } from '@/components/ModalShell';
import { WhenPicker } from '@/components/WhenPicker';
import { Chip, Field, Segmented } from '@/components/ui';
import { todayKey } from '@/lib/format';
import { deleteCross, logCross, updateCross } from '@/lib/sync';
import { ACTIVITY_META, type ActivityType } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const ACTIVITIES = Object.entries(ACTIVITY_META) as [ActivityType, { label: string; icon: string }][];

export default function LogCross() {
  const { colors } = useTheme();
  const cross = useApp((s) => s.cross);
  // Same form serves both jobs: with an `id` it edits that session instead.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = cross.find((c) => c.id === id);

  const [date, setDate] = useState(editing?.date ?? todayKey());
  const [activity, setActivity] = useState<ActivityType>(editing?.activity ?? 'strength');
  const [minutes, setMinutes] = useState(editing ? String(editing.minutes) : '');
  const [intensity, setIntensity] = useState<number | undefined>(editing?.intensity);
  const [note, setNote] = useState(editing?.note ?? '');

  const min = parseFloat(minutes);
  const valid = min > 0;

  const save = () => {
    if (!valid) return;
    const fields = {
      date,
      activity,
      minutes: Math.round(min),
      intensity,
      note: note.trim() || undefined,
    };
    if (editing) {
      updateCross({ ...editing, ...fields });
      router.back();
      return;
    }
    logCross(fields);
    finishLogging();
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert('Delete this session?', 'It will be removed from your training log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCross(editing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ModalShell title={editing ? 'Edit Session' : 'Cross-Training'}>
      <Label text="When" />
      <WhenPicker value={date} onChange={setDate} />

      <Label text="Activity" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {ACTIVITIES.map(([value, meta]) => (
          <Chip
            key={value}
            label={meta.label}
            selected={activity === value}
            onPress={() => setActivity(value)}
          />
        ))}
      </View>

      <Label text="Minutes" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        {[20, 30, 45, 60].map((m) => (
          <Chip
            key={m}
            label={`${m} min`}
            selected={minutes === String(m)}
            onPress={() => setMinutes(String(m))}
          />
        ))}
      </View>
      <Field
        label="Or enter exact minutes"
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
        placeholder="40"
      />

      <Label text="Intensity (optional)" />
      <Segmented
        options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))}
        value={intensity}
        onChange={(v) => setIntensity(v === intensity ? undefined : v)}
      />

      <View style={{ height: 14 }} />
      <Field
        label="Notes (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="What did you do?"
        multiline
        numberOfLines={3}
        maxLength={2000}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <Pressable
        onPress={save}
        disabled={!valid}
        style={{
          backgroundColor: valid ? colors.accent : colors.surfaceAlt,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 8,
        }}>
        <Text
          style={{
            color: valid ? colors.onAccent : colors.textMuted,
            fontSize: 16,
            fontWeight: '800',
          }}>
          {editing ? 'Save Changes' : 'Save Session'}
        </Text>
      </Pressable>

      {editing ? (
        <Pressable onPress={confirmDelete} style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>
            Delete this session
          </Text>
        </Pressable>
      ) : null}
    </ModalShell>
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
