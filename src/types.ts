export interface Goal {
  id: string;
  text: string;
  done: boolean;
  priority?: "high" | "medium" | "low";
  lightning?: boolean;
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
  folderId?: string; // Customizable folder assignment
}

export interface RoutineFolder {
  id: string;
  name: string;
}

export interface AIDailyWorkout {
  date: string; // YYYY-MM-DD
  name: string;
  durationMins: number;
  exercises: Exercise[];
  setsCount?: number;
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

export interface WaterConfig {
  height?: number; // cm
  weight?: number; // kg
  age?: number; // years
  containerType: "bottle" | "glass";
  capacity: number; // capacity value, e.g. 500, 1, 24
  capacityUnit: "ml" | "lt" | "oz";
  creatineEnabled: boolean;
  creatineAmount: number; // grams
  stimulantsEnabled: boolean;
  stimulantsAmount: number; // mg caffeine
  aiExplanation?: string;
  calculatedGoalMl?: number; // ml daily goal
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
  waterConfig?: WaterConfig;
  taskStreak?: number;
  lastStreakCompletedDate?: string | null;
  
  // Nutrition & Calorie Tracking additions
  calorieGoal?: number;
  proteinGoalPct?: number;
  carbGoalPct?: number;
  fatGoalPct?: number;
  foodLog?: Record<string, FoodLogEntry[]>;

  // AI workout and routing customizable folders extension
  routineFolders?: RoutineFolder[];
  aiDailyWorkout?: AIDailyWorkout;
}

export interface FoodLogEntry {
  id: string;
  name: string;
  calories: number;
  protein: number; // grams per serving/qty
  carbs: number; // grams per serving/qty
  fat: number; // grams per serving/qty
  quantity: number;
  barcode?: string;
  loggedAt: string; // "HH:MM"
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
