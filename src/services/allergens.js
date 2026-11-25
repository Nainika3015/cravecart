/* ============================================================
   CraveCart - allergens.js
   Allergen detection is deliberately SEPARATE from ingredient
   equivalence (ingredients.js): "whey" counts as a milk allergen,
   but it is not an equivalent ingredient for "milk" in a recipe.

   Results are always phrased as "detected / not identified /
   information incomplete" — never "allergen-free".
   ============================================================ */

import { normalizeIngredient } from './ingredients.js';

export const ALLERGY_OPTIONS = [
  'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Sesame'
];

/* Older saved preferences used "Dairy" and "Gluten". */
const LEGACY_KEYS = { Dairy: 'Milk', Gluten: 'Wheat' };

export function normalizeAllergyKey(label) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const legacy = LEGACY_KEYS[raw];
  if (legacy) return legacy;
  const hit = ALLERGY_OPTIONS.find((a) => a.toLowerCase() === raw.toLowerCase());
  return hit || raw;
}

export function normalizeAllergyList(list) {
  return [...new Set((list || []).map(normalizeAllergyKey).filter(Boolean))];
}

/* Curated allergen → derivative keywords. Multi-word keys are handled
   token-by-token after normalization. */
const ALLERGEN_KEYWORDS = {
  Peanuts: ['peanut', 'groundnut', 'arachis'],
  'Tree nuts': ['almond', 'cashew', 'walnut', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'pine', 'praline', 'marzipan', 'chestnut', 'brazil'],
  Milk: ['milk', 'butter', 'cheese', 'cream', 'whey', 'casein', 'lactose', 'yogurt', 'ghee', 'paneer', 'khoya', 'mozzarella', 'parmesan', 'buttermilk', 'mascarpone', 'ricotta', 'custard'],
  Eggs: ['egg', 'mayonnaise', 'mayo', 'aioli', 'meringue', 'albumin'],
  Wheat: ['wheat', 'flour', 'semolina', 'rava', 'sooji', 'bread', 'breadcrumb', 'pasta', 'noodle', 'couscous', 'bulgur', 'durum', 'spelt', 'maida', 'atta', 'seitan', 'rusk', 'cracker'],
  Soy: ['soy', 'soya', 'tofu', 'edamame', 'miso', 'tempeh', 'tamari'],
  Fish: ['fish', 'salmon', 'tuna', 'cod', 'anchovy', 'sardine', 'mackerel', 'tilapia', 'bass', 'trout', 'worcestershire'],
  Shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'oyster', 'squid', 'calamari', 'scallop', 'crayfish'],
  Sesame: ['sesame', 'tahini', 'benne', 'gomasio']
};

const PLANT_MILKS = ['coconut', 'almond', 'soy', 'oat', 'rice', 'cashew', 'hemp', 'pea'];
const PLANT_BUTTERS = ['peanut', 'almond', 'cashew', 'cocoa', 'shea', 'sunflower', 'soy'];
const GLUTEN_FREE_FLOURS = ['rice', 'corn', 'chickpea', 'almond', 'coconut', 'tapioca', 'buckwheat', 'millet', 'sorghum', 'potato'];

function isException(norm, keyword, allergen) {
  const words = norm.split(' ');
  if (allergen === 'Milk') {
    if (['milk', 'cream', 'yogurt'].includes(keyword) && PLANT_MILKS.some((p) => words.includes(p))) return true;
    if (keyword === 'butter' && PLANT_BUTTERS.some((p) => words.includes(p))) return true;
    if (norm.includes('dairy free') || norm.includes('non dairy') || norm.includes('vegan')) return true;
  }
  if (allergen === 'Wheat') {
    if (norm.includes('gluten free') || norm.includes('glutenfree')) return true;
    if (['flour', 'bread', 'cracker', 'noodle', 'pasta'].includes(keyword) &&
        GLUTEN_FREE_FLOURS.some((f) => words.includes(f))) return true;
  }
  return false;
}

/* Does one ingredient name contain this allergen (including derivatives)? */
export function ingredientHasAllergen(ingredientName, allergen) {
  const key = normalizeAllergyKey(allergen);
  const keywords = ALLERGEN_KEYWORDS[key];
  if (!keywords) return false;
  const norm = normalizeIngredient(ingredientName);
  if (!norm) return false;
  const words = norm.split(' ');
  return keywords.some((kw) => words.includes(kw) && !isException(norm, kw, key));
}

function ingredientMatchesCustomAvoid(ingredientName, avoidTerm) {
  const ing = normalizeIngredient(ingredientName);
  const avoid = normalizeIngredient(avoidTerm);
  if (!ing || !avoid) return false;
  if (ing === avoid) return true;
  const avoidWords = avoid.split(' ');
  const ingWords = ing.split(' ');
  return avoidWords.every((w) => ingWords.includes(w));
}

/**
 * Allergen status for one recipe.
 * status: 'not-configured' | 'detected' | 'clear' | 'incomplete'
 */
export function detectAllergens(recipe, { allergies = [], customAvoid = [] } = {}) {
  const allergyList = normalizeAllergyList(allergies);
  const custom = (customAvoid || []).map((s) => String(s || '').trim()).filter(Boolean);
  const ingredients = (recipe && recipe.ingredients) || [];

  if (!allergyList.length && !custom.length) {
    return { status: 'not-configured', hits: [], incomplete: false };
  }
  if (!ingredients.length) {
    return { status: 'incomplete', hits: [], incomplete: true };
  }

  const hits = [];
  ingredients.forEach((ing) => {
    const name = typeof ing === 'string' ? ing : ing.name;
    if (!name) return;
    allergyList.forEach((allergen) => {
      if (ingredientHasAllergen(name, allergen)) hits.push({ allergen, ingredient: String(name) });
    });
    custom.forEach((term) => {
      if (ingredientMatchesCustomAvoid(name, term)) hits.push({ allergen: 'Custom: ' + term, ingredient: String(name) });
    });
  });

  return { status: hits.length ? 'detected' : 'clear', hits, incomplete: false };
}

/* Is this recipe hidden by the user's allergy settings? */
export function isHiddenByAllergens(status, { hideDetected = true, strict = false } = {}) {
  if (status === 'detected') return hideDetected;
  if (status === 'incomplete') return strict;
  return false;
}

export function allergenStatusLabel(status) {
  if (status === 'detected') return 'Selected allergen detected';
  if (status === 'clear') return 'No selected allergen identified in listed ingredients';
  if (status === 'incomplete') return 'Allergen information incomplete';
  return 'No allergy preferences set';
}

export const ALLERGEN_DISCLAIMER =
  'Allergen checks use the ingredient names in the recipe only. Ingredient lists can be incomplete, ' +
  'and packaged foods may contain unlisted allergens or cross-contamination. Always check the product label ' +
  'and ask about shared kitchens when a reaction could be serious.';
