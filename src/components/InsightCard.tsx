import { Text, View } from 'react-native';

import type { Insight } from '@/lib/load';
import { radius, useTheme } from '@/theme';

import { Card, Pill } from './ui';

const STATUS_META = {
  'on-track': { label: 'ON TRACK' },
  caution: { label: 'CAUTION' },
  high: { label: 'HIGH LOAD' },
} as const;

export function InsightCard({ insight, compact }: { insight: Insight; compact?: boolean }) {
  const { colors } = useTheme();
  const statusColor =
    insight.status === 'on-track'
      ? colors.good
      : insight.status === 'caution'
        ? colors.warn
        : colors.danger;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Pill label="AI COACH" color={colors.onAccent} bg={colors.accent} />
        <View style={{ width: 8 }} />
        <Pill label={STATUS_META[insight.status].label} color={colors.bg} bg={statusColor} />
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>
        {insight.headline}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
        {insight.body}
      </Text>

      {!compact && insight.evidence.length > 0 ? (
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: 12,
            marginTop: 12,
          }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 0.8,
              marginBottom: 6,
            }}>
            WHY
          </Text>
          {insight.evidence.map((e, i) => (
            <Text
              key={i}
              style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 4 }}>
              •  {e}
            </Text>
          ))}
        </View>
      ) : null}

      {insight.recs.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          {insight.recs.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800', marginRight: 8 }}>
                →
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{r.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                  {r.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}>
        Educational guidance based on your training patterns — not a medical evaluation or diagnosis.
      </Text>
    </Card>
  );
}
