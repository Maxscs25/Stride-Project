import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { ProgressBar } from './ui';

export function WearBar({ miles, lifespan }: { miles: number; lifespan: number }) {
  const { colors } = useTheme();
  const pct = miles / lifespan;
  const color = pct >= 0.9 ? colors.danger : pct >= 0.75 ? colors.warn : colors.accent;
  const remaining = Math.max(0, Math.round(lifespan - miles));
  return (
    <View>
      <ProgressBar value={pct} color={color} height={7} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
          {Math.round(miles)} / {lifespan} mi
        </Text>
        <Text style={{ color, fontSize: 12, fontWeight: '700' }}>
          {pct >= 0.9 ? `Replace soon · ${remaining} mi left` : `${remaining} mi left`}
        </Text>
      </View>
    </View>
  );
}
