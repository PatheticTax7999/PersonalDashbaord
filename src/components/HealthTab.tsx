import { useState, useEffect } from "react";
import { UserState } from "../types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { motion, AnimatePresence } from "motion/react";

const TIME_SLOTS = [
  { key: "morning", label: "Morning", icon: "🌅", start: 6, end: 12 },
  { key: "afternoon", label: "Afternoon", icon: "☀️", start: 12, end: 17 },
  { key: "evening", label: "Evening", icon: "🌆", start: 17, end: 21 },
  { key: "night", label: "Night", icon: "🌙", start: 21, end: 24 }
];

const WATER_UNITS: Record<string, { label: string; mlPer: number; icon: string }> = {
  glass: { label: "Glass (250ml)", mlPer: 250, icon: "🥛" },
  bottle: { label: "1L Bottle", mlPer: 1000, icon: "🍶" }
};

interface HealthTabProps {
  userState: UserState;
  onUpdateWaterGoal: (val: number) => void;
  onUpdateWaterUnit: (unit: string) => void;
  onLogWater: (idx: number) => void;
  onResetWater: () => void;
  onAddSupplement: (name: string, dosage: string, times: string[], scheduledTimes?: Record<string, string>) => void;
  onRemoveSupplement: (id: string) => void;
  onToggleSuppCheck: (suppId: string, slotKey: string) => void;
  onLogWeight: (weight: number) => void;
  onRemoveWeight: (date: string) => void;
  notifPermission: NotificationPermission;
  onRequestNotifPermission: () => Promise<void>;
  onTriggerTestNotification: () => void;
}

