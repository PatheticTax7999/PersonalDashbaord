import React, { useState, useEffect, useRef } from "react";
import { UserState, CaffeineLog, CustomCaffeineDrink } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface CaffeineTabProps {
  userState: UserState;
  onUpdateUserState: (updated: UserState) => void;
}

// Standard pre-researched drinks database (60 Items)
const STANDARD_DRINKS = [
  // COFFEE (18 ITEMS)
  { name: "Double Espresso Shot", mg: 154, emoji: "☕", cat: "coffee" },
  { name: "Single Espresso Shot", mg: 77, emoji: "☕", cat: "coffee" },
  { name: "Flat White (Cafe Standard)", mg: 120, emoji: "☕", cat: "coffee" },
  { name: "Caffè Latte", mg: 120, emoji: "☕", cat: "coffee" },
  { name: "Cappuccino", mg: 120, emoji: "☕", cat: "coffee" },
  { name: "Cold Brew Glass", mg: 150, emoji: "🧊", cat: "coffee" },
  { name: "Nitro Cold Brew", mg: 215, emoji: "⚡", cat: "coffee" },
  { name: "Drip / Filter Cup", mg: 140, emoji: "☕", cat: "coffee" },
  { name: "Iced Caffè Americano", mg: 120, emoji: "☕", cat: "coffee" },
  { name: "Instant Nescafe Brew", mg: 65, emoji: "☕", cat: "coffee" },
  { name: "French Press Cafetiere", mg: 135, emoji: "☕", cat: "coffee" },
  { name: "Turkish Strong Coffee", mg: 95, emoji: "☕", cat: "coffee" },
  { name: "Caffè Mocha (Choc)", mg: 105, emoji: "🍫", cat: "coffee" },
  { name: "Macchiato Espresso Duo", mg: 80, emoji: "☕", cat: "coffee" },
  { name: "Cafe de Olla (Spiced)", mg: 90, emoji: "☕", cat: "coffee" },
  { name: "Traditional Cuban Espresso", mg: 85, emoji: "⚡", cat: "coffee" },
  { name: "Creamy Affogato scoop", mg: 75, emoji: "🍨", cat: "coffee" },
  { name: "Decaf Drip Mug", mg: 4, emoji: "💤", cat: "coffee" },

  // TEAS & INFUSIONS (12 ITEMS)
  { name: "Matcha Whisked Bowl", mg: 70, emoji: "🍵", cat: "tea" },
  { name: "English Breakfast Mug", mg: 50, emoji: "🍵", cat: "tea" },
  { name: "Earl Grey Bergamot", mg: 55, emoji: "🍵", cat: "tea" },
  { name: "Japanese Sencha Tea", mg: 30, emoji: "🍵", cat: "tea" },
  { name: "Premium Oolong Tea", mg: 40, emoji: "🍵", cat: "tea" },
  { name: "Masala Chai Latte", mg: 50, emoji: "🌶️", cat: "tea" },
  { name: "Yerba Mate Gourd", mg: 85, emoji: "🧉", cat: "tea" },
  { name: "Iced Lemon Black Tea", mg: 45, emoji: "🥤", cat: "tea" },
  { name: "White Peony Tea", mg: 25, emoji: "🍵", cat: "tea" },
  { name: "Jasmine Green Scented", mg: 30, emoji: "🌸", cat: "tea" },
  { name: "Pu-erh Aged Tea", mg: 60, emoji: "🍵", cat: "tea" },
  { name: "Kombucha Microbrew", mg: 15, emoji: "🍾", cat: "tea" },

  // ENERGY DRINKS (11 ITEMS)
  { name: "Monster Energy Original", mg: 160, emoji: "👿", cat: "energy" },
  { name: "Red Bull Energy Slimcan", mg: 80, emoji: "🐂", cat: "energy" },
  { name: "Rockstar Energy", mg: 160, emoji: "🎸", cat: "energy" },
  { name: "Celsius Live Fit", mg: 200, emoji: "🔥", cat: "energy" },
  { name: "C4 Performance Pre", mg: 200, emoji: "💥", cat: "energy" },
  { name: "Reign Performance Fuel", mg: 300, emoji: "👑", cat: "energy" },
  { name: "Ghost Legend Slicks", mg: 200, emoji: "👻", cat: "energy" },
  { name: "Bang Sour Heads", mg: 300, emoji: "🔫", cat: "energy" },
  { name: "Prime Energy Can", mg: 200, emoji: "🧉", cat: "energy" },
  { name: "V Blue Energy (AU)", mg: 85, emoji: "⚡", cat: "energy" },
  { name: "V Sugarfree Can (AU)", mg: 85, emoji: "⚡", cat: "energy" },

  // CARBONATED SODAS (10 ITEMS)
  { name: "Coca-Cola Classic", mg: 34, emoji: "🥤", cat: "soda" },
  { name: "Diet Coke Can", mg: 46, emoji: "🥤", cat: "soda" },
  { name: "Coke Zero Sugar", mg: 34, emoji: "🥤", cat: "soda" },
  { name: "Pepsi Original", mg: 38, emoji: "🥤", cat: "soda" },
  { name: "Pepsi Max Intense", mg: 43, emoji: "🥤", cat: "soda" },
  { name: "Mountain Dew Citrus", mg: 54, emoji: "🍋", cat: "soda" },
  { name: "Dr Pepper Classic Cherry", mg: 41, emoji: "🍪", cat: "soda" },
  { name: "Club-Mate Spark", mg: 100, emoji: "🧉", cat: "soda" },
  { name: "Sunkist Orange Splash", mg: 0, emoji: "🍊", cat: "soda" },
  { name: "Sprite Crisp Lemon", mg: 0, emoji: "🍋", cat: "soda" },

  // ATHLETIC PILLS / LAB SHOTS (5 ITEMS)
  { name: "5-Hour Energy Shot", mg: 200, emoji: "🔋", cat: "shots" },
  { name: "Caffeine Anhydrous Pill", mg: 200, emoji: "💊", cat: "shots" },
  { name: "Pre-Workout Heavy Scoop", mg: 250, emoji: "🏋️", cat: "shots" },
  { name: "Guarana Extract Capsule", mg: 100, emoji: "🔋", cat: "shots" },
  { name: "Focus Smart Nootropic", mg: 150, emoji: "🧠", cat: "shots" },

  // CHOCOLATE & SWEET (5 ITEMS)
  { name: "Dark Chocolate Block (100g)", mg: 80, emoji: "🍫", cat: "other" },
  { name: "Milk Chocolate Block (100g)", mg: 20, emoji: "🍫", cat: "other" },
  { name: "Hot Cocoa Velvet Mug", mg: 10, emoji: "☕", cat: "other" },
  { name: "Coffee Infused Dessert Gelato", mg: 50, emoji: "🍨", cat: "other" },
  { name: "Organic Cacao Ground Scoop", mg: 15, emoji: "🍫", cat: "other" }
];

