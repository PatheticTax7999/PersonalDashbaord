import { useState, useEffect } from "react";
import { UserState, ActiveWorkout, Routine, Exercise } from "../types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "motion/react";

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
  onSaveRoutine: (id: string | null, name: string, exercises: Exercise[]) => void;
  onDeleteRoutine: (id: string) => void;
  onToggleLb: () => void;
  onUpdateActiveWorkout: (workout: ActiveWorkout | null) => void;
}

export default function FitnessTab({
  userState,
  activeWorkout,
  onStartWorkout,
  onFinishWorkout,
  onCancelWorkout,
  onSaveRoutine,
  onDeleteRoutine,
  onToggleLb,
  onUpdateActiveWorkout
}: FitnessTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [modalExercises, setModalExercises] = useState<Exercise[]>([]);
  const [newExName, setNewExName] = useState("");
  const [forceUpdate, setForceUpdate] = useState(0);

  // Interval Rest Timer states
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);

  // Monitor rest countdown
  useEffect(() => {
    let interval: any = null;
    if (isResting && restSeconds !== null && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds(p => {
          if (p !== null && p <= 1) {
            setIsResting(false);
            // Dynamic device support vibration if possible
            try {
              if ("vibrate" in navigator) {
                navigator.vibrate([200, 100, 200]);
              }
            } catch (e) {}
            return 0;
          }
          return p !== null ? p - 1 : null;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isResting, restSeconds]);

  const handleToggleActiveUnit = () => {
    const wasLb = userState.useLb;
    onToggleLb();
    if (activeWorkout) {
      const updatedWorkout = { ...activeWorkout };
      updatedWorkout.sets = updatedWorkout.sets.map(exSets =>
        exSets.map(set => {
          const val = parseFloat(set.weight);
          if (!isNaN(val) && val > 0) {
            const convertedVal = wasLb ? (val / 2.20462) : (val * 2.20462);
            const formatted = convertedVal.toFixed(1);
            return {
              ...set,
              weight: formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted
            };
          }
          return set;
        })
      );
      onUpdateActiveWorkout(updatedWorkout);
      setForceUpdate(p => p + 1);
    }
  };

  const [expandedGraph, setExpandedGraph] = useState<string | null>(null);

  // Active workout session timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  // Routine Modal Control
  const handleOpenRoutineModal = (r: Routine | null) => {
    setEditingRoutine(r);
    if (r) {
      setRoutineName(r.name);
      setModalExercises(r.exercises.map(e => ({ ...e })));
    } else {
      setRoutineName("");
      setModalExercises([]);
    }
    setModalOpen(true);
  };

  const handleCloseRoutineModal = () => {
    setModalOpen(false);
    setEditingRoutine(null);
  };

  const handleAddExerciseToModal = () => {
    const trimmed = newExName.trim();
    if (!trimmed) return;
    const newEx: Exercise = {
      id: Math.random().toString(36).slice(2, 9),
      name: trimmed,
      notes: ""
    };
    setModalExercises(prev => [...prev, newEx]);
    setNewExName("");
  };

  const handleRemoveExerciseFromModal = (idx: number) => {
    setModalExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveRoutine = () => {
    const name = routineName.trim();
    if (!name || modalExercises.length === 0) return;
    onSaveRoutine(editingRoutine ? editingRoutine.id : null, name, modalExercises);
    handleCloseRoutineModal();
  };

  // Switch Active Workout step
  const [activeTabExIdx, setActiveTabExIdx] = useState(0);
  useEffect(() => {
    if (activeWorkout) {
      setActiveTabExIdx(activeWorkout.currentEx);
    }
  }, [activeWorkout?.currentEx]);

  const handleUpdateSet = (setIdx: number, field: "weight" | "reps", val: string) => {
    if (!activeWorkout) return;
    const updatedWorkout = { ...activeWorkout };
    updatedWorkout.sets = [...updatedWorkout.sets];
    updatedWorkout.sets[activeTabExIdx] = [...updatedWorkout.sets[activeTabExIdx]];
    updatedWorkout.sets[activeTabExIdx][setIdx] = {
      ...updatedWorkout.sets[activeTabExIdx][setIdx],
      [field]: val
    };
    onUpdateActiveWorkout(updatedWorkout);
  };

  const handleAddSet = () => {
    if (!activeWorkout) return;
    const updatedWorkout = { ...activeWorkout };
    updatedWorkout.sets = [...updatedWorkout.sets];
    updatedWorkout.sets[activeTabExIdx] = [
      ...updatedWorkout.sets[activeTabExIdx],
      { weight: "", reps: "" }
    ];
    onUpdateActiveWorkout(updatedWorkout);
  };

  const handleRemoveSet = (setIdx: number) => {
    if (!activeWorkout) return;
    if (activeWorkout.sets[activeTabExIdx].length > 1) {
      const updatedWorkout = { ...activeWorkout };
      updatedWorkout.sets = [...updatedWorkout.sets];
      updatedWorkout.sets[activeTabExIdx] = updatedWorkout.sets[activeTabExIdx].filter((_, i) => i !== setIdx);
      onUpdateActiveWorkout(updatedWorkout);
    }
  };

  const handleNextOrFinish = () => {
    if (!activeWorkout) return;
    const nextIdx = activeTabExIdx + 1;
    if (nextIdx < activeWorkout.routine.exercises.length) {
      const updatedWorkout = { ...activeWorkout };
      updatedWorkout.currentEx = nextIdx;
      onUpdateActiveWorkout(updatedWorkout);
      setActiveTabExIdx(nextIdx);
    } else {
      // Create exercise logs
      const finalLogs: Record<string, { weight: number; reps: number; date: string }> = {};
      const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" });

      activeWorkout.routine.exercises.forEach((ex, i) => {
        const setsDone = activeWorkout.sets[i].filter(s => s.weight !== "" && s.reps !== "");
        if (setsDone.length === 0) return;

        // Find heavy set
        const maxWeight = Math.max(...setsDone.map(s => parseFloat(s.weight) || 0));
        const internalWeight = userState.useLb
          ? parseFloat((maxWeight / 2.20462).toFixed(2))
          : parseFloat(maxWeight.toFixed(2));

        finalLogs[ex.name] = {
          weight: internalWeight,
          reps: parseInt(setsDone[0].reps) || 0,
          date: dateStr
        };
      });

      onFinishWorkout(finalLogs);
    }
  };

  // Map weight to users display preference
  const fmtWeight = (kgVal: number) => {
    if (userState.useLb) {
      return `${(kgVal * 2.20462).toFixed(1)} lb`;
    }
    return `${kgVal} kg`;
  };

  // List of all logged exercise names across routines
  const loggedExercises = [...new Set(userState.routines.flatMap(r => r.exercises.map(e => e.name)))];

  // ACTIVE WORKOUT SESSION RENDER VIEW
  if (activeWorkout) {
    const { routine, sets } = activeWorkout;
    const curEx = routine.exercises[activeTabExIdx];
    const curSets = sets[activeTabExIdx] || [{ weight: "", reps: "" }];

    return (
      <div className="w-full max-w-md mx-auto py-6 px-4 pb-28 flex flex-col gap-4">
        {/* Banner with Timer */}
        <div className="flex justify-between items-center bg-[#13111f] border border-[#2a2440] p-4 rounded-xl gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-bebas text-xl text-[#f0c972] tracking-wider truncate">
              {routine.name}
            </div>
            <div className="text-xs text-[#9991b8] font-mono mt-1">
              ⏱ {fmtTimer(elapsedSeconds)}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onCancelWorkout}
              className="px-3 py-1.5 rounded-lg border border-[#ff444444] text-[11px] font-mono text-red-400 cursor-pointer active:scale-95"
            >
              Quit
            </button>
            <button
              onClick={handleNextOrFinish}
              className="bg-gradient-to-r from-[#6fcf97] to-[#43b580] text-xs font-mono font-semibold px-3 py-1.5 rounded-lg text-[#0d0b14] active:scale-95 cursor-pointer"
            >
              {activeTabExIdx === routine.exercises.length - 1 ? "Finish ✓" : "Next →"}
            </button>
          </div>
        </div>

        {/* Scrollable exercise selection bar */}
        <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none whitespace-nowrap">
          {routine.exercises.map((e, idx) => (
            <button
              key={e.id}
              onClick={() => setActiveTabExIdx(idx)}
              className={`px-3 py-1.5 rounded-full font-mono text-[10px] cursor-pointer shrink-0 transition-all ${
                idx === activeTabExIdx
                  ? "bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-semibold"
                  : "bg-[#13111f] border border-[#221d35] text-[#9991b8] hover:border-[#f0c972]"
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>

        {/* Gym Lift Board Card */}
        <div className="bg-[#13111f] border border-[#2a2440] p-4 sm:p-5 rounded-2xl shadow">
          <div className="font-bebas text-2xl tracking-wide text-white mb-1">
            {curEx.name}
          </div>
          {curEx.notes && (
            <div className="text-[10px] text-[#6b6485] font-mono mb-4">
              💡 {curEx.notes}
            </div>
          )}

          {/* Quick conversion switch for sets of the current exercise */}
          <div className="bg-[#19152b] border border-[#2d2459] rounded-xl p-3 mb-4 flex justify-between items-center text-[10px] font-mono">
            <div className="flex flex-col text-left">
              <span className="text-[#a49bcb] font-bold uppercase tracking-wider">⚖️ Dynamic Conversion</span>
              <span className="text-[8px] text-[#6b6485] mt-0.5">Convert and toggle all weights instantly</span>
            </div>
            
            <div className="flex items-center gap-2 bg-[#0f0d1a] border border-[#2e2652] rounded-xl px-2.5 py-1.5 shadow-sm">
              <span
                onClick={handleToggleActiveUnit}
                className={`cursor-pointer transition-colors font-bold ${!userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
              >
                KG
              </span>
              <div
                onClick={handleToggleActiveUnit}
                className="w-8 h-4 rounded-full bg-[#1e1a30] relative cursor-pointer"
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                  style={{
                    left: userState.useLb ? "18px" : "2px",
                    backgroundColor: userState.useLb ? "#f0c972" : "#9991b8"
                  }}
                />
              </div>
              <span
                onClick={handleToggleActiveUnit}
                className={`cursor-pointer transition-colors font-bold ${userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
              >
                LB
              </span>
            </div>
          </div>

          {/* Table Headers */}
          <div className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_24px] gap-2 mb-2 text-center text-[9px] font-mono text-[#6b6485]">
            <div>SET</div>
            <div>WEIGHT ({userState.useLb ? "lb" : "kg"})</div>
            <div>REPS</div>
            <div />
          </div>

          {/* Sets Inputs */}
          <div className="space-y-2">
            {curSets.map((s, si) => (
              <div key={si} className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_24px] gap-2 items-center">
                <div className="text-center font-mono text-xs text-[#9991b8]">
                  {si + 1}
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={s.weight}
                  onChange={e => handleUpdateSet(si, "weight", e.target.value)}
                  className="w-full min-w-0 bg-[#1e1a30] border border-[#221d35] rounded-lg p-1.5 sm:p-2 text-center font-mono text-xs text-white focus:outline-none focus:border-[#f0c972]"
                />
                <input
                  type="number"
                  placeholder="0"
                  value={s.reps}
                  onChange={e => handleUpdateSet(si, "reps", e.target.value)}
                  className="w-full min-w-0 bg-[#1e1a30] border border-[#221d35] rounded-lg p-1.5 sm:p-2 text-center font-mono text-xs text-white focus:outline-none focus:border-[#f0c972]"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSet(si)}
                  className="text-[#3d3657] hover:text-[#9180c4] hover:scale-110 text-lg leading-none cursor-pointer flex justify-center items-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddSet}
            className="w-full mt-3.5 border border-dashed border-[#221d35] rounded-xl py-2 text-xs font-mono text-[#6b6485] hover:text-white transition-colors cursor-pointer"
          >
            + Add Set
          </button>

          {/* Integrated Rest Timer Block */}
          <div className="mt-5 border-t border-[#1e1a30] pt-4.5">
            {restSeconds !== null && restSeconds > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#17142d] border border-[#f0c97233] rounded-xl p-4 flex flex-col items-center justify-center gap-2"
              >
                <div className="font-mono text-[9px] text-[#f0c972] tracking-wider uppercase font-semibold">
                  Rest Protocol Active
                </div>
                <div className="font-bebas text-4xl text-[#f0c972] tracking-widest leading-none/none">
                  {fmtTimer(restSeconds)}
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setRestSeconds(p => (p !== null ? p + 15 : null))}
                    className="px-2.5 py-1 text-[9px] font-mono border border-[#433b7e] hover:border-[#f0c972] text-[#b4a9ea] rounded-md cursor-pointer active:scale-95 transition-all"
                  >
                    +15s
                  </button>
                  <button
                    onClick={() => {
                      setIsResting(false);
                      setRestSeconds(null);
                    }}
                    className="px-2.5 py-1 text-[9px] font-mono bg-red-950/40 border border-red-500/20 hover:border-red-500 text-red-100 rounded-md cursor-pointer active:scale-95 transition-all"
                  >
                    Skip Rest
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-[#6b6485] uppercase tracking-wider">⏱ Interval Rest Timer</span>
                  <span className="text-[#4b446a]">Preset Splits</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
                  {[30, 45, 60, 90].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => {
                        setRestSeconds(sec);
                        setIsResting(true);
                      }}
                      className="py-1.5 rounded-lg bg-[#1a172c] border border-[#2d2459] hover:border-[#f0c972] text-[#a49bcb] hover:text-[#f0c972] active:scale-95 cursor-pointer transition-all font-semibold"
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Previous or Next Button */}
        <div className="flex gap-2 font-mono text-xs">
          {activeTabExIdx > 0 && (
            <button
              onClick={() => setActiveTabExIdx(activeTabExIdx - 1)}
              className="flex-1 bg-[#13111f] border border-[#221d35] rounded-xl py-3 text-[#9991b8] active:scale-95 cursor-pointer"
            >
              ← Prev Exercise
            </button>
          )}
          <button
            onClick={handleNextOrFinish}
            className="flex-1 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-semibold rounded-xl py-3 active:scale-95 cursor-pointer text-center"
          >
            {activeTabExIdx === routine.exercises.length - 1 ? "Finish Routine ✓" : "Next Exercise →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-6 px-4 pb-28 flex flex-col gap-5 overflow-x-hidden">
      {/* Tab Title Block */}
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0 text-left">
          <div className="font-bebas text-3xl tracking-wider text-[#e8e3f8] leading-none mb-1 truncate">
            Fitness Tracker
          </div>
          <span className="text-[10px] text-[#6b6485] font-mono leading-none">
            Track. Lift. Overload.
          </span>
        </div>

        {/* KG / LB Slider Switch */}
        <div className="flex items-center gap-2 bg-[#13111f] border border-[#2a2440] rounded-xl px-2.5 py-1.5 shadow-sm font-mono text-[9px]">
          <span
            onClick={onToggleLb}
            className={`cursor-pointer transition-colors ${!userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
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
                backgroundColor: userState.useLb ? "#f0c972" : "#9991b8"
              }}
            />
          </div>
          <span
            onClick={onToggleLb}
            className={`cursor-pointer transition-colors ${userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
          >
            LB
          </span>
        </div>
      </div>

      {/* Your Routines header */}
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
          Your Routines
        </span>
        <button
          onClick={() => handleOpenRoutineModal(null)}
          className="bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 cursor-pointer shadow"
        >
          + New Routine
        </button>
      </div>

      {/* List Routines */}
      <div className="space-y-3">
        {userState.routines.length === 0 ? (
          <div className="bg-[#13111f] border border-dashed border-[#2a2440] p-8 rounded-2xl flex flex-col items-center gap-2">
            <span className="text-3xl">🏋️</span>
            <div className="text-xs font-mono text-[#3d3657]">No routines configured yet.</div>
          </div>
        ) : (
          userState.routines.map(r => (
            <div key={r.id} className="bg-[#13111f] border border-[#2a2440] rounded-2xl overflow-hidden shadow">
              <div className="flex justify-between items-start p-4 pb-2 gap-3">
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-bebas text-lg text-[#e8e3f8] tracking-wider leading-none truncate">
                    {r.name}
                  </div>
                  <span className="text-[9px] text-[#6b6485] font-mono block mt-1">
                    {r.exercises.length} exercise{r.exercises.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenRoutineModal(r)}
                    className="text-[9px] font-mono bg-[#17142a] border border-[#221d35] rounded-md px-2 py-1 text-[#9991b8] hover:text-[#f0c972] hover:border-[#f0c972]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteRoutine(r.id)}
                    className="text-[#3d3657] hover:text-red-400 text-base leading-none cursor-pointer h-5 w-5 flex items-center justify-center border border-[#221d35] rounded-md hover:border-red-400/20"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Exercises Tags list */}
              <div className="flex gap-1.5 p-4 pt-1 flex-wrap">
                {r.exercises.map(ex => (
                  <span
                    key={ex.id}
                    className="bg-[#1e1a30] text-[#9991b8] tracking-wide font-mono text-[9px] rounded-lg px-2 py-1.5"
                  >
                    {ex.name}
                  </span>
                ))}
              </div>

              {/* Start Workout button */}
              <button
                onClick={() => onStartWorkout(r.id)}
                className="w-full bg-[#171420] border-t border-[#2a2440] p-3 text-center tracking-widest text-[#f0c972] font-bebas text-xs hover:bg-[#201c2e] transition-colors cursor-pointer"
              >
                START TRAINING SESSION →
              </button>
            </div>
          ))
        )}
      </div>

      {/* Progression Graphs Block */}
      {loggedExercises.length > 0 && (
        <>
          <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase mt-3">
            Progressive Overload
          </span>

          <div className="space-y-2">
            {loggedExercises.map(name => {
              const hist = userState.exerciseHistory[name] || [];
              const bestLift = hist.length > 0 ? Math.max(...hist.map(h => h.weight)) : 0;
              const isGraphOpen = expandedGraph === name;

              // Format date logs for recharts
              const chartData = hist.map((log, lIdx) => ({
                idx: lIdx + 1,
                weight: userState.useLb ? parseFloat((log.weight * 2.20462).toFixed(1)) : log.weight,
                date: log.date
              }));

              return (
                <div key={name} className="bg-[#13111f] border border-[#2a2440] rounded-2xl overflow-hidden shadow">
                  <div
                    onClick={() => setExpandedGraph(isGraphOpen ? null : name)}
                    className="flex justify-between items-center p-4 cursor-pointer select-none"
                  >
                    <div>
                      <div className="font-mono text-xs text-[#e8e3f8]">{name}</div>
                      <span className="text-[9px] font-mono text-[#6b6485] mt-1 block">
                        {hist.length} session{hist.length !== 1 ? "s" : ""}{" "}
                        {bestLift > 0 && (
                          <span className="text-[#f0c972]">Best: {fmtWeight(bestLift)}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#3d3657] font-mono select-none">
                      {isGraphOpen ? "▲" : "▼"}
                    </span>
                  </div>

                  {isGraphOpen && (
                    <div className="p-4 pt-0">
                      {hist.length < 2 ? (
                        <div className="text-center font-mono text-[#3d3657] text-[10px] p-6">
                          Perform at least 2 sessions to trace progressive gains.
                        </div>
                      ) : (
                        <div className="h-32 w-full mt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                              <CartesianGrid stroke="#1e1a30" strokeDasharray="3 3" />
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
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                dot={{ r: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Create / Edit Routine MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[#0d0b14cc] z-50 flex items-end justify-center">
          <div className="bg-[#0d0b14] border-t border-x border-[#2a2440] rounded-t-3xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <div className="font-bebas text-2xl tracking-wider text-[#f0c972]">
              {editingRoutine ? "Edit Routine" : "New Routine"}
            </div>

            {/* Routine Name Input */}
            <input
              type="text"
              placeholder="Routine name (e.g., Pull Day)"
              value={routineName}
              onChange={e => setRoutineName(e.target.value)}
              className="w-full bg-[#13111f] border border-[#2a2440] rounded-xl p-3 text-xs font-mono text-white placeholder-[#3d3657] focus:outline-none focus:border-[#f0c972]"
            />

            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase mt-1">
              Add Exercises
            </span>

            {/* Modal Exercises list */}
            <div className="space-y-2 max-h-[30vh] overflow-y-auto scrollbar-none">
              {modalExercises.length === 0 ? (
                <div className="text-center font-mono py-4 text-[#3d3657] text-xs">
                  Empty. Use launcher input below!
                </div>
              ) : (
                modalExercises.map((ex, idx) => (
                  <div key={idx} className="bg-[#13111f] border border-[#221d35] p-3 rounded-xl">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-mono text-xs text-white font-medium">{ex.name}</span>
                      <button
                        onClick={() => handleRemoveExerciseFromModal(idx)}
                        className="text-[#3d3657] hover:text-red-400 h-5 w-5 leading-none cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                    {/* Notes Input */}
                    <input
                      type="text"
                      placeholder="Notes (e.g. 3 x 10 setups)"
                      value={ex.notes || ""}
                      onChange={e => {
                        const copy = [...modalExercises];
                        copy[idx].notes = e.target.value;
                        setModalExercises(copy);
                      }}
                      className="w-full bg-[#17142a] border border-[#221d35] rounded-lg p-2 text-[10px] font-mono text-[#9991b8] placeholder-[#3d3657] focus:outline-none"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Quick Exercise Launcher input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Exercise name..."
                value={newExName}
                onChange={e => setNewExName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newExName.trim()) {
                    handleAddExerciseToModal();
                  }
                }}
                className="flex-1 bg-[#13111f] border border-[#221d35] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#3d3657] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddExerciseToModal}
                className="px-3 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bold rounded-xl hover:brightness-110 cursor-pointer"
              >
                +
              </button>
            </div>

            {/* Cancel or Save strip */}
            <div className="flex gap-2 font-mono text-xs mt-3">
              <button
                onClick={handleCloseRoutineModal}
                className="flex-1 bg-[#13111f] border border-[#221d35] rounded-xl py-3 text-[#6b6485] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoutine}
                disabled={!routineName.trim() || modalExercises.length === 0}
                className="flex-1 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bold rounded-xl py-3 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
