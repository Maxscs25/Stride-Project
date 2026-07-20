import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { Card, Pill, SectionHeader } from '@/components/ui';
import { TIERS } from '@/constants/pricing';
import { connectHealthKit, disconnectHealthKit, useHealthKit } from '@/lib/healthkit';
import { checkStrava, connectStrava, disconnectStrava, useStrava } from '@/lib/strava';
import { supabase } from '@/lib/supabase';
import { pullAll, updateProfileRemote, useAuth } from '@/lib/sync';
import { checkTerra, connectTerra, disconnectTerra, useTerra } from '@/lib/terra';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

export default function Profile() {
  const { colors } = useTheme();
  const profile = useApp((s) => s.profile);
  const setWeeklyGoal = useApp((s) => s.setWeeklyGoal);
  const resetDemo = useApp((s) => s.resetDemo);

  const confirmReset = () => {
    if (Platform.OS === 'web') {
      resetDemo();
      return;
    }
    Alert.alert('Reset demo data?', 'Regenerates the sample training history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetDemo },
    ]);
  };

  const { session } = useAuth();
  const strava = useStrava();
  const terra = useTerra();
  const healthkit = useHealthKit();

  useEffect(() => {
    if (session) {
      checkStrava();
      checkTerra();
    }
  }, [session]);

  const pressHandler =
    (name: string, connected: boolean | null, connect: () => Promise<boolean>, disconnect: () => Promise<void>) =>
    async () => {
      if (!session) {
        router.push('/auth');
        return;
      }
      if (connected) {
        if (Platform.OS === 'web') {
          disconnect();
        } else {
          Alert.alert(`Disconnect ${name}?`, 'New watch runs will stop importing.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: () => disconnect() },
          ]);
        }
        return;
      }
      const ok = await connect();
      if (ok) await pullAll();
    };

  const onTerraPress = pressHandler('watch sync', terra.connected, connectTerra, disconnectTerra);
  const onStravaPress = pressHandler('Strava', strava.connected, connectStrava, disconnectStrava);

  return (
    <ModalShell title="Profile">
      <SectionHeader title="Account" />
      {session ? (
        <Card>
          <Row label="Signed in as" value={session.user.email ?? '—'} />
          <Pressable
            onPress={() => {
              supabase.auth.signOut();
              router.back();
            }}
            style={{ paddingVertical: 10 }}>
            <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>Sign out</Text>
          </Pressable>
        </Card>
      ) : (
        <Card onPress={() => router.push('/auth')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="cloud-upload" size={20} color={colors.accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              Sign in / create account
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              Sync your training to the cloud — you're currently in demo mode.
            </Text>
          </View>
        </Card>
      )}

      <Card>
        <Row label="Name" value={profile.name} />
        <Row label="Race goal" value={profile.raceGoal} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
          }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Weekly mileage goal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Stepper
              onPress={() => {
                const next = Math.max(5, profile.weeklyGoalMi - 1);
                setWeeklyGoal(next);
                updateProfileRemote({ weekly_goal_mi: next });
              }}
              icon="remove"
            />
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                fontWeight: '800',
                marginHorizontal: 14,
                minWidth: 48,
                textAlign: 'center',
              }}>
              {profile.weeklyGoalMi} mi
            </Text>
            <Stepper
              onPress={() => {
                const next = profile.weeklyGoalMi + 1;
                setWeeklyGoal(next);
                updateProfileRemote({ weekly_goal_mi: next });
              }}
              icon="add"
            />
          </View>
        </View>
      </Card>

      <SectionHeader title="Membership" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 }}>
            {TIERS.free.name}
          </Text>
          <Pill label="CURRENT PLAN" color={colors.textSecondary} bg={colors.surfaceAlt} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{TIERS.free.tagline}</Text>
      </Card>

      <Card style={{ borderColor: colors.accent, borderWidth: 1.5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 }}>
            {TIERS.premium.name}
          </Text>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '800' }}>
            {TIERS.premium.price}
          </Text>
        </View>
        {TIERS.premium.features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="checkmark-circle" size={15} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{f}</Text>
          </View>
        ))}
        <Pressable
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.md,
            paddingVertical: 13,
            alignItems: 'center',
            marginTop: 10,
          }}>
          <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>
            Start 14-day free trial · then {TIERS.premium.annual}
          </Text>
        </Pressable>
        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          Billing wires up via RevenueCat in Phase 2.
        </Text>
      </Card>

      <SectionHeader title="Connected Apps" />
      {Platform.OS === 'ios' ? (
        <ConnectRow
          title="Apple Health"
          subtitle={
            healthkit.available
              ? 'Garmin, COROS & Apple Watch runs via the Health app'
              : 'Available in the iPhone app build (not Expo Go)'
          }
          icon="heart"
          iconColor="#FF2D55"
          connected={healthkit.connected}
          busy={healthkit.busy}
          error={healthkit.error}
          onPress={() => {
            if (healthkit.connected) disconnectHealthKit();
            else connectHealthKit();
          }}
        />
      ) : null}
      <ConnectRow
        title={terra.connected && terra.provider ? `Watch Sync · ${terra.provider}` : 'Watch Sync'}
        subtitle={
          session
            ? 'Garmin, COROS, Polar, Suunto & more — direct via Terra'
            : 'Sign in first, then connect your watch'
        }
        icon="watch"
        iconColor="#2DD4BF"
        connected={!!session && !!terra.connected}
        busy={terra.busy}
        error={terra.error}
        onPress={onTerraPress}
      />
      <ConnectRow
        title="Strava"
        subtitle={
          session
            ? 'Alternative sync path (requires a Strava subscription)'
            : 'Sign in first to connect Strava'
        }
        icon="flash"
        iconColor="#FC5200"
        connected={!!session && !!strava.connected}
        busy={strava.busy}
        error={strava.error}
        onPress={onStravaPress}
      />

      <SectionHeader title="Coaching" />
      <Card
        onPress={() => router.push('/coach')}
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="people" size={20} color={colors.info} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            Coaching & sharing
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            Invite your coach with granular privacy controls, or manage your athletes.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Card>

      <SectionHeader title="Data" />
      <Card
        onPress={() => router.push('/onboarding')}
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="options" size={18} color={colors.info} style={{ marginRight: 12 }} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
          Edit goals & profile
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Card>
      <Card onPress={confirmReset} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="refresh" size={18} color={colors.danger} style={{ marginRight: 12 }} />
        <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>
          Reset demo data
        </Text>
      </Card>

      <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
        Stride provides educational training guidance only — it is not a medical device and does
        not diagnose injuries. All data stays on this device until cloud sync is enabled.
      </Text>
    </ModalShell>
  );
}

function ConnectRow({
  title,
  subtitle,
  icon,
  iconColor,
  connected,
  busy,
  error,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  connected: boolean;
  busy: boolean;
  error: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: iconColor + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
        <Ionicons name={icon as never} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
          {subtitle}
        </Text>
        {error ? (
          <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : connected ? (
        <Pill label="CONNECTED" color={colors.bg} bg={colors.good} />
      ) : (
        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>Connect →</Text>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
      }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function Stepper({ onPress, icon }: { onPress: () => void; icon: 'add' | 'remove' }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
    </Pressable>
  );
}
