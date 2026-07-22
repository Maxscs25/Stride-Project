import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { Card, Pill, SectionHeader } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { analyzeVideo, clearForm, fetchAnalyses, runSampleAnalysis, useForm } from '@/lib/form';
import { useAuth } from '@/lib/sync';
import { radius, useTheme } from '@/theme';

function FormAction({
  icon,
  label,
  onPress,
  primary,
  busy,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        flex: 1,
        backgroundColor: primary ? colors.accent : colors.surfaceAlt,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingVertical: 15,
        alignItems: 'center',
      }}>
      {busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <>
          <Ionicons name={icon as never} size={20} color={primary ? colors.onAccent : colors.accent} />
          <Text
            style={{
              color: primary ? colors.onAccent : colors.text,
              fontSize: 12,
              fontWeight: '800',
              marginTop: 3,
            }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function FormList() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { analyses, loaded, busy, error } = useForm();

  useEffect(() => {
    if (session) fetchAnalyses();
    else clearForm();
  }, [session]);

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const id = await analyzeVideo(res.assets[0].uri);
    if (id) router.push({ pathname: '/form/[id]', params: { id } });
  };

  if (!session) {
    return (
      <ModalShell title="Running Form">
        <Card onPress={() => router.push('/auth')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="body" size={20} color={colors.accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              Sign in to analyze your form
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              Record a clip and get AI gait feedback with drills.
            </Text>
          </View>
        </Card>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Running Form">
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
        Record ~10–15s of side-on running (a treadmill is ideal), and Stride estimates cadence,
        posture, bounce and more — with drills to work on.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        <FormAction
          icon="videocam"
          label="Record"
          primary
          onPress={() => router.push('/form/capture')}
        />
        <FormAction icon="images" label="Choose clip" onPress={pickFromLibrary} />
        <FormAction
          icon="sparkles"
          label="Sample"
          busy={busy}
          onPress={async () => {
            const id = await runSampleAnalysis();
            if (id) router.push({ pathname: '/form/[id]', params: { id } });
          }}
        />
      </View>

      {error ? (
        <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.warn }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{error}</Text>
        </Card>
      ) : null}

      <SectionHeader title="Your Analyses" />
      {loaded && analyses.length === 0 ? (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            No analyses yet. Record a run or try a sample to see how it works.
          </Text>
        </Card>
      ) : null}
      {analyses.map((a) => (
        <Link key={a.id} href={{ pathname: '/form/[id]', params: { id: a.id } }} asChild>
          <Pressable>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.accent + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                <Ionicons name="body" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                    {a.view === 'rear' ? 'Rear view' : 'Side view'}
                  </Text>
                  {a.sample ? (
                    <View style={{ marginLeft: 8 }}>
                      <Pill label="SAMPLE" color={colors.textSecondary} bg={colors.surfaceAlt} />
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {fmtDate(a.createdAt.slice(0, 10))} ·{' '}
                  {a.status === 'complete'
                    ? `${a.metrics.filter((m) => m.rating !== 'unknown').length} metrics`
                    : a.status === 'processing'
                      ? 'Analyzing…'
                      : a.status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Card>
          </Pressable>
        </Link>
      ))}
    </ModalShell>
  );
}
