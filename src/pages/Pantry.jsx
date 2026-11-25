/* ============================================================
   CraveCart - Pantry.jsx  (Phase 2 · Smart Pantry)

   • Search the real ingredient names from the CraveCart catalogue
   • Add custom ingredients and optional expiry dates
   • Compare the pantry against actual recipe ingredient lists
   • Show match %, confirmed ingredients, assumed staples, missing
     ingredients, related products, substitutes, diet + allergens
   • Filter and sort by real availability and preferences

   All local data: no extra TheMealDB requests are made here.
   ============================================================ */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserLayout from '../components/UserLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getRecipes, getRatingsMap, resolveRecipe, getSavedIds, FALLBACK_IMG
} from '../services/storageService.js';
import { getCachedExternalRecipes } from '../services/mealDb.js';
import { getPreferences, savePreferences } from '../services/preferences.js';
import {
  getPantry, savePantry, decoratePantry, buildIngredientSuggestions,
  expiringSoon, expiredItems
} from '../services/pantry.js';
import {
  pantryRecommendations, expiringRecommendations, totalTime
} from '../services/recommendations.js';
import { cuisineMatches } from '../services/ingredients.js';
import { allergenStatusLabel } from '../services/allergens.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const MAX_RESULTS = 8;

/* Recipe ingredient names carry preparation notes ("Tomatoes, blended",
   "Onion (finely chopped)"). Matching uses the full string; the UI shows
   the readable ingredient name only. */
function niceName(name) {
  return String(name || '').split(',')[0].split('(')[0].trim();
}

function withAmount(name, amount) {
  const clean = niceName(name);
  return amount ? `${clean} (${amount})` : clean;
}

export function filterPantryResults(list, filter, prefs = {}) {
  if (filter === 'full') return list.filter((e) => e.match.percentageWithStaples === 100);
  if (filter === 'one') return list.filter((e) => e.match.missingCount === 1);
  if (filter === 'two') return list.filter((e) => e.match.missingCount === 2);
  if (filter === 'subs') return list.filter((e) => (e.match.substitutions || []).length > 0 || (e.match.related || []).length > 0);
  if (filter === 'exact') {
    return list.filter((e) => e.match.confirmed.length > 0 &&
      e.match.confirmed.every((c) => c.level === 'exact'));
  }
  if (filter === 'quick') {
    return list.filter((e) => {
      const t = totalTime(e.recipe);
      return t !== null && t <= 30;
    });
  }
  if (filter === 'cuisine') {
    return list.filter((e) => cuisineMatches(e.recipe.cuisine, prefs.cuisines || []));
  }
  return list;
}

