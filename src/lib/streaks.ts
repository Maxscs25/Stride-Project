import { addDays, todayKey } from './format';

/**
 * Consecutive days an item has been completed, counting back from today
 * (today itself doesn't break the streak if still unchecked).
 */
export function currentStreak(
  completions: Record<string, Record<string, boolean>>,
  key: string
): number {
  const today = todayKey();
  let streak = 0;
  let d = completions[today]?.[key] ? today : addDays(today, -1);
  while (completions[d]?.[key]) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}
