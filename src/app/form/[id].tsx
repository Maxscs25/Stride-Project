import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { SkeletonPlayer } from '@/components/SkeletonPlayer';
import { Card, SectionHeader } from '@/components/ui';
import { fetchKeypoints, useForm } from '@/lib/form';
import type { Rating } from '@/lib/gait';
import { radius, useTheme } from '@/theme';

export default function FormResult() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const analysis = useForm((s) => s.analyses.find((a) => a.id === id));
  const analyses = useForm((s) => s.analyses);
  const [keypoints, setKeypoints] = useState<{ frames: number[][][]; fps: number } | null>(null);

  useEffect(() => {
    if (id && analysis?.status === 'complete') fetchKeypoints(id).then(setKeypoints);
  }, [id, analysis?.status]);

  const ratingColor = (r: Rating) =>
    r === 'good' ? colors.good : r === 'fair' ? colors.info : r === 'watch' ? colors.warn : colors.textMuted;

  const knownMetrics = useMemo(
    () => (analysis?.metrics ?? []).filter((m) => m.rating !== 'unknown'),
    [analysis]
  );

  // Compare each metric to the most recent earlier analysis of the same kind.
  const prevMetrics = useMemo(() => {
    if (!analysis) return null;
    const prev = analyses
      .filter((a) => a.sample === analysis.sample && a.createdAt < analysis.createdAt && a.status === 'complete')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    if (!prev) return null;
    return new Map(prev.metrics.map((m) => [m.key, m.value]));
  }, [analysis, analyses]);

  if (!analysis) {
    return (
      <ModalShell title="Form Analysis">
        <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />
      </ModalShell>
    );
  }

  if (analysis.status === 'processing') {
    return (
      <ModalShell title="Form Analysis">
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12 }}>
            Analyzing your gait and writing your report…
          </Text>
        </View>
      </ModalShell>
    );
  }

  const f = analysis.findings;

  return (
    <ModalShell title="Form Analysis">
      {analysis.sample ? (
        <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.info }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
            This is a <Text style={{ fontWeight: '800', color: colors.text }}>sample</Text> analysis on
            demo footage — it shows the real metrics engine and AI coaching output. Your own analysis
            runs the same pipeline on your video.
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="pulse" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
            Capture confidence {Math.round(analysis.confidence * 100)}%
          </Text>
        </View>
        {f?.summary ? (
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
            {f.summary}
          </Text>
        ) : null}
      </Card>

      {keypoints ? (
        <>
          <SectionHeader title="Motion" />
          <Card>
            <SkeletonPlayer frames={keypoints.frames} fps={keypoints.fps} />
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}>
              The pose Stride detected, frame by frame — what the metrics are measured from.
            </Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Metrics" />
      <Card style={{ paddingVertical: 4 }}>
        {knownMetrics.map((m, i) => {
          const prev = prevMetrics?.get(m.key);
          const delta =
            typeof prev === 'number' && typeof m.value === 'number' ? m.value - prev : null;
          return (
            <View
              key={m.key}
              style={{
                paddingVertical: 11,
                borderBottomWidth: i === knownMetrics.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                  {m.label}
                </Text>
                {delta != null && Math.abs(delta) >= 0.1 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginRight: 8 }}>
                    {delta > 0 ? '↑' : '↓'}
                    {Math.abs(Math.round(delta * 10) / 10)} vs last
                  </Text>
                ) : null}
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginRight: 8 }}>
                  {m.value}
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}> {m.unit}</Text>
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: ratingColor(m.rating) + '22',
                  }}>
                  <Text style={{ color: ratingColor(m.rating), fontSize: 11, fontWeight: '800' }}>
                    {m.rating.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
                {m.note}
              </Text>
            </View>
          );
        })}
      </Card>

      {f?.highlights?.length ? (
        <>
          <SectionHeader title="What Looks Good" />
          <Card>
            {f.highlights.map((h, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }}>
                <Ionicons name="checkmark-circle" size={15} color={colors.good} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 }}>{h}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {f?.priorities?.length ? (
        <>
          <SectionHeader title="Focus Areas" />
          {f.priorities.map((p, i) => (
            <Card key={i}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 }}>
                {p.what}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{p.why}</Text>
            </Card>
          ))}
        </>
      ) : null}

      {f?.drills?.length ? (
        <>
          <SectionHeader title="Drills" />
          <Card>
            {f.drills.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800', marginRight: 8 }}>→</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{d.name ?? d.slug}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{d.reason}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {f?.disclaimer ? (
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: 12,
            marginTop: 8,
          }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>{f.disclaimer}</Text>
        </View>
      ) : null}
    </ModalShell>
  );
}
