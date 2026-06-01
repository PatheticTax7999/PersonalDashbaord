import { useState } from "react";
import { UserState, CalendarEvent, Goal } from "../types";

const TIME_SLOTS = [
  { key: "morning", label: "Morning", icon: "🌅", start: 6, end: 12 },
  { key: "afternoon", label: "Afternoon", icon: "☀️", start: 12, end: 17 },
  { key: "evening", label: "Evening", icon: "🌆", start: 17, end: 21 },
  { key: "night", label: "Night", icon: "🌙", start: 21, end: 24 }
];

interface CalendarTabProps {
  userState: UserState;
  gcalAccessToken: string | null;
  gcalEvents: CalendarEvent[];
  gcalLoading: boolean;
  gcalError: string | null;
  onConnectGcal: () => void;
  onDisconnectGcal: () => void;
  onRefreshGcal: () => void;
  onToggleGoal: (id: string) => void;
  onToggleSuppCheck: (suppId: string, slotKey: string) => void;
}

export default function CalendarTab({
  userState,
  gcalAccessToken,
  gcalEvents = [],
  gcalLoading,
  gcalError,
  onConnectGcal,
  onDisconnectGcal,
  onRefreshGcal,
  onToggleGoal,
  onToggleSuppCheck
}: CalendarTabProps) {
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [calOffset, setCalOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(
    new Date().toISOString().slice(0, 10)
  );

  const [calShowGoals, setCalShowGoals] = useState(true);
  const [calShowSupps, setCalShowSupps] = useState(true);
  const [calShowEvents, setCalShowEvents] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Helper date conversions
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

  const getWeekDays = (offset: number) => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    // Shift monday by offset weeks
    monday.setDate(now.getDate() - ((dow + 6) % 7) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const getMonthDays = (offset: number) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + offset;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Monday = 0
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const days = calView === "week" ? getWeekDays(calOffset) : getMonthDays(calOffset);

  // Period label
  const getPeriodLabel = () => {
    if (calView === "week") {
      const realDays = days.filter(Boolean) as Date[];
      if (realDays.length === 0) return "";
      const s = realDays[0].toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      const e = realDays[realDays.length - 1].toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      return `${s} – ${e}`;
    } else {
      const now = new Date();
      const ref = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
      return ref.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    }
  };

  const isSuppDone = (suppId: string, slotKey: string, date: string) => {
    return !!(userState.suppChecks[date]?.[`${suppId}_${slotKey}`]);
  };

  const getSuppCheckStatus = (slot: typeof TIME_SLOTS[0], date: string) => {
    const h = new Date().getHours();
    if (h < slot.start) return "upcoming";
    if (h >= slot.end) return "past";
    if (h >= slot.end - 1) return "urgent";
    return "active";
  };

  // Day specific items detail builder
  const renderDayDetail = (dk: string) => {
    const d = new Date(dk + "T12:00:00");
    const label = d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
    const isToday = dk === todayStr;

    // Filter goals
    const goalsList = calShowGoals && isToday ? userState.todayGoals : [];
    
    // Filter supplements slots
    const suppSlots = calShowSupps && isToday ? TIME_SLOTS.filter(slot =>
      userState.supplements.some(s => s.times.includes(slot.key))
    ) : [];

    // Filter completed workouts
    const workoutsList = (userState.completedWorkouts || []).filter(w => w.date === dk);

    // Filter calendar events
    const dayEvents = calShowEvents ? gcalEvents.filter(ev => {
      const startStr = ev.start?.dateTime || ev.start?.date;
      return startStr && startStr.slice(0, 10) === dk;
    }) : [];

    const hasContent = goalsList.length > 0 || suppSlots.length > 0 || workoutsList.length > 0 || dayEvents.length > 0;

    return (
      <div className="border-t border-[#221d35] pt-4.5">
        <div className="flex justify-between items-center mb-4">
          <div className="font-mono text-xs text-[#e8e3f8]">{label}</div>
          <button
            onClick={() => setSelectedDayKey(null)}
            className="text-lg text-[#6b6485] hover:text-white leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {!hasContent ? (
          <div className="text-center py-6 text-xs font-mono text-[#3d3657] border border-dashed border-[#221d35] rounded-xl bg-[#17142010]">
            No daily logs/tasks scheduled for this day interface.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Display Google Calendar Events */}
            {dayEvents.map((ev, evIdx) => {
              const isAllDay = !ev.start?.dateTime;
              const timeStr = isAllDay ? "All day" : (() => {
                const s = new Date(ev.start.dateTime!);
                const e = new Date(ev.end.dateTime || "");
                const fmt = (date: Date) => date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
                return `${fmt(s)} – ${fmt(e)}`;
              })();
              
              return (
                <div
                  key={`day-ev-${ev.id}-${evIdx}`}
                  className="flex gap-3 items-start p-3.5 bg-[#17142a] border border-[#4285F4]/25 rounded-xl"
                >
                  <div className="w-14 text-right font-mono text-[9px] text-[#4285F4] leading-snug shrink-0">
                    {timeStr}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-mono text-xs text-[#e8e3f8] truncate">
                      {ev.summary || "(No Title)"}
                    </div>
                    {ev.location && (
                      <div className="text-[9px] text-[#3d3657] font-mono mt-1 truncate">
                        📍 {ev.location}
                      </div>
                    )}
                  </div>
                  <div className="w-1 rounded-sm bg-[#4285F4] self-stretch min-h-5" />
                </div>
              );
            })}

            {/* Display Goals */}
            {goalsList.map(g => (
              <div
                key={`dg-goal-${g.id}`}
                onClick={() => onToggleGoal(g.id)}
                className={`flex gap-3 items-center p-3.5 bg-[#17142a] border rounded-xl cursor-pointer transition-all ${
                  g.done ? "border-[#6fcf9715] opacity-50" : "border-[#221d35]"
                }`}
              >
                <div className="w-14 text-right font-mono text-[9px] text-[#3d3657]">
                  GOAL
                </div>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] shrink-0 ${
                    g.done ? "border-[#6fcf97] bg-[#6fcf97] text-[#0d0b14]" : "border-[#3d3657]"
                  }`}
                >
                  {g.done ? "✓" : ""}
                </div>
                <div
                  className={`flex-1 font-mono text-xs text-[#e8e3f8] truncate ${
                    g.done ? "line-through text-[#6b6485]" : ""
                  }`}
                >
                  {g.text}
                </div>
                <div className="w-1 rounded-sm bg-[#6fcf97] self-stretch min-h-5" />
              </div>
            ))}

            {/* Display Supplements */}
            {suppSlots.map(slot => {
              const list = userState.supplements.filter(s => s.times.includes(slot.key));
              const urgency = getSuppCheckStatus(slot, dk);
              const allDone = list.every(s => isSuppDone(s.id, slot.key, dk));
              const slotColor = allDone ? "#3d3657" : urgency === "urgent" ? "#e07b3f" : urgency === "past" ? "#ff4444" : "#f0c972";

              return (
                <div
                  key={`dg-supps-${slot.key}`}
                  className={`p-3.5 bg-[#17142a] border rounded-xl ${
                    allDone ? "border-[#6fcf9722] opacity-60" : "border-[#221d35]"
                  }`}
                >
                  <div className="flex gap-3 items-center mb-3">
                    <div className="w-14 text-right font-mono text-[9px]" style={{ color: slotColor }}>
                      {slot.start}:00
                    </div>
                    <span className="text-[13px]">{slot.icon}</span>
                    <span className="flex-1 font-bebas text-xs tracking-wider" style={{ color: slotColor }}>
                      {slot.label} Intake
                    </span>
                    {allDone && <span className="text-[9px] text-[#6fcf97] font-mono">Taken</span>}
                  </div>

                  <div className="pl-14 space-y-1.5">
                    {list.map(s => {
                      const done = isSuppDone(s.id, slot.key, dk);
                      return (
                        <div
                          key={`dg-check-${s.id}`}
                          onClick={() => onToggleSuppCheck(s.id, slot.key)}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[8px] ${
                              done ? "border-[#6fcf97] bg-[#6fcf97] text-[#0d0b14]" : "border-[#3d3657]"
                            }`}
                          >
                            {done ? "✓" : ""}
                          </div>
                          <span
                            className={`font-mono text-[11px] truncate ${
                              done ? "line-through text-[#3d3657]" : "text-[#9991b8]"
                            }`}
                          >
                            {s.name} {s.dosage && <span className="text-[9px] text-[#3d3657]">({s.dosage})</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Display Completed Workouts */}
            {workoutsList.map(w => (
              <div
                key={`dg-workout-${w.id}`}
                className="p-3.5 bg-[#17142a] border border-orange-500/20 rounded-xl"
              >
                <div className="flex gap-3 items-center mb-2.5">
                  <div className="w-14 text-right font-mono text-[9px] text-orange-400 font-bold">
                    WORKOUT
                  </div>
                  <span className="text-[13px]">🏋️</span>
                  <div className="flex-1 font-bebas text-sm tracking-wider text-white">
                    {w.name}
                  </div>
                  <div className="font-mono text-[9px] text-[#9991b8] bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10">
                    ⏱ {w.durationMinutes} min
                  </div>
                </div>

                <div className="pl-14 space-y-1.5 border-l border-orange-500/10 ml-[23px]">
                  {w.exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="flex justify-between items-center text-[10px] font-mono leading-relaxed pl-3 relative">
                      <span className="absolute left-0 text-orange-500/40">•</span>
                      <span className="text-[#9991b8]">{ex.name}</span>
                      <span className="text-orange-400 font-medium">
                        {ex.setsCount} {ex.setsCount === 1 ? "set" : "sets"}{ex.reps > 0 && ` @ max ${userState.useLb ? `${(ex.maxWeight * 2.20462).toFixed(1)} lb` : `${ex.maxWeight} kg`}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto py-6 px-4 pb-28 flex flex-col gap-5">
      {/* Tab bar header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="font-bebas text-3xl tracking-wider text-[#e8e3f8] leading-none mb-1">
            Agenda Calendar
          </div>
          <span className="text-[10px] text-[#6b6485] font-mono leading-none">
            Schedule & Integrations
          </span>
        </div>

        {!gcalAccessToken ? (
          <button
            onClick={onConnectGcal}
            className="bg-gradient-to-r from-[#4285F4] to-[#1a6fd4] border-none text-white rounded-lg px-3 py-1.5 text-[10px] font-mono font-semibold cursor-pointer active:scale-95 shadow"
          >
            Connect Calendar
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={onRefreshGcal}
              disabled={gcalLoading}
              className="bg-[#17142a] border border-[#221d35] text-[#9991b8] rounded-lg px-2.5 py-1 text-[10px] font-mono font-semibold cursor-pointer active:scale-95 hover:border-[#f0c972] disabled:opacity-50"
            >
              {gcalLoading ? "Syncing..." : "🔄 Refresh"}
            </button>
            <button
              onClick={onDisconnectGcal}
              className="bg-transparent border border-[#221d35] rounded-lg px-2 py-1 text-[9px] font-mono text-[#3d3657] hover:text-red-400 active:scale-95 transition-all cursor-pointer animate-fade-in"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Week vs Month subtabs toggle */}
      <div className="flex bg-[#17142a] border border-[#221d35] rounded-xl p-1 font-mono text-[11px] font-semibold gap-1">
        <button
          onClick={() => {
            setCalView("week");
            setCalOffset(0);
          }}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            calView === "week"
              ? "bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14]"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          Week View
        </button>
        <button
          onClick={() => {
            setCalView("month");
            setCalOffset(0);
          }}
          className={`flex-1 text-center py-2 rounded-lg cursor-pointer transition-all ${
            calView === "month"
              ? "bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14]"
              : "text-[#9991b8] hover:text-white"
          }`}
        >
          Month View
        </button>
      </div>

      {/* Filter checkboxes */}
      <div className="grid grid-cols-3 gap-1.5 mt-0.5 font-mono text-[9px]">
        <button
          onClick={() => setCalShowGoals(!calShowGoals)}
          className={`py-2 px-1 border rounded-xl flex items-center justify-center gap-1 cursor-pointer select-none transition-all ${
            calShowGoals ? "border-[#6fcf97] bg-[#6fcf9715] text-[#6fcf97]" : "border-[#221d35] text-[#3d3657]"
          }`}
        >
          {calShowGoals ? "✓" : "○"} Goals
        </button>
        <button
          onClick={() => setCalShowSupps(!calShowSupps)}
          className={`py-2 px-1 border rounded-xl flex items-center justify-center gap-1 cursor-pointer select-none transition-all ${
            calShowSupps ? "border-[#f0c972] bg-[#f0c97210] text-[#f0c972]" : "border-[#221d35] text-[#3d3657]"
          }`}
        >
          {calShowSupps ? "✓" : "○"} Supps
        </button>
        <button
          onClick={() => setCalShowEvents(!calShowEvents)}
          className={`py-2 px-1 border rounded-xl flex items-center justify-center gap-1 cursor-pointer select-none transition-all ${
            calShowEvents ? "border-[#4285F4] bg-[#4285F415] text-[#4285F4]" : "border-[#221d35] text-[#3d3657]"
          }`}
        >
          {calShowEvents ? "✓" : "○"} Events
        </button>
      </div>

      {gcalLoading && (
        <div className="flex items-center gap-2.5 justify-center py-3 text-[10px] text-[#9991b8] font-mono bg-[#13111f] border border-[#2a2440] rounded-xl animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-[#4285F4] border-t-transparent rounded-full animate-spin" />
          Syncing events with cloud…
        </div>
      )}

      {gcalError && (
        <div className="bg-[#ff444412] border border-[#ff444422] rounded-xl p-2.5 text-[10px] text-red-400 font-mono text-center">
          🚨 {gcalError}
        </div>
      )}

      {/* Step navigations */}
      <div className="flex justify-between items-center bg-[#13111f] border border-[#221d35] p-3 rounded-2xl shadow-sm">
        <button
          onClick={() => setCalOffset(prev => prev - 1)}
          className="bg-[#17142a] border border-[#221d35] rounded-xl px-3 py-1.5 text-xs text-[#9991b8] cursor-pointer active:scale-90 hover:border-[#f0c972]"
        >
          ‹
        </button>
        <div className="font-mono text-xs text-[#e8e3f8]">{getPeriodLabel()}</div>
        <button
          onClick={() => setCalOffset(prev => prev + 1)}
          className="bg-[#17142a] border border-[#221d35] rounded-xl px-3 py-1.5 text-xs text-[#9991b8] cursor-pointer active:scale-90 hover:border-[#f0c972]"
        >
          ›
        </button>
      </div>

      {calOffset !== 0 && (
        <div className="text-center -mt-1.5 mb-1 animate-fade-in">
          <button
            onClick={() => setCalOffset(0)}
            className="text-[10px] font-mono text-[#f0c972] hover:underline cursor-pointer"
          >
            Back to today
          </button>
        </div>
      )}

      {/* Calendars Days header */}
      <div className="grid grid-cols-7 gap-1 text-center select-none font-mono text-[9px] text-[#3d3657] uppercase py-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => (
          <div key={idx}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid cards */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const key = dateKey(day);
          const isToday = key === todayStr;
          const isSelected = key === selectedDayKey;

          // Indicator computations
          const hasGoals = calShowGoals && isToday && userState.todayGoals.length > 0;
          const hasSupps = calShowSupps && isToday && userState.supplements.length > 0;
          const dayWorkouts = (userState.completedWorkouts || []).filter(w => w.date === key);
          const hasWorkouts = dayWorkouts.length > 0;
          const hasEvents = calShowEvents && gcalEvents.some(ev => {
            const startStr = ev.start?.dateTime || ev.start?.date;
            return startStr && startStr.slice(0, 10) === key;
          });

          return (
            <div
              key={key}
              onClick={() => setSelectedDayKey(isSelected ? null : key)}
              className="border rounded-xl cursor-pointer p-2 min-h-14 flex flex-col justify-between items-center transition-all duration-200"
              style={{
                background: isSelected
                  ? "linear-gradient(135deg, #f0c972, #e07b3f)"
                  : isToday
                  ? "#f0c97210"
                  : "#13111f",
                borderColor: isSelected ? "#f0c972" : isToday ? "#f0c972" : "#221d35"
              }}
            >
              <div
                className="font-mono text-xs font-semibold"
                style={{
                  color: isSelected ? "#0d0b14" : isToday ? "#f0c972" : "#e8e3f8"
                }}
              >
                {day.getDate()}
              </div>

              {/* Indicator dots inside calendar grids */}
              <div className="flex gap-0.5 justify-center mt-1">
                {hasEvents && <div className="w-1 h-1 rounded-full bg-[#4285F4]" />}
                {hasGoals && <div className="w-1 h-1 rounded-full bg-[#6fcf97]" />}
                {hasSupps && <div className="w-1 h-1 rounded-full bg-[#f0c972]" />}
                {hasWorkouts && <div className="w-1 h-1 rounded-full bg-orange-400" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected day Detail layout */}
      {selectedDayKey ? (
        renderDayDetail(selectedDayKey)
      ) : (
        <div className="text-center font-mono py-8 text-[#3d3657] text-[10px]">
          Tap a calendar cell for complete routine scheduled details.
        </div>
      )}
    </div>
  );
}
