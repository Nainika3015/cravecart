/* ============================================================
   CraveCart - ingredients.js
   Ingredient normalization + pantry matching (Phase 2 fix).

   Design rules:
     • Case, whitespace, punctuation, plurals and preparation words
       are normalized away.
     • Curated synonyms map regional/alternate names to one canonical
       ingredient (coriander ↔ cilantro, aubergine ↔ eggplant …).
     • Processing words (flour, powder, paste, sauce, stock, ketchup,
       condensed, starch, purée …) are PRESERVED. They change what an
       ingredient is, so they block an exact match:
         tomato ✗ tomato ketchup      rice ✗ rice flour
         garlic ✗ garlic powder       milk ✗ condensed milk
     • No substring matching: "tomato" never matches "tomato paste".

   Matching classes (see classifyMatch):
     exact      → same canonical ingredient
     equivalent → verified synonym / interchangeable qualifier
     related    → same base, different processed product
                  (substitution candidate only, never counted)
     none       → unrelated

   Allergen detection lives in allergens.js and is a separate system:
   an allergen derivative ("whey") is not an ingredient equivalent.
   ============================================================ */

/* Preparation / quantity / part words: they never change what the
   ingredient *is*, so they are removed before comparison. */
const FORM_WORDS = new Set([
  'fresh', 'frozen', 'canned', 'tinned', 'chopped', 'sliced', 'diced', 'minced',
  'grated', 'crushed', 'ground', 'boiled', 'cooked', 'raw', 'whole', 'large',
  'medium', 'small', 'ripe', 'organic', 'unsalted', 'salted', 'plain',
  'finely', 'thinly', 'roughly', 'cut', 'pieces', 'about', 'optional', 'taste',
  'needed', 'serving', 'garnish', 'for', 'and', 'with', 'of', 'the', 'a', 'an',
  'to', 'as', 'or', 'plus', 'more', 'some', 'few', 'cubed', 'halved',
  'quartered', 'rinsed', 'blended', 'peeled', 'seeded', 'deseeded', 'trimmed',
  'beaten', 'melted', 'softened', 'toasted', 'roasted', 'drained', 'shredded',
  'crumbled', 'wedges', 'strips', 'chunks', 'rounds', 'bite', 'sized', 'thick',
  'thin', 'lightly', 'freshly', 'well', 'clove', 'cloves', 'leaf', 'leaves',
  'sprig', 'sprigs', 'stalk', 'stalks', 'bulb', 'bulbs', 'piece', 'head',
  'heads', 'knob', 'slice', 'slices', 'slice', 'fillet', 'fillets', 'breast',
  'breasts', 'thigh', 'thighs', 'leg', 'legs', 'wing', 'wings',   'stick',
  'sticks', 'can', 'cans', 'jar', 'jars', 'packet', 'packets', 'handful',
  'cooled', 'warm', 'hot', 'cold', 'room', 'temperature', 'leftover',
  'leftovers', 'thawed', 'defrosted', 'day', 'old', 'extra', 'additional'
]);

/* Curated equivalents: alternate / regional names for the same food.
   These run before normalization, so both spellings become one name. */
const ALIASES = [
  [/\bcilantro\b/g, 'coriander'],
  [/\bcoriander leaves?\b/g, 'coriander'],
  [/\bspring onions?\b/g, 'green onion'],
  [/\bscallions?\b/g, 'green onion'],
  [/\baubergines?\b/g, 'eggplant'],
  [/\bcourgettes?\b/g, 'zucchini'],
  [/\bgarbanzos?\b/g, 'chickpea'],
  [/\bchick ?peas?\b/g, 'chickpea'],
  [/\byogh?urts?\b/g, 'yogurt'],
  [/\bcurds?\b/g, 'yogurt'],
  [/\bprawns?\b/g, 'shrimp'],
  [/\bcapsicums?\b/g, 'bell pepper'],
  [/\bbell peppers?\b/g, 'bell pepper'],
  [/\bbesan\b/g, 'chickpea flour'],
  [/\bgram flour\b/g, 'chickpea flour'],
  [/\bmaida\b/g, 'flour'],
  [/\ball[- ]purpose flour\b/g, 'flour'],
  [/\bplain flour\b/g, 'flour'],
  [/\bcorn ?flour\b/g, 'cornflour'],
  [/\bcorn ?starch\b/g, 'cornflour'],
  [/\bconfectioners sugar\b/g, 'icing sugar'],
  [/\bpowdered sugar\b/g, 'icing sugar'],
  [/\bsoya sauce\b/g, 'soy sauce'],
  [/\bchillies\b/g, 'chilli'],
  [/\bchilies\b/g, 'chilli'],
  [/\bchili\b/g, 'chilli'],
  [/\bchiles?\b/g, 'chilli'],
  [/\btomatoes\b/g, 'tomato'],
  [/\bonions\b/g, 'onion'],
  [/\bpotatoes\b/g, 'potato'],
  [/\bpeanuts?\b/g, 'peanut'],
  [/\bcashews?\b/g, 'cashew'],
  [/\balmonds?\b/g, 'almond'],
  [/\beggs?\b/g, 'egg'],
  [/\brava\b|\bsooji\b|\bsemolina\b/g, 'semolina'],
  [/\bimli\b/g, 'tamarind'],
  [/\bgur\b/g, 'jaggery'],
  [/\bjeera\b/g, 'cumin'],
  [/\bhaldi\b/g, 'turmeric'],
  [/\bhing\b/g, 'asafoetida'],
  [/\bmethi\b/g, 'fenugreek']
];

/* Words that describe a PROCESSED PRODUCT of the base ingredient.
   Their presence on one side only means "related", never a match. */
