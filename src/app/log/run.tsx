import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { ModalShell, finishLogging } from '@/components/ModalShell';
import { Chip, Field, Segmented } from '@/components/ui';
import { addDays, fmtLongDate, fmtPace, todayKey } from '@/lib/format';
import { shoeMiles } from '@/lib/load';
import { deleteRun, logRun, updateRun } from '@/lib/sync';
import { WORKOUT_META, type WorkoutType } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const TYPES = Object.entries(WORKOUT_META) as [WorkoutType, { label: string; color: string }][];

export default function LogRun() {
  const { colors } = useTheme();
  const shoes = useApp((s) => s.shoes);
  const runs = useApp((s) => s.runs);
  // Same form serves both jobs: with an `id` it edits that run instead.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = runs.find((r) => r.id === id);

  const [date, setDate] = useState(editing?.date ?? todayKey());
  const [showCal, setShowCal] = useState(false);
  const [distance, setDistance] = useState(editing ? String(editing.distanceMi) : '');
  const [minutes, setMinutes] = useState(
    editing ? String(Math.round((editing.durationS / 60) * 100) / 100) : ''
  );
  const [type, setType] = useState<WorkoutType>(editing?.type ?? 'easy');
  const [shoeId, setShoeId] = useState<string | undefined>(
    editing?.shoeId ?? shoes.find((s) => s.isDefault && !s.retiredAt)?.id ?? shoes[0]?.id
  );
  const [rpe, setRpe] = useState<number | undefined>(editing?.rpe);
  const [note, setNote] = useState(editing?.note ?? '');

  const mi = parseFloat(distance);
  const min = parseFloat(minutes);
  const valid = mi > 0 && min > 0;
  const durationS = valid ? Math.round(min * 60) : 0;

  const save = () => {
    if (!valid) return;
    if (editing) {
      updateRun({ ...editing, date, distanceMi: mi, durationS, type, shoeId, rpe });
      router.back();
      return;
    }
    logRun({
      date,
      distanceMi: mi,
      durationS,
      type,
      shoeId,
      rpe,
      note: note.trim() || undefined,
    });
    finishLogging();
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert('Delete this run?', 'It will be removed from your log and shoe mileage.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRun(editing.id);
          router.back();
        },
      },
    ]);
  };

  const yesterday = addDays(todayKey(), -1);

  return (
    <ModalShell title={editing ? 'Edit Run' : 'Log a Run'}>
      <Label text="When" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip
          label="Today"
          selected={date === todayKey() && !showCal}
          onPress={() => {
            setDate(todayKey());
            setShowCal(false);
          }}
        />
        <Chip
          label="Yesterday"
          selected={date === yesterday && !showCal}
          onPress={() => {
            setDate(yesterday);
            setShowCal(false);
          }}
        />
        <Chip
          label={
            date !== todayKey() && date !== yesterday ? fmtLongDate(date).replace(/^\w+, /, '') : 'Pick a date'
          }
          selected={showCal || (date !== todayKey() && date !== yesterday)}
          onPress={() => setShowCal((v) => !v)}
        />
      </View>
      {showCal ? (
        <DatePicker
          value={date}
          onChange={(k) => {
            setDate(k);
            setShowCal(false);
          }}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Distance (mi)"
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholder="5.0"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Time (minutes)"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="decimal-pad"
            placeholder="45"
          />
        </View>
      </View>
      {valid ? (
        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800', marginBottom: 12 }}>
          Pace: {fmtPace(mi, durationS)}
        </Text>
      ) : null}

      <Label text="Workout type" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {TYPES.map(([value, meta]) => (
          <Chip
            key={value}
            label={meta.label}
            color={meta.color}
            selected={type === value}
            onPress={() => setType(value)}
          />
        ))}
      </View>

      <Label text="Shoe" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {shoes
          .filter((s) => !s.retiredAt)
          .map((s) => (
            <Chip
              key={s.id}
              label={`${s.model} · ${Math.max(
                0,
                Math.round(s.lifespanMiles - shoeMiles(s, runs))
              )} mi left`}
              selected={shoeId === s.id}
              onPress={() => setShoeId(s.id)}
            />
          ))}
      </View>

      <Label text="Effort (RPE, optional)" />
      <Segmented
        options={[2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ({ value: v, label: String(v) }))}
        value={rpe}
        onChange={(v) => setRpe(v === rpe ? undefined : v)}
      />

      <View style={{ height: 14 }} />
      {editing ? (
        // A run's note is stored as its own journal entry, so it's edited from
        // the journal — showing a field here that silently discarded edits
        // would be worse than not showing one.
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 }}>
          Notes are kept with your journal entry for this day and can be edited there.
        </Text>
      ) : (
        <Field
          label="Notes (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="How did it feel? Any niggles?"
          multiline
          numberOfLines={3}
          maxLength={4000}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      )}

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
          {editing ? 'Save Changes' : 'Save Run'}
        </Text>
      </Pressable>

      {editing ? (
        <Pressable onPress={confirmDelete} style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>
            Delete this run
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
