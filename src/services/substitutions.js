/* ============================================================
   CraveCart - substitutions.js
   Curated ingredient-substitution database (no AI required).

   Each entry explains how the swap changes taste and texture, and
   carries enough metadata to respect allergies, diet and regional
   availability. Phase 3 can add a Gemini-backed suggestion layer on
   top without changing this module's public shape.
   ============================================================ */

import { normalizeIngredient } from './ingredients.js';
import { ingredientHasAllergen } from './allergens.js';

/* fn = ingredient function (fat, acid, dairy, binder, protein …) */
const DB = {
  butter: {
    fn: 'fat',
    options: [
      { name: 'ghee', ratio: '1:1', vegan: false, region: ['India', 'Pakistan', 'South Asian'], note: 'Nuttier and richer; browns the same way, so baked goods stay tender.' },
      { name: 'olive oil', ratio: '¾ the amount', vegan: true, region: ['Italy', 'Spain', 'Greece', 'Mediterranean'], note: 'Less rich and slightly fruity; cakes come out a little denser and frying is fine.' },
      { name: 'coconut oil', ratio: '1:1', vegan: true, region: ['Thailand', 'South Indian', 'Sri Lankan'], note: 'Adds a mild coconut aroma; works well in curries and shallow frying.' }
    ]
  },
  milk: {
    fn: 'dairy',
    options: [
      { name: 'almond milk', ratio: '1:1', vegan: true, note: 'Thinner and lightly nutty; sauces may need a few extra minutes to thicken.' },
      { name: 'coconut milk', ratio: '1:1 (use less)', vegan: true, region: ['India', 'Thailand', 'South Indian'], note: 'Noticeably creamier with coconut flavour — great in curries, too strong in tea.' },
      { name: 'oat milk', ratio: '1:1', vegan: true, note: 'Closest texture to dairy milk; slightly sweet, good in baking.' }
    ]
  },
  cream: {
    fn: 'dairy',
    options: [
      { name: 'coconut cream', ratio: '1:1', vegan: true, region: ['Thailand', 'South Indian'], note: 'Thick and stable but adds coconut taste; curries take it well, desserts change flavour.' },
      { name: 'yogurt', ratio: '1:1 (off the heat)', vegan: false, note: 'Tangier and thinner; stir in at the end so it does not split.' },
      { name: 'cashew paste', ratio: '2 tbsp per ¼ cup', vegan: true, note: 'Silky body with a mild nuttiness; blend smooth or it stays grainy.' }
    ]
  },
  yogurt: {
    fn: 'dairy',
    options: [
      { name: 'coconut yogurt', ratio: '1:1', vegan: true, note: 'Coconut flavour comes through; thinner, so strain it for marinades.' },
      { name: 'lemon juice + milk', ratio: '1 tbsp lemon per cup', vegan: false, note: 'Curdles lightly — good for marinades, not for raita.' },
      { name: 'silken tofu', ratio: '1:1 blended', vegan: true, note: 'Very smooth but neutral to bland; season a little more.' }
    ]
  },
  paneer: {
    fn: 'protein',
    options: [
      { name: 'tofu', ratio: '1:1', vegan: true, note: 'Softer and absorbs marinade faster; press it first so it holds shape.' },
      { name: 'halloumi', ratio: '1:1', vegan: false, note: 'Saltier and squeakier; skip added salt in the dish.' },
      { name: 'cottage cheese', ratio: '1:1 (drained)', vegan: false, note: 'Crumblier, will not hold cubes — best in kofta or stuffing.' }
    ]
  },
  egg: {
    fn: 'binder',
    options: [
      { name: 'flaxseed meal + water', ratio: '1 tbsp + 3 tbsp water per egg', vegan: true, note: 'Binds well but adds a slight nutty taste; fine in pancakes and bakes.' },
      { name: 'yogurt', ratio: '¼ cup per egg', vegan: false, note: 'Keeps bakes moist; less lift, so expect a denser crumb.' },
      { name: 'chickpea flour + water', ratio: '1 tbsp + 2 tbsp water per egg', vegan: true, region: ['India'], note: 'Savoury, slightly beany; excellent in fritters, noticeable in cakes.' }
    ]
  },
  flour: {
    fn: 'grain',
    options: [
      { name: 'whole wheat flour', ratio: '1:1', vegan: true, note: 'Heavier and nuttier; add a little extra liquid and expect a denser texture.' },
      { name: 'rice flour', ratio: '1:1 (blend)', vegan: true, region: ['India', 'Thailand', 'South Indian'], note: 'Crisper when fried, but does not develop gluten — poor for bread.' },
      { name: 'oat flour', ratio: '1:1', vegan: true, note: 'Slightly sweet and dense; good for pancakes, gritty in fine bakes.' }
    ]
  },
  sugar: {
    fn: 'sweetener',
    options: [
      { name: 'honey', ratio: '¾ the amount', vegan: false, note: 'Sweeter with a floral note; reduce other liquids slightly and lower the oven temperature.' },
      { name: 'jaggery', ratio: '1:1', vegan: true, region: ['India'], note: 'Deep caramel flavour; darker colour and a slightly sticky crumb.' },
      { name: 'maple syrup', ratio: '¾ the amount', vegan: true, note: 'Distinct maple taste; bakes brown faster, so watch the timing.' }
    ]
  },
  'soy sauce': {
    fn: 'umami',
    options: [
      { name: 'tamari', ratio: '1:1', vegan: true, note: 'Very similar but usually gluten-free and slightly stronger — use a touch less.' },
      { name: 'coconut aminos', ratio: '1:1', vegan: true, note: 'Sweeter and much less salty; add salt separately.' },
      { name: 'salt + mushroom stock', ratio: 'to taste', vegan: true, note: 'Adds savouriness without the fermented depth; colour will be lighter.' }
    ]
  },
  vinegar: {
    fn: 'acid',
    options: [
      { name: 'lemon juice', ratio: '1:1', vegan: true, note: 'Brighter and more citrusy; works in dressings and marinades.' },
      { name: 'lime juice', ratio: '1:1', vegan: true, region: ['Mexico', 'Thailand', 'India'], note: 'Sharper and more aromatic than vinegar.' },
      { name: 'tamarind paste', ratio: '1 tsp per tbsp', vegan: true, region: ['India', 'South Indian'], note: 'Fruity, deep sourness — good in curries, too dark for salads.' }
    ]
  },
  lemon: {
    fn: 'acid',
    options: [
      { name: 'lime', ratio: '1:1', vegan: true, note: 'Very close; slightly more bitter and floral.' },
      { name: 'white vinegar', ratio: '½ the amount', vegan: true, note: 'Provides sourness without the peel aroma; use sparingly.' },
      { name: 'amchur (dried mango powder)', ratio: '½ tsp per tbsp juice', vegan: true, region: ['India'], note: 'Dry sourness — good in dry dishes, not in drinks.' }
    ]
  },
  'green chilli': {
    fn: 'heat',
    options: [
      { name: 'red chilli flakes', ratio: '¼ the amount', vegan: true, note: 'Different heat profile — earthier and slower to build.' },
      { name: 'black pepper', ratio: '1:1 (to taste)', vegan: true, note: 'Peppery rather than grassy; the dish loses its fresh green note.' },
      { name: 'jalapeño', ratio: '1:1', vegan: true, region: ['Mexico', 'United States'], note: 'Milder and fruitier, with some acidity.' }
    ]
  },
  garlic: {
    fn: 'aromatic',
    options: [
      { name: 'garlic powder', ratio: '⅛ tsp per clove', vegan: true, note: 'Rounder and less pungent; no fresh bite.' },
      { name: 'asafoetida (hing)', ratio: 'a pinch', vegan: true, region: ['India'], note: 'Onion-garlic-like savouriness; use very little or it turns bitter.' },
      { name: 'shallot', ratio: '1 tbsp minced per clove', vegan: true, note: 'Milder and sweeter; adds moisture to the pan.' }
    ]
  },
  onion: {
    fn: 'aromatic',
    options: [
      { name: 'leek', ratio: '1:1 (white part)', vegan: true, note: 'Sweeter and softer; browns faster, so lower the heat.' },
      { name: 'shallot', ratio: '1:1', vegan: true, note: 'Finer and more delicate; less bulk in the finished dish.' },
      { name: 'onion powder', ratio: '1 tsp per onion', vegan: true, note: 'Gives flavour but no texture or caramelisation.' }
    ]
  },
  tomato: {
    fn: 'base',
    options: [
      { name: 'tinned tomatoes', ratio: '1:1', vegan: true, note: 'More concentrated and slightly sweeter; good for sauces.' },
      { name: 'tomato paste + water', ratio: '2 tbsp + ½ cup per 4 tomatoes', vegan: true, note: 'Deeper colour, thicker body; add water to avoid a pasty sauce.' },
      { name: 'red bell pepper', ratio: '1:1', vegan: true, note: 'Sweeter and less acidic; the sauce will taste fruitier.' }
    ]
  },
  'coconut milk': {
    fn: 'dairy',
    options: [
      { name: 'cashew cream', ratio: '1:1', vegan: true, note: 'Creamier and nuttier, less coconut aroma; thickens well.' },
      { name: 'dairy cream', ratio: '1:1', vegan: false, note: 'Richer and less sweet; curries lose the coconut note.' },
      { name: 'yogurt + water', ratio: '1:1 thinned', vegan: false, note: 'Tangier and lighter; add off the heat so it does not split.' }
    ]
  },
  cheese: {
    fn: 'dairy',
    options: [
      { name: 'nutritional yeast', ratio: '2 tbsp per ½ cup', vegan: true, note: 'Savoury and nutty but does not melt; best as a topping.' },
      { name: 'cashew cheese', ratio: '1:1', vegan: true, note: 'Creamy and mild; melts less evenly.' },
      { name: 'paneer', ratio: '1:1 grated', vegan: false, region: ['India'], note: 'Holds shape instead of melting; saltier.' }
    ]
  },
  mayonnaise: {
    fn: 'fat',
    options: [
      { name: 'yogurt', ratio: '1:1', vegan: false, note: 'Tangier and much lighter; thinner consistency.' },
      { name: 'avocado', ratio: '1:1 mashed', vegan: true, note: 'Fresh and creamy, but browns and does not keep.' },
      { name: 'vegan mayonnaise', ratio: '1:1', vegan: true, note: 'Nearly identical; check the label for soy or mustard.' }
    ]
  },
  honey: {
    fn: 'sweetener',
    options: [
      { name: 'maple syrup', ratio: '1:1', vegan: true, note: 'Thinner and less floral; slightly less sweet.' },
      { name: 'jaggery syrup', ratio: '1:1', vegan: true, region: ['India'], note: 'Molasses-like depth; darker colour.' },
      { name: 'sugar + water', ratio: '1¼ sugar + ¼ water per cup', vegan: true, note: 'Simple sweetness, no aroma; crystallises if stored cold.' }
    ]
  },
  'chicken stock': {
    fn: 'umami',
    options: [
      { name: 'vegetable stock', ratio: '1:1', vegan: true, note: 'Lighter body and less savoury depth; fine in most curries and soups.' },
      { name: 'water + soy sauce', ratio: '1 cup + 1 tsp', vegan: true, note: 'Adds saltiness but not the gelatinous body of stock.' },
      { name: 'mushroom stock', ratio: '1:1', vegan: true, note: 'Earthy and deep; excellent in vegetarian versions.' }
    ]
  },
  'fish sauce': {
    fn: 'umami',
    options: [
      { name: 'soy sauce', ratio: '1:1', vegan: true, note: 'Salty and savoury but misses the fermented fish depth.' },
      { name: 'salt + lime', ratio: 'to taste', vegan: true, note: 'Cleaner and brighter; the dish tastes lighter.' },
      { name: 'mushroom soy sauce', ratio: '1:1', vegan: true, note: 'Darker and earthier; use a little less.' }
    ]
  },
  breadcrumb: {
    fn: 'binder',
    options: [
      { name: 'crushed crackers', ratio: '1:1', vegan: true, note: 'Saltier and coarser; good for coatings.' },
      { name: 'oats', ratio: '1:1 (blitzed)', vegan: true, note: 'Chewier and denser; binds well in patties.' },
      { name: 'crushed cornflakes', ratio: '1:1', vegan: true, note: 'Sweeter and crispier; browns quickly.' }
    ]
  },
  'baking powder': {
    fn: 'leavener',
    options: [
      { name: 'baking soda + lemon juice', ratio: '¼ tsp soda + ½ tsp acid per tsp', vegan: true, note: 'Works immediately — bake straight away or the lift is lost.' },
      { name: 'self-raising flour', ratio: '1 cup flour minus 2 tsp', vegan: true, note: 'Adjust the flour amount; results are close.' }
    ]
  },
  'cornflour': {
    fn: 'thickener',
    options: [
      { name: 'arrowroot', ratio: '1:1', vegan: true, note: 'Clearer sauces; breaks down if boiled hard.' },
      { name: 'rice flour', ratio: '1:1', vegan: true, note: 'Slightly grainy; good in frying batters.' },
      { name: 'all-purpose flour', ratio: '2:1', vegan: true, note: 'Cloudier sauce and a faint floury taste if undercooked.' }
    ]
  },
  peanut: {
    fn: 'crunch',
    options: [
      { name: 'roasted chana', ratio: '1:1', vegan: true, region: ['India'], note: 'Crunchy and nutty but drier; good in poha and chaat.' },
      { name: 'sunflower seeds', ratio: '1:1', vegan: true, note: 'Milder and seedier; toasting helps.' },
      { name: 'cashew', ratio: '1:1', vegan: true, note: 'Sweeter and softer; not suitable if tree nuts are an allergy.' }
    ]
  },
  'green onion': {
    fn: 'aromatic',
    options: [
      { name: 'onion', ratio: '1 tbsp per stalk', vegan: true, note: 'Stronger and sharper; no fresh green finish.' },
      { name: 'chives', ratio: '1:1', vegan: true, note: 'Milder and more delicate; use as a garnish.' },
      { name: 'leek', ratio: '1:1 (green part)', vegan: true, note: 'Sweeter and tougher; cook briefly before serving.' }
    ]
  },
  'curry leaf': {
    fn: 'aromatic',
    options: [
      { name: 'bay leaf', ratio: '1:1', vegan: true, note: 'Different aroma — herbal rather than citrusy; remove before serving.' },
      { name: 'lime zest', ratio: 'a pinch', vegan: true, note: 'Keeps the citrus lift but no bitterness.' }
    ]
  },
  'garam masala': {
    fn: 'spice',
    options: [
      { name: 'curry powder', ratio: '1:1', vegan: true, note: 'Turmeric-forward and less warm; colour changes.' },
      { name: 'cumin + coriander + cinnamon', ratio: '2:2:1', vegan: true, note: 'Builds a similar warmth; grind fresh for the best result.' }
    ]
  },
  'greek yogurt': {
    fn: 'dairy',
    options: [
      { name: 'hung curd', ratio: '1:1', vegan: false, region: ['India'], note: 'Very close in body; slightly tangier.' },
      { name: 'coconut yogurt', ratio: '1:1 (strained)', vegan: true, note: 'Thinner and coconut-forward.' }
    ]
  },
  'olive oil': {
    fn: 'fat',
    options: [
      { name: 'vegetable oil', ratio: '1:1', vegan: true, note: 'Neutral taste and a higher smoke point; loses the fruity finish.' },
      { name: 'mustard oil', ratio: '1:1', vegan: true, region: ['India'], note: 'Pungent and sharp; heat it first to mellow it.' }
    ]
  },
  'sour cream': {
    fn: 'dairy',
    options: [
      { name: 'yogurt', ratio: '1:1', vegan: false, note: 'Lighter and tangier; may separate in hot sauces.' },
      { name: 'coconut cream + lime', ratio: '1:1 + squeeze', vegan: true, note: 'Dairy-free but coconutty.' }
    ]
  },
  'stock cube': {
    fn: 'umami',
    options: [
      { name: 'vegetable stock', ratio: '1 cube = 1 cup', vegan: true, note: 'Similar saltiness; depth varies by brand.' },
      { name: 'soy sauce + water', ratio: '1 tsp + 1 cup', vegan: true, note: 'Thinner body, still savoury.' }
    ]
  },
  'rice vinegar': {
    fn: 'acid',
    options: [
      { name: 'white wine vinegar', ratio: '1:1', vegan: true, note: 'Sharper; use slightly less.' },
      { name: 'lime juice', ratio: '1:1', vegan: true, note: 'Brighter and more citrusy.' }
    ]
  },
  'cheddar cheese': {
    fn: 'dairy',
    options: [
      { name: 'mozzarella', ratio: '1:1', vegan: false, note: 'Milder and stretchier; less sharpness.' },
      { name: 'paneer', ratio: '1:1 grated', vegan: false, region: ['India'], note: 'Does not melt the same way; holds shape.' },
      { name: 'vegan cheese', ratio: '1:1', vegan: true, note: 'Melting behaviour varies by brand.' }
    ]
  }
};

