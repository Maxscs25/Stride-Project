import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, Text, View } from 'react-native';

import type { ChecklistDef } from '@/lib/types';
import { useTheme } from '@/theme';

import { Card } from './ui';

export function ChecklistCard({
  items,
  done,
  streaks,
  onToggle,
}: {
  items: ChecklistDef[];
  done: Record<string, boolean>;
  streaks: Record<string, number>;
  onToggle: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingVertical: 6 }}>
      {items.map((item, i) => {
        const checked = !!done[item.key];
        const streak = streaks[item.key] ?? 0;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onToggle(item.key);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
              <Ionicons
                name={item.icon as never}
                size={16}
                color={checked ? colors.accent : colors.textMuted}
              />
            </View>
            <Text
              style={{
                flex: 1,
                color: checked ? colors.textMuted : colors.text,
                fontSize: 15,
                fontWeight: '600',
                textDecorationLine: checked ? 'line-through' : 'none',
              }}>
              {item.label}
            </Text>
            {streak >= 3 ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginRight: 10 }}>
                🔥 {streak}
              </Text>
            ) : null}
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
                borderColor: checked ? colors.accent : colors.border,
                backgroundColor: checked ? colors.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {checked ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
