/* ============================================================
   CraveCart - recommendations.js
   Deterministic recommendation + pantry-matching engine.

   Everything is derived from real data already in the app:
   recipe ingredient lists, prep/cook times, categories, cuisines,
   saved recipes, recently viewed recipes and the user's pantry.
   Nothing here invents prices, nutrition, times or ratings.

   Match Percentage = confirmed required ingredients / total unique
   required ingredients x 100. Only EXACT and VERIFIED EQUIVALENT
   pantry items count. Processed products ("tomato ketchup" for
   "tomato") are reported as related, never counted.

   Optional "assume pantry staples" is tracked separately and never
   inflates the headline percentage.
   ============================================================ */

import {
  normalizeIngredient, classifyMatch, countsAsAvailable, cuisineMatches,
  deriveEquipment, splitCompoundIngredient
} from './ingredients.js';
import { detectAllergens } from './allergens.js';
import { getSubstitutionsFor } from './substitutions.js';

const isKnown = (v) => v !== null && v !== undefined && v !== '';

/* Pantry staples users may optionally assume they own. */
export const PANTRY_STAPLES = ['salt', 'water', 'oil', 'sugar', 'pepper'];

export function isPantryStaple(name) {
  const norm = normalizeIngredient(name);
  if (!norm) return false;
  if (PANTRY_STAPLES.includes(norm)) return true;
  const words = norm.split(' ');
  return words.length === 1 && PANTRY_STAPLES.includes(words[0]);
}

export function totalTime(recipe) {
  if (!recipe) return null;
  const hasPrep = isKnown(recipe.prepTime);
  const hasCook = isKnown(recipe.cookTime);
  if (!hasPrep && !hasCook) return null;
  return (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0);
}

function amountOf(ingredient) {
  if (!ingredient || typeof ingredient === 'string') return '';
  const amount = ingredient.amount ?? ingredient.quantity ?? '';
  const unit = ingredient.unit || '';
  if (!isKnown(amount) || amount === '') return unit ? String(unit) : '';
  return (String(amount) + (unit ? ' ' + unit : '')).trim();
}

/**
 * Required ingredients as { name, amount }, de-duplicated by canonical
 * name, with compound lines ("Capsicum & onion") split into separate
 * requirements so nothing is over-counted as one match.
 */
export function requiredRequirements(recipe) {
  const seen = new Set();
  const out = [];
  (recipe.ingredients || []).forEach((ing) => {
    const raw = typeof ing === 'string' ? ing : ing.name;
    const amount = amountOf(ing);
    splitCompoundIngredient(raw).forEach((part) => {
      const norm = normalizeIngredient(part);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      out.push({ name: part, amount });
    });
  });
  return out;
}

/* Backwards-compatible helper: just the names. */
export function requiredIngredients(recipe) {
  return requiredRequirements(recipe).map((r) => r.name);
}

function findPantryHit(requirement, pantryItems) {
  let equivalent = null;
  for (const item of pantryItems) {
    const level = classifyMatch(requirement.name, item.name);
    if (level === 'exact') return { item, level };
    if (level === 'equivalent' && !equivalent) equivalent = { item, level };
  }
  return equivalent;
}

function findRelated(requirement, pantryItems) {
  for (const item of pantryItems) {
    if (classifyMatch(requirement.name, item.name) === 'related') return item;
  }
  return null;
}

/**
 * Compare one recipe against the pantry.
 * pantryItems should come from decoratePantry() so `expired`/`status` exist.
 */
