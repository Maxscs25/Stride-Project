import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/theme';

export function Screen({
  title,
  subtitle,
  children,
  showAvatar = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showAvatar?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
              marginTop: 4,
            }}>
            <View style={{ flex: 1 }}>
              {subtitle ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    marginBottom: 2,
                  }}>
                  {subtitle}
                </Text>
              ) : null}
              <Text
                style={{
                  color: colors.text,
                  fontSize: 32,
                  fontWeight: '800',
                  letterSpacing: -0.8,
                }}>
                {title}
              </Text>
            </View>
            {showAvatar ? <AvatarButton /> : null}
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AvatarButton() {
  const { colors } = useTheme();
  return (
    <Link href="/profile" asChild>
      <Pressable
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="person" size={18} color={colors.textSecondary} />
      </Pressable>
    </Link>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[base, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 10,
      }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}>
      <Text style={{ color, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? tint : colors.border,
        backgroundColor: selected ? tint : colors.surfaceAlt,
        marginRight: 8,
        marginBottom: 8,
      }}>
      <Text
        style={{
          color: selected ? colors.bg : colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: accent ? colors.accent : colors.text,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.5,
        }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
        {label}
      </Text>
      {sub ? (
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

export function ProgressBar({
  value,
  color,
  height = 8,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.surfaceAlt,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? colors.accent,
        }}
      />
    </View>
  );
}

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
          marginBottom: 6,
        }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[];
  value?: number;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radius.sm,
            backgroundColor: value === o.value ? colors.accent : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: value === o.value ? colors.accent : colors.border,
            marginRight: 6,
            marginBottom: 6,
          }}>
          <Text
            style={{
              color: value === o.value ? colors.onAccent : colors.textSecondary,
              fontSize: 13,
              fontWeight: '700',
            }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
