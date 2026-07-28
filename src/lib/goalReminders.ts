import { Platform } from 'react-native';

import { parseKey, todayKey } from './format';
import type { GoalReminder, Profile } from './types';

/**
 * Local reminder notifications that resurface the runner's personal goal.
 *
 * Deliberately local (not push): the content is already on-device, so there's
 * no server, no push tokens, and it keeps working offline. Everything here
 * no-ops without the native module (Expo Go / web) so the app still runs.
 *
 * NOTE: expo-notifications is intentionally NOT listed in app.json plugins.
 * Its config plugin adds the `aps-environment` entitlement, which requires the
 * Push Notifications capability on the provisioning profile — and we never send
 * push. The native module is autolinked as a dependency, so local scheduling
 * works without claiming a capability the app doesn't use.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const IDENTIFIER_PREFIX = 'stride-goal-reminder';
/** iOS caps pending local notifications at 64; stay well under it. */
const DATED_OCCURRENCES = 24;

export const isReminderAvailable = () => !!Notifications && Platform.OS !== 'web';

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Ask for permission, returning whether we're allowed to post notifications. */
export async function ensureReminderPermission(): Promise<boolean> {
  if (!isReminderAvailable()) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('goal-reminders', {
    name: 'Goal reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Days until the goal date, or null when there's no date (or it's passed). */
export function daysUntilGoal(profile: Profile): number | null {
  if (!profile.personalGoalDate) return null;
  const target = parseKey(profile.personalGoalDate).getTime();
  const today = parseKey(todayKey()).getTime();
  const days = Math.round((target - today) / 864e5);
  return days >= 0 ? days : null;
}

/** Reminder body — leads with the goal, adds a countdown when there's a date. */
function buildBody(profile: Profile): string {
  const goal = (profile.personalGoal ?? '').trim();
  const days = daysUntilGoal(profile);
  if (days == null) return goal;
  if (days === 0) return `${goal} — today's the day.`;
  return `${goal} — ${days} ${days === 1 ? 'day' : 'days'} to go.`;
}

async function cancelExisting() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n: { identifier?: string }) => n.identifier?.startsWith(IDENTIFIER_PREFIX))
      .map((n: { identifier: string }) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * Re-arm the goal reminders from the user's current preference. Safe to call on
 * every app launch and after any goal edit — it always clears ours first, so
 * schedules never stack up.
 */
export async function syncGoalReminders(profile: Profile): Promise<boolean> {
  if (!isReminderAvailable()) return false;
  try {
    await cancelExisting();

    const cadence: GoalReminder = profile.goalReminder ?? 'off';
    const goal = (profile.personalGoal ?? '').trim();
    if (cadence === 'off' || !goal) return true;

    if (!(await ensureReminderPermission())) return false;
    await ensureAndroidChannel();

    const minute = profile.goalReminderMinute ?? 480;
    const hour = Math.floor(minute / 60);
    const min = minute % 60;
    const content = {
      title: 'Why you train',
      body: buildBody(profile),
      ...(Platform.OS === 'android' ? { channelId: 'goal-reminders' } : {}),
    };
    const T = Notifications.SchedulableTriggerInputTypes;

    // Daily and weekly map onto native repeating triggers, so they keep firing
    // forever whether or not the app is ever opened again.
    if (cadence === 'daily') {
      await Notifications.scheduleNotificationAsync({
        identifier: `${IDENTIFIER_PREFIX}-daily`,
        content,
        trigger: { type: T.DAILY, hour, minute: min },
      });
      return true;
    }
    if (cadence === 'weekly') {
      await Notifications.scheduleNotificationAsync({
        identifier: `${IDENTIFIER_PREFIX}-weekly`,
        content,
        // expo weekday: 1 = Sunday. Anchor to today's weekday.
        trigger: { type: T.WEEKLY, weekday: new Date().getDay() + 1, hour, minute: min },
      });
      return true;
    }

    // "Every 3 days" has no native repeating trigger, and a plain interval
    // trigger would drift off the chosen time of day. Schedule explicit dated
    // occurrences instead and top them up on each launch (~72 days of runway).
    const now = new Date();
    for (let i = 1; i <= DATED_OCCURRENCES; i++) {
      const when = new Date(now);
      when.setDate(when.getDate() + i * 3);
      when.setHours(hour, min, 0, 0);
      await Notifications.scheduleNotificationAsync({
        identifier: `${IDENTIFIER_PREFIX}-every3-${i}`,
        content,
        trigger: { type: T.DATE, date: when },
      });
    }
    return true;
  } catch (e) {
    console.warn('goal reminder scheduling failed', e);
    return false;
  }
}

/** How many of our reminders are currently queued (used by the UI to confirm). */
export async function scheduledReminderCount(): Promise<number> {
  if (!isReminderAvailable()) return 0;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.filter((n: { identifier?: string }) =>
      n.identifier?.startsWith(IDENTIFIER_PREFIX)
    ).length;
  } catch {
    return 0;
  }
}
