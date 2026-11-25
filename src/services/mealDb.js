/* ============================================================
   CraveCart - mealDb.js
   TheMealDB REST API client (https://www.themealdb.com/api.php).

   - Two-level response cache (in-memory + sessionStorage) so the
     same request is never repeated within its TTL, respecting the
     free API rate limits.
   - In-flight de-duplication: two components (or a re-render /
     StrictMode double-mount) asking for the same URL share ONE
     network request.
   - One retry on network failure, then a readable error.
   - Mapping to the CraveCart recipe shape used by every existing
     component. TheMealDB does NOT provide prep/cook time, servings,
     difficulty or a description, so those fields stay `null` instead
     of being invented, and the UI shows them as unavailable.
   ============================================================ */

const BASE = 'https://www.themealdb.com/api/json/v1/1/';
const EXT_KEY = 'cravecart_mealdb_recipes';
const EXT_LIMIT = 400;
const TTL_SEARCH = 60 * 60 * 1000;        /* 1 hour  */
const TTL_REFERENCE = 24 * 60 * 60 * 1000; /* 24 hours */

/* ---------------- transport + cache ---------------- */

const memoryCache = new Map();   /* cache key -> { data, expires }        */
const inFlight = new Map();      /* cache key -> Promise<data>            */
const hydrating = new Set();     /* recipe ids currently being resolved   */

function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== 'number') return null;
    if (Date.now() - entry.t > entry.ttl) return null;
    return { data: entry.d, expires: entry.t + entry.ttl };
  } catch (e) {
    return null;
  }
}

function writeSessionCache(key, data, ttl) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), ttl, d: data }));
  } catch (e) {
    /* storage full / disabled — caching is optional */
  }
}

function readMemoryCache(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return hit.data;
}

async function request(path, params = {}, ttl = TTL_SEARCH) {
  const query = new URLSearchParams(params).toString();
  const url = BASE + path + (query ? '?' + query : '');
  const cacheKey = 'cc_mdb_' + url;
  const cacheable = ttl > 0;

  if (cacheable) {
    const fromMemory = readMemoryCache(cacheKey);
    if (fromMemory) return fromMemory;

    const stored = readSessionCache(cacheKey);
    if (stored) {
      memoryCache.set(cacheKey, stored);
      return stored.data;
    }
  }

  /* Same URL already on the wire: share that promise instead of
     firing a second request (re-renders, StrictMode, two pages). */
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const task = (async () => {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        clearTimeout(timer);
        if (!res.ok) throw new Error('TheMealDB responded with HTTP ' + res.status);
        const data = await res.json();
        if (cacheable) {
          writeSessionCache(cacheKey, data, ttl);
          memoryCache.set(cacheKey, { data, expires: Date.now() + ttl });
        }
        return data;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
      }
    }
    throw new Error(
      lastError && lastError.name === 'AbortError'
        ? 'TheMealDB took too long to respond. Please try again.'
        : 'Could not reach TheMealDB. Check your connection and try again.'
    );
  })();

  inFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(cacheKey);
  }
}

/* ---------------- mapping helpers ---------------- */

/* Third-party strings are only accepted as real web URLs, so a junk
   value can never become a javascript: link or a broken image src. */
function safeHttpUrl(value) {
  const s = String(value || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

function splitMeasure(raw) {
  const s = (raw || '').trim();
  if (!s) return { quantity: '', unit: '' };
  const m = s.match(/^([\d.,/\s-]+?)\s*([a-zA-Z].*)$/);
  if (m) return { quantity: m[1].trim(), unit: m[2].trim() };
  return { quantity: '', unit: s };
}

function splitInstructions(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d{1,2}[.)]?$/.test(line))
    .map((line) => line.replace(/^STEP\s*\d+\s*[:.-]?\s*/i, '').trim())
    .filter(Boolean);
}

/* Diet is only derived when TheMealDB's own category states it.
   Anything else stays unknown — never guessed from cuisine/country. */
function dietFromCategory(category) {
  if (category === 'Vegetarian') return 'Vegetarian';
  if (category === 'Vegan') return 'Vegan';
  return null;
}

function youtubeId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? m[1] : '';
}

export function mapFullMeal(m) {
  if (!m || !m.idMeal) return null;

  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m['strIngredient' + i] || '').trim();
    if (!name) continue;
    const raw = (m['strMeasure' + i] || '').trim();
    const parts = splitMeasure(raw);
    ingredients.push({ name, quantity: parts.quantity, unit: parts.unit, raw });
  }

  const category = m.strCategory || null;
  return {
    id: 'mealdb_' + m.idMeal,
    mealDbId: m.idMeal,
    name: m.strMeal || 'Untitled recipe',
    description: null,
    image: safeHttpUrl(m.strMealThumb),
    cuisine: m.strArea || m.strCountry || null,
    category,
    dietaryPreference: dietFromCategory(category),
    difficulty: null,
    prepTime: null,
    cookTime: null,
    servings: null,
    ingredients,
    instructions: splitInstructions(m.strInstructions),
    tags: (m.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
    author: null,
    authorName: 'TheMealDB',
    source: 'mealdb',
    sourceUrl: safeHttpUrl(m.strSource),
    video: safeHttpUrl(m.strYoutube),
    createdAt: null,
    partial: false
  };
}

