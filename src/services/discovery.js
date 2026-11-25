/* ============================================================
   CraveCart - discovery.js
   Client-side discovery plan for TheMealDB.

   TheMealDB has no offset/limit pagination, so discovery is built
   from the endpoints it does support:
     • search.php?f=<letter>   → full meals, first-letter browse
     • filter.php?c=<category> → category browse
     • filter.php?a=<area>     → cuisine browse
     • filter.php?i=<ingredient>
     • search.php?s=<term>
   All sources are visited at most once, recipes are de-duplicated by
   their stable source id, and only a couple of sources are fetched
   per "Load More Recipes" click.
   ============================================================ */

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const PAGE_SIZE = 12;
export const SOURCES_PER_CLICK = 2;
export const MAX_FETCHES_PER_CLICK = 6;

/** Ordered browse plan: letters, then categories, then cuisines. */
export function buildBrowsePlan({ categories = [], areas = [] } = {}) {
  return [
    ...LETTERS.map((letter) => ({ key: 'letter:' + letter, type: 'letter', value: letter })),
    ...categories.map((c) => ({ key: 'category:' + c, type: 'category', value: c })),
    ...areas.map((a) => ({ key: 'area:' + a, type: 'area', value: a }))
  ];
}

/** Sources that still need fetching, in plan order. */
export function pendingSources(plan, loadedKeys) {
  const loaded = loadedKeys instanceof Set ? loadedKeys : new Set(loadedKeys || []);
  return plan.filter((source) => !loaded.has(source.key));
}

export function nextSources(plan, loadedKeys, count = SOURCES_PER_CLICK) {
  return pendingSources(plan, loadedKeys).slice(0, count);
}

/** Merge recipes keeping the first occurrence of each stable id. */
export function mergeUniqueRecipes(existing = [], incoming = []) {
  const seen = new Set(existing.map((r) => r && r.id).filter(Boolean));
  const merged = existing.slice();
  (incoming || []).forEach((recipe) => {
    if (!recipe || !recipe.id || seen.has(recipe.id)) return;
    seen.add(recipe.id);
    merged.push(recipe);
  });
  return merged;
}

export function countNewRecipes(existing, incoming) {
  return mergeUniqueRecipes(existing, incoming).length - existing.length;
}

/** Accurate counter copy — never an unsupported total. */
export function loadedLabel(count) {
  return `${count} recipe${count === 1 ? '' : 's'} loaded`;
}

export function showingLabel(visible, loaded) {
  return `Showing ${Math.min(visible, loaded)} of ${loaded} loaded recipe${loaded === 1 ? '' : 's'}`;
}

/** Bounded-concurrency map (used for detail lookups). */
export async function mapWithConcurrency(items, limit, worker) {
  const list = items || [];
  const size = Math.max(1, limit || 1);
  const results = new Array(list.length);
  let cursor = 0;

  async function run() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(list[index], index);
      } catch (e) {
        results[index] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, list.length) }, run));
  return results;
}