/* Find the closest database entry for any ingredient name. */
function findEntry(normalized) {
  if (!normalized) return null;
  if (DB[normalized]) return DB[normalized];
  const keys = Object.keys(DB).sort((a, b) => b.length - a.length);
  const hit = keys.find((k) => normalized.indexOf(k) !== -1 || k.indexOf(normalized) !== -1);
  return hit ? DB[hit] : null;
}

/**
 * Substitutions for one missing ingredient.
 * ctx = { allergies, diets, pantryNames, cuisine, country }
 * Returns [{ name, ratio, note, inPantry }] (max 3).
 */
export function getSubstitutionsFor(ingredientName, ctx = {}) {
  const allergies = ctx.allergies || [];
  const diets = ctx.diets || [];
  const pantryNames = ctx.pantryNames || [];
  const normalized = normalizeIngredient(ingredientName);
  const entry = findEntry(normalized);
  if (!entry) return [];

  const wantsVegan = diets.indexOf('Vegan') !== -1;
  const wantsVeg = wantsVegan || diets.indexOf('Vegetarian') !== -1;

  const options = entry.options
    .filter((opt) => {
      /* Never suggest something the user is allergic to. */
      if (allergies.some((a) => ingredientHasAllergen(opt.name, a))) return false;
      if (wantsVegan && !opt.vegan) return false;
      return true;
    })
    .map((opt) => {
      const inPantry = pantryNames.some((p) => normalizeIngredient(p) === normalizeIngredient(opt.name));
      let rank = opt.vegan && wantsVeg ? 2 : 0;
      if (inPantry) rank += 3;
      if (opt.region && (opt.region.indexOf(ctx.country) !== -1 || opt.region.indexOf(ctx.cuisine) !== -1)) rank += 2;
      return { name: opt.name, ratio: opt.ratio, note: opt.note, inPantry, rank };
    })
    .sort((a, b) => b.rank - a.rank);

  return options.slice(0, 3).map(({ rank, ...rest }) => rest);
}

export function hasSubstitutionData(ingredientName) {
  return !!findEntry(normalizeIngredient(ingredientName));
}

export { DB as SUBSTITUTION_DB };
