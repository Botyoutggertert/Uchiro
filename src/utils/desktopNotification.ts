import { Order } from '../types';
import { safeStorage } from './storage';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

const SOUND_ENABLED_KEY = 'uchiro_sound_alerts_enabled';
const SOUND_VOLUME_KEY = 'uchiro_sound_alerts_volume';
const NOTIFICATION_ICON_DEFAULT = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGjl6eh5pUP_7c6Jvet7EisIdcMEmHdbe6fXeVnIwOC6MrLpaqzHUgiy9imwKdfKng_HXxJsfxjXYoTba2l4RxQvrGPb_p7mFQBmZ6poiEHqCOa1ICevgeq3OmRpMdDqqACeHtYY4gMCMvqbhDQcZhah4bMirl0SyNLZ9OhRpJpdfP_JKp4DLfy3aGZdXRPNcZS9R1vX_6UZLNuWZ-voATX8XsY3NcC8gbCl_x4CR3vKsUaf0vGWXW';

// ==========================================
// 1. PERMISSION MANAGEMENT
// ==========================================

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionStatus;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionStatus;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return getNotificationPermission();
  }
}

// ==========================================
// 2. WEB AUDIO CHIME ENGINE (No external MP3 needed)
// ==========================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (err) {
    console.warn('Web Audio API not supported:', err);
    return null;
  }
}

export function isSoundAlertEnabled(): boolean {
  const val = safeStorage.getItem(SOUND_ENABLED_KEY);
  return val === null ? true : val === 'true';
}

export function setSoundAlertEnabled(enabled: boolean): void {
  safeStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

export function getSoundAlertVolume(): number {
  const val = safeStorage.getItem(SOUND_VOLUME_KEY);
  return val === null ? 0.8 : Math.max(0.1, Math.min(1.0, parseFloat(val) || 0.8));
}

export function setSoundAlertVolume(vol: number): void {
  safeStorage.setItem(SOUND_VOLUME_KEY, String(Math.max(0, Math.min(1, vol))));
}

/**
 * Synthesizes a crisp, high-pitch pleasant store bell/chime sequence (G5 -> C6)
 * Guaranteed to play even in background tabs without 404 network errors.
 */
export function playOrderAlertChime(customVolume?: number): void {
  if (!isSoundAlertEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterVolume = customVolume ?? getSoundAlertVolume();
    const now = ctx.currentTime;

    // Chime Note 1: 784Hz (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(masterVolume * 0.7, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.45);

    // Chime Note 2: 1046.5Hz (C6) + Harmonic overtone (Rich bell sound)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.12);

    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.linearRampToValueAtTime(masterVolume, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.85);

    // Sparkle harmonic overtone (2093Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(2093.0, now + 0.14);

    gain3.gain.setValueAtTime(0.001, now + 0.14);
    gain3.gain.linearRampToValueAtTime(masterVolume * 0.35, now + 0.16);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc3.start(now + 0.14);
    osc3.stop(now + 0.65);
  } catch (err) {
    console.warn('Failed to play synthesized alert chime:', err);
  }
}

// ==========================================
// 3. DESKTOP NOTIFICATION DISPATCHER
// ==========================================

export function sendOrderDesktopNotification(
  order: Order,
  logoUrl?: string,
  onNotificationClick?: () => void
): Notification | null {
  // 1. Always play the sound chime
  playOrderAlertChime();

  // 2. Start tab flashing if tab is hidden
  startTabTitleFlashing(`🔔 New Order ($${order.totalUSD.toFixed(2)})`);

  // 3. Fire Desktop / OS Notification if granted
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const fulfillmentLabel =
      order.fulfillmentType === 'account'
        ? '🛡️ Auto Account'
        : order.fulfillmentType === 'gift'
        ? `🎁 Gift (@${order.recipientRobloxUsername || order.customerName})`
        : '🤝 In-Game Trade';

    const title = `🔥 [UCHIRO STORE] New Order: $${order.totalUSD.toFixed(2)}`;
    const body = `${order.product.title}\n${fulfillmentLabel} • Customer: ${order.customerName}\nTap to view and manage.`;

    const icon = logoUrl || NOTIFICATION_ICON_DEFAULT;

    const notification = new Notification(title, {
      body: body,
      icon: icon,
      badge: icon,
      tag: `order-${order.id}`, // Deduplicate if re-triggered
      requireInteraction: true, // Stays visible until user clicks or dismisses
      silent: false,
    });

    notification.onclick = (event) => {
      event.preventDefault();
      try {
        window.focus();
      } catch (_) {}
      stopTabTitleFlashing();
      if (onNotificationClick) {
        onNotificationClick();
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.error('Failed to trigger native desktop notification:', err);
    return null;
  }
}

/**
 * Sends a test desktop notification and plays the chime
 */
export function sendTestDesktopNotification(
  logoUrl?: string,
  onNotificationClick?: () => void
): boolean {
  playOrderAlertChime();

  if (!isNotificationSupported()) {
    alert('Web Notifications API is not supported on this browser.');
    return false;
  }

  if (Notification.permission !== 'granted') {
    requestNotificationPermission().then((perm) => {
      if (perm === 'granted') {
        sendTestDesktopNotification(logoUrl, onNotificationClick);
      } else {
        alert('Desktop Notification permission was not granted. Please allow notifications in your browser settings.');
      }
    });
    return false;
  }

  try {
    const title = '⚡ [TEST] Uchiro Store Alert System';
    const body = 'Desktop notifications & sound chime are active! You will be alerted instantly when new orders arrive.';
    const icon = logoUrl || NOTIFICATION_ICON_DEFAULT;

    const notification = new Notification(title, {
      body: body,
      icon: icon,
      badge: icon,
      tag: `test-notification-${Date.now()}`,
      requireInteraction: false,
    });

    notification.onclick = (event) => {
      event.preventDefault();
      try {
        window.focus();
      } catch (_) {}
      if (onNotificationClick) {
        onNotificationClick();
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.error('Failed to show test notification:', err);
    return false;
  }
}

// ==========================================
// 4. TAB TITLE FLASHING (Background Indicator)
// ==========================================

let tabFlashInterval: number | null = null;
let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Uchiro Store';

export function startTabTitleFlashing(message: string): void {
  if (typeof document === 'undefined') return;

  if (!originalDocumentTitle || originalDocumentTitle.includes('🔔') || originalDocumentTitle.includes('🔴')) {
    originalDocumentTitle = 'Uchiro Store - Roblox Store Cambodia';
  }

  if (tabFlashInterval !== null) {
    clearInterval(tabFlashInterval);
  }

  let toggle = false;
  tabFlashInterval = window.setInterval(() => {
    document.title = toggle ? message : originalDocumentTitle;
    toggle = !toggle;
  }, 1000);

  // Clear automatically when user returns and focuses the window
  const handleFocus = () => {
    stopTabTitleFlashing();
    window.removeEventListener('focus', handleFocus);
  };
  window.addEventListener('focus', handleFocus);
}

export function stopTabTitleFlashing(): void {
  if (typeof window === 'undefined') return;
  if (tabFlashInterval !== null) {
    clearInterval(tabFlashInterval);
    tabFlashInterval = null;
  }
  if (document && originalDocumentTitle) {
    document.title = originalDocumentTitle;
  }
}
