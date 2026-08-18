export type WorkoutType =
  | 'easy'
  | 'recovery'
  | 'tempo'
  | 'intervals'
  | 'long'
  | 'race'
  | 'hills'
  | 'other';

export interface Run {
  id: string;
  date: string; // YYYY-MM-DD (local)
  distanceMi: number;
  durationS: number;
  type: WorkoutType;
  shoeId?: string;
  rpe?: number; // 1-10
  note?: string;
  externalId?: string; // dedupe key for imported runs (HealthKit UUID, Strava/Terra id)
}

export interface Shoe {
  id: string;
  brand: string;
  model: string;
  lifespanMiles: number;
  startingMiles: number;
  color: string;
  isDefault?: boolean;
  retiredAt?: string | null;
}

export type ActivityType =
  | 'cycling'
  | 'swimming'
  | 'elliptical'
  | 'rowing'
  | 'strength'
  | 'hiking'
  | 'yoga'
  | 'other';

export interface CrossSession {
  id: string;
  date: string;
  activity: ActivityType;
  minutes: number;
  intensity?: number; // 1-5
  note?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  energy?: number; // 1-5
  soreness?: number; // 1-5
  stress?: number; // 1-5
  sleepHours?: number;
  sleepQuality?: number; // 1-5
  note?: string;
}

export interface ChecklistDef {
  key: string;
  label: string;
  icon: string; // Ionicons name
  auto?: 'run' | 'journal';
  days?: number[]; // JS getDay() values; undefined = every day
  disabled?: boolean; // hidden from the daily checklist (user-toggled in onboarding)
}

export interface PersonalRecord {
  dist: string;
  time: string;
  date: string;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLog {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryMethod: 'barcode' | 'search' | 'manual' | 'quick_add';
}

/** A resolved food (from Open Food Facts, search, or manual) before logging. */
export interface FoodItem {
  name: string;
  brand?: string;
  servingDesc?: string;
  barcode?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A saved food for one-tap re-logging of things eaten often. */
export interface FavoriteFood extends FoodItem {
  id: string;
}

/**
 * A local write that hasn't been confirmed on the server yet — queued when the
 * user is signed out, offline, or the insert failed. Persisted with the store
 * so it survives app restarts, replayed by flushPending() on the next sign-in.
 */
export interface PendingWrite {
  /** The row id, so a replay is idempotent and can be matched to local state. */
  id: string;
  table: 'runs' | 'cross_training' | 'journal_entries' | 'shoes' | 'food_logs' | 'favorite_foods';
  /** insert replays as an upsert; update touches only the given columns, so
   *  editing an imported run can't clobber its source/external_id. */
  op: 'insert' | 'update' | 'delete';
  /** Payload without user_id — that's stamped at flush time. Absent on delete. */
  row?: Record<string, unknown>;
  queuedAt: string;
}

export const MEAL_META: Record<Meal, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny' },
  lunch: { label: 'Lunch', icon: 'partly-sunny' },
  dinner: { label: 'Dinner', icon: 'moon' },
  snack: { label: 'Snack', icon: 'nutrition' },
};

/** How often to resurface the personal goal as a notification. */
export type GoalReminder = 'off' | 'daily' | 'every3' | 'weekly';

export const GOAL_REMINDER_META: Record<GoalReminder, { label: string; days: number }> = {
  off: { label: 'Off', days: 0 },
  daily: { label: 'Every day', days: 1 },
  every3: { label: 'Every 3 days', days: 3 },
  weekly: { label: 'Weekly', days: 7 },
};

export interface Profile {
  name: string;
  weeklyGoalMi: number;
  raceGoal: string;
  /** The personal "why" — e.g. "Top 10 at the state XC meet". */
  personalGoal?: string;
  /** Optional target date (YYYY-MM-DD) so the app can count down to it. */
  personalGoalDate?: string;
  goalReminder: GoalReminder;
  /** Minutes past local midnight for the reminder (e.g. 480 = 8:00 AM). */
  goalReminderMinute: number;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: 'male' | 'female';
  experience?: 'new' | 'regular' | 'competitive';
}

export const WORKOUT_META: Record<WorkoutType, { label: string; color: string }> = {
  easy: { label: 'Easy', color: '#34D399' },
  recovery: { label: 'Recovery', color: '#2DD4BF' },
  tempo: { label: 'Tempo', color: '#FB923C' },
  intervals: { label: 'Intervals', color: '#F87171' },
  long: { label: 'Long Run', color: '#60A5FA' },
  race: { label: 'Race', color: '#C084FC' },
  hills: { label: 'Hills', color: '#FBBF24' },
  other: { label: 'Other', color: '#94A3B8' },
};

export const ACTIVITY_META: Record<ActivityType, { label: string; icon: string }> = {
  cycling: { label: 'Cycling', icon: 'bicycle' },
  swimming: { label: 'Swimming', icon: 'water' },
  elliptical: { label: 'Elliptical', icon: 'infinite' },
  rowing: { label: 'Rowing', icon: 'boat' },
  strength: { label: 'Strength', icon: 'barbell' },
  hiking: { label: 'Hiking', icon: 'trail-sign' },
  yoga: { label: 'Yoga', icon: 'flower' },
  other: { label: 'Other', icon: 'ellipsis-horizontal' },
};
