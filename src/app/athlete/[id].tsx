import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { BarChart } from '@/components/charts';
import { Card, Field, SectionHeader } from '@/components/ui';
import {
  fetchAthleteData,
  fetchComments,
  postComment,
  type Comment,
} from '@/lib/coach';
import { fmtDate, fmtDuration, fmtPace, fmtWeekday, parseKey } from '@/lib/format';
import { weeklyMileSeries, weeklyMiles } from '@/lib/load';
import { useAuth } from '@/lib/sync';
import { WORKOUT_META, type JournalEntry, type Run } from '@/lib/types';
import { radius, useTheme } from '@/theme';

export default function AthleteView() {
  const { colors } = useTheme();
  const { id, name, link } = useLocalSearchParams<{ id: string; name: string; link: string }>();
  const { session } = useAuth();

  const [runs, setRuns] = useState<Run[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchAthleteData(id).then((d) => {
      setRuns(d.runs);
      setJournal(d.journal);
      setLoaded(true);
    });
    if (link) fetchComments(link).then(setComments);
  }, [id, link]);

  const weekly = useMemo(() => weeklyMileSeries(runs, 8), [runs]);
  const thisWeek = weeklyMiles(runs, 0);
  const lastWeek = weeklyMiles(runs, 1);
  const recent = useMemo(() => [...runs].reverse().slice(0, 10), [runs]);

  const sleepVals = journal.map((j) => j.sleepHours).filter((v): v is number => v != null);
  const avgSleep = sleepVals.length
    ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1)
    : null;
  const energyVals = journal.map((j) => j.energy).filter((v): v is number => v != null);
  const avgEnergy = energyVals.length
    ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(1)
    : null;

  const send = async () => {
    if (!link || !draft.trim()) return;
    const ok = await postComment(link, draft);
    if (ok) {
      setDraft('');
      setComments(await fetchComments(link));
    }
  };

  return (
    <ModalShell title={name ?? 'Athlete'}>
      <Card style={{ flexDirection: 'row' }}>
        <Stat label="This week" value={`${thisWeek} mi`} />
        <Stat label="Last week" value={`${lastWeek} mi`} />
        <Stat label="Avg sleep" value={avgSleep ? `${avgSleep}h` : '—'} />
        <Stat label="Energy" value={avgEnergy ? `${avgEnergy}/5` : '—'} />
      </Card>

      <SectionHeader title="Weekly Mileage" />
      <Card>
        <BarChart
          data={weekly.map((w, i) => ({
            label: `${parseKey(w.weekStart).getMonth() + 1}/${parseKey(w.weekStart).getDate()}`,
            value: w.miles,
            highlight: i === weekly.length - 1,
          }))}
        />
      </Card>

      <SectionHeader title="Recent Workouts" />
      <Card style={{ paddingVertical: 4 }}>
        {loaded && recent.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 10 }}>
            Nothing shared yet — the athlete controls what you can see.
          </Text>
        ) : null}
        {recent.map((run, i) => (
          <View
            key={run.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 11,
              borderBottomWidth: i === recent.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: WORKOUT_META[run.type].color,
                marginRight: 12,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                {WORKOUT_META[run.type].label}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {fmtWeekday(run.date)} · {fmtDate(run.date)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                {run.distanceMi} mi
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {fmtDuration(run.durationS)} · {fmtPace(run.distanceMi, run.durationS)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title="Comments" />
      <Card>
        {comments.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
            No comments yet — leave some encouragement.
          </Text>
        ) : null}
        {comments.map((c) => {
          const mine = c.authorId === session?.user.id;
          return (
            <View
              key={c.id}
              style={{
                backgroundColor: mine ? colors.accent + '18' : colors.surfaceAlt,
                borderRadius: radius.md,
                padding: 10,
                marginBottom: 8,
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>{c.body}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
                {fmtDate(c.createdAt.slice(0, 10))}
              </Text>
            </View>
          );
        })}
        <Field
          label="Add a comment"
          value={draft}
          onChangeText={setDraft}
          placeholder="Nice week — let's keep Sunday easy."
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          style={{
            backgroundColor: draft.trim() ? colors.accent : colors.surfaceAlt,
            borderRadius: radius.md,
            paddingVertical: 12,
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: draft.trim() ? colors.onAccent : colors.textMuted,
              fontSize: 14,
              fontWeight: '800',
            }}>
            Send
          </Text>
        </Pressable>
      </Card>
    </ModalShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}
