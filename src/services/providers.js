/* ============================================================
   CraveCart - services/providers.js
   Recipe-provider registry.

   Every provider exposes the same small interface so a second source
   (e.g. Spoonacular) can be added without touching the UI:

     id, label, attribution
     capabilities: { search, ingredient, category, area, letter, lookup, random }
     searchByName(term)          -> Recipe[]
     filterByIngredient(term)    -> Recipe[]
     filterByCategory(name)      -> Recipe[]
     filterByArea(name)          -> Recipe[]
     browseByLetter(letter)      -> Recipe[]
     listAreas()                 -> string[]
     listCategories()            -> { name, thumb, description }[]
     lookupById(sourceId)        -> Recipe | null
     random()                    -> Recipe | null

   Recipes must carry a stable, source-prefixed `id` (`mealdb_52772`)
   so de-duplication across providers stays correct.
   ============================================================ */

import * as mealdb from './mealDb.js';

export const MEALDB_PROVIDER = {
  id: 'mealdb',
  label: 'TheMealDB',
  attribution: 'https://www.themealdb.com',
  capabilities: { search: true, ingredient: true, category: true, area: true, letter: true, lookup: true, random: true },
  searchByName: (term) => mealdb.searchMealsByName(term),
  filterByIngredient: (term) => mealdb.filterMealsByIngredient(term),
  filterByCategory: (name) => mealdb.filterMealsByCategory(name),
  filterByArea: (name) => mealdb.filterMealsByArea(name),
  browseByLetter: (letter) => mealdb.getMealsByLetter(letter),
  listAreas: () => mealdb.getAreas(),
  listCategories: () => mealdb.getMealCategories(),
  lookupById: (sourceId) => mealdb.lookupMeal(String(sourceId || '').replace('mealdb_', '')),
  random: () => mealdb.randomMeal()
};

export const RECIPE_PROVIDERS = [MEALDB_PROVIDER];

export function getProvider(id = 'mealdb') {
  return RECIPE_PROVIDERS.find((p) => p.id === id) || MEALDB_PROVIDER;
}

export function listProviderIds() {
  return RECIPE_PROVIDERS.map((p) => p.id);
}
