import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell, finishLogging } from '@/components/ModalShell';
import { Chip, Field, Segmented } from '@/components/ui';
import { addDays, fmtPace, todayKey } from '@/lib/format';
import { shoeMiles } from '@/lib/load';
import { WORKOUT_META, type WorkoutType } from '@/lib/types';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const TYPES = Object.entries(WORKOUT_META) as [WorkoutType, { label: string; color: string }][];

export default function LogRun() {
  const { colors } = useTheme();
  const shoes = useApp((s) => s.shoes);
  const runs = useApp((s) => s.runs);
  const logRun = useApp((s) => s.logRun);

  const [dayOffset, setDayOffset] = useState(0);
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');
  const [type, setType] = useState<WorkoutType>('easy');
  const [shoeId, setShoeId] = useState<string | undefined>(
    shoes.find((s) => s.isDefault && !s.retiredAt)?.id ?? shoes[0]?.id
  );
  const [rpe, setRpe] = useState<number | undefined>();
  const [note, setNote] = useState('');

  const mi = parseFloat(distance);
  const min = parseFloat(minutes);
  const valid = mi > 0 && min > 0;
  const durationS = valid ? Math.round(min * 60) : 0;

  const save = () => {
    if (!valid) return;
    logRun({
      date: addDays(todayKey(), dayOffset),
      distanceMi: mi,
      durationS,
      type,
      shoeId,
      rpe,
      note: note.trim() || undefined,
    });
    finishLogging();
  };

  return (
    <ModalShell title="Log a Run">
      <Label text="When" />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Chip label="Today" selected={dayOffset === 0} onPress={() => setDayOffset(0)} />
        <Chip label="Yesterday" selected={dayOffset === -1} onPress={() => setDayOffset(-1)} />
      </View>

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
      <Field
        label="Notes (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="How did it feel? Any niggles?"
        multiline
        numberOfLines={3}
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
          Save Run
        </Text>
      </Pressable>
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
