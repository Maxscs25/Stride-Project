import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dateKey, parseKey, todayKey } from '@/lib/format';
import { radius, useTheme } from '@/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Pure-JS month calendar. Selects a past-or-today date; future days disabled. */
export function DatePicker({
  value,
  onChange,
  maxKey = todayKey(),
}: {
  value: string;
  onChange: (key: string) => void;
  maxKey?: string;
}) {
  const { colors } = useTheme();
  const sel = parseKey(value);
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const canGoNext = new Date(view.y, view.m + 1, 1) <= parseKey(maxKey);
  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: 12,
        marginBottom: 14,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 15, fontWeight: '800' }}>
          {MONTHS[view.m]} {view.y}
        </Text>
        <Pressable
          onPress={() => canGoNext && shift(1)}
          hitSlop={10}
          style={{ padding: 4, opacity: canGoNext ? 1 : 0.3 }}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={i}
            style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
            {w}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (day == null) return <View key={i} style={{ width: `${100 / 7}%`, height: 38 }} />;
          const key = dateKey(new Date(view.y, view.m, day));
          const selected = key === value;
          const disabled = key > maxKey;
          return (
            <Pressable
              key={i}
              disabled={disabled}
              onPress={() => onChange(key)}
              style={{ width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.accent : 'transparent',
                }}>
                <Text
                  style={{
                    color: disabled
                      ? colors.textMuted
                      : selected
                        ? colors.onAccent
                        : colors.text,
                    fontSize: 14,
                    fontWeight: selected ? '800' : '600',
                    opacity: disabled ? 0.35 : 1,
                  }}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
