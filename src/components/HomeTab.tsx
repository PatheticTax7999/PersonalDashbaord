import { useState, useEffect } from "react";
import { UserState, Goal, CalendarEvent } from "../types";
import { motion, AnimatePresence } from "motion/react";

const sortGoals = (goals: Goal[]): Goal[] => {
  return [...goals].sort((a, b) => {
    // Undone first
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    
    // Lightning first
    if (a.lightning && !b.lightning) return -1;
    if (!a.lightning && b.lightning) return 1;
    
    return 0;
  });
};

// Constants for slots and display
const HOUR_START = 6;
const HOUR_END = 24;

const TIME_SLOTS = [
  { key: "morning", label: "Morning", icon: "🌅", start: 6, end: 12 },
  { key: "afternoon", label: "Afternoon", icon: "☀️", start: 12, end: 17 },
  { key: "evening", label: "Evening", icon: "🌆", start: 17, end: 21 },
  { key: "night", label: "Night", icon: "🌙", start: 21, end: 24 }
];

interface HomeTabProps {
  userState: UserState;
  gcalAccessToken: string | null;
  gcalEvents: CalendarEvent[];
  gcalLoading: boolean;
  gcalError: string | null;
  onConnectGcal: () => void;
  onDisconnectGcal: () => void;
  onRefreshGcal: () => void;
  onToggleGoal: (id: string) => void;
  onAddTodayGoal: (text: string, priority?: "high" | "medium" | "low") => void;
  onRemoveTodayGoal: (id: string) => void;
  onAddTomorrowGoal: (text: string, priority?: "high" | "medium" | "low") => void;
  onRemoveTomorrowGoal: (id: string) => void;
  onToggleSuppCheck: (suppId: string, slotKey: string) => void;
  onToggleLightningGoal?: (id: string, isToday: boolean) => void;
  onMoveActiveToTomorrow?: () => void;
  onMoveGoal?: (id: string, fromList: "today" | "tomorrow", toList: "today" | "tomorrow") => void;
  onLogFood?: (name: string, calories: number, protein: number, carbs: number, fat: number, barcode?: string, quantity?: number) => void;
  onRemoveFood?: (id: string) => void;
  onUpdateCalorieTarget?: (calorieGoal: number, proteinGoalPct: number, carbGoalPct: number, fatGoalPct: number) => void;
  onNavigateToNutrition?: () => void;
  onLogWater?: (action: "increment" | "decrement") => void;
}

