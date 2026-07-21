import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { radius, useTheme } from '@/theme';

const OPTIONS = [
  {
    href: '/log/run',
    icon: 'walk',
    title: 'Log a Run',
    sub: 'Distance, time, workout type, shoe',
  },
  {
    href: '/log/cross',
    icon: 'bicycle',
    title: 'Cross-Training',
    sub: 'Bike, swim, strength, yoga & more',
  },
  {
    href: '/log/food',
    icon: 'nutrition',
    title: 'Log Food',
    sub: 'Search, scan a barcode, or enter manually',
  },
  {
    href: '/log/journal',
    icon: 'create',
    title: 'Journal Entry',
    sub: 'How you felt — the AI coach reads this',
  },
] as const;

export default function LogMenu() {
  const { colors } = useTheme();
  return (
    <ModalShell title="Log">
      {OPTIONS.map((o) => (
        <Link key={o.href} href={o.href} asChild>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: 18,
              marginBottom: 12,
            }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: colors.accent + '22',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}>
              <Ionicons name={o.icon as never} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{o.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{o.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Link>
      ))}
    </ModalShell>
  );
}
