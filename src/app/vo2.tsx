import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { Card, Field, SectionHeader } from '@/components/ui';
import { fmtDate, todayKey } from '@/lib/format';
import { loadSeries } from '@/lib/load';
import { updateProfileRemote } from '@/lib/sync';
import {
  RACE_DISTANCES,
  fmtRaceTime,
  parseRaceTime,
  predictedTime,
  vdotFrom,
} from '@/lib/vo2';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

export default function Vo2Screen() {
  const { colors } = useTheme();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const runs = useApp((s) => s.runs);
  const cross = useApp((s) => s.cross);

  const saved =
    profile.vo2BaselineMeters && profile.vo2BaselineSeconds
      ? vdotFrom(profile.vo2BaselineMeters, profile.vo2BaselineSeconds)
      : null;

  const [meters, setMeters] = useState<number>(profile.vo2BaselineMeters ?? 5000);
  const [time, setTime] = useState(
    profile.vo2BaselineSeconds ? fmtRaceTime(profile.vo2BaselineSeconds) : ''
  );

  const seconds = parseRaceTime(time);
  const preview = seconds ? vdotFrom(meters, seconds) : null;
  const timeEntered = time.trim().length > 0;

  const save = () => {
    if (!seconds || preview == null) return;
    const next = {
      vo2BaselineMeters: meters,
      vo2BaselineSeconds: seconds,
      vo2BaselineDate: todayKey(),
    };
    setProfile(next);
    updateProfileRemote({
      vo2_baseline_meters: meters,
      vo2_baseline_seconds: seconds,
      vo2_baseline_date: next.vo2BaselineDate,
    });
    router.back();
  };

  // Chronic (28-day) load now vs. around the baseline date — a defensible
  // proxy for whether aerobic fitness is trending up or down since then.
  const series = loadSeries(runs, cross, 120);
  const chronicNow = series[series.length - 1]?.chronic ?? 0;
  const baseIdx = profile.vo2BaselineDate
    ? series.findIndex((p) => p.date >= profile.vo2BaselineDate!)
    : -1;
  const chronicThen = baseIdx >= 0 ? series[baseIdx].chronic : 0;
  const loadChange =
    chronicThen > 5 ? Math.round(((chronicNow - chronicThen) / chronicThen) * 100) : null;

  return (
    <ModalShell title="VO2 Max">
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
        Enter a recent race or all-out time trial and Stride estimates your VO2 max, plus the
        times it predicts at other distances.
      </Text>

      {saved != null ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
            ESTIMATED VO2 MAX
          </Text>
          <Text style={{ color: colors.accent, fontSize: 46, fontWeight: '800', letterSpacing: -1.5 }}>
            {saved}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            ml/kg/min
            {profile.vo2BaselineDate ? ` · set ${fmtDate(profile.vo2BaselineDate)}` : ''}
          </Text>
          {loadChange != null ? (
            // Under ±5% is noise, not a trend — and "up 0%" reads like a bug.
            (() => {
              const flat = Math.abs(loadChange) < 5;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <Ionicons
                    name={flat ? 'remove' : loadChange > 0 ? 'trending-up' : 'trending-down'}
                    size={15}
                    color={flat ? colors.textMuted : loadChange > 0 ? colors.good : colors.warn}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>
                    {flat
                      ? 'Your training load is about where it was when you set this — retest after a solid block.'
                      : `Training load is ${loadChange > 0 ? 'up' : 'down'} ${Math.abs(loadChange)}% since then — retest to see where your fitness actually sits.`}
                  </Text>
                </View>
              );
            })()
          ) : null}
        </Card>
      ) : null}

      {saved != null ? (
        <>
          <SectionHeader title="Equivalent Times" />
          <Card style={{ paddingVertical: 4 }}>
            {RACE_DISTANCES.map((d, i) => {
              const t = predictedTime(saved, d.meters);
              return (
                <View
                  key={d.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 11,
                    borderBottomWidth: i === RACE_DISTANCES.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>
                    {d.label}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                    {t == null ? '—' : fmtRaceTime(t)}
                  </Text>
                </View>
              );
            })}
            <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, paddingVertical: 8 }}>
              What this fitness level is worth at each distance, assuming you're trained for it —
              a marathon still needs marathon-specific work.
            </Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title={saved != null ? 'Update Baseline' : 'Your Baseline'} />
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
        Distance
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {RACE_DISTANCES.map((d) => {
          const on = Math.abs(meters - d.meters) < 1;
          return (
            <Pressable
              key={d.key}
              onPress={() => setMeters(d.meters)}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: 999,
                marginRight: 8,
                marginBottom: 8,
                backgroundColor: on ? colors.accent : colors.surfaceAlt,
                borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
              }}>
              <Text
                style={{
                  color: on ? colors.onAccent : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: '700',
                }}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        label="Your time"
        value={time}
        onChangeText={setTime}
        placeholder="19:45"
        autoCapitalize="none"
      />

      {timeEntered && preview == null ? (
        <Text style={{ color: colors.warn, fontSize: 12, marginTop: -6, marginBottom: 12, lineHeight: 17 }}>
          {seconds == null
            ? 'Enter the time as mm:ss or h:mm:ss — for example 19:45 or 1:32:05.'
            : "That doesn't look like a race effort for this distance — check the distance and time."}
        </Text>
      ) : null}

      {preview != null ? (
        <View
          style={{
            backgroundColor: colors.accent + '14',
            borderRadius: radius.md,
            padding: 14,
            marginBottom: 12,
          }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            That's a VO2 max of about {preview}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={save}
        disabled={preview == null}
        style={{
          backgroundColor: preview != null ? colors.accent : colors.surfaceAlt,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 4,
        }}>
        <Text
          style={{
            color: preview != null ? colors.onAccent : colors.textMuted,
            fontSize: 16,
            fontWeight: '800',
          }}>
          Save baseline
        </Text>
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 14 }}>
        Estimated from your performance using the Daniels–Gilbert model, not measured in a lab.
        It's only meaningful for a genuine maximal effort, and it's educational guidance rather
        than a clinical measurement.
      </Text>
    </ModalShell>
  );
}