/* filter.php returns a light record (name/thumb/area only). */
export function mapFilterMeal(f, opts = {}) {
  if (!f || !f.idMeal) return null;
  return {
    id: 'mealdb_' + f.idMeal,
    mealDbId: f.idMeal,
    name: f.strMeal || 'Untitled recipe',
    description: null,
    image: safeHttpUrl(f.strMealThumb),
    cuisine: f.strArea || f.strCountry || opts.cuisine || null,
    category: opts.category || null,
    dietaryPreference: null,
    difficulty: null,
    prepTime: null,
    cookTime: null,
    servings: null,
    ingredients: [],
    instructions: [],
    tags: [],
    author: null,
    authorName: 'TheMealDB',
    source: 'mealdb',
    sourceUrl: '',
    video: '',
    createdAt: null,
    partial: true
  };
}

/* ---------------- resolved-recipe cache (localStorage) ----------------
   Needed so Saved Recipes / Collections can render a TheMealDB recipe
   that the user bookmarked, even after a reload or without network. */

function readExtMap() {
  try {
    const raw = localStorage.getItem(EXT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveExternalRecipe(recipe) {
  if (!recipe || !recipe.id) return;
  const map = readExtMap();
  map[recipe.id] = recipe;
  const ids = Object.keys(map);
  if (ids.length > EXT_LIMIT) {
    ids.slice(0, ids.length - EXT_LIMIT).forEach((id) => { delete map[id]; });
  }
  try {
    localStorage.setItem(EXT_KEY, JSON.stringify(map));
  } catch (e) {
    /* ignore quota errors */
  }
}

export function getExternalRecipe(id) {
  if (!id) return null;
  return readExtMap()[id] || null;
}

/* ---------------- public API ---------------- */

export async function getAreas() {
  const data = await request('list.php', { a: 'list' }, TTL_REFERENCE);
  const list = (data.meals || []).map((m) => m.strArea).filter(Boolean);
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

export async function getMealCategories() {
  const data = await request('categories.php', {}, TTL_REFERENCE);
  return (data.categories || [])
    .map((c) => ({ name: c.strCategory, thumb: c.strCategoryThumb, description: c.strCategoryDescription }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchMealsByName(term) {
  const data = await request('search.php', { s: term });
  return (data.meals || []).map(mapFullMeal).filter(Boolean);
}

export async function filterMealsByIngredient(term) {
  const data = await request('filter.php', { i: term });
  return (data.meals || []).map((m) => mapFilterMeal(m)).filter(Boolean);
}

export async function filterMealsByArea(area) {
  const data = await request('filter.php', { a: area });
  return (data.meals || []).map((m) => mapFilterMeal(m, { cuisine: area })).filter(Boolean);
}

export async function filterMealsByCategory(category) {
  const data = await request('filter.php', { c: category });
  return (data.meals || []).map((m) => mapFilterMeal(m, { category })).filter(Boolean);
}

export async function getMealsByLetter(letter) {
  const data = await request('search.php', { f: letter });
  return (data.meals || []).map(mapFullMeal).filter(Boolean);
}

export async function lookupMeal(mealDbId) {
  if (!mealDbId) return null;
  const data = await request('lookup.php', { i: mealDbId });
  const meal = (data.meals || [])[0];
  return meal ? mapFullMeal(meal) : null;
}

export async function randomMeal() {
  /* Never cached: each click must be a different suggestion. */
  const data = await request('random.php', {}, 0);
  const meal = (data.meals || [])[0];
  return meal ? mapFullMeal(meal) : null;
}

/* Fetches full details for bookmarked global ids that aren't cached.
   The same id is never hydrated twice concurrently. */
export function getCachedExternalRecipes() {
  const map = readExtMap();
  return Object.keys(map)
    .map((id) => map[id])
    .filter((recipe) => recipe && recipe.id && !recipe.partial);
}

/* Fetches full details for bookmarked global ids that aren't cached.
    The same id is never hydrated twice concurrently. */
export async function hydrateExternalRecipes(ids = []) {
  const map = readExtMap();
  const missing = ids.filter((id) => id && id.startsWith('mealdb_') && !map[id] && !hydrating.has(id));
  const fetched = [];
  const queue = missing.slice(0, 12);
  if (!queue.length) return fetched;

  /* Bounded concurrency: at most 3 detail lookups in flight, so a page
     with many bookmarks never fans out into a burst of API calls. */
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      hydrating.add(id);
      try {
        const meal = await lookupMeal(id.replace('mealdb_', ''));
        if (meal) {
          saveExternalRecipe(meal);
          fetched.push(meal);
        }
      } catch (e) {
        /* leave it out; the page still renders the rest */
      } finally {
        hydrating.delete(id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  return fetched;
}

export { youtubeId };
