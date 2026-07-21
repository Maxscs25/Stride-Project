import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell, finishLogging } from '@/components/ModalShell';
import { Chip, Field, Segmented } from '@/components/ui';
import { todayKey } from '@/lib/format';
import { addJournal } from '@/lib/sync';
import { radius, useTheme } from '@/theme';

const SCALE = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

export default function LogJournal() {
  const { colors } = useTheme();

  const [energy, setEnergy] = useState<number | undefined>();
  const [soreness, setSoreness] = useState<number | undefined>();
  const [stress, setStress] = useState<number | undefined>();
  const [sleepQuality, setSleepQuality] = useState<number | undefined>();
  const [sleepHours, setSleepHours] = useState<number | undefined>();
  const [note, setNote] = useState('');

  const hasContent =
    note.trim().length > 0 ||
    [energy, soreness, stress, sleepQuality, sleepHours].some((v) => v != null);

  const save = () => {
    if (!hasContent) return;
    addJournal({
      date: todayKey(),
      energy,
      soreness,
      stress,
      sleepQuality,
      sleepHours,
      note: note.trim() || undefined,
    });
    finishLogging();
  };

  return (
    <ModalShell title="Journal">
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
        Ten seconds is enough — the AI coach mines these entries for patterns like recurring
        tightness, fading energy, or poor sleep.
      </Text>

      <ScaleRow label="Energy" value={energy} onChange={setEnergy} />
      <ScaleRow label="Soreness" value={soreness} onChange={setSoreness} />
      <ScaleRow label="Stress" value={stress} onChange={setStress} />
      <ScaleRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
        Sleep hours
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {[6, 6.5, 7, 7.5, 8, 8.5, 9].map((h) => (
          <Chip
            key={h}
            label={`${h}h`}
            selected={sleepHours === h}
            onPress={() => setSleepHours(sleepHours === h ? undefined : h)}
          />
        ))}
      </View>

      <Field
        label="How did today feel?"
        value={note}
        onChangeText={setNote}
        placeholder="Any niggles, soreness, or wins? e.g. 'calf a bit tight after the long run'"
        multiline
        numberOfLines={4}
        maxLength={4000}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      <Pressable
        onPress={save}
        disabled={!hasContent}
        style={{
          backgroundColor: hasContent ? colors.accent : colors.surfaceAlt,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 8,
        }}>
        <Text
          style={{
            color: hasContent ? colors.onAccent : colors.textMuted,
            fontSize: 16,
            fontWeight: '800',
          }}>
          Save Entry
        </Text>
      </Pressable>
    </ModalShell>
  );
}

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
        {label}
      </Text>
      <Segmented
        options={SCALE}
        value={value}
        onChange={(v) => onChange(v === value ? undefined : v)}
      />
    </View>
  );
}
