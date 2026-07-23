import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { TIERS } from '@/constants/pricing';
import {
  loadOfferings,
  purchase,
  restorePurchases,
  usePurchases,
  type Pkg,
} from '@/lib/purchases';
import { radius, useTheme } from '@/theme';

// RevenueCat package identifiers → friendly labels.
function pkgLabel(pkg: Pkg): { title: string; sub: string } {
  const type: string = pkg?.packageType ?? '';
  if (type === 'ANNUAL') return { title: 'Annual', sub: 'Best value · billed yearly' };
  if (type === 'MONTHLY') return { title: 'Monthly', sub: 'Billed monthly' };
  return { title: pkg?.product?.title ?? 'Premium', sub: '' };
}

export default function Paywall() {
  const { colors } = useTheme();
  const { configured, packages, isPremium, busy, error } = usePurchases();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (configured) loadOfferings();
  }, [configured]);

  useEffect(() => {
    // Preselect the annual plan when offerings load.
    if (packages.length && !selected) {
      const annual = packages.find((p) => p?.packageType === 'ANNUAL');
      setSelected((annual ?? packages[0])?.identifier ?? null);
    }
  }, [packages, selected]);

  if (isPremium) {
    return (
      <ModalShell title="Stride Premium">
        <View style={{ alignItems: 'center', paddingTop: 30 }}>
          <Ionicons name="checkmark-circle" size={44} color={colors.good} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 12 }}>
            You're on Premium
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 }}>
            Thanks for supporting Stride. Manage or cancel anytime in your App Store account settings.
          </Text>
        </View>
      </ModalShell>
    );
  }

  const pkg = packages.find((p) => p?.identifier === selected);

  return (
    <ModalShell title="Stride Premium">
      <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 16 }}>
        Your AI running coach — injury-prevention insights, nutrition, and form analysis that get
        smarter the more you log.
      </Text>

      <View style={{ marginBottom: 18 }}>
        {TIERS.premium.features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{f}</Text>
          </View>
        ))}
      </View>

      {!configured ? (
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: 14,
            marginBottom: 16,
          }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
            Subscriptions aren't live yet
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
            Premium will be {TIERS.premium.price} ({TIERS.premium.annual}) with a 14-day free trial.
            Purchasing turns on once the App Store products are set up.
          </Text>
        </View>
      ) : packages.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
      ) : (
        <>
          {packages.map((p) => {
            const meta = pkgLabel(p);
            const active = p.identifier === selected;
            return (
              <Pressable
                key={p.identifier}
                onPress={() => setSelected(p.identifier)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent + '12' : colors.surface,
                  borderRadius: radius.md,
                  padding: 16,
                  marginBottom: 10,
                }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{meta.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{meta.sub}</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                  {p?.product?.priceString ?? ''}
                </Text>
              </Pressable>
            );
          })}

          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13, marginTop: 4 }}>{error}</Text>
          ) : null}

          <Pressable
            onPress={async () => {
              if (pkg && (await purchase(pkg))) router.back();
            }}
            disabled={busy || !pkg}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.md,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 8,
            }}>
            {busy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>
                Start 14-day free trial
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              if (await restorePurchases()) router.back();
            }}
            style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>
              Restore purchases
            </Text>
          </Pressable>
        </>
      )}

      <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
        Payment is charged to your Apple ID after the free trial. Subscription renews automatically
        unless cancelled at least 24 hours before the period ends; manage or cancel in your App Store
        account settings.
      </Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <Pressable onPress={() => router.push('/legal/terms')}>
          <Text style={{ color: colors.textMuted, fontSize: 11, textDecorationLine: 'underline' }}>Terms</Text>
        </Pressable>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{'   ·   '}</Text>
        <Pressable onPress={() => router.push('/legal/privacy')}>
          <Text style={{ color: colors.textMuted, fontSize: 11, textDecorationLine: 'underline' }}>Privacy</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}
