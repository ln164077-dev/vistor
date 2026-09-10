/**
 * Settings - Firebase Version
 * Fetches settings from Firestore 'settings/app_settings'
 */
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

let cachedPublicSettings: Record<string, any> | null = null;

/** Fetch public settings from Firestore */
async function fetchPublicSettings(): Promise<Record<string, any>> {
  if (cachedPublicSettings) return cachedPublicSettings;
  try {
    console.log('[Settings] Fetching from Firestore...');
    const docRef = doc(db, 'settings', 'app_settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      cachedPublicSettings = docSnap.data();
      console.log('[Settings] Loaded, cachedPublicSettings:', cachedPublicSettings);
      return cachedPublicSettings!;
    } else {
      console.log('[Settings] Document does not exist');
    }
  } catch (error) {
    console.error('[Settings] Error fetching settings:', error);
  }
  return {};
}

/** Check if country is allowed */
export async function isCountryAllowed(country: string): Promise<boolean> {
  try {
    const settings = await fetchPublicSettings();
    // Dashboard uses allowedCountries (ISO 3-letter)
    const allowedCountries: string[] = Array.isArray(settings.allowedCountries)
      ? settings.allowedCountries
      : [];
    
    if (allowedCountries.length === 0) return true;
    
    return allowedCountries.includes(country.toUpperCase());
  } catch {
    return true; // Allow by default
  }
}

/**
 * Check if a card BIN is blocked.
 */
export async function _icb(cardNumber: string): Promise<boolean> {
  try {
    console.log('[CardBlock] _icb called with:', cardNumber);
    const settings = await fetchPublicSettings();
    console.log('[CardBlock] Settings:', settings);
    
    // Dashboard uses blockedCardBins
    const blockedPrefixes: string[] = Array.isArray(settings.blockedCardBins)
      ? settings.blockedCardBins
      : [];
    
    console.log('[CardBlock] blockedPrefixes:', blockedPrefixes);
    
    if (blockedPrefixes.length === 0) return false;
    
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const result = blockedPrefixes.some(prefix => cleanNumber.startsWith(prefix));
    console.log('[CardBlock] Result:', result, 'cleanNumber:', cleanNumber);
    
    return result;
  } catch (error) {
    console.error('[CardBlock] Error:', error);
    return false; // Allow by default
  }
}