export function matchRecipe(recipe, pantryItems = [], prefs = {}) {
  const requirements = requiredRequirements(recipe);
  if (!requirements.length) {
    return {
      hasData: false, total: 0, percentage: 0, percentageWithStaples: 0,
      confirmed: [], assumed: [], missing: [], related: [],
      matched: [], missingNames: [], expiringUsed: [], expiredMatches: [], substitutions: []
    };
  }

  const usable = pantryItems.filter((p) => !p.expired && p.status !== 'expired');
  const expired = pantryItems.filter((p) => p.expired || p.status === 'expired');

  const confirmed = [];
  const assumed = [];
  const missing = [];
  const related = [];
  const expiringUsed = [];
  const expiredMatches = [];

  requirements.forEach((req) => {
    const hit = findPantryHit(req, usable);
    if (hit) {
      confirmed.push({ ...req, pantryName: hit.item.name, level: hit.level });
      if (hit.item.status === 'soon') expiringUsed.push({ name: hit.item.name, days: hit.item.days });
      return;
    }
    const relatedItem = findRelated(req, usable);
    if (relatedItem) related.push({ ...req, pantryName: relatedItem.name });
    if (prefs.assumeStaples && isPantryStaple(req.name)) {
      assumed.push(req);
      return;
    }
    missing.push(req);
    const stale = findPantryHit(req, expired);
    if (stale) expiredMatches.push(stale.item.name);
  });

  const total = requirements.length;
  const percentage = Math.round((confirmed.length / total) * 100);
  const percentageWithStaples = Math.round(((confirmed.length + assumed.length) / total) * 100);

  const ctx = {
    allergies: prefs.allergies || [],
    customAvoid: prefs.customAvoid || [],
    diets: prefs.diets || [],
    pantryNames: usable.map((p) => p.name),
    cuisine: recipe.cuisine || '',
    country: prefs.country || ''
  };
  const substitutions = missing
    .map((req) => ({ ingredient: req.name, amount: req.amount, options: getSubstitutionsFor(req.name, ctx) }))
    .filter((entry) => entry.options.length)
    .slice(0, 4);

  return {
    hasData: true,
    total,
    confirmed,
    assumed,
    missing,
    related,
    percentage,
    percentageWithStaples,
    matched: confirmed.map((c) => c.name),
    missingNames: missing.map((m) => m.name),
    missingCount: missing.length,
    expiringUsed,
    expiredMatches,
    substitutions
  };
}

/** Dietary compatibility of one recipe with the saved diets. */
export function dietCompatibility(recipe, prefs = {}) {
  const diets = prefs.diets || [];
  if (!diets.length) return { status: 'none', label: 'No diet preference set' };
  const dp = recipe.dietaryPreference;
  if (!dp) return { status: 'unknown', label: 'Diet information not provided by the source' };
  if (diets.includes(dp)) return { status: 'matches', label: `Matches your ${dp.toLowerCase()} preference` };
  if (diets.includes('Vegan') && dp === 'Vegetarian') {
    return { status: 'conflict', label: 'Vegetarian but not vegan' };
  }
  return { status: 'conflict', label: `Source lists this as ${dp}` };
}

function makeContext({ prefs, pantry, savedRecipes, ratings }) {
  const decorated = pantry || [];
  const usable = decorated.filter((p) => !p.expired && p.status !== 'expired');
  return {
    prefs: prefs || {},
    pantry: decorated,
    usable,
    savedCuisines: new Set((savedRecipes || []).map((r) => r.cuisine).filter(Boolean)),
    savedCategories: new Set((savedRecipes || []).map((r) => r.category).filter(Boolean)),
    ratings: ratings || {}
  };
}

function ratingOf(recipe, ctx) {
  return ctx.ratings[recipe.id] || { avg: 0, count: 0 };
}

/**
 * Score one recipe and explain why. Returns:
 * { recipe, score, reasons[], warnings[], match, allergenStatus, diet, excluded, excludeReason }
 */
