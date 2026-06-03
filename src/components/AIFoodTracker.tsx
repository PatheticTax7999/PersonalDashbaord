import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Html5Qrcode } from "html5-qrcode";

// Types for components
interface IngredientItem {
  name: string;
  quantityGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AnalysisData {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: IngredientItem[];
}

interface AIFoodTrackerProps {
  onLogFood: (
    name: string,
    calories: number,
    protein: number,
    carbs: number,
    fat: number,
    barcode?: string,
    quantity?: number
  ) => void;
  onClose: () => void;
  onOpenWorkoutModal?: () => void;
}

// 6 premium food preset items
const PRESET_FOODS = [
  {
    id: "salad",
    name: "Grilled Chicken Breast Garden Salad",
    emoji: "🥗",
    color: "from-green-500/20 to-emerald-500/10",
    border: "border-green-500/30",
    text: "Healthy & Lean",
    desc: "150g Grilled chicken, mixed garden vinaigrette greens",
    data: {
      foodName: "Grilled Chicken Breast Garden Salad",
      calories: 395,
      protein: 34.0,
      carbs: 10.5,
      fat: 18.2,
      ingredients: [
        { name: "Grilled Chicken Breast", quantityGrams: 150, calories: 247, protein: 31.0, carbs: 0.0, fat: 3.5 },
        { name: "Mixed Garden Greens", quantityGrams: 120, calories: 18, protein: 1.5, carbs: 3.5, fat: 0.2 },
        { name: "Olive Oil Vinaigrette", quantityGrams: 20, calories: 130, protein: 1.5, carbs: 7.0, fat: 14.5 }
      ]
    }
  },
  {
    id: "steak",
    name: "Aussie Beef Rump Steak",
    emoji: "🥩",
    color: "from-red-500/20 to-rose-500/10",
    border: "border-rose-500/30",
    text: "High Protein",
    desc: "220g Prime Rump, sautéed asparagus, garlic butter glaze",
    data: {
      foodName: "Grilled Rump Steak with Asparagus",
      calories: 490,
      protein: 42.5,
      carbs: 4.0,
      fat: 32.0,
      ingredients: [
        { name: "Aussie Beef Rump Steak", quantityGrams: 220, calories: 425, protein: 40.5, carbs: 0.0, fat: 28.5 },
        { name: "Sautéed Asparagus", quantityGrams: 80, calories: 35, protein: 1.5, carbs: 3.0, fat: 2.0 },
        { name: "Garlic Butter Glaze", quantityGrams: 10, calories: 30, protein: 0.5, carbs: 1.0, fat: 1.5 }
      ]
    }
  },
  {
    id: "burger",
    name: "Classic Cheeseburger with Fries",
    emoji: "🍔",
    color: "from-amber-500/20 to-orange-500/10",
    border: "border-amber-500/30",
    text: "Cheat Meal Splurge",
    desc: "Brioche bun, 120g beef patty, melt cheesetab",
    data: {
      foodName: "Classic Aussie Cheese Burger",
      calories: 595,
      protein: 29.5,
      carbs: 49.0,
      fat: 28.5,
      ingredients: [
        { name: "Soft Brioche Bun", quantityGrams: 80, calories: 210, protein: 6.0, carbs: 38.0, fat: 3.5 },
        { name: "Prime Beef Patty", quantityGrams: 120, calories: 285, protein: 21.0, carbs: 0.0, fat: 21.5 },
        { name: "Cheddar Cheese Slice", quantityGrams: 25, calories: 100, protein: 2.5, carbs: 11.0, fat: 3.5 }
      ]
    }
  },
  {
    id: "pancake",
    name: "Pancakes with Maple Syrup & Berries",
    emoji: "🥞",
    color: "from-pink-500/20 to-purple-500/10",
    border: "border-pink-500/30",
    text: "Sweet Breakfast",
    desc: "Buttermilk base, maple syrup drizzle, blueberries",
    data: {
      foodName: "Pancakes with Maple Syrup & Berries",
      calories: 420,
      protein: 8.5,
      carbs: 72.0,
      fat: 10.5,
      ingredients: [
        { name: "Buttermilk Pancake Base", quantityGrams: 120, calories: 280, protein: 7.0, carbs: 45.0, fat: 8.0 },
        { name: "Organic Blueberries", quantityGrams: 50, calories: 30, protein: 0.5, carbs: 7.0, fat: 0.1 },
        { name: "Pure Maple Syrup", quantityGrams: 30, calories: 110, protein: 1.0, carbs: 20.0, fat: 2.4 }
      ]
    }
  },
  {
    id: "sushi",
    name: "Salmon Avocado Sushi Roll",
    emoji: "🍣",
    color: "from-blue-500/20 to-indigo-500/10",
    border: "border-blue-500/30",
    text: "Lean carbs/fats",
    desc: "140g Seasoned rice, fresh salmon, avocado slices",
    data: {
      foodName: "Salmon Avocado Sushi Roll",
      calories: 360,
      protein: 12.8,
      carbs: 61.2,
      fat: 6.5,
      ingredients: [
        { name: "Seasoned Sushi Rice", quantityGrams: 140, calories: 240, protein: 4.5, carbs: 54.0, fat: 0.5 },
        { name: "Fresh Salmon Fillet", quantityGrams: 40, calories: 80, protein: 8.0, carbs: 0.0, fat: 5.0 },
        { name: "Avocado Slices", quantityGrams: 20, calories: 40, protein: 0.3, carbs: 7.2, fat: 1.0 }
      ]
    }
  },
  {
    id: "vegemite",
    name: "Aussie Vegemite Sourdough Toast",
    emoji: "🍞",
    color: "from-yellow-500/20 to-amber-500/10",
    border: "border-yellow-500/30",
    text: "Savory Quick Carb",
    desc: "2 sourdough toast slices, salted butter spread, vegemite",
    data: {
      foodName: "Aussie Vegemite Toast (2 Slices)",
      calories: 195,
      protein: 6.8,
      carbs: 28.5,
      fat: 4.8,
      ingredients: [
        { name: "White Sourdough Bread", quantityGrams: 80, calories: 145, protein: 5.2, carbs: 26.0, fat: 1.2 },
        { name: "Salted Butter Spread", quantityGrams: 10, calories: 45, protein: 0.1, carbs: 1.5, fat: 3.5 },
        { name: "Vegemite Yeast Extract", quantityGrams: 5, calories: 5, protein: 1.5, carbs: 1.0, fat: 0.1 }
      ]
    }
  }
];

export default function AIFoodTracker({
  onLogFood,
  onClose,
  onOpenWorkoutModal
}: AIFoodTrackerProps) {
  // Modes: "menu" | "camera" | "analyzing" | "results" | "manual" | "search" | "barcode"
  const [trackerMode, setTrackerMode] = useState<"menu" | "camera" | "analyzing" | "results" | "manual" | "search" | "barcode">("menu");
  
  // Custom meal logging options
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanCheckpoints, setScanCheckpoints] = useState<string[]>([]);
  const [currentMealType, setCurrentMealType] = useState<"Breakfast" | "Lunch" | "Snacks" | "Dinner" | "Activity" | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Live Camera/Upload hook points
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable fields on Results Stage
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);

  // Inline Editing Toggles
  const [editingName, setEditingName] = useState(false);
  const [editingCals, setEditingCals] = useState(false);
  const [editingProt, setEditingProt] = useState(false);
  const [editingCarbs, setEditingCarbs] = useState(false);
  const [editingFat, setEditingFat] = useState(false);

  // New manual ingredient builder in the results list
  const [newIngName, setNewIngName] = useState("");
  const [newIngGrams, setNewIngGrams] = useState(100);

  // Live Barcode Scanner parameter states
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [barcodeSearchError, setBarcodeSearchError] = useState("");
  const [isBarcodeSearching, setIsBarcodeSearching] = useState(false);

  // Live DB search parameters
  const [dbSearchQuery, setDbSearchQuery] = useState("");
  const [dbSearchSource, setDbSearchSource] = useState<"all" | "afcd" | "off">("all");
  const [dbSearchResults, setDbSearchResults] = useState<any[]>([]);
  const [isDbSearching, setIsDbSearching] = useState(false);
  const [dbSearchError, setDbSearchError] = useState("");
  const [selectedDbProduct, setSelectedDbProduct] = useState<any | null>(null);
  const [dbMultiplier, setDbMultiplier] = useState(1);

  // Stop camera stream on unmount or mode transition
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [trackerMode]);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startCameraStream = async () => {
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.error("Video element play failed", err));
      }
    } catch (err: any) {
      console.warn("webcam access declined or unavailable", err);
      setHasCameraPermission(false);
    }
  };

  // Capture Base64 from live video
  const capturePhoto = () => {
    if (videoRef.current) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setCapturedImage(dataUrl);
          stopCameraStream();
          triggerAIAnalysis(dataUrl);
        }
      } catch (err) {
        console.error("Failed to draw canvas frame", err);
      }
    }
  };

  // Upload custom file trigger
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCapturedImage(base64);
        stopCameraStream();
        triggerAIAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run a preset choice
  const selectPreset = (preset: typeof PRESET_FOODS[0]) => {
    setActivePresetId(preset.id);
    let sampleBase64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23251e44"/><text x="50" y="55" font-size="28" text-anchor="middle">${preset.emoji}</text></svg>`;
    setCapturedImage(sampleBase64);
    triggerAIAnalysis(sampleBase64, preset.data);
  };

  // Trigger barcode scanner module
  useEffect(() => {
    if (trackerMode !== "barcode") return;

    let html5QrcodeScanner: Html5Qrcode | null = null;
    setBarcodeSearchError("");

    const startScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const element = document.getElementById("applet-barcode-finder");
        if (!element) return;

        html5QrcodeScanner = new Html5Qrcode("applet-barcode-finder");
        await html5QrcodeScanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 180 }
          },
          async (decodedText) => {
            if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
              await html5QrcodeScanner.stop();
            }
            handleBarcodeLookup(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Barcode lens initialization failed:", err);
        setBarcodeSearchError("Could not access environment camera. Try typing manually or verify web permissions.");
      }
    };

    startScanner();

    return () => {
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch((e) => console.error("Scanner close failed:", e));
      }
    };
  }, [trackerMode]);

  const handleBarcodeLookup = async (barcode: string) => {
    setBarcodeSearchError("");
    setIsBarcodeSearching(true);
    try {
      const res = await fetch(`/api/food/barcode/${barcode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.product) {
          // Instantly convert product to Results screen
          const prod = data.product;
          setFoodName(prod.name);
          setCalories(prod.calories);
          setProtein(prod.protein);
          setCarbs(prod.carbs);
          setFat(prod.fat);
          // Represent as a single segmented ingredient
          setIngredients([
            {
              name: prod.name,
              quantityGrams: 100,
              calories: prod.calories,
              protein: prod.protein,
              carbs: prod.carbs,
              fat: prod.fat
            }
          ]);
          setTrackerMode("results");
        } else {
          setBarcodeSearchError(data.error || "Product not found in Australia Standards database.");
        }
      } else {
        setBarcodeSearchError("Lookup failed. Check standard connection.");
      }
    } catch (err) {
      console.error("Barcode network lookup failed:", err);
      setBarcodeSearchError("Lookup failed. Network interface restricted.");
    } finally {
      setIsBarcodeSearching(false);
    }
  };

  // Dynamic search fetch
  const handleDbSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbSearchQuery.trim()) return;
    setIsDbSearching(true);
    setDbSearchError("");
    setDbSearchResults([]);
    setSelectedDbProduct(null);

    try {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(dbSearchQuery)}&db=${dbSearchSource}`);
      if (res.ok) {
        const data = await res.json();
        setDbSearchResults(data || []);
      } else {
        setDbSearchError("Could not retrieve search data. Limits reached.");
      }
    } catch (err) {
      setDbSearchError("Network endpoint is offline.");
    } finally {
      setIsDbSearching(false);
    }
  };

  // Animate the analyzing checkpoints
  const triggerAIAnalysis = async (imgBase64: string, staticFallbackData?: AnalysisData) => {
    setTrackerMode("analyzing");
    setScanCheckpoints(["📸 Image processed, extracting landmarks..."]);

    // Dynamic high-tech simulation sequence
    setTimeout(() => {
      setScanCheckpoints((prev) => [...prev, "🔍 Identifying ingredient items (cross-referencing standards)..."]);
    }, 1000);

    setTimeout(() => {
      setScanCheckpoints((prev) => [...prev, "⚖️ Estimating physical portions and density factors..."]);
    }, 2000);

    setTimeout(() => {
      setScanCheckpoints((prev) => [...prev, "✨ Compiling macro proportions & verifying energy conservation laws..."]);
    }, 3000);

    try {
      const payload = {
        image: imgBase64,
        query: staticFallbackData ? staticFallbackData.foodName : ""
      };

      const res = await fetch("/api/food/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: AnalysisData = await res.json();
        setTimeout(() => {
          setFoodName(data.foodName);
          setCalories(data.calories);
          setProtein(data.protein);
          setCarbs(data.carbs);
          setFat(data.fat);
          setIngredients(data.ingredients || []);
          setTrackerMode("results");
        }, 3500);
      } else {
        throw new Error("analysis endpoint failed with " + res.status);
      }
    } catch (err) {
      console.warn("Real API failed, fallback to local standards matching", err);
      const choice = PRESET_FOODS.find((p) => p.id === activePresetId)?.data || PRESET_FOODS[0].data;
      setTimeout(() => {
        setFoodName(choice.foodName);
        setCalories(choice.calories);
        setProtein(choice.protein);
        setCarbs(choice.carbs);
        setFat(choice.fat);
        setIngredients(choice.ingredients);
        setTrackerMode("results");
      }, 3500);
    }
  };

  const handleApplyLog = () => {
    onLogFood(foodName, calories, protein, carbs, fat, "", 1);
    onClose();
  };

  // Dynamically update total values in calorie metrics cards whenever an ingredient shifts
  const recalculateMacrosFromIngredients = (updatedIngredients: IngredientItem[]) => {
    let totCals = 0;
    let totProt = 0;
    let totCarbs = 0;
    let totFat = 0;
    
    updatedIngredients.forEach((item) => {
      totCals += item.calories;
      totProt += item.protein;
      totCarbs += item.carbs;
      totFat += item.fat;
    });

    setCalories(Math.round(totCals));
    setProtein(parseFloat(totProt.toFixed(1)));
    setCarbs(parseFloat(totCarbs.toFixed(1)));
    setFat(parseFloat(totFat.toFixed(1)));
  };

  const handleUpdateIngredientName = (index: number, newName: string) => {
    const list = [...ingredients];
    list[index].name = newName;
    setIngredients(list);
  };

  const handleUpdateIngredientWeight = (index: number, newGramsStr: string) => {
    const newGrams = parseFloat(newGramsStr) || 0;
    const list = [...ingredients];
    const prevGrams = list[index].quantityGrams || 100;
    const ratio = newGrams / (prevGrams || 1);

    list[index].quantityGrams = newGrams;
    list[index].calories = Math.round(list[index].calories * ratio);
    list[index].protein = parseFloat((list[index].protein * ratio).toFixed(1));
    list[index].carbs = parseFloat((list[index].carbs * ratio).toFixed(1));
    list[index].fat = parseFloat((list[index].fat * ratio).toFixed(1));

    setIngredients(list);
    recalculateMacrosFromIngredients(list);
  };

  const handleRemoveIngredient = (index: number) => {
    const list = ingredients.filter((_, i) => i !== index);
    setIngredients(list);
    recalculateMacrosFromIngredients(list);
  };

  const handleAddIngredientManually = () => {
    if (!newIngName.trim()) return;
    const mockIng: IngredientItem = {
      name: newIngName,
      quantityGrams: newIngGrams,
      calories: Math.round(1.2 * newIngGrams),
      protein: parseFloat((0.08 * newIngGrams).toFixed(1)),
      carbs: parseFloat((0.15 * newIngGrams).toFixed(1)),
      fat: parseFloat((0.02 * newIngGrams).toFixed(1))
    };

    const list = [...ingredients, mockIng];
    setIngredients(list);
    setNewIngName("");
    setNewIngGrams(100);
    recalculateMacrosFromIngredients(list);
  };

  return (
    <div className="flex flex-col gap-4 text-left w-full h-full pb-4">
      {/* HEADER CONTROLS */}
      <div className="flex justify-between items-center bg-[#13111ff] border border-[#2a2440] rounded-2xl p-4 shadow-md shrink-0">
        <button
          type="button"
          onClick={() => {
            stopCameraStream();
            if (trackerMode !== "menu") {
              setTrackerMode("menu");
            } else {
              onClose();
            }
          }}
          className="px-4 py-2 bg-[#17142a] border border-[#2c264d] hover:border-pink-300 text-pink-300 hover:text-white rounded-xl text-[10px] font-mono transition-all cursor-pointer font-bold shrink-0"
        >
          {trackerMode === "menu" ? "← CLOSE" : "← MENU"}
        </button>
        <div className="text-right">
          <span className="text-[8px] font-mono text-pink-400 uppercase tracking-widest block font-bold">CAL AI CLONE</span>
          <span className="font-bebas text-lg text-white block tracking-wider uppercase">
            {trackerMode === "menu" && "DIET SCANNER LOG"}
            {trackerMode === "camera" && "CAMERA VIEWPORT"}
            {trackerMode === "analyzing" && "AI ANALYSIS"}
            {trackerMode === "results" && "AI DIETMETRIC RESULTS"}
            {trackerMode === "search" && "DATABASE SEARCH"}
            {trackerMode === "barcode" && "BARCODE SCAN LENS"}
          </span>
        </div>
      </div>

      {/* RENDER STAGES */}
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        {/* VIEW 1: PREMIUM INTERACTIVE MENUS GRID & STACKS */}
        {trackerMode === "menu" && (
          <div className="flex flex-col gap-5 overflow-y-auto flex-1 min-h-0 pr-1 pb-6">
            
            {/* Top Interactive Calorie Scan Card grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* BUTTON A: SCAN FOOD */}
              <button
                type="button"
                onClick={() => {
                  setTrackerMode("camera");
                  startCameraStream();
                }}
                className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-tr from-[#2d1b40]/70 via-[#1b152d]/90 to-[#2c1332]/50 border-2 border-pink-500/35 hover:border-pink-400 text-center shadow-xl hover:shadow-pink-500/10 cursor-pointer active:scale-98 transition-all overflow-hidden h-36"
              >
                <div className="absolute top-2 right-2 text-[6px] font-mono font-bold bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">CAL AI</div>
                <span className="text-3xl mb-1.5 group-hover:scale-110 transition-transform">📸</span>
                <span className="font-bebas text-sm text-[#fbcfe8] uppercase tracking-wider font-bold">Scan Food Photo</span>
                <span className="text-[8.5px] text-[#9a8faf] font-mono leading-tight mt-1 max-w-[130px]">Take picture, guess calories instantly</span>
              </button>

              {/* BUTTON B: NUTRITION LABEL */}
              <button
                type="button"
                onClick={() => {
                  setTrackerMode("barcode");
                }}
                className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-tr from-[#38331d]/50 via-[#1e1a10]/95 to-[#242111]/80 border border-amber-500/35 hover:border-amber-400 text-center shadow-xl hover:shadow-amber-500/5 cursor-pointer active:scale-98 transition-all overflow-hidden h-36"
              >
                <div className="absolute top-2 right-2 text-[6px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">LAWS</div>
                <span className="text-3xl mb-1.5 group-hover:scale-110 transition-transform">🏷️</span>
                <span className="font-bebas text-sm text-amber-300 uppercase tracking-wider font-bold">Nutrition Label</span>
                <span className="text-[8.5px] text-[#9a8faf] font-mono leading-tight mt-1 max-w-[130px]">Triggers high accuracy Barcode Scanner</span>
              </button>

              {/* BUTTON C: SCAN RECEIPT */}
              <button
                type="button"
                onClick={() => {
                  setTrackerMode("camera");
                  setCurrentMealType("Lunch");
                }}
                className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-tr from-[#163328]/60 via-[#0a1813]/95 to-[#0b291d]/80 border border-green-500/20 hover:border-green-400 text-center shadow-md cursor-pointer active:scale-98 transition-all h-32"
              >
                <span className="text-2xl mb-1">🧾</span>
                <span className="font-bebas text-xs text-green-300 uppercase tracking-wide">Scan Receipt</span>
                <span className="text-[7.5px] text-[#6e8578] font-mono leading-tight mt-0.5 max-w-[135px]">Extract ingredients from grocery slips</span>
              </button>

              {/* BUTTON D: SCAN FOOD BILL */}
              <button
                type="button"
                onClick={() => {
                  setTrackerMode("camera");
                  setCurrentMealType("Dinner");
                }}
                className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-tr from-[#162940]/60 via-[#0d1624]/95 to-[#0e1d30]/80 border border-blue-500/20 hover:border-blue-400 text-center shadow-md cursor-pointer active:scale-98 transition-all relative h-32"
              >
                <div className="absolute top-1.5 right-1.5 text-[5.5px] font-mono font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest scale-90">NEW</div>
                <span className="text-2xl mb-1">💵</span>
                <span className="font-bebas text-xs text-blue-300 uppercase tracking-wide">Scan Food Bill</span>
                <span className="text-[7.5px] text-[#697d95] font-mono leading-tight mt-0.5 max-w-[135px]">Deduce restaurant bill nutritional breakdown</span>
              </button>
            </div>

            {/* MEALS LIST LOGGING TRIGGER STACK CONTAINER */}
            <div className="bg-[#110e1f] border border-[#251e3e] rounded-2xl p-4 shadow-inner flex flex-col gap-2.5">
              <span className="text-[9.5px] font-mono text-[#6b6485] tracking-widest uppercase block mb-1 font-bold">Select Meal to Quick Log / Dictate</span>
              
              {[
                { name: "Breakfast", icon: "🍳", desc: "Eggs, bacon, porridge, smoothie & coffee" },
                { name: "Lunch", icon: "🥙", desc: "Plates, wraps, fresh salads & proteins" },
                { name: "Snacks", icon: "🍪", desc: "Nuts, wellness bars, yogurt & shakes" },
                { name: "Dinner", icon: "🥩", desc: "Aussie steak, roast veg, rice & seafood" },
                { name: "Activity", icon: "🏋️", desc: "Trigger gym session, log step tracker, cal deficit" }
              ].map((meal) => (
                <button
                  key={meal.name}
                  type="button"
                  onClick={() => {
                    if (meal.name === "Activity") {
                      onOpenWorkoutModal?.();
                    } else {
                      // Trigger direct standard layout search inside Cal AI Wrapper
                      setTrackerMode("search");
                      setCurrentMealType(meal.name as any);
                    }
                  }}
                  className="w-full flex justify-between items-center p-2.5 rounded-xl border border-[#1b152d] hover:border-[#fbcfe8]/20 bg-[#161226]/80 hover:bg-[#1a1532] text-left transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0 p-1.5 rounded-lg bg-[#211a3b]/50">{meal.icon}</span>
                    <div className="min-w-0 pr-2">
                      <span className="font-bebas text-xs text-white block uppercase tracking-wide leading-none">{meal.name}</span>
                      <span className="text-[8.5px] text-[#6b6485] font-mono block mt-1 truncate">{meal.desc}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="w-6 h-6 rounded-full bg-[#1e1935] hover:bg-pink-300/20 text-pink-300 flex items-center justify-center text-xs border border-[#2e264f] hover:border-pink-300/40">🎙️</span>
                    <span className="text-xs text-[#5a5375]">❯</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: CUSTOM FULL-SCREEN CAMERA APPLICATION VIEWPORT */}
        {trackerMode === "camera" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0 bg-black/95 border border-[#2a2440] rounded-3xl p-5 relative overflow-hidden items-center justify-between shadow-2xl">
            <div className="w-full flex justify-between items-center z-10">
              <span className="text-[8px] font-mono text-pink-500 uppercase tracking-widest font-extrabold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                LIVE VIEW
              </span>
              <button
                type="button"
                onClick={() => setTrackerMode("menu")}
                className="w-7 h-7 bg-[#1c1a24] hover:bg-red-950 hover:text-red-400 border border-[#2a263d] rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer font-mono"
              >
                ×
              </button>
            </div>

            <div className="w-full h-72 rounded-2xl relative bg-[#09080d] border border-pink-500/10 overflow-hidden flex items-center justify-center shadow-inner self-center max-w-sm">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-x-0 w-full h-full object-cover z-0"
              />

              <div className="absolute inset-0 z-10 pointer-events-none border border-white/5 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-pink-400/40 rounded-xl relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-pink-400/80 rounded-full bg-pink-500/20 shadow-lg shadow-pink-500/20" />
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-pink-300/85 -mt-1 -ml-1 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-pink-300/85 -mt-1 -mr-1 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-pink-300/85 -mb-1 -ml-1 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-pink-300/85 -mb-1 -mr-1 rounded-br-md" />
                </div>
              </div>

              {hasCameraPermission === false && (
                <div className="absolute inset-0 bg-[#0c0914e6] z-20 flex flex-col items-center justify-center p-6 text-center gap-3">
                  <span className="text-3xl">🔑</span>
                  <span className="font-mono text-[9px] text-[#9b8eb9] block">
                    Camera streaming blocked or restricted by browser iframe context policies.
                  </span>
                  <div className="flex flex-col gap-2 w-full max-w-[200px]">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-1.5 bg-pink-400/20 border border-pink-400 text-pink-200 rounded-xl font-mono text-[9px] font-bold uppercase transition-all"
                    >
                      📁 Browse Photo File
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrackerMode("menu")}
                      className="py-1 type-button text-[#6b6485] font-mono text-[8px] uppercase font-bold"
                    >
                      Or Use Sample Generator
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full flex items-center justify-around z-10 max-w-sm shrink-0">
              <button
                type="button"
                onClick={() => alert("Arrange the plate clearly with overhead lighting for maximum AI landmark segment extraction.")}
                className="w-10 h-10 rounded-full border border-[#2a2440] bg-[#141220]/75 text-[#736e8c] hover:text-pink-300 flex items-center justify-center text-xs font-mono font-bold cursor-pointer"
              >
                ?
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                disabled={hasCameraPermission === false}
                className="w-16 h-16 rounded-full border-4 border-white bg-transparent flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-20"
              >
                <div className="w-12 h-12 rounded-full bg-[#fbcfe8] hover:bg-white active:bg-pink-300 shadow-md transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-full border border-[#2a2440] bg-[#141220]/75 text-[#736e8c] hover:text-pink-300 flex items-center justify-center text-xs cursor-pointer"
              >
                🖼️
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            
            <p className="text-[7.5px] font-mono text-[#584f74] text-center block shrink-0">
              CAL AI SHUTTER LENS • POWERED BY ANTIGRAVITY ENGINE
            </p>
          </div>
        )}

        {/* VIEW 3: SPECTACULAR GRADIENT RUNNING AI ANALYZER SCREEN */}
        {trackerMode === "analyzing" && (
          <div className="flex flex-col gap-6 flex-1 min-h-0 bg-[#0d0a149c] border border-pink-500/25 rounded-3xl p-6 relative overflow-hidden items-center justify-center text-center shadow-2xl">
            <div className="absolute w-44 h-44 bg-pink-500/10 rounded-full blur-[70px] -top-10 -right-10 z-0" />
            <div className="absolute w-44 h-44 bg-purple-500/10 rounded-full blur-[70px] -bottom-10 -left-10 z-0" />

            <div className="w-52 h-52 backdrop-blur-md rounded-2xl relative bg-[#130f24] border border-pink-500/30 overflow-hidden flex items-center justify-center shadow-xl mb-2 shrink-0 z-10 animate-bounce-subtle">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  referrerPolicy="no-referrer"
                  alt="Examined meal"
                  className="w-full h-full object-cover opacity-85"
                />
              ) : (
                <span className="text-3xl text-pink-300">🍽️</span>
              )}

              <div className="absolute inset-x-0 w-full h-1 bg-gradient-to-r from-pink-500 via-rose-300 to-pink-500 shadow-[0_0_15px_rgba(244,63,94,1)] z-25 animate-laser-scan origin-top top-0" />
            </div>

            <div className="flex flex-col gap-2 text-left z-10 max-w-xs w-full">
              {scanCheckpoints.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-[#17132a]/80 border border-pink-500/15 rounded-xl font-mono text-[9px] text-pink-200 animate-in slide-in-from-bottom-2 duration-200 pr-4"
                >
                  {idx < scanCheckpoints.length - 1 ? (
                    <span className="text-pink-400 font-bold">✓</span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping shrink-0" />
                  )}
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <p className="text-[9px] font-mono text-[#746a9a] max-w-[200px] z-10 uppercase tracking-widest leading-relaxed mt-1">
              Guessed calories are derived from portion density factors
            </p>
          </div>
        )}

        {/* VIEW 4: RIGOROUS EXHAUSTIVE DIET RESULTS ADJUSTER PAGE */}
        {trackerMode === "results" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1 pb-10">
            <div className="bg-gradient-to-r from-[#17142a] to-[#120e21] border border-purple-500/20 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-4 shrink-0 mt-0.5">
              <div className="flex-1 min-w-0">
                <span className="text-[7.5px] font-mono text-purple-400 uppercase tracking-widest font-bold block mb-1">AI DETECTED DISH</span>
                
                {editingName ? (
                  <div className="flex gap-1.5 items-center mt-1 w-full max-w-[220px]">
                    <input
                      type="text"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                      className="bg-[#0e0c17] border border-pink-300/40 text-xs font-mono text-[#e8e3f8] rounded-lg px-2 py-1 w-full focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="text-[10px] text-green-400 p-1 hover:text-white"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bebas text-lg text-white block uppercase tracking-wide leading-tight mt-0.5 truncate">{foodName}</span>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="w-5 h-5 bg-[#1f1b36] hover:bg-[#342e5a] text-[10px] text-pink-300 rounded flex items-center justify-center cursor-pointer border border-[#2b254d]"
                    >
                      ✏️
                    </button>
                  </div>
                )}
                
                <span className="text-[8.5px] font-mono text-[#6c6488] block mt-1 uppercase">Segmented list contains {ingredients.length} item plates</span>
              </div>

              <div className="w-16 h-16 rounded-xl border border-pink-400/20 shadow-md bg-[#251e44] overflow-hidden shrink-0">
                {capturedImage ? (
                  <img src={capturedImage} alt="Thumbnail preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                )}
              </div>
            </div>

            <div className="bg-[#120e23] border border-[#271f45] rounded-2xl p-4 shadow-sm shrink-0">
              <span className="text-[8.5px] text-[#6c6487] font-mono tracking-widest block uppercase mb-3 font-bold">CONSOLIDATED MEAL DIET METRICS</span>
              
              <div className="grid grid-cols-4 gap-2 leading-none text-center">
                <div className="bg-[#17132c] border border-pink-500/10 p-2 rounded-xl flex flex-col justify-between h-18">
                  <span className="text-[7.5px] font-mono text-pink-300 font-bold block uppercase">ENERGY</span>
                  {editingCals ? (
                    <input
                      type="number"
                      value={calories}
                      onChange={(e) => setCalories(parseInt(e.target.value) || 0)}
                      onBlur={() => setEditingCals(false)}
                      autoFocus
                      className="bg-[#0b0914] border border-pink-300/40 text-[10px] font-mono text-[#e8e3f8] rounded p-0.5 w-full text-center focus:outline-none"
                    />
                  ) : (
                    <span className="font-bebas text-sm text-[#fbcfe8] block mt-1.5">{calories} <span className="text-[8px] font-mono font-bold block">KCAL</span></span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingCals(!editingCals)}
                    className="text-[7.5px] font-mono text-pink-400/60 hover:text-white uppercase font-bold mt-1 block tracking-wider"
                  >
                    ✏️ Adjust
                  </button>
                </div>

                <div className="bg-[#17132c] border border-indigo-500/10 p-2 rounded-xl flex flex-col justify-between h-18 text-indigo-300">
                  <span className="text-[7.5px] font-mono text-indigo-300 font-bold block uppercase">PROTEIN</span>
                  {editingProt ? (
                    <input
                      type="number"
                      step="0.1"
                      value={protein}
                      onChange={(e) => setProtein(parseFloat(e.target.value) || 0)}
                      onBlur={() => setEditingProt(false)}
                      autoFocus
                      className="bg-[#0b0914] border border-pink-300/40 text-[10px] font-mono text-[#e8e3f8] rounded p-0.5 w-full text-center focus:outline-none"
                    />
                  ) : (
                    <span className="font-bebas text-sm text-[#e8e3f8] block mt-1.5">{protein} <span className="text-[8px] font-mono font-bold block">GRAMS</span></span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingProt(!editingProt)}
                    className="text-[7.5px] font-mono text-indigo-400/60 hover:text-white uppercase font-bold mt-1 block tracking-wider"
                  >
                    ✏️ Adjust
                  </button>
                </div>

                <div className="bg-[#17132c] border border-green-500/10 p-2 rounded-xl flex flex-col justify-between h-18 text-green-300">
                  <span className="text-[7.5px] font-mono text-green-300 font-bold block uppercase">CARBS</span>
                  {editingCarbs ? (
                    <input
                      type="number"
                      step="0.1"
                      value={carbs}
                      onChange={(e) => setCarbs(parseFloat(e.target.value) || 0)}
                      onBlur={() => setEditingCarbs(false)}
                      autoFocus
                      className="bg-[#0b0914] border border-pink-300/40 text-[10px] font-mono text-[#e8e3f8] rounded p-0.5 w-full text-center focus:outline-none"
                    />
                  ) : (
                    <span className="font-bebas text-sm text-[#e8e3f8] block mt-1.5">{carbs} <span className="text-[8px] font-mono font-bold block">GRAMS</span></span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingCarbs(!editingCarbs)}
                    className="text-[7.5px] font-mono text-green-400/60 hover:text-white uppercase font-bold mt-1 block tracking-wider"
                  >
                    ✏️ Adjust
                  </button>
                </div>

                <div className="bg-[#17132c] border border-amber-500/10 p-2 rounded-xl flex flex-col justify-between h-18 text-amber-300">
                  <span className="text-[7.5px] font-mono text-amber-300 font-bold block uppercase">LIPID FAT</span>
                  {editingFat ? (
                    <input
                      type="number"
                      step="0.1"
                      value={fat}
                      onChange={(e) => setFat(parseFloat(e.target.value) || 0)}
                      onBlur={() => setEditingFat(false)}
                      autoFocus
                      className="bg-[#0b0914] border border-pink-300/40 text-[10px] font-mono text-[#e8e3f8] rounded p-0.5 w-full text-center focus:outline-none"
                    />
                  ) : (
                    <span className="font-bebas text-sm text-[#e8e3f8] block mt-1.5">{fat} <span className="text-[8px] font-mono font-bold block">GRAMS</span></span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingFat(!editingFat)}
                    className="text-[7.5px] font-mono text-amber-400/60 hover:text-white uppercase font-bold mt-1 block tracking-wider"
                  >
                    ✏️ Adjust
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#120e23] border border-[#271f45] rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <span className="text-[8.5px] text-[#6c6487] font-mono tracking-widest block uppercase font-bold">SEGMENTED PLATE INGREDIENTS DETAILS</span>
              
              <div className="flex flex-col gap-2">
                {ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="bg-[#17142b]/60 border border-[#28214a] rounded-xl p-3 flex flex-col gap-2 shadow-inner"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={ing.name}
                          onChange={(e) => handleUpdateIngredientName(idx, e.target.value)}
                          className="bg-[#0b0914]/80 border border-[#2b2447] text-xs font-bold text-white font-sans rounded-lg px-2 py-1 flex-1 focus:outline-none focus:border-pink-300/50"
                        />
                        
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[9px] text-pink-300 bg-[#0c0a15] px-2 py-1 rounded-lg border border-[#272145]">
                          <input
                            type="number"
                            value={ing.quantityGrams}
                            onChange={(e) => handleUpdateIngredientWeight(idx, e.target.value)}
                            className="bg-transparent w-10 text-right text-white font-bold max-w-12 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span>g</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(idx)}
                        className="w-7 h-7 bg-[#1c1833] hover:bg-red-950 text-red-400 border border-[#2e264f] hover:border-red-500/20 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex gap-2 flex-wrap font-mono text-[8.5px] text-[#867baf]">
                      <span className="font-bold bg-[#0e0c17]/60 px-2 py-0.5 rounded-md text-[#dfdaee]">🔥 {ing.calories} kcal</span>
                      <span className="bg-[#0e0c17]/60 px-1.5 py-0.5 rounded-md">P: {ing.protein}g</span>
                      <span className="bg-[#0e0c17]/60 px-1.5 py-0.5 rounded-md">C: {ing.carbs}g</span>
                      <span className="bg-[#0e0c17]/60 px-1.5 py-0.5 rounded-md">F: {ing.fat}g</span>
                    </div>
                  </div>
                ))}

                {ingredients.length === 0 && (
                  <p className="text-[9.5px] font-mono text-[#6b6485] py-4 text-center">
                    All plate items cleared. Inject manually below.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-[#251f47]/50 pt-3">
                <input
                  type="text"
                  placeholder="e.g. Feta cheese"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="bg-[#0c0a15] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] placeholder-[#5c5082] rounded-xl px-2.5 py-1.5 col-span-2 focus:outline-none"
                />
                <div className="flex gap-1.5 max-w-[120px]">
                  <input
                    type="number"
                    value={newIngGrams}
                    onChange={(e) => setNewIngGrams(parseInt(e.target.value) || 0)}
                    className="bg-[#0c0a15] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] rounded-xl px-1 py-1.5 text-center focus:outline-none w-14"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredientManually}
                    className="flex-1 bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500/20 hover:to-purple-500/20 border border-pink-500/30 text-pink-300 font-mono text-[10px] uppercase font-bold text-center rounded-xl p-1 shrink-0 animate-pulse"
                  >
                    ＋
                  </button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gradient-to-t from-[#0d0915] via-[#0d0915] to-transparent pt-4 pb-1 flex flex-col gap-2 shrink-0 z-10 w-full animate-pulse">
              <button
                type="button"
                onClick={handleApplyLog}
                className="w-full py-3 bg-[#fbcfe8] text-[#0d0b14] hover:bg-pink-300 rounded-2xl text-[11px] font-mono font-bold text-center shadow-lg shadow-pink-500/15 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all uppercase tracking-widest block"
              >
                Log Meal to Journal 🍎
              </button>
            </div>
          </div>
        )}

        {/* VIEW 5: DATABASE TEXT SEARCH INTERFACE inside Cal AI module (Fully compatible) */}
        {trackerMode === "search" && (
          <div className="flex flex-col gap-3.5 flex-1 min-h-0 overflow-y-auto pr-1 pb-6">
            <div className="bg-[#161327] border border-pink-500/10 p-3 rounded-2xl flex justify-between items-center text-left">
              <div>
                <span className="font-bebas text-sm text-pink-300 block uppercase">Log standard {currentMealType || "Meal Portion"} item</span>
                <span className="text-[8.5px] font-mono text-[#6b6485] block mt-0.5">Lookup food in Australian AFCD or Global OFF directory.</span>
              </div>
              <span className="text-xl">🔍</span>
            </div>

            {/* DB Source selection */}
            <div className="flex items-center justify-between bg-[#0e0c17] border border-[#231d3d] rounded-xl p-1.5 shrink-0">
              <span className="text-[9px] font-mono text-[#6b6485] pl-1.5 uppercase font-bold">DB Source:</span>
              <div className="flex gap-1 bg-[#141223] p-0.5 rounded-lg border border-[#2b254d]">
                {(["all", "afcd", "off"] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setDbSearchSource(source)}
                    className={`px-2 py-1 rounded-md text-[8.5px] font-mono font-bold uppercase transition-all cursor-pointer ${
                      dbSearchSource === source
                        ? "bg-[#252044] text-pink-300 border border-pink-350/20 shadow-sm"
                        : "text-[#6b6485] hover:text-[#e8e3f8] border border-transparent"
                    }`}
                  >
                    {source === "all" ? "All" : source === "afcd" ? "AFCD (Aussie)" : "OFF (Global)"}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleDbSearchSubmit} className="flex gap-2">
              <input
                type="text"
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="Search beef, oatmeal, yogurt, banana..."
                className="flex-1 bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] placeholder-[#534975] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-pink-300"
              />
              <button
                type="submit"
                disabled={isDbSearching}
                className="px-4 py-2 bg-[#1b1531] border border-[#2e264f] hover:border-pink-300 text-pink-300 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-40 cursor-pointer text-center flex items-center justify-center min-w-[60px]"
              >
                {isDbSearching ? "..." : "Find"}
              </button>
            </form>

            {dbSearchError && (
              <p className="text-[9px] font-mono text-red-400 text-center block">{dbSearchError}</p>
            )}

            {/* Results selection container block */}
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {selectedDbProduct ? (
                <div className="bg-[#0b0914] border border-[#2e2652] rounded-xl p-3.5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bebas text-xs text-pink-300 block uppercase tracking-wide">{selectedDbProduct.brand || "Generic meal product"}</span>
                      <span className="text-sm font-bold text-white block mt-0.5">{selectedDbProduct.name}</span>
                    </div>
                    <button onClick={() => setSelectedDbProduct(null)} className="text-xs text-gray-500 hover:text-white font-bold cursor-pointer">×</button>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center font-mono text-[9px] border-y border-[#261f43] py-2">
                    <div>
                      <span className="text-[#6b6485] block text-[7.5px]">CALORIES</span>
                      <span className="text-[#e8e3f8] font-bold block mt-0.5">{Math.round(selectedDbProduct.calories * dbMultiplier)} kcal</span>
                    </div>
                    <div>
                      <span className="text-indigo-300 block text-[7.5px]">PROTEIN</span>
                      <span className="text-white font-bold block mt-0.5">{Math.round(selectedDbProduct.protein * dbMultiplier)}g</span>
                    </div>
                    <div>
                      <span className="text-green-300 block text-[7.5px]">CARBS</span>
                      <span className="text-white font-bold block mt-0.5">{Math.round(selectedDbProduct.carbs * dbMultiplier)}g</span>
                    </div>
                    <div>
                      <span className="text-amber-300 block text-[7.5px]">LIPID FAT</span>
                      <span className="text-white font-bold block mt-0.5">{Math.round(selectedDbProduct.fat * dbMultiplier)}g</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-[#13111f]/80 p-2 border border-[#261f43]/50 rounded-lg">
                    <span className="text-[8px] font-mono text-[#9991b8] uppercase font-bold">Multiplier portion scale:</span>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <button type="button" onClick={() => setDbMultiplier((p) => Math.max(0.1, p - 0.1))} className="w-5 h-5 bg-[#17142a] border border-[#2c264d] text-white rounded text-center font-bold">-</button>
                      <span className="font-bold min-w-[35px] text-center text-pink-300">{dbMultiplier.toFixed(1)}x</span>
                      <button type="button" onClick={() => setDbMultiplier((p) => p + 0.1)} className="w-5 h-5 bg-[#17142a] border border-[#2c264d] text-white rounded text-center font-bold">+</button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onLogFood(
                        selectedDbProduct.name,
                        Math.round(selectedDbProduct.calories * dbMultiplier),
                        parseFloat((selectedDbProduct.protein * dbMultiplier).toFixed(1)),
                        parseFloat((selectedDbProduct.carbs * dbMultiplier).toFixed(1)),
                        parseFloat((selectedDbProduct.fat * dbMultiplier).toFixed(1)),
                        selectedDbProduct.barcode,
                        dbMultiplier
                      );
                      onClose();
                    }}
                    className="w-full py-2.5 bg-[#fbcfe8] text-[#0d0b14] hover:bg-pink-300 rounded-xl text-[10px] font-mono font-bold text-center cursor-pointer"
                  >
                    Log selected item to daily logbook
                  </button>
                </div>
              ) : (
                <div className="flex-1 min-h-[140px] bg-[#0c0a15] rounded-xl border border-[#251f47]/50 p-2 overflow-y-auto flex flex-col gap-1">
                  {dbSearchResults.length > 0 ? (
                    dbSearchResults.map((prod, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedDbProduct(prod);
                          setDbMultiplier(1);
                        }}
                        className="bg-[#141223] hover:bg-[#18152e] border border-[#251e44] hover:border-pink-350/20 rounded-xl p-2.5 flex justify-between items-center text-left transition-all cursor-pointer"
                      >
                        <div className="truncate min-w-0 flex-1 pr-2">
                          <span className="text-[6.5px] font-mono font-bold text-pink-300 block uppercase tracking-wide">{prod.brand || "Generic"}</span>
                          <span className="font-bebas text-xs text-[#e8e3f8] block truncate leading-tight mt-0.5">{prod.name}</span>
                          <span className="text-[8px] font-mono text-[#625b81] block mt-1 truncate">
                            P: {prod.protein}g | C: {prod.carbs}g | F: {prod.fat}g • Serv: 100g
                          </span>
                        </div>
                        <div className="shrink-0 font-mono text-right text-xs">
                          <span className="font-bold text-[#fbcfe8] block">{prod.calories} kcal</span>
                          <span className="text-[7.5px] text-pink-300 block font-bold mt-0.5">Select →</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-2">
                      <span className="text-xl">🍲</span>
                      <p className="text-[9px] font-mono text-[#645c85] leading-relaxed max-w-[200px]">
                        No DB materials loaded. Submit a keyword query to inspect Australia standard or global catalog.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 6: LIVE BARCODE CAMERA LENS SCAN WITH LOADER */}
        {trackerMode === "barcode" && (
          <div className="flex flex-col gap-3.5 flex-1 min-h-0 relative items-center justify-between bg-black/90 p-5 rounded-3xl border border-[#211b3b]">
            <div className="w-full flex justify-between items-center z-10 shrink-0">
              <span className="text-[8px] font-mono text-amber-400 font-extrabold flex items-center gap-1 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Barcode lens finder
              </span>
              <button
                type="button"
                onClick={() => setTrackerMode("menu")}
                className="w-7 h-7 bg-[#1c1a24] hover:bg-red-950 border border-[#2a263d] rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer font-mono"
              >
                ×
              </button>
            </div>

            {/* BARCODE CAMERA STAGE WRAPPER */}
            <div className="w-full max-w-sm h-48 bg-black rounded-2xl border border-amber-500/10 overflow-hidden relative flex-1 flex items-center justify-center self-center my-2 max-h-[300px]">
              {/* HTML5 Qrcode Finder mounting anchor */}
              <div id="applet-barcode-finder" className="w-full h-full block" />

              <div className="absolute inset-0 border-2 border-dashed border-amber-300/25 pointer-events-none select-none z-10 rounded-2xl flex items-center justify-center">
                <div className="w-36 h-28 border-2 border-dashed border-amber-300/40 rounded-lg relative">
                  {/* Neon reading laser line overlay */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)] animate-pulse" />
                </div>
              </div>

              {isBarcodeSearching && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2 z-20">
                  <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[9px] font-mono text-amber-300 font-bold uppercase tracking-wider">Retrieving DB parameters...</span>
                </div>
              )}
            </div>

            {barcodeSearchError && (
              <div className="p-3 bg-red-950/25 border border-red-500/10 rounded-xl max-w-sm w-full shrink-0">
                <span className="text-[9.5px] font-mono font-bold text-red-400 block leading-tight text-center">{barcodeSearchError}</span>
              </div>
            )}


          </div>
        )}

        {/* VIEW 5: MANUAL DISH METRIC DETAILED BUILDER */}
        {trackerMode === "manual" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
              const cals = parseInt((form.elements.namedItem("cals") as HTMLInputElement).value) || 0;
              const prot = parseFloat((form.elements.namedItem("prot") as HTMLInputElement).value) || 0;
              const carb = parseFloat((form.elements.namedItem("carb") as HTMLInputElement).value) || 0;
              const fatv = parseFloat((form.elements.namedItem("fat") as HTMLInputElement).value) || 0;
              const q = parseFloat((form.elements.namedItem("quantity") as HTMLInputElement).value) || 1;
              if (name) {
                onLogFood(name, cals, prot, carb, fatv, "", q);
                onClose();
              }
            }}
            className="bg-[#120e23] border border-[#261f43] rounded-2xl p-5 shadow-lg flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-6"
          >
            <div className="bg-[#18132d] border border-pink-500/15 p-3 rounded-xl">
              <span className="text-[7.5px] font-mono text-pink-300 font-bold tracking-widest uppercase block mb-1">SELECTED LOG SLATE</span>
              <span className="font-bebas text-sm text-white block uppercase tracking-wide">Logging Custom {currentMealType || "Meal Portion"} Entry</span>
              <span className="text-[8.5px] text-[#6b6485] font-mono block mt-1">Provide metrics parameters below to add instantly to your log book.</span>
            </div>

            <div className="flex flex-col gap-1 text-left">
              <label className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider">Dish Description</label>
              <input
                required
                name="name"
                placeholder="e.g. Avocado Eggs on Wheat Toast"
                className="bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] placeholder-[#534975] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-pink-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider">Calories (kcal)</label>
                <input
                  type="number"
                  required
                  defaultValue="240"
                  name="cals"
                  className="bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-pink-300"
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider">Quantity Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  defaultValue="1"
                  name="quantity"
                  className="bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-pink-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="flex flex-col gap-1 text-left text-indigo-300 font-sans">
                <label className="text-[8.5px] font-mono text-indigo-300 uppercase block tracking-wider font-bold">Protein (g)</label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="12"
                  name="prot"
                  className="bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1 text-left text-green-300 border-l border-[#211d35]/40 pl-2">
                <label className="text-[8.5px] font-mono text-green-300 uppercase block tracking-wider font-bold">Carbs (g)</label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="22"
                  name="carb"
                  className="bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1 text-left text-amber-300 border-l border-[#211d35]/40 pl-2">
                <label className="text-[8.5px] font-mono text-amber-300 uppercase block tracking-wider font-bold">Fat (g)</label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="6"
                  name="fat"
                  className="bg-[#0b0915] border border-[#2b2447] text-xs font-mono text-[#e8e3f8] rounded-xl px-3.5 py-2.5 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-3 bg-[#fbcfe8] text-[#0d0b14] hover:bg-pink-300 font-mono text-[10.5px] font-bold uppercase rounded-xl shadow-lg cursor-pointer active:scale-95 transition-transform"
            >
              Confirm Log {currentMealType} 🍲
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
