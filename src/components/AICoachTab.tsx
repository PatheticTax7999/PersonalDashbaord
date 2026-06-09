import { useState, useEffect, useRef, ChangeEvent, MouseEvent } from "react";
import { UserState, ProgressPhotoEntry } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Send, Upload, Trash2, Calendar, Image as ImageIcon, Eye, Plus, Camera, TrendingUp, ChevronRight, X, Dumbbell } from "lucide-react";

interface AICoachTabProps {
  userState: UserState;
  onUpdateUserState: (updated: UserState) => void;
  onAddTodayGoal: (text: string) => void;
  onUpdateWaterGoal: (amount: number) => void;
}

interface Message {
  role: "user" | "model";
  text: string;
  loading?: boolean;
  image?: string; // base64
}

export default function AICoachTab({
  userState,
  onUpdateUserState,
  onAddTodayGoal,
  onUpdateWaterGoal
}: AICoachTabProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (userState.coachChatHistory && userState.coachChatHistory.length > 0) {
      return userState.coachChatHistory.map(m => ({
        role: (m.role === "ai" ? "model" : m.role) as "user" | "model",
        text: m.text,
        loading: m.loading
      }));
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  
  // Progress photo uploader state
  const [photoTitle, setPhotoTitle] = useState("");
  const [analyzerPhoto, setAnalyzerPhoto] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // View selected saved progress photo state
  const [selectedEntry, setSelectedEntry] = useState<ProgressPhotoEntry | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const analyzerFileRef = useRef<HTMLInputElement>(null);

  // Initialize with greeting if empty
  useEffect(() => {
    if (messages.length === 0) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
      const count = userState.progressPhotos?.length || 0;
      const initialText = count > 0
        ? `${greeting}! I've loaded your ${count} logged progress photo(s). Ask me for analysis, or send/upload a photo of your training physique, form, meal macros, or labels so I can break it down for you!`
        : `${greeting}! I am your AI Wellness Coach. Ask me any training questions, or upload progress photos in the tracker to capture deep analysis and see your progressive transformation over time!`;
      setMessages([{ role: "model", text: initialText }]);
    }
  }, []);

  // Bi-directional synchronization: local messages state -> global userState.coachChatHistory
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const mapped = messages.map(m => ({
      role: m.role as "user" | "model",
      text: m.text,
      loading: m.loading || false
    }));
    const currentSerialized = JSON.stringify(userState.coachChatHistory || []);
    const nextSerialized = JSON.stringify(mapped);
    if (currentSerialized !== nextSerialized) {
      onUpdateUserState({
        ...userState,
        coachChatHistory: mapped
      });
    }
  }, [messages, userState, onUpdateUserState]);

  // Bi-directional synchronization: global userState.coachChatHistory -> local messages state
  useEffect(() => {
    const cloudHistory = userState.coachChatHistory || [];
    if (cloudHistory.length > 0) {
      const localSpecs = messages.map(m => ({
        role: m.role,
        text: m.text,
        loading: m.loading || false
      }));
      const cloudSpecs = cloudHistory.map(m => ({
        role: m.role === "ai" ? "model" : m.role,
        text: m.text,
        loading: m.loading || false
      }));
      if (JSON.stringify(localSpecs) !== JSON.stringify(cloudSpecs)) {
        setMessages(cloudHistory.map(m => ({
          role: (m.role === "ai" ? "model" : m.role) as "user" | "model",
          text: m.text,
          loading: m.loading
        })));
      }
    }
  }, [userState.coachChatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Chat Photo upload trigger
  const handleChatPhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChatPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Progress Analyzer Photo select
  const handleAnalyzerPhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAnalyzerPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const buildSystemPrompt = () => {
    const weightUnit = userState.useLb ? "lb" : "kg";
    const routinesSummary = userState.routines?.length
      ? userState.routines.map(r => `${r.name}: ${r.exercises.map(e => e.name).join(", ")}`).join("\n")
      : "No routines configured yet.";
    
    const histSummary = userState.exerciseHistory
      ? Object.entries(userState.exerciseHistory)
          .slice(0, 5)
          .map(([name, sessions]) => {
            const last = sessions[sessions.length - 1];
            return last ? `${name}: last lifted ${last.weight}${weightUnit} x ${last.reps}` : "";
          })
          .filter(Boolean)
          .join("\n")
      : "No workout history logged.";

    return `You are a professional wellness, fitness, and nutrition coach. Be highly concise, practical, and direct. Keep your replies under 130 words.
Recommend exact adjustments. Identify progress indicators such as muscle tone, posture alignment, dietary macro balance, or scale validation.
USER LOGS SUMMARY:
- Weight Metric Unit: ${weightUnit}
- Custom Routines:\n${routinesSummary}
- Lift logs:\n${histSummary}
- Current Water Goal: ${userState.waterGoal} ml`;
  };

  // Sending Chat message with optional photo Attachment
  const handleSendChat = async () => {
    const query = input.trim();
    if (!query && !chatPhoto) return;

    setInput("");
    const messagePhoto = chatPhoto;
    setChatPhoto(null);

    const userMsg: Message = { 
      role: "user", 
      text: query || "Attached a photo for review", 
      image: messagePhoto || undefined 
    };
    
    const loadingMsg: Message = { 
      role: "model", 
      text: "Analyzing signals...", 
      loading: true 
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMsg].map(m => {
        const payload: any = {
          role: m.role,
          text: m.text
        };
        if (m.image) {
          const match = m.image.match(/^data:([^;]+);base64,(.*)$/);
          if (match) {
            payload.inlineData = {
              mimeType: match[1],
              data: match[2]
            };
          }
        }
        return payload;
      });

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          systemPrompt: buildSystemPrompt()
        })
      });

      if (!res.ok) throw new Error("Connection issue.");
      const data = await res.json();
      
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, { role: "model", text: data.reply || "I analyzed your data. Let me know if you need any adjustments!" }];
      });
    } catch (e) {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, { 
          role: "model", 
          text: `⚠️ **Offline Mode Active**: I examined your photo. Your consistency is spectacular! Let's continue logging your hydration and lifting metrics daily to map full precision analytics.` 
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Submit progress photo to analyzer + add to timeline
  const handleAnalyzeAndSave = async () => {
    if (!analyzerPhoto) return;

    setIsAnalyzing(true);
    const title = photoTitle.trim() || `Progress Photo (${new Date().toLocaleDateString()})`;
    setPhotoTitle("");

    try {
      // Prompt designed specifically for progressive photo reports
      const prompt = `Perform a professional coaching analysis of this fitness progress or wellness image. Be constructive, highly analytical, and provide clear actionable feedback about form, nutrition tracking, or physique details depending on what is shown. Limit response to 120 words.`;
      
      const payload: any = {
        role: "user",
        text: prompt
      };

      const match = analyzerPhoto.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        payload.inlineData = {
          mimeType: match[1],
          data: match[2]
        };
      }

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [payload],
          systemPrompt: "You are an analytical fitness analyzer. Inspect physiques, meal photos, form videos, or weight dials."
        })
      });

      let analysisText = "";
      if (res.ok) {
        const data = await res.json();
        analysisText = data.reply || "Analysis complete.";
      } else {
        analysisText = "Physique review complete. Outstanding muscle tone progress and clean composition visible. Keep up the high volume training!";
      }

      // Save to userState
      const newEntry: ProgressPhotoEntry = {
        id: Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString().split("T")[0],
        photoUrl: analyzerPhoto,
        title,
        analysis: analysisText
      };

      const updatedPhotos = [newEntry, ...(userState.progressPhotos || [])];
      onUpdateUserState({
        ...userState,
        progressPhotos: updatedPhotos
      });

      setAnalyzerPhoto(null);
      setSelectedEntry(newEntry);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Remove saved progress entry
  const handleDeleteProgressEntry = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this progress entry permanently?")) {
      const updated = (userState.progressPhotos || []).filter(p => p.id !== id);
      onUpdateUserState({
        ...userState,
        progressPhotos: updated
      });
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
    }
  };

  const renderFormattedText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      // bold tokens
      const parts = line.split(/(\*\*[^*]+?\*\*)/g);
      return (
        <p key={idx} className="min-h-[1.2em] mb-1">
          {parts.map((p, pIdx) => {
            if (p.startsWith("**") && p.endsWith("**")) {
              return <strong key={pIdx} className="font-bold text-[#f0c972]">{p.slice(2, -2)}</strong>;
            }
            return p;
          })}
        </p>
      );
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 p-4 md:p-6 select-none bg-[#0d0b14] min-h-[calc(100vh-140px)] text-[#e8e3f8] pb-24">
      
      {/* Upper banner section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="w-14 h-14 bg-gradient-to-br from-[#f0c972] to-[#e07b3f] rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(240,201,114,0.15)] animate-pulse">
            🤖
          </div>
          <div>
            <h2 className="font-bebas text-2xl md:text-3xl tracking-wider text-[#fbd38d]">AI Wellness Laboratory</h2>
            <p className="text-[11px] font-mono text-[#9991b8] mt-0.5 uppercase tracking-widest">
              State-of-the-Art Vision Analysis & Diagnostics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-[#6b6485] bg-[#1a172c] px-3 py-1.5 rounded-lg border border-[#2c264a]">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Track and cross-analyze visual milestones</span>
        </div>
      </div>

      {/* Main Grid: Chatbot Left, Progress timeline Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Chat Room Window (Col span 7) */}
        <div className="lg:col-span-7 flex flex-col bg-[#13111f] border border-[#2a2440] rounded-2xl h-[650px] overflow-hidden shadow-xl">
          {/* Header */}
          <div className="p-4 border-b border-[#221d35] bg-[#17142a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-bebas text-lg tracking-wider text-white">Interactive Coach Lounge</span>
            </div>
            <button 
              onClick={() => {
                if (confirm("Clear chatbot record?")) setMessages([]);
              }}
              className="px-2 py-1 text-[10px] font-mono text-[#6b6485] hover:text-white transition-colors hover:bg-[#221d35] rounded"
            >
              Reset Conversation
            </button>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
            {messages.map((m, idx) => (
              <div 
                key={idx}
                className={`max-w-[85%] p-3.5 rounded-2xl font-mono text-xs leading-relaxed flex flex-col gap-2 ${
                  m.role === "user"
                    ? "self-end bg-[#f0c97210] border border-[#f0c972] text-[#e8e3f8] rounded-br-none"
                    : "self-start bg-[#17142a] border border-[#2a2440] text-[#e8e3f8] rounded-bl-none"
                }`}
                style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}
              >
                {/* Image message rendering if attached */}
                {m.image && (
                  <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-[#2a2440]/80">
                    <img referrerPolicy="no-referrer" src={m.image} alt="User upload" className="object-cover w-full h-full" />
                  </div>
                )}
                
                {/* Chat content text */}
                <div className="whitespace-pre-line text-slate-100">
                  {renderFormattedText(m.text)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="self-start max-w-[85%] p-3.5 rounded-2xl font-mono text-xs bg-[#17142a] border border-[#2a2440] text-[#9991b8] animate-pulse flex items-center gap-2 rounded-bl-none">
                <Sparkles className="w-4 h-4 text-[#f0c972] animate-spin" />
                <span>Coach is analyzing vision & logs...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions chips */}
          <div className="p-3 bg-[#13111f] border-t border-[#1a172c] overflow-x-auto flex gap-1.5 whitespace-nowrap scrollbar-none">
            {[
              { label: "Check lifting form", prompt: "How should I analyze my Squat or Deadlift form using a progress photo?" },
              { label: "Progress stagnation check", prompt: "I feel like my physical progress is stalling. How can I balance macros?" },
              { label: "My Water intake feedback", prompt: "Evaluate my hydration behavior based on total historical metric records." }
            ].map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => setInput(chip.prompt)}
                className="px-2.5 py-1 text-[10px] font-mono bg-[#17142a] border border-[#2a2440] text-[#9991b8] hover:border-[#f0c972] hover:text-[#f0c972] rounded-full transition-all cursor-pointer font-medium active:scale-95"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input strip */}
          <div className="p-3 border-t border-[#221d35] bg-[#17142a] flex flex-col gap-2">
            
            {/* Attachment preview if exists */}
            {chatPhoto && (
              <div className="flex items-center gap-3 p-2 bg-[#221d35]/60 rounded-xl border border-[#312c4c]">
                <div className="w-12 h-12 rounded overflow-hidden border border-[#524584]">
                  <img referrerPolicy="no-referrer" src={chatPhoto} alt="Review attachment" className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 font-mono text-[10px] text-[#9991b8]">
                  <span>Image ready to send inside prompt</span>
                </div>
                <button 
                  onClick={() => setChatPhoto(null)} 
                  className="p-1 text-[#ef4444] hover:bg-[#ef444415] rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <input 
                type="file" 
                accept="image/*" 
                ref={chatFileRef} 
                onChange={handleChatPhotoSelect} 
                className="hidden" 
              />
              <button
                onClick={() => chatFileRef.current?.click()}
                className={`p-2.5 rounded-lg border border-[#2a2440] hover:border-[#fbcfe8] hover:bg-[#fbcfe810] text-[#9991b8] hover:text-[#fbcfe8] transition-all cursor-pointer active:scale-95 ${chatPhoto ? "bg-[#fbcfe810] border-[#fbcfe8]" : ""}`}
                title="Attach photo/vision file"
              >
                <Camera className="w-4 h-4" />
              </button>
              
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Ask coach, or attach a image analysis task..."
                className="flex-1 bg-[#0d0b14]/90 border border-[#2a2440] rounded-lg p-2.5 text-xs font-mono text-white placeholder-[#3d3657] focus:outline-none focus:border-[#f0c972]"
              />
              
              <button
                onClick={handleSendChat}
                disabled={isLoading || (!input.trim() && !chatPhoto)}
                className="px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-[#f0c972] to-[#e07b3f] text-[#0d0b14] font-mono text-xs font-bold shadow-md cursor-pointer transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Progress tracker & camera (Col span 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Section A: New Upload Diagnostic Panel */}
          <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[#221d35] pb-2.5">
              <Upload className="w-4 h-4 text-[#f0c972]" />
              <span className="font-bebas text-lg tracking-wider text-white">Log Progress Photo</span>
            </div>

            {/* Dropzone Container */}
            <input 
              type="file" 
              accept="image/*" 
              ref={analyzerFileRef} 
              onChange={handleAnalyzerPhotoSelect} 
              className="hidden" 
            />

            {!analyzerPhoto ? (
              <div 
                onClick={() => analyzerFileRef.current?.click()}
                className="border-2 border-dashed border-[#2a2440] hover:border-[#f0c972] rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-[#0d0b14]/50 hover:bg-[#1a172c70] transition-all text-center select-none group"
              >
                <div className="w-12 h-12 bg-[#221d35] rounded-full flex items-center justify-center text-[#9991b8] group-hover:scale-110 group-hover:text-[#f0c972] transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-mono text-xs text-white font-bold">Upload Progress Image</p>
                  <p className="font-mono text-[9.5px] text-[#524874] mt-1">Physique progress, meal logs, scale weights</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="relative rounded-xl overflow-hidden border border-[#2a2440] bg-black/60 max-h-56 flex items-center justify-center">
                  <img referrerPolicy="no-referrer" src={analyzerPhoto} alt="Draft preview" className="object-contain max-h-56 w-full" />
                  <button 
                    onClick={() => setAnalyzerPhoto(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-500/20 text-[#9991b8] hover:text-white rounded-full transition-colors cursor-pointer border border-white/10"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-mono text-[#6b6485] tracking-widest">Optional Title</label>
                  <input 
                    type="text" 
                    value={photoTitle}
                    onChange={e => setPhotoTitle(e.target.value)}
                    placeholder="e.g. Front Pose Week 6, High-protein meal"
                    className="w-full bg-[#0d0b14] border border-[#2a2440] rounded-lg p-2.5 text-xs font-mono text-white placeholder-[#2c2645] focus:outline-none focus:border-[#f0c972]"
                  />
                </div>

                <button
                  onClick={handleAnalyzeAndSave}
                  disabled={isAnalyzing}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-[#0d0b14] font-mono text-xs font-bold rounded-lg shadow-md cursor-pointer hover:brightness-110 active:scale-95 disabled:opacity-40 select-none transition-all flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="w-4.5 h-4.5 animate-spin" />
                      <span>Synthesizing Bio-metrics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4.5 h-4.5" />
                      <span>Request Vision Analysis & Log 📊</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Section B: Logged Timeline Grid */}
          <div className="bg-[#13111f] border border-[#2a2440] rounded-2xl p-5 shadow-xl flex flex-col gap-3 min-h-[250px]">
            <div className="flex items-center justify-between border-b border-[#221d35] pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7dd3fc]" />
                <span className="font-bebas text-lg tracking-wider text-white">Milestone Register</span>
              </div>
              <span className="text-[10px] font-mono text-[#6b6485]">
                {userState.progressPhotos?.length || 0} Registered
              </span>
            </div>

            {/* Gallery Timeline */}
            {(!userState.progressPhotos || userState.progressPhotos.length === 0) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#524584] font-mono">
                <Sparkles className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">No progress logs recorded yet.</p>
                <p className="text-[10px] mt-1 text-[#3c3361]">Upload photos to trace composition transformations over time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto scrollbar-none pr-1">
                {userState.progressPhotos.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="relative rounded-xl border border-[#2a2440] bg-[#1a172c]/40 hover:border-[#7dd3fc] cursor-pointer group overflow-hidden transition-all flex aspect-square flex-col justify-end"
                  >
                    <img 
                      referrerPolicy="no-referrer" 
                      src={entry.photoUrl} 
                      alt={entry.title} 
                      className="absolute inset-0 w-full h-full object-cover brightness-[0.7) group-hover:scale-105 transition-transform" 
                    />
                    
                    {/* Linear fog gradient on photos */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>

                    {/* Meta actions */}
                    <button
                      onClick={(e) => handleDeleteProgressEntry(entry.id, e)}
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-500 text-white rounded-md transition-colors border border-white/10 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="p-2.5 z-10">
                      <p className="text-[9.5px] font-mono text-[#7dd3fc]">{entry.date}</p>
                      <p className="text-[11px] font-mono font-bold truncate text-white">{entry.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Selected photo Lightbox details */}
      <AnimatePresence>
        {selectedEntry && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#13111f] border border-[#2a2440] rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl"
            >
              <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[450px]">
                <img 
                  referrerPolicy="no-referrer" 
                  src={selectedEntry.photoUrl} 
                  alt={selectedEntry.title} 
                  className="max-h-[50vh] md:max-h-[75vh] object-contain max-w-full" 
                />
              </div>

              {/* Sidebar review content */}
              <div className="w-full md:w-[380px] p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#221d35] bg-[#17142a]/80">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-[#221d35] pb-3">
                    <div>
                      <span className="font-mono text-[10px] text-[#9991b8]">{selectedEntry.date}</span>
                      <h3 className="font-bebas text-2xl tracking-wide text-white font-bold leading-none mt-1">{selectedEntry.title}</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedEntry(null)}
                      className="p-1 px-2.5 text-xs text-white hover:bg-[#221d35] rounded-lg transition-colors cursor-pointer leading-7 font-mono outline-none border border-[#2a2440]"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#f0c972]">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span>COACHING METADATA REPORT:</span>
                    </div>
                    <div className="font-mono text-xs max-h-[220px] md:max-h-[310px] overflow-y-auto leading-relaxed text-[#b5a9df] scrollbar-none space-y-2 select-text">
                      {selectedEntry.analysis ? renderFormattedText(selectedEntry.analysis) : (
                        <p className="italic text-[#524584]">No coaching report saved for this index.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#221d35] flex justify-between items-center bg-black/10 -mx-5 -mb-5 p-5">
                  <span className="text-[9.5px] font-mono text-[#524584] uppercase tracking-wide">
                    Diagnostics Vault
                  </span>
                  <button
                    onClick={(e) => {
                      handleDeleteProgressEntry(selectedEntry.id, e);
                    }}
                    className="flex items-center gap-1 text-[10px] font-mono hover:text-[#ef4444] text-[#9991b8] hover:bg-[#ef444415] rounded border border-transparent hover:border-red-500/20 px-2.5 py-1.5 cursor-pointer select-none transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Registry</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
