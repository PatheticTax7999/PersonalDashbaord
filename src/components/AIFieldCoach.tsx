import { useState, useEffect, useRef } from "react";
import { UserState, Exercise, Routine } from "../types";

interface AIFieldCoachProps {
  userState: UserState;
  onSaveRoutine: (id: string | null, name: string, exercises: Exercise[]) => void;
  onAddTodayGoal: (text: string) => void;
  onUpdateWaterGoal: (amount: number) => void;
  setActiveTab: (tab: "home" | "fitness" | "health" | "calendar") => void;
}

interface Message {
  role: "user" | "model";
  text: string;
  loading?: boolean;
  actionExecuted?: {
    type: "create_routine" | "add_goal" | "update_water_goal";
    name?: string;
    text?: string;
    amount?: number;
  };
}

// Helper to render bold (**text**) and italic (*text*) markdown formatting in line with UI styling
const renderLineWithFormat = (line: string) => {
  if (!line) return "";
  const tokens = line.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-[#f0c972]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <span key={i} className="italic text-[#b5a9df] font-medium">
          {token.slice(1, -1)}
        </span>
      );
    }
    return token;
  });
};

export default function AIFieldCoach({
  userState,
  onSaveRoutine,
  onAddTodayGoal,
  onUpdateWaterGoal,
  setActiveTab
}: AIFieldCoachProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
      const hasHistory = Object.keys(userState.exerciseHistory || {}).length > 0;
      const initialMsg = hasHistory
        ? `${greeting}! I've reviewed your training data. Ask me about progressive overload, nutrition, recovery, or personalized wellness goals.`
        : `${greeting}! I'm your AI wellness coach. Once you log some routines or hydration data, I'll be able to provide tailored suggestions! For now, ask me anything.`;
      setMessages([{ role: "model", text: initialMsg }]);
    }
  }, [isOpen]);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build the rich context prompt to provide to the server side
  function buildSystemPrompt() {
    const weightUnit = userState.useLb ? "lb" : "kg";
    const routinesSummary = userState.routines?.length
      ? userState.routines.map(r => `${r.name}: ${r.exercises.map(e => e.name).join(", ")}`).join("\n")
      : "No routines configured yet.";
    
    const histSummary = userState.exerciseHistory
      ? Object.entries(userState.exerciseHistory)
          .slice(0, 8)
          .map(([name, sessions]) => {
            const last = sessions[sessions.length - 1];
            return last ? `${name}: last lifted ${last.weight}${weightUnit} x ${last.reps} reps (${sessions.length} sessions total)` : "";
          })
          .filter(Boolean)
          .join("\n")
      : "No workout history logged.";

    const suppSummary = userState.supplements?.length
      ? userState.supplements.map(s => `${s.name} ${s.dosage ? `(${s.dosage})` : ""} scheduled: ${s.times.join(", ")}`).join(", ")
      : "None";

    const weightHistory = userState.weightLog?.length
      ? [...userState.weightLog]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-8)
          .map(e => `${e.date}: ${userState.useLb ? (e.weight * 2.20462).toFixed(1) : e.weight}${weightUnit}`)
          .join(", ")
      : "No weight log entries yet.";

    const goalsStr = userState.todayGoals?.length
      ? userState.todayGoals.map(g => `${g.done ? "✓" : "-"} ${g.text}`).join(", ")
      : "None listed for today.";

    const waterDone = Object.values(userState.waterLog).reduce((acc, curr) => acc + curr, 0);

    const completedWorkoutsSummary = userState.completedWorkouts?.length
      ? userState.completedWorkouts
          .slice(-10)
          .map(w => {
            const exSummary = w.exercises.map(e => `${e.name} (${e.setsCount} sets)`).join(", ");
            return `- ${w.date}: "${w.name}" completed in ${w.durationMinutes} min. [Exercises: ${exSummary}]`;
          })
          .join("\n")
      : "No completed workouts logged in the calendar yet.";

    return `You are a professional wellness, fitness and nutrition coach. Be highly concise, practical, and direct. Keep your replies under 130 words. Use bullet points where appropriate for legibility. Connect responses directly to the user's logged metrics where possible. Do not lecture on general concepts; give precise and direct advice.

If the user asks you to create, suggest, customize, design, recommend or add a training workout routine, always suggest a complete set of exercises. To automatically save the routine for them in the background so they can start it, you MUST append a valid JSON block at the very end of your response inside a standard markdown JSON tag like this (do NOT put any text after the markdown code block):
\`\`\`json
{
  "action": "create_routine",
  "name": "Routine Name",
  "exercises": [
    { "name": "Bench Press", "notes": "3 sets x 8-12 reps" },
    { "name": "Overhead Press", "notes": "3 sets x 10 reps" }
  ]
}
\`\`\`

CRITICAL TRAINING ROUTINE GENERATION RULES:
1. When asked to "Suggest a new workout" or create/recommend a workout, you MUST examine the "Completed Workouts History (Calendar Logs)" to see which exercises and muscle groups have been worked out recently. Target muscle groups that are LEAST FATIGUED (i.e. have not been trained recently, or are absent from recent logs).
2. The recommended workout MUST have some structural/style similarity (e.g., similar exercise style, volume format) with the user's "Configured routines".
3. **RULE FOR LACK OF DATA**: If the user has NO configured routines AND NO past completed workouts in their logged calendar history, you MUST NOT generate a routine yet. Instead, ask them exactly these two questions:
   - "What are you trying to train today?"
   - "How intense should this workout be?"
   Do NOT provide any exercises or JSON blocks if you lack these data points. Wait for their answers.

If the user asks you to adjust or set their daily water/hydration goal, append this action JSON at the end:
\`\`\`json
{
  "action": "update_water_goal",
  "amount": 2500
}
\`\`\`

If you suggest any other personal daily goal for today, append this action JSON at the end:
\`\`\`json
{
  "action": "add_goal",
  "text": "Go for a 20-min run"
}
\`\`\`

Only output JSON actions if the user explicitly or implicitly requested that configuration or suggestion.

USER PERFORMANCE FILE:
- Weight Metric Unit: ${weightUnit}
- Configured routines:\n${routinesSummary}
- Completed Workouts History (Calendar Logs):\n${completedWorkoutsSummary}
- Recent exercise logs:\n${histSummary}
- Supplements checklists:\n${suppSummary}
- Weight progress logs:\n${weightHistory}
- Daily goal tasks checklist:\n${goalsStr}
- Hydration goal: ${userState.waterGoal} ml (unit: ${userState.waterUnit})`;
  }

  async function handleSend() {
    const query = input.trim();
    if (!query) return;

    setInput("");
    const userMsg: Message = { role: "user", text: query };
    const loadingMsg: Message = { role: "model", text: "Thinking...", loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      const messagesHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.text
      }));

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesHistory,
          systemPrompt: buildSystemPrompt()
        })
      });

      if (!res.ok) {
        let errorMsg = "Could not contact coach backend.";
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const replyText = data.reply || "";
      
      let cleanedText = replyText;
      let actionExecuted: any = undefined;

      const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = replyText.match(jsonBlockRegex);
      if (match) {
        try {
          const jsonStr = match[1].trim();
          const parsed = JSON.parse(jsonStr);
          
          if (parsed && parsed.action === "create_routine") {
            const exercisesWithId = (parsed.exercises || []).map((ex: any) => ({
              id: Math.random().toString(36).slice(2, 9),
              name: ex.name,
              notes: ex.notes || ""
            }));
            onSaveRoutine(null, parsed.name || "AI Routine", exercisesWithId);
            actionExecuted = {
              type: "create_routine",
              name: parsed.name || "AI Suggested Routine"
            };
          } else if (parsed && parsed.action === "add_goal") {
            onAddTodayGoal(parsed.text);
            actionExecuted = {
              type: "add_goal",
              text: parsed.text
            };
          } else if (parsed && parsed.action === "update_water_goal") {
            onUpdateWaterGoal(Number(parsed.amount));
            actionExecuted = {
              type: "update_water_goal",
              amount: Number(parsed.amount)
            };
          }
        } catch (e) {
          console.error("Coach action parsing error:", e);
        }
        cleanedText = replyText.replace(jsonBlockRegex, "").trim();
      }

      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, { role: "model", text: cleanedText, actionExecuted }];
      });
    } catch (err: any) {
      console.error(err);
      
      // Calculate dynamic offline advice based on the existing userState metrics
      const todayKey = new Date().toISOString().slice(0, 10);
      const isOz = userState.waterUnit === "oz";
      const isGlass = userState.waterUnit === "glass";
      const isBottle = userState.waterUnit === "bottle";
      const mlPer = isOz ? 29.5 : isGlass ? 250 : isBottle ? 1000 : 1;
      const unitsDone = userState.waterLog[todayKey] || 0;
      const mlDone = Math.round(unitsDone * mlPer);
      const pct = userState.waterGoal > 0 ? Math.round((mlDone / userState.waterGoal) * 100) : 0;
      
      let hydrationAdvice = `You've registered ${mlDone} ml today (${pct}% of your ${userState.waterGoal} ml target). Go grab a glass and log it!`;
      if (mlDone === 0) {
        hydrationAdvice = `No water logged yet today. Make sure to track hydration in the **Health** tab to meet your optimal target of **${userState.waterGoal} ml**!`;
      } else if (pct >= 100) {
        hydrationAdvice = `Phenomenal job! You reached **100% or more of your optimal hydration target** (${mlDone} ml). Excellent focus on systemic replenishment!`;
      } else if (pct >= 50) {
        hydrationAdvice = `Over halfway there! You have hit **${pct}% of your daily water intake** (${mlDone} ml). Keep sipping steadily!`;
      }

      let trainingAdvice = "No logged workouts in your calendar yet. Head over to the **Fitness** tab, customize a training routine, and tap start!";
      if (userState.completedWorkouts && userState.completedWorkouts.length > 0) {
        const last = userState.completedWorkouts[userState.completedWorkouts.length - 1];
        trainingAdvice = `Your most recent session was **"${last.name}"** completed on ${last.date} in ${last.durationMinutes} minutes. Stay committed to progressive overload!`;
      }

      let supplementAdvice = "No supplements scheduled yet. You can add daily schedules (e.g. Creatine, protein timings) in the **Health** tab.";
      if (userState.supplements && userState.supplements.length > 0) {
        const unchecked = userState.supplements.filter(s => {
          return !s.times.every(slot => userState.suppChecks[todayKey]?.[`${s.id}_${slot}`]);
        });
        if (unchecked.length === 0) {
          supplementAdvice = `All compiled supplements for today are Checked off. Fantastic diligence in recovery protocols!`;
        } else {
          const names = unchecked.map(u => u.name).join(", ");
          supplementAdvice = `Out of ${userState.supplements.length} total, you still have schedules remaining unchecked: **${names}**. Don't forget to check them off!`;
        }
      }

      const offlineMessage = `⚠️ **The coach is currently experiencing heavy demand**, but your progress never stops! Here is your **personalized offline fitness analysis** based on your live logs:

💧 **Hydration Progress**:
${hydrationAdvice}

🏋️ **Training History**:
${trainingAdvice}

💊 **Supplement Routines**:
${supplementAdvice}

*If you'd like a more specific answer, feel free to try sending your message again in a few moments!*`;

      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, { role: "model", text: offlineMessage }];
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* FAB Button */}
      <button
        id="coach-fab"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 left-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl cursor-pointer shadow-lg z-50 transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: isOpen
            ? "linear-gradient(135deg, #9180c4, #5a4a8a)"
            : "linear-gradient(135deg, #f0c972, #e07b3f)",
          boxShadow: isOpen ? "0 4px 20px rgba(145, 128, 196, 0.4)" : "0 4px 20px rgba(240, 201, 114, 0.4)"
        }}
        title="AI Wellness Coach"
      >
        <span>🤖</span>
      </button>

      {/* Expandable modal */}
      {isOpen && (
        <div
          id="coach-modal"
          className="fixed bottom-36 left-4 right-4 md:left-6 max-w-[440px] h-[65vh] md:h-[500px] bg-[#13111f] rounded-2xl border border-[#2a2440] shadow-2xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom duration-200"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-[#221d35] bg-[#13111f]">
            <div className="text-2xl">🤖</div>
            <div className="flex-1">
              <div className="font-bebas text-lg tracking-wider text-[#f0c972]">
                AI Wellness Coach
              </div>
              <div className="text-[10px] text-[#9991b8] font-mono">
                Powered by Gemini • Realtime wellness strategist
              </div>
            </div>
            <button
              onClick={() => setMessages([])}
              className="px-2 py-1 text-[10px] uppercase font-mono text-[#6b6485] rounded hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col scrollbar-none">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] p-3 rounded-2xl font-mono text-xs leading-relaxed ${
                  m.role === "user"
                    ? "align-self-end self-end bg-[#f0c97210] border border-[#f0c972] text-[#e8e3f8] rounded-br-sm"
                    : "align-self-start self-start bg-[#17142a] border border-[#2a2440] text-[#e8e3f8] rounded-bl-sm"
                } ${m.loading ? "animate-pulse italic opacity-75" : ""}`}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start"
                }}
              >
                {m.text.split("\n").map((line, lIdx) => {
                  let displayLine = line;
                  let isListItem = false;
                  if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("• ")) {
                    displayLine = line.replace(/^[\*\-\•]\s+/, "");
                    isListItem = true;
                  }
                  return (
                    <p
                      key={lIdx}
                      className={`min-h-[1em] ${isListItem ? "pl-4 relative" : ""}`}
                    >
                      {isListItem && <span className="absolute left-0 text-[#f0c972] font-bold">•</span>}
                      {renderLineWithFormat(displayLine)}
                    </p>
                  );
                })}

                {m.actionExecuted && (
                  <div className="mt-3 pt-2.5 border-t border-[#312c4c] flex flex-col gap-1.5 font-mono">
                    {m.actionExecuted.type === "create_routine" && (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#f0c972] font-bold">
                          <span>🏋️</span> ROUTINE ADDED INSTANTLY
                        </div>
                        <div className="text-[10px] text-[#b5a9df] leading-normal">
                          "{m.actionExecuted.name}" is now on your fitness routines list.
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("fitness");
                            setIsOpen(false);
                          }}
                          className="mt-1 w-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] text-[9px] font-bold py-1.5 px-2 rounded hover:brightness-110 active:scale-95 transition-all text-center cursor-pointer uppercase tracking-wider"
                        >
                          Go and start workout 🏋️
                        </button>
                      </>
                    )}
                    {m.actionExecuted.type === "add_goal" && (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                          <span>🎯</span> NEW TODAY'S GOAL ADDED
                        </div>
                        <div className="text-[10px] text-[#b5a9df] leading-normal italic">
                          "{m.actionExecuted.text}"
                        </div>
                      </>
                    )}
                    {m.actionExecuted.type === "update_water_goal" && (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-bold">
                          <span>💧</span> HYDRATION GOAL UPDATED
                        </div>
                        <div className="text-[10px] text-[#b5a9df] leading-normal">
                          Daily goal adjusted to {m.actionExecuted.amount} ml.
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("health");
                            setIsOpen(false);
                          }}
                          className="mt-1 w-full bg-[#1c182c] border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 text-[9px] font-bold py-1 px-2 rounded hover:text-white transition-all text-center cursor-pointer uppercase tracking-wider"
                        >
                          Check log 💧
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Preset Chips */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none border-t border-[#1a172c]">
              {[
                { label: "Suggest new workout", text: "Please suggest a brand new workout routine for me. Analyze my past completed workouts in my logged calendar to focus on muscle groups that are least fatigued, and ensure it shares similarity with my configured routines! If I don't have any past logged calendar data or configured routines, please ask me questions to understand my goal." },
                { label: "Analyse progress", text: "Please look at my logged history and stats. Give me feedback and progress summary!" },
                { label: "Hydration feedback", text: "Am I drinking enough water based on my log today? Provide a tip!" }
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(chip.text);
                  }}
                  className="px-2.5 py-1 text-[10px] font-mono bg-[#17142a] border border-[#2a2440] rounded-full text-[#9991b8] hover:border-[#f0c972] hover:text-[#f0c972] transition-all cursor-pointer font-medium"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Input strip */}
          <div className="p-3 border-t border-[#221d35] flex gap-2 bg-[#13111f] items-center">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask your coach anything..."
              rows={1}
              className="flex-1 bg-[#17142a] border border-[#2a2440] rounded-lg p-2 text-xs font-mono text-[#e8e3f8] placeholder-[#3d3657] focus:outline-none focus:border-[#f0c972] max-h-16 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-mono text-xs font-bold shadow-md cursor-pointer transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
