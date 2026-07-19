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
}

export interface PersonalRecord {
  dist: string;
  time: string;
  date: string;
}

export interface Profile {
  name: string;
  weeklyGoalMi: number;
  raceGoal: string;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: 'male' | 'female';
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