export function evaluateRecipe(recipe, ctx) {
  const prefs = ctx.prefs || {};
  const diets = prefs.diets || [];
  const allergies = prefs.allergies || [];
  const customAvoid = prefs.customAvoid || [];
  const goals = prefs.goals || [];
  const experience = prefs.experience || '';
  const maxTime = Number(prefs.maxTime) || 0;

  const allergen = detectAllergens(recipe, { allergies, customAvoid });
  const diet = dietCompatibility(recipe, prefs);

  /* -------- hard exclusions: known incompatibilities only -------- */
  if (diets.indexOf('Vegan') !== -1 && recipe.dietaryPreference && recipe.dietaryPreference !== 'Vegan') {
    return { recipe, score: 0, reasons: [], warnings: [], match: null, allergenStatus: allergen.status, diet, excluded: true, excludeReason: 'Not vegan' };
  }
  if (diets.indexOf('Vegetarian') !== -1 && recipe.dietaryPreference === 'Non-Vegetarian') {
    return { recipe, score: 0, reasons: [], warnings: [], match: null, allergenStatus: allergen.status, diet, excluded: true, excludeReason: 'Contains meat or fish' };
  }
  if (allergen.hits.length) {
    const names = [...new Set(allergen.hits.map((h) => h.allergen))];
    return {
      recipe, score: 0, reasons: [], warnings: [], match: null, allergenStatus: allergen.status, diet, excluded: true,
      excludeReason: 'Contains ' + names.join(', ').toLowerCase()
    };
  }

  const match = matchRecipe(recipe, ctx.pantry, prefs);
  const reasons = [];
  const warnings = [];
  let score = 0;
  const time = totalTime(recipe);
  const dp = recipe.dietaryPreference;

  /* -------- pantry coverage (confirmed ingredients only) -------- */
  if (match.hasData && ctx.usable.length >= 2) {
    score += match.percentage * 0.6;
    if (match.percentage >= 60) {
      reasons.push(`You already have ${match.percentage}% of the ingredients`);
    } else if (match.percentage >= 35) {
      reasons.push(`You have most ingredients (${match.percentage}%)`);
    }
  }
  if (match && match.expiringUsed.length) {
    const first = match.expiringUsed[0];
    reasons.push(`Uses your ${first.name.toLowerCase()} before it expires`);
    score += 8;
  }

  /* -------- cuisine affinity -------- */
  const matchingCuisine = (prefs.cuisines || []).find((fav) => cuisineMatches(recipe.cuisine, [fav]));
  if (matchingCuisine) {
    score += 22;
    reasons.push(`Recommended because you like ${matchingCuisine} cuisine`);
  }

  /* -------- diet -------- */
  if (dp && diets.indexOf(dp) !== -1) {
    score += 10;
    reasons.push(`Matches your ${dp.toLowerCase()} preference`);
  }

  /* -------- saved similarity -------- */
  if (ctx.savedCuisines.has(recipe.cuisine) || ctx.savedCategories.has(recipe.category)) {
    score += 8;
    reasons.push('Similar to recipes you saved');
  }

  /* -------- cooking experience -------- */
  if (experience === 'Beginner') {
    if (recipe.difficulty === 'Easy') { score += 7; reasons.push('Easy — suits your cooking level'); }
    if (recipe.difficulty === 'Hard') score -= 9;
  } else if (experience === 'Advanced' && recipe.difficulty === 'Hard') {
    score += 4;
  }

  /* -------- cooking time -------- */
  if (time !== null) {
    if (maxTime && time <= maxTime) {
      score += 12;
      reasons.push(`Ready in ${time} min — within your ${maxTime} min limit`);
    } else if (maxTime && time > maxTime * 1.5) {
      score -= 10;
    }
  }

  /* -------- goals -------- */
  const ingredientCount = (recipe.ingredients || []).length;
  if (goals.indexOf('Cook faster') !== -1 && time !== null && time <= 30) score += 6;
  if (goals.indexOf('Reduce food waste') !== -1 && match && match.expiringUsed.length) score += 10;
  if (goals.indexOf('Eat healthier') !== -1 &&
      (dp === 'Vegetarian' || dp === 'Vegan' || dp === 'Low Calorie' ||
       recipe.category === 'Healthy' || (recipe.tags || []).some((t) => /healthy|light|salad/i.test(t)))) {
    score += 6;
  }
  if (goals.indexOf('Cook for family') !== -1 && Number(recipe.servings) >= Math.max(Number(prefs.servings) || 2, 2)) {
    score += 5;
  }
  if (goals.indexOf('Save money') !== -1 && ingredientCount > 0 && ingredientCount <= 8) score += 6;
  if (goals.indexOf('Learn new cuisines') !== -1 && !cuisineMatches(recipe.cuisine, prefs.cuisines || [])) score += 4;

  /* -------- equipment: soft nudge only, derived from instructions -------- */
  const equipment = prefs.equipment || [];
  if (equipment.length) {
    const needs = deriveEquipment(recipe);
    const missingEquipment = needs.filter((need) => equipment.indexOf(need) === -1);
    score -= missingEquipment.length * 3;
  }

  /* -------- community rating -------- */
  const rating = ratingOf(recipe, ctx);
  score += rating.avg * 2;

  /* -------- honesty notes -------- */
  if ((allergies.length || customAvoid.length) && allergen.status === 'incomplete') {
    warnings.push('Allergen information not provided by the source — check before cooking');
  }
  if (allergen.status === 'clear') {
    warnings.push('No selected allergen identified in the listed ingredients — not a guarantee');
  }
  if (diets.length && !dp) {
    warnings.push('Diet information not specified by the source');
  }

  return {
    recipe, score, reasons: reasons.slice(0, 3), warnings, match,
    allergenStatus: allergen.status, allergenHits: allergen.hits, diet,
    excluded: false, excludeReason: ''
  };
}

function sortEvaluated(list, ctx) {
  return list.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ra = ratingOf(a.recipe, ctx);
    const rb = ratingOf(b.recipe, ctx);
    if (rb.avg !== ra.avg) return rb.avg - ra.avg;
    return String(a.recipe.name).localeCompare(String(b.recipe.name));
  });
}