export default function CaffeineTab({ userState, onUpdateUserState }: CaffeineTabProps) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [graphMode, setGraphMode] = useState<"line" | "bars" | "stack">("line");
  const [scrubHour, setScrubHour] = useState<number | null>(null);

  // Custom presets form
  const [customName, setCustomName] = useState("");
  const [customMg, setCustomMg] = useState("");

  // Modal State triggers
  const [logModalDrink, setLogModalDrink] = useState<{ name: string; mg: number; emoji: string } | null>(null);
  const [modalTimeMode, setModalTimeMode] = useState<"now" | "custom">("now");
  const [modalCustomTime, setModalCustomTime] = useState("");

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Safe defaults if arrays are missing on state
  const logsList = userState.caffeineLogs || [];
  const customList = userState.customCaffeineDrinks || [];

  // Localized clock hour update
  const [currentLocalHour, setCurrentLocalHour] = useState<number>(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentLocalHour(now.getHours() + now.getMinutes() / 60);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Pharmacokinetic math constants
  const HALF_LIFE = 5.0; // hours
  const PEAK_OFFSET = 0.75; // hours (45 min absorption bump)
  const CLEAR_BOUND = 10.0; // mg considered "cleared"

  // Gauss distribution
  const gaussian = (x: number, mu: number, sd: number) => {
    return Math.exp(-0.5 * Math.pow((x - mu) / sd, 2));
  };

  // Sleep wake-ups default models
  const wake = 7.0; // 7:00 AM
  const bedtime = 23.0; // 11:00 PM

  // Calc personalized limits based on client's weight from userState
  const getPersonalizedWeightKg = (): number => {
    if (userState.weightLog && userState.weightLog.length > 0) {
      // Get the latest logged weight
      const sorted = [...userState.weightLog].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return sorted[0].weight;
    }
    return 75; // high quality baseline standard
  };

  const weightKg = getPersonalizedWeightKg();
  const weightLimitMultiplier = 6.0; // mg per kg standard ceiling limit
  const maxDailyCeiling = Math.min(Math.round(weightKg * weightLimitMultiplier), 400);
  const optimalTargetMg = Math.round(weightKg * 3.0); // 3 mg/kg

  // Core decay algorithms
  const calculateActiveCaffeineAtHour = (t: number, customLogsList: CaffeineLog[] = logsList): number => {
    let total = 0.0;
    customLogsList.forEach(entry => {
      const entryHour = parseTimeToDecimal(entry.time);
      const hoursSince = t - entryHour;

      if (hoursSince < 0) return; // not drank yet at this target timeline

      if (hoursSince < PEAK_OFFSET) {
        // rising absorption linear rate
        const activeAtPeak = entry.mg * Math.pow(0.5, PEAK_OFFSET / HALF_LIFE);
        total += activeAtPeak * (hoursSince / PEAK_OFFSET);
      } else {
        // decay half-life equation
        total += entry.mg * Math.pow(0.5, hoursSince / HALF_LIFE);
      }
    });
    return total;
  };

  const getEnergyAtHour = (t: number, customLogsList: CaffeineLog[] = logsList): number => {
    const circadian = 50 + 18 * Math.cos(2 * Math.PI * (t - 16.5) / 24);

    if (t < wake || t >= bedtime) {
      // sleeping: clamp scoring parameters
      const asleepVal = circadian - 34;
      return Math.min(Math.max(asleepVal, 3), 20);
    }

    // awake equations
    const lunchDip = 10 * gaussian(t, 14.0, 1.4);
    const hoursAwake = t - wake;
    const sleepPressure = Math.min(Math.max(hoursAwake, 0), 24) * 1.7;
    const morningCortisolBump = 10 * gaussian(t - wake, 1.2, 0.9);

    // Caffeine active system boost index curves
    const activeMgNow = calculateActiveCaffeineAtHour(t, customLogsList);
    const caffeineBoost = 34 * (1 - Math.exp(-activeMgNow / 110));

    const finalScore = circadian - lunchDip - sleepPressure + morningCortisolBump + caffeineBoost;
    return Math.min(Math.max(finalScore, 0), 100);
  };

  const parseTimeToDecimal = (timeStr: string): number => {
    if (!timeStr) return 0.0;
    const parts = timeStr.split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
  };

  const decimalToTimeString = (decimal: number): string => {
    decimal = decimal % 24;
    if (decimal < 0) decimal += 24;
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    const finalMin = minutes === 60 ? 59 : minutes;
    const paddedMin = String(finalMin).padStart(2, "0");

    const displayHr = hours % 12 === 0 ? 12 : hours % 12;
    const ampm = hours >= 12 ? "PM" : "AM";
    return `${displayHr}:${paddedMin} ${ampm}`;
  };

  // Scoring details
  const displayTargetHour = scrubHour !== null ? scrubHour : currentLocalHour;
  const targetEnergy = getEnergyAtHour(displayTargetHour, logsList);
  const targetBaseline = getEnergyAtHour(displayTargetHour, []);
  const activeMgNow = calculateActiveCaffeineAtHour(displayTargetHour, logsList);

  // SVG Coordinates setup (Circumference calculation details for dashboard score widget)
  const roundedScore = Math.round(targetEnergy);
  const ringOffset = 339 - (339 * roundedScore) / 100;

  // Zone status label
  let stateText = "Steady";
  let ringColor = "#a78bfa"; // purple default

  if (roundedScore >= 80) {
    stateText = "Peak";
    ringColor = "#C9A36B"; // Custom warm luxury gold
  } else if (roundedScore >= 62) {
    stateText = "High";
    ringColor = "#f0c972"; // Gold
  } else if (roundedScore >= 40) {
    stateText = "Steady";
    ringColor = "#a78bfa";
  } else if (roundedScore >= 20) {
    stateText = "Dip";
    ringColor = "#fb923c"; // Orange amber
  } else {
    stateText = "Low";
    ringColor = "#ef4444"; // Red alert
  }

  // Calculate stats summation
  let consumedSumToday = 0;
  logsList.forEach(log => {
    consumedSumToday += log.mg;
  });

  const progressPct = Math.min((consumedSumToday / maxDailyCeiling) * 100, 100);

  // Projected cutoff hour to stay below 30 mg by bedtime
  const hoursNeededToClean = 5 * Math.log2(95 / 30); // ~8.3 hours
  const sleepCutoffHour = bedtime - hoursNeededToClean;

  // Calculating Peak focus Window
  let peakHour = 8.0;
  let peakScore = 0.0;
  for (let h = wake; h < bedtime; h += 0.1) {
    const s = getEnergyAtHour(h, logsList);
    if (s > peakScore) {
      peakScore = s;
      peakHour = h;
    }
  }
  const peakStartStr = decimalToTimeString(peakHour - 1.0);
  const peakEndStr = decimalToTimeString(peakHour + 1.0);

  // Predicted Crash calculations
  let steepestDrop = 0.0;
  let crashStart = 0.0;
  let crashEnd = 0.0;
  let endCrashVal = 0.0;

  for (let h = currentLocalHour; h < Math.min(currentLocalHour + 8, 24); h += 0.25) {
    for (let hFuture = h + 1.0; hFuture <= Math.min(h + 3.5, 24); hFuture += 0.25) {
      const e1 = getEnergyAtHour(h, logsList);
      const e2 = getEnergyAtHour(hFuture, logsList);
      const drop = e1 - e2;
      if (drop > steepestDrop) {
        steepestDrop = drop;
        crashStart = h;
        crashEnd = hFuture;
        endCrashVal = e2;
      }
    }
  }

  // Matching beverages grid filtering catalog lists
  let mergedList = [...customList, ...STANDARD_DRINKS];
  if (activeCategoryFilter !== "all") {
    mergedList = mergedList.filter(d => d.cat === activeCategoryFilter);
  }
  if (searchKeyword.trim() !== "") {
    mergedList = mergedList.filter(d => d.name.toLowerCase().includes(searchKeyword.toLowerCase()));
  }

  // Graph plotting coordinates helper mappings
  const svgWidth = 800;
  const svgHeight = 260;
  const paddingY = 20;
  const graphHeight = svgHeight - paddingY * 2; // 220px standard bounds

  const mapX = (hour: number) => (hour / 24) * svgWidth;
  const mapY = (score: number) => svgHeight - paddingY - (score / 100) * graphHeight;

  // Night shades rendering coordinates
  const morningShadeWidth = mapX(wake);
  const nightShadeStart = mapX(bedtime);

  // SVG Line/Stack points builder
  const caffeinePoints: string[] = [];
  const baselinePoints: string[] = [];

  for (let i = 0; i <= 144; i++) {
    const hr = (i / 144) * 24;
    const bScore = getEnergyAtHour(hr, []);
    const cScore = getEnergyAtHour(hr, logsList);

    caffeinePoints.push(`${mapX(hr)},${mapY(cScore)}`);
    baselinePoints.push(`${mapX(hr)},${mapY(bScore)}`);
  }

  const caffeinePathD = `M ${caffeinePoints.join(" L ")}`;
  const baselinePathD = `M ${baselinePoints.join(" L ")}`;

  // Stack Area closing area points
  const stackPoints = [...caffeinePoints];
  for (let i = 144; i >= 0; i--) {
    stackPoints.push(baselinePoints[i]);
  }
  const stackPathD = `M ${stackPoints.join(" L ")} Z`;

  // Bars rendering coordinates indices (72 intervals of 20 mins)
  const barSegments: { x: number; y: number; w: number; h: number; color: string; score: number }[] = [];
  if (graphMode === "bars") {
    const intervals = 72;
    for (let i = 0; i < intervals; i++) {
      const h = (i / intervals) * 24;
      const score = getEnergyAtHour(h, logsList);
      const bx = mapX(h);
      const by = mapY(score);
      const bWidth = (svgWidth / intervals) - 1.5;
      const bHeight = (svgHeight - paddingY) - by;

      let barColor = "rgba(107, 227, 164, 0.45)"; // green
      if (score < 40) barColor = "rgba(239, 68, 68, 0.45)"; // red
      else if (score < 62) barColor = "rgba(245, 158, 11, 0.45)"; // orange

      barSegments.push({ x: bx, y: by, w: bWidth, h: bHeight, color: barColor, score });
    }
  }

  // Scrubber mouse action interactions handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    let clientX = 0;

    if ("touches" in e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      } else {
        return;
      }
    } else {
      clientX = e.clientX;
    }

    const relativeX = clientX - rect.left;
    let percentage = relativeX / rect.width;
    if (percentage < 0) percentage = 0;
    if (percentage > 1) percentage = 1;

    setScrubHour(percentage * 24.0);
  };

  // Add Supplement handlers
  const handleTriggerLogDrink = (drink: { name: string; mg: number; emoji: string }) => {
    setLogModalDrink(drink);
    setModalTimeMode("now");
    const now = new Date();
    const hr = String(now.getHours()).padStart(2, "0");
    const mn = String(now.getMinutes()).padStart(2, "0");
    setModalCustomTime(`${hr}:${mn}`);
  };

  const handleConfirmLogDrink = () => {
    if (!logModalDrink) return;

    let selectedTime = "";
    if (modalTimeMode === "now") {
      const now = new Date();
      selectedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    } else {
      selectedTime = modalCustomTime;
      if (!selectedTime) {
        alert("Please set a valid consumption hour!");
        return;
      }
    }

    const newRecord: CaffeineLog = {
      id: "log-" + Date.now(),
      name: logModalDrink.name,
      mg: logModalDrink.mg,
      emoji: logModalDrink.emoji,
      time: selectedTime,
      timestamp: new Date().toISOString()
    };

    const updatedLogs = [...logsList, newRecord];
    // Sort chronologically
    updatedLogs.sort((a, b) => parseTimeToDecimal(a.time) - parseTimeToDecimal(b.time));

    const updatedState = {
      ...userState,
      caffeineLogs: updatedLogs
    };

    onUpdateUserState(updatedState);
    setLogModalDrink(null);
  };

  const handleDeleteLogItem = (id: string) => {
    if (window.confirm("Delete this caffeine intake record from system?")) {
      const updatedLogs = logsList.filter(log => log.id !== id);
      const updatedState = {
        ...userState,
        caffeineLogs: updatedLogs
      };
      onUpdateUserState(updatedState);
    }
  };

  const handleSaveCustomPreset = () => {
    const mg = parseInt(customMg);
    if (!customName.trim() || isNaN(mg) || mg <= 0) {
      alert("Please provide a valid Preset Name and Caffeine Strength (mg)!");
      return;
    }

    const newPreset: CustomCaffeineDrink = {
      id: "custom-" + Date.now(),
      name: customName.trim(),
      mg: mg,
      emoji: "☕",
      cat: "other"
    };

    const updatedPresets = [newPreset, ...customList];
    const updatedState = {
      ...userState,
      customCaffeineDrinks: updatedPresets
    };

    onUpdateUserState(updatedState);
    setCustomName("");
    setCustomMg("");
  };

  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent logging popup dialogs
    if (window.confirm("Permanently delete this custom beverage preset?")) {
      const updatedPresets = customList.filter(item => item.id !== id);
      const updatedState = {
        ...userState,
        customCaffeineDrinks: updatedPresets
      };
      onUpdateUserState(updatedState);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6 md:py-10 text-[#e8e3f8]">
      
      {/* Top Banner layout */}
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bebas tracking-wide font-black bg-gradient-to-r from-[#C9A36B] to-[#876231] bg-clip-text text-transparent">
            Caffeine Optimizer
          </h1>
          <p className="font-mono text-[10px] text-[#8e85b3] tracking-widest uppercase mt-1">
            Predictive Energy-Curve Tracking & Pharmacokinetics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Energy curves chart, stats and advising */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* CARD 1: Your Day Dashboard */}
          <div className="bg-[#13111f]/60 border border-[#2a2440]/60 rounded-3xl p-6 relative backdrop-blur-xl">
            <h2 className="font-bebas text-2xl tracking-wider text-white mb-4 flex items-center gap-2">
              <span>☕</span> Your Day
            </h2>

            {/* Score Ring indicators */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 bg-[#0f0d1a]/50 p-4 rounded-2xl border border-[#221d35]">
              {/* SVG Ring Gauge */}
              <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="56" cy="56" r="46" stroke="#1c192e" strokeWidth="6" fill="transparent" />
                  <circle 
                    cx="56" 
                    cy="56" 
                    r="46" 
                    stroke={ringColor} 
                    strokeWidth="6.5" 
                    fill="transparent" 
                    strokeDasharray="289" 
                    strokeDashoffset={289 - (289 * roundedScore) / 100} 
                    strokeLinecap="round" 
                    className="transition-all duration-300" 
                  />
                </svg>
                <div className="absolute flex flex-col items-center select-none">
                  <span className="text-3xl font-extrabold text-white leading-none">{roundedScore}</span>
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase mt-1 text-[#C9A36B]">
                    {stateText}
                  </span>
                </div>
              </div>

              {/* Focus Stats text */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="text-[10px] font-mono text-[#6b6485] tracking-widest uppercase font-bold">Timeline Focus</div>
                <div className="text-2xl font-bebas tracking-wide text-white mt-1 leading-none">
                  {scrubHour !== null ? decimalToTimeString(scrubHour) : `RIGHT NOW (${decimalToTimeString(currentLocalHour)})`}
                </div>
                <p className="text-xs text-[#9991b8] mt-2">
                  Active Caffeine: <span className="font-mono text-[#C9A36B] font-bold">{activeMgNow.toFixed(1)} mg</span>
                </p>
                <p className="text-[10px] text-[#6b6485] mt-1 italic leading-relaxed">
                  Hover/drag across the energy curve below to adjust hours
                </p>
              </div>
            </div>

            {/* Controller Header for graph option */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono font-bold text-[#6b6485] tracking-widest uppercase">Projected Energy Timeline</span>
              <div className="inline-flex bg-[#0f0d1a] border border-[#241f3b] rounded-xl p-1 gap-1 select-none font-mono text-[9px] font-bold">
                <button 
                  onClick={() => setGraphMode("line")} 
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${graphMode === "line" ? "bg-[#C9A36B]/25 text-[#C9A36B]" : "text-[#9991b8] hover:text-white"}`}
                >
                  LINE
                </button>
                <button 
                  onClick={() => setGraphMode("bars")} 
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${graphMode === "bars" ? "bg-[#C9A36B]/25 text-[#C9A36B]" : "text-[#9991b8] hover:text-white"}`}
                >
                  BARS
                </button>
                <button 
                  onClick={() => setGraphMode("stack")} 
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${graphMode === "stack" ? "bg-[#C9A36B]/25 text-[#C9A36B]" : "text-[#9991b8] hover:text-white"}`}
                >
                  STACK
                </button>
              </div>
            </div>

            {/* Core SVG Canvas Plot */}
            <div className="relative w-full overflow-hidden bg-[#07050d] border border-[#201c33] rounded-2xl p-2 select-none">
              <svg 
                ref={svgRef}
                viewBox="0 0 800 260" 
                className="w-full h-auto cursor-col-resize block overflow-visible"
                style={{ touchAction: "none" }}
                onMouseMove={handleMouseMove}
                onTouchMove={handleMouseMove}
                onMouseLeave={() => setScrubHour(null)}
                onTouchEnd={() => setScrubHour(null)}
              >
                {/* Night shades backgrounds */}
                <rect x="0" y={paddingY} width={morningShadeWidth} height={graphHeight} fill="rgba(24, 20, 48, 0.45)" />
                <rect x={nightShadeStart} y={paddingY} width={svgWidth - nightShadeStart} height={graphHeight} fill="rgba(24, 20, 48, 0.45)" />
                
                {/* Sleep boundaries lines */}
                <line x1={morningShadeWidth} y1={paddingY} x2={morningShadeWidth} y2={svgHeight - paddingY} stroke="rgba(201,163,107,0.3)" strokeWidth="1.5" strokeDasharray="3,3" />
                <line x1={nightShadeStart} y1={paddingY} x2={nightShadeStart} y2={svgHeight - paddingY} stroke="rgba(201,163,107,0.3)" strokeWidth="1.5" strokeDasharray="3,3" />

                {/* Score Horizontal threshold gridlines */}
                {[20, 40, 62, 80].map(score => {
                  const y = mapY(score);
                  let strokeColor = "rgba(42, 36, 64, 0.4)";
                  if (score === 62) strokeColor = "rgba(107,227,164,0.12)";
                  if (score === 40) strokeColor = "rgba(245,158,11,0.08)";
                  return (
                    <g key={score}>
                      <line x1="0" y1={y} x2={svgWidth} y2={y} stroke={strokeColor} strokeWidth="1" />
                      <text x="5" y={y - 4} fill="rgba(107,100,133,0.35)" fontFamily="monospace" fontSize="8.5">{score}</text>
                    </g>
                  );
                })}

                {/* Plot drawings based on chosen mode */}
                {graphMode === "line" && (
                  <>
                    <path d={baselinePathD} fill="none" stroke="rgba(107,227,164,0.15)" strokeWidth="2" strokeDasharray="4,4" />
                    <path d={caffeinePathD} fill="none" stroke="#C9A36B" strokeWidth="3" strokeLinecap="round" />
                  </>
                )}

                {graphMode === "stack" && (
                  <>
                    <path d={baselinePathD} fill="none" stroke="rgba(107,227,164,0.15)" strokeWidth="2" strokeDasharray="4,4" />
                    <path d={stackPathD} fill="rgba(201, 163, 107, 0.08)" />
                    <path d={caffeinePathD} fill="none" stroke="#E2C49A" strokeWidth="2.5" strokeLinecap="round" />
                  </>
                )}

                {graphMode === "bars" && (
                  <g>
                    {barSegments.map((bar, idx) => (
                      <rect key={idx} x={bar.x} y={bar.y} width={bar.w} height={bar.h} fill={bar.color} rx="1" />
                    ))}
                  </g>
                )}

                {/* vertical Scrubbing lines */}
                {scrubHour !== null && (
                  <g>
                    <line x1={mapX(displayTargetHour)} y1={paddingY} x2={mapX(displayTargetHour)} y2={svgHeight - paddingY} stroke="rgba(201,163,107,0.4)" strokeWidth="1.5" strokeDasharray="3,2" />
                    <circle cx={mapX(displayTargetHour)} cy={mapY(targetEnergy)} r="5" fill="#C9A36B" stroke="#ffffff" strokeWidth="1.5" />
                    {graphMode === "stack" && (
                      <circle cx={mapX(displayTargetHour)} cy={mapY(targetBaseline)} r="4" fill="#34d399" stroke="none" />
                    )}
                  </g>
                )}
              </svg>
            </div>

            {/* X labels text timeline row */}
            <div className="flex justify-between px-2.5 text-[9px] font-mono text-[#6b6485] mt-2 select-none">
              <span>12:00 AM</span>
              <span>4:00 AM</span>
              <span>8:00 AM</span>
              <span>12:00 PM</span>
              <span>4:00 PM</span>
              <span>8:00 PM</span>
              <span>12:00 AM</span>
            </div>

            {/* Summary projection indicators footer */}
            <div className="grid grid-cols-3 gap-3 bg-[#131122]/65 border border-[#221d35] rounded-2xl mt-5 p-3.5 text-center select-none font-sans">
              <div>
                <div className="text-[9px] font-mono text-[#6b6485] tracking-widest uppercase font-bold">Peak Focus</div>
                <div className="text-xs font-semibold text-white mt-1">
                  {peakStartStr} – {peakEndStr}
                </div>
              </div>
              <div className="border-x border-[#221d35]">
                <div className="text-[9px] font-mono text-[#6b6485] tracking-widest uppercase font-bold">Predicted Crash</div>
                <div className="text-xs font-semibold text-white mt-1">
                  {steepestDrop > 15.0 ? `${decimalToTimeString(crashStart)}` : "Stable"}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-[#6b6485] tracking-widest uppercase font-bold">Last Sip By</div>
                <div className="text-xs font-semibold text-[#C9A36B] mt-1">
                  {decimalToTimeString(sleepCutoffHour)}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Smart Timing Advisories */}
          <div className="bg-[#13111f]/60 border border-[#2a2440]/60 rounded-3xl p-6 backdrop-blur-xl text-left">
            <h2 className="font-bebas text-2xl tracking-wider text-white mb-4 flex items-center gap-2">
              <span>⚡</span> Smart Timing Insights
            </h2>

            {/* Productive tiles row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5 font-sans">
              <div className="bg-[#0f0d1a] border border-[#221d35] rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[8.5px] font-mono text-[#C9A36B] tracking-wider uppercase font-bold">Most Productive</span>
                  <div className="text-base font-bold text-white mt-1.5 leading-tight">{peakStartStr} – {peakEndStr}</div>
                </div>
                <div className="text-[10px] text-[#9991b8] font-mono mt-2 pt-1 border-t border-[#1d1930]">Peak: {Math.round(peakScore)}</div>
              </div>

              <div className="bg-[#0f0d1a] border border-[#221d35] rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[8.5px] font-mono text-amber-500 tracking-wider uppercase font-bold">Crash Warning</span>
                  <div className="text-base font-bold text-white mt-1.5 leading-tight">
                    {steepestDrop > 15.0 ? `${decimalToTimeString(crashStart)} – ${decimalToTimeString(crashEnd)}` : "No sharp crash"}
                  </div>
                </div>
                <div className="text-[10px] text-[#9991b8] font-mono mt-2 pt-1 border-t border-[#1d1930]">Next 8 Hours</div>
              </div>

              <div className="bg-[#0f0d1a] border border-[#221d35] rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[8.5px] font-mono text-[#C9A36B] tracking-wider uppercase font-bold">Sleep Cutoff</span>
                  <div className="text-base font-bold text-[#C9A36B] mt-1.5 leading-tight">
                    {decimalToTimeString(sleepCutoffHour)}
                  </div>
                </div>
                <div className="text-[10px] text-[#9991b8] font-mono mt-2 pt-1 border-t border-[#1d1930]">Cortisol safety</div>
              </div>
            </div>

            {/* Dynamic bullet recommendations */}
            <div className="bg-[#0b0914] border border-[#1d1930] rounded-2xl p-4">
              <span className="text-[10px] font-mono text-[#C9A36B] font-bold tracking-wider uppercase block mb-3">
                ☕ Cognitive Performance Pro Tips
              </span>
              <ul className="space-y-3 font-sans text-xs text-[#9991b8] leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C9A36B] mt-0.5">•</span>
                  <div>
                    <strong>Delay Your Morning Brew:</strong> Postpone your first intake by 90 minutes after waking. This allows natural adenosine reserves to rise and prevents the standard afternoon slump pattern.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C9A36B] mt-0.5">•</span>
                  <div>
                    <strong>Hydration Proportions:</strong> Caffeine exerts a transient diuretic trigger. Ensure you consume 350ml of trace-mineral active water for every 100mg of caffeine to sustain muscular hydration levels.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#C9A36B] mt-0.5">•</span>
                  <div>
                    <strong>Bedtime Guarding:</strong> Maintain a strict boundary cutoff at <span className="text-white font-mono font-bold">{decimalToTimeString(sleepCutoffHour)}</span> to prevent central nervous system stimulation and preserve phase 3 deep delta sleep quality.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Logs entries list & add sips widgets */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* CARD 3: Today's absolute intakes ceiling progress */}
          <div className="bg-[#13111f]/60 border border-[#2a2440]/60 rounded-3xl p-6 backdrop-blur-xl text-left">
            <h2 className="font-bebas text-2xl tracking-wider text-white mb-2 flex items-center justify-between">
              <span>📊 Intake Today</span>
              <span className="font-mono text-sm uppercase text-[#C9A36B] font-bold pl-2 tracking-widest shrink-0">
                Active: {calculateActiveCaffeineAtHour(currentLocalHour, logsList).toFixed(1)} mg
              </span>
            </h2>

            <div className="flex justify-between items-end mb-2 select-none mt-4 font-sans">
              <div>
                <span className="text-3xl font-extrabold text-white">{consumedSumToday}</span>
                <span className="text-xs text-[#9991b8]"> / {maxDailyCeiling} mg Limit</span>
              </div>
              <div className="text-right text-[10px] font-mono text-[#6b6485]">
                Ceiling calculated at 6mg/kg
              </div>
            </div>

            {/* Ceiling progress indicators */}
            <div className="w-full h-3 bg-[#0f0d1a] rounded-full overflow-hidden border border-[#221d35] mb-4">
              <div 
                className="h-full bg-gradient-to-r from-[#C9A36B] to-[#F1D2A4] transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Profile bodyweight note card */}
            <div className="text-[11px] text-[#9991b8] bg-[#0f0d1a] border border-[#221d35] rounded-xl p-3 leading-relaxed font-sans">
              <strong>Integrated Metrics:</strong> Body weight reading of{" "}
              <span className="text-white font-mono font-bold">{weightKg.toFixed(1)} kg</span> yields an optimal single session dose of{" "}
              <strong>{optimalTargetMg} mg</strong> (approx. 3mg/kg). Your safely adjusted cortisol ceiling is set at{" "}
              <span className="text-[#C9A36B] font-bold">{maxDailyCeiling} mg</span>.
            </div>
          </div>

          {/* CARD 4: Log beverages presets catalog search */}
          <div className="bg-[#13111f]/60 border border-[#2a2440]/60 rounded-3xl p-6 backdrop-blur-xl text-left">
            <h2 className="font-bebas text-2xl tracking-wider text-white mb-4 flex items-center gap-2">
              <span>➕ Log a Drink</span>
            </h2>

            {/* Horizontal pill scrolling */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none select-none">
              {[
                { id: "all", label: "All Drinks" },
                { id: "coffee", label: "☕ Coffee" },
                { id: "tea", label: "🍵 Tea" },
                { id: "energy", label: "⚡ Energy" },
                { id: "soda", label: "🥤 Soda" },
                { id: "shots", label: "💊 Shots" },
                { id: "other", label: "🍫 Sweet" }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 text-[10px] uppercase font-mono font-bold tracking-wider rounded-lg cursor-pointer whitespace-nowrap transition-all border shrink-0 ${
                    activeCategoryFilter === cat.id
                      ? "bg-[#C9A36B] text-slate-100 border-[#C9A36B]"
                      : "bg-[#0f0d1a]/60 text-[#9991b8] border-[#221d35] hover:border-slate-500 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search inputs bar */}
            <div className="relative mb-4 font-sans">
              <input 
                type="text" 
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Search catalog... (e.g., flat white, matcha, celsius)" 
                className="w-full bg-[#0f0d1a] text-white border border-[#2d264f] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#C9A36B] transition-all placeholder-[#504a6e]"
              />
              {searchKeyword && (
                <button 
                  onClick={() => setSearchKeyword("")} 
                  className="absolute right-3.5 top-2.5 text-[#6b6485] hover:text-white text-xs font-bold font-mono"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Matched presets scrolling area */}
            <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 pr-1 font-sans">
              {mergedList.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#504a6e] font-mono">
                  No matching beverages found
                </div>
              ) : (
                mergedList.map((drink, index) => {
                  // Custom item checking
                  const isCustom = "id" in drink && String(drink.id).startsWith("custom-");
                  return (
                    <div
                      key={index}
                      onClick={() => handleTriggerLogDrink(drink as any)}
                      className="flex justify-between items-center bg-[#0d0a17]/50 border border-[#221d37] rounded-xl py-2 px-3 hover:border-[#C9A36B]/60 hover:bg-[#1a172e]/40 cursor-pointer transition-all active:scale-[0.99] select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl shrink-0">{drink.emoji}</span>
                        <div className="min-w-0 text-left">
                          <span className="text-xs font-bold text-white block truncate leading-snug">{drink.name}</span>
                          <span className="text-[9px] font-mono font-semibold text-[#8a81ad] uppercase tracking-wider block">
                            {drink.cat} {isCustom ? "• Preset" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono font-bold text-[#C9A36B] bg-[#C9A36B]/10 px-2 py-1 rounded-lg border border-[#C9A36B]/25">
                          {drink.mg} mg
                        </span>
                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustomPreset(drink.id as string, e)}
                            className="text-red-400 hover:text-red-300 font-bold p-1 cursor-pointer"
                            title="Delete custom preset"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#221d37] my-4 pt-4 text-left">
              <span className="text-[10px] font-mono text-[#C9A36B] font-bold tracking-widest uppercase block mb-2 select-none">
                Save Custom Beverage Preset
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Drink Name (e.g., My Cold Brew)" 
                  className="sm:col-span-5 bg-[#0f0d1a] border border-[#2c254d] text-xs px-3 py-2 rounded-lg text-white focus:outline-none focus:border-[#C9A36B] placeholder-[#504a6e]"
                />
                <input 
                  type="number" 
                  value={customMg}
                  onChange={(e) => setCustomMg(e.target.value)}
                  placeholder="Caffeine (mg)" 
                  className="sm:col-span-4 bg-[#0f0d1a] border border-[#2c254d] text-xs px-3 py-2 rounded-lg text-white focus:outline-none focus:border-[#C9A36B] placeholder-[#504a6e]"
                />
                <button 
                  onClick={handleSaveCustomPreset}
                  className="sm:col-span-3 bg-[#C9A36B] hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition-all"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>

          {/* CARD 5: Consumed lists chronological logs entries */}
          <div className="bg-[#13111f]/60 border border-[#2a2440]/60 rounded-3xl p-6 backdrop-blur-xl text-left">
            <h2 className="font-bebas text-2xl tracking-wider text-white mb-4 flex items-center gap-2">
              <span>⏱️ Consumed Today</span>
            </h2>

            <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1 font-sans">
              {logsList.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#504a6e] font-mono italic">
                  No caffeine logged in systems today
                </div>
              ) : (
                logsList.map(log => {
                  const decimalTime = parseTimeToDecimal(log.time);
                  const peakVal = decimalTime + PEAK_OFFSET;
                  const halfGoneVal = decimalTime + HALF_LIFE;
                  
                  // Clearance hours: dose * Math.pow(0.5, hours/5) = 10 mg
                  const hoursToClear = log.mg > CLEAR_BOUND ? HALF_LIFE * Math.log2(log.mg / CLEAR_BOUND) : 0.0;
                  const clearedVal = decimalTime + hoursToClear;

                  return (
                    <div 
                      key={log.id} 
                      className="bg-[#0f0d1a]/70 border border-[#221d35] rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{log.emoji}</span>
                          <div className="text-left min-w-0">
                            <span className="text-xs font-bold text-white block truncate leading-none mb-1">{log.name}</span>
                            <span className="text-[10px] font-mono text-[#8a81ad]">
                              Consumed at {decimalToTimeString(decimalTime)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-[#C9A36B]">
                            {log.mg} mg
                          </span>
                          <button 
                            onClick={() => handleDeleteLogItem(log.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1 rounded font-mono text-xs cursor-pointer transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Timelines pharmacokinetic projections metrics */}
                      <div className="grid grid-cols-3 gap-1 grid-dotted text-[9px] font-mono border-t border-[#1d1930] pt-2 select-none text-left">
                        <div>
                          <span className="text-[#6b6485] block uppercase">PEAK (+45m)</span>
                          <span className="text-[#a7f3d0] font-semibold">{decimalToTimeString(peakVal)}</span>
                        </div>
                        <div className="border-x border-[#1a1530] px-1">
                          <span className="text-[#6b6485] block uppercase">HALF-LIFE (+5h)</span>
                          <span className="text-[#fbcfe8] font-semibold">{decimalToTimeString(halfGoneVal)}</span>
                        </div>
                        <div className="pl-1">
                          <span className="text-[#6b6485] block uppercase">CLEARED (&lt;10mg)</span>
                          <span className="text-slate-400 font-semibold">{decimalToTimeString(clearedVal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ingestion time choice modal dialog box overlay */}
      <AnimatePresence>
        {logModalDrink && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#110e20] border border-[#2a2440] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative"
            >
              <h3 className="text-lg font-bebas tracking-wide text-white mb-1 text-left">
                Log <span className="text-[#C9A36B] font-semibold">{logModalDrink.name}</span>
              </h3>
              <p className="text-xs text-[#9991b8] text-left mb-4">
                Set accurate ingestion hour to calculate real-time pharmacokinetic simulation curves.
              </p>

              <div className="flex flex-col gap-4 mb-6">
                {/* Mode Selector pills toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#0b0a14] border border-[#221d35] rounded-xl">
                  <button 
                    onClick={() => setModalTimeMode("now")} 
                    className={`py-1.5 text-[11px] font-mono uppercase font-bold rounded-lg cursor-pointer transition-all ${
                      modalTimeMode === "now"
                        ? "bg-[#C9A36B]/20 text-[#C9A36B]"
                        : "text-[#9991b8]"
                    }`}
                  >
                    RIGHT NOW
                  </button>
                  <button 
                    onClick={() => setModalTimeMode("custom")} 
                    className={`py-1.5 text-[11px] font-mono uppercase font-bold rounded-lg cursor-pointer transition-all ${
                      modalTimeMode === "custom"
                        ? "bg-[#C9A36B]/20 text-[#C9A36B]"
                        : "text-[#9991b8]"
                    }`}
                  >
                    SELECT TIME
                  </button>
                </div>

                {/* Custom Time Selector */}
                {modalTimeMode === "custom" && (
                  <div className="flex flex-col gap-1 items-center justify-center">
                    <label className="text-[10px] font-mono text-[#6b6485] uppercase tracking-wider block mb-1">
                      Set Consumption Hour
                    </label>
                    <input 
                      type="time" 
                      value={modalCustomTime}
                      onChange={(e) => setModalCustomTime(e.target.value)}
                      className="bg-[#1c192e] text-white border border-[#2a2440] rounded-xl px-4 py-2 font-mono text-xl text-center tracking-widest focus:outline-none focus:border-[#C9A36B]" 
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setLogModalDrink(null)} 
                  className="px-4 py-2 text-xs font-mono text-[#9991b8] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmLogDrink} 
                  className="px-5 py-2 text-xs font-semibold bg-[#C9A36B] hover:brightness-110 active:scale-95 text-slate-950 rounded-xl transition-all shadow-lg"
                >
                  Add Intake
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
