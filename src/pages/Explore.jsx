import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import UserLayout from '../components/UserLayout';
import RecipeCard from '../components/RecipeCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getRecipes, getCategories, getRatingsMap, getSavedIds, toggleSaved, catIcon,
  isExternalRecipeId, resolveRecipe, saveExternalRecipe, getExternalRecipe,
  hydrateExternalRecipes, getRecentlyViewed,
} from '../services/storageService.js';
import { getPreferences, savePreferences } from '../services/preferences.js';
import { getProvider } from '../services/providers.js';
import {
  buildBrowsePlan, pendingSources, nextSources, mergeUniqueRecipes,
  PAGE_SIZE, SOURCES_PER_CLICK, MAX_FETCHES_PER_CLICK
} from '../services/discovery.js';
import { detectAllergens, isHiddenByAllergens } from '../services/allergens.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const CUISINES = ['Indian', 'Italian', 'Chinese', 'Mexican'];
const DIETS = ['Vegetarian', 'Vegan', 'Non-Vegetarian', 'Gluten Free', 'High Protein', 'Low Calorie'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const FIRST_LETTER = 'a';

/* The UI only talks to the provider interface, so another source can be
   added in services/providers.js without changing this page. */
const provider = getProvider('mealdb');

function fetchSource(source) {
  if (source.type === 'letter') return provider.browseByLetter(source.value);
  if (source.type === 'category') return provider.filterByCategory(source.value);
  if (source.type === 'area') return provider.filterByArea(source.value);
  return Promise.resolve([]);
}

export default function Explore() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const uid = user && user.id;
  const recipes = useMemo(() => getRecipes(), []);
  const categories = useMemo(() => getCategories(), []);
  const ratings = useMemo(() => getRatingsMap(), []);
  const savedIds = getSavedIds(uid);
  const [, force] = useState(0);

  /* ---------------- preferences / allergies ---------------- */
  const [prefs, setPrefs] = useState(() => getPreferences(uid));
  useEffect(() => { setPrefs(getPreferences(uid)); }, [uid]);
  const hasAllergyPrefs = (prefs.allergies || []).length > 0 || (prefs.customAvoid || []).length > 0;
  const allergyOptions = { hideDetected: prefs.hideAllergens !== false, strict: !!prefs.strictAllergens };

  /* ---------------- local filters ---------------- */
  const [q, setQ] = useState(params.get('q') || '');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [cuisine, setCuisine] = useState('');
  const [diet, setDiet] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [maxTime, setMaxTime] = useState('');
  const [sort, setSort] = useState('rating');
  const [cats, setCats] = useState([]);

  /* ---------------- global (TheMealDB) filters ---------------- */
  const [source, setSource] = useState('all');
  const [ingredient, setIngredient] = useState('');
  const [debouncedIngredient, setDebouncedIngredient] = useState('');
  const [area, setArea] = useState('');
  const [mealCat, setMealCat] = useState('');
  const [areas, setAreas] = useState([]);
  const [mealCats, setMealCats] = useState([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const refsRef = useRef({ loaded: false, areas: [], categories: [] });
  const refsPromise = useRef(null);

  /* ---------------- global results + discovery ---------------- */
  const [globalList, setGlobalList] = useState([]);
  const globalRef = useRef([]);
  const [globalState, setGlobalState] = useState('idle');
  const [globalError, setGlobalError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [exhausted, setExhausted] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const fetchToken = useRef(0);
  const loadedSources = useRef(new Set());
  const [loadedSourceCount, setLoadedSourceCount] = useState(0);

  const [visibleLocal, setVisibleLocal] = useState(PAGE_SIZE);
  const [visibleGlobal, setVisibleGlobal] = useState(PAGE_SIZE);

  const [recent, setRecent] = useState([]);
  const [surpriseBusy, setSurpriseBusy] = useState(false);

  const setGlobal = useCallback((next) => {
    globalRef.current = next;
    setGlobalList(next);
  }, []);

  useEffect(() => {
    const p = params.get('q');
    if (p !== null) { setQ(p); setDebouncedQ(p); }
  }, [params.get('q')]); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedIngredient(ingredient), 400);
    return () => clearTimeout(t);
  }, [ingredient]);

  /* Country + meal-type lists. Loaded once, on demand — never during
     the initial paint. Also feeds the discovery plan. */
  const ensureReferences = useCallback(() => {
    if (refsRef.current.loaded) return Promise.resolve(refsRef.current);
    if (refsPromise.current) return refsPromise.current;
    setRefsLoading(true);
    setReferenceError('');
    refsPromise.current = Promise.all([provider.listAreas(), provider.listCategories()])
      .then(([a, c]) => {
        const payload = { loaded: true, areas: a, categories: c.map((x) => x.name) };
        refsRef.current = payload;
        setAreas(a);
        setMealCats(payload.categories);
        return payload;
      })
      .catch((e) => {
        setReferenceError(e.message);
        throw e;
      })
      .finally(() => {
        setRefsLoading(false);
        refsPromise.current = null;
      });
    return refsPromise.current;
  }, []);

  const loadReferences = useCallback(() => { ensureReferences().catch(() => {}); }, [ensureReferences]);

  const globalMode = useMemo(() => {
    if (debouncedIngredient.trim()) return 'ingredient';
    if (debouncedQ.trim().length >= 2) return 'search';
    if (area) return 'area';
    if (mealCat) return 'category';
    return 'browse';
  }, [debouncedIngredient, debouncedQ, area, mealCat]);

  /* First page of global results. Browse mode seeds ONE source so the
     initial page stays at a single request. */
  useEffect(() => {
    fetchToken.current += 1;
    const token = fetchToken.current;
    setLoadingMore(false);
    setMoreError('');
    setExhausted(false);
    setGlobal([]);
    loadedSources.current = new Set();
    setLoadedSourceCount(0);

    if (source === 'local') { setGlobalState('idle'); return; }

    let alive = true;
    setGlobalState('loading');
    setGlobalError('');

    const run = () => {
      if (globalMode === 'ingredient') return provider.filterByIngredient(debouncedIngredient.trim());
      if (globalMode === 'search') return provider.searchByName(debouncedQ.trim());
      if (globalMode === 'area') return provider.filterByArea(area);
      if (globalMode === 'category') return provider.filterByCategory(mealCat);
      return provider.browseByLetter(FIRST_LETTER);
    };

    if (globalMode === 'browse') {
      loadedSources.current = new Set(['letter:' + FIRST_LETTER]);
      setLoadedSourceCount(1);
    }

    run()
      .then((list) => {
        if (!alive || fetchToken.current !== token) return;
        setGlobal(mergeUniqueRecipes([], list));
        setGlobalState('ready');
      })
      .catch((e) => {
        if (!alive || fetchToken.current !== token) return;
        setGlobal([]);
        setGlobalError(e.message);
        setGlobalState('error');
      });

    return () => { alive = false; };
  }, [source, globalMode, debouncedQ, debouncedIngredient, area, mealCat, retryTick, setGlobal, lang]);

  useEffect(() => {
    const ids = getRecentlyViewed(uid);
    setRecent(ids.map(resolveRecipe).filter(Boolean).slice(0, 4));
    const missing = ids.filter((id) => isExternalRecipeId(id) && !getExternalRecipe(id));
    if (missing.length) {
      hydrateExternalRecipes(missing).then(() => {
        setRecent(getRecentlyViewed(uid).map(resolveRecipe).filter(Boolean).slice(0, 4));
      });
    }
  }, [uid]);

  /* ---------------- local result list ---------------- */
  const catsKey = cats.join('|');
  const localList = useMemo(() => {
    let l = recipes.slice();
    const term = debouncedQ.trim().toLowerCase();
    if (term) {
      l = l.filter((r) => {
        const ing = (r.ingredients || []).some((i) => (i.name || '').toLowerCase().indexOf(term) !== -1);
        const tags = (r.tags || []).some((t) => t.toLowerCase().indexOf(term) !== -1);
        return (
          r.name.toLowerCase().indexOf(term) !== -1 ||
          (r.description || '').toLowerCase().indexOf(term) !== -1 ||
          (r.cuisine || '').toLowerCase().indexOf(term) !== -1 ||
          (r.category || '').toLowerCase().indexOf(term) !== -1 ||
          (r.dietaryPreference || '').toLowerCase().indexOf(term) !== -1 ||
          tags || ing
        );
      });
    }
    const ing = debouncedIngredient.trim().toLowerCase();
    if (ing) l = l.filter((r) => (r.ingredients || []).some((i) => (i.name || '').toLowerCase().indexOf(ing) !== -1));

    if (cuisine) l = l.filter((r) => r.cuisine === cuisine);
    if (diet) l = l.filter((r) => r.dietaryPreference === diet);
    if (difficulty) l = l.filter((r) => r.difficulty === difficulty);
    if (maxTime) l = l.filter((r) => (Number(r.prepTime) + Number(r.cookTime)) <= Number(maxTime));
    if (cats.length) l = l.filter((r) => cats.indexOf(r.category) !== -1);

    const rate = (id) => ratings[id] || { avg: 0, count: 0 };
    if (sort === 'rating') l.sort((a, b) => rate(b.id).avg - rate(a.id).avg);
    else if (sort === 'popular') l.sort((a, b) => rate(b.id).count - rate(a.id).count);
    else if (sort === 'newest') l.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === 'time') l.sort((a, b) => (Number(a.prepTime) + Number(a.cookTime)) - (Number(b.prepTime) + Number(b.cookTime)));
    return l;
  }, [recipes, ratings, debouncedQ, debouncedIngredient, cuisine, diet, difficulty, maxTime, sort, catsKey]); // eslint-disable-line

  /* Allergy status is computed once per recipe, not per render of a card. */
  const localStatuses = useMemo(() => {
    const map = {};
    localList.forEach((r) => { map[r.id] = detectAllergens(r, prefs); });
    return map;
  }, [localList, prefs.allergies, prefs.customAvoid]); // eslint-disable-line

  const localShown = useMemo(() => localList.filter((r) => {
    const status = localStatuses[r.id] ? localStatuses[r.id].status : 'incomplete';
    return !isHiddenByAllergens(status, allergyOptions);
  }), [localList, localStatuses, allergyOptions.hideDetected, allergyOptions.strict]); // eslint-disable-line
  const localHidden = localList.length - localShown.length;

  const globalStatuses = useMemo(() => {
    const map = {};
    globalList.forEach((r) => { map[r.id] = detectAllergens(r, prefs); });
    return map;
  }, [globalList, prefs.allergies, prefs.customAvoid]); // eslint-disable-line

  const globalShown = useMemo(() => globalList.filter((r) => {
    const status = globalStatuses[r.id] ? globalStatuses[r.id].status : 'incomplete';
    return !isHiddenByAllergens(status, allergyOptions);
  }), [globalList, globalStatuses, allergyOptions.hideDetected, allergyOptions.strict]); // eslint-disable-line
  const globalHidden = globalList.length - globalShown.length;

  useEffect(() => { setVisibleLocal(PAGE_SIZE); }, [debouncedQ, debouncedIngredient, cuisine, diet, difficulty, maxTime, sort, catsKey]); // eslint-disable-line
  useEffect(() => { setVisibleGlobal(PAGE_SIZE); }, [globalMode, debouncedQ, debouncedIngredient, area, mealCat, source]); // eslint-disable-line

  const reset = () => {
    setQ(''); setCuisine(''); setDiet(''); setDifficulty(''); setMaxTime(''); setSort('rating'); setCats([]);
    setIngredient(''); setDebouncedIngredient(''); setArea(''); setMealCat('');
    setParams({});
  };

  const toggleCat = (name) => setCats((c) => (c.indexOf(name) !== -1 ? c.filter((x) => x !== name) : [...c, name]));

  const updateAllergyPref = (patch) => {
    const next = savePreferences(uid, patch);
    setPrefs(next);
  };

  const toggleSave = (id) => {
    if (isExternalRecipeId(id)) {
      const found = globalRef.current.find((r) => r.id === id);
      if (found) saveExternalRecipe(found);
    }
    toggleSaved(id, uid);
    force((n) => n + 1);
  };

  const surprise = async () => {
    setSurpriseBusy(true);
    try {
      const meal = await provider.random();
      if (!meal) throw new Error('TheMealDB did not return a recipe.');
      saveExternalRecipe(meal);
      navigate(`/recipe/${meal.id}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSurpriseBusy(false);
    }
  };

  /**
   * Load More:
   *   1. reveal the next page of already-loaded recipes;
   *   2. otherwise fetch the next 1–2 discovery sources (letters →
   *      categories → cuisines), skipping sources that add nothing,
   *      bounded so one click never fans out into many requests.
   */
  const loadMoreGlobal = async () => {
    if (globalMode !== 'browse' || loadingMore) return;

    if (visibleGlobal < globalShown.length) {
      setVisibleGlobal((v) => Math.min(v + PAGE_SIZE, globalShown.length));
      return;
    }

    const token = fetchToken.current;
    setLoadingMore(true);
    setMoreError('');
    let merged = globalRef.current;
    let added = 0;

    try {
      for (let step = 0; step < MAX_FETCHES_PER_CLICK; step += 1) {
        let plan = buildBrowsePlan({ categories: refsRef.current.categories, areas: refsRef.current.areas });
        let queue = pendingSources(plan, loadedSources.current);

        if (!queue.length && !refsRef.current.loaded) {
          await ensureReferences();
          plan = buildBrowsePlan({ categories: refsRef.current.categories, areas: refsRef.current.areas });
          queue = pendingSources(plan, loadedSources.current);
        }
        if (!queue.length) { setExhausted(true); break; }

        const batch = nextSources(plan, loadedSources.current, SOURCES_PER_CLICK);
        const results = await Promise.all(batch.map(fetchSource));
        if (fetchToken.current !== token) return;

        batch.forEach((s) => loadedSources.current.add(s.key));
        const before = merged.length;
        merged = mergeUniqueRecipes(merged, results.flat());
        added += merged.length - before;
        if (added > 0) break;
      }

      if (fetchToken.current !== token) return;
      setGlobal(merged);
      setLoadedSourceCount(loadedSources.current.size);
      if (added > 0) setVisibleGlobal((v) => v + PAGE_SIZE);

      const plan = buildBrowsePlan({ categories: refsRef.current.categories, areas: refsRef.current.areas });
      if (!pendingSources(plan, loadedSources.current).length) setExhausted(true);
    } catch (e) {
      if (fetchToken.current === token) setMoreError(e.message);
    } finally {
      if (fetchToken.current === token) setLoadingMore(false);
    }
  };

  /* ---------------- chips + counts ---------------- */
  const chips = [];
  if (debouncedQ.trim()) chips.push(`Search: "${debouncedQ.trim()}"`);
  if (debouncedIngredient.trim()) chips.push(`Ingredient: ${debouncedIngredient.trim()}`);
  if (cuisine) chips.push(`Cuisine: ${cuisine}`);
  if (area) chips.push(`World cuisine: ${area}`);
  if (mealCat) chips.push(`Meal type: ${mealCat}`);
  if (diet) chips.push(`Diet: ${diet}`);
  if (difficulty) chips.push(`Difficulty: ${difficulty}`);
  if (maxTime) chips.push(`Max time: ${maxTime} min`);
  if (cats.length) chips.push(`Categories: ${cats.join(', ')}`);

  const noFilters = !debouncedQ.trim() && !debouncedIngredient.trim() && !cuisine && !diet
    && !difficulty && !maxTime && !cats.length && !area && !mealCat;

  const localToShow = localShown.slice(0, visibleLocal);
  const globalToShow = globalShown.slice(0, visibleGlobal);
  const localCanLoadMore = localShown.length > visibleLocal;
  const globalCanLoadMore = globalShown.length > visibleGlobal ||
    (globalMode === 'browse' && !exhausted);
  const totalFound = (source === 'global' ? 0 : localShown.length) + (source === 'local' ? 0 : globalShown.length);
  const hiddenByAllergy = (source === 'global' ? 0 : localHidden) + (source === 'local' ? 0 : globalHidden);

  return (
    <UserLayout>
      <div className="page-head">
        <div>
          <h1>🔍 {t('explore.title')}</h1>
          <p>{t('explore.sub')}</p>
        </div>
      </div>

      <div className="container section-pad" style={{ paddingTop: 0 }}>
        <div className="explore-layout">
          {/* ---------- Filters sidebar ---------- */}
          <aside className="filter-panel" aria-label="Recipe filters" onPointerDown={loadReferences}>
            <h3>⚙️ {t('explore.filters')}</h3>

            <div className="filter-group">
              <h4>{t('explore.source')}</h4>
              <select value={source} onChange={(e) => setSource(e.target.value)} aria-label={t('explore.source')}>
                <option value="all">{t('explore.sourceAll')}</option>
                <option value="local">{t('explore.sourceLocal')}</option>
                <option value="global">{t('explore.sourceGlobal')}</option>
              </select>
            </div>

            <div className="filter-group">
              <h4>{t('explore.ingredient')}</h4>
              <input
                type="text"
                placeholder={t('explore.ingredientPlaceholder')}
                value={ingredient}
                onChange={(e) => setIngredient(e.target.value)}
                aria-label={t('explore.ingredient')}
              />
            </div>

            <div className="filter-group">
              <h4>{t('explore.worldCuisine')}</h4>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={source === 'local'}
                aria-label={t('explore.worldCuisine')}
                onFocus={loadReferences}
                onMouseDown={loadReferences}
              >
                <option value="">{t('explore.allCountries')}</option>
                {refsLoading && <option value="__loading" disabled>{t('explore.loadingCountries')}</option>}
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {referenceError && <div className="field-note">⚠ {referenceError}</div>}
            </div>

            <div className="filter-group">
              <h4>{t('explore.mealType')}</h4>
              <select
                value={mealCat}
                onChange={(e) => setMealCat(e.target.value)}
                disabled={source === 'local'}
                aria-label={t('explore.mealType')}
                onFocus={loadReferences}
                onMouseDown={loadReferences}
              >
                <option value="">{t('explore.allMealTypes')}</option>
                {refsLoading && <option value="__loading" disabled>{t('explore.loadingMealTypes')}</option>}
                {mealCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <h4>{t('nav.categories')}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categories.map((c) => {
                  const active = cats.indexOf(c.name) !== -1;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`badge badge-chip${active ? ' active' : ''}`}
                      onClick={() => toggleCat(c.name)}
                      aria-pressed={active}
                    >
                      {catIcon(c.name)} {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="filter-group">
              <h4>{t('explore.cuisineLabel')}</h4>
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label={t('explore.cuisineLabel')}>
                <option value="">{t('explore.allCuisines')}</option>
                {CUISINES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <h4>{t('explore.dietLabel')}</h4>
              <select value={diet} onChange={(e) => setDiet(e.target.value)} aria-label={t('explore.dietLabel')}>
                <option value="">{t('explore.allDiets')}</option>
                {DIETS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <div className="field-note">{t('explore.dietNote')}</div>
            </div>

            <div className="filter-group">
              <h4>{t('explore.difficultyLabel')}</h4>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label={t('explore.difficultyLabel')}>
                <option value="">{t('explore.anyDifficulty')}</option>
                {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <h4>{t('explore.maxTime')}</h4>
              <input
                type="number"
                min="0"
                placeholder="30"
                value={maxTime}
                onChange={(e) => setMaxTime(e.target.value)}
                aria-label={t('explore.maxTime')}
              />
            </div>

            <div className="filter-group">
              <h4>🛡️ {t('explore.allergies')}</h4>
              {hasAllergyPrefs ? (
                <>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={prefs.hideAllergens !== false}
                      onChange={(e) => updateAllergyPref({ hideAllergens: e.target.checked })}
                    />
                    <span>{t('explore.hideAllergens')} ({(prefs.allergies || []).concat(prefs.customAvoid || []).join(', ')})</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={!!prefs.strictAllergens}
                      onChange={(e) => updateAllergyPref({ strictAllergens: e.target.checked })}
                    />
                    <span>{t('explore.strictAllergens')}</span>
                  </label>
                  <div className="field-note">{t('explore.allergenDisclaimer')}</div>
                </>
              ) : (
                <div className="field-note">
                  {t('explore.noAllergyPrefs')} <Link to="/onboarding">{t('explore.addAllergies')}</Link>
                </div>
              )}
            </div>

            <div className="filter-group">
              <h4>{t('explore.sortBy')}</h4>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('explore.sortBy')}>
                <option value="rating">{t('explore.sortRating')}</option>
                <option value="popular">{t('explore.sortPopular')}</option>
                <option value="newest">{t('explore.sortNewest')}</option>
                <option value="time">{t('explore.sortQuickest')}</option>
              </select>
            </div>

            <div className="filter-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>↺ {t('explore.resetFilters')}</button>
            </div>
            <div className="filter-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={surprise} disabled={surpriseBusy}>
                {surpriseBusy ? t('explore.surpriseBusy') : `🎲 ${t('explore.surprise')}`}
              </button>
            </div>
          </aside>

          {/* ---------- Results ---------- */}
          <div>
            <div className="explore-topbar">
              <div className="explore-search">
                <input
                  type="text"
                  placeholder={t('common.searchPlaceholder')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label={t('common.search')}
                />
              </div>
              <span className="result-count" aria-live="polite">
                {totalFound} {t('explore.found')}
              </span>
            </div>

            {hiddenByAllergy > 0 && (
              <div className="allergy-note" role="status">
                🛡️ {hiddenByAllergy} {t('explore.hiddenByAllergy')}
                {prefs.strictAllergens ? ` ${t('explore.strictNote')}` : ''}
              </div>
            )}

            {chips.length > 0 && (
              <div className="active-filters">
                {chips.map((c, i) => <span key={i} className="badge">{c}</span>)}
              </div>
            )}

            {/* ---------- Recently viewed (only on a clean Explore) ---------- */}
            {noFilters && source !== 'global' && recent.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h2 className="section-title" style={{ fontSize: '1.15rem' }}>🕘 {t('explore.recentlyViewed')}</h2>
                  </div>
                  <Link to="/saved" className="btn btn-ghost btn-sm">{t('explore.savedRecipes')} →</Link>
                </div>
                <div className="recipe-grid">
                  {recent.map((r) => (
                    <RecipeCard key={r.id} recipe={r} saved={savedIds.includes(r.id)} onToggleSave={() => toggleSave(r.id)} allergenStatus={detectAllergens(r, prefs).status} />
                  ))}
                </div>
              </section>
            )}

            {/* ---------- CraveCart kitchen ---------- */}
            {source !== 'global' && (
              <section>
                {source === 'all' && (
                  <div className="section-head" style={{ marginBottom: 14 }}>
                    <div>
                      <h2 className="section-title" style={{ fontSize: '1.15rem' }}>🍳 {t('explore.kitchenSection')}</h2>
                      <p className="section-sub">{t('explore.kitchenSub')}</p>
                    </div>
                    <span className="result-count">{localShown.length} {t('explore.loaded')}</span>
                  </div>
                )}

                {localShown.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>{t('explore.emptyLocalTitle')}</h3>
                    <p>{localHidden > 0 ? t('explore.hiddenAllergyBody') : t('explore.emptyLocalBody')}</p>
                    <button className="btn btn-outline" onClick={reset}>{t('explore.resetFilters')}</button>
                  </div>
                ) : (
                  <>
                    <div className="recipe-grid">
                      {localToShow.map((r) => (
                        <RecipeCard
                          key={r.id}
                          recipe={r}
                          saved={savedIds.includes(r.id)}
                          onToggleSave={() => toggleSave(r.id)}
                          allergenStatus={localStatuses[r.id] ? localStatuses[r.id].status : 'incomplete'}
                        />
                      ))}
                    </div>
                    {localCanLoadMore && (
                      <div className="load-more-row">
                        <button className="btn btn-outline" onClick={() => setVisibleLocal((v) => v + PAGE_SIZE)}>
                          {t('common.loadMore')}
                        </button>
                        <span className="muted small">
                          {t('common.showing')} {localToShow.length} {t('common.of')} {localShown.length} {t('explore.loaded')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ---------- Global kitchen ---------- */}
            {source !== 'local' && (
              <section style={{ marginTop: source === 'all' ? 36 : 0 }}>
                <div className="section-head" style={{ marginBottom: 14 }}>
                  <div>
                    <h2 className="section-title" style={{ fontSize: '1.15rem' }}>🌍 {t('explore.globalSection')}</h2>
                    <p className="section-sub">{t('explore.globalSub')}</p>
                  </div>
                  <span className="result-count">
                    {globalState === 'ready' ? `${globalShown.length} ${t('explore.loaded')}` : t('explore.globalRecipes')}
                  </span>
                </div>

                {globalState === 'error' && (
                  <div className="fetch-error">
                    <span>⚠ {globalError}</span>
                    <button className="btn btn-outline btn-sm" onClick={() => setRetryTick((n) => n + 1)}>{t('common.retry')}</button>
                  </div>
                )}

                {globalState === 'loading' && (
                  <div className="recipe-grid" aria-busy="true" aria-label="Loading global recipes">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div className="skeleton-card" key={i}>
                        <div className="sk-img" />
                        <div className="sk-body">
                          <div className="sk-line" />
                          <div className="sk-line short" />
                          <div className="sk-line tiny" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {globalState === 'ready' && globalShown.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">🌍</div>
                    <h3>{t('explore.emptyGlobalTitle')}</h3>
                    <p>{globalHidden > 0 ? t('explore.hiddenAllergyBody') : t('explore.emptyGlobalBody')}</p>
                  </div>
                )}

                {globalState === 'ready' && globalShown.length > 0 && (
                  <>
                    <div className="recipe-grid">
                      {globalToShow.map((r) => (
                        <RecipeCard
                          key={r.id}
                          recipe={r}
                          saved={savedIds.includes(r.id)}
                          onToggleSave={() => toggleSave(r.id)}
                          allergenStatus={globalStatuses[r.id] ? globalStatuses[r.id].status : 'incomplete'}
                        />
                      ))}
                    </div>

                    {moreError && (
                      <div className="fetch-error" style={{ marginTop: 16 }}>
                        <span>⚠ {moreError}</span>
                        <button className="btn btn-outline btn-sm" onClick={loadMoreGlobal}>{t('common.retry')}</button>
                      </div>
                    )}

                    <div className="load-more-row">
                      {globalCanLoadMore && (
                        <button
                          className="btn btn-outline"
                          onClick={loadMoreGlobal}
                          disabled={loadingMore}
                          aria-busy={loadingMore}
                        >
                          {loadingMore
                            ? <><span className="spinner" aria-hidden="true" />{t('explore.loadingMore')}</>
                            : t('common.loadMore')}
                        </button>
                      )}
                      <span className="muted small" aria-live="polite">
                        {t('common.showing')} {globalToShow.length} {t('common.of')} {globalShown.length} {t('explore.loaded')}
                      </span>
                    </div>

                    <p className="source-note">
                      {globalMode === 'browse'
                        ? (exhausted
                          ? `${t('explore.allLoaded', { n: globalShown.length })} `
                          : `${t('explore.moreAvailable')} `)
                        : `${globalShown.length} ${t('explore.forFilter')} `}
                      {t('explore.dataFrom')}{' '}
                      <a href="https://www.themealdb.com" target="_blank" rel="noopener noreferrer">TheMealDB</a>.{' '}
                      {t('explore.sourceNote')}
                    </p>
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
