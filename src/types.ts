export interface Goal {
  id: string;
  text: string;
  done: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface SetEntry {
  weight: string;
  reps: string;
}

export interface ActiveWorkout {
  routine: Routine;
  sets: SetEntry[][];
  startTime: number;
  currentEx: number;
}

export interface Supplement {
  id: string;
  name: string;
  dosage?: string;
  times: string[]; // ['morning', 'afternoon', 'evening', 'night']
  scheduledTimes?: Record<string, string>; // { [slotKey]: "HH:MM" }
}

export interface WeightEntry {
  date: string;
  weight: number; // Stored in kg internally
}

export interface ExerciseHistory {
  weight: number;
  reps: number;
  date: string;
}

export interface CompletedWorkout {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
  durationMinutes: number;
  exercises: { name: string; setsCount: number; maxWeight: number; reps: number }[];
}

export interface UserState {
  todayGoals: Goal[];
  tomorrowGoals: Goal[];
  lastDate: string | null;
  routines: Routine[];
  exerciseHistory: Record<string, ExerciseHistory[]>;
  supplements: Supplement[];
  suppChecks: Record<string, Record<string, boolean>>; // { [dateKey]: { [suppId_slotKey]: boolean } }
  waterGoal: number;
  waterUnit: string;
  waterLog: Record<string, number>; // { [dateKey]: loggedUnits }
  weightLog: WeightEntry[];
  useLb: boolean;
  notificationsEnabled?: boolean;
  completedWorkouts?: CompletedWorkout[];
}

export interface CalendarEvent {
  id: string;
  summary: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export interface CoachMessage {
  role: 'user' | 'ai';
  text: string;
  loading?: boolean;
}