function MatchCard({ entry }) {
  const { t } = useI18n();
  const { recipe, match, diet, allergenStatus } = entry;
  const [expanded, setExpanded] = useState(false);
  const subs = (match.substitutions || []).slice(0, expanded ? 4 : 1);

  return (
    <article className="pantry-match-card">
      <Link to={`/recipe/${recipe.id}`} className="pm-thumb">
        <img
          src={recipe.image || FALLBACK_IMG}
          alt={recipe.name}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
        />
      </Link>
      <div className="pm-body">
        <div className="pm-head">
          <div>
            <Link to={`/recipe/${recipe.id}`} className="pm-title">{recipe.name}</Link>
            <div className="pm-sub">
              {[recipe.cuisine, recipe.category].filter(Boolean).join(' · ') || 'CraveCart recipe'}
              {recipe.source === 'mealdb' ? ' · TheMealDB' : ''}
            </div>
          </div>
          <div className="pm-score">
            <span className="pm-pct">{match.percentage}%</span>
            {match.assumed.length > 0 && (
              <span className="pm-sub-pct">{match.percentageWithStaples}% with staples</span>
            )}
          </div>
        </div>

        <div
          className="match-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={match.percentage}
          aria-label={`Confirmed ingredient match for ${recipe.name}`}
        >
          <div className="match-fill" style={{ width: match.percentage + '%' }} />
        </div>

        <div className="pm-line">
          <span className="pm-key ok">{t('pantry.confirmed')}</span>{' '}
          {match.confirmed.length
            ? match.confirmed.map((c) => withAmount(c.name, c.amount)).join(', ')
            : <span className="muted">{t('pantry.nothingYet')}</span>}
        </div>

        {match.assumed.length > 0 && (
          <div className="pm-line">
            <span className="pm-key assumed">{t('pantry.assumed')}</span>{' '}
            {match.assumed.map((a) => withAmount(a.name, a.amount)).join(', ')}
            <span className="muted small"> — {t('pantry.notConfirmed')}</span>
          </div>
        )}

        <div className="pm-line">
          <span className="pm-key miss">{t('pantry.missing')}</span>{' '}
          {match.missing.length
            ? match.missing.map((m) => withAmount(m.name, m.amount)).join(', ')
            : <span className="ok-text">{t('pantry.ready')}</span>}
        </div>

        {match.related.length > 0 && (
          <div className="pm-note">
            ⚠ {t('pantry.relatedNote', { list: match.related.map((r) => `${r.pantryName} (${niceName(r.name)})`).join(', ') })}
          </div>
        )}

        <div className="pm-count muted small">
          {t('pantry.matchSummary', { a: match.confirmed.length, b: match.total, p: match.percentage })}
        </div>

        <div className="pm-tags">
          {diet && diet.status !== 'none' && (
            <span className={`badge ${diet.status === 'conflict' ? 'badge-warn' : 'badge-diet'}`}>{diet.label}</span>
          )}
          {allergenStatus && allergenStatus !== 'not-configured' && (
            <span className={`badge ${allergenStatus === 'detected' ? 'badge-warn' : allergenStatus === 'incomplete' ? 'badge-source' : 'badge-diet'}`}>
              {allergenStatusLabel(allergenStatus)}
            </span>
          )}
        </div>

        {match.expiringUsed.length > 0 && (
          <div className="pm-note">
            ⏳ {t('pantry.expiringNote', { list: match.expiringUsed.map((i) => i.name).join(', ') })}
          </div>
        )}
        {match.expiredMatches.length > 0 && (
          <div className="pm-note warn">
            ⚠ {t('pantry.expiredNote', { list: match.expiredMatches.join(', ') })}
          </div>
        )}

        {subs.length > 0 && (
          <div className="sub-list">
            {subs.map((sub) => (
              <div className="sub-block" key={sub.ingredient}>
                <div className="sub-title">{t('pantry.insteadOf')} {niceName(sub.ingredient)}:</div>
                <ul className="sub-options">
                  {sub.options.slice(0, 2).map((opt) => (
                    <li key={opt.name}>
                      <strong>{opt.name}</strong>
                      <span className="sub-ratio"> ({opt.ratio})</span>
                      <span className="sub-note"> — {opt.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(match.substitutions || []).length > 1 && (
              <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)}>
                {expanded ? t('pantry.showFewer') : t('pantry.showMore', { n: match.substitutions.length - 1 })}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Pantry() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, lang } = useI18n();

  const recipes = useMemo(() => getRecipes(), []);
  const ratings = useMemo(() => getRatingsMap(), []);
  const [prefs, setPrefs] = useState(() => getPreferences(user.id));
  const savedIds = getSavedIds(user.id);
  const savedRecipes = useMemo(
    () => savedIds.map(resolveRecipe).filter(Boolean),
    [savedIds.join('|')] // eslint-disable-line
  );

  const [items, setItems] = useState(() => getPantry(user.id));
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customExpiry, setCustomExpiry] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [prioritiseExpiring, setPrioritiseExpiring] = useState(false);
  const [matchFilter, setMatchFilter] = useState('all');
  const [visible, setVisible] = useState(MAX_RESULTS);

  const persist = (next) => {
    const saved = savePantry(user.id, next);
    setItems(saved);
    setSaveNote('Pantry saved on this device');
  };

  const addItem = (name, expiry = '') => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    if (items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      toast(`"${trimmed}" is already in your pantry`, 'info');
      return;
    }
    persist([...items, { name: trimmed, expiry }]);
  };

  const removeItem = (id) => {
    persist(items.filter((i) => i.id !== id));
  };

  const updateExpiry = (id, expiry) => {
    persist(items.map((i) => (i.id === id ? { ...i, expiry } : i)));
  };

  const addCustom = (e) => {
    e.preventDefault();
    if (!customName.trim()) { toast('Enter an ingredient name first', 'error'); return; }
    addItem(customName, customExpiry);
    setCustomName('');
    setCustomExpiry('');
  };

  const setAssumedStaples = (checked) => {
    const next = savePreferences(user.id, { assumeStaples: checked });
    setPrefs(next);
  };

  const decorated = useMemo(() => decoratePantry(items), [items]);
  const expiring = useMemo(() => expiringSoon(items, 5), [items]);
  const expired = useMemo(() => expiredItems(items), [items]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = buildIngredientSuggestions(recipes, 80);
    const existing = new Set(items.map((i) => i.name.toLowerCase()));
    return all
      .filter((s) => !existing.has(s.name.toLowerCase()))
      .filter((s) => (!q ? true : s.name.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [recipes, query, items]);

  /* Local catalogue + already-cached TheMealDB details. No network. */
  const recipePool = useMemo(() => {
    const cached = getCachedExternalRecipes()
      .filter((r) => (r.ingredients || []).length > 0);
    const seen = new Set(recipes.map((r) => r.id));
    return [...recipes, ...cached.filter((r) => !seen.has(r.id))];
  }, [recipes]);

  const results = useMemo(() => {
    const list = pantryRecommendations({
      recipes: recipePool, prefs, pantry: decorated, savedRecipes, ratings, minPercentage: 0
    });
    if (!prioritiseExpiring) return list;
    return list.slice().sort((a, b) =>
      b.match.expiringUsed.length - a.match.expiringUsed.length ||
      b.match.percentage - a.match.percentage
    );
  }, [recipePool, prefs, decorated, savedRecipes, ratings, prioritiseExpiring]);

  const filteredResults = useMemo(
    () => filterPantryResults(results, matchFilter, prefs),
    [results, matchFilter, prefs]
  );

  const expiringPicks = useMemo(() => {
    if (!expiring.length) return [];
    return expiringRecommendations({
      recipes: recipePool, prefs, pantry: decorated, savedRecipes, ratings, days: 5
    }).slice(0, 3);
  }, [recipePool, prefs, decorated, savedRecipes, ratings, expiring.length]);

  const hasPantry = items.length > 0;
  const visibleResults = filteredResults.slice(0, visible);

  return (
    <UserLayout>
      <div className="page-head">
        <div>
          <h1>🧺 {t('pantry.title')}</h1>
          <p>{t('pantry.sub')}</p>
        </div>
        <Link to="/onboarding" className="btn btn-outline btn-sm">
          {prefs.onboarded ? t('home.editPreferences') : t('home.personalizeCta')}
        </Link>
      </div>

      <div className="container section-pad" style={{ paddingTop: 0 }}>
        {!prefs.onboarded && (
          <div className="pantry-banner">
            <span>💡 {t('pantry.allergyBanner')}</span>
            <Link to="/onboarding" className="btn btn-primary btn-sm">{t('pantry.setPreferences')}</Link>
          </div>
        )}

        <div className="pantry-stats">
          <div className="pantry-stat">
            <strong>{items.length}</strong>
            <span>{items.length === 1 ? 'ingredient' : 'ingredients'}</span>
          </div>
          <div className="pantry-stat is-warn">
            <strong>{expiring.length}</strong>
            <span>expiring soon</span>
          </div>
          <div className="pantry-stat is-danger">
            <strong>{expired.length}</strong>
            <span>expired</span>
          </div>
          <span className="save-note" aria-live="polite">{saveNote}</span>
        </div>


        {expired.length > 0 && (
          <div className="fetch-error" style={{ alignItems: 'flex-start' }}>
            <span>
              ⚠ <strong>Do not use:</strong> {expired.map((i) => `${i.name} (${i.label.toLowerCase()})`).join(', ')}.
              Expired items are excluded from every match.
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => persist(items.filter((i) => !expired.some((e) => e.id === i.id)))}
            >
              Remove expired
            </button>
          </div>
        )}

        <div className="pantry-layout">
          {/* ---------------- Pantry panel ---------------- */}
          <aside className="pantry-panel" aria-label="Your pantry">
            <h3>{t('pantry.yourIngredients')}</h3>

            <form onSubmit={addCustom} className="pantry-add">
              <input
                type="text"
                className="form-control"
                placeholder={t('pantry.addIngredient')}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                aria-label={t('pantry.addIngredient')}
                maxLength={40}
              />
              <input
                type="date"
                className="form-control"
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                aria-label="Optional expiry date for the new ingredient"
                title="Optional expiry date"
              />
              <button type="submit" className="btn btn-primary btn-sm">{t('common.add')}</button>
            </form>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label htmlFor="pantry-search" className="onb-label">{t('pantry.quickAdd')}</label>
              <input
                id="pantry-search"
                type="text"
                className="form-control"
                placeholder={t('pantry.searchIngredients')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="chip-wrap" style={{ marginTop: 8 }}>
                {suggestions.length === 0 && (
                  <span className="muted small">
                    {query ? `No ingredient matches “${query}”.` : 'All suggestions are already in your pantry.'}
                  </span>
                )}
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className="choice-chip"
                    onClick={() => addItem(s.name)}
                    title={`Used in ${s.count} CraveCart recipe${s.count === 1 ? '' : 's'}`}
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={!!prefs.assumeStaples}
                onChange={(e) => setAssumedStaples(e.target.checked)}
              />
              <span>Assume common pantry staples (salt, water, oil, sugar, pepper)</span>
            </label>
            <div className="field-note">
              Assumed staples are shown separately and never added to the confirmed match percentage.
            </div>

            <div className="pantry-list-head">
              <span className="onb-label">Saved items</span>
              {hasPantry && (
                <button type="button" className="link-btn" onClick={() => persist([])}>Clear all</button>
              )}
            </div>

            {!hasPantry ? (
              <p className="muted small">Nothing here yet. Add a few ingredients to see recipes you can cook.</p>
            ) : (
              <ul className="pantry-list">
                {decorated.map((item) => (
                  <li className={`pantry-item${item.expired ? ' is-expired' : ''}`} key={item.id}>
                    <div className="pantry-item-main">
                      <span className="pantry-item-name">{item.name}</span>
                      <span className={`expiry-badge ${item.status}`}>{item.label}</span>
                    </div>
                    <div className="pantry-item-row">
                      <input
                        type="date"
                        className="form-control pantry-date"
                        value={item.expiry || ''}
                        onChange={(e) => updateExpiry(item.id, e.target.value)}
                        aria-label={`Expiry date for ${item.name}`}
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name} from pantry`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* ---------------- Results ---------------- */}
          <div>
            {expiring.length > 0 && (
              <section className="pantry-section">
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h2 className="section-title" style={{ fontSize: '1.2rem' }}>♻️ Use It Before You Lose It</h2>
                    <p className="section-sub">
                      Recipes that use {expiring.map((i) => i.name).join(', ')} while still safe to eat.
                    </p>
                  </div>
                </div>
                {expiringPicks.length === 0 ? (
                  <p className="muted small">No recipe in the catalogue uses those ingredients yet.</p>
                ) : (
                  <div className="pantry-match-list">
                    {expiringPicks.map((entry) => (
                      <MatchCard key={entry.recipe.id} entry={entry} />
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="pantry-section">
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.2rem' }}>🍳 What you can cook</h2>
                  <p className="section-sub">
                    Ranked by confirmed availability, then your preferences. Match % = confirmed ingredients ÷ total required.
                  </p>
                </div>
                {hasPantry && filteredResults.length > 0 && (
                  <span className="result-count" aria-live="polite">
                    Showing {visibleResults.length} of {filteredResults.length} matching recipes
                  </span>
                )}
              </div>

              {hasPantry && (
              <div className="pantry-filters">
                <label className="pantry-filter">
                  <span>Filter</span>
                  <select
                    value={matchFilter}
                    onChange={(e) => { setMatchFilter(e.target.value); setVisible(MAX_RESULTS); }}
                    aria-label="Filter matching recipes"
                  >
                    <option value="all">All matches</option>
                    <option value="full">100% ingredient availability</option>
                    <option value="one">One missing ingredient</option>
                    <option value="two">Two missing ingredients</option>
                    <option value="exact">Exact ingredient matches only</option>
                    <option value="subs">Recipes with possible substitutions</option>
                    <option value="quick">Quick recipes (≤ 30 min, known time)</option>
                    <option value="cuisine">My preferred cuisines</option>
                  </select>
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={prioritiseExpiring}
                    onChange={(e) => setPrioritiseExpiring(e.target.checked)}
                    disabled={!expiring.length}
                  />
                  Prioritise expiring
                </label>
              </div>
              )}

              {!hasPantry ? (
                <div className="empty-state">
                  <div className="empty-icon">🧺</div>
                  <h3>{t('pantry.emptyTitle')}</h3>
                  <p>{t('pantry.emptyBody')}</p>
                  <button type="button" className="btn btn-primary" onClick={() => addItem('Onion')}>
                    Start with onion
                  </button>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🥄</div>
                  <h3>No recipes match this filter</h3>
                  <p>
                    {matchFilter === 'all'
                      ? 'Add more ingredients such as rice, tomato, onion, oil or eggs.'
                      : 'Try another filter, or add the missing ingredients to your pantry.'}
                  </p>
                  <button type="button" className="btn btn-outline" onClick={() => setMatchFilter('all')}>Show all matches</button>
                </div>
              ) : (
                <>
                  <div className="pantry-match-list">
                    {visibleResults.map((entry) => (
                      <MatchCard key={entry.recipe.id} entry={entry} />
                    ))}
                  </div>
                  {filteredResults.length > visibleResults.length && (
                    <div className="load-more-row">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setVisible((v) => v + MAX_RESULTS)}
                      >
                        Show more recipes
                      </button>
                      <span className="muted small">{filteredResults.length - visibleResults.length} more matching recipes</span>
                    </div>
                  )}
                  <p className="source-note">
                    Matching uses the ingredient names stored with each recipe. Quantities come from the recipe itself,
                    never from your pantry — CraveCart does not claim you have enough of anything.
                    Substitutions come from CraveCart's curated swap list and explain how taste and texture change.
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
