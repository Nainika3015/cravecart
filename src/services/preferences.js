/* ============================================================
   CraveCart - preferences.js
   Per-account cooking preferences (Phase 2 onboarding).

   Stored in Local Storage next to the existing CraveCart data
   (cravecart_prefs_<userId>), falling back to a "guest" scope so
   the same helpers work before sign-in. Nothing is sent anywhere.
   ============================================================ */

const KEY_PREFIX = 'cravecart_prefs_';

import { ALLERGY_OPTIONS, normalizeAllergyList } from './allergens.js';

export const CUISINES = [
  'Indian', 'South Indian', 'Italian', 'Chinese', 'Mexican', 'American',
  'Thai', 'Japanese', 'Korean', 'Vietnamese', 'Mediterranean', 'Greek',
  'French', 'Spanish', 'Turkish', 'Lebanese', 'Middle Eastern', 'Moroccan',
  'African', 'Caribbean', 'Brazilian', 'British'
];

export const DIETS = ['Vegetarian', 'Vegan', 'Gluten Free', 'High Protein', 'Low Calorie'];

/* Allergen keys live in allergens.js so detection and preferences always
   agree. "Dairy"/"Gluten" were renamed to "Milk"/"Wheat"; answers saved
   before this change are migrated on read. */
export const ALLERGIES = ALLERGY_OPTIONS;

export const EXPERIENCES = ['Beginner', 'Intermediate', 'Advanced'];

export const EQUIPMENT = [
  'Stovetop', 'Oven', 'Microwave', 'Air fryer', 'Blender', 'Pressure cooker', 'Grill'
];

export const GOALS = [
  'Eat healthier', 'Cook faster', 'Reduce food waste',
  'Learn new cuisines', 'Cook for family', 'Save money'
];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'];

export const LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi',
  'Urdu', 'Spanish', 'French', 'Italian', 'Portuguese', 'German', 'Arabic',
  'Chinese', 'Japanese', 'Korean', 'Thai', 'Vietnamese', 'Indonesian', 'Turkish'
];

export const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Italy', 'France', 'Spain', 'Germany',
  'Mexico', 'Brazil', 'Canada', 'Australia', 'China', 'Japan', 'South Korea',
  'Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Singapore', 'Philippines',
  'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'United Arab Emirates',
  'Saudi Arabia', 'Turkey', 'Greece', 'Portugal', 'Netherlands', 'Poland',
  'Russia', 'Egypt', 'Morocco', 'Nigeria', 'Kenya', 'South Africa', 'Argentina',
  'Chile', 'Peru', 'New Zealand', 'Ireland', 'Sweden', 'Norway', 'Other'
];

export const DEFAULT_PREFERENCES = {
  name: '',
  country: '',
  language: 'English',
  cuisines: [],
  diets: [],
  allergies: [],
  experience: 'Intermediate',
  maxTime: 45,
  servings: 2,
  budget: '',
  currency: 'INR',
  equipment: [],
  goals: [],
  customAvoid: [],
  assumeStaples: false,
  hideAllergens: true,
  strictAllergens: false,
  onboarded: false,
  updatedAt: null
};

function scopeKey(userId) {
  return KEY_PREFIX + (userId || 'guest');
}

export function getPreferences(userId) {
  try {
    const raw = localStorage.getItem(scopeKey(userId));
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_PREFERENCES };
    return {
      ...DEFAULT_PREFERENCES,
      ...stored,
      allergies: normalizeAllergyList(stored.allergies),
      customAvoid: Array.isArray(stored.customAvoid) ? stored.customAvoid.filter(Boolean) : [],
      assumeStaples: !!stored.assumeStaples
    };
  } catch (e) {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(userId, patch) {
  const next = {
    ...getPreferences(userId),
    ...patch,
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(scopeKey(userId), JSON.stringify(next));
  } catch (e) {
    /* storage full / disabled — preferences stay session-only */
  }
  return next;
}

export function resetPreferences(userId) {
  try {
    localStorage.removeItem(scopeKey(userId));
  } catch (e) {
    /* ignore */
  }
}

/* True once the user finished (or explicitly saved) onboarding. */
export function isPersonalized(prefs) {
  return !!(prefs && prefs.onboarded);
}

/* Short human-readable chips used on Profile and the Home welcome strip. */
export function preferencesSummary(prefs) {
  if (!prefs) return [];
  const chips = [];
  if (prefs.cuisines && prefs.cuisines.length) chips.push(prefs.cuisines.slice(0, 2).join(' · '));
  if (prefs.diets && prefs.diets.length) chips.push(prefs.diets.join(' · '));
  if (prefs.experience) chips.push(prefs.experience);
  if (prefs.maxTime) chips.push('≤ ' + prefs.maxTime + ' min');
  if (prefs.servings) chips.push(prefs.servings + ' serving' + (Number(prefs.servings) === 1 ? '' : 's'));
  if (prefs.allergies && prefs.allergies.length) chips.push('Avoids: ' + prefs.allergies.join(', '));
  if (prefs.customAvoid && prefs.customAvoid.length) chips.push('Avoids: ' + prefs.customAvoid.join(', '));
  if (prefs.assumeStaples) chips.push('Assumes pantry staples');
  return chips;
}
