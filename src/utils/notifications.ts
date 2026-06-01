/**
 * Notification management utility for the Life Dashboard
 * Supports requesting permissions, triggering native local notifications,
 * and caching sent notifications to prevent duplicate alerts.
 */

// Key schema: notified_[YYYY-MM-DD]_[suppId]_[slotKey]
const NOTIFIED_STORE_PREFIX = "life_dash_supplement_notified_";

export function getPermissionStatus(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return false;
  }
}

interface NotificationOptions {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string; // prevents duplicate notifications with the same ID
  vibrate?: number[];
  requireInteraction?: boolean;
  data?: any;
}

export async function sendLocalNotification(title: string, options: NotificationOptions): Promise<boolean> {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    console.warn("Notifications are not allowed or supported.");
    return false;
  }

  // Set default aesthetic assets if not provided
  const notificationOptions: NotificationOptions = {
    icon: "/favicon.png",
    badge: "/apple-touch-icon.png",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    ...options,
  };

  try {
    // 1. Try to send via Service Worker registration to enable background dispatch
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && "showNotification" in registration) {
        await (registration as any).showNotification(title, {
          body: notificationOptions.body,
          icon: notificationOptions.icon,
          badge: notificationOptions.badge,
          tag: notificationOptions.tag,
          vibrate: notificationOptions.vibrate,
          requireInteraction: notificationOptions.requireInteraction,
          data: notificationOptions.data,
        });
        return true;
      }
    }

    // 2. Fall back to the standard browser Notification constructor
    new Notification(title, {
      body: notificationOptions.body,
      icon: notificationOptions.icon,
      badge: notificationOptions.badge,
      tag: notificationOptions.tag,
    } as any);
    return true;
  } catch (err) {
    console.error("Failed to show local notification:", err);
    return false;
  }
}

/**
 * Checks if a specific supplement slot has already triggered an alert for a specific date
 */
export function hasBeenNotified(dateKey: string, suppId: string, slotKey: string): boolean {
  const key = `${NOTIFIED_STORE_PREFIX}${dateKey}_${suppId}_${slotKey}`;
  return localStorage.getItem(key) === "true";
}

/**
 * Marks a specific supplement slot as notified for today
 */
export function markAsNotified(dateKey: string, suppId: string, slotKey: string): void {
  const key = `${NOTIFIED_STORE_PREFIX}${dateKey}_${suppId}_${slotKey}`;
  localStorage.setItem(key, "true");
}

/**
 * Clears old keys so localStorage doesn't bloat endlessly
 */
export function pruneNotificationCache(currentDateKey: string): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(NOTIFIED_STORE_PREFIX)) {
        // If the key is not for today, prune it
        if (!key.includes(currentDateKey)) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.error("Failed to prune notification cache", e);
  }
}
