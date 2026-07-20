import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, Switch, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { Card, Field, Pill, SectionHeader } from '@/components/ui';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_META,
  cancelInvite,
  createInvite,
  redeemInvite,
  refreshCoach,
  revokeLink,
  updateLinkPermissions,
  useCoach,
  type CoachPermissions,
} from '@/lib/coach';
import { useAuth } from '@/lib/sync';
import { radius, useTheme } from '@/theme';

export default function Coach() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { myCoaches, myAthletes, openInvite, loaded } = useCoach();

  const [invitePerms, setInvitePerms] = useState<CoachPermissions>(DEFAULT_PERMISSIONS);
  const [code, setCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) refreshCoach();
  }, [session]);

  if (!session) {
    return (
      <ModalShell title="Coaching">
        <Card onPress={() => router.push('/auth')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="people" size={20} color={colors.accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              Sign in to use coaching
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              Invite your coach or manage your athletes with a free account.
            </Text>
          </View>
        </Card>
      </ModalShell>
    );
  }

  const share = async (c: string) => {
    const message = `Coach me on Stride! Open the app, go to Coaching → Coach Mode, and enter my code: ${c.toUpperCase()}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(message);
      } catch {}
    } else {
      await Share.share({ message });
    }
  };

  return (
    <ModalShell title="Coaching">
      {/* ---------- Athlete side ---------- */}
      <SectionHeader title="Your Coach" />
      {myCoaches.map((link) => (
        <Card key={link.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 }}>
              {link.otherName}
            </Text>
            <Pill label="ACTIVE" color={colors.bg} bg={colors.good} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }}>
            WHAT THEY CAN SEE
          </Text>
          {PERMISSION_META.map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{p.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.hint}</Text>
              </View>
              <Switch
                value={link.permissions[p.key]}
                onValueChange={(v) =>
                  updateLinkPermissions(link.id, { ...link.permissions, [p.key]: v })
                }
                trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
                thumbColor="#fff"
              />
            </View>
          ))}
          <Pressable onPress={() => revokeLink(link.id)} style={{ paddingTop: 10 }}>
            <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700' }}>
              Revoke access
            </Text>
          </Pressable>
        </Card>
      ))}

      {openInvite ? (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
            PENDING INVITE — SHARE THIS CODE
          </Text>
          <Text
            style={{
              color: colors.accent,
              fontSize: 34,
              fontWeight: '800',
              letterSpacing: 4,
              marginVertical: 8,
            }}>
            {openInvite.code.toUpperCase()}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
            Your coach enters this under Coaching → Coach Mode. It grants exactly the permissions
            you chose, and you can change or revoke them any time.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionBtn label={Platform.OS === 'web' ? 'Copy message' : 'Share'} onPress={() => share(openInvite.code)} primary />
            <ActionBtn label="Cancel invite" onPress={() => cancelInvite(openInvite.code)} />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
            Invite a coach
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Choose what they'll see, then send them a one-time code. Notes and nutrition stay
            private unless you opt in.
          </Text>
          {PERMISSION_META.map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{p.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.hint}</Text>
              </View>
              <Switch
                value={invitePerms[p.key]}
                onValueChange={(v) => setInvitePerms((x) => ({ ...x, [p.key]: v }))}
                trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
                thumbColor="#fff"
              />
            </View>
          ))}
          <Pressable
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              await createInvite(invitePerms);
              setBusy(false);
            }}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.md,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 12,
            }}>
            <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>
              Create invite code
            </Text>
          </Pressable>
        </Card>
      )}

      {/* ---------- Coach side ---------- */}
      <SectionHeader title="Coach Mode" />
      <Card>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
          Coaching someone?
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
          Enter the code your athlete sent you.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Athlete code" value={code} onChangeText={setCode} placeholder="a1b2c3d4" autoCapitalize="none" />
          </View>
          <Pressable
            disabled={busy || code.trim().length < 6}
            onPress={async () => {
              setBusy(true);
              setRedeemMsg(null);
              const err = await redeemInvite(code);
              setRedeemMsg(err ?? 'Athlete added ✓');
              if (!err) setCode('');
              setBusy(false);
            }}
            style={{
              backgroundColor: code.trim().length >= 6 ? colors.accent : colors.surfaceAlt,
              borderRadius: radius.md,
              paddingVertical: 13,
              paddingHorizontal: 18,
              marginTop: 25,
            }}>
            <Text
              style={{
                color: code.trim().length >= 6 ? colors.onAccent : colors.textMuted,
                fontSize: 14,
                fontWeight: '800',
              }}>
              Add
            </Text>
          </Pressable>
        </View>
        {redeemMsg ? (
          <Text
            style={{
              color: redeemMsg.endsWith('✓') ? colors.good : colors.danger,
              fontSize: 12,
              marginTop: 2,
            }}>
            {redeemMsg}
          </Text>
        ) : null}
      </Card>

      {loaded && myAthletes.length > 0 ? (
        <Card style={{ paddingVertical: 4 }}>
          {myAthletes.map((link, i) => (
            <Link
              key={link.id}
              href={{
                pathname: '/athlete/[id]',
                params: { id: link.athleteId, name: link.otherName, link: link.id },
              }}
              asChild>
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  borderBottomWidth: i === myAthletes.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.accent + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                  <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>
                    {link.otherName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                  {link.otherName}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : null}
    </ModalShell>
  );
}

function ActionBtn({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: primary ? colors.accent : colors.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: 12,
        alignItems: 'center',
      }}>
      <Text
        style={{
          color: primary ? colors.onAccent : colors.textSecondary,
          fontSize: 13,
          fontWeight: '800',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