export default function HealthTab({
  userState,
  onUpdateWaterGoal,
  onUpdateWaterUnit,
  onLogWater,
  onResetWater,
  onAddSupplement,
  onRemoveSupplement,
  onToggleSuppCheck,
  onLogWeight,
  onRemoveWeight,
  notifPermission,
  onRequestNotifPermission,
  onTriggerTestNotification
}: HealthTabProps) {
  const [subTab, setSubTab] = useState<"hydration" | "weight">("hydration");

  // Track hydration volume change to trigger liquid sloshing
  const [isSloshing, setIsSloshing] = useState(false);

  // Hydration state
  const [tempGoal, setTempGoal] = useState(userState.waterGoal.toString());
  const [suppModalOpen, setSuppModalOpen] = useState(false);
  const [suppName, setSuppName] = useState("");
  const [suppDosage, setSuppDosage] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [slotTimes, setSlotTimes] = useState<Record<string, string>>({
    morning: "08:00",
    afternoon: "13:00",
    evening: "18:00",
    night: "21:30"
  });

  // Weight entry state
  const [weightInput, setWeightInput] = useState("");

  useEffect(() => {
    if (userState.waterUnit === "ml" || userState.waterUnit === "oz") {
      onUpdateWaterUnit("glass");
    }
  }, [userState.waterUnit, onUpdateWaterUnit]);

  const todayKey = new Date().toISOString().slice(0, 10);

  // Water calculations
  const wUnit = WATER_UNITS[userState.waterUnit] || WATER_UNITS.glass;
  const unitsNeeded = wUnit.mlPer > 0 ? Math.ceil(userState.waterGoal / wUnit.mlPer) : 0;
  const unitsDone = userState.waterLog[todayKey] || 0;
  const mlDone = unitsDone * wUnit.mlPer;
  const rawPct = userState.waterGoal > 0 ? Math.round((mlDone / userState.waterGoal) * 100) : 0;
  const waterPct = isNaN(rawPct) || !isFinite(rawPct) ? 0 : Math.min(100, Math.max(0, rawPct));

  const [prevWaterPct, setPrevWaterPct] = useState(waterPct);
  useEffect(() => {
    if (waterPct !== prevWaterPct) {
      setIsSloshing(true);
      const timer = setTimeout(() => {
        setIsSloshing(false);
      }, 1800);
      setPrevWaterPct(waterPct);
      return () => clearTimeout(timer);
    }
  }, [waterPct, prevWaterPct]);

  // Supplements calculations
  const slotSupps: Record<string, typeof userState.supplements> = {};
  TIME_SLOTS.forEach(slot => {
    slotSupps[slot.key] = userState.supplements.filter(s => s.times.includes(slot.key));
  });

  const getSuppUrgency = (slot: typeof TIME_SLOTS[0]) => {
    const h = new Date().getHours();
    if (h < slot.start) return "upcoming";
    if (h >= slot.end) return "past";
    if (h >= slot.end - 1) return "urgent";
    return "active";
  };

  const getSupplementStatus = (s: typeof userState.supplements[0], slotKey: string): "completed" | "warning" | "missed" | "upcoming" => {
    const isDone = isSuppDone(s.id, slotKey);
    if (isDone) return "completed";

    const timeStr = s.scheduledTimes?.[slotKey] || (
      slotKey === "morning" ? "08:00" :
      slotKey === "afternoon" ? "13:00" :
      slotKey === "evening" ? "18:00" :
      "21:30"
    );

    const [schedHour, schedMin] = timeStr.split(":").map(Number);
    const now = new Date();
    const nowHour = now.getHours();
    const nowMinVal = now.getMinutes();
    const nowInMins = nowHour * 60 + nowMinVal;
    const schedInMins = schedHour * 60 + schedMin;

    if (nowInMins > schedInMins) {
      return "missed";
    } else if (schedInMins - nowInMins <= 45) {
      return "warning";
    }
    return "upcoming";
  };

  const isSuppDone = (suppId: string, slotKey: string) => {
    return !!(userState.suppChecks[todayKey]?.[`${suppId}_${slotKey}`]);
  };

  // Supplement dialog handlers
  const handleToggleSlotBtn = (key: string) => {
    setSelectedSlots(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSaveSupplement = () => {
    const trimmedName = suppName.trim();
    if (!trimmedName || selectedSlots.length === 0) return;
    
    const finalScheduledTimes: Record<string, string> = {};
    selectedSlots.forEach(slotKey => {
      finalScheduledTimes[slotKey] = slotTimes[slotKey] || (
        slotKey === "morning" ? "08:00" :
        slotKey === "afternoon" ? "13:00" :
        slotKey === "evening" ? "18:00" :
        "21:30"
      );
    });

    onAddSupplement(trimmedName, suppDosage.trim(), selectedSlots, finalScheduledTimes);
    setSuppName("");
    setSuppDosage("");
    setSelectedSlots([]);
    setSlotTimes({
      morning: "08:00",
      afternoon: "13:00",
      evening: "18:00",
      night: "21:30"
    });
    setSuppModalOpen(false);
  };

  // Unit weight helper
  const internalToDisplayWeight = (kgVal: number) => {
    if (userState.useLb) {
      return parseFloat((kgVal * 2.20462).toFixed(1));
    }
    return kgVal;
  };

  const displayToInternalWeight = (dispVal: number) => {
    if (userState.useLb) {
      return parseFloat((dispVal / 2.20462).toFixed(2));
    }
    return parseFloat(dispVal.toFixed(2));
  };

  // Weight statistics
  const sortedWeightLog = [...userState.weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const todayWeightEntry = userState.weightLog.find(e => e.date === todayKey);

  const getWeightStats = () => {
    if (sortedWeightLog.length < 1) return { diff: "0.0", min: "0.0", max: "0.0" };
    const first = sortedWeightLog[0];
    const last = sortedWeightLog[sortedWeightLog.length - 1];
    
    const dispFirst = internalToDisplayWeight(first.weight);
    const dispLast = internalToDisplayWeight(last.weight);
    const diffVal = (dispLast - dispFirst).toFixed(1);
    
    const dispWeights = sortedWeightLog.map(e => internalToDisplayWeight(e.weight));
    const minVal = Math.min(...dispWeights).toFixed(1);
    const maxVal = Math.max(...dispWeights).toFixed(1);

    return {
      diff: parseFloat(diffVal) > 0 ? `+${diffVal}` : diffVal,
      min: minVal,
      max: maxVal
    };
  };

  const stats = getWeightStats();

  const handleLogWeightSubmit = () => {
    const parsed = parseFloat(weightInput);
    if (!parsed || parsed <= 0) return;
    onLogWeight(displayToInternalWeight(parsed));
    setWeightInput("");
  };

  return (
    <div className="w-full max-w-md mx-auto py-6 px-4 pb-28 flex flex-col gap-5">
      {/* Tab Header */}
      <div>
        <div className="font-bebas text-3xl tracking-wider text-[#e8e3f8] leading-none mb-1">
          Health & Wellness
        </div>
        <span className="text-[10px] text-[#6b6485] font-mono leading-none">
          Hydration, Supplementation, Weights
        </span>
      </div>

      {/* Sub-tab selection pill */}
      <div className="flex bg-[#17142a] border border-[#221d35] rounded-xl p-1 font-mono text-[11px] font-semibold gap-1">
        <button
          onClick={() => setSubTab("hydration")}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            subTab === "hydration"
              ? "bg-gradient-to-r from-[#3ab4f2] to-[#1e7fc4] text-[#0d0b14]"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          💧 Hydration
        </button>
        <button
          onClick={() => setSubTab("weight")}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            subTab === "weight"
              ? "bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14]"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          ⚖️ Weight Log
        </button>
      </div>

      {/* HYDRATION SCREEN */}
      {subTab === "hydration" && (
        <>
          {/* Water card logger */}
          <div className="bg-[#13111f] border border-[#2a2440] p-5 rounded-2xl shadow">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
                Water Target Checklist
              </span>
              <span className="text-[10px] font-mono text-[#3ab4f2]">
                {Math.round(mlDone)} / {userState.waterGoal} ml
              </span>
            </div>

            {/* Hydration progress line */}
            <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-[#3ab4f2] to-[#1a6fd4] transition-all duration-500 ease-out"
                style={{ width: `${waterPct}%` }}
              />
            </div>

            {/* Elegant measure wave beaker gauge */}
            <div className="flex justify-center mb-5.5 select-none touch-none">
              <motion.div
                animate={isSloshing ? {
                  rotate: [0, -4, 3.5, -2.5, 1.8, -1, 0],
                  scale: [1, 1.05, 0.97, 1.02, 1]
                } : {}}
                transition={{ duration: 1.6, ease: "easeInOut" }}
                className="relative w-36 h-36 rounded-3xl border-2 border-[#2c2445] bg-[#0c0914] overflow-hidden shadow-[inset_0_4px_15px_rgba(0,0,0,0.8),0_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-center p-0.5"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)"
                }}
              >
                {(() => {
                  const targetY = 100 - waterPct;
                  const amp = waterPct <= 0 || waterPct >= 100 ? 0 : (isSloshing ? 9 : 4);
                  
                  const wavePath1 = `M 0 ${targetY} Q 25 ${targetY - amp} 50 ${targetY} T 100 ${targetY} L 100 110 L 0 110 Z`;
                  const wavePath2 = `M 0 ${targetY} Q 25 ${targetY + amp} 50 ${targetY} T 100 ${targetY} L 100 110 L 0 110 Z`;
                  
                  const backPath1 = `M 0 ${targetY} Q 25 ${targetY + amp * 1.25} 50 ${targetY} T 100 ${targetY} L 100 110 L 0 110 Z`;
                  const backPath2 = `M 0 ${targetY} Q 25 ${targetY - amp * 1.25} 50 ${targetY} T 100 ${targetY} L 100 110 L 0 110 Z`;

                  return (
                    <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden">
                      {/* SVG Waves Container */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="waterGradientFront" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3ab4f2" />
                            <stop offset="35%" stopColor="#1e88e5" />
                            <stop offset="100%" stopColor="#0d3c8c" />
                          </linearGradient>
                          <linearGradient id="waterGradientBack" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1565c0" />
                            <stop offset="100%" stopColor="#0a2a5c" />
                          </linearGradient>
                        </defs>

                        {/* Back wave layer */}
                        {waterPct > 0 && (
                          <motion.path
                            d={backPath1}
                            animate={{
                              d: [backPath1, backPath2, backPath1]
                            }}
                            transition={{
                              repeat: Infinity,
                              duration: isSloshing ? 0.9 : 2.8,
                              ease: "easeInOut"
                            }}
                            fill="url(#waterGradientBack)"
                            opacity="0.5"
                          />
                        )}

                        {/* Rising oxygen bubble visualizer */}
                        {waterPct > 0 && Array.from({ length: 6 }).map((_, i) => (
                          <motion.circle
                            key={i}
                            cx={15 + i * 14 + (isSloshing ? Math.sin(i) * 5 : 0)}
                            cy={100}
                            r={0.8 + (i % 3) * 0.4}
                            animate={{
                              cy: [92, targetY + 3],
                              opacity: [0, 0.75, 0],
                              cx: [15 + i * 14, 15 + i * 14 + (Math.sin(i * 1.5) * 6)]
                            }}
                            transition={{
                              repeat: Infinity,
                              duration: 2.0 + i * 0.4,
                              delay: i * 0.3,
                              ease: "easeOut"
                            }}
                            fill="#e0f2fe"
                          />
                        ))}

                        {/* Front wave layer */}
                        {waterPct > 0 && (
                          <motion.path
                            d={wavePath1}
                            animate={{
                              d: [wavePath1, wavePath2, wavePath1]
                            }}
                            transition={{
                              repeat: Infinity,
                              duration: isSloshing ? 0.85 : 2.2,
                              ease: "easeInOut"
                            }}
                            fill="url(#waterGradientFront)"
                          />
                        )}
                      </svg>
                    </div>
                  );
                })()}

                {/* Reflector glass overlays */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-60 pointer-events-none rounded-2xl z-10" />
                <div className="absolute top-1 left-2 w-4 h-0.5 bg-white/15 rounded-full pointer-events-none z-10" />
                <div className="absolute top-3 left-1 w-1 h-3 bg-white/10 rounded-full pointer-events-none z-10" />

                {/* Fluid details foreground */}
                <div className="relative z-20 font-mono text-center pointer-events-none">
                  <div className="text-3xl font-bold font-bebas text-white tracking-widest leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{waterPct}%</div>
                  <div className="text-[7.5px] text-[#beb3f5] opacity-90 uppercase tracking-widest mt-1.5 font-semibold leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">logged</div>
                </div>
                
                {/* Gradation markings */}
                <div className="absolute right-2.5 top-0 h-full flex flex-col justify-between py-4 text-[6.5px] font-mono text-[#39315d] pointer-events-none z-20 font-bold">
                  <span>- 100%</span>
                  <span>- 75%</span>
                  <span>- 50%</span>
                  <span>- 25%</span>
                </div>
              </motion.div>
            </div>

            {/* Quick selectors for units */}
            <div className="grid grid-cols-2 gap-1.5 mb-4 font-mono text-[9px]">
              {Object.entries(WATER_UNITS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => onUpdateWaterUnit(key)}
                  className={`py-1.5 px-1 bg-[#17142a] border rounded-lg text-center leading-normal cursor-pointer transition-all ${
                    userState.waterUnit === key
                      ? "border-[#3ab4f2] bg-gradient-to-br from-[#3ab4f215] to-[#1e7fc415] text-[#3ab4f2]"
                      : "border-[#221d35] text-[#9991b8] hover:border-[#3ab4f2]"
                  }`}
                >
                  <span className="text-[13px] block mb-0.5">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Goal adjusting strip */}
            <div className="flex gap-2 items-center mb-4 text-xs font-mono">
              <span className="text-[#6b6485]">Daily target:</span>
              <input
                type="number"
                value={tempGoal}
                onChange={e => setTempGoal(e.target.value)}
                placeholder="2000"
                className="flex-1 text-center bg-[#17142a] border border-[#221d35] rounded-lg p-2.5 text-xs text-white placeholder-[#221d35] focus:outline-none"
              />
              <span className="text-[#6b6485]">ml</span>
              <button
                onClick={() => {
                  const goalNum = parseInt(tempGoal);
                  if (goalNum > 0) onUpdateWaterGoal(goalNum);
                }}
                className="px-3 py-2 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bold rounded-lg cursor-pointer"
              >
                Set
              </button>
            </div>

            <div className="text-[10px] text-[#6b6485] font-mono uppercase tracking-wider mb-2 select-none">
              Tap to check/log units — {unitsDone} / {unitsNeeded} {wUnit.label} Done
            </div>

            {/* Tap log widgets */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: unitsNeeded }).map((_, i) => {
                const checked = i < unitsDone;
                return (
                  <button
                    key={i}
                    onClick={() => onLogWater(i)}
                    className="w-10 h-12 flex flex-col items-center justify-center border rounded-lg cursor-pointer font-mono outline-none transition-all active:scale-95"
                    style={{
                      borderColor: checked ? "#3ab4f2" : "#221d35",
                      background: checked ? "linear-gradient(180deg, #3ab4f220, #1e7fc420)" : "#17142a",
                      color: checked ? "#3ab4f2" : "#3d3657"
                    }}
                  >
                    <span className="text-sm leading-none mb-1">{wUnit.icon}</span>
                    <span className="text-[8px]">{i + 1}</span>
                  </button>
                );
              })}
            </div>

            {unitsDone > 0 && (
              <button
                onClick={onResetWater}
                className="mt-3.5 block text-[10px] text-[#6b6485] hover:text-white underline font-mono cursor-pointer"
              >
                Reset logs for today
              </button>
            )}
          </div>

          {/* Supplements checklist portion */}
          <div className="flex justify-between items-center mt-3 mb-1">
            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
              Daily Supplements
            </span>
            <button
              onClick={() => {
                setSuppName("");
                setSuppDosage("");
                setSelectedSlots([]);
                setSuppModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer active:scale-95"
            >
              + Add Supplement
            </button>
          </div>

          <div className="space-y-3.5">
            {userState.supplements.length === 0 ? (
              <div className="bg-[#13111f] border border-dashed border-[#2a2440] p-7 rounded-2xl flex flex-col items-center gap-1">
                <span className="text-2xl">💊</span>
                <span className="text-xs font-mono text-[#3d3657]">No supplements listed yet.</span>
              </div>
            ) : (
              TIME_SLOTS.map(slot => {
                const list = slotSupps[slot.key];
                if (list.length === 0) return null;

                const statuses = list.map(s => getSupplementStatus(s, slot.key));
                const allDone = statuses.every(st => st === "completed");
                const hasMissed = statuses.some(st => st === "missed");
                const hasWarning = statuses.some(st => st === "warning");

                const slotColor = allDone 
                  ? "#6fcf97" 
                  : hasWarning 
                    ? "#f0c972" 
                    : hasMissed 
                      ? "#ff4444" 
                      : "#3d3657";

                return (
                  <div key={slot.key} className="bg-[#13111f] border border-[#2a2440] p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{slot.icon}</span>
                        <span className="font-bebas text-base tracking-wide text-white">
                          {slot.label} Intake
                        </span>
                        <span className="text-[9px] text-[#6b6485] font-mono">
                          ({slot.start}:00–{slot.end}:00)
                        </span>
                      </div>
                      <div className="flex items-center">
                        {allDone ? (
                          <span className="text-[9px] text-[#6fcf97] font-mono">✓ Taken</span>
                        ) : hasWarning ? (
                          <span className="text-[8px] text-[#f0c972] font-mono animate-pulse font-semibold">
                            ⚠️ NOW DUE
                          </span>
                        ) : hasMissed ? (
                          <span className="text-[8px] text-[#ff4444] font-mono font-semibold">
                            ❌ MISSED TIME
                          </span>
                        ) : (
                          <span className="text-[8px] text-[#6b6485] font-mono uppercase">
                            Upcoming
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Supplement Row elements */}
                    <div className="space-y-2">
                      {list.map(s => {
                        const status = getSupplementStatus(s, slot.key);
                        const done = status === "completed";
                        
                        let borderClass = "border-[#221d35]";
                        let textClass = "text-white";
                        let checkboxClass = "border-[#3d3657]";
                        let statusBadge = null;

                        if (status === "completed") {
                          borderClass = "border-emerald-500/20 bg-emerald-950/5";
                          textClass = "line-through text-[#6b6485]";
                          checkboxClass = "border-emerald-500 bg-emerald-500 text-[#0d0b14]";
                        } else if (status === "warning") {
                          borderClass = "border-[#f0c972]/40 bg-[#f0c972]/5 shadow-sm shadow-[#f0c972]/5";
                          textClass = "text-white font-medium";
                          checkboxClass = "border-[#f0c972] animate-pulse";
                          statusBadge = <span className="text-[8px] font-mono font-bold text-[#f0c972] ml-1.5 bg-[#f0c972]/10 px-1 rounded uppercase tracking-wide animate-pulse">⚡ DUE SOON</span>;
                        } else if (status === "missed") {
                          borderClass = "border-red-500/30 bg-red-950/5";
                          textClass = "text-red-300 font-medium";
                          checkboxClass = "border-red-500 bg-red-950/15";
                          statusBadge = <span className="text-[8px] font-mono font-bold text-red-400 ml-1.5 bg-red-500/10 px-1 rounded uppercase tracking-wide">⚠️ MISSED</span>;
                        } else {
                          borderClass = "border-[#221d35] hover:border-[#383152]";
                          textClass = "text-white";
                          checkboxClass = "border-[#3d3657]";
                        }

                        const timeVal = s.scheduledTimes?.[slot.key] || (
                          slot.key === "morning" ? "08:00" :
                          slot.key === "afternoon" ? "13:00" :
                          slot.key === "evening" ? "18:00" :
                          "21:30"
                        );

                        return (
                          <div
                            key={s.id}
                            onClick={() => onToggleSuppCheck(s.id, slot.key)}
                            className={`flex items-center gap-3 bg-[#17142a] border rounded-xl p-3 cursor-pointer select-none transition-all ${borderClass}`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] transition-all shrink-0 ${checkboxClass}`}
                            >
                              {done ? "✓" : ""}
                            </div>
                            <div className="flex-1">
                              <div className={`text-xs font-mono flex flex-wrap items-center gap-x-2 ${textClass}`}>
                                <span>{s.name}</span>
                                <span className="text-[9px] text-[#6b6485] font-normal font-mono">
                                  ⏱ {timeVal}
                                </span>
                                {statusBadge}
                              </div>
                              {s.dosage && (
                                <div className="text-[9px] text-[#6e6885] font-mono mt-0.5">
                                  {s.dosage}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onRemoveSupplement(s.id);
                              }}
                              className="text-[#3d3657] hover:text-red-400 font-mono scale-110 px-2 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>


        </>
      )}

      {/* WEIGHT TRACKER SCREEN */}
      {subTab === "weight" && (
        <>
          {/* Quick logger widget */}
          <div className="bg-[#13111f] border border-[#2a2440] p-5 rounded-2xl shadow">
            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block mb-3">
              Add Weight Reading
            </span>

            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                placeholder={userState.useLb ? "e.g., 165" : "e.g., 75"}
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleLogWeightSubmit();
                }}
                className="flex-1 bg-[#17142a] border border-[#221d35] rounded-xl p-3 text-center text-lg font-mono text-white focus:outline-none focus:border-[#f0c972]"
              />
              <span className="flex items-center text-xs font-mono text-[#9991b8] px-2 uppercase">
                {userState.useLb ? "lb" : "kg"}
              </span>
              <button
                onClick={handleLogWeightSubmit}
                className="px-5 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-mono font-bold rounded-xl hover:brightness-110 active:scale-95 cursor-pointer shadow"
              >
                Log
              </button>
            </div>

            {todayWeightEntry ? (
              <div className="text-[10px] text-[#6fcf97] font-mono text-center mt-3">
                ✓ Recorded today: {internalToDisplayWeight(todayWeightEntry.weight)}{" "}
                {userState.useLb ? "lb" : "kg"}
              </div>
            ) : (
              <div className="text-[9px] text-[#3d3657] font-mono text-center mt-3">
                Early morning log is recommended for baseline tracking
              </div>
            )}
          </div>

          {/* Quick statistics layout */}
          {sortedWeightLog.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 text-center select-none font-mono">
              <div className="bg-[#13111f] border border-[#221d35] p-3 rounded-xl shadow-sm">
                <div
                  className="text-lg font-bold"
                  style={{
                    color: stats.diff.startsWith("+") ? "#ff4444" : "#6fcf97"
                  }}
                >
                  {stats.diff}
                </div>
                <span className="text-[8px] text-[#3d3657] uppercase tracking-wider">
                  TOTAL DIFF
                </span>
              </div>
              <div className="bg-[#13111f] border border-[#221d35] p-3 rounded-xl shadow-sm">
                <div className="text-lg font-bold text-[#6fcf97]">{stats.min}</div>
                <span className="text-[8px] text-[#3d3657] uppercase tracking-wider">
                  LOWEST LIFT
                </span>
              </div>
              <div className="bg-[#13111f] border border-[#221d35] p-3 rounded-xl shadow-sm">
                <div className="text-lg font-bold text-[#f0c972]">{stats.max}</div>
                <span className="text-[8px] text-[#3d3657] uppercase tracking-wider">
                  PEAK WEIGHT
                </span>
              </div>
            </div>
          )}

          {/* Progress Chart Recharts widget */}
          <div className="bg-[#13111f] border border-[#2a2440] p-4 rounded-2xl shadow">
            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block mb-3.5">
              Weight Trends Chronology
            </span>

            {sortedWeightLog.length < 2 ? (
              <div className="text-center font-mono py-8 p-4 border border-dashed border-[#221d35] rounded-xl text-[#3d3657] text-xs">
                Log at least 2 readings over days to chart weight trends.
              </div>
            ) : (
              <div className="h-36 w-full mt-1.5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={sortedWeightLog.map(g => ({
                      weight: internalToDisplayWeight(g.weight),
                      date: new Date(g.date + "T12:00:00").toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short"
                      })
                    }))}
                    margin={{ top: 5, right: 5, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid stroke="#1e1a30" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#6b6485" fontSize={8} tickLine={false} />
                    <YAxis stroke="#6b6485" fontSize={8} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#13111f", borderColor: "#2a2440", color: "#e8e3f8" }}
                      labelStyle={{ fontSize: 9, fontFamily: "monospace" }}
                      itemStyle={{ fontSize: 9, fontFamily: "monospace", color: "#f0c972" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="#f0c972"
                      fillOpacity={0.15}
                      fill="url(#colorWeight)"
                      strokeWidth={1.5}
                    />
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f0c972" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f0c972" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* History listings details */}
          {sortedWeightLog.length > 0 && (
            <>
              <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase mt-2">
                Logs History
              </span>

              <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
                {[...sortedWeightLog]
                  .reverse()
                  .slice(0, 30)
                  .map(e => (
                    <div
                      key={e.date}
                      className="flex justify-between items-center bg-[#13111f] border border-[#221d35] p-3 rounded-xl"
                    >
                      <div className="text-xs font-mono text-[#9991b8]">
                        {new Date(e.date + "T12:00:00").toLocaleDateString("en-AU", {
                          weekday: "short",
                          day: "numeric",
                          month: "short"
                        })}
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-xs text-[#e8e3f8]">
                          {internalToDisplayWeight(e.weight)}{" "}
                          <span className="text-[10px] text-[#3d3657]">
                            {userState.useLb ? "lb" : "kg"}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveWeight(e.date)}
                          className="text-[#3d3657] hover:text-red-400 font-sans text-xs cursor-pointer px-1.5"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}

      {/* CREATE SUPPLEMENT LIST MODAL */}
      {suppModalOpen && (
        <div className="fixed inset-0 bg-[#0d0b14cc] z-50 flex items-end justify-center">
          <div className="bg-[#0d0b14] border-t border-x border-[#2a2440] rounded-t-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <div className="font-bebas text-2xl tracking-wider text-[#f0c972]">
              Add Supplement
            </div>

            {/* Inputs logic */}
            <input
              type="text"
              placeholder="Name (e.g. Creatine Monohydrate)"
              value={suppName}
              onChange={e => setSuppName(e.target.value)}
              className="w-full bg-[#13111f] border border-[#2a2440] rounded-xl p-3 text-xs font-mono text-white placeholder-[#3d3657] focus:outline-none focus:border-[#f0c972]"
            />
            <input
              type="text"
              placeholder="Dosage (e.g. 5g, 2 caps)"
              value={suppDosage}
              onChange={e => setSuppDosage(e.target.value)}
              className="w-full bg-[#13111f] border border-[#2a2440] rounded-xl p-3 text-xs font-mono text-white placeholder-[#3d3657] focus:outline-none focus:border-[#f0c972]"
            />

            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
              Scheduled timings
            </span>

            {/* Time toggle chips inside dialog */}
            <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs">
              {TIME_SLOTS.map(slot => {
                const selected = selectedSlots.includes(slot.key);
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => handleToggleSlotBtn(slot.key)}
                    className="py-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: selected ? "#f0c972" : "#221d35",
                      background: selected ? "linear-gradient(135deg, #f0c972, #e07b3f)" : "#13111f",
                      color: selected ? "#0d0b14" : "#9991b8"
                    }}
                  >
                    <span>{slot.icon}</span>
                    {slot.label}
                  </button>
                );
              })}
            </div>

            {/* Dynamic slot time adjusters */}
            {selectedSlots.length > 0 && (
              <div className="space-y-2 bg-[#13111f] border border-[#221d35] p-3.5 rounded-xl">
                <span className="text-[9px] text-[#6b6485] font-mono uppercase tracking-wider block mb-1">
                  Adjust custom times:
                </span>
                <div className="space-y-2.5">
                  {selectedSlots.map(slotKey => {
                    const slot = TIME_SLOTS.find(t => t.key === slotKey);
                    if (!slot) return null;
                    return (
                      <div key={slotKey} className="flex justify-between items-center gap-4 text-xs font-mono bg-[#0d0b14]/50 p-2 border border-[#221d35] rounded-lg">
                        <span className="text-[#9991b8] flex items-center gap-1.5 shrink-0">
                          <span>{slot.icon}</span>
                          {slot.label}:
                        </span>
                        <input
                          type="time"
                          value={slotTimes[slotKey] || "08:00"}
                          onChange={e => {
                            setSlotTimes(prev => ({
                              ...prev,
                              [slotKey]: e.target.value
                            }));
                          }}
                          className="w-28 text-center bg-[#17142a] border border-[#2a2440] rounded-lg p-1.5 text-xs text-[#f0c972] font-semibold focus:outline-none focus:border-[#f0c972]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Controls strip */}
            <div className="flex gap-2 font-mono text-xs mt-3 shrink-0">
              <button
                onClick={() => setSuppModalOpen(false)}
                className="flex-1 bg-[#13111f] border border-[#221d35] rounded-xl py-3 text-[#6b6485] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSupplement}
                disabled={!suppName.trim() || selectedSlots.length === 0}
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
