import { useState, useEffect } from "react";
import { auth, db, provider, handleFirestoreError, OperationType } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { UserState, ActiveWorkout, Routine, Exercise, CalendarEvent, Goal, WaterConfig, FoodLogEntry } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Html5Qrcode } from "html5-qrcode";

// Import layout tabs
import HomeTab from "./components/HomeTab";
import FitnessTab from "./components/FitnessTab";
import HealthTab from "./components/HealthTab";
import CalendarTab from "./components/CalendarTab";
import AIFieldCoach from "./components/AIFieldCoach";

// Import notification utilities
import {
  getPermissionStatus,
  requestNotificationPermission,
  sendLocalNotification,
  hasBeenNotified,
  markAsNotified,
  pruneNotificationCache
} from "./utils/notifications";

const defaultState = (): UserState => ({
  todayGoals: [],
  tomorrowGoals: [],
  lastDate: new Date().toDateString(),
  routines: [],
  exerciseHistory: {},
  supplements: [],
  suppChecks: {},
  waterGoal: 2000,
  waterUnit: "glass",
  waterLog: {},
  weightLog: [],
  useLb: false,
  notificationsEnabled: true,
  completedWorkouts: [],
  taskStreak: 0,
  lastStreakCompletedDate: null,
  calorieGoal: 2000,
  proteinGoalPct: 30,
  carbGoalPct: 40,
  fatGoalPct: 30,
  foodLog: {},
  waterConfig: {
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
  }
});

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "fitness" | "health" | "calendar">("home");
  
  // Notification Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => getPermissionStatus());
  const [showSettings, setShowSettings] = useState(false);
  
  // Auth Fast Startup caching
  const [user, setUser] = useState<any>(() => {
    const cachedUser = localStorage.getItem("life_dashboard_cached_user");
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  const [authLoading, setAuthLoading] = useState(!user);

  // User details state (optimistically load from cache or defaults)
  const [userState, setUserState] = useState<UserState>(() => {
    const cachedData = localStorage.getItem("life_dashboard_user_state");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return {
          ...defaultState(),
          ...parsed
        };
      } catch (e) {
        return defaultState();
      }
    }
    return defaultState();
  });

  // Google Calendar Integration states
  const [gcalAccessToken, setGcalAccessToken] = useState<string | null>(null);
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [gsiScriptLoaded, setGsiScriptLoaded] = useState(false);
  const [authError, setAuthError] = useState<any | null>(null);

  // Addition Modal and Plus FAB Submenu states
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [activeAddModal, setActiveAddModal] = useState<"workout" | "food" | "water" | "goal" | null>(null);
  const [foodTab, setFoodTab] = useState<"search" | "manual" | "scanner">("search");
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [foodSearchResults, setFoodSearchResults] = useState<any[]>([]);
  const [isSearchingFood, setIsSearchingFood] = useState(false);
  const [selectedFoodProduct, setSelectedFoodProduct] = useState<any | null>(null);
  const [foodServingMultiplier, setFoodServingMultiplier] = useState(1);
  const [scannedProductError, setScannedProductError] = useState("");
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);

  // Active training workout (with local storage caching for persistence across reload)
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(() => {
    const cached = localStorage.getItem("life_dashboard_active_workout");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Sync activeWorkout state with local storage
  useEffect(() => {
    if (activeWorkout) {
      localStorage.setItem("life_dashboard_active_workout", JSON.stringify(activeWorkout));
    } else {
      localStorage.removeItem("life_dashboard_active_workout");
    }
  }, [activeWorkout]);

  const handleUpdateActiveWorkout = (workout: ActiveWorkout | null) => {
    setActiveWorkout(workout);
  };

  // Monitor Notification permissions dynamically
  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Request notification permissions from device
  const handleRequestNotifPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
  };

  // Immediate dispatch of a test alert
  const handleTriggerTestNotification = async () => {
    await sendLocalNotification("💡 Core Notification Service Online", {
      body: "Fantastic! Your warning notifications are fully operational. Sounds and screen banners will pop up when any supplement remains unchecked.",
      requireInteraction: true,
      tag: "test_notification_immediate"
    });
  };

  // Supplement local periodic warning / missed check engine
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    
    // Prune expired historical notify records on load
    pruneNotificationCache(today);

    const checkSupplements = () => {
      if (userState.notificationsEnabled === false) return;
      if (!userState.supplements || userState.supplements.length === 0) return;

      const now = new Date();
      const nowHour = now.getHours();
      const nowMinVal = now.getMinutes();
      const nowInMins = nowHour * 60 + nowMinVal;

      userState.supplements.forEach((s) => {
        s.times.forEach((slotKey) => {
          // Verify if already checked today
          const isDone = !!(userState.suppChecks[today]?.[`${s.id}_${slotKey}`]);
          if (isDone) return;

          // Resolve scheduled time string
          const timeStr = s.scheduledTimes?.[slotKey] || (
            slotKey === "morning" ? "08:00" :
            slotKey === "afternoon" ? "13:00" :
            slotKey === "evening" ? "18:00" :
            "21:30"
          );

          const [schedHour, schedMin] = timeStr.split(":").map(Number);
          const schedInMins = schedHour * 60 + schedMin;
          const diffMins = schedInMins - nowInMins;

          // Prevent spamming if already warned/missed today
          if (hasBeenNotified(today, s.id, slotKey)) return;

          // 1. "Due soon" warning: within [0 to 45 mins] before scheduled slot
          if (diffMins >= 0 && diffMins <= 45) {
            const dosageText = s.dosage ? `${s.dosage} of ` : "";
            sendLocalNotification(`⚡ Supplement Due: ${s.name}`, {
              body: `Your scheduled dosage (${dosageText}${s.name}) is due at ${timeStr} (${slotKey}). Tap to open & check off!`,
              tag: `warning_${s.id}_${slotKey}`,
              requireInteraction: true
            }).then((success) => {
              if (success) {
                markAsNotified(today, s.id, slotKey);
              }
            });
          }
          // 2. "Missed" warning: within [1 to 60 mins] after scheduled slot has elapsed
          else if (diffMins < 0 && diffMins >= -60) {
            sendLocalNotification(`⚠️ Missed Time: ${s.name}`, {
              body: `You missed your scheduled ${timeStr} intake of ${s.name} (${slotKey}). Tap to track & check it off!`,
              tag: `missed_${s.id}_${slotKey}`,
              requireInteraction: true
            }).then((success) => {
              if (success) {
                markAsNotified(today, s.id, slotKey);
              }
            });
          }
        });
      });
    };

    // Run direct scan and start 30 seconds ticker
    checkSupplements();
    const interval = setInterval(checkSupplements, 30000);

    return () => clearInterval(interval);
  }, [userState.supplements, userState.suppChecks]);

  // Load GSI Script dynamically for Google Calendar API
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if ((window as any).google?.accounts?.oauth2) {
        setGsiScriptLoaded(true);
      }
    };
    document.head.appendChild(s);

    // Restore cached calendar Token & cookies on boot
    const cachedToken = localStorage.getItem("gcal_token");
    const cachedExpiry = localStorage.getItem("gcal_token_expiry");
    if (cachedToken && cachedExpiry && parseInt(cachedExpiry) > Date.now()) {
      setGcalAccessToken(cachedToken);
      fetchGCalEvents(cachedToken);
    }
  }, []);

  // Firebase auth sync listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, FirebaseUser => {
      if (FirebaseUser) {
        const profile = {
          uid: FirebaseUser.uid,
          displayName: FirebaseUser.displayName,
          email: FirebaseUser.email,
          photoURL: FirebaseUser.photoURL || ""
        };
        setUser(profile);
        setAuthLoading(false);

        // Save logon status in client caches for instant boot
        localStorage.setItem("life_dashboard_cached_user", JSON.stringify(profile));
        document.cookie = `is_authenticated=true; max-age=2592000; path=/`;
      } else {
        // Logged out
        setUser(prev => {
          if (prev?.uid === "local-guest-user") return prev;
          localStorage.removeItem("life_dashboard_cached_user");
          document.cookie = "is_authenticated=; max-age=0; path=/";
          return null;
        });
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync state from Firestore using active listeners
  useEffect(() => {
    if (!user?.uid) return;

    if (user.uid === "local-guest-user") {
      // Load local guest profile from localStorage or fallback to default
      const cachedData = localStorage.getItem("life_dashboard_guest_user_state");
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const today = new Date().toDateString();
          let state = { ...defaultState(), ...parsed };
          if (state.lastDate && state.lastDate !== today) {
            let finalTaskStreak = state.taskStreak ?? 0;
            if (state.lastStreakCompletedDate !== state.lastDate) {
              finalTaskStreak = 0;
            }
            state.todayGoals = [
              ...(state.todayGoals || []).filter((g: any) => !g.done),
              ...(state.tomorrowGoals || []).map((g: any) => ({ ...g, done: false }))
            ];
            state.tomorrowGoals = [];
            state.lastDate = today;
            state.taskStreak = finalTaskStreak;
            localStorage.setItem("life_dashboard_guest_user_state", JSON.stringify(state));
          }
          setUserState(state);
          return;
        } catch (e) {}
      }
      setUserState(defaultState());
      return;
    }

    const docRef = doc(db, "users", user.uid);
    const unsubscribeFirestore = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const today = new Date().toDateString();
        let updatedGoals = d.todayGoals || [];
        let updatedTomorrow = d.tomorrowGoals || [];
        let updatedLastDate = d.lastDate || today;

        // Carry-over tasks checklist at midnight rollover
        if (d.lastDate && d.lastDate !== today) {
          let finalTaskStreak = d.taskStreak ?? 0;
          if (d.lastStreakCompletedDate !== d.lastDate) {
            finalTaskStreak = 0;
          }

          updatedGoals = [
            ...(d.todayGoals || []).filter((g: any) => !g.done),
            ...(d.tomorrowGoals || []).map((g: any) => ({ ...g, done: false }))
          ];
          updatedTomorrow = [];
          updatedLastDate = today;

          // Push rolled-over items optimistically back
          setDoc(doc(db, "users", user.uid), {
            ...d,
            todayGoals: updatedGoals,
            tomorrowGoals: updatedTomorrow,
            lastDate: updatedLastDate,
            taskStreak: finalTaskStreak
          }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
          });
        }

        const fetched: UserState = {
          ...defaultState(),
          todayGoals: updatedGoals,
          tomorrowGoals: updatedTomorrow,
          lastDate: updatedLastDate,
          routines: d.routines || [],
          exerciseHistory: d.exerciseHistory || {},
          supplements: d.supplements || [],
          suppChecks: d.suppChecks || {},
          waterGoal: d.waterGoal ?? 2000,
          waterUnit: (d.waterUnit === "ml" || d.waterUnit === "oz") ? "glass" : (d.waterUnit || "glass"),
          waterLog: d.waterLog || {},
          weightLog: d.weightLog || [],
          useLb: d.useLb || false,
          completedWorkouts: d.completedWorkouts || [],
          waterConfig: d.waterConfig || defaultState().waterConfig,
          taskStreak: d.taskStreak ?? 0,
          lastStreakCompletedDate: d.lastStreakCompletedDate || null,
          calorieGoal: d.calorieGoal ?? defaultState().calorieGoal,
          proteinGoalPct: d.proteinGoalPct ?? defaultState().proteinGoalPct,
          carbGoalPct: d.carbGoalPct ?? defaultState().carbGoalPct,
          fatGoalPct: d.fatGoalPct ?? defaultState().fatGoalPct,
          foodLog: d.foodLog || {}
        };

        setUserState(fetched);
        // Sync static cache
        localStorage.setItem("life_dashboard_user_state", JSON.stringify(fetched));
      } else {
        // Fresh profile registration
        const fresh = defaultState();
        setDoc(doc(db, "users", user.uid), fresh).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribeFirestore();
  }, [user?.uid]);

  // Google Calendar Connection launcher
  const connectGcal = async () => {
    setGcalLoading(true);
    setGcalError(null);
    try {
      // Use Firebase Auth signInWithPopup to get the token directly!
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error("Could not retrieve access token from Google sign-in. Make sure you complete the authentication.");
      }
      const token = credential.accessToken;
      // Access tokens are typically valid for 1 hour (3600 seconds)
      const expiry = Date.now() + 3600 * 1000;

      setGcalAccessToken(token);
      setGcalError(null);

      // Persist token in cookie and localStorage
      localStorage.setItem("gcal_token", token);
      localStorage.setItem("gcal_token_expiry", expiry.toString());
      document.cookie = `gcal_token=${token}; max-age=2592000; path=/`;

      await fetchGCalEvents(token);
    } catch (err: any) {
      console.error("Popup login missed/denied:", err);
      if (err.code === "auth/popup-blocked") {
        setGcalError("Popup was blocked by your browser. Please allow popups for this site and try again.");
      } else {
        setGcalError(err.message || "Interactive access was denied or cancelled.");
      }
    } finally {
      setGcalLoading(false);
    }
  };

  const disconnectGcal = () => {
    if (gcalAccessToken) {
      try {
        (window as any).google?.accounts?.oauth2?.revoke(gcalAccessToken);
      } catch (e) {}
    }
    setGcalAccessToken(null);
    setGcalEvents([]);
    setGcalError(null);

    // Clear caches
    localStorage.removeItem("gcal_token");
    localStorage.removeItem("gcal_token_expiry");
    document.cookie = "gcal_token=; max-age=0; path=/";
  };

  const fetchGCalEvents = async (token: string) => {
    setGcalLoading(true);
    setGcalError(null);
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60);
      const s = startDate.toISOString();
      const e = endDate.toISOString();
      
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(s)}&timeMax=${encodeURIComponent(e)}&singleEvents=true&orderBy=startTime&maxResults=250`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          disconnectGcal();
          setGcalError("Connection session expired. Please reconnect.");
        } else if (res.status === 403) {
          let detailedMsg = "Access Forbidden (403): Ensure the 'Google Calendar API' is enabled in your Google Cloud Console for this project and your email is added to 'Test Users'.";
          try {
            const errData = await res.json();
            if (errData?.error?.message) {
              detailedMsg = `Google API Error (403): ${errData.error.message}`;
            }
          } catch (e) {}
          setGcalError(detailedMsg);
        } else {
          setGcalError(`Google Calendar error response (${res.status}).`);
        }
        return;
      }
      const data = await res.json();
      setGcalEvents(data.items || []);
    } catch (err) {
      setGcalError("Could not retrieve calendar items due to a connection issue.");
    } finally {
      setGcalLoading(false);
    }
  };

  // Google Login popup launcher
  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Popup logon missed/denied:", e);
      setAuthError(e);
    }
  };

  // Standard user log out
  const handleSignOut = async () => {
    try {
      if (user?.uid !== "local-guest-user") {
        await signOut(auth);
      }
      disconnectGcal();
      setUser(null);
      setUserState(defaultState());
      localStorage.removeItem("life_dashboard_user_state");
      localStorage.removeItem("life_dashboard_cached_user");
      localStorage.removeItem("life_dashboard_guest_user_state");
      document.cookie = "is_authenticated=; max-age=0; path=/";
    } catch (e) {}
  };

  // Push state improvements back to Firestore
  const updateFirestore = (updated: UserState) => {
    if (!user?.uid) return;
    if (user.uid === "local-guest-user") {
      localStorage.setItem("life_dashboard_guest_user_state", JSON.stringify(updated));
      localStorage.setItem("life_dashboard_user_state", JSON.stringify(updated));
      return;
    }
    setDoc(doc(db, "users", user.uid), updated).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    });
  };

  const handleLogFood = (name: string, calories: number, protein: number, carbs: number, fat: number, barcode?: string, quantity: number = 1) => {
    const today = new Date().toDateString();
    const entry: FoodLogEntry = {
      id: Math.random().toString(36).slice(2, 9),
      name,
      calories,
      protein,
      carbs,
      fat,
      quantity,
      barcode: barcode || "",
      loggedAt: new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    };

    const copy = { ...userState };
    if (!copy.foodLog) copy.foodLog = {};
    if (!copy.foodLog[today]) copy.foodLog[today] = [];
    copy.foodLog[today] = [...copy.foodLog[today], entry];

    setUserState(copy);
    updateFirestore(copy);
  };

  const handleRemoveFood = (id: string) => {
    const today = new Date().toDateString();
    const copy = { ...userState };
    if (copy.foodLog && copy.foodLog[today]) {
      copy.foodLog[today] = copy.foodLog[today].filter(e => e.id !== id);
      setUserState(copy);
      updateFirestore(copy);
    }
  };

  const handleUpdateCalorieTarget = (calorieGoal: number, proteinGoalPct: number, carbGoalPct: number, fatGoalPct: number) => {
    const copy = {
      ...userState,
      calorieGoal,
      proteinGoalPct,
      carbGoalPct,
      fatGoalPct
    };
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleFoodSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingFood(true);
    try {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setFoodSearchResults(data || []);
      }
    } catch (err) {
      console.error("Food search error:", err);
    } finally {
      setIsSearchingFood(false);
    }
  };

  const handleBarcodeLookup = async (barcode: string) => {
    setScannedProductError("");
    try {
      const res = await fetch(`/api/food/barcode/${barcode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.product) {
          setSelectedFoodProduct(data.product);
          setFoodServingMultiplier(1);
          setFoodTab("search"); // switch back to details card inside search tab!
          return true;
        } else {
          setScannedProductError(data.error || "Product not found in database.");
        }
      } else {
        setScannedProductError("Barcode lookup failed. Product not found.");
      }
    } catch (err) {
      console.error("Barcode lookup error:", err);
      setScannedProductError("Failed to lookup barcode.");
    }
    return false;
  };

  useEffect(() => {
    if (activeAddModal !== "food" || foodTab !== "scanner") {
      setIsBarcodeScanning(false);
      return;
    }

    let html5QrcodeScanner: Html5Qrcode | null = null;
    setIsBarcodeScanning(true);
    setScannedProductError("");

    const startScanner = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
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
            setIsBarcodeScanning(false);
            await handleBarcodeLookup(decodedText);
          },
          (errorMessage) => {}
        );
      } catch (err: any) {
        console.error("Camera scanner startup failed:", err);
        setScannedProductError("Could not access environment camera. Try typing manual query or check permissions.");
        setIsBarcodeScanning(false);
      }
    };

    startScanner();

    return () => {
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(e => console.error("Scanner stop fail:", e));
      }
    };
  }, [activeAddModal, foodTab]);

  const evaluateStreak = (copy: UserState): UserState => {
    const today = new Date().toDateString();
    const allDone = copy.todayGoals.length > 0 && copy.todayGoals.every(g => g.done);
    
    if (allDone) {
      if (copy.lastStreakCompletedDate !== today) {
        copy.taskStreak = (copy.taskStreak || 0) + 1;
        copy.lastStreakCompletedDate = today;
      }
    } else {
      if (copy.lastStreakCompletedDate === today) {
        copy.taskStreak = Math.max(0, (copy.taskStreak || 1) - 1);
        copy.lastStreakCompletedDate = null;
      }
    }
    return copy;
  };

  // Global triggers inside tabs
  const handleToggleGoal = (id: string) => {
    let copy = { ...userState };
    copy.todayGoals = copy.todayGoals.map(g => (g.id === id ? { ...g, done: !g.done } : g));
    copy = evaluateStreak(copy);
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleAddTodayGoal = (text: string, priority?: "high" | "medium" | "low") => {
    let copy = { ...userState };
    copy.todayGoals = [
      ...copy.todayGoals,
      { id: Math.random().toString(36).slice(2, 9), text, done: false, lightning: false }
    ];
    copy = evaluateStreak(copy);
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleRemoveTodayGoal = (id: string) => {
    let copy = { ...userState };
    copy.todayGoals = copy.todayGoals.filter(g => g.id !== id);
    copy = evaluateStreak(copy);
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleAddTomorrowGoal = (text: string, priority?: "high" | "medium" | "low") => {
    const copy = { ...userState };
    copy.tomorrowGoals = [
      ...copy.tomorrowGoals,
      { id: Math.random().toString(36).slice(2, 9), text, done: false, lightning: false }
    ];
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleRemoveTomorrowGoal = (id: string) => {
    const copy = { ...userState };
    copy.tomorrowGoals = copy.tomorrowGoals.filter(tg => tg.id !== id);
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleToggleLightningGoal = (id: string, isToday: boolean) => {
    const copy = { ...userState };
    if (isToday) {
      copy.todayGoals = copy.todayGoals.map(g => (g.id === id ? { ...g, lightning: !g.lightning } : g));
    } else {
      copy.tomorrowGoals = copy.tomorrowGoals.map(g => (g.id === id ? { ...g, lightning: !g.lightning } : g));
    }
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleMoveActiveToTomorrow = () => {
    let copy = { ...userState };
    const activeTasks = copy.todayGoals.filter(g => !g.done);
    const completedTasks = copy.todayGoals.filter(g => g.done);

    copy.tomorrowGoals = [...copy.tomorrowGoals, ...activeTasks];
    copy.todayGoals = completedTasks;
    copy = evaluateStreak(copy);

    setUserState(copy);
    updateFirestore(copy);
  };

  const handleMoveGoal = (id: string, fromList: "today" | "tomorrow", toList: "today" | "tomorrow") => {
    if (fromList === toList) return;
    let copy = { ...userState };
    let movedGoal: Goal | undefined;

    if (fromList === "today") {
      movedGoal = copy.todayGoals.find(g => g.id === id);
      copy.todayGoals = copy.todayGoals.filter(g => g.id !== id);
    } else {
      movedGoal = copy.tomorrowGoals.find(g => g.id === id);
      copy.tomorrowGoals = copy.tomorrowGoals.filter(g => g.id !== id);
    }

    if (movedGoal) {
      if (toList === "today") {
        copy.todayGoals = [...copy.todayGoals, movedGoal];
      } else {
        copy.tomorrowGoals = [...copy.tomorrowGoals, movedGoal];
      }
    }
    copy = evaluateStreak(copy);
    setUserState(copy);
    updateFirestore(copy);
  };

  // Supplements checking
  const handleToggleSuppCheck = (suppId: string, slotKey: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const copy = { ...userState };
    if (!copy.suppChecks[today]) {
      copy.suppChecks[today] = {};
    }
    const key = `${suppId}_${slotKey}`;
    copy.suppChecks[today][key] = !copy.suppChecks[today][key];
    setUserState(copy);
    updateFirestore(copy);
  };

  // Adding supplements
  const handleAddSupplement = (name: string, dosage: string, times: string[], scheduledTimes?: Record<string, string>) => {
    const copy = { ...userState };
    copy.supplements = [
      ...copy.supplements,
      { id: Math.random().toString(36).slice(2, 9), name, dosage, times, scheduledTimes }
    ];
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleRemoveSupplement = (id: string) => {
    const copy = { ...userState };
    copy.supplements = copy.supplements.filter(s => s.id !== id);
    setUserState(copy);
    updateFirestore(copy);
  };

  // Hydration triggers
  const handleUpdateWaterGoal = (val: number) => {
    const copy = { ...userState, waterGoal: val };
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleUpdateWaterUnit = (unit: string) => {
    const copy = { ...userState, waterUnit: unit };
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleLogWater = (action: "increment" | "decrement") => {
    const today = new Date().toISOString().slice(0, 10);
    const copy = { ...userState };
    const current = copy.waterLog[today] || 0;
    if (action === "increment") {
      copy.waterLog[today] = current + 1;
    } else {
      copy.waterLog[today] = Math.max(0, current - 1);
    }
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleUpdateWaterConfig = (config: WaterConfig) => {
    const copy = {
      ...userState,
      waterConfig: config,
      waterGoal: config.calculatedGoalMl || userState.waterGoal,
      waterUnit: config.containerType
    };
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleResetWater = () => {
    const today = new Date().toISOString().slice(0, 10);
    const copy = { ...userState };
    copy.waterLog[today] = 0;
    setUserState(copy);
    updateFirestore(copy);
  };

  // Gym training triggers
  const handleStartWorkout = (routineId: string) => {
    const r = userState.routines.find(x => x.id === routineId);
    if (!r) return;
    setActiveWorkout({
      routine: r,
      sets: r.exercises.map(() => [{ weight: "", reps: "" }]),
      startTime: Date.now(),
      currentEx: 0
    });
  };

  const handleCancelWorkout = () => {
    setActiveWorkout(null);
  };

  const handleFinishWorkout = (exercisesLogged: Record<string, { weight: number; reps: number; date: string }>) => {
    if (!activeWorkout) return;
    const copy = { ...userState };
    Object.entries(exercisesLogged).forEach(([exName, stats]) => {
      if (!copy.exerciseHistory[exName]) {
        copy.exerciseHistory[exName] = [];
      }
      copy.exerciseHistory[exName].push(stats);
    });

    const exercisesReport: { name: string; setsCount: number; maxWeight: number; reps: number }[] = [];
    activeWorkout.routine.exercises.forEach((ex, i) => {
      const setsDone = activeWorkout.sets[i].filter(s => s.weight !== "" && s.reps !== "");
      if (setsDone.length > 0) {
        const maxWeight = Math.max(...setsDone.map(s => parseFloat(s.weight) || 0));
        const maxReps = Math.max(...setsDone.map(s => parseInt(s.reps) || 0));
        exercisesReport.push({
          name: ex.name,
          setsCount: setsDone.length,
          maxWeight,
          reps: maxReps
        });
      }
    });

    const elapsedMs = Date.now() - activeWorkout.startTime;
    const elapsedMins = Math.round(elapsedMs / 60000) || 1;
    const todayDateStr = new Date().toISOString().slice(0, 10);

    const newCompleted = {
      id: Math.random().toString(36).slice(2, 9),
      name: activeWorkout.routine.name,
      date: todayDateStr,
      durationMinutes: elapsedMins,
      exercises: exercisesReport
    };

    if (!copy.completedWorkouts) {
      copy.completedWorkouts = [];
    }
    copy.completedWorkouts.push(newCompleted);

    setActiveWorkout(null);
    setUserState(copy);
    updateFirestore(copy);
    setActiveTab("fitness");
  };

  const handleSaveRoutine = (id: string | null, name: string, exercises: Exercise[]) => {
    const copy = { ...userState };
    if (id) {
      copy.routines = copy.routines.map(r => (r.id === id ? { ...r, name, exercises } : r));
    } else {
      copy.routines = [
        ...copy.routines,
        { id: Math.random().toString(36).slice(2, 9), name, exercises }
      ];
    }
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleDeleteRoutine = (id: string) => {
    const copy = { ...userState };
    copy.routines = copy.routines.filter(r => r.id !== id);
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleToggleLb = () => {
    const copy = { ...userState, useLb: !userState.useLb };
    setUserState(copy);
    updateFirestore(copy);
  };

  // Weight entry triggers
  const handleLogWeight = (weightKg: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const copy = { ...userState };
    const idx = copy.weightLog.findIndex(e => e.date === today);
    if (idx >= 0) {
      copy.weightLog[idx].weight = weightKg;
    } else {
      copy.weightLog.push({ date: today, weight: weightKg });
    }
    setUserState(copy);
    updateFirestore(copy);
  };

  const handleRemoveWeight = (date: string) => {
    const copy = { ...userState };
    copy.weightLog = copy.weightLog.filter(e => e.date !== date);
    setUserState(copy);
    updateFirestore(copy);
  };

  // Spinner on startupauth resolving
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-[#0d0b14] flex flex-col justify-center items-center gap-4 text-[#f0c972]">
        <div className="w-10 h-10 border-4 border-[#f0c972] border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-xs tracking-widest text-[#6b6485]">INITIALIZING PORTAL...</span>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="fixed inset-0 bg-[#0d0b14] p-6 flex flex-col items-center justify-center gap-6 text-center select-none overflow-y-auto">
        <div className="max-w-sm w-full space-y-6">
          <div>
            <div className="font-bebas text-5xl text-gradient bg-clip-text text-transparent bg-gradient-to-r from-[#f0c972] to-[#e07b3f] tracking-widest mb-1 animate-pulse">
              LIFE DASHBOARD
            </div>
            <p className="font-mono text-[10px] text-[#6b6485] tracking-widest uppercase">
              Unified Wellness & Performance Hub
            </p>
          </div>

          <p className="font-mono text-xs text-[#9991b8] max-w-[280px] mx-auto leading-relaxed">
            Securely sign in using your Google Account to synchronize training routines, calendars, and nutrition goals instantly.
          </p>

          <div className="flex flex-col gap-3 justify-center items-center">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-[#13111f] border border-[#2a2440] hover:border-[#f0c972] rounded-2xl px-6 py-3.5 text-xs text-white font-mono shadow-xl cursor-pointer active:scale-95 transition-all animate-fade-in"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>

            <button
              onClick={() => {
                const guestProfile = {
                  uid: "local-guest-user",
                  displayName: "Guest Athlete",
                  email: "guest@example.com",
                  photoURL: ""
                };
                setUser(guestProfile);
                localStorage.setItem("life_dashboard_cached_user", JSON.stringify(guestProfile));
                document.cookie = `is_authenticated=true; max-age=2592000; path=/`;
                setAuthError(null);
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#0d0b14] border border-[#221d35] hover:border-[#6b6485] hover:text-white rounded-2xl px-6 py-3.5 text-[11px] text-[#6b6485] font-mono shadow-md cursor-pointer active:scale-95 transition-all"
            >
              Enter as Guest (Local Sandbox)
            </button>
          </div>

          {authError && (
            <div className="w-full p-4 rounded-xl border border-red-500/20 bg-red-400/5 text-left font-mono text-[11px] text-[#ff6b6b] space-y-3">
              <div className="font-bold flex items-center gap-1.5 text-xs text-red-400">
                <span>⚠️</span> AUTHENTICATION ERROR
              </div>
              <p className="leading-relaxed text-[#c3b6dc]">
                {authError.message || String(authError)}
              </p>
              {authError.code === "auth/unauthorized-domain" && (
                <div className="space-y-2 border-t border-red-500/10 pt-2 text-[#9991b8]">
                  <p className="text-[10px] uppercase font-bold text-yellow-400">Fix unauthorized domain:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[10px] leading-relaxed">
                    <li>Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-[#f0c972] hover:text-[#e07b3f] text-gradient">Firebase Console</a></li>
                    <li>Go to <span className="text-white font-medium">Authentication &gt; Settings &gt; Authorized Domains</span></li>
                    <li>Add your preview domain <span className="bg-[#1c182c] px-1.5 py-0.5 rounded text-white select-all font-bold">{window.location.host}</span> to the list.</li>
                  </ol>
                  <p className="text-[9px] text-[#6b6485] leading-relaxed pt-1">
                    Alternatively, click <span className="text-[#f0c972]">"Enter as Guest"</span> above to bypass Google Sign-In entirely and test the full feature set with local persistence!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0b14] text-[#e8e3f8] flex flex-col relative select-none">
      {/* Upper Account Bar details */}
      <header className="flex justify-between items-center px-4 py-3 border-b border-[#221d35] shrink-0 sticky top-0 bg-[#0d0b14dd] backdrop-blur z-40 max-w-md w-full mx-auto">
        <div 
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 select-none transition-all active:scale-[0.98]"
          title="Open Dashboard Settings"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="User avatar" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-[#f0c972] hover:scale-105 transition-transform" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] flex items-center justify-center font-bebas text-xs text-[#0d0b14] font-bold hover:scale-105 transition-transform">
              {(user.displayName || "User").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] text-[#9991b8] truncate max-w-[120px] font-bold">
              {user.displayName || "User"}
            </span>
            <span className="text-[7.5px] font-mono text-[#f0c972] tracking-wider uppercase">⚙️ Settings Menu</span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="bg-transparent border border-[#221d35] rounded-lg px-2.5 py-1 text-[9px] font-mono text-[#3d3657] hover:text-[#9991b8] active:scale-95 transition-all cursor-pointer"
        >
          Sign out
        </button>
      </header>

      {/* Main tab elements content wrapper */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="w-full h-full"
          >
            {activeTab === "home" && (
              <HomeTab
                userState={userState}
                gcalAccessToken={gcalAccessToken}
                gcalEvents={gcalEvents}
                gcalLoading={gcalLoading}
                gcalError={gcalError}
                onConnectGcal={connectGcal}
                onDisconnectGcal={disconnectGcal}
                onRefreshGcal={() => gcalAccessToken && fetchGCalEvents(gcalAccessToken)}
                onToggleGoal={handleToggleGoal}
                onAddTodayGoal={handleAddTodayGoal}
                onRemoveTodayGoal={handleRemoveTodayGoal}
                onAddTomorrowGoal={handleAddTomorrowGoal}
                onRemoveTomorrowGoal={handleRemoveTomorrowGoal}
                onToggleSuppCheck={handleToggleSuppCheck}
                onToggleLightningGoal={handleToggleLightningGoal}
                onMoveActiveToTomorrow={handleMoveActiveToTomorrow}
                onMoveGoal={handleMoveGoal}
                onLogFood={handleLogFood}
                onRemoveFood={handleRemoveFood}
                onUpdateCalorieTarget={handleUpdateCalorieTarget}
              />
            )}

            {activeTab === "fitness" && (
              <FitnessTab
                userState={userState}
                activeWorkout={activeWorkout}
                onStartWorkout={handleStartWorkout}
                onFinishWorkout={handleFinishWorkout}
                onCancelWorkout={handleCancelWorkout}
                onSaveRoutine={handleSaveRoutine}
                onDeleteRoutine={handleDeleteRoutine}
                onToggleLb={handleToggleLb}
                onUpdateActiveWorkout={handleUpdateActiveWorkout}
              />
            )}

            {activeTab === "health" && (
              <HealthTab
                userState={userState}
                onUpdateWaterGoal={handleUpdateWaterGoal}
                onUpdateWaterUnit={handleUpdateWaterUnit}
                onLogWater={handleLogWater}
                onResetWater={handleResetWater}
                onAddSupplement={handleAddSupplement}
                onRemoveSupplement={handleRemoveSupplement}
                onToggleSuppCheck={handleToggleSuppCheck}
                notifPermission={notifPermission}
                onRequestNotifPermission={handleRequestNotifPermission}
                onTriggerTestNotification={handleTriggerTestNotification}
                onLogWeight={handleLogWeight}
                onRemoveWeight={handleRemoveWeight}
                onUpdateWaterConfig={handleUpdateWaterConfig}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarTab
                userState={userState}
                gcalAccessToken={gcalAccessToken}
                gcalEvents={gcalEvents}
                gcalLoading={gcalLoading}
                gcalError={gcalError}
                onConnectGcal={connectGcal}
                onDisconnectGcal={disconnectGcal}
                onRefreshGcal={() => gcalAccessToken && fetchGCalEvents(gcalAccessToken)}
                onToggleGoal={handleToggleGoal}
                onToggleSuppCheck={handleToggleSuppCheck}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent floating Coach overlay */}
      <AIFieldCoach
        userState={userState}
        onSaveRoutine={handleSaveRoutine}
        onAddTodayGoal={handleAddTodayGoal}
        onUpdateWaterGoal={handleUpdateWaterGoal}
        onUpdateCalorieTarget={handleUpdateCalorieTarget}
        setActiveTab={setActiveTab}
      />

      {/* Settings Modal Overlay Page */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#0d0b14dd] backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#13111f] border border-[#2a2440] rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bebas text-2xl tracking-widest text-[#f0c972]">Dashboard Settings</span>
                <span className="block text-[8px] font-mono text-[#6b6485] uppercase tracking-wider mt-0.5">Customize metrics & sync controls</span>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 rounded-full bg-[#1b172d] border border-[#2e2652] hover:border-red-400 text-[#9991b8] hover:text-red-400 font-bebas text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-all focus:outline-none"
              >
                ×
              </button>
            </div>

            {/* Profile Card Summary */}
            <div className="bg-[#0f0d1a] border border-[#221d35] rounded-2xl p-3 flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-[#f0c972]" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#f0c972] to-[#e07b3f] flex items-center justify-center font-bebas text-lg text-[#0d0b14] font-bold">
                  {(user.displayName || "User").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <span className="font-mono text-[11px] text-[#e8e3f8] block font-bold truncate leading-none mb-1">{user.displayName || "Athlete Profile"}</span>
                <span className="font-mono text-[9px] text-[#6b6485] block truncate leading-none">{user.email || "local_sandbox@account"}</span>
              </div>
            </div>

            {/* Config Segments */}
            <div className="space-y-4">
              {/* Option 1: Notifications */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold tracking-wider text-[#6b6485] uppercase block text-left">🔔 Supplement Alerts</span>
                
                <div className="bg-[#1b172d] border border-[#221d35] rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-gray-300">Enable In-App Warnings</span>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...userState, notificationsEnabled: userState.notificationsEnabled === false ? true : false };
                        setUserState(copy);
                        updateFirestore(copy);
                      }}
                      className="w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: userState.notificationsEnabled !== false ? "#6fcf97" : "#3d3657"
                      }}
                    >
                      <div 
                        className="w-4.5 h-4.5 bg-white rounded-full shadow-md transition-all"
                        style={{
                          transform: userState.notificationsEnabled !== false ? "translateX(18px)" : "translateX(0px)"
                        }}
                      />
                    </button>
                  </div>

                  <p className="font-mono text-[8.5px] leading-relaxed text-[#9991b8] text-left">
                    When active, warning alarms warn you 45 minutes before due times, and alert you if schedule slots are missed.
                  </p>

                  <div className="flex gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={handleRequestNotifPermission}
                      className="text-[9px] font-mono bg-[#0d0b14] hover:bg-[#151221] border border-[#282143] text-[#e8e3f8] px-2 py-1.5 rounded-lg flex-1 cursor-pointer transition-all active:scale-95 text-center font-semibold"
                    >
                      Grant Browser Perms
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerTestNotification}
                      disabled={notifPermission !== "granted"}
                      className="text-[9px] font-mono bg-[#0d0b14] hover:bg-[#151221] border border-[#282143] text-[#f0c972] hover:text-[#f0c972] px-2 py-1.5 rounded-lg flex-1 cursor-pointer disabled:opacity-40 transition-all active:scale-95 text-center font-semibold"
                    >
                      Try Test Alert
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Weight standard conversion metrics */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold tracking-wider text-[#6b6485] uppercase block text-left">🏋️ Global Weight Metric</span>
                <div className="bg-[#1b172d] border border-[#221d35] rounded-xl p-3 flex justify-between items-center">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="font-mono text-[10px] text-gray-300">Preference unit</span>
                    <span className="font-mono text-[8px] text-[#6b6485]">Converts progress grids & weight-logs</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-[#0d0b14] border border-[#231d45] rounded-xl px-2.5 py-1.5 font-mono text-[9px] select-none">
                    <span
                      onClick={handleToggleLb}
                      className={`cursor-pointer transition-colors font-bold ${!userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
                    >
                      KG
                    </span>
                    <div
                      onClick={handleToggleLb}
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
                      onClick={handleToggleLb}
                      className={`cursor-pointer transition-colors font-bold ${userState.useLb ? "text-[#f0c972]" : "text-[#3d3657]"}`}
                    >
                      LB
                    </span>
                  </div>
                </div>
              </div>

              {/* Option 3: Danger Zone */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold tracking-wider text-[#ff5c5c] uppercase block text-left">⚠️ Security Danger Zone</span>
                <div className="bg-red-950/20 border border-red-500/10 rounded-xl p-3 flex flex-col gap-2">
                  <p className="font-mono text-[8.5px] leading-relaxed text-red-300 text-left">
                    Erase all client states, custom exercise templates, history counters, files, and Firebase documents. Irreversible action.
                  </p>
                  
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("⚠️ WARNING: This will permanently wipe your routines, training logs, weight charts, and supplement notifications. This cannot be undone.\n\nContinue?")) {
                        return;
                      }
                      const input = prompt("Type 'RESET' to confirm formatting all account metrics:");
                      if (input !== "RESET") {
                        alert("Accidental reset prevented.");
                        return;
                      }

                      try {
                        if (user && user.uid !== "local-guest-user") {
                          const { deleteDoc, doc } = await import("firebase/firestore");
                          await deleteDoc(doc(db, "users", user.uid));
                        }
                      } catch (err) {
                        console.error("Firestore cleanup failed", err);
                      }

                      localStorage.removeItem("life_dashboard_user_state");
                      localStorage.removeItem("life_dashboard_guest_user_state");
                      localStorage.removeItem("life_dashboard_cached_user");
                      localStorage.removeItem("gcal_token");
                      localStorage.removeItem("gcal_token_expiry");

                      // Remove notify triggers
                      try {
                        for (let i = localStorage.length - 1; i >= 0; i--) {
                          const key = localStorage.key(i);
                          if (key && (key.startsWith("life_dash_") || key.startsWith("life_dashboard_"))) {
                            localStorage.removeItem(key);
                          }
                        }
                      } catch (e) {}

                      document.cookie = "is_authenticated=; max-age=0; path=/";
                      document.cookie = "gcal_token=; max-age=0; path=/";

                      setUserState(defaultState());
                      setUser(null);
                      setShowSettings(false);
                      setActiveTab("home");
                      alert("Profile data wiped successfully. Start fresh!");
                    }}
                    className="w-full bg-[#1b0a14] hover:bg-red-950 text-red-400 hover:text-red-200 border border-red-500/20 text-[9px] font-mono py-2 rounded-lg font-bold transition-all active:scale-[0.98] cursor-pointer text-center"
                  >
                    Delete & Reset Account Profile
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Persistent global Floating Plus Button and sub-menus */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {isAddMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-end gap-2 mb-2"
            >
              <button
                onClick={() => {
                  setActiveAddModal("workout");
                  setIsAddMenuOpen(false);
                }}
                className="flex items-center gap-2 bg-[#17142a] border border-[#2a2440] hover:border-[#f0c972] text-[#e8e3f8] hover:text-[#f0c972] px-4 py-2 rounded-full font-mono text-xs font-bold transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>🏋️</span> Start Workout
              </button>
              <button
                onClick={() => {
                  setActiveAddModal("food");
                  setFoodTab("search");
                  setSelectedFoodProduct(null);
                  setFoodSearchQuery("");
                  setFoodSearchResults([]);
                  setScannedProductError("");
                  setIsAddMenuOpen(false);
                }}
                className="flex items-center gap-2 bg-[#17142a] border border-[#2a2440] hover:border-[#fbcfe8] text-[#e8e3f8] hover:text-[#fbcfe8] px-4 py-2 rounded-full font-mono text-xs font-bold transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>🍏</span> Add Food
              </button>
              <button
                onClick={() => {
                  setActiveAddModal("water");
                  setIsAddMenuOpen(false);
                }}
                className="flex items-center gap-2 bg-[#17142a] border border-[#2a2440] hover:border-cyan-400 text-[#e8e3f8] hover:text-cyan-400 px-4 py-2 rounded-full font-mono text-xs font-bold transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>💧</span> Add Water
              </button>
              <button
                onClick={() => {
                  setActiveAddModal("goal");
                  setIsAddMenuOpen(false);
                }}
                className="flex items-center gap-2 bg-[#17142a] border border-[#2a2440] hover:border-emerald-400 text-[#e8e3f8] hover:text-emerald-400 px-4 py-2 rounded-full font-mono text-xs font-bold transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>🎯</span> Add Goal
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl font-light cursor-pointer shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 text-white z-50 ${
            isAddMenuOpen 
              ? "bg-[#2a2440] rotate-45 border border-red-500/40" 
              : "bg-gradient-to-r from-[#f0c972] to-[#e07b3f] hover:brightness-110"
          }`}
          title="Log health metrics"
        >
          +
        </button>
      </div>

      {/* Global input Modals Layer */}
      <AnimatePresence>
        {activeAddModal && (
          <div className="fixed inset-0 bg-[#0d0b14dd] backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#13111f] border border-[#2a2440] rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col gap-4 text-left"
            >
              {/* Close Button top-right */}
              <button 
                onClick={() => setActiveAddModal(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer p-1"
              >
                ✕
              </button>

              {/* MODAL 1: ADD GOAL */}
              {activeAddModal === "goal" && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const text = (form.elements.namedItem("goalText") as HTMLInputElement).value.trim();
                  const targetDay = (form.elements.namedItem("goalDay") as HTMLSelectElement).value;
                  if (text) {
                    if (targetDay === "today") {
                      handleAddTodayGoal(text);
                    } else {
                      handleAddTomorrowGoal(text);
                    }
                    setActiveAddModal(null);
                  }
                }} className="flex flex-col gap-4">
                  <div>
                    <span className="font-bebas text-2xl tracking-widest text-[#fbgold] text-[#f0c972]">Add Target Goal</span>
                    <span className="block text-[8px] font-mono text-[#6b6485] uppercase tracking-wider mt-0.5">Define single milestone</span>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] font-mono text-[#9991b8] uppercase tracking-wider">Target Period</label>
                    <select name="goalDay" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl p-2.5 focus:outline-none focus:border-[#f0c972] w-full">
                      <option value="today">Today's List</option>
                      <option value="tomorrow">Tomorrow's List</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] font-mono text-[#9991b8] uppercase tracking-wider">Goal Description</label>
                    <input required name="goalText" placeholder="e.g., Read for 30 minutes" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] placeholder-[#3d3657] rounded-xl p-2.5 focus:outline-none focus:border-[#f0c972] w-full" />
                  </div>
                  
                  <div className="flex gap-2 justify-end mt-2">
                    <button type="button" onClick={() => setActiveAddModal(null)} className="px-4 py-2 border border-[#221d35] rounded-xl text-[10px] font-mono text-[#6b6485] hover:text-[#9991b8] cursor-pointer">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-[#f0c972] text-[#0d0b14] rounded-xl text-[10px] font-mono font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-transform">Create 🎯</button>
                  </div>
                </form>
              )}

              {/* MODAL 2: ADD WATER */}
              {activeAddModal === "water" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="font-bebas text-2xl tracking-widest text-cyan-400">Log Hydration</span>
                    <span className="block text-[8px] font-mono text-[#6b6485] uppercase tracking-wider mt-0.5">Record fluid consumption</span>
                  </div>
                  
                  <p className="text-[10px] font-mono text-[#9991b8] leading-relaxed">
                    Log a visual serving to add to your sips container. Currently configured to <span className="text-cyan-400 font-bold font-mono">{userState.waterUnit === "glass" ? "Glass" : userState.waterUnit === "bottle" ? "Bottle" : `${userState.waterUnit}`} ({userState.waterConfig?.capacity || 250} ml)</span> unit:
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => {
                        handleLogWater("increment");
                        setActiveAddModal(null);
                      }}
                      className="bg-[#17142a] border border-cyan-500/20 hover:border-cyan-400 p-3.5 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span className="text-xl">💧</span>
                      <span className="font-bebas text-sm tracking-wide text-cyan-300">Quick Sip</span>
                      <span className="text-[8px] font-mono text-[#6b6485]">+1 Serving ({userState.waterConfig?.capacity || 250} ml)</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        handleLogWater("increment");
                        setTimeout(() => {
                          handleLogWater("increment");
                        }, 100);
                        setActiveAddModal(null);
                      }}
                      className="bg-[#17142a] border border-cyan-500/20 hover:border-cyan-400 p-3.5 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span className="text-xl">🧊</span>
                      <span className="font-bebas text-sm tracking-wide text-cyan-300">Large Drink</span>
                      <span className="text-[8px] font-mono text-[#6b6485]">+2 Servings ({2 * (userState.waterConfig?.capacity || 250)} ml)</span>
                    </button>
                  </div>
                  
                  <div className="flex gap-2 justify-end mt-2 border-t border-[#1a172c] pt-3">
                    <button onClick={() => setActiveAddModal(null)} className="px-4 py-2 border border-[#221d35] rounded-xl text-[10px] font-mono text-[#6b6485] hover:text-[#9991b8] cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}

              {/* MODAL 3: START WORKOUT */}
              {activeAddModal === "workout" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="font-bebas text-2xl tracking-widest text-[#f0c972]">Training Routines</span>
                    <span className="block text-[8px] font-mono text-[#6b6485] uppercase tracking-wider mt-0.5">Launch athletic session</span>
                  </div>
                  
                  {userState.routines.length === 0 ? (
                    <div className="text-center p-4 bg-[#17142a] border border-[#2a2440] rounded-2xl flex flex-col gap-2">
                      <p className="text-[10px] font-mono text-[#9991b8] leading-relaxed">
                        You haven't built or saved any routines yet. Ask the AI Coach to "Suggest a workout" to automatically generate one!
                      </p>
                      <button
                        onClick={() => {
                          setActiveAddModal(null);
                          const rootNode = document.querySelector('[class*="fixed bottom-20 left-4"]');
                          if (rootNode) (rootNode as HTMLButtonElement).click();
                        }}
                        className="text-[9.5px] font-mono font-bold text-[#f0c972] underline cursor-pointer hover:text-[#e07b3f] capitalize"
                      >
                        Open AI field coach 🤖
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                      <label className="text-[8.5px] font-mono text-[#6b6485] uppercase tracking-wider">Select Routine</label>
                      {userState.routines.map(r => (
                        <button
                          key={r.id}
                          onClick={() => {
                            handleStartWorkout(r.id);
                            setActiveAddModal(null);
                            setActiveTab("fitness"); 
                          }}
                          className="bg-[#17142a] border border-[#2a2440] hover:border-[#f0c972] p-3 rounded-2xl flex justify-between items-center transition-all text-left cursor-pointer hover:scale-[1.01]"
                        >
                          <div>
                            <span className="font-bebas text-sm text-[#e8e3f8] block">{r.name}</span>
                            <span className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wide">
                              {r.exercises.length} Exercises • {r.exercises.map(e => e.name).slice(0, 2).join(", ")}{r.exercises.length > 2 ? "..." : ""}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#f0c972] hover:translate-x-0.5 transition-transform">Start →</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 justify-end mt-1 border-t border-[#1a172c] pt-2">
                    <button onClick={() => setActiveAddModal(null)} className="px-4 py-2 border border-[#221d35] rounded-xl text-[10px] font-mono text-[#6b6485] hover:text-[#9991b8] cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}

              {/* MODAL 4: ADD FOOD (SEARCH, MANUAL, SCAN) */}
              {activeAddModal === "food" && (
                <div className="flex flex-col gap-3.5 max-h-[80vh] overflow-y-auto pr-0.5">
                  <div>
                    <span className="font-bebas text-2xl tracking-widest text-pink-300">Calorie Tracker Log</span>
                    <span className="block text-[8px] font-mono text-[#6b6485] uppercase tracking-wider mt-0.5">Record daily nutritional meals</span>
                  </div>

                  {/* Tab Selector inside Food Modal */}
                  <div className="grid grid-cols-3 bg-[#0d0b14] border border-[#2a2440] rounded-xl p-1 text-[9px] font-mono">
                    <button 
                      onClick={() => { setFoodTab("search"); setSelectedFoodProduct(null); }}
                      className={`py-1.5 rounded-lg text-center font-bold cursor-pointer ${foodTab === "search" ? "bg-[#1d1933] text-pink-300" : "text-[#6b6485] hover:text-white"}`}
                    >
                      SEARCH DATABASE
                    </button>
                    <button 
                      onClick={() => { setFoodTab("manual"); setSelectedFoodProduct(null); }}
                      className={`py-1.5 rounded-lg text-center font-bold cursor-pointer ${foodTab === "manual" ? "bg-[#1d1933] text-pink-300" : "text-[#6b6485] hover:text-white"}`}
                    >
                      MANUAL ENTRY
                    </button>
                    <button 
                      onClick={() => { setFoodTab("scanner"); setSelectedFoodProduct(null); }}
                      className={`py-1.5 rounded-lg text-center font-bold cursor-pointer ${foodTab === "scanner" ? "bg-[#1d1933] text-pink-300" : "text-[#6b6485] hover:text-white"}`}
                    >
                      BARCODE SCAN
                    </button>
                  </div>

                  {/* DISPLAY TAB: 1. SEARCH */}
                  {foodTab === "search" && (
                    <div className="flex flex-col gap-3">
                      {selectedFoodProduct ? (
                        <div className="bg-[#17142a] border border-[#2a2440] rounded-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex gap-3">
                            {selectedFoodProduct.imageUrl && (
                              <img src={selectedFoodProduct.imageUrl} alt={selectedFoodProduct.name} referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover border border-[#2a2440] bg-black" />
                            )}
                            <div className="flex-1 text-left min-w-0">
                              <span className="text-[10px] font-mono font-bold text-pink-300 uppercase tracking-wide block truncate">{selectedFoodProduct.brand || "Generic"}</span>
                              <span className="font-bebas text-lg leading-tight text-white block truncate">{selectedFoodProduct.name}</span>
                              <span className="text-[9px] font-mono text-[#6b6485] block mt-0.5">Barcode: {selectedFoodProduct.barcode || "N/A"}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 p-2 bg-[#0d0b14] border border-[#201c35] rounded-xl text-center font-mono">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[7.5px] text-[#6b6485] uppercase">Calories</span>
                              <span className="text-xs font-bold text-[#fbcfe8]">{Math.round(selectedFoodProduct.calories * foodServingMultiplier)} kcal</span>
                            </div>
                            <div className="flex flex-col gap-0.5 border-l border-[#201c35]">
                              <span className="text-[7.5px] text-[#6b6485] uppercase">Protein</span>
                              <span className="text-xs font-bold text-indigo-300">{Math.round(selectedFoodProduct.protein * foodServingMultiplier)}g</span>
                            </div>
                            <div className="flex flex-col gap-0.5 border-l border-[#201c35]">
                              <span className="text-[7.5px] text-[#6b6485] uppercase">Carbs</span>
                              <span className="text-xs font-bold text-green-300">{Math.round(selectedFoodProduct.carbs * foodServingMultiplier)}g</span>
                            </div>
                            <div className="flex flex-col gap-0.5 border-l border-[#201c35]">
                              <span className="text-[7.5px] text-[#6b6485] uppercase">Fat</span>
                              <span className="text-xs font-bold text-amber-300">{Math.round(selectedFoodProduct.fat * foodServingMultiplier)}g</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-[#0d0b14]/50 border border-[#231d3d] rounded-xl px-3 py-1.5">
                            <span className="text-[9.5px] font-mono text-[#9991b8] uppercase">Serving scale</span>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setFoodServingMultiplier(prev => Math.max(0.25, prev - 0.25))}
                                className="w-5 h-5 rounded bg-[#1e1a30] text-[10px] font-bold font-mono text-pink-300 text-center flex items-center justify-center hover:bg-[#2e2949] cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono text-xs font-bold text-white min-w-[32px] text-center">{foodServingMultiplier.toFixed(2)}x</span>
                              <button 
                                onClick={() => setFoodServingMultiplier(prev => prev + 0.25)}
                                className="w-5 h-5 rounded bg-[#1e1a30] text-[10px] font-bold font-mono text-pink-300 text-center flex items-center justify-center hover:bg-[#2e2949] cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button 
                              onClick={() => setSelectedFoodProduct(null)}
                              className="flex-1 py-2 border border-[#221d35] rounded-xl text-[10px] font-mono text-[#6b6485] hover:text-white text-center cursor-pointer"
                            >
                              Back
                            </button>
                            <button 
                              onClick={() => {
                                handleLogFood(
                                  selectedFoodProduct.name,
                                  selectedFoodProduct.calories,
                                  selectedFoodProduct.protein,
                                  selectedFoodProduct.carbs,
                                  selectedFoodProduct.fat,
                                  selectedFoodProduct.barcode,
                                  foodServingMultiplier
                                );
                                setSelectedFoodProduct(null);
                                setActiveAddModal(null);
                              }}
                              className="flex-1 py-2 bg-[#fbcfe8] hover:bg-[#f9a8d4] text-[#0d0b14] rounded-xl text-[10px] font-mono font-bold text-center cursor-pointer"
                            >
                              Log Meal 🍏
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            handleFoodSearch(foodSearchQuery);
                          }} className="flex gap-1.5">
                            <input 
                              type="text" 
                              value={foodSearchQuery}
                              onChange={(e) => setFoodSearchQuery(e.target.value)}
                              placeholder="Search e.g., Oatmeal, Banana, Protein Shake..."
                              className="flex-1 bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] placeholder-[#413963] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#fbcfe8]"
                            />
                            <button 
                              type="submit" 
                              disabled={isSearchingFood}
                              className="bg-[#17142a] border border-[#2a2440] hover:border-[#fbcfe8] px-3 rounded-xl font-mono text-xs text-pink-300 cursor-pointer disabled:opacity-40"
                            >
                              Search
                            </button>
                          </form>

                          {scannedProductError && (
                            <div className="p-2.5 bg-red-950/20 border border-red-500/10 rounded-xl text-center">
                              <span className="text-[10px] font-mono font-bold text-red-400 block">{scannedProductError}</span>
                            </div>
                          )}

                          <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
                            {isSearchingFood ? (
                              <div className="text-center py-6 font-mono text-[10px] text-[#6b6485] flex flex-col items-center gap-1">
                                <span className="animate-spin border-t-2 border-pink-300 w-4 h-4 rounded-full" />
                                <span>Querying OpenFoodFacts index...</span>
                              </div>
                            ) : foodSearchResults.length > 0 ? (
                              foodSearchResults.map((prod, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    setSelectedFoodProduct(prod);
                                    setFoodServingMultiplier(1);
                                  }}
                                  className="bg-[#17142a]/60 hover:bg-[#1a172c] border border-[#231e3b] hover:border-pink-300/40 rounded-xl p-2.5 flex justify-between items-center text-left transition-all cursor-pointer hover:scale-[1.01]"
                                >
                                  <div className="truncate min-w-0 flex-1 pr-2">
                                    <span className="text-[8px] font-mono font-bold text-pink-300 block uppercase">{prod.brand}</span>
                                    <span className="font-bebas text-sm text-[#e8e3f8] block truncate leading-tight mt-0.5">{prod.name}</span>
                                    <span className="text-[8.5px] font-mono text-[#6b6485] block mt-0.5 truncate">
                                      P: {prod.protein}g | C: {prod.carbs}g | F: {prod.fat}g • Serv: 100g
                                    </span>
                                  </div>
                                  <div className="shrink-0 font-mono text-right">
                                    <span className="text-xs font-bold text-[#fbcfe8] block">{prod.calories} kcal</span>
                                    <span className="text-[8px] text-pink-300 block font-bold mt-0.5">Log →</span>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="text-center py-6">
                                <p className="text-[9.5px] font-mono text-[#6b6485] leading-relaxed">
                                  No database matches loaded. Type keywords into input box above or tap button below to scan any physical product packaging.
                                </p>
                                <button
                                  onClick={() => setFoodTab("scanner")}
                                  className="mt-3 inline-flex items-center gap-1.5 bg-[#17142a] border border-[#2a2440] hover:border-pink-300 text-pink-300 px-3.5 py-2 rounded-full font-mono text-[9px] font-bold cursor-pointer transition-all"
                                >
                                  <span>📷</span> START CAMERA BARCODE SCANNER
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DISPLAY TAB: 2. MANUAL */}
                  {foodTab === "manual" && (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const name = (form.elements.namedItem("mName") as HTMLInputElement).value.trim();
                      const cals = parseInt((form.elements.namedItem("mCals") as HTMLInputElement).value) || 0;
                      const prot = parseFloat((form.elements.namedItem("mProt") as HTMLInputElement).value) || 0;
                      const carb = parseFloat((form.elements.namedItem("mCarb") as HTMLInputElement).value) || 0;
                      const fatv = parseFloat((form.elements.namedItem("mFat") as HTMLInputElement).value) || 0;
                      const mult = parseFloat((form.elements.namedItem("mMult") as HTMLInputElement).value) || 1;
                      
                      if (name) {
                        handleLogFood(name, cals, prot, carb, fatv, "", mult);
                        setActiveAddModal(null);
                      }
                    }} className="flex flex-col gap-2 p-1">
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider">Food Name</label>
                        <input required name="mName" placeholder="e.g., Cooked White Rice" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl px-3 py-2 focus:outline-none focus:border-pink-300" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-0.5">
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider">Calories (kcal)</label>
                          <input type="number" required defaultValue="150" name="mCals" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl px-3 py-2 focus:outline-none focus:border-pink-300" />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[8px] font-mono text-[#6b6485] uppercase tracking-wider">Servings count</label>
                          <input type="number" step="0.25" required defaultValue="1" name="mMult" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl px-3 py-2 focus:outline-none focus:border-pink-300" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 mt-1 relative">
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[8.5px] font-mono text-indigo-300 uppercase block tracking-wider">Protein (g)</label>
                          <input type="number" step="0.1" defaultValue="4" name="mProt" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl px-3 py-2 focus:outline-none focus:border-pink-300" />
                        </div>
                        <div className="flex flex-col gap-1 text-left border-l border-[#211d35]/40 pl-1.5">
                          <label className="text-[8.5px] font-mono text-green-300 uppercase block tracking-wider">Carbs (g)</label>
                          <input type="number" step="0.1" defaultValue="30" name="mCarb" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl px-3 py-2 focus:outline-none focus:border-pink-300" />
                        </div>
                        <div className="flex flex-col gap-1 text-left border-l border-[#211d35]/40 pl-1.5">
                          <label className="text-[8.5px] font-mono text-amber-300 uppercase block tracking-wider">Fat (g)</label>
                          <input type="number" step="0.1" defaultValue="1" name="mFat" className="bg-[#17142a] border border-[#2a2440] text-xs font-mono text-[#e8e3f8] rounded-xl px-3 py-2 focus:outline-none focus:border-pink-300" />
                        </div>
                      </div>

                      <button type="submit" className="w-full mt-3 py-2.5 bg-[#fbcfe8] text-[#0d0b14] rounded-xl text-[10px] font-mono font-bold text-center hover:bg-[#f9a8d4] cursor-pointer active:scale-95 transition-transform uppercase tracking-wider">
                        Quick Add Manual Meal 🍎
                      </button>
                    </form>
                  )}

                  {/* DISPLAY TAB: 3. BARCODE SCAN */}
                  {foodTab === "scanner" && (
                    <div className="flex flex-col gap-3 text-center">
                      <div className="p-2.5 bg-[#0d0b14] rounded-xl border border-transparent">
                        <span className="text-[9.5px] font-mono text-[#9991b8] leading-tight block">Point camera viewfinder at any food product's barcode label. Detection is autonomous.</span>
                      </div>

                      {/* Viewfinder Target Container */}
                      <div 
                        id="applet-barcode-finder" 
                        className="w-full h-44 bg-black rounded-2xl border border-pink-500/20 overflow-hidden relative"
                      >
                        {isBarcodeScanning && (
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-pink-400 opacity-60 animate-pulse flex items-center justify-center font-mono text-[7px] text-pink-300 bg-pink-500/5 h-2">
                            <span>ALIGN BARCODE</span>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
                          <div className="w-44 h-32 border-2 border-dashed border-pink-300/30 rounded-lg" />
                        </div>
                        {!isBarcodeScanning && !scannedProductError && (
                          <div className="absolute inset-0 bg-[#0d0b14]/90 flex items-center justify-center">
                            <span className="font-mono text-[9px] text-[#6b6485]">Initializing lens...</span>
                          </div>
                        )}
                      </div>

                      {scannedProductError && (
                        <div className="p-2 bg-red-950/20 border border-red-500/10 rounded-xl">
                          <span className="text-[10px] font-mono font-bold text-red-400 block">{scannedProductError}</span>
                        </div>
                      )}

                      <button 
                        type="button" 
                        onClick={() => { setFoodTab("search"); }} 
                        className="w-full py-2 border border-[#221d35] rounded-xl text-[10px] font-mono text-[#6b6485] hover:text-white text-center cursor-pointer uppercase tracking-wider"
                      >
                        Select database text search 🔍
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Tabbar footer */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#0d0b14ee] border-t border-[#221d35] flex items-center justify-around backdrop-blur-xl z-40 max-w-md w-full mx-auto">
        {[
          { key: "home", label: "Home", icon: "🏠" },
          { key: "fitness", label: "Fitness", icon: "🏋️" },
          { key: "health", label: "Health", icon: "💊" },
          { key: "calendar", label: "Calendar", icon: "📅" }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              // Lock tab change if user is in middle of a training workout session
              if (activeWorkout) {
                if (confirm("Are you sure you want to pause your active workout views? You can return to resume it under Training tab later.")) {
                  setActiveTab(tab.key as any);
                }
              } else {
                setActiveTab(tab.key as any);
              }
            }}
            className={`flex flex-col items-center gap-1 font-mono text-[9px] uppercase tracking-wider h-full justify-center flex-1 cursor-pointer transition-colors ${
              activeTab === tab.key ? "text-[#f0c972]" : "text-[#3d3657] hover:text-[#9991b8]"
            }`}
            style={{
              borderTop: activeTab === tab.key ? "2px solid #f0c972" : "2px solid transparent"
            }}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
