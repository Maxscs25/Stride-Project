import { Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import type { LegalDoc } from '@/constants/legal';
import { useTheme } from '@/theme';

export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const { colors } = useTheme();
  return (
    <ModalShell title={doc.title}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
        Last updated {doc.updated}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 18 }}>
        {doc.intro}
      </Text>
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ marginBottom: 18 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
            {s.heading}
          </Text>
          {s.body.map((p, i) => (
            <Text
              key={i}
              style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 6 }}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ModalShell>
  );
}
