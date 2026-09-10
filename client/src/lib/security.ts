// Advanced Backend/Client Security & Anti-Bot Utility (Silent & Invisible)

export function initPageLoadTimer(): void {
  if (typeof window !== 'undefined' && !sessionStorage.getItem("bcare_page_load_time")) {
    sessionStorage.setItem("bcare_page_load_time", Date.now().toString());
  }
}

// 1. Time-based Honeypot: Reject if submission happens in less than 10 seconds
export function validateTimeHoneypot(): boolean {
  if (typeof window === 'undefined') return true;
  const loadTimeStr = sessionStorage.getItem("bcare_page_load_time");
  if (!loadTimeStr) {
    // If no load time recorded, set it now and allow with slight warning or block
    sessionStorage.setItem("bcare_page_load_time", Date.now().toString());
    return true; // Allow first interaction if session restored, or require 10s
  }
  const loadTime = parseInt(loadTimeStr, 10);
  const elapsed = Date.now() - loadTime;
  // 10,000 milliseconds = 10 seconds
  if (elapsed < 10000) {
    console.warn("[Security] Time-based honeypot triggered: form submitted too fast (< 10s)");
    return false;
  }
  return true;
}

export function getOrCreateSessionNonce(): string {
  let nonce = sessionStorage.getItem("bcare_security_nonce")
  if (!nonce) {
    nonce = "nonce_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem("bcare_security_nonce", nonce)
  }
  return nonce
}

export function validateSessionNonce(nonce: string | null): boolean {
  if (!nonce) return false
  const activeNonce = sessionStorage.getItem("bcare_security_nonce")
  return activeNonce === nonce
}

// 2. Browser Fingerprinting (Canvas & WebGL check)
export function verifyBrowserFingerprint(): boolean {
  try {
    const nav = window.navigator;
    if (nav.webdriver === true) return false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillText("QIC Security Check", 2, 2);
    const dataUrl = canvas.toDataURL();
    if (!dataUrl || dataUrl.length < 50) return false;

    return true;
  } catch {
    return true;
  }
}

// 3. Advanced Rate Limiting (Max submissions per minute)
export function checkAdvancedRateLimit(): boolean {
  const now = Date.now();
  const rawLog = localStorage.getItem("bcare_submission_log");
  let timestamps: number[] = rawLog ? JSON.parse(rawLog) : [];

  timestamps = timestamps.filter(t => now - t < 60000);

  if (timestamps.length >= 5) {
    return false;
  }

  timestamps.push(now);
  localStorage.setItem("bcare_submission_log", JSON.stringify(timestamps));
  return true;
}

// 4. Header & Environment Guard
export function verifyHeaderGuard(): boolean {
  const ua = navigator.userAgent;
  if (!ua || ua.length < 10) return false;
  const lowerUa = ua.toLowerCase();
  if (lowerUa.includes("python") || lowerUa.includes("curl") || lowerUa.includes("wget") || (lowerUa.includes("bot") && !lowerUa.includes("google"))) {
    return false;
  }
  return true;
}

// 5. Strict Algorithm Validation for Saudi ID / Iqama
export function validateSaudiID(id: string): boolean {
  const clean = id.replace(/\s/g, "");
  if (!/^\d{10}$/.test(clean)) return false;
  const firstDigit = clean[0];
  // Saudi ID starts with '1', Iqama starts with '2'
  if (firstDigit !== '1' && firstDigit !== '2') return false;

  // Luhn-like checksum for Saudi ID/Iqama
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let num = parseInt(clean[i], 10);
    if (i % 2 === 0) {
      num *= 2;
      if (num > 9) {
        num = Math.floor(num / 10) + (num % 10);
      }
    }
    sum += num;
  }
  return sum % 10 === 0;
}