export default function HomeTab({
  userState,
  gcalAccessToken,
  gcalEvents,
  gcalLoading,
  gcalError,
  onConnectGcal,
  onDisconnectGcal,
  onRefreshGcal,
  onToggleGoal,
  onAddTodayGoal,
  onRemoveTodayGoal,
  onAddTomorrowGoal,
  onRemoveTomorrowGoal,
  onToggleSuppCheck,
  onToggleLightningGoal,
  onMoveActiveToTomorrow,
  onMoveGoal,
  onLogFood,
  onRemoveFood,
  onUpdateCalorieTarget,
  onNavigateToNutrition,
  onLogWater
}: HomeTabProps) {
  const [now, setNow] = useState(new Date());
  const [newTodayText, setNewTodayText] = useState("");
  const [newTomorrowText, setNewTomorrowText] = useState("");
  const [isDragOverToday, setIsDragOverToday] = useState(false);
  const [isDragOverTomorrow, setIsDragOverTomorrow] = useState(false);

  // Swipeable Calorie Wheels and Nutrition modals state
  const [activeWheelPage, setActiveWheelPage] = useState<"clock" | "calories">("clock");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [innerFoodSearch, setInnerFoodSearch] = useState("");
  const [innerFoodSearchDb, setInnerFoodSearchDb] = useState<"all" | "afcd" | "off">("all");
  const [innerSearchResults, setInnerSearchResults] = useState<any[]>([]);
  const [isInnerSearching, setIsInnerSearching] = useState(false);
  const [innerSelectedProduct, setInnerSelectedProduct] = useState<any | null>(null);
  const [innerMultiplier, setInnerMultiplier] = useState(1);
  const [innerSearchError, setInnerSearchError] = useState("");

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Time & Percent calculation
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  };
  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  };
  const getGreeting = (d: Date) => {
    const h = d.getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };
  
  const getDayPctVal = (d: Date) => {
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.min(1, Math.max(0, (h - HOUR_START) / (HOUR_END - HOUR_START)));
  };

  const p = getDayPctVal(now);
  const size = 180;

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
  
  const calsRemaining = Math.max(0, calGoal - calsConsumed);
  const calorieProgress = calGoal > 0 ? Math.min(1, calsConsumed / calGoal) : 0;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - p);
  const angle = p * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const cx = size / 2 + r * Math.cos(rad);
  const cy = size / 2 + r * Math.sin(rad);

  const doneGoalsCount = userState.todayGoals.filter(g => g.done).length;
  const totalGoalsCount = userState.todayGoals.length;
  const goalsPct = totalGoalsCount === 0 ? 0 : Math.round((doneGoalsCount / totalGoalsCount) * 100);

  // GCal functions helper
  const fmtEventTime = (ev: CalendarEvent) => {
    if (ev.start?.dateTime) {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime || "");
      const fmt = (d: Date) => d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
      return `${fmt(s)} – ${fmt(e)}`;
    }
    return "All day";
  };

  const isEventNow = (ev: CalendarEvent) => {
    if (!ev.start?.dateTime) return false;
    const nowTime = Date.now();
    return nowTime >= new Date(ev.start.dateTime).getTime() && nowTime <= new Date(ev.end.dateTime || "").getTime();
  };

  const isEventPast = (ev: CalendarEvent) => {
    if (!ev.start?.dateTime) return false;
    return Date.now() > new Date(ev.end.dateTime || "").getTime();
  };

  const getSuppUrgency = (slot: typeof TIME_SLOTS[0]) => {
    const h = now.getHours();
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
    const today = new Date().toISOString().slice(0, 10);
    return !!(userState.suppChecks[today]?.[`${suppId}_${slotKey}`]);
  };

  // Build Daily Schedule items
  const buildTodaySchedule = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const items: Array<
      | { type: "event"; ev: CalendarEvent; sortKey: string }
      | { type: "goal"; goal: Goal; sortKey: string }
      | { type: "supps"; slot: typeof TIME_SLOTS[0]; supps: typeof userState.supplements; sortKey: string }
    > = [];

    gcalEvents.forEach(ev => {
      const startStr = ev.start?.dateTime || ev.start?.date;
      if (startStr && startStr.slice(0, 10) === todayStr) {
        items.push({ type: "event", ev, sortKey: ev.start?.dateTime || ev.start?.date || "0000" });
      }
    });

    userState.todayGoals.forEach(g => {
      items.push({ type: "goal", goal: g, sortKey: "anytime" });
    });

    const slotTimes: Record<string, string> = { morning: "06:00", afternoon: "12:00", evening: "17:00", night: "21:00" };

    TIME_SLOTS.forEach(slot => {
      const supps = userState.supplements.filter(s => s.times.includes(slot.key));
      if (supps.length) {
        items.push({ type: "supps", slot, supps, sortKey: `${todayStr}T${slotTimes[slot.key]}` });
      }
    });

    items.sort((a, b) => {
      if (a.sortKey === "anytime" && b.sortKey !== "anytime") return -1;
      if (b.sortKey === "anytime" && a.sortKey !== "anytime") return 1;
      return a.sortKey.localeCompare(b.sortKey);
    });

    return items;
  };

  const scheduleItems = buildTodaySchedule();
  const hasActiveGoalsToday = userState.todayGoals.some(g => !g.done);
  const isAroundNinePM = now.getHours() >= 21 || now.getHours() < 5;

  // Build high-density market stock ticker data from today's actual goals
  const buildTickerItems = () => {
    const defaultTicker = [
      { text: "MARKET_INTEGRAL", val: "▲ STABLE", color: "text-emerald-400" },
      { text: "DAILY_STREAK", val: `▲ +${userState.taskStreak || 0}`, color: "text-emerald-400" },
      { text: "HYDRATION_INDEX", val: "▲ COMPLIANT", color: "text-emerald-400" },
      { text: "METRIC_INTELLIGENCE", val: "▲ LIVE", color: "text-emerald-400" }
    ];

    if (userState.todayGoals.length === 0) {
      return defaultTicker;
    }

    return userState.todayGoals.map(g => {
      let code = g.text.trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/__+/g, "_")
        .replace(/^_+|_+$/g, "");
      
      if (!code) code = "TASK_INDEX_VAL";
      if (code.length > 15) code = code.slice(0, 14) + "…";
      
      if (g.done) {
        return {
          text: code,
          val: "▲ COMPLETED",
          color: "text-emerald-400"
        };
      } else if (g.lightning) {
        return {
          text: code,
          val: "⚡ HIGH_ENERGY",
          color: "text-yellow-400"
        };
      } else {
        return {
          text: code,
          val: "▼ ACTIVE",
          color: "text-sky-400 select-none"
        };
      }
    });
  };

  const tickerItems = buildTickerItems();

  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    if (tickerItems.length <= 1) return;
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % tickerItems.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [tickerItems.length]);

  useEffect(() => {
    if (tickerIndex >= tickerItems.length) {
      setTickerIndex(0);
    }
  }, [tickerItems.length, tickerIndex]);

  return (
    <div className="w-full max-w-md mx-auto py-6 px-4 pb-28 flex flex-col gap-5">
      {/* Date and Greeting */}
      <div className="text-center">
        <div className="text-[10px] text-[#6b6485] tracking-widest uppercase font-mono mb-1">
          {formatDate(now)}
        </div>
        <div className="text-3xl font-serif text-[#e8e3f8] font-semibold">
          {getGreeting(now)}
        </div>
      </div>

      {/* NASDAQ/ASX Stock Ticker */}
      <div className="bg-[#0f0d1b] border border-[#231e3d] rounded-xl py-2 px-3 flex items-center overflow-hidden h-9 select-none shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        {/* Trading index green label */}
        <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-emerald-400 border-r border-[#231e3d] pr-3 shrink-0">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span>GOALS</span>
        </div>
        
        {/* Rolling smooth vertical marquee panel */}
        <div className="flex-grow overflow-hidden relative ml-3 h-full flex items-center">
          <AnimatePresence mode="wait">
            {tickerItems[tickerIndex] && (
              <motion.div
                key={tickerIndex}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -15, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center gap-1.5 absolute left-0 right-0"
              >
                <span className="text-[#6b6485] truncate max-w-[180px] text-[10px] uppercase">{tickerItems[tickerIndex].text}</span>
                <span className={`font-bold text-[10px] shrink-0 ${tickerItems[tickerIndex].color}`}>{tickerItems[tickerIndex].val}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Clock / Calorie Wheel Swipeable Container */}
      <div className="flex flex-col items-center">
        <div 
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX === null) return;
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (diff > 45) {
              setActiveWheelPage("calories");
            } else if (diff < -45) {
              setActiveWheelPage("clock");
            }
            setTouchStartX(null);
          }}
          className="relative w-full max-w-sm flex items-center justify-center my-1 select-none"
        >
          {/* Left Arrow paging handler */}
          <button
            onClick={() => setActiveWheelPage(activeWheelPage === "clock" ? "calories" : "clock")}
            className="absolute left-1 md:left-2 p-2 bg-[#1c1a30] hover:bg-[#282544] border border-[#2d294d] text-[#9991b8] hover:text-[#f0c972] rounded-full transition-all z-20 active:scale-90 cursor-pointer"
            title="Switch wheel"
          >
            ←
          </button>

          <AnimatePresence mode="wait">
            {activeWheelPage === "clock" ? (
              <motion.div
                key="clock-wheel"
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 60, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="relative flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                <svg width={size} height={size} style={{ filter: "drop-shadow(0 0 12px rgba(240, 201, 114, 0.15))" }}>
                  <defs>
                    <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f0c972" />
                      <stop offset="100%" stopColor="#e07b3f" />
                    </linearGradient>
                  </defs>
                  <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1a30" strokeWidth={stroke} />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="url(#wg)"
                    strokeWidth={stroke}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                  {p > 0.01 && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4.5"
                      fill="#f0c972"
                      style={{ filter: "drop-shadow(0 0 4px #f0c972)" }}
                    />
                  )}
                </svg>
                {/* Central text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-serif text-[#f0c972] font-semibold mb-0.5">
                    {formatTime(now)}
                  </span>
                  <span className="text-[10px] text-[#9991b8] font-mono">
                    {Math.round(p * 100)}% of day
                  </span>
                  <span className="text-[8px] text-[#6b6485] font-mono mt-0.5">
                    {HOUR_START}:00 → {HOUR_END}:00
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="calorie-wheel"
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={() => {
                  if (onNavigateToNutrition) {
                    onNavigateToNutrition();
                  } else {
                    setShowNutritionModal(true);
                  }
                }}
                className="relative flex items-center justify-center cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
                style={{ width: size, height: size }}
                title="Tap to review daily nutrition details"
              >
                <svg width={size} height={size} style={{ filter: "drop-shadow(0 0 12px rgba(244, 63, 94, 0.15))" }}>
                  <defs>
                    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fbcfe8" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                  </defs>
                  <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1a30" strokeWidth={stroke} />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="url(#calGrad)"
                    strokeWidth={stroke}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - calorieProgress)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                {/* Central text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                  <span className="text-2xl font-serif text-pink-300 font-bold tracking-tight mb-0.5">
                    {calsRemaining.toLocaleString()}
                  </span>
                  <span className="text-[8.5px] text-[#9991b8] font-mono uppercase tracking-wider">
                    kcal left
                  </span>
                  <span className="text-[7.5px] text-[#6b6485] font-mono mt-1">
                    Eaten: {Math.round(calsConsumed)} / {calGoal}
                  </span>
                  <span className="text-[8px] text-pink-400 font-mono font-bold mt-1.5 uppercase tracking-widest bg-pink-500/10 px-2 py-0.5 rounded-full animate-pulse">
                    Open Journal 📊
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Arrow paging handler */}
          <button
            onClick={() => setActiveWheelPage(activeWheelPage === "clock" ? "calories" : "clock")}
            className="absolute right-1 md:right-2 p-2 bg-[#1c1a30] hover:bg-[#282544] border border-[#2d294d] text-[#9991b8] hover:text-[#f0c972] rounded-full transition-all z-20 active:scale-90 cursor-pointer"
            title="Switch wheel"
          >
            →
          </button>
        </div>

        {/* Triple micro macro circles row to give instant feedback (conforming to first request sidecar macro data display style) */}
        {activeWheelPage === "calories" && (
          <div 
            onClick={() => onNavigateToNutrition?.()}
            className="grid grid-cols-3 gap-6 my-2 w-full max-w-sm px-6 bg-[#13111f]/60 hover:bg-[#1c1830]/80 border border-[#231e3d] hover:border-pink-500/20 rounded-2xl py-3 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
            title="Tap to view nutrition details in Health tab"
          >
            {/* Protein */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-indigo-300 font-bold uppercase tracking-wider block">PROTEIN</span>
              <div className="relative w-10 h-10 flex items-center justify-center mt-1">
                <svg width="40" height="40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#1c1830" strokeWidth="3" />
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#818cf8" strokeWidth="3.2" strokeDasharray={2*Math.PI*17} strokeDashoffset={2*Math.PI*17 * (1 - Math.min(1, protConsumed / (protGramsGoal || 1)))} strokeLinecap="round" transform="rotate(-90 20 20)" style={{ transition: "stroke-dashoffset 0.8s" }} />
                </svg>
                <span className="absolute font-mono text-[9.5px] font-bold text-indigo-200">{protConsumed}g</span>
              </div>
              <span className="text-[7.5px] font-mono text-[#6b6485] mt-1">Goal: {protGramsGoal}g</span>
            </div>
            {/* Carbs */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-green-300 font-bold uppercase tracking-wider block">CARBOHYDRATES</span>
              <div className="relative w-10 h-10 flex items-center justify-center mt-1">
                <svg width="40" height="40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#1c1830" strokeWidth="3" />
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#34d399" strokeWidth="3.2" strokeDasharray={2*Math.PI*17} strokeDashoffset={2*Math.PI*17 * (1 - Math.min(1, carbsConsumed / (carbGramsGoal || 1)))} strokeLinecap="round" transform="rotate(-90 20 20)" style={{ transition: "stroke-dashoffset 0.8s" }} />
                </svg>
                <span className="absolute font-mono text-[9.5px] font-bold text-green-200">{carbsConsumed}g</span>
              </div>
              <span className="text-[7.5px] font-mono text-[#6b6485] mt-1">Goal: {carbGramsGoal}g</span>
            </div>
            {/* Fat */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-amber-300 font-bold uppercase tracking-wider block">LIPIDS (FAT)</span>
              <div className="relative w-10 h-10 flex items-center justify-center mt-1">
                <svg width="40" height="40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#1c1830" strokeWidth="3" />
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#fbbf24" strokeWidth="3.2" strokeDasharray={2*Math.PI*17} strokeDashoffset={2*Math.PI*17 * (1 - Math.min(1, fatConsumed / (fatGramsGoal || 1)))} strokeLinecap="round" transform="rotate(-90 20 20)" style={{ transition: "stroke-dashoffset 0.8s" }} />
                </svg>
                <span className="absolute font-mono text-[9.5px] font-bold text-amber-200">{fatConsumed}g</span>
              </div>
              <span className="text-[7.5px] font-mono text-[#6b6485] mt-1">Goal: {fatGramsGoal}g</span>
            </div>
          </div>
        )}

        {/* Switch Dots below circles */}
        <div className="flex justify-center gap-1.5 mt-2.5 mb-1 select-none pointer-events-auto">
          <button 
            type="button"
            onClick={() => setActiveWheelPage("clock")}
            className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${activeWheelPage === "clock" ? "bg-[#f0c972] w-3" : "bg-[#282144]"}`}
            title="Daily timeline view"
          />
          <button 
            type="button"
            onClick={() => setActiveWheelPage("calories")}
            className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${activeWheelPage === "calories" ? "bg-pink-300 w-3" : "bg-[#282144]"}`}
            title="Caloric balance view"
          />
        </div>

        {/* Micro Hydration Shortcut Capsule - Conforming to third request */}
        {(() => {
          const tKey = new Date().toISOString().slice(0, 10);
          const wConf = userState.waterConfig || { containerType: "glass", capacity: 250, capacityUnit: "ml" };
          const getCapMl = (cap: number, unit: string): number => {
            if (unit === "lt") return cap * 1000;
            if (unit === "oz") return cap * 29.5735;
            return cap;
          };
          const unitSzMl = getCapMl(wConf.capacity || 250, wConf.capacityUnit || "ml");
          const uDone = userState.waterLog?.[tKey] || 0;
          const mLitDone = uDone * unitSzMl;
          const tGoalMl = userState.waterGoal || 2000;
          const wPercent = tGoalMl > 0 ? Math.min(100, Math.round((mLitDone / tGoalMl) * 100)) : 0;

          return (
            <div className="mt-2.5 flex items-center justify-center pointer-events-auto">
              <div className="flex items-center gap-2 bg-[#141224] border border-[#231d3d] hover:border-[#3ab4f2]/25 rounded-full py-1.5 px-3.5 font-mono text-[9.5px] text-[#9991b8] transition-all duration-150">
                <span className="text-[#3ab4f2] text-[10px]">💧</span>
                <span className="font-bold text-[#e8e3f8]">{Math.round(mLitDone)} <span className="text-[#6b6485] font-normal">/ {tGoalMl} ml</span></span>
                <span className="text-[8px] text-[#6b6485]">({wPercent}%)</span>
                <div className="flex items-center gap-1 border-l border-[#221d37] pl-2 ml-0.5">
                  <button
                    type="button"
                    onClick={() => onLogWater?.("decrement")}
                    disabled={uDone <= 0}
                    className="w-4 h-4 rounded-full bg-[#1e1a35] border border-[#2c264d] hover:border-red-500/30 hover:bg-red-500/10 text-gray-400 hover:text-red-400 flex items-center justify-center font-bold font-sans text-[10px] active:scale-90 transition-all disabled:opacity-20 cursor-pointer"
                    title={`Minus 1 ${wConf.containerType || "glass"}`}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => onLogWater?.("increment")}
                    className="w-4 h-4 rounded-full bg-[#1e1a35] border border-[#2c264d] hover:border-[#3ab4f2]/35 hover:bg-[#3ab4f2]/10 text-[#3ab4f2] flex items-center justify-center font-bold font-sans text-[10px] active:scale-90 transition-all cursor-pointer"
                    title={`Plus 1 ${wConf.containerType || "glass"}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* DETAILED DAILY NUTRITION AND MEALS LIST MODAL OVERLAY (Style of image 2) */}
      <AnimatePresence>
        {showNutritionModal && (
          <div className="fixed inset-0 bg-[#0d0b14fb] backdrop-blur-lg z-50 overflow-y-auto flex flex-col p-4 md:p-6 text-left">
            <div className="w-full max-w-md mx-auto flex flex-col gap-5 pt-4 pb-20">
              
              {/* Back Header nav bar */}
              <div className="flex justify-between items-center bg-[#13111fff] border border-[#2a2440] rounded-2xl p-4 shadow-md">
                <button
                  type="button"
                  onClick={() => setShowNutritionModal(false)}
                  className="px-4 py-2 bg-[#17142a] border border-[#2c264d] hover:border-[#fbcfe8] text-pink-300 hover:text-white rounded-xl text-xs font-mono transition-all cursor-pointer font-bold shrink-0"
                >
                  ← BACK TO HUD
                </button>
                <div className="text-right">
                  <span className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider block">NUTRITIONAL LOGBOOK</span>
                  <span className="font-bebas text-lg text-white block tracking-wider uppercase">TODAY'S DIET JOURNAL</span>
                </div>
              </div>

              {/* Dynamic Stacked Macro Goal status cards */}
              <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-sm">
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
                      <span className="text-[8px] font-mono text-[#6b6485] uppercase">Waiting for meal logs...</span>
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
              <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">Direct Database search lookup</span>
                    <span className="text-[7.5px] font-mono bg-pink-500/10 text-pink-300 px-2 py-0.5 rounded-full uppercase">Powered by AFCD & OFF</span>
                  </div>
                  
                  {/* Database Selector Row */}
                  <div className="flex items-center justify-between bg-[#0e0c17] border border-[#231d3d] rounded-xl p-1.5">
                    <span className="text-[9px] font-mono text-[#6b6485] pl-1.5 uppercase font-bold font-sans">Database Source:</span>
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
                        <span className="text-indigo-300 block text-[7px]" block>PROTEIN</span>
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
                      className="w-full bg-pink-300 hover:bg-pink-400 text-black py-2 rounded-lg font-mono font-bold text-xs cursor-pointer uppercase transition-all shadow-md mt-1"
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

              {/* LIST OF INTRODUCED MEALS STYLE OF IMAGE 2 */}
              <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-sm">
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
                      <span className="text-2xl block mb-2 opacity-50">🥣</span>
                      <p className="text-[10px] font-mono text-[#6b6485] leading-relaxed">
                        No food recorded today. Swipe down or type keyword search above to fetch nutrition parameters and log meals details.
                      </p>
                    </div>
                  ) : (
                    foodTodayItems.map((item) => (
                      <div 
                        key={item.id}
                        className="bg-[#17142a] border border-[#2a2440] hover:border-pink-300/20 rounded-2xl p-3 flex justify-between items-center gap-3 transition-colors hover:bg-[#1a172f]"
                      >
                        <div className="min-w-0 flex-1 flex gap-2.5 items-center">
                          {/* Generic high visual styling meal marker emoji */}
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

                        {/* Calories details and Delete trigger */}
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

            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Daily Goal Completion Streak */}
      <div className="flex justify-center -mb-2 z-10 select-none">
        <div className="flex items-center gap-1 bg-[#261517] border border-[#ff4e4e]/15 px-3 py-1 rounded-full text-[#ff6868] shadow-sm">
          <span className="text-xs" role="img" aria-label="streak fire">🔥</span>
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider">
            Streak: <span className="text-white font-bold text-xs ml-0.5">{userState.taskStreak || 0}</span> days
          </span>
        </div>
      </div>

      {/* Today's Goals Card */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDragOverToday(true)}
        onDragLeave={() => setIsDragOverToday(false)}
        onDrop={(e) => {
          setIsDragOverToday(false);
          try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            if (data.id && data.fromList === "tomorrow") {
              onMoveGoal?.(data.id, "tomorrow", "today");
            }
          } catch (err) {}
        }}
        className={`bg-[#13111f] border rounded-2xl p-5 shadow-sm transition-all duration-200 ${
          isDragOverToday 
            ? "border-[#f0c972] bg-[#1a1727] scale-[1.01] shadow-[0_0_15px_rgba(240,201,114,0.1)]" 
            : "border-[#2a2440]"
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
            Today's Goals
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold font-bebas text-[#f0c972] leading-none animate-in fade-in zoom-in-75 duration-200" id="tasks-completed-count">
              {doneGoalsCount}
            </span>
            <span className="text-[10px] text-[#6b6485] font-bold transition-all">
              / {totalGoalsCount - doneGoalsCount} left
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] transition-all duration-500 ease-out"
            style={{ width: `${goalsPct}%` }}
          />
        </div>

        {/* Input area */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add a goal..."
            value={newTodayText}
            onChange={e => setNewTodayText(e.target.value)}
            onKeyDown={keyEvent => {
              if (keyEvent.key === "Enter" && newTodayText.trim()) {
                onAddTodayGoal(newTodayText.trim());
                setNewTodayText("");
              }
            }}
            className="flex-1 bg-[#17142a] border border-[#2a2440] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#3d3657] focus:outline-none focus:border-[#f0c972]"
          />
          <button
            onClick={() => {
              if (newTodayText.trim()) {
                onAddTodayGoal(newTodayText.trim());
                setNewTodayText("");
              }
            }}
            className="px-3 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bold rounded-lg hover:brightness-110 active:scale-95 focus:outline-none cursor-pointer text-sm"
          >
            +
          </button>
        </div>

        {/* Goals list */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-none">
          {userState.todayGoals.length === 0 ? (
            <div className="text-center text-xs py-4 text-[#3d3657] font-mono">
              No tasks left. Keep it up!
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {sortGoals(userState.todayGoals).map(g => {
                let borderStyle = g.done ? "border-[#6fcf9733] opacity-60" : "border-[#221d35]";
                if (!g.done && g.lightning) {
                  borderStyle = "border-l-2 border-l-yellow-400 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35] bg-[#1d1732] shadow-[0_0_8px_rgba(250,204,21,0.06)] animate-pulse-subtle";
                }

                return (
                  <motion.div
                    key={g.id}
                    layoutId={g.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", JSON.stringify({ id: g.id, fromList: "today" }));
                    }}
                    className={`flex items-center gap-3 bg-[#1e1a30] border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-[#231e38] transition-colors select-none ${borderStyle}`}
                  >
                    <button
                      onClick={() => onToggleGoal(g.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] transition-all cursor-pointer ${
                        g.done
                          ? "border-[#6fcf97] bg-[#6fcf97] text-[#17132a]"
                          : "border-[#3d3657] bg-transparent text-transparent"
                      }`}
                    >
                      ✓
                    </button>
                    <div className="flex-grow flex flex-col gap-1 min-w-0">
                      <span
                        onClick={() => onToggleGoal(g.id)}
                        className={`text-xs font-mono cursor-pointer truncate ${
                          g.done ? "line-through text-[#6b6485]" : "text-[#e8e3f8]"
                        }`}
                      >
                        {g.text}
                      </span>
                    </div>

                    {/* Lightning Bolt priority toggle */}
                    <button
                      type="button"
                      onClick={() => onToggleLightningGoal?.(g.id, true)}
                      className={`text-xs p-1 rounded-md hover:bg-[#282142] transition-all cursor-pointer ${
                        g.lightning 
                          ? "text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)] font-bold scale-110" 
                          : "text-[#3d3657] hover:text-[#5d5478]"
                      }`}
                      title={g.lightning ? "Remove energy priority" : "Mark as high energy priority"}
                    >
                      ⚡
                    </button>

                    <button
                      onClick={() => onRemoveTodayGoal(g.id)}
                      className="text-base text-[#3d3657] hover:text-[#ff5d5d] hover:scale-110 transition-all font-sans cursor-pointer h-5 leading-none"
                    >
                      ×
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
        
        {userState.todayGoals.length > 0 && (
          <div className="text-center text-[8.5px] font-mono text-[#433b66] mt-2.5 leading-none uppercase tracking-wider select-none">
            ↕ Grab tile to reorder or drag to tomorrow day
          </div>
        )}

        {/* Do Tomorrow Bulk Button, shows up around 9 PM or later */}
        {isAroundNinePM && hasActiveGoalsToday && (
          <button
            type="button"
            onClick={onMoveActiveToTomorrow}
            className="w-full mt-3.5 py-2.5 px-4 bg-gradient-to-r from-[#170e2b] to-[#251545] hover:from-[#21143c] hover:to-[#331d5e] border border-[#ff7a2f]/20 hover:border-[#ff7a2f]/40 text-[#ffae7a] hover:text-white font-mono text-[10.5px] font-bold tracking-wider rounded-xl hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
            id="do-tomorrow-bulk-btn"
          >
            <span>✨ Do Tomorrow (Snooze Active Tasks)</span>
          </button>
        )}
      </div>

      {/* Plan Ahead Tomorrow Card */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDragOverTomorrow(true)}
        onDragLeave={() => setIsDragOverTomorrow(false)}
        onDrop={(e) => {
          setIsDragOverTomorrow(false);
          try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            if (data.id && data.fromList === "today") {
              onMoveGoal?.(data.id, "today", "tomorrow");
            }
          } catch (err) {}
        }}
        className={`bg-[#111020] border rounded-2xl p-5 shadow-sm transition-all duration-200 ${
          isDragOverTomorrow 
            ? "border-[#9180c4] bg-[#16142c] scale-[1.01] shadow-[0_0_15px_rgba(145,128,196,0.1)]" 
            : "border-[#2a2440]"
        }`}
      >
        <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block mb-1">
          Tomorrow's Goals
        </span>
        <span className="text-[9px] text-[#3d3657] font-mono block mb-3">
          Transfers into today at midnight automatically
        </span>

        {/* Input area */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Plan ahead..."
            value={newTomorrowText}
            onChange={e => setNewTomorrowText(e.target.value)}
            onKeyDown={keyEvent => {
              if (keyEvent.key === "Enter" && newTomorrowText.trim()) {
                onAddTomorrowGoal(newTomorrowText.trim());
                setNewTomorrowText("");
              }
            }}
            className="flex-1 bg-[#17132a] border border-[#2a2440] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#2e2845] focus:outline-none focus:border-[#9180c4]"
          />
          <button
            onClick={() => {
              if (newTomorrowText.trim()) {
                onAddTomorrowGoal(newTomorrowText.trim());
                setNewTomorrowText("");
              }
            }}
            className="px-3 bg-gradient-to-r from-[#9180c4] to-[#5a4a8a] text-white font-bold rounded-lg hover:brightness-110 active:scale-95 focus:outline-none cursor-pointer text-sm"
          >
            +
          </button>
        </div>

        {/* Tomorrow list */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
          {userState.tomorrowGoals.length === 0 ? (
            <div className="text-center text-xs py-3 text-[#2e2845] font-mono">
              Nothing queued for tomorrow.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {sortGoals(userState.tomorrowGoals).map(tg => {
                let borderStyle = tg.done ? "border-[#6fcf9733] opacity-60" : "border-[#221d35]";
                if (!tg.done && tg.lightning) {
                  borderStyle = "border-l-2 border-l-yellow-400/80 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35] bg-[#1c162f]";
                }

                return (
                  <motion.div
                    key={tg.id}
                    layoutId={tg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", JSON.stringify({ id: tg.id, fromList: "tomorrow" }));
                    }}
                    className={`flex items-center gap-3 bg-[#17132a] border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-[#1c1833] transition-colors select-none ${borderStyle}`}
                  >
                    <div className="w-4 h-4 rounded border border-[#2e2845] bg-transparent flex-shrink-0" />
                    <div className="flex-grow flex flex-col gap-1 min-w-0">
                      <span className="text-xs font-mono text-[#6b6485] truncate">
                        {tg.text}
                      </span>
                    </div>

                    {/* Lightning bolt indicator/button */}
                    <button
                      type="button"
                      onClick={() => onToggleLightningGoal?.(tg.id, false)}
                      className={`text-xs p-1 rounded-md hover:bg-[#20193b] transition-all cursor-pointer ${
                        tg.lightning 
                          ? "text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)] font-bold scale-110" 
                          : "text-[#3d3657] hover:text-[#5d5478]"
                      }`}
                      title={tg.lightning ? "Remove energy priority" : "Mark as high energy priority"}
                    >
                      ⚡
                    </button>

                    <button
                      onClick={() => onRemoveTomorrowGoal(tg.id)}
                      className="text-base text-[#2e2845] hover:text-[#ff5d5d] hover:scale-110 transition-all cursor-pointer h-5 leading-none"
                    >
                      ×
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Merged Daily Schedule View */}
      <div className="flex justify-between items-center mt-2.5 mb-1">
        <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
          Today's Schedule
        </span>
        
        {gcalAccessToken ? (
          <div className="flex gap-1.5">
            <button
              onClick={onRefreshGcal}
              className="bg-[#17142a] border border-[#221d35] rounded-lg px-2.5 py-1 text-[10px] font-mono text-[#9991b8] active:scale-95 transition-all cursor-pointer hover:border-[#f0c972]"
            >
              ↻ Refresh
            </button>
            <button
              onClick={onDisconnectGcal}
              className="bg-transparent border border-[#221d35] rounded-lg px-2 py-1 text-[9px] font-mono text-[#3d3657] hover:text-red-400 active:scale-95 transition-all cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onConnectGcal}
            className="bg-gradient-to-r from-[#4285F4] to-[#1a6fd4] border-none text-white rounded-lg px-3 py-1.5 text-[10px] font-mono font-semibold cursor-pointer active:scale-95 transition-all shadow"
          >
            + Connect Google Calendar
          </button>
        )}
      </div>

      {gcalLoading && (
        <div className="flex items-center gap-3 justify-center py-6 text-xs text-[#9991b8] font-mono bg-[#13111f] border border-[#2a2440] rounded-xl">
          <div className="w-4 h-4 border-2 border-[#f0c972] border-t-transparent rounded-full animate-spin" />
          Loading calendar events…
        </div>
      )}

      {gcalError && (
        <div className="bg-[#ff444415] border border-[#ff444444] rounded-xl p-3 text-xs text-red-400 font-mono">
          🚨 {gcalError}
        </div>
      )}

      {/* Render calendar schedule cards */}
      <div className="space-y-2">
        {scheduleItems.length === 0 ? (
          <div className="text-center py-8 text-[#3d3657] font-mono text-xs border border-dashed border-[#221d35] rounded-2xl">
            Schedule empty. Use calendar or add supplements to populate!
          </div>
        ) : (
          scheduleItems.map((item, index) => {
            if (item.type === "event") {
              const ev = item.ev;
              const isNow = isEventNow(ev);
              const isPast = isEventPast(ev);
              const isAllDay = !ev.start?.dateTime;
              const accentColor = isNow ? "#f0c972" : isPast ? "#3d3657" : "#9180c4";
              const borderCol = isNow ? "#f0c972" : isPast ? "#221d35" : "#9180c4";

              return (
                <div
                  key={`ev-${ev.id}-${index}`}
                  className={`flex gap-3 items-start p-3 bg-[#17142a] border rounded-xl shadow transition-all duration-300 ${
                    isPast ? "opacity-50" : ""
                  }`}
                  style={{
                    borderColor: borderCol,
                    backgroundColor: isNow ? "rgba(240, 201, 114, 0.05)" : "#17142a"
                  }}
                >
                  <div className="min-width-[60px] text-right font-mono text-[9px] w-14">
                    <div style={{ color: accentColor }} className="leading-snug">
                      {fmtEventTime(ev)}
                    </div>
                    {isNow && (
                      <span className="text-[8px] font-bold text-[#f0c972] animate-pulse block mt-0.5">
                        ● ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-mono text-xs truncate ${
                        isPast ? "text-[#6b6485] line-through" : "text-[#e8e3f8]"
                      }`}
                    >
                      {ev.summary || "(No Title)"}
                    </div>
                    {ev.location && (
                      <div className="text-[9px] text-[#3d3657] font-mono mt-0.5 truncate">
                        📍 {ev.location}
                      </div>
                    )}
                    {isAllDay && (
                      <span className="text-[8px] font-mono font-bold text-[#9180c4] block mt-0.5">
                        ALL DAY
                      </span>
                    )}
                  </div>
                  <div className="w-1 rounded-sm self-stretch shrink-0" style={{ backgroundColor: accentColor }} />
                </div>
              );
            }

            if (item.type === "goal") {
              const g = item.goal;
              return (
                <div
                  key={`goal-${g.id}-${index}`}
                  onClick={() => onToggleGoal(g.id)}
                  className={`flex gap-3 items-center p-3 bg-[#17142a] border rounded-xl cursor-pointer ${
                    g.done ? "border-[#6fcf9715] opacity-50" : "border-[#221d35]"
                  }`}
                >
                  <div className="w-14 text-right font-mono text-[9px] text-[#3d3657]">
                    ANYTIME
                  </div>
                  <button
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[8px] cursor-pointer ${
                      g.done ? "border-[#6fcf97] bg-[#6fcf97] text-[#0d0b14]" : "border-[#3d3657]"
                    }`}
                  >
                    {g.done ? "✓" : ""}
                  </button>
                  <div
                    className={`flex-1 font-mono text-xs text-[#e8e3f8] ${
                      g.done ? "line-through text-[#6b6485]" : ""
                    }`}
                  >
                    {g.text}
                  </div>
                  <div className="w-1 rounded-sm bg-[#6fcf97] self-stretch min-h-5" />
                </div>
              );
            }

            if (item.type === "supps") {
              const { slot, supps } = item;
              
              const statuses = supps.map(s => getSupplementStatus(s, slot.key));
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
                <div
                  key={`supps-${slot.key}-${index}`}
                  className={`p-3 bg-[#17142a] border rounded-xl transition-all ${
                    allDone ? "border-[#6fcf9722] opacity-60" : 
                    hasWarning ? "border-[#f0c97244] bg-[#f0c972]/5" :
                    hasMissed ? "border-red-500/30 bg-red-950/5" :
                    "border-[#221d35]"
                  }`}
                >
                  <div className="flex gap-3 items-center mb-2">
                    <div className="w-14 text-right font-mono text-[9px]" style={{ color: slotColor }}>
                      {slot.start}:00
                    </div>
                    <span className="text-sm">{slot.icon}</span>
                    <span className="flex-1 font-bebas text-xs tracking-wider" style={{ color: slotColor }}>
                      {slot.label} Supplements
                    </span>
                    {allDone ? (
                      <span className="text-[9px] text-[#6fcf97] font-mono">✓ Taken</span>
                    ) : hasWarning ? (
                      <span className="text-[8px] text-[#f0c972] font-mono animate-pulse font-semibold">
                        ⏱ DUE SOON
                      </span>
                    ) : hasMissed ? (
                      <span className="text-[8px] text-red-500 font-mono font-semibold">
                        ❌ MISSED
                      </span>
                    ) : (
                      <span className="text-[8px] text-[#6b6485] font-mono uppercase">
                        Upcoming
                      </span>
                    )}
                    <div className="w-1 rounded-sm self-stretch" style={{ backgroundColor: slotColor }} />
                  </div>
                  
                  {/* Itemized checklist */}
                  <div className="pl-14 space-y-1">
                    {supps.map(s => {
                      const status = getSupplementStatus(s, slot.key);
                      const done = status === "completed";

                      let textClass = "text-[#9991b8]";
                      let checkboxClass = "border-[#3d3657]";
                      let statusText = null;

                      if (status === "completed") {
                        textClass = "line-through text-[#6b6485]";
                        checkboxClass = "border-emerald-500 bg-emerald-500 text-[#0d0b14]";
                      } else if (status === "warning") {
                        textClass = "text-white font-medium";
                        checkboxClass = "border-[#f0c972] animate-pulse";
                        statusText = <span className="text-[8px] font-mono text-[#f0c972] uppercase animate-pulse">due soon</span>;
                      } else if (status === "missed") {
                        textClass = "text-red-400 font-medium";
                        checkboxClass = "border-red-500 bg-red-950/20";
                        statusText = <span className="text-[8px] font-mono text-red-400 uppercase">missed</span>;
                      } else {
                        textClass = "text-[#9991b8]";
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
                          key={`supps-check-${s.id}`}
                          onClick={() => onToggleSuppCheck(s.id, slot.key)}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[8px] transition-all shrink-0 ${checkboxClass}`}
                          >
                            {done ? "✓" : ""}
                          </div>
                          <span className={`font-mono text-[11px] flex items-center gap-x-1.5 flex-wrap ${textClass}`}>
                            <span>{s.name}</span>
                            {s.dosage && <span className="text-xs text-[#3d3657]">({s.dosage})</span>}
                            <span className="text-[9px] text-[#554e6e]">⏱ {timeVal}</span>
                            {statusText && <span className="text-[8.5px] scale-90 opacity-80">{statusText}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}
