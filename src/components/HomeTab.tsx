import { useState, useEffect } from "react";
import { UserState, Goal, CalendarEvent } from "../types";
import { motion, AnimatePresence } from "motion/react";

// Goal priority parsing helper (automatically detects ending with !, !!, or !!! for badges)
const parseGoalText = (rawText: any) => {
  let priority: "high" | "medium" | "low" | null = null;
  let text = typeof rawText === "string" ? rawText : "";
  
  if (text.endsWith("!!!")) {
    priority = "high";
    text = text.slice(0, -3).trim();
  } else if (text.endsWith("!!")) {
    priority = "medium";
    text = text.slice(0, -2).trim();
  } else if (text.endsWith("!")) {
    priority = "low";
    text = text.slice(0, -1).trim();
  }
  
  return { text, priority };
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
  onAddTodayGoal: (text: string) => void;
  onRemoveTodayGoal: (id: string) => void;
  onAddTomorrowGoal: (text: string) => void;
  onRemoveTomorrowGoal: (id: string) => void;
  onToggleSuppCheck: (suppId: string, slotKey: string) => void;
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
  onToggleSuppCheck
}: HomeTabProps) {
  const [now, setNow] = useState(new Date());
  const [newTodayText, setNewTodayText] = useState("");
  const [newTomorrowText, setNewTomorrowText] = useState("");

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
    const items: Array<
      | { type: "event"; ev: CalendarEvent; sortKey: string }
      | { type: "goal"; goal: Goal; sortKey: string }
      | { type: "supps"; slot: typeof TIME_SLOTS[0]; supps: typeof userState.supplements; sortKey: string }
    > = [];

    gcalEvents.forEach(ev => {
      items.push({ type: "event", ev, sortKey: ev.start?.dateTime || ev.start?.date || "0000" });
    });

    userState.todayGoals.forEach(g => {
      items.push({ type: "goal", goal: g, sortKey: "anytime" });
    });

    const slotTimes: Record<string, string> = { morning: "06:00", afternoon: "12:00", evening: "17:00", night: "21:00" };
    const todayStr = new Date().toISOString().slice(0, 10);

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

      {/* Clock Wheel */}
      <div className="flex justify-center my-2">
        <div className="relative" style={{ width: size, height: size }}>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
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
        </div>
      </div>

      {/* Today's Goals Card */}
      <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase">
            Today's Goals
          </span>
          <span className="text-[10px] font-mono text-[#f0c972]">
            {doneGoalsCount}/{totalGoalsCount} — {goalsPct}%
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] transition-all duration-500 ease-out"
            style={{ width: `${goalsPct}%` }}
          />
        </div>

        {/* Input area */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Add a goal..."
            value={newTodayText}
            onChange={e => setNewTodayText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newTodayText.trim()) {
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
            className="px-3 bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-bold rounded-lg hover:brightness-110 active:scale-95 focus:outline-none cursor-pointer"
          >
            +
          </button>
        </div>

        {/* Goals list */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
          {userState.todayGoals.length === 0 ? (
            <div className="text-center text-xs py-4 text-[#3d3657] font-mono">
              No tasks left. Keep it up!
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {userState.todayGoals.map(g => {
                const parsed = parseGoalText(g.text);
                let borderStyle = g.done ? "border-[#6fcf9733] opacity-60" : "border-[#221d35]";
                if (!g.done) {
                  if (parsed.priority === "high") {
                    borderStyle = "border-l-2 border-l-red-500 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35]";
                  } else if (parsed.priority === "medium") {
                    borderStyle = "border-l-2 border-l-amber-500 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35]";
                  } else if (parsed.priority === "low") {
                    borderStyle = "border-l-2 border-l-[#3ab4f2] border-r-[#221d35] border-t-[#221d35] border-b-[#221d35]";
                  }
                }

                return (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-center gap-3 bg-[#1e1a30] border rounded-xl px-3 py-2 transition-all ${borderStyle}`}
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
                    <span
                      onClick={() => onToggleGoal(g.id)}
                      className={`flex-grow text-xs font-mono select-none cursor-pointer flex flex-wrap items-center gap-1.5 ${
                        g.done ? "line-through text-[#6b6485]" : "text-[#e8e3f8]"
                      }`}
                    >
                      <span>{parsed.text}</span>
                      {!g.done && parsed.priority && (
                        <span className={`text-[7px] leading-none px-1 py-0.5 rounded font-bold tracking-wide uppercase shrink-0 font-mono ${
                          parsed.priority === "high" ? "bg-red-950/40 text-[#ff5d5d] border border-red-500/20" :
                          parsed.priority === "medium" ? "bg-amber-950/40 text-[#f0c972] border border-amber-500/20" :
                          "bg-blue-950/40 text-[#3ab4f2] border border-[#3ab4f2]/20"
                        }`}>
                          {parsed.priority === "high" ? "🚨 Core" : parsed.priority === "medium" ? "⚡ Split" : "⚙️ Minor"}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onRemoveTodayGoal(g.id)}
                      className="text-base text-[#3d3657] hover:text-[#9180c4] hover:scale-110 transition-all font-sans cursor-pointer h-5 leading-none"
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

      {/* Plan Ahead Tomorrow Card */}
      <div className="bg-[#111020] border border-[#2a2440] rounded-2xl p-5 shadow-sm">
        <span className="text-[10px] text-[#6b6485] font-mono tracking-wider uppercase block mb-1">
          Tomorrow's Goals
        </span>
        <span className="text-[9px] text-[#3d3657] font-mono block mb-3">
          Transfers into today at midnight automatically
        </span>

        {/* Input area */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Plan ahead..."
            value={newTomorrowText}
            onChange={e => setNewTomorrowText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newTomorrowText.trim()) {
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
            className="px-3 bg-gradient-to-r from-[#9180c4] to-[#5a4a8a] text-white font-bold rounded-lg hover:brightness-110 active:scale-95 focus:outline-none cursor-pointer"
          >
            +
          </button>
        </div>

        {/* Play ahead list */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-none">
          {userState.tomorrowGoals.length === 0 ? (
            <div className="text-center text-xs py-3 text-[#2e2845] font-mono">
              Nothing queued for tomorrow.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {userState.tomorrowGoals.map(tg => {
                const parsed = parseGoalText(tg.text);
                let borderStyle = "border-[#221d35]";
                if (parsed.priority === "high") {
                   borderStyle = "border-l-2 border-l-red-500/70 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35]";
                } else if (parsed.priority === "medium") {
                   borderStyle = "border-l-2 border-l-amber-500/70 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35]";
                } else if (parsed.priority === "low") {
                   borderStyle = "border-l-2 border-l-[#3ab4f2]/70 border-r-[#221d35] border-t-[#221d35] border-b-[#221d35]";
                }

                return (
                  <motion.div
                    key={tg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-center gap-3 bg-[#17132a] border rounded-xl px-3 py-2 ${borderStyle}`}
                  >
                    <div className="w-4 h-4 rounded border border-[#2e2845] bg-transparent flex-shrink-0" />
                    <span className="flex-grow text-xs font-mono text-[#6b6485] flex flex-wrap items-center gap-1.5">
                      <span>{parsed.text}</span>
                      {parsed.priority && (
                        <span className={`text-[6.5px] leading-none px-1 py-0.5 rounded font-bold tracking-wide uppercase shrink-0 font-mono ${
                          parsed.priority === "high" ? "bg-red-950/20 text-red-500/60 border border-red-500/10" :
                          parsed.priority === "medium" ? "bg-amber-950/20 text-amber-500/60 border border-amber-500/10" :
                          "bg-blue-950/20 text-blue-400/60 border border-blue-500/10"
                        }`}>
                          {parsed.priority === "high" ? "🚨 Core" : parsed.priority === "medium" ? "⚡ Split" : "⚙️ Minor"}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onRemoveTomorrowGoal(tg.id)}
                      className="text-base text-[#2e2845] hover:text-[#9180c4] transition-all cursor-pointer"
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