const PROCESS_TOKENS = new Set([
  'flour', 'powder', 'paste', 'puree', 'passata', 'sauce', 'stock', 'broth', 'concentrate',
  'condensed', 'evaporated', 'ketchup', 'extract', 'juice', 'syrup', 'starch',
  'mayonnaise', 'mayo', 'jam', 'jelly', 'marmalade', 'protein', 'isolate',
  'flakes', 'crumbs', 'breadcrumb', 'wine', 'vinegar', 'pickle', 'chutney',
  'essence', 'seasoning', 'gravy', 'dressing'
]);

/* Harmless qualifiers: they say which version of the same food it is. */
const QUALIFIERS = new Set([
  'olive', 'extra', 'virgin', 'vegetable', 'sunflower', 'canola', 'rapeseed',
  'sesame', 'mustard', 'coconut', 'basmati', 'jasmine', 'long', 'grain',
  'wholegrain', 'skim', 'skimmed', 'semiskimmed', 'low', 'fat', 'free',
  'unsweetened', 'sweetened', 'brown', 'white', 'red', 'green', 'yellow',
  'baby', 'cherry', 'plum', 'vine', 'italian', 'greek', 'natural', 'double',
  'single', 'light', 'lite', 'dairy'
]);

/* Qualifiers that actually point at a different food — never ignore. */
const DISTINCT_QUALIFIERS = new Set(['sweet', 'sour', 'bitter', 'wild', 'fermented']);

function singular(word) {
  if (word.length <= 3) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
  if (/oes$/.test(word)) return word.slice(0, -2);
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
  return word;
}

/* Canonical, comparable form of any ingredient name. */
export function normalizeIngredient(raw) {
  let s = String(raw || '').toLowerCase();
  ALIASES.forEach(([re, replacement]) => { s = s.replace(re, replacement); });
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const words = s.split(' ')
    .filter((w) => w && !FORM_WORDS.has(w) && !/^\d/.test(w))
    .map(singular)
    .filter(Boolean);
  return words.join(' ').trim();
}

export function tokensOf(name) {
  const n = normalizeIngredient(name);
  return n ? n.split(' ').filter((t) => t.length >= 2) : [];
}

/* "$1 & onion" / "salt and pepper" → separate requirements. */
export function splitCompoundIngredient(raw) {
  return String(raw || '')
    .split('(')[0]
    .split(/\s*(?:&|\band\b)\s*/i)
    .map((part) => part.replace(/^[\s,]+|[\s,]+$/g, ''))
    .filter(Boolean);
}

function sameTokens(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join('|');
  const sb = [...b].sort().join('|');
  return sa === sb;
}

/**
 * Compare one required ingredient with one pantry item.
 * @returns {'exact'|'equivalent'|'related'|'none'}
 */
export function classifyMatch(requiredName, pantryName) {
  const a = normalizeIngredient(requiredName);
  const b = normalizeIngredient(pantryName);
  if (!a || !b) return 'none';
  if (a === b) return 'exact';

  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  const aProc = at.filter((t) => PROCESS_TOKENS.has(t));
  const bProc = bt.filter((t) => PROCESS_TOKENS.has(t));
  const aBase = at.filter((t) => !PROCESS_TOKENS.has(t));
  const bBase = bt.filter((t) => !PROCESS_TOKENS.has(t));

  /* Different level of processing → related, never counted. */
  if (!sameTokens(aProc, bProc)) {
    const overlap = aBase.some((t) => bBase.includes(t));
    return overlap ? 'related' : 'none';
  }

  if (sameTokens(aBase, bBase)) return 'equivalent';

  /* Same processing words; the extra words may only be harmless
     qualifiers ("olive oil" ↔ "oil", "basmati rice" ↔ "rice"). */
  const [short, long] = aBase.length <= bBase.length ? [aBase, bBase] : [bBase, aBase];
  if (!short.length) return 'none';
  const extra = long.filter((t) => !short.includes(t));
  if (extra.length && extra.every((t) => QUALIFIERS.has(t) && !DISTINCT_QUALIFIERS.has(t))) {
    return 'equivalent';
  }
  return 'none';
}

/* Only these two classes are counted towards the match percentage. */
export function countsAsAvailable(level) {
  return level === 'exact' || level === 'equivalent';
}

/* ---------------- cuisine + equipment ---------------- */

export function cuisineMatches(recipeCuisine, favourites = []) {
  if (!recipeCuisine || !favourites.length) return false;
  const r = String(recipeCuisine).toLowerCase();
  return favourites.some((f) => {
    const fav = String(f).toLowerCase();
    return r === fav || r.indexOf(fav) !== -1 || fav.indexOf(r) !== -1;
  });
}

/* Conservative hints read from the recipe's own instruction text —
   used only to nudge ranking, never shown as a requirement. */
const EQUIPMENT_RULES = [
  ['Air fryer', /\bair ?fryer\b/i],
  ['Pressure cooker', /\b(pressure cooker|pressure-cook|instant pot)\b/i],
  ['Microwave', /\bmicrowave\b/i],
  ['Blender', /\b(blender|blend until|food processor)\b/i],
  ['Grill', /\b(grill|grilling|barbecue|bbq)\b/i],
  ['Oven', /\b(bake|baking|oven|roast)\b/i],
  ['Stovetop', /\b(pan|fry|boil|simmer|saut|skillet|kadai|wok|tawa|heat)\b/i]
];

export function deriveEquipment(recipe) {
  const text = (recipe.instructions || []).join(' ');
  if (!text) return [];
  return EQUIPMENT_RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
}
