import { useState, useEffect } from "react";
import { UserState, WaterConfig } from "../types";
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
  onLogWater: (action: "increment" | "decrement") => void;
  onResetWater: () => void;
  onAddSupplement: (name: string, dosage: string, times: string[], scheduledTimes?: Record<string, string>) => void;
  onRemoveSupplement: (id: string) => void;
  onToggleSuppCheck: (suppId: string, slotKey: string) => void;
  onLogWeight: (weight: number) => void;
  onRemoveWeight: (date: string) => void;
  notifPermission: NotificationPermission;
  onRequestNotifPermission: () => Promise<void>;
  onTriggerTestNotification: () => void;
  onUpdateWaterConfig?: (config: WaterConfig) => void;
  onLogFood?: (name: string, calories: number, protein: number, carbs: number, fat: number, barcode?: string, quantity?: number) => void;
  onRemoveFood?: (id: string) => void;
  onUpdateCalorieTarget?: (calorieGoal: number, proteinGoalPct: number, carbGoalPct: number, fatGoalPct: number) => void;
  activeSubTab?: "hydration" | "weight" | "nutrition";
  onSubTabChange?: (tab: "hydration" | "weight" | "nutrition") => void;
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
  onTriggerTestNotification,
  onUpdateWaterConfig,
  onLogFood,
  onRemoveFood,
  onUpdateCalorieTarget,
  activeSubTab,
  onSubTabChange
}: HealthTabProps) {
  const [localSubTab, setLocalSubTab] = useState<"hydration" | "weight" | "nutrition">("hydration");
  const currentSubTab = activeSubTab !== undefined ? activeSubTab : localSubTab;

  const changeSubTab = (newTab: "hydration" | "weight" | "nutrition") => {
    if (onSubTabChange) {
      onSubTabChange(newTab);
    } else {
      setLocalSubTab(newTab);
    }
  };

  // Nutrition state variables
  const [innerFoodSearch, setInnerFoodSearch] = useState("");
  const [innerFoodSearchDb, setInnerFoodSearchDb] = useState<"all" | "afcd" | "off">("all");
  const [innerSearchResults, setInnerSearchResults] = useState<any[]>([]);
  const [isInnerSearching, setIsInnerSearching] = useState(false);
  const [innerSelectedProduct, setInnerSelectedProduct] = useState<any | null>(null);
  const [innerMultiplier, setInnerMultiplier] = useState(1);
  const [innerSearchError, setInnerSearchError] = useState("");

  // Calorie & macro trackers
  const todayDateStr = new Date().toDateString();
  const foodTodayItems = userState.foodLog?.[todayDateStr] || [];
  
  const calGoal = userState.calorieGoal || 2000;
  const pPct = userState.proteinGoalPct || 30;
  const cPct = userState.carbGoalPct || 40;
  const fPct = userState.fatGoalPct || 30;
  
  const protGramsGoal = Math.round((calGoal * (pPct / 100)) / 4);
  const carbGramsGoal = Math.round((calGoal * (cPct / 100)) / 4);
  const fatGramsGoal = Math.round((calGoal * (fPct / 100)) / 9);
  
  const calsConsumed = foodTodayItems.reduce((sum, f) => sum + (f.calories * (f.quantity || 1)), 0);
  const protConsumed = Math.round(foodTodayItems.reduce((sum, f) => sum + ((f.protein || 0) * (f.quantity || 1)), 0));
  const carbsConsumed = Math.round(foodTodayItems.reduce((sum, f) => sum + ((f.carbs || 0) * (f.quantity || 1)), 0));
  const fatConsumed = Math.round(foodTodayItems.reduce((sum, f) => sum + ((f.fat || 0) * (f.quantity || 1)), 0));
  
  const calorieProgress = calGoal > 0 ? Math.min(1, calsConsumed / calGoal) : 0;

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

  // AI Supplement state variables
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRecs, setAiRecs] = useState<Array<{
    name: string;
    dosage: string;
    times: string[];
    reason: string;
    selected?: boolean;
  }>>([]);

  const handleFetchAiRecommendations = async () => {
    if (!aiGoal.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiRecs([]);
    try {
      const res = await fetch("/api/generate-supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: aiGoal })
      });
      if (!res.ok) {
        throw new Error("Service is temporarily busy. Please try again.");
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.supplements && Array.isArray(data.supplements)) {
        setAiRecs(data.supplements.map((s: any) => ({ ...s, selected: true })));
      } else {
        throw new Error("Received malformed recommendation guidelines.");
      }
    } catch (err: any) {
      setAiError(err.message || "Failed to generate recommendations.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddAiSupplements = () => {
    const selected = aiRecs.filter(s => s.selected);
    if (selected.length === 0) return;

    selected.forEach(s => {
      const finalScheduledTimes: Record<string, string> = {};
      s.times.forEach(slotKey => {
        finalScheduledTimes[slotKey] = slotKey === "morning" ? "08:00" :
                                      slotKey === "afternoon" ? "13:00" :
                                      slotKey === "evening" ? "18:00" :
                                      "21:30";
      });
      onAddSupplement(s.name, s.dosage, s.times, finalScheduledTimes);
    });

    setAiGoal("");
    setAiRecs([]);
    setAiModalOpen(false);
  };

  // Weight entry state
  const [weightInput, setWeightInput] = useState("");

  // Water config setting states
  const DEFAULT_WATER_CONFIG: WaterConfig = {
    containerType: "glass",
    capacity: 250,
    capacityUnit: "ml",
    creatineEnabled: false,
    creatineAmount: 5,
    stimulantsEnabled: false,
    stimulantsAmount: 150,
    height: 175,
    weight: 75,
    age: 28,
    aiExplanation: "Proper hydration sustains metabolic speed, supports muscular protein synthesis during training, and coordinates electrolyte saturation for optimal nerve transmission.",
    calculatedGoalMl: 2000
  };

  const [showWaterSettings, setShowWaterSettings] = useState(false);
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("75");
  const [age, setAge] = useState("28");
  const [containerType, setContainerType] = useState<"bottle" | "glass">("glass");
  const [capacity, setCapacity] = useState("250");
  const [capacityUnit, setCapacityUnit] = useState<"ml" | "lt" | "oz">("ml");
  const [creatineEnabled, setCreatineEnabled] = useState(false);
  const [creatineAmount, setCreatineAmount] = useState("5");
  const [stimulantsEnabled, setStimulantsEnabled] = useState(false);
  const [stimulantsAmount, setStimulantsAmount] = useState("150");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Sync effect
  useEffect(() => {
    const config = userState.waterConfig || DEFAULT_WATER_CONFIG;
    setHeight(config.height?.toString() || "175");
    setWeight(config.weight?.toString() || "75");
    setAge(config.age?.toString() || "28");
    setContainerType(config.containerType || "glass");
    setCapacity(config.capacity?.toString() || (config.containerType === "bottle" ? "1000" : "250"));
    setCapacityUnit(config.capacityUnit || "ml");
    setCreatineEnabled(!!config.creatineEnabled);
    setCreatineAmount(config.creatineAmount?.toString() || "5");
    setStimulantsEnabled(!!config.stimulantsEnabled);
    setStimulantsAmount(config.stimulantsAmount?.toString() || "150");
  }, [userState.waterConfig]);

  const handleSaveWaterConfig = async () => {
    setSavingSettings(true);
    setSettingsError("");

    const heightNum = parseFloat(height) || 175;
    let weightNum = parseFloat(weight) || 75;
    // If unit lb is used internally weight is converted is for raw formula
    let formulaWeight = weightNum;
    if (userState.useLb) {
      formulaWeight = Math.round(weightNum * 0.453592 * 10) / 10;
    }
    const ageNum = parseInt(age) || 28;
    const capacityNum = parseFloat(capacity) || (containerType === "bottle" ? 1000 : 250);
    const creatineAmtNum = parseFloat(creatineAmount) || 5;
    const stimulantsAmtNum = parseFloat(stimulantsAmount) || 150;

    // 1. Snappy local calculation for immediate UI updates
    let calculatedGoalMl = Math.round(formulaWeight * 35);
    if (creatineEnabled) {
      calculatedGoalMl += 750;
    }
    if (stimulantsEnabled) {
      calculatedGoalMl += 300;
    }
    calculatedGoalMl = Math.min(6000, Math.max(1500, calculatedGoalMl));

    const localExplanation = `Based on your metrics of ${weightNum}${userState.useLb ? "lb" : "kg"}, customized container capacity, and supplement profile, you require approximately ${calculatedGoalMl} ml to sustain physiological cellular hydration.`;

    const configUpdate: WaterConfig = {
      height: heightNum,
      weight: weightNum,
      age: ageNum,
      containerType,
      capacity: capacityNum,
      capacityUnit,
      creatineEnabled,
      creatineAmount: creatineAmtNum,
      stimulantsEnabled,
      stimulantsAmount: stimulantsAmtNum,
      aiExplanation: localExplanation,
      calculatedGoalMl
    };

    if (onUpdateWaterConfig) {
      onUpdateWaterConfig(configUpdate);
    }

    try {
      // 2. Refresh with Gemini analysis in base system
      const res = await fetch("/api/water-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height: heightNum,
          weight: formulaWeight,
          age: ageNum,
          creatineEnabled,
          creatineAmount: creatineAmtNum,
          stimulantsEnabled,
          stimulantsAmount: stimulantsAmtNum,
          containerType,
          capacity: capacityNum,
          capacityUnit
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.recommendedGoalMl && data.aiExplanation) {
          if (onUpdateWaterConfig) {
            onUpdateWaterConfig({
              ...configUpdate,
              calculatedGoalMl: data.recommendedGoalMl,
              aiExplanation: data.aiExplanation
            });
          }
        }
      }
    } catch (err) {
      console.warn("AI recommendation fetching failed, utilizing robust mathematical fallback", err);
    } finally {
      setSavingSettings(false);
      setShowWaterSettings(false);
    }
  };

  const todayKey = new Date().toISOString().slice(0, 10);

  // Water calculations
  const wConfig: WaterConfig = userState.waterConfig || DEFAULT_WATER_CONFIG;

  const getCapacityInMl = (cap: number, unit: "ml" | "lt" | "oz"): number => {
    if (unit === "lt") return cap * 1000;
    if (unit === "oz") return cap * 29.5735;
    return cap;
  };

  const wUnitSizeMl = getCapacityInMl(wConfig.capacity, wConfig.capacityUnit);
  const targetUnits = userState.waterGoal > 0 && wUnitSizeMl > 0 
    ? Math.round((userState.waterGoal / wUnitSizeMl) * 10) / 10 
    : 0;

  const unitsDone = userState.waterLog[todayKey] || 0;
  const mlDone = unitsDone * wUnitSizeMl;
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
          onClick={() => changeSubTab("hydration")}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            currentSubTab === "hydration"
              ? "bg-gradient-to-r from-[#3ab4f2] to-[#1e7fc4] text-[#0d0b14]"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          💧 Hydration
        </button>
        <button
          onClick={() => changeSubTab("nutrition")}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            currentSubTab === "nutrition"
              ? "bg-gradient-to-r from-[#f43f5e] to-pink-600 text-white"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          🍳 Nutrition
        </button>
        <button
          onClick={() => changeSubTab("weight")}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            currentSubTab === "weight"
              ? "bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14]"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          ⚖️ Weight Log
        </button>
      </div>

      {/* HYDRATION SCREEN */}
      {currentSubTab === "hydration" && (
        <>
          {/* Water card logger */}
          <div className="bg-[#13111f] border border-[#2a2440] p-5 rounded-2xl shadow">
            <div className="flex justify-between items-center mb-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
                  Water Hydration Target
                </span>
                <span className="text-[9px] font-mono text-[#3ab4f2]/70">
                  {Math.round(mlDone)} / {userState.waterGoal} ml
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-2xl font-bold font-bebas text-[#3ab4f2] leading-none" id="water-bottles-consumed-count">
                    {unitsDone}
                  </span>
                  <span className="text-[10px] text-[#6b6485] font-bold">
                    / {Math.round(targetUnits * 10) / 10} {wConfig.containerType === 'bottle' ? 'bottles' : 'glasses'}
                  </span>
                </div>
                
                {/* Premium Minimal Settings Gear */}
                <button
                  type="button"
                  onClick={() => setShowWaterSettings(true)}
                  className="p-1 px-1.5 text-[#6b6485] hover:text-[#3ab4f2] hover:bg-[#1f1a3a] rounded-lg transition-all active:scale-90 cursor-pointer"
                  title="Configure physical hydration settings"
                  id="water-settings-gear-btn"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
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

            {/* Premium, Minimal Log Input Console */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex gap-2">
                {/* Primary Wide Action Logging Button */}
                <button
                  type="button"
                  onClick={() => onLogWater("increment")}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#3ab4f2] to-[#1e7fc4] hover:brightness-105 active:scale-[0.98] text-[#0d0b14] font-bold font-mono text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  id="add-water-unit-btn"
                >
                  <span className="text-[14px]">
                    {wConfig.containerType === 'bottle' ? '🍶' : '🥛'}
                  </span>
                  Add {wConfig.containerType === 'bottle' ? 'Bottle' : 'Glass'} (+{wConfig.capacity}{wConfig.capacityUnit})
                </button>

                {/* Optional Decrement minus adjuster */}
                {unitsDone > 0 && (
                  <button
                    type="button"
                    onClick={() => onLogWater("decrement")}
                    className="px-4 bg-[#17142a] border border-[#2a2440] hover:border-red-500/30 text-[#6b6485] hover:text-red-400 rounded-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center"
                    title="Remove logged container unit"
                    id="remove-water-unit-btn"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Toggle Analysis Button */}
              <button
                type="button"
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="w-full mt-1.5 py-3.5 px-4 bg-[#1b1735] hover:bg-[#231d45] border border-[#2b2452] text-[#8ce0ff] hover:text-white font-mono text-[11px] font-bold tracking-wider rounded-xl hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center shadow-sm"
                id="toggle-water-analysis-btn"
              >
                <span>{showAnalysis ? "Hide Hydration Analysis 🔬" : "View Personalized Hydration Analysis 🔬"}</span>
              </button>

              {unitsDone > 0 && (
                <button
                  type="button"
                  onClick={onResetWater}
                  className="self-center mt-1 text-[10px] text-[#6b6485] hover:text-white underline font-mono cursor-pointer transition-colors"
                  id="reset-water-btn"
                >
                  Reset today's hydration logs
                </button>
              )}
            </div>
          </div>

          {/* Underneath Hydration explanation block - Why you need this water */}
          <AnimatePresence>
            {showAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-3 p-4 bg-[#15122b]/50 border border-[#231d3d] rounded-xl flex gap-3 items-start relative overflow-hidden shadow"
              >
                <div className="absolute top-0 left-0 h-full w-1 bg-[#3ab4f2]" />
                <div className="text-base select-none mt-0.5 leading-none" aria-hidden="true">🔬</div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-[#3ab4f2] font-semibold leading-none">
                    Physiological Hydration Analysis
                  </span>
                  <p className="text-[11px] text-[#9991b8] leading-relaxed font-sans">
                    {wConfig.aiExplanation || "Input your personalized metrics using the gear icon to calculate your scientific baseline daily hydration needs."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

      {/* WATER CONFIG SETTINGS GEAR MODAL */}
      <AnimatePresence>
        {showWaterSettings && (
          <div className="fixed inset-0 bg-[#07050bdd]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#13111f] border border-[#2a2440] rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#221d35]">
                <h3 className="font-bebas text-2xl tracking-wider text-[#e8e3f8] flex items-center gap-1.5 leading-none">
                  ⚙️ Hydration Calculator
                </h3>
                <button
                  type="button"
                  onClick={() => setShowWaterSettings(false)}
                  className="text-[#6b6485] hover:text-white p-1 text-base font-bold select-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Height Weight Age row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#6b6485] uppercase">Height</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      value={height}
                      onChange={e => setHeight(e.target.value)}
                      placeholder="175"
                      className="w-full bg-[#17142a] border border-[#221d35] rounded-xl p-2 text-xs text-center text-white focus:outline-none"
                    />
                    <span className="absolute right-2 text-[8px] font-mono text-[#6b6485] pointer-events-none">cm</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#6b6485] uppercase">
                    Weight ({userState.useLb ? "lb" : "kg"})
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      placeholder={userState.useLb ? "165" : "75"}
                      className="w-full bg-[#17142a] border border-[#221d35] rounded-xl p-2 text-xs text-center text-white focus:outline-none"
                    />
                    <span className="absolute right-2 text-[8px] font-mono text-[#6b6485] pointer-events-none">
                      {userState.useLb ? "lb" : "kg"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#6b6485] uppercase">Age</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="28"
                      className="w-full bg-[#17142a] border border-[#221d35] rounded-xl p-2 text-xs text-center text-white focus:outline-none"
                    />
                    <span className="absolute right-2 text-[8px] font-mono text-[#6b6485] pointer-events-none">yrs</span>
                  </div>
                </div>
              </div>

              {/* Container Selection & Size */}
              <div className="flex flex-col gap-2.5 bg-[#17142a] border border-[#221d35]/60 p-3 rounded-2xl">
                <span className="text-[9px] font-mono text-[#6b6485] uppercase tracking-wider">
                  Receptacle Type & Unit Volume
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setContainerType("glass")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      containerType === "glass"
                        ? "bg-[#3ab4f2]/10 border-[#3ab4f2] text-[#3ab4f2]"
                        : "bg-transparent border-[#221d35] text-[#6b6485] hover:text-[#9991b8]"
                    }`}
                  >
                    🥛 Glass
                  </button>
                  <button
                    type="button"
                    onClick={() => setContainerType("bottle")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      containerType === "bottle"
                        ? "bg-[#3ab4f2]/10 border-[#3ab4f2] text-[#3ab4f2]"
                        : "bg-transparent border-[#221d35] text-[#6b6485] hover:text-[#9991b8]"
                    }`}
                  >
                    Bottle
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      value={capacity}
                      onChange={e => setCapacity(e.target.value)}
                      placeholder={containerType === "bottle" ? "1000" : "250"}
                      className="w-full bg-[#0c0914] border border-[#221d35] rounded-xl p-2 text-xs text-center text-white focus:outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 bg-[#0c0914] border border-[#221d35] rounded-xl p-0.5 text-[10px] font-mono">
                    {(["ml", "lt", "oz"] as const).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setCapacityUnit(u)}
                        className={`py-1 rounded-md text-center transition-all cursor-pointer font-bold ${
                          capacityUnit === u ? "bg-[#3ab4f2] text-[#0d0b14]" : "text-[#6b6485] hover:text-[#beb3f5]"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Creatine Supplement */}
              <div className="flex flex-col gap-2 bg-[#17142a] border border-[#221d35]/60 p-3 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-[#e8e3f8] flex items-center gap-1.5">
                    💊 Taking Creatine?
                  </span>
                  <input
                    type="checkbox"
                    checked={creatineEnabled}
                    onChange={e => setCreatineEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a2440] text-[#3ab4f2] focus:ring-0 focus:ring-offset-0 bg-[#0c0914] cursor-pointer"
                  />
                </div>
                {creatineEnabled && (
                  <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-[#221d35]/50">
                    <span className="text-[10px] text-[#6b6485] font-mono">DAILY DOSAGE:</span>
                    <div className="relative flex items-center max-w-[100px]">
                      <input
                        type="number"
                        value={creatineAmount}
                        onChange={e => setCreatineAmount(e.target.value)}
                        placeholder="5"
                        className="w-full bg-[#0c0914] border border-[#221d35] rounded-lg py-1 px-2.5 text-xs text-center text-white focus:outline-none"
                      />
                      <span className="absolute right-2 text-[8px] font-mono text-[#6b6485] pointer-events-none">g</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stimulants Supplement */}
              <div className="flex flex-col gap-2 bg-[#17142a] border border-[#221d35]/60 p-3 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-[#e8e3f8] flex items-center gap-1.5">
                    ☕ Taking Stimulants / Caffeine?
                  </span>
                  <input
                    type="checkbox"
                    checked={stimulantsEnabled}
                    onChange={e => setStimulantsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a2440] text-[#3ab4f2] focus:ring-0 focus:ring-offset-0 bg-[#0c0914] cursor-pointer"
                  />
                </div>
                {stimulantsEnabled && (
                  <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-[#221d35]/50">
                    <span className="text-[10px] text-[#6b6485] font-mono">DAILY ESTIMATE:</span>
                    <div className="relative flex items-center max-w-[100px]">
                      <input
                        type="number"
                        value={stimulantsAmount}
                        onChange={e => setStimulantsAmount(e.target.value)}
                        placeholder="150"
                        className="w-full bg-[#0c0914] border border-[#221d35] rounded-lg py-1 px-2.5 text-xs text-center text-white focus:outline-none"
                      />
                      <span className="absolute right-2 text-[8px] font-mono text-[#6b6485] pointer-events-none">mg</span>
                    </div>
                  </div>
                )}
              </div>

              {settingsError && (
                <div className="text-[10px] text-red-400 font-mono text-center">
                  ⚠️ {settingsError}
                </div>
              )}

              <button
                type="button"
                disabled={savingSettings}
                onClick={handleSaveWaterConfig}
                className="w-full py-3 bg-gradient-to-r from-[#3ab4f2] to-[#1e7fc4] text-[#0d0b14] font-bold font-mono text-xs rounded-xl shadow cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 flex items-center justify-center gap-1.5"
                id="save-hydration-settings-btn"
              >
                {savingSettings ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-[#0d0b14] border-t-transparent rounded-full animate-spin" />
                    Calculating with AI...
                  </span>
                ) : (
                  "Save & Optimize with AI"
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplements checklist portion */}
      <div className="flex justify-between items-center mt-3 mb-1 flex-wrap gap-1.5">
        <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
              Daily Supplements
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setAiModalOpen(true)}
                className="bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-lg shadow cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <span>✨</span> AI Recommend
              </button>
              <button
                onClick={() => {
                  setSuppName("");
                  setSuppDosage("");
                  setSelectedSlots([]);
                  setSuppModalOpen(true);
                }}
                className="bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-lg shadow cursor-pointer active:scale-95"
              >
                + Add Custom
              </button>
            </div>
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
      {currentSubTab === "weight" && (
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

      {/* NUTRITION SCREEN */}
      {currentSubTab === "nutrition" && (
        <>
          {/* Dynamic Stacked Macro Goal status cards */}
          <div className="bg-[#13111f] border border-[#2a2440] p-5 rounded-2xl shadow-sm text-left">
            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block mb-3">Today's Daily Caloric Balance</span>

            {/* Calorie Progress Indicator */}
            <div className="flex justify-between items-baseline mb-2">
              <span className="font-bebas text-2xl text-pink-300 font-bold tracking-wide">
                {Math.round(calsConsumed).toLocaleString()} / {calGoal.toLocaleString()} kcal
              </span>
              <span className="text-[10px] text-[#6b6485] font-mono font-bold">
                {Math.round(calorieProgress * 100)}% Consumed
              </span>
            </div>

            {/* Micro calorie bar */}
            <div className="h-2.5 bg-[#141125] border border-[#231c3b] rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-[#e07b3f] transition-all duration-500"
                style={{ width: `${calorieProgress * 100}%` }}
              />
            </div>
            
            <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block mb-3">Daily Energy Splitting Targets</span>
            
            {/* Horizontal high accuracy stacked macros representation */}
            <div className="h-4 bg-[#1a1728] rounded-full overflow-hidden flex border border-[#231c3a] select-none mb-4 my-1">
              {calorieProgress > 0 ? (
                <>
                  <div 
                    style={{ width: `${Math.round((protConsumed * 4 / (calsConsumed || 1)) * 100)}%` }} 
                    className="bg-indigo-400 h-full transition-all" 
                    title={`Protein contribution: ${Math.round(protConsumed * 4)} kcal`}
                  />
                  <div 
                    style={{ width: `${Math.round((carbsConsumed * 4 / (calsConsumed || 1)) * 100)}%` }} 
                    className="bg-green-400 h-full transition-all" 
                    title={`Carbohydrates contribution: ${Math.round(carbsConsumed * 4)} kcal`}
                  />
                  <div 
                    style={{ width: `${Math.round((fatConsumed * 9 / (calsConsumed || 1)) * 100)}%` }} 
                    className="bg-amber-400 h-full transition-all" 
                    title={`Fat contribution: ${Math.round(fatConsumed * 9)} kcal`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-[#1e1a30] flex items-center justify-center">
                  <span className="text-[8px] font-mono text-[#6b6485] uppercase animate-pulse">Waiting for meal logs...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono text-xs text-[#e8e3f8] text-center">
              <div className="bg-[#17142a] border border-indigo-500/15 p-2.5 rounded-xl">
                <span className="text-[8.5px] text-indigo-300 block font-bold">PROTEIN</span>
                <span className="text-sm font-bold block mt-1">{protConsumed}g <span className="text-[#6b6485] text-[9.5px]">/ {protGramsGoal}g</span></span>
              </div>
              <div className="bg-[#17142a] border border-green-500/15 p-2.5 rounded-xl">
                <span className="text-[8.5px] text-green-300 block font-bold">CARBS</span>
                <span className="text-sm font-bold block mt-1">{carbsConsumed}g <span className="text-[#6b6485] text-[9.5px]">/ {carbGramsGoal}g</span></span>
              </div>
              <div className="bg-[#17142a] border border-amber-500/15 p-2.5 rounded-xl">
                <span className="text-[8.5px] text-amber-300 block font-bold">LIPID FAT</span>
                <span className="text-sm font-bold block mt-1">{fatConsumed}g <span className="text-[#6b6485] text-[9.5px]">/ {fatGramsGoal}g</span></span>
              </div>
            </div>
          </div>

          {/* SEARCH & ADD DIRECTLY FROM JOURNAL FOR ULTRA-FAST COMPACT WORKFLOW */}
          <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-sm text-left">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">Direct Database search lookup</span>
                <span className="text-[7.5px] font-mono bg-pink-500/10 text-pink-300 px-2 py-0.5 rounded-full uppercase font-bold text-[7.5px]">Powered by AFCD & OFF</span>
              </div>
              
              {/* Database Source Config Bar */}
              <div className="flex items-center justify-between bg-[#0e0c17] border border-[#231d3d] rounded-xl p-1.5">
                <span className="text-[9px] font-mono text-[#6b6485] pl-1.5 uppercase font-bold">Database Source:</span>
                <div className="flex gap-1">
                   {(["all", "afcd", "off"] as const).map((db) => (
                     <button
                       key={db}
                       type="button"
                       onClick={() => setInnerFoodSearchDb(db)}
                       className={`px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                         innerFoodSearchDb === db
                           ? "bg-[#252044] text-pink-300 border border-pink-300/30"
                           : "text-[#6b6485] hover:text-[#e8e3f8] border border-transparent"
                       }`}
                     >
                       {db === "all" ? "All" : db === "afcd" ? "AFCD (Aust)" : "OpenFoodFacts"}
                     </button>
                   ))}
                </div>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!innerFoodSearch.trim()) return;
              setIsInnerSearching(true);
              setInnerSearchError("");
              try {
                const res = await fetch(`/api/food/search?q=${encodeURIComponent(innerFoodSearch)}&db=${innerFoodSearchDb}`);
                if (res.ok) {
                  const data = await res.json();
                  setInnerSearchResults(data || []);
                } else {
                  setInnerSearchError("Could not retrieve details. Limit reached.");
                }
              } catch (err) {
                setInnerSearchError("Network failure.");
              } finally {
                setIsInnerSearching(false);
              }
            }} className="flex gap-2">
              <input
                type="text"
                value={innerFoodSearch}
                onChange={(e) => setInnerFoodSearch(e.target.value)}
                placeholder="Search oatmeal, beef, salmon, yogurt..."
                className="flex-1 bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] placeholder-[#4d407a] rounded-xl px-3 py-2.5 focus:outline-none focus:border-pink-300"
              />
              <button
                type="submit"
                disabled={isInnerSearching}
                className="px-4 py-2 bg-[#17142a]/80 border border-[#2c264c] hover:border-pink-300 text-pink-300 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-40"
              >
                Find
              </button>
            </form>

            {innerSearchError && (
              <p className="text-[9px] font-mono text-red-400 mt-2 text-center">{innerSearchError}</p>
            )}

            {innerSelectedProduct ? (
              <div className="mt-3 bg-[#0d0b14] border border-[#2c264c] rounded-xl p-3.5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bebas text-sm text-pink-300 block">{innerSelectedProduct.brand || "Generic Food"}</span>
                    <span className="text-xs font-bold text-white block mt-0.5">{innerSelectedProduct.name}</span>
                  </div>
                  <button onClick={() => setInnerSelectedProduct(null)} className="text-[10px] text-gray-500 hover:text-white cursor-pointer font-bold">×</button>
                </div>

                <div className="grid grid-cols-4 gap-1 text-center font-mono text-[9px] border-y border-[#2c264c] py-2">
                  <div>
                    <span className="text-[#6b6485] block text-[7px]">CALORIES</span>
                    <span className="text-[#e8e3f8] font-bold block mt-0.5">{Math.round(innerSelectedProduct.calories * innerMultiplier)} kcal</span>
                  </div>
                  <div>
                    <span className="text-indigo-300 block text-[7px]">PROTEIN</span>
                    <span className="text-white font-bold block mt-0.5">{Math.round(innerSelectedProduct.protein * innerMultiplier)}g</span>
                  </div>
                  <div>
                    <span className="text-green-300 block text-[7px]">CARBS</span>
                    <span className="text-white font-bold block mt-0.5">{Math.round(innerSelectedProduct.carbs * innerMultiplier)}g</span>
                  </div>
                  <div>
                    <span className="text-amber-300 block text-[7px]">FAT</span>
                    <span className="text-white font-bold block mt-0.5">{Math.round(innerSelectedProduct.fat * innerMultiplier)}g</span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-[#13111f]/80 p-2 border border-[#2c264c]/40 rounded-lg">
                  <span className="text-[8px] font-mono text-[#9991b8] uppercase">Multiplier:</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <button type="button" onClick={() => setInnerMultiplier(p => Math.max(0.25, p - 0.25))} className="w-5 h-5 bg-[#17142a] border border-[#2c264d] text-white rounded text-center flex items-center justify-center">-</button>
                    <span className="font-bold min-w-[30px] text-center text-pink-300">{innerMultiplier.toFixed(2)}x</span>
                    <button type="button" onClick={() => setInnerMultiplier(p => p + 0.25)} className="w-5 h-5 bg-[#17142a] border border-[#2c264d] text-white rounded text-center flex items-center justify-center">+</button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onLogFood?.(
                      innerSelectedProduct.name,
                      innerSelectedProduct.calories,
                      innerSelectedProduct.protein,
                      innerSelectedProduct.carbs,
                      innerSelectedProduct.fat,
                      innerSelectedProduct.barcode,
                      innerMultiplier
                    );
                    setInnerSelectedProduct(null);
                    setInnerFoodSearch("");
                    setInnerSearchResults([]);
                  }}
                  className="w-full bg-pink-500 hover:bg-pink-400 text-white py-2 rounded-lg font-mono font-bold text-xs cursor-pointer uppercase transition-all shadow-md mt-1"
                >
                  LOG MEAL IMMEDIATELY
                </button>
              </div>
            ) : (
              innerSearchResults.length > 0 && (
                <div className="mt-3 max-h-36 overflow-y-auto flex flex-col gap-1 pr-1 border-t border-[#2c264d]/40 pt-2.5">
                  {innerSearchResults.map((prod, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInnerSelectedProduct(prod);
                        setInnerMultiplier(1);
                      }}
                      className="bg-[#17142a]/80 hover:bg-[#1a172e] border border-[#231e3d] text-left p-2 rounded-xl flex justify-between items-center transition-all cursor-pointer hover:translate-x-0.5"
                    >
                      <div className="truncate flex-1 pr-2">
                        <span className="text-[7.5px] font-mono font-semibold text-pink-400 uppercase tracking-wide block">{prod.brand}</span>
                        <span className="font-bebas text-xs text-white block mt-0.5 truncate">{prod.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#fbcfe8] font-bold shrink-0">{prod.calories} kcal →</span>
                    </button>
                  ))}
                </div>
              )
            )}

            {isInnerSearching && (
              <p className="text-[9.5px] font-mono text-[#6b6485] mt-2.5 text-center animate-pulse">Running OpenFoodFacts proxy lookup...</p>
            )}
          </div>

          {/* LIST OF INTRODUCED MEALS */}
          <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-sm text-left">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
                Meals Logged ({foodTodayItems.length})
              </span>
              <span className="text-[9.5px] font-mono font-bold text-pink-300">
                Total: {Math.round(calsConsumed)} kcal
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {foodTodayItems.length === 0 ? (
                <div className="text-center py-8 bg-[#17142a]/40 border border-dashed border-[#231e3d] rounded-2xl p-4">
                  <span className="text-2xl block mb-2 opacity-50 font-sans leading-none">🥣</span>
                  <p className="text-[10px] font-mono text-[#6b6485] leading-relaxed">
                    No food recorded today. Type keyword search above to fetch nutrition parameters and log meals details.
                  </p>
                </div>
              ) : (
                foodTodayItems.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-[#17142a] border border-[#2a2440] hover:border-pink-300/20 rounded-2xl p-3 flex justify-between items-center gap-3 transition-colors hover:bg-[#1a172f]"
                  >
                    <div className="min-w-0 flex-1 flex gap-2.5 items-center">
                      <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/15 flex items-center justify-center text-sm shrink-0">
                        {item.name.toLowerCase().includes("milk") || item.name.toLowerCase().includes("shake") || item.name.toLowerCase().includes("smoothie") ? "🥛" :
                         item.name.toLowerCase().includes("rice") || item.name.toLowerCase().includes("oatmeal") || item.name.toLowerCase().includes("carb") ? "🥣" :
                         item.name.toLowerCase().includes("chicken") || item.name.toLowerCase().includes("beef") || item.name.toLowerCase().includes("turkey") ? "🥩" :
                         item.name.toLowerCase().includes("salad") || item.name.toLowerCase().includes("vegetable") || item.name.toLowerCase().includes("cucumber") ? "🥗" :
                         item.name.toLowerCase().includes("fruit") || item.name.toLowerCase().includes("banana") || item.name.toLowerCase().includes("apple") ? "🍎" : "🍏"}
                      </div>
                      
                      <div className="min-w-0 flex-1 text-left">
                        <span className="font-bebas text-sm text-[#e8e3f8] leading-tight block truncate uppercase tracking-wider">{item.name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap font-mono text-[8.5px] text-[#6b6485] mt-1">
                          <span className="text-indigo-300/85">P: {Math.round((item.protein || 0) * (item.quantity || 1))}g</span>
                          <span>•</span>
                          <span className="text-green-300/85">C: {Math.round((item.carbs || 0) * (item.quantity || 1))}g</span>
                          <span>•</span>
                          <span className="text-amber-300/85">F: {Math.round((item.fat || 0) * (item.quantity || 1))}g</span>
                          {item.quantity && item.quantity !== 1 && (
                            <>
                              <span>•</span>
                              <span className="text-pink-300 font-bold">{item.quantity}x serv</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Calories and Delete option */}
                    <div className="flex items-center gap-3 font-mono">
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[#fbcfe8] block font-bebas tracking-wide">+{Math.round(item.calories * (item.quantity || 1))} kcal</span>
                        <span className="text-[7.5px] text-[#6b6485] block mt-0.5">{item.loggedAt || "08:15 AM"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove "${item.name}" from your daily diet log?`)) {
                            onRemoveFood?.(item.id);
                          }
                        }}
                        className="text-xs text-[#ff5c5c] hover:text-[#ff3b3b] p-1 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors text-center w-5 h-5 flex items-center justify-center font-bold"
                        title="Delete meal entry"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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

      {/* AI RECOMMENDATION MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-[#0d0b14cc] z-50 flex items-end justify-center">
          <div className="bg-[#0e0c1a] border-t border-x border-[#2a2440] rounded-t-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bebas text-2xl tracking-wider text-[#8b5cf6] block">AI Supplement Recommendation</span>
                <span className="block text-[8px] font-mono text-[#6b6485] uppercase tracking-wider mt-0.5 font-bold">Optimal Dosage & Timing Engine</span>
              </div>
              <button 
                onClick={() => setAiModalOpen(false)}
                className="w-6 h-6 rounded-full bg-[#17142a] border border-[#2a2440] text-gray-400 hover:text-white flex items-center justify-center font-bold text-xs"
              >
                ×
              </button>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] text-[#9991b8] font-mono uppercase tracking-wider block">Health & Performance Goals:</label>
              <textarea
                placeholder="Describe your goals (e.g. improve sleep & recovery, reduce stress & anxiety, boost daily focus, joint support for running)..."
                value={aiGoal}
                onChange={e => setAiGoal(e.target.value)}
                rows={3}
                className="w-full bg-[#13111f] border border-[#2a2440] rounded-xl p-3 text-xs font-mono text-white placeholder-[#2e2845] focus:outline-none focus:border-[#8b5cf6]"
              />
            </div>

            <button
              onClick={handleFetchAiRecommendations}
              disabled={aiLoading || !aiGoal.trim()}
              className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] hover:brightness-110 active:scale-[0.98] transition-all text-white font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {aiLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  <span>Formulating protocol...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Get AI Supplement Plan</span>
                </>
              )}
            </button>

            {aiError && (
              <div className="p-3 border border-red-500/25 bg-red-950/20 rounded-xl text-[10px] font-mono text-red-400 text-left">
                ⚠️ Error: {aiError}
              </div>
            )}

            {aiRecs.length > 0 && (
              <div className="space-y-3 mt-1.5">
                <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block text-left">Tailored Supplement Plan:</span>
                
                <div className="space-y-2.5 max-h-60 overflow-y-auto scrollbar-none pr-0.5 text-left">
                  {aiRecs.map((rec, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        setAiRecs(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
                      }}
                      className={`p-3 border rounded-xl bg-[#141224] cursor-pointer transition-all flex gap-3 ${
                        rec.selected ? "border-[#8b5cf6] bg-[#8b5cf6]/5 shadow-sm shadow-[#8b5cf6]/10" : "border-[#221d35] opacity-50"
                      }`}
                    >
                      <div className="pt-0.5">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold ${
                          rec.selected ? "bg-[#8b5cf6] border-[#8b5cf6] text-white" : "border-[#3d3657]"
                        }`}>
                          {rec.selected ? "✓" : ""}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono text-xs text-white font-semibold block leading-tight">{rec.name}</span>
                          <span className="font-mono text-[9px] text-[#8b5cf6] font-bold bg-[#8b5cf6]/10 px-1.5 py-0.2 rounded shrink-0">{rec.dosage}</span>
                        </div>
                        
                        <p className="font-mono text-[9px] text-[#9991b8] leading-relaxed mt-1">{rec.reason}</p>
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rec.times.map(t => (
                            <span key={t} className="text-[7.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-[#1e1a35] border border-[#2e2652] text-[#cbbfff] rounded-md font-semibold">
                              ⏰ {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 font-mono text-xs mt-2">
                  <button
                    onClick={() => setAiRecs([])}
                    className="flex-1 bg-[#13111f] border border-[#221d35] rounded-xl py-3 text-[#6b6485] hover:text-white"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleAddAiSupplements}
                    disabled={aiRecs.every(s => !s.selected)}
                    className="flex-grow bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white font-bold rounded-xl py-3 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    🚀 Add Scheduled ({aiRecs.filter(s => s.selected).length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
