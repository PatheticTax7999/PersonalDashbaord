import { useState, useEffect } from "react";
import { UserState, ActiveWorkout, Routine, Exercise, CompletedWorkout, RoutineFolder, AIDailyWorkout } from "../types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame,
  Globe,
  Plus,
  Folder,
  FolderPlus,
  Dumbbell,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  Sparkles,
  Search,
  Trash,
  Edit,
  ArrowRight,
  Info,
  Scale,
  Calendar,
  Zap,
  TrendingUp,
  MessageSquare,
  X,
  SlidersHorizontal
} from "lucide-react";

// Helper to format timers
const fmtTimer = (s: number) => {
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

interface FitnessTabProps {
  userState: UserState;
  activeWorkout: ActiveWorkout | null;
  onStartWorkout: (routineId: string) => void;
  onFinishWorkout: (exercisesLogged: Record<string, { weight: number; reps: number; date: string }>) => void;
  onCancelWorkout: () => void;
  onSaveRoutine: (id: string | null, name: string, exercises: Exercise[], folderId?: string) => void;
  onDeleteRoutine: (id: string) => void;
  onToggleLb: () => void;
  onUpdateActiveWorkout: (workout: ActiveWorkout | null) => void;
  onUpdateUserState?: (state: UserState) => void;
}

// 15 prepopulated physical conditioning exercises with categories, realistic Unsplash thumbnails & ranks
const PREDEFINED_EXERCISES = [
  {
    name: "Bench Press",
    muscle: "Chest",
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=150&auto=format&fit=crop&q=60",
    rank: 82
  },
  {
    name: "Incline Dumbbell Bench Press",
    muscle: "Chest",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=60",
    rank: 78
  },
  {
    name: "Machine Chest Fly",
    muscle: "Chest",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=60",
    rank: 80
  },
  {
    name: "Lat Pulldown",
    muscle: "Back",
    image: "https://images.unsplash.com/photo-1623874514711-0f321305f3ea?w=150&auto=format&fit=crop&q=60",
    rank: 76
  },
  {
    name: "One Arm Lat Pulldown",
    muscle: "Back",
    image: "https://images.unsplash.com/photo-1623874514711-0f321305f3ea?w=150&auto=format&fit=crop&q=60",
    rank: 72
  },
  {
    name: "Straight Arm Pulldown",
    muscle: "Back",
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=150&auto=format&fit=crop&q=60",
    rank: 59
  },
  {
    name: "Iso-Lateral Low Row",
    muscle: "Back",
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=150&auto=format&fit=crop&q=60",
    rank: 31
  },
  {
    name: "Squats",
    muscle: "Legs",
    image: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=150&auto=format&fit=crop&q=60",
    rank: 85
  },
  {
    name: "Leg Extension",
    muscle: "Legs",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=60",
    rank: 42
  },
  {
    name: "Lying Leg Curl",
    muscle: "Legs",
    image: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=150&auto=format&fit=crop&q=60",
    rank: 34
  },
  {
    name: "Preacher Curl",
    muscle: "Arms",
    image: "https://images.unsplash.com/photo-1605296867304-46d5465a25f1?w=150&auto=format&fit=crop&q=60",
    rank: 33
  },
  {
    name: "Hammer Curl",
    muscle: "Arms",
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=150&auto=format&fit=crop&q=60",
    rank: 45
  },
  {
    name: "Barbell Curl",
    muscle: "Arms",
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=150&auto=format&fit=crop&q=60",
    rank: 48
  },
  {
    name: "Overhead Press",
    muscle: "Shoulders",
    image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=150&auto=format&fit=crop&q=60",
    rank: 75
  },
  {
    name: "Smith Machine Incline",
    muscle: "Chest",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=60",
    rank: 62
  }
];

export default function FitnessTab({
  userState,
  activeWorkout,
  onStartWorkout,
  onFinishWorkout,
  onCancelWorkout,
  onSaveRoutine,
  onDeleteRoutine,
  onToggleLb,
  onUpdateActiveWorkout,
  onUpdateUserState
}: FitnessTabProps) {
  // General UI state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "folder-3": true
  });

  // Custom keyboard & plate calculator state
  const [activeInput, setActiveInput] = useState<{ exIdx: number; setIdx: number; field: "weight" | "reps" } | null>(null);
  const [showPlateCalculator, setShowPlateCalculator] = useState(false);
  const [calculatorBarWeight, setCalculatorBarWeight] = useState<number>(20); // standard bar default in kg
  const [calculatorPlates, setCalculatorPlates] = useState<number[]>([]); // plates in kg (loading on one side of barbell, symmetric)
  const [availablePlates, setAvailablePlates] = useState<number[]>([20, 15, 10, 5, 2.5, 1.25]); // standard Australian plate sizes in kg
  const [exercisesList, setExercisesList] = useState<any[]>(PREDEFINED_EXERCISES);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbLoadError, setDbLoadError] = useState(false);
  const [showAddExChooser, setShowAddExChooser] = useState(false);
  const [exChooserSearch, setExChooserSearch] = useState("");
  const [exChooserTab, setExChooserTab] = useState<"alphabetical" | "rank" | "performed" | "muscle">("alphabetical");
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState("All");
  const [showAddRoutineModal, setShowAddRoutineModal] = useState(false);
  const [activeTabExIdx, setActiveTabExIdx] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Folder creation state
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Options Menu states for Routine items
  const [activeRoutineMenuId, setActiveRoutineMenuId] = useState<string | null>(null);

  // Routine building modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [modalExercises, setModalExercises] = useState<Exercise[]>([]);
  const [searchExerciseQuery, setSearchExerciseQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("folder-3");

  // Show AI generator loader or help modal
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAiHelpModal, setShowAiHelpModal] = useState(false);

  // Workout Completion summary screen details
  const [completedStats, setCompletedStats] = useState<{
    name: string;
    durationMins: number;
    totalWeight: number;
    growthDetails: { name: string; currentMax: number; previousMax: number; changeText: string }[];
    aiTips: string;
    loadingTips: boolean;
  } | null>(null);

  // Helpers for custom weight keyboard and barbell calculator
  const handleKeyboardPress = (val: string) => {
    if (!activeWorkout || !activeInput) return;
    const { exIdx, setIdx, field } = activeInput;
    const currentVal = activeWorkout.sets[exIdx]?.[setIdx]?.[field] || "";

    let newVal = currentVal;
    if (val === "BACKSPACE") {
      newVal = currentVal.slice(0, -1);
    } else if (val === ".") {
      if (!currentVal.includes(".")) {
        newVal = currentVal + ".";
      }
    } else {
      newVal = currentVal + val;
    }

    handleUpdateActiveSetField(exIdx, setIdx, field, newVal);
  };

  const getPlateStyle = (kg: number) => {
    if (kg >= 20) return { height: 84, width: 18, color: "bg-[#2f80ed] text-white" };
    if (kg >= 15) return { height: 74, width: 16, color: "bg-[#f2c94c] text-black" };
    if (kg >= 10) return { height: 64, width: 14, color: "bg-[#27ae60] text-white" };
    if (kg >= 5) return { height: 54, width: 12, color: "bg-[#cbd5e1] text-black" };
    if (kg >= 2.5) return { height: 44, width: 10, color: "bg-[#eb5757] text-white" };
    if (kg >= 1.25) return { height: 34, width: 8, color: "bg-[#707070] text-white" };
    
    // Custom/Fallback sizing
    const calculatedHeight = Math.min(84, Math.max(30, 30 + (kg * 2.5)));
    const calculatedWidth = Math.min(18, Math.max(8, 8 + (kg / 2)));
    return { height: calculatedHeight, width: calculatedWidth, color: "bg-[#10b981] text-white" };
  };

  const getCalculatorTotal = () => {
    const sumPlates = calculatorPlates.reduce((sum, p) => sum + p, 0);
    if (calculatorBarWeight === 0) {
      return sumPlates;
    } else {
      return calculatorBarWeight + 2 * sumPlates;
    }
  };

  // Auto-generate daily workout at launch if missing for today
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const existingWorkout = userState.aiDailyWorkout;

    if (!existingWorkout || existingWorkout.date !== todayStr) {
      triggerDailyWorkoutGeneration();
    }
  }, []);

  // Fetch Free Exercise DB from the official git repository
  useEffect(() => {
    let active = true;
    const fetchFreeExerciseDB = async () => {
      setIsLoadingDb(true);
      try {
        const res = await fetch("https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json");
        if (!res.ok) throw new Error("HTTP error " + res.status);
        const data = await res.json();
        if (active && Array.isArray(data)) {
          const mapped = data.map((item: any, idx: number) => {
            const primary = (item.primaryMuscles && item.primaryMuscles[0]) || "other";
            let muscle = "Other";
            
            // Map 15+ complex muscle name states into our high level UI classification
            if (primary === "chest") {
              muscle = "Chest";
            } else if (["lats", "middle back", "lower back", "trapezius"].includes(primary)) {
              muscle = "Back";
            } else if (["quadriceps", "hamstrings", "calves", "glutes"].includes(primary)) {
              muscle = "Legs";
            } else if (["biceps", "triceps", "forearms"].includes(primary)) {
              muscle = "Arms";
            } else if (primary === "shoulders") {
              muscle = "Shoulders";
            } else if (["abdominals", "neck"].includes(primary)) {
              muscle = "Core";
            } else if (["cardio"].includes(primary)) {
              muscle = "Cardio";
            }

            let image = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=60";
            if (item.images && item.images.length > 0) {
              image = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${item.images[0]}`;
            }

            return {
              name: item.name,
              muscle,
              image,
              rank: Math.min(100, Math.max(1, 99 - Math.floor(idx / 9))),
              instructions: item.instructions || [],
              equipment: item.equipment || "none"
            };
          });

          // Prepend original high-fidelity selections so they remain first order
          const merged = [...PREDEFINED_EXERCISES, ...mapped.filter((m: any) => !PREDEFINED_EXERCISES.some(p => p.name.toLowerCase() === m.name.toLowerCase()))];
          setExercisesList(merged);
          setDbLoadError(false);
        }
      } catch (err) {
        console.error("Failed to load official Exercise DB, utilizing robust local fallback:", err);
        setDbLoadError(true);
      } finally {
        if (active) setIsLoadingDb(false);
      }
    };

    fetchFreeExerciseDB();
    return () => {
      active = false;
    };
  }, []);

  // Monitor active workout duration timer
  useEffect(() => {
    let timerInterval: any = null;
    if (activeWorkout) {
      setElapsedSeconds(Math.floor((Date.now() - activeWorkout.startTime) / 1000));
      timerInterval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - activeWorkout.startTime) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timerInterval);
  }, [activeWorkout]);

  // Generate today's target workout program (only once/day representation)
  const triggerDailyWorkoutGeneration = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/fitness/generate-daily-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedWorkouts: userState.completedWorkouts || [],
          useLb: userState.useLb
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.name) {
          const formattedExercises = (data.exercises || []).map((ex: any) => ({
            id: Math.random().toString(36).slice(2, 9),
            name: ex.name,
            notes: ex.notes || "3 sets x 10 reps"
          }));

          const updatedState: UserState = {
            ...userState,
            aiDailyWorkout: {
              date: todayStr,
              name: data.name,
              durationMins: data.durationMins || 60,
              setsCount: data.setsCount || 15,
              exercises: formattedExercises
            }
          };

          if (onUpdateUserState) {
            onUpdateUserState(updatedState);
          }
        }
      }
    } catch (e) {
      console.error("Failed to generate AI daily workout:", e);
    } finally {
      setAiGenerating(false);
    }
  };

  // Helper mapping exercises to their illustrations
  const findExIllustration = (name: string) => {
    const found = exercisesList.find(e => e.name.toLowerCase() === name.toLowerCase());
    return found ? found.image : "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=150&auto=format&fit=crop&q=60";
  };

  // Handle active set input checking off
  const handleToggleSetCheck = (exIdx: number, setIdx: number) => {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout };
    updated.sets = [...updated.sets];
    updated.sets[exIdx] = [...updated.sets[exIdx]];
    
    const setObj = { ...updated.sets[exIdx][setIdx] } as any;
    setObj.checked = !setObj.checked;
    
    updated.sets[exIdx][setIdx] = setObj;
    onUpdateActiveWorkout(updated);
  };

  const handleUpdateActiveSetField = (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout };
    updated.sets = [...updated.sets];
    updated.sets[exIdx] = [...updated.sets[exIdx]];

    updated.sets[exIdx][setIdx] = {
      ...updated.sets[exIdx][setIdx],
      [field]: value
    };
    onUpdateActiveWorkout(updated);
  };

  const handleAddSetToExercise = (exIdx: number) => {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout };
    updated.sets = [...updated.sets];
    updated.sets[exIdx] = [
      ...updated.sets[exIdx],
      { weight: "", reps: "" }
    ];
    onUpdateActiveWorkout(updated);
  };

  const handleRemoveSetFromExercise = (exIdx: number, setIdx: number) => {
    if (!activeWorkout) return;
    if (activeWorkout.sets[exIdx].length > 1) {
      const updated = { ...activeWorkout };
      updated.sets = [...updated.sets];
      updated.sets[exIdx] = updated.sets[exIdx].filter((_, i) => i !== setIdx);
      onUpdateActiveWorkout(updated);
    }
  };

  // Start generation manually
  const handleManualRegenerate = () => {
    if (confirm("Regenerate today's AI recommendation? This will analyze your recent training logs instantly.")) {
      triggerDailyWorkoutGeneration();
    }
  };

  // Start physical workout session from routine ID
  const handleStartRoutineSession = (routine: Routine) => {
    onUpdateActiveWorkout({
      routine,
      sets: routine.exercises.map(() => [{ weight: "", reps: "" }]),
      startTime: Date.now(),
      currentEx: 0
    });
    setCompletedStats(null);
  };

  // Launch a standard empty scratchpad workout
  const handleStartEmptyWorkout = () => {
    const emptyRoutine: Routine = {
      id: "empty-" + Math.random().toString(36).slice(2, 7),
      name: "Custom Lifting Workout",
      folderId: "folder-3",
      exercises: []
    };
    handleStartRoutineSession(emptyRoutine);
  };

  // Finish active session, calculate metrics, contact AI coach for tailored Overload advice!
  const handleCompleteActiveWorkout = async () => {
    if (!activeWorkout) return;

    const elapsedMs = Date.now() - activeWorkout.startTime;
    const elapsedMins = Math.round(elapsedMs / 60000) || 1;

    // Calculate sum of (Weight * Reps) for strictly completed sets
    let totalWeightVolumeKgByUnit = 0;
    const finalExercisesListForLogs: Record<string, { weight: number; reps: number; date: string }> = {};
    const exercisesReportForStats: { name: string; setsCount: number; maxWeight: number; reps: number }[] = [];

    activeWorkout.routine.exercises.forEach((ex, exIdx) => {
      const setsOfEx = activeWorkout.sets[exIdx] || [];
      // Grab only checked sets, or if none checked, default to all parsed sets for backward robustness
      const checkedSets = setsOfEx.filter((s: any) => s.checked);
      const activeSets = checkedSets.length > 0 ? checkedSets : setsOfEx.filter(s => s.weight !== "" && s.reps !== "");

      if (activeSets.length === 0) return;

      let maxWeightForEx = 0;
      let topSetReps = 0;

      activeSets.forEach(set => {
        const weightVal = parseFloat(set.weight) || 0;
        const repsVal = parseInt(set.reps) || 0;
        totalWeightVolumeKgByUnit += (weightVal * repsVal);

        if (weightVal > maxWeightForEx) {
          maxWeightForEx = weightVal;
          topSetReps = repsVal;
        }
      });

      // Map to internal kg format for long-term progression if prefer Lb is active
      const internalWeightKg = userState.useLb
        ? parseFloat((maxWeightForEx / 2.20462).toFixed(2))
        : parseFloat(maxWeightForEx.toFixed(2));

      const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      finalExercisesListForLogs[ex.name] = {
        weight: internalWeightKg,
        reps: topSetReps,
        date: dateStr
      };

      exercisesReportForStats.push({
        name: ex.name,
        setsCount: activeSets.length,
        maxWeight: maxWeightForEx,
        reps: topSetReps
      });
    });

    // Solve progression growth overlays compared to history
    const growthArray = exercisesReportForStats.map(ex => {
      const history = userState.exerciseHistory[ex.name] || [];
      const previousBestKg = history.length > 0 ? Math.max(...history.map(h => h.weight)) : 0;
      const currentMaxKg = userState.useLb ? (ex.maxWeight / 2.20462) : ex.maxWeight;

      let changeText = "Standard Target Met";
      if (previousBestKg > 0) {
        const diff = currentMaxKg - previousBestKg;
        if (diff > 0) {
          const displayDiff = userState.useLb ? (diff * 2.20462).toFixed(1) : diff.toFixed(1);
          changeText = `🔥 +${displayDiff} ${userState.useLb ? "lb" : "kg"} Progressive Overload gained!`;
        } else if (diff === 0) {
          changeText = "⭐ Matched Previous Best Record";
        } else {
          changeText = "🛡️ Stable Recovery Lift Volume";
        }
      } else {
        changeText = "🌱 Base Strength Established";
      }

      return {
        name: ex.name,
        currentMax: ex.maxWeight,
        previousMax: userState.useLb ? parseFloat((previousBestKg * 2.20462).toFixed(1)) : previousBestKg,
        changeText
      };
    });

    // Stage temporary stats for the gorgeous summary UI
    const activeWorkoutSummary = {
      name: activeWorkout.routine.name,
      durationMinutes: elapsedMins,
      exercises: exercisesReportForStats
    };

    setCompletedStats({
      name: activeWorkout.routine.name,
      durationMins: elapsedMins,
      totalWeight: totalWeightVolumeKgByUnit,
      growthDetails: growthArray,
      aiTips: "Analysing lift patterns to construct peak overload tactics...",
      loadingTips: true
    });

    // Make async call to backend AI endpoint for smart Coach advice!
    try {
      const res = await fetch("/api/fitness/generate-workout-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastWorkout: activeWorkoutSummary,
          useLb: userState.useLb
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.tips) {
          setCompletedStats(prev => prev ? {
            ...prev,
            aiTips: data.tips,
            loadingTips: false
          } : null);
        }
      }
    } catch (err) {
      console.error("Failed to generate coach advice tips:", err);
      setCompletedStats(prev => prev ? {
        ...prev,
        aiTips: "• Smashed your target volume! Continue prioritizing structural recovery and system glycogen saturation.\n• Increase your heavy bench setups next workout by index: add 2kg to target mechanical hyper-gains.",
        loadingTips: false
      } : null);
    }

    // Capture logs securely to the main state
    onFinishWorkout(finalExercisesListForLogs);
  };

  // Unit converter display
  const dispWeight = (kgValue: number) => {
    if (userState.useLb) {
      return `${(kgValue * 2.20462).toFixed(1)} lb`;
    }
    return `${kgValue} kg`;
  };

  // Add selected exercise dynamically to active workout session
  const handleAddSelectedExerciseToWorkout = (baseEx: { name: string }) => {
    if (!activeWorkout) return;
    const newEx: Exercise = {
      id: Math.random().toString(36).slice(2, 9),
      name: baseEx.name,
      notes: "3 sets x 10 reps"
    };
    
    const updated = {
      ...activeWorkout,
      routine: {
        ...activeWorkout.routine,
        exercises: [...activeWorkout.routine.exercises, newEx]
      },
      sets: [...activeWorkout.sets, [{ weight: "", reps: "" }]]
    };
    onUpdateActiveWorkout(updated);
    setShowAddExChooser(false);
    setExChooserSearch("");
  };

  // Append full routine into current active workout
  const handleLoadRoutineIntoWorkout = (routineToLoad: Routine) => {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      routine: {
        ...activeWorkout.routine,
        exercises: [...activeWorkout.routine.exercises, ...routineToLoad.exercises]
      },
      sets: [
        ...activeWorkout.sets,
        ...routineToLoad.exercises.map(() => [{ weight: "", reps: "" }])
      ]
    };
    onUpdateActiveWorkout(updated);
    setShowAddRoutineModal(false);
  };

  // Sort and filter helper for exercise chooser modal (Img 4 replication)
  const getSortedExercisesForChooser = () => {
    let list = [...exercisesList];

    if (exChooserSearch.trim()) {
      const q = exChooserSearch.toLowerCase().trim();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
    }

    if (exChooserTab === "alphabetical") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (exChooserTab === "rank") {
      list.sort((a, b) => b.rank - a.rank);
    } else if (exChooserTab === "performed") {
      list = list.filter(e => userState.exerciseHistory[e.name] && userState.exerciseHistory[e.name].length > 0);
    } else if (exChooserTab === "muscle") {
      if (selectedMuscleFilter !== "All") {
        list = list.filter(e => e.muscle.toLowerCase() === selectedMuscleFilter.toLowerCase());
      }
    }

    // Slice to top 150 match elements to maintain maximum UI performance stability
    return list.slice(0, 150);
  };

  const sortedExercisesForChooser = getSortedExercisesForChooser();

  // Folder management
  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const folderId = "folder-" + Math.random().toString(36).slice(2, 7);
    const updatedFolders = [
      ...(userState.routineFolders || []),
      { id: folderId, name: trimmed }
    ];

    if (onUpdateUserState) {
      onUpdateUserState({
        ...userState,
        routineFolders: updatedFolders
      });
    }

    setExpandedFolders(prev => ({ ...prev, [folderId]: true }));
    setNewFolderName("");
    setShowAddFolderModal(false);
  };

  // Delete customize folder
  const handleDeleteFolder = (folderId: string) => {
    if (folderId === "folder-3") {
      alert("The primary folder 'My Routines' cannot be deleted.");
      return;
    }
    if (confirm("Delete this folder? Routines inside will be reassigned to 'My Routines' folder.")) {
      const updatedFolders = (userState.routineFolders || []).filter(f => f.id !== folderId);
      const updatedRoutines = userState.routines.map(r => r.folderId === folderId ? { ...r, folderId: "folder-3" } : r);

      if (onUpdateUserState) {
        onUpdateUserState({
          ...userState,
          routineFolders: updatedFolders,
          routines: updatedRoutines
        });
      }
    }
  };

  // Open builder to create or edit routine
  const handleOpenRoutineModal = (r: Routine | null) => {
    setEditingRoutine(r);
    if (r) {
      setRoutineName(r.name);
      setModalExercises(r.exercises.map(e => ({ ...e })));
      setSelectedFolderId(r.folderId || "folder-3");
    } else {
      setRoutineName("");
      setModalExercises([]);
      setSelectedFolderId("folder-3");
    }
    setSearchExerciseQuery("");
    setModalOpen(true);
  };

  const handleAddExerciseToRoutine = (baseEx: { name: string }) => {
    const newEx: Exercise = {
      id: Math.random().toString(36).slice(2, 9),
      name: baseEx.name,
      notes: "3 sets x 10 reps"
    };
    setModalExercises(prev => [...prev, newEx]);
    setSearchExerciseQuery("");
  };

  const handleSaveRoutineSession = () => {
    const name = routineName.trim();
    if (!name || modalExercises.length === 0) {
      alert("Please provide a routine name and at least one exercise.");
      return;
    }
    onSaveRoutine(editingRoutine ? editingRoutine.id : null, name, modalExercises, selectedFolderId);
    setModalOpen(false);
    setEditingRoutine(null);
  };

  // Filter predefined exercises based on search query
  const filteredExercises = exercisesList.filter(ex =>
    ex.name.toLowerCase().includes(searchExerciseQuery.toLowerCase()) ||
    ex.muscle.toLowerCase().includes(searchExerciseQuery.toLowerCase())
  ).slice(0, 80);

  // Group routines by folder structure
  const foldersToRender = userState.routineFolders || [
    { id: "folder-3", name: "My Routines" }
  ];

  const loggedExercises = [...new Set(userState.routines.flatMap(r => r.exercises.map(e => e.name)))];

  // SECTION 1: WORKOUT COMPLETION PAGE
  if (completedStats) {
    return (
      <div className="w-full max-w-md mx-auto py-6 px-4 pb-28 flex flex-col gap-5 text-left">
        {/* Animated celebration banner */}
        <div className="bg-[#1c182d] border-2 border-[#f0c972] rounded-3xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden gap-1 shadow-2xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="text-5xl"
          >
            🏆
          </motion.div>
          
          <span className="font-bebas text-3xl text-gradient bg-clip-text text-transparent bg-gradient-to-r from-[#f0c972] to-[#e07b3f] tracking-widest mt-2">
            Workout Completed!
          </span>
          <span className="font-mono text-[9px] text-[#9991b8] uppercase tracking-widest mt-1">
            Adapting Physical Capacities
          </span>
        </div>

        {/* Core Stats Bento Block */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#13111f] border border-[#2a2440] p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 h-24">
            <span className="text-gray-400 font-mono text-[9px] uppercase tracking-wider block">⏱️ Lift Duration</span>
            <span className="font-bebas text-2xl text-white tracking-wide">{completedStats.durationMins} min</span>
          </div>

          <div className="bg-[#13111f] border border-[#2a2440] p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 h-24">
            <span className="text-gray-400 font-mono text-[9px] uppercase tracking-wider block">⚖️ Total Weight Volume</span>
            <span className="font-bebas text-2xl text-[#f0c972] tracking-wide">
              {completedStats.totalWeight.toLocaleString()} {userState.useLb ? "lb" : "kg"}
            </span>
          </div>
        </div>

        {/* Growth/Adaptation details list */}
        <div className="bg-[#13111f] border border-[#2a2440] p-4.5 rounded-2xl flex flex-col gap-3">
          <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest block border-b border-[#221d35] pb-2">
            🌱 Neuromuscular Growth Summary
          </span>

          <div className="space-y-3.5">
            {completedStats.growthDetails.map((gr, idx) => (
              <div key={idx} className="flex gap-3 justify-between items-start">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-white block truncate leading-snug">{gr.name}</span>
                  <span className="font-mono text-[9px] text-[#6fcf97] block tracking-wide mt-0.5">{gr.changeText}</span>
                </div>
                <div className="text-right font-mono text-xs text-gray-400 shrink-0">
                  <span className="text-white font-semibold">{gr.currentMax}</span>
                  <span className="text-[10px] text-gray-500"> / {gr.previousMax || "-"} {userState.useLb ? "lb" : "kg"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coach AI Tips and Progressive Overload suggestions */}
        <div className="bg-gradient-to-br from-[#19152b] to-[#131124] border border-[#f0c97233] p-5 rounded-2xl flex flex-col gap-3 relative overflow-hidden shadow">
          <div className="flex justify-between items-center z-10 border-b border-[#2e2652] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <span className="font-bebas text-lg tracking-wider text-[#f0c972] block">AI Overload Prescription</span>
                <span className="text-[7.5px] font-mono text-[#9180c4] uppercase tracking-wider">Dynamic progressive tactics</span>
              </div>
            </div>
            {completedStats.loadingTips && (
              <div className="w-4 h-4 border-2 border-[#f0c972] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <p className="font-mono text-[10px] text-[#c3b6dc] leading-relaxed whitespace-pre-wrap select-text z-10">
            {completedStats.aiTips}
          </p>
        </div>

        {/* Return Button */}
        <button
          onClick={() => setCompletedStats(null)}
          className="w-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bebas text-lg tracking-wider py-4 rounded-2xl active:scale-95 transition-all shadow-lg text-center"
        >
          Save & Exit Lift Board
        </button>
      </div>
    );
  }

  // SECTION 2: ACTIVE WORKOUT PAGE (img-5 layout style representation)
  if (activeWorkout) {
    const { routine, sets } = activeWorkout;

    return (
      <div className={`w-full max-w-md mx-auto py-6 px-4 flex flex-col gap-5 text-left transition-all ${activeInput && !showPlateCalculator ? "pb-[450px]" : "pb-28"}`}>
        {/* Persistent top progress HUD with Timer & Exit control */}
        <div className="flex justify-between items-center bg-[#13111f] border border-[#2a2440] px-4 py-3.5 rounded-2xl gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (confirm("Are you sure you want to quit this workout session? Your logged lifts will be lost.")) {
                  onCancelWorkout();
                }
              }}
              className="text-[#9991b8] hover:text-red-400 p-0.5 cursor-pointer active:scale-90 animate-none shrink-0"
              title="Quit session"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <span className="font-bebas text-lg text-white block tracking-wider truncate">
                {routine.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-[#9991b8] font-mono mt-0.5">
                <Clock className="w-3 h-3 text-[#f0c972]" />
                <span>{fmtTimer(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Persistent KG/LB Converter Switch at Top */}
          <div className="flex items-center gap-1.5 bg-[#0d0b14] border border-[#231d45] rounded-xl px-2.5 py-1.5 font-mono text-[9px] select-none shrink-0 scale-90 sm:scale-100">
            <span
              onClick={onToggleLb}
              className={`cursor-pointer transition-colors font-bold ${!userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
            >
              KG
            </span>
            <div
              onClick={onToggleLb}
              className="w-8 h-4 rounded-full bg-[#1e1a30] relative cursor-pointer"
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                style={{
                  left: userState.useLb ? "18px" : "2px",
                  backgroundColor: userState.useLb ? "#f0c972" : "#a49bcb"
                }}
              />
            </div>
            <span
              onClick={onToggleLb}
              className={`cursor-pointer transition-colors font-bold ${userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
            >
              LB
            </span>
          </div>

          {/* Finish session button */}
          <button
            onClick={handleCompleteActiveWorkout}
            className="flex items-center justify-center bg-gradient-to-r from-[#4285F4] to-[#34A853] text-white w-9 h-9 rounded-full shadow hover:scale-105 active:scale-95 cursor-pointer transition-transform shrink-0"
            title="Complete Workout"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Workout notes textbox (Img 3) */}
        <div>
          <textarea
            placeholder="Your workout notes..."
            className="w-full bg-[#13111f] border border-[#2a2440] rounded-2xl p-3.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-[#f0c972]"
            rows={2}
          />
        </div>

        {/* Exercises list */}
        {routine.exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-[#13111f] border border-[#2a2440] rounded-2xl text-center gap-5">
            <div className="w-12 h-12 bg-[#1e1a30] rounded-full flex items-center justify-center text-gray-400">
              <Plus className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bebas text-lg text-white tracking-wider">No exercises added yet</span>
              <span className="font-mono text-[10px] text-gray-500 max-w-xs leading-relaxed">
                Add predefined lifts from our exercises catalog or select a routine flow below.
              </span>
            </div>

            {/* Img 3 styled side-by-side buttons */}
            <div className="flex gap-3.5 w-full max-w-xs mt-3 select-none">
              <button
                onClick={() => setShowAddRoutineModal(true)}
                className="flex-1 bg-[#1e1a30] hover:bg-[#201d36] text-[#4285F4] hover:text-white border border-[#2d2459] hover:border-[#4285F4] font-mono text-xs font-bold py-3 px-4.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                + Routine
              </button>

              <button
                onClick={() => {
                  setShowAddExChooser(true);
                  setExChooserSearch("");
                }}
                className="flex-1 bg-[#11233d] hover:bg-[#163054] text-[#4285F4] hover:text-white border border-[#1b3d6a] hover:border-[#4285F4] font-mono text-xs font-bold py-3 px-4.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                + Exercise
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {routine.exercises.map((ex, exIdx) => {
              const exSets = sets[exIdx] || [{ weight: "", reps: "" }];
              const illustration = findExIllustration(ex.name);

              // Fetch previous history best logs if available
              const prevHistory = userState.exerciseHistory[ex.name] || [];
              const prevBest = prevHistory[prevHistory.length - 1];
              const prevLabel = prevBest
                ? `${userState.useLb ? Math.round(prevBest.weight * 2.20462) : prevBest.weight} x ${prevBest.reps}`
                : "-";

              return (
                <div key={ex.id} className="bg-[#13111f] border border-[#2a2440] rounded-2xl overflow-hidden p-4 sm:p-5 shadow">
                  {/* Header row */}
                  <div className="flex gap-3.5 items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={illustration}
                        alt={ex.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#2a2440] shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="text-left min-w-0">
                        <span className="font-mono text-sm tracking-tight text-white font-bold block truncate leading-snug">
                          {ex.name}
                        </span>
                        {ex.notes && (
                          <span className="text-[10px] text-gray-500 font-mono leading-none block mt-0.5 truncate max-w-[180px]">
                            💡 {ex.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Delete exercise icon button */}
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${ex.name} from this session?`)) {
                          const updated = {
                            ...activeWorkout,
                            routine: {
                              ...activeWorkout.routine,
                              exercises: activeWorkout.routine.exercises.filter((_, idx) => idx !== exIdx)
                            },
                            sets: activeWorkout.sets.filter((_, idx) => idx !== exIdx)
                          };
                          onUpdateActiveWorkout(updated);
                        }
                      }}
                      className="text-[#6b6485] hover:text-red-400 active:scale-90 p-1"
                      title="Remove exercise"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sets interactive tables */}
                  <div className="grid grid-cols-[30px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 mb-2 text-center text-[9px] font-mono text-gray-500 select-none">
                    <div>SET</div>
                    <div>PREV</div>
                    <div>{userState.useLb ? "LBS" : "KGS"}</div>
                    <div>REPS</div>
                    <div />
                  </div>

                  <div className="space-y-2">
                    {exSets.map((s: any, setIdx) => {
                      const isChecked = !!s.checked;

                      return (
                        <div
                          key={setIdx}
                          className={`grid grid-cols-[30px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 items-center transition-opacity duration-150 ${
                            isChecked ? "opacity-50" : "opacity-100"
                          }`}
                        >
                          {/* Circle badge */}
                          <div className="text-center font-mono text-xs text-semibold text-gray-500">
                            {setIdx + 1}
                          </div>

                          {/* Prev details block */}
                          <div className="bg-[#1c182d] border border-[#221d35] rounded-xl px-1.5 py-2 font-mono text-[10px] text-gray-400 text-center">
                            {prevLabel}
                          </div>

                          {/* Weight Input */}
                          <input
                            type="text"
                            inputMode="none"
                            placeholder="0"
                            disabled={isChecked}
                            value={s.weight}
                            onFocus={() => {
                              setActiveInput({ exIdx, setIdx, field: "weight" });
                            }}
                            onChange={(e) => handleUpdateActiveSetField(exIdx, setIdx, "weight", e.target.value)}
                            className={`w-full bg-[#1e1a30] py-2 text-center font-mono text-xs text-white focus:outline-none rounded-xl transition-all ${
                              activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.field === "weight"
                                ? "border-2 border-[#f0c972]"
                                : "border border-[#221d35] hover:border-[#f0c972]/30"
                            } disabled:opacity-40`}
                          />

                          {/* Reps Input */}
                          <input
                            type="text"
                            inputMode="none"
                            placeholder="0"
                            disabled={isChecked}
                            value={s.reps}
                            onFocus={() => {
                              setActiveInput({ exIdx, setIdx, field: "reps" });
                            }}
                            onChange={(e) => handleUpdateActiveSetField(exIdx, setIdx, "reps", e.target.value)}
                            className={`w-full bg-[#1e1a30] py-2 text-center font-mono text-xs text-white focus:outline-none rounded-xl transition-all ${
                              activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.field === "reps"
                                ? "border-2 border-[#f0c972]"
                                : "border border-[#221d35] hover:border-[#f0c972]/30"
                            } disabled:opacity-40`}
                          />

                          {/* Checklist checkbox action */}
                          <button
                            type="button"
                            onClick={() => handleToggleSetCheck(exIdx, setIdx)}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 cursor-pointer self-center justify-self-center transition-all ${
                              isChecked
                                ? "bg-[#6fcf97] border-[#6fcf97] text-[#0d0b14]"
                                : "border-[#2d2459] text-transparent hover:border-[#f0c972]"
                            }`}
                          >
                            <Check className="w-4 h-4 text-[#0d0b14]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick operations strip */}
                  <div className="flex gap-2.5 mt-3.5">
                    <button
                      onClick={() => handleAddSetToExercise(exIdx)}
                      className="flex-1 border border-dashed border-[#221d35] hover:border-[#f0c972] rounded-xl py-2 font-mono text-[10.5px] text-[#6b6485] hover:text-white transition-colors cursor-pointer text-center"
                    >
                      + ADD SET
                    </button>
                    {exSets.length > 1 && (
                      <button
                        onClick={() => handleRemoveSetFromExercise(exIdx, exSets.length - 1)}
                        className="border border-[#221d35] hover:border-red-400 hover:text-red-400 border-dashed rounded-xl px-4 py-2 font-mono text-[10.5px] text-[#6b6485] transition-colors cursor-pointer"
                      >
                        Delete Set
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Post-list fast actions toolbar to expand exercises dynamically */}
            <div className="grid grid-cols-2 gap-3.5 select-none pt-2">
              <button
                onClick={() => setShowAddRoutineModal(true)}
                className="bg-[#13111f] hover:bg-[#1a172c] text-[#4285F4] border border-[#2a2440] hover:border-[#4285F4] font-mono text-[10.5px] font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                + Routine
              </button>

              <button
                onClick={() => {
                  setShowAddExChooser(true);
                  setExChooserSearch("");
                }}
                className="bg-[#13111f] hover:bg-[#1a172c] text-[#4285F4] border border-[#2a2440] hover:border-[#4285F4] font-mono text-[10.5px] font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                + Exercise
              </button>
            </div>
          </div>
        )}

        {/* Global finish session buttons action */}
        {routine.exercises.length > 0 && (
          <button
            onClick={handleCompleteActiveWorkout}
            className="w-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bebas text-lg tracking-wider py-4 rounded-2xl active:scale-95 transition-all shadow-lg text-center cursor-pointer mt-4"
          >
            FINISH TRAINING SESSION  ✓
          </button>
        )}

        {/* Elegant Custom Keyboard Panel */}
        <AnimatePresence key="keyboard-presence">
          {activeInput && !showPlateCalculator && (
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed bottom-16 left-0 right-0 z-40 bg-[#13111f]/95 backdrop-blur-md border-t-2 border-[#2a2440] p-4 pb-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] max-w-md mx-auto rounded-t-3xl text-left font-sans"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f0c972] animate-ping inline-block mr-1" />
                  <span>Set {activeInput.setIdx + 1}: </span>
                  <span className="text-[#f0c972] font-semibold uppercase">{activeInput.field === "weight" ? (userState.useLb ? "Weight (LBS)" : "Weight (KGS)") : "Reps count"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Backspace Button */}
                  <button
                    onClick={() => handleKeyboardPress("BACKSPACE")}
                    className="px-3.5 py-1.5 bg-[#1c182d] border border-[#2a2440] rounded-xl font-mono text-xs text-white hover:border-red-400 hover:text-red-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>⌫</span>
                    <span className="text-[10px]">Del</span>
                  </button>
                  {/* Done Button */}
                  <button
                    onClick={() => setActiveInput(null)}
                    className="px-4 py-1.5 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] rounded-xl font-mono text-xs font-bold text-[#0d0b14] active:scale-95 transition-all cursor-pointer"
                  >
                    Done ✓
                  </button>
                </div>
              </div>

              {/* 1-9 Grid with Bottom Left Calculator, 0, and Decimal */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyboardPress(key)}
                    className="bg-[#1c182d] hover:bg-[#25203b] border border-[#2a2440] rounded-2xl py-3 font-mono text-xl font-bold text-white flex items-center justify-center active:scale-90 select-none cursor-pointer transition-colors"
                  >
                    {key}
                  </button>
                ))}
                {/* Custom Bottom-Left Button to show Plate Calculator */}
                <button
                  onClick={() => {
                    setShowPlateCalculator(true);
                  }}
                  className="bg-[#1a1c38] hover:bg-[#21264c] border border-[#303977] text-[#4285F4] hover:text-white rounded-2xl py-3 flex flex-col items-center justify-center active:scale-90 select-none cursor-pointer transition-all leading-tight"
                >
                  <span className="text-sm">⚖️</span>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-tighter mt-0.5">Plate Calc</span>
                </button>

                {/* 0 Key */}
                <button
                  onClick={() => handleKeyboardPress("0")}
                  className="bg-[#1c182d] hover:bg-[#25203b] border border-[#2a2440] rounded-2xl py-3 font-mono text-xl font-bold text-white flex items-center justify-center active:scale-90 select-none cursor-pointer transition-colors"
                >
                  0
                </button>

                {/* Decimal Point Key */}
                <button
                  onClick={() => handleKeyboardPress(".")}
                  className="bg-[#1c182d] hover:bg-[#25203b] border border-[#2a2440] rounded-2xl py-3 font-mono text-xl font-bold text-white flex items-center justify-center active:scale-90 select-none cursor-pointer transition-colors"
                >
                  .
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Immersive Weight Plate Calculator Modal */}
        <AnimatePresence key="calculator-presence">
          {showPlateCalculator && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-[#0d0b14] flex flex-col text-left overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="flex justify-between items-center px-4 py-4 border-b border-[#221d35] shrink-0">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#f0c972]" />
                  <div>
                    <span className="font-bebas text-lg text-white block tracking-wider">Barbell Plate Calculator</span>
                    <span className="text-[9px] font-mono text-[#9991b8] uppercase tracking-wider">Dynamic Sleeve Loading</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlateCalculator(false)}
                  className="text-[#9991b8] hover:text-white p-1.5 bg-[#161424] rounded-lg cursor-pointer active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Interactive Work Area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 pb-10">
                
                {/* visual barbell component block */}
                <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 flex flex-col items-center justify-start gap-4 relative overflow-hidden min-h-[250px] shrink-0">
                  {/* Total Weight Counter */}
                  <div className="text-center">
                    <span className="font-bebas text-4xl text-[#f0c972] tracking-wider block font-bold">
                      {userState.useLb ? (getCalculatorTotal() * 2.20462).toFixed(1) : getCalculatorTotal().toFixed(1)}
                      <span className="text-lg font-mono text-gray-400 ml-1.5">{userState.useLb ? "lb" : "kg"}</span>
                    </span>
                    <span className="font-mono text-[9px] text-[#9991b8] uppercase tracking-widest mt-0.5 block">
                      {calculatorBarWeight === 0 ? "Single Stack total" : `Symmetric barbell (${userState.useLb ? Math.round(calculatorBarWeight * 2.20462) : calculatorBarWeight}${userState.useLb ? "lb" : "kg"} Bar + both sleeves loaded)`}
                    </span>
                  </div>

                  {/* Visual Barbell representation with stacked plates */}
                  <div className="w-full flex items-center justify-center h-24 shrink-0 relative mt-4 mb-4">
                    
                    {/* If there is a bar */}
                    {calculatorBarWeight > 0 ? (
                      <>
                        {/* The Barbell sleeve shaft bar */}
                        <div className="absolute top-1/2 -translate-y-1/2 h-2 w-full bg-gradient-to-r from-[#221d35] via-[#a49bcb] to-[#221d35] rounded-full border border-[#2a2440]" />
                        
                        {/* Sleeve Collars */}
                        <div className="absolute left-[30%] top-1/2 -translate-y-1/2 h-12 w-3 bg-[#a49bcb] border border-y-gray-900 border-x-gray-500 z-10 rounded shadow-sm" />
                        <div className="absolute right-[30%] top-1/2 -translate-y-1/2 h-12 w-3 bg-[#a49bcb] border border-y-gray-900 border-x-gray-500 z-10 rounded shadow-sm" />
                        
                        {/* Center shaft portion */}
                        <div className="absolute left-[31%] right-[31%] top-1/2 -translate-y-1/2 h-3 bg-gradient-to-b from-gray-700 to-gray-500 border-y border-gray-950" />

                        {/* Left Sleeve Loaded Plates (rendered outer-to-inner, mirroring right side) */}
                        <div className="absolute right-[71%] top-0 bottom-0 flex flex-row-reverse items-center z-20 pr-0.5 select-none">
                          {calculatorPlates.map((plateWeight, idx) => {
                            const plateStyle = getPlateStyle(plateWeight);
                            return (
                              <div
                                key={`left-${idx}`}
                                onClick={() => setCalculatorPlates(prev => prev.filter((_, i) => i !== idx))}
                                title="Tap to remove plate"
                                className={`rounded-[4px] border border-black/50 mx-[1.5px] relative flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-lg ${plateStyle.color}`}
                                style={{
                                  height: `${plateStyle.height}px`,
                                  width: `${plateStyle.width}px`,
                                }}
                              >
                                <span className="text-[7.5px] font-mono font-bold leading-none tracking-tighter rotate-90 origin-center select-none whitespace-nowrap">
                                  {userState.useLb ? (plateWeight * 2.20462).toFixed(1) : plateWeight}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Right Sleeve Loaded Plates */}
                        <div className="absolute left-[71%] top-0 bottom-0 flex flex-row items-center z-20 pl-0.5 select-none">
                          {calculatorPlates.map((plateWeight, idx) => {
                            const plateStyle = getPlateStyle(plateWeight);
                            return (
                              <div
                                key={`right-${idx}`}
                                onClick={() => setCalculatorPlates(prev => prev.filter((_, i) => i !== idx))}
                                title="Tap to remove plate"
                                className={`rounded-[4px] border border-black/50 mx-[1.5px] relative flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-lg ${plateStyle.color}`}
                                style={{
                                  height: `${plateStyle.height}px`,
                                  width: `${plateStyle.width}px`,
                                }}
                              >
                                <span className="text-[7.5px] font-mono font-bold leading-none tracking-tighter rotate-90 origin-center select-none whitespace-nowrap">
                                  {userState.useLb ? (plateWeight * 2.20462).toFixed(1) : plateWeight}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      /* No bar state: single centered block / stack of plates */
                      <div className="absolute inset-0 flex items-center justify-center font-sans">
                        <div className="absolute h-2 w-48 bg-gradient-to-r from-gray-700 to-gray-500 rounded-full" />
                        <div className="relative flex flex-row items-center z-20">
                          {calculatorPlates.length === 0 ? (
                            <span className="font-mono text-[10px] text-gray-500 italic">No plates added</span>
                          ) : (
                            calculatorPlates.map((plateWeight, idx) => {
                              const plateStyle = getPlateStyle(plateWeight);
                              return (
                                <div
                                  key={`nobar-${idx}`}
                                  onClick={() => setCalculatorPlates(prev => prev.filter((_, i) => i !== idx))}
                                  title="Tap to remove plate"
                                  className={`rounded-[4px] border border-black/50 mx-[1.5px] relative flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-lg ${plateStyle.color}`}
                                  style={{
                                    height: `${plateStyle.height}px`,
                                    width: `${plateStyle.width}px`,
                                  }}
                                >
                                  <span className="text-[7.5px] font-mono font-bold leading-none tracking-tighter rotate-90 origin-center select-none whitespace-nowrap">
                                    {userState.useLb ? (plateWeight * 2.20462).toFixed(1) : plateWeight}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Clear controls */}
                  <div className="flex gap-2.5 w-full border-t border-[#221d35] pt-4 mt-4 z-10 shrink-0 select-none">
                    <button
                      onClick={() => setCalculatorPlates([])}
                      className="flex-1 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-400 rounded-xl py-2 font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer text-center active:scale-95 transition-all"
                    >
                      Clear All Plates
                    </button>
                    <button
                      disabled={calculatorPlates.length === 0}
                      onClick={() => setCalculatorPlates(prev => prev.slice(0, -1))}
                      className="flex-1 bg-[#1c182d] hover:bg-[#221d35] border border-[#2a2440] text-gray-400 hover:text-white rounded-xl py-2 font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer text-center active:scale-95 transition-all disabled:opacity-40"
                    >
                      Undo last plate
                    </button>
                  </div>
                  
                  <span className="font-mono text-[8px] text-gray-600 uppercase tracking-wide mt-1 block">
                    💡 Click any plate on bar sleeve to specific-delete it!
                  </span>
                </div>

                {/* 1. Bar Select Category with Scrollbar support */}
                <div className="flex flex-col gap-2 font-sans">
                  <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest block font-bold leading-none">
                    🍺 Select Barbell / Handle
                  </span>
                  {/* Horizontal scrollbar block */}
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x select-none">
                    {[
                      { id: "Standard Bar", weight: 20, subtitle: "Olympic sleeve" },
                      { id: "Short Bar", weight: 15, subtitle: "Studio straight" },
                      { id: "EZ Curls Bar", weight: 10, subtitle: "Angled grip" },
                      { id: "No barbell", weight: 0, subtitle: "Direct add" }
                    ].map((barItem) => {
                      const isSelected = calculatorBarWeight === barItem.weight;
                      const convertedBarWeight = userState.useLb ? barItem.weight * 2.20462 : barItem.weight;
                      return (
                        <button
                          key={barItem.id}
                          onClick={() => setCalculatorBarWeight(barItem.weight)}
                          className={`px-4.5 py-3 rounded-xl border font-mono shrink-0 transition-all text-left flex flex-col snap-start min-w-[130px] gap-1 cursor-pointer active:scale-95 ${
                            isSelected
                              ? "bg-[#f0c972] border-[#f0c972] text-[#0d0b14]"
                              : "bg-[#13111f] border border-[#2a2440] text-gray-400 hover:border-gray-500"
                          }`}
                        >
                          <span className="font-bold text-xs">{barItem.id}</span>
                          <span className={`text-[9.5px] ${isSelected ? "text-[#0d0b14]/80" : "text-gray-500"}`}>
                            {convertedBarWeight.toFixed(1)} {userState.useLb ? "lb" : "kg"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Plates Add Category with Horizontal scrollbar and Custom + Button */}
                <div className="flex flex-col gap-2 font-sans">
                  <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest block font-bold leading-none">
                    🥞 Add Weight Plates (Australian standard sizes)
                  </span>
                  {/* Horizontal scrollbar block */}
                  <div className="flex gap-3 overflow-x-auto pb-2.5 scrollbar-none snap-x select-none items-stretch">
                    {availablePlates.map((plateKg) => {
                      const plateStyle = getPlateStyle(plateKg);
                      const convertedPlateWeight = userState.useLb ? plateKg * 2.20462 : plateKg;
                      return (
                        <button
                          key={plateKg}
                          onClick={() => setCalculatorPlates(prev => [...prev, plateKg].sort((a, b) => b - a))}
                          className="px-4.5 py-3.5 rounded-xl bg-[#13111f] border border-[#2a2440] hover:border-[#f0c972] font-mono shrink-0 transition-all text-center flex flex-col items-center justify-center gap-2 snap-start min-w-[85px] active:scale-95 cursor-pointer"
                        >
                          {/* Miniature representations inside bubble */}
                          <div className={`w-4 h-4 rounded-full border border-black/30 ${plateStyle.color}`} />
                          <span className="font-bold text-xs text-white">
                            {convertedPlateWeight.toFixed(1)}
                            <span className="text-[9.5px] block font-medium opacity-70 mt-0.5">{userState.useLb ? "lb" : "kg"}</span>
                          </span>
                        </button>
                      );
                    })}
                    
                    {/* Custom Plus Button at end of scrollbar row */}
                    <button
                      onClick={() => {
                        const inputStr = prompt(`Enter custom plate weight in ${userState.useLb ? "pounds (lb)" : "kilograms (kg)"}:`);
                        if (inputStr) {
                          const val = parseFloat(inputStr);
                          if (val > 0) {
                            const kgVal = userState.useLb ? val / 2.20462 : val;
                            // Append rounded to 2 decimals
                            setAvailablePlates(prev => [...prev, Math.round(kgVal * 100) / 100]);
                          }
                        }
                      }}
                      className="px-4.5 py-3.5 rounded-xl bg-[#1e1a30] border-2 border-dashed border-[#2d2459] hover:border-[#f0c972] text-[#f0c972] hover:text-white font-mono shrink-0 transition-all text-center flex flex-col items-center justify-center gap-2.5 snap-start min-w-[85px] cursor-pointer active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-bold text-[10px] uppercase tracking-wider">Custom</span>
                    </button>
                  </div>
                </div>

                {/* 3. Action Apply button */}
                <button
                  onClick={() => {
                    if (!activeWorkout || !activeInput) return;
                    const { exIdx, setIdx } = activeInput;
                    const totalKgVal = getCalculatorTotal();
                    
                    // Format to 1 decimal place matching input expectations
                    const displayVal = userState.useLb
                      ? (totalKgVal * 2.20462).toFixed(1)
                      : totalKgVal.toFixed(1);

                    handleUpdateActiveSetField(exIdx, setIdx, "weight", displayVal);
                    setShowPlateCalculator(false);
                  }}
                  className="w-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bebas text-lg tracking-wider py-4 mt-2.5 rounded-2xl active:scale-95 transition-all shadow-lg text-center cursor-pointer shrink-0"
                >
                  APPLY CALCULATED WEIGHT  ✓
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -------------------- EXERCISE CHOOSER SHEET MODAL (Img 4) -------------------- */}
        {showAddExChooser && (
          <div className="fixed inset-0 bg-[#0d0b14] z-50 flex flex-col p-4 text-left">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[#221d35] mb-4 select-none">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-[#f0c972]" />
                <div>
                  <div className="flex items-center">
                    <span className="font-bebas text-lg text-white block tracking-wider">Choose Exercise</span>
                    {isLoadingDb ? (
                      <span className="text-[7.5px] font-mono text-[#f0c972] bg-[#f0c972]/10 border border-[#f0c972]/20 px-1.5 py-0.5 rounded-full animate-pulse ml-2.5">
                        🔄 Syncing 800+ Exercises...
                      </span>
                    ) : dbLoadError ? (
                      <span className="text-[7.5px] font-mono text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-full ml-2.5">
                        ⚠️ Offline Fallback Active
                      </span>
                    ) : (
                      <span className="text-[7.5px] font-mono text-[#6fcf97] bg-[#6fcf97]/10 border border-[#6fcf97]/20 px-1.5 py-0.5 rounded-full ml-2.5">
                        ✓ 800+ FreeExerciseDB Active
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-[#9991b8] uppercase tracking-wider">Select exercise to add</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddExChooser(false);
                  setExChooserSearch("");
                }}
                className="text-[#9991b8] hover:text-white p-1.5 bg-[#161424] rounded-lg cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar with Slider Icon */}
            <div className="relative mb-3.5 text-left shrink-0">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search exercise..."
                value={exChooserSearch}
                onChange={(e) => setExChooserSearch(e.target.value)}
                className="w-full bg-[#13111f] border border-[#2a2440] rounded-xl pl-10 pr-12 py-3 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-[#f0c972]"
              />
              <div className="absolute right-3.5 top-2.5 bg-[#1c182d] p-1.5 rounded-lg border border-[#2a2440] text-gray-500 hover:text-white cursor-pointer select-none">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
            </div>

            {/* Sort Filters Tabs */}
            <div className="grid grid-cols-4 gap-2 mb-4 select-none shrink-0">
              {[
                { id: "alphabetical", label: "A-Z" },
                { id: "rank", label: "Rank" },
                { id: "performed", label: "History" },
                { id: "muscle", label: "Muscle" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setExChooserTab(tab.id as any);
                    if (tab.id === "muscle" && selectedMuscleFilter === "All") {
                      setSelectedMuscleFilter("Chest");
                    }
                  }}
                  className={`py-2 text-[10.5px] font-mono font-bold rounded-xl transition-all border text-center ${
                    exChooserTab === tab.id
                      ? "bg-[#f0c972] border-[#f0c972] text-[#0d0b14]"
                      : "bg-[#13111f] border-[#2a2440] text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Muscle Horizontal Chips if Muscle Tab Checked */}
            {exChooserTab === "muscle" && (
              <div className="flex gap-2 overflow-x-auto pb-3 mb-1 shrink-0 scrollbar-none">
                {["All", "Chest", "Back", "Legs", "Arms", "Shoulders", "Core", "Cardio", "Other"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMuscleFilter(m)}
                    className={`px-3 py-1.5 rounded-full font-mono text-[9px] font-bold border shrink-0 transition-all ${
                      selectedMuscleFilter === m
                        ? "bg-[#4285F4] border-[#4285F4] text-white"
                        : "bg-[#1c182d] border-[#221d35] text-gray-400 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* Exercises Dynamic List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-none pb-12">
              {sortedExercisesForChooser.length === 0 ? (
                <div className="py-16 text-center text-xs font-mono text-gray-500">
                  No matching exercises found in this category.
                </div>
              ) : (
                sortedExercisesForChooser.map((ex) => {
                  const hasDone = (userState.exerciseHistory[ex.name]?.length || 0) > 0;
                  return (
                    <div
                      key={ex.name}
                      onClick={() => handleAddSelectedExerciseToWorkout(ex)}
                      className="bg-[#13111f] hover:bg-[#1a172c] border border-[#2a2440] p-3 rounded-xl flex gap-3.5 items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={ex.image}
                          alt={ex.name}
                          className="w-11 h-11 rounded-lg object-cover border border-[#221d35] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-left min-w-0">
                          <span className="font-mono text-xs font-bold text-white block truncate leading-snug">
                            {ex.name}
                          </span>
                          <span className="font-mono text-[9.5px] text-[#9991b8] leading-none block mt-1">
                            {ex.muscle} {hasDone && "• Completed Best done"}
                          </span>
                        </div>
                      </div>

                      {/* Rank Indicator Badge */}
                      <div className="shrink-0 flex items-center gap-1 bg-[#1a162e] border border-[#2d2459] px-2 py-1.5 rounded-lg">
                        <span className="font-mono text-[9px] font-bold text-[#f0c972]">#{ex.rank}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* -------------------- ROUTINE SPLIT SELECTION LOADER SCREEN -------------------- */}
        {showAddRoutineModal && (
          <div className="fixed inset-0 bg-[#0d0b14] z-50 flex flex-col p-4 text-left">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[#221d35] mb-4">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-[#f0c972]" />
                <div>
                  <span className="font-bebas text-lg text-white block tracking-wider">Load Routine template</span>
                  <span className="text-[9px] font-mono text-[#9991b8] uppercase tracking-wider">Choose a routine to load</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddRoutineModal(false)}
                className="text-[#9991b8] hover:text-white p-1.5 bg-[#161424] rounded-lg cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Templates search area */}
            <div className="flex-1 overflow-y-auto space-y-3.5 scrollbar-none pb-12">
              {userState.routines.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-2.5">
                  <span className="text-2xl">📁</span>
                  <span className="font-mono text-xs text-gray-500">No stored routine splits found structure.</span>
                  <button
                    onClick={() => {
                      setShowAddRoutineModal(false);
                      handleOpenRoutineModal(null);
                    }}
                    className="font-mono text-[10.5px] text-[#4285F4] underline hover:text-white mt-1"
                  >
                    Click to design a routine split template first
                  </button>
                </div>
              ) : (
                userState.routines.map((routineTemplate) => (
                  <div
                    key={routineTemplate.id}
                    onClick={() => handleLoadRoutineIntoWorkout(routineTemplate)}
                    className="bg-[#13111f] hover:bg-[#1a172c] border border-[#2a2440] p-4 rounded-xl flex flex-col gap-1 cursor-pointer transition-colors"
                  >
                    <span className="font-mono text-sm font-bold text-white block">
                      {routineTemplate.name}
                    </span>
                    <span className="font-mono text-[10px] text-gray-500 block truncate">
                      💪 {routineTemplate.exercises.map(e => e.name).join(", ") || "No predefined exercises"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // SECTION 3: DEFAULT LIFT LISTING SCREEN
  return (
    <div className="w-full max-w-md mx-auto py-5 px-4 pb-28 flex flex-col gap-5 text-left">
      {/* Elegantly styled header replacement for the global tab */}
      <div className="flex justify-between items-center pb-2.5 border-b border-[#221d35] mb-2 z-10 select-none">
        <div>
          <span className="font-bebas text-2xl text-white tracking-widest block">LIFT BOARD</span>
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mt-1">Physical Conditioning & Growth</span>
        </div>
        <div
          onClick={onToggleLb}
          className="bg-[#13111f] border border-[#2a2440] hover:border-[#f0c972] rounded-xl px-3 py-1.5 cursor-pointer transition-all active:scale-95 text-[#a49bcb] hover:text-white font-mono text-[9.5px] font-bold uppercase tracking-wider"
        >
          ⚖️ {userState.useLb ? "LB" : "KG"}
        </div>
      </div>

      {/* 2. TODAY'S WORKOUT SECTION (Daily auto-generated AI workout, img-1 style) */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-bebas text-2xl tracking-wide text-white">Today's Workout</span>
            <button
              onClick={() => setShowAiHelpModal(true)}
              className="text-[#6b6485] hover:text-[#f0c972] transition-colors"
              title="About Daily AI Workout"
            >
              <Info className="w-4.5 h-4.5" />
            </button>
          </div>
          {aiGenerating && (
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-[#f0c972]">
              <div className="w-3 h-3 border border-[#f0c972] border-t-transparent rounded-full animate-spin" />
              <span>AI Analysing...</span>
            </div>
          )}
        </div>

        {userState.aiDailyWorkout ? (
          <div className="bg-gradient-to-r from-[#173a5a] to-[#12283a] border border-[#50b5ff33] rounded-2xl p-4.5 flex justify-between items-center shadow-md relative overflow-hidden">
            {/* Inner aesthetic graphic decor */}
            <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-end pr-4 pointer-events-none">
              <Sparkles className="w-24 h-24 text-white" />
            </div>

            <div className="flex items-center gap-3.5 min-w-0 z-10">
              <img
                src={findExIllustration(userState.aiDailyWorkout.exercises[0]?.name || "Bench Press")}
                alt="AI Workout"
                className="w-14 h-14 rounded-full object-cover border border-[#50b5ff44]"
              />
              <div className="text-left min-w-0">
                <span className="font-bebas text-xl text-white tracking-widest block truncate">
                  {userState.aiDailyWorkout.name}
                </span>
                <span className="font-mono text-[10px] text-[#50b5ff] block font-medium mt-1">
                  🎯 {userState.aiDailyWorkout.setsCount || 15} Sets • {userState.aiDailyWorkout.durationMins || 60}m split
                </span>
              </div>
            </div>

            <button
              onClick={() => handleStartRoutineSession({
                id: "ai-daily",
                name: userState.aiDailyWorkout?.name || "AI Suggested split",
                exercises: userState.aiDailyWorkout?.exercises || []
              })}
              className="bg-white hover:bg-[#eae8f0] text-slate-900 font-bebas text-xs font-bold tracking-widest pl-4.5 pr-3 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform shrink-0 shadow z-10 cursor-pointer"
            >
              START ▶
            </button>
          </div>
        ) : (
          <div className="bg-[#13111f] border border-dashed border-[#2a2440] p-6 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
            <span className="text-2xl animate-pulse">⚡</span>
            <span className="font-mono text-xs text-slate-400 font-semibold uppercase">Building Today's Program</span>
            <span className="font-mono text-[9px] text-[#6b6485] max-w-[240px]">Analyzing past workouts in the calendar and preparing your next custom routine...</span>
          </div>
        )}
      </div>

      {/* 3. NEW WORKOUT SECTION (img-1 style) */}
      <div className="flex flex-col gap-2.5">
        <span className="font-bebas text-2xl tracking-wide text-white">New Workout</span>
        
        <div className="grid grid-cols-1 gap-3.5">
          {/* Start empty card */}
          <button
            onClick={handleStartEmptyWorkout}
            className="bg-[#13111f] hover:border-[#4285F4] border border-[#2a2440] rounded-2xl p-4 flex gap-4 justify-between items-center transition-all cursor-pointer text-left focus:outline-none"
          >
            <div className="min-w-0">
              <span className="font-bebas text-lg text-white block tracking-widest">Start Empty Workout</span>
              <span className="font-mono text-[9px] text-[#6b6485] block mt-1">Quick lifting pad with manual exercise picks</span>
            </div>
            <div className="w-10 h-10 bg-[#162a45] rounded-xl flex items-center justify-center text-[#4285F4] shrink-0 rotate-12">
              <Dumbbell className="w-5 h-5" />
            </div>
          </button>

          {/* AI Generator button */}
          <button
            onClick={handleManualRegenerate}
            disabled={aiGenerating}
            className="bg-[#13111f] hover:border-[#fbcfe8] border border-[#2a2440] rounded-2xl p-4 flex gap-4 justify-between items-center transition-all cursor-pointer text-left focus:outline-none disabled:opacity-50"
          >
            <div className="min-w-0">
              <span className="font-bebas text-lg text-white block tracking-widest">Generate Workout</span>
              <span className="font-mono text-[9px] text-[#6b6485] block mt-1">Regenerate on-demand based on current split lacking analysis</span>
            </div>
            <div className="w-10 h-10 bg-[#3a1d30] rounded-xl flex items-center justify-center text-[#fbcfe8] shrink-0">
              <Sparkles className="w-5 h-5 text-pink-300" />
            </div>
          </button>
        </div>
      </div>

      {/* 4. ROUTINES ACCORDION FOLDERS (img-1, img-2 style) */}
      <div className="flex flex-col gap-3">
        {/* Accordion List Header */}
        <div className="flex justify-between items-center">
          <span className="font-bebas text-2xl tracking-wide text-white">Routines</span>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowAddFolderModal(true)}
              className="text-[#6b6485] hover:text-[#f0c972] transition-all p-1 cursor-pointer"
              title="Create customize folder"
            >
              <FolderPlus className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleOpenRoutineModal(null)}
              className="text-[#6b6485] hover:text-white transition-all p-1 cursor-pointer"
              title="Create new routine split"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Folders Accordion rendering */}
        <div className="space-y-3">
          {foldersToRender.map((folder) => {
            const routinesInFolder = userState.routines.filter(r => r.folderId === folder.id || (folder.id === "folder-3" && !r.folderId));
            const isFolderOpen = !!expandedFolders[folder.id];

            return (
              <div key={folder.id} className="bg-[#13111f] border border-[#2a2440] rounded-2xl overflow-hidden shadow">
                {/* Accordion header panel */}
                <div
                  onClick={() => setExpandedFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                  className="flex justify-between items-center px-4.5 py-4 cursor-pointer select-none bg-[#161424] hover:bg-[#1a172c] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-[#f0c972] fill-[#f0c972]/10" />
                    <span className="font-mono text-xs text-[#e8e3f8] font-bold">
                      {folder.name} ({routinesInFolder.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Delete folder button (disabled for default "folder-3") */}
                    {folder.id !== "folder-3" && (
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="text-[#3d3657] hover:text-red-400 p-1 cursor-pointer transition-colors"
                        title="Delete empty folder"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-[#6b6485] p-1">
                      {isFolderOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Expanded list of routine splits */}
                {isFolderOpen && (
                  <div className="p-4 space-y-4 bg-[#13111f] border-t border-[#1e1a30]">
                    {routinesInFolder.length === 0 ? (
                      <div className="py-6 text-center text-[10px] font-mono text-gray-500">
                        Folder is empty. Create routines inside!
                      </div>
                    ) : (
                      routinesInFolder.map((r) => {
                        const totalWorkoutSets = r.exercises.length * 3; // Estimate

                        return (
                          <div key={r.id} className="bg-[#191629] border border-[#241f3d] rounded-xl p-4 flex flex-col gap-3 relative shadow-sm">
                            {/* Card action triggers */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="text-left">
                                <span className="font-mono text-xs font-extrabold text-white block">
                                  {r.name}
                                </span>
                                <span className="text-[9px] font-mono text-gray-500 block uppercase tracking-wider mt-0.5">
                                  {r.exercises.length} Exercises • {totalWorkoutSets} Sets
                                </span>
                              </div>

                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleOpenRoutineModal(r)}
                                  className="text-[9px] font-mono border border-[#30294f] text-[#a49bcb] px-2 py-1 rounded-lg hover:border-[#f0c972] hover:text-[#f0c972] transition-all"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete routine permanent "${r.name}"?`)) onDeleteRoutine(r.id);
                                  }}
                                  className="text-gray-600 hover:text-red-400 border border-[#30294f] rounded-lg p-1 transition-all"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Exercises tags detailing circular image icons & names */}
                            <div className="flex flex-col gap-2 mt-1 border-t border-[#221d3b]/50 pt-2.5">
                              {r.exercises.slice(0, 3).map((ex) => {
                                const thumb = findExIllustration(ex.name);
                                return (
                                  <div key={ex.id} className="flex items-center gap-2.5">
                                    <img
                                      src={thumb}
                                      alt={ex.name}
                                      className="w-5 h-5 rounded-full object-cover border border-[#221d3b]"
                                    />
                                    <span className="font-mono text-[10.5px] text-gray-300">
                                      {ex.name}
                                    </span>
                                  </div>
                                );
                              })}
                              {r.exercises.length > 3 && (
                                <span className="font-mono text-[9px] text-[#6b6485] ml-7 italic">
                                  and {r.exercises.length - 3} more...
                                </span>
                              )}
                            </div>

                            {/* Action Start trigger */}
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => handleStartRoutineSession(r)}
                                className="bg-[#4285F4] hover:bg-[#3474d4] text-[#fff] font-mono text-[10px] font-bold px-4 py-2 rounded-lg cursor-pointer transition-all active:scale-95 text-center shrink-0 uppercase"
                              >
                                START
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. PROGRESSIVE OVERLOAD GRAPH SECTIONS */}
      {loggedExercises.length > 0 && (
        <div className="flex flex-col gap-3.5 mt-2">
          <span className="font-bebas text-2xl tracking-wide text-white">Progressive Overload Tracking</span>
          
          <div className="space-y-3">
            {loggedExercises.slice(0, 4).map(name => {
              const hist = userState.exerciseHistory[name] || [];
              const chartData = hist.map((log, listId) => ({
                idx: listId + 1,
                weight: userState.useLb ? parseFloat((log.weight * 2.20462).toFixed(1)) : log.weight,
                date: log.date
              }));
              const maxLift = hist.length > 0 ? Math.max(...hist.map(h => h.weight)) : 0;

              return (
                <div key={name} className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-4.5 flex flex-col gap-2 shadow">
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <span className="font-mono text-xs text-white block">{name}</span>
                      <span className="font-mono text-[9px] text-gray-500 block uppercase mt-0.5">
                        {hist.length} Lifting Log sessions logged
                      </span>
                    </div>

                    <div className="font-mono text-xs text-[#f0c972]">
                      <span className="text-[10px] text-gray-500">Peak: </span>
                      <span className="font-bold">{dispWeight(maxLift)}</span>
                    </div>
                  </div>

                  {hist.length < 2 ? (
                    <span className="font-mono text-[9px] text-[#554d7e] mt-2 block italic text-center">
                      Trace progresive adaptations over 2 consecutive cycles.
                    </span>
                  ) : (
                    <div className="h-28 w-full mt-2.5">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid stroke="#1c182d" strokeDasharray="3 3" />
                          <XAxis dataKey="date" stroke="#6b6485" fontSize={8} tickLine={false} />
                          <YAxis stroke="#6b6485" fontSize={8} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#13111f", borderColor: "#2a2440", color: "#e8e3f8" }}
                            labelStyle={{ fontSize: 9, fontFamily: "monospace" }}
                            itemStyle={{ fontSize: 9, fontFamily: "monospace", color: "#f0c972" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="weight"
                            stroke="#f0c972"
                            strokeWidth={2}
                            activeDot={{ r: 4 }}
                            dot={{ r: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL SECTION A: ADD FOLDER DIALOG */}
      {showAddFolderModal && (
        <div className="fixed inset-0 bg-[#0c0a15cc] z-50 flex items-center justify-center p-4">
          <div className="bg-[#13111f] border border-[#2a2440] p-6 rounded-3xl w-full max-w-sm flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div>
              <span className="font-bebas text-2xl text-[#f0c972] tracking-wider block">Create Split Folder</span>
              <span className="font-mono text-[8px] text-[#6b6485] uppercase block mt-1">
                Customize folders for logical routine classification
              </span>
            </div>

            <input
              type="text"
              placeholder="Folder Name (e.g. Legs Focus Split)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-[#1b172c] border border-[#2d2459] rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-[#554d7e] focus:outline-none focus:border-[#f0c972]"
            />

            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              <button
                onClick={() => {
                  setShowAddFolderModal(false);
                  setNewFolderName("");
                }}
                className="bg-[#1b172c] text-gray-400 py-3 rounded-xl hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] py-3 rounded-xl font-bold"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SECTION B: CREATE / EDIT ROUTINE SPLIT DIALOG (Requirement 4 image picker) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[#0c0a15ee] z-50 flex items-end justify-center">
          <div className="bg-[#13111f] border-t border-[#2a2440] rounded-t-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <div>
              <span className="font-bebas text-2xl text-[#f0c972] tracking-wider block">
                {editingRoutine ? "Edit Routine Split" : "Create New Routine Split"}
              </span>
              <span className="font-mono text-[8px] text-gray-500 uppercase mt-0.5">
                Organize exercises with accompanying illustrative images
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Routine Split Name */}
              <div className="space-y-1.5 text-left">
                <span className="font-mono text-[9px] text-[#6b6485] uppercase">Routine Split Name</span>
                <input
                  type="text"
                  placeholder="e.g. Day 2 - Back & Biceps"
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  className="w-full bg-[#1b172c] border border-[#2d2459] rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-[#f0c972]"
                />
              </div>

              {/* Folder Assignment Selector */}
              <div className="space-y-1.5 text-left">
                <span className="font-mono text-[9px] text-[#6b6485] uppercase">Assign to Folder</span>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full bg-[#1b172c] border border-[#2d2459] rounded-xl px-3 py-3 text-xs font-mono text-white focus:outline-none"
                >
                  {foldersToRender.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* List of current exercises added inside builder modal */}
              <div className="space-y-1.5 text-left">
                <span className="font-mono text-[9px] text-[#6b6485] uppercase">Exercises in Split ({modalExercises.length})</span>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {modalExercises.length === 0 ? (
                    <span className="font-mono text-[10px] text-[#554d7e] italic block py-2.5 text-center">
                      Add exercises from the accompanying database selection panel below.
                    </span>
                  ) : (
                    modalExercises.map((mEx, idx) => {
                      const exImg = findExIllustration(mEx.name);

                      return (
                        <div key={idx} className="bg-[#1b172c] border border-[#221d3c] rounded-xl p-3 flex gap-3 h-20 items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={exImg}
                              alt={mEx.name}
                              className="w-10 h-10 rounded-full object-cover border border-[#2a2440] shrink-0"
                            />
                            <div className="text-left min-w-0">
                              <span className="font-mono text-xs text-white block truncate leading-snug">{mEx.name}</span>
                              <input
                                type="text"
                                value={mEx.notes || ""}
                                placeholder="notes (e.g. 3 x 8-12 reps)"
                                onChange={(e) => {
                                  const copy = [...modalExercises];
                                  copy[idx].notes = e.target.value;
                                  setModalExercises(copy);
                                }}
                                className="bg-[#13111f] border border-[#2a2440] rounded-lg px-2 py-1 font-mono text-[9px] text-gray-300 block mt-1 w-[160px] sm:w-[200px]"
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => setModalExercises(prev => prev.filter((_, i) => i !== idx))}
                            className="text-gray-500 hover:text-red-400 p-1 active:scale-95 transition-all text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Search Predefined accompanying exercises database panel (Requirement 4) */}
              <div className="space-y-2 border-t border-[#221d3c] pt-4 text-left select-none">
                <div className="flex items-center justify-between">
                  <span className="font-bebas text-lg text-[#f0c972] tracking-wider block">Accompanying Exercises Database</span>
                  <span className="font-mono text-[8.5px] text-[#6fcf97] bg-[#6fcf97]/10 border border-[#6fcf97]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    FreeExerciseDB
                  </span>
                </div>
                
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-3.5 text-[#554d7e]" />
                  <input
                    type="text"
                    placeholder="Search loaded database exercises..."
                    value={searchExerciseQuery}
                    onChange={(e) => setSearchExerciseQuery(e.target.value)}
                    className="w-full bg-[#1b172c] border border-[#2d2459] rounded-xl pl-9 pr-4 py-3.5 text-xs font-mono text-white placeholder-[#554d7e] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto mt-2 select-none">
                  {filteredExercises.map((dbEx, dbExIdx) => (
                    <div
                      key={dbExIdx}
                      onClick={() => handleAddExerciseToRoutine(dbEx)}
                      className="bg-[#1b172c] hover:border-[#f0c972]/50 border border-[#221d3c] hover:bg-[#1f1a33] p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={dbEx.image}
                          alt={dbEx.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#2a2440] shrink-0"
                        />
                        <div className="text-left min-w-0">
                          <span className="font-mono text-xs text-white block truncate font-bold leading-tight">{dbEx.name}</span>
                          <span className="font-mono text-[8.5px] text-[#9991b8] block leading-none mt-0.5 uppercase tracking-wide">
                            {dbEx.muscle} group
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-[#6b6485] font-semibold pr-2">📋 Rank {dbEx.rank}</span>
                        <div className="w-6 h-6 rounded-full bg-[#f0c972] text-[#0d0b14] flex items-center justify-center font-bold text-xs">
                          +
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action operations controls */}
              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs mt-3.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-[#1b172c] border border-[#221d3c] text-gray-400 py-3.5 rounded-2xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoutineSession}
                  className="bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] py-3.5 rounded-2xl font-bold"
                >
                  Save Split
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* AI INSTRUCTION DETAILS MODAL */}
      {showAiHelpModal && (
        <div className="fixed inset-0 bg-[#0c0a15cc] z-50 flex items-center justify-center p-4">
          <div className="bg-[#13111f] border border-[#2a2440] p-6 rounded-3xl w-full max-w-sm flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-center items-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#f0c972] to-[#e07b3f] flex items-center justify-center text-xl shadow">
              🤖
            </div>

            <div className="text-center">
              <span className="font-bebas text-2xl text-white tracking-widest block">AI Daily Workout Auto-Programmer</span>
              <p className="font-mono text-[10.5px] text-[#c3b6dc] leading-relaxed mt-2.5 uppercase tracking-wider text-left max-w-xs border border-[#221d3c] bg-[#1c1830] p-4.5 rounded-2xl">
                • Automatically recalculates at 12:00 AM daily.<br />
                • Scrapes the calendar to check your last 7 days of completed physical exercises.<br />
                • Maps muscle group volume patterns to discover under-worked regions.<br />
                • Generates a highly personalized, targeted weightlifting program to optimize progressive hypertrophy.
              </p>
            </div>

            <button
              onClick={() => setShowAiHelpModal(false)}
              className="w-full bg-[#1c1830] hover:bg-[#201c3d] border border-[#30295c] hover:border-[#f0c972] text-[#f0c972] font-mono text-xs py-3 rounded-xl transition-colors cursor-pointer"
            >
              Understand & Dismiss Box
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