/**
 * Homepage sections. Each recipe appears in at most one section so the
 * page never repeats the same card four times.
 */
export function buildHomeSections({ recipes = [], prefs = {}, pantry = [], savedRecipes = [], ratings = {}, limit = 4 }) {
  const ctx = makeContext({ prefs, pantry, savedRecipes, ratings });
  const evaluated = recipes.map((r) => evaluateRecipe(r, ctx)).filter((e) => !e.excluded);
  const ranked = sortEvaluated(evaluated, ctx);
  const used = new Set();

  const pick = (list, count = limit) => {
    const out = [];
    for (const entry of list) {
      if (out.length >= count) break;
      if (used.has(entry.recipe.id)) continue;
      used.add(entry.recipe.id);
      out.push(entry);
    }
    return out;
  };

  const sections = [];

  const recommended = pick(ranked);
  if (recommended.length) {
    sections.push({
      id: 'recommended',
      title: '✨ Recommended Just for You',
      subtitle: 'Ranked from your cuisines, dietary needs, pantry and cooking history',
      recipes: recommended
    });
  }

  if (ctx.usable.length >= 2) {
    const pantryRanked = evaluated
      .filter((e) => e.match && e.match.hasData && e.match.percentage > 0)
      .sort((a, b) => b.match.percentage - a.match.percentage || b.score - a.score);
    const cookNow = pick(pantryRanked.filter((e) => e.match.percentage >= 20));
    if (cookNow.length) {
      sections.push({
        id: 'cook',
        title: '🧺 Cook With What You Have',
        subtitle: 'Ranked by how much of each recipe is already in your pantry',
        recipes: cookNow
      });
    }
  }

  if ((prefs.cuisines || []).length) {
    const favourites = pick(ranked.filter((e) => cuisineMatches(e.recipe.cuisine, prefs.cuisines)));
    if (favourites.length) {
      sections.push({
        id: 'cuisines',
        title: '🌍 Your Favorite Cuisines',
        subtitle: prefs.cuisines.slice(0, 3).join(' · '),
        recipes: favourites
      });
    }
  }

  const quickLimit = Math.min(Number(prefs.maxTime) || 30, 30);
  const quick = pick(ranked.filter((e) => {
    const t = totalTime(e.recipe);
    return t !== null && t <= quickLimit;
  }));
  if (quick.length) {
    sections.push({
      id: 'quick',
      title: '⏱️ Quick and Easy Meals',
      subtitle: `Ready in ${quickLimit} minutes or less`,
      recipes: quick
    });
  }

  const budget = pick(ranked.filter((e) => {
    const count = (e.recipe.ingredients || []).length;
    return count > 0 && count <= 8;
  }));
  if (budget.length) {
    sections.push({
      id: 'budget',
      title: '💰 Budget-Friendly Cooking',
      subtitle: 'Fewer ingredients to buy — the recipe source does not provide prices',
      recipes: budget
    });
  }

  const discover = pick(ranked.filter((e) => !cuisineMatches(e.recipe.cuisine, prefs.cuisines)));
  if (discover.length) {
    sections.push({
      id: 'discover',
      title: '🧭 Discover Something New',
      subtitle: 'Cuisines outside your usual favourites',
      recipes: discover
    });
  }

  return sections;
}

/* Pantry page: every compatible recipe ranked by confirmed availability. */
export function pantryRecommendations({ recipes = [], prefs = {}, pantry = [], savedRecipes = [], ratings = {}, minPercentage = 0 }) {
  const ctx = makeContext({ prefs, pantry, savedRecipes, ratings });
  const evaluated = recipes.map((r) => evaluateRecipe(r, ctx)).filter((e) => !e.excluded && e.match && e.match.hasData);
  return evaluated
    .filter((e) => e.match.percentage >= minPercentage)
    .sort((a, b) => b.match.percentage - a.match.percentage ||
      b.match.matched.length - a.match.matched.length ||
      b.score - a.score);
}

/**
 * "Use It Before You Lose It": recipes that use ingredients expiring
 * within `days`. Expired items are ignored entirely.
 */
export function expiringRecommendations({ recipes = [], prefs = {}, pantry = [], savedRecipes = [], ratings = {}, days = 5 }) {
  const ctx = makeContext({ prefs, pantry, savedRecipes, ratings });
  return recipes
    .map((r) => evaluateRecipe(r, ctx))
    .filter((e) => !e.excluded && e.match && e.match.expiringUsed.length > 0)
    .sort((a, b) => b.match.expiringUsed.length - a.match.expiringUsed.length ||
      b.match.percentage - a.match.percentage || b.score - a.score);
}
