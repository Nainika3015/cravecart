/* ============================================================
   CraveCart - Home.jsx (User Home)
   Hero, live stats, personalised sections (Phase 2) and the
   original popular / trending / top-rated rows + categories grid.

   Every number, reason and match is derived from stored data:
   recipe fields, reviews, saves, pantry items and preferences.
   ============================================================ */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout.jsx';
import RecipeCard from '../components/RecipeCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
  getRecipes, getSavedIds, toggleSaved, getCategories, catIcon,
  countCategoryRecipes, getRatingsMap, resolveRecipe, getRecentlyViewed,
  getCachedExternalRecipes,
} from '../services/storageService.js';
import { getData, LS_KEYS } from '../services/storageCore.js';
import { getPreferences, preferencesSummary } from '../services/preferences.js';
import { getPantry, decoratePantry } from '../services/pantry.js';
import { buildHomeSections } from '../services/recommendations.js';

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  /* The headline is a translated template with one highlighted word. */
  const heroTitle = t('home.title', { highlight: '\u0000' }).split('\u0000');

  /* Read Local Storage once per mount instead of on every keystroke. */
  const recipes = useMemo(() => getRecipes(), []);
  const categories = useMemo(() => getCategories(), []);
  const ratings = useMemo(() => getRatingsMap(), []);
  const users = useMemo(() => getData(LS_KEYS.USERS) || [], []);
  const savedIds = getSavedIds(user.id);
  const savedRecipes = useMemo(
    () => savedIds.map(resolveRecipe).filter(Boolean),
    [savedIds.join('|')] // eslint-disable-line
  );
  const prefs = useMemo(() => getPreferences(user.id), [user.id]);
  const pantry = useMemo(() => decoratePantry(getPantry(user.id)), [user.id]);
  const recentRecipes = useMemo(
    () => getRecentlyViewed(user.id).map(resolveRecipe).filter(Boolean).slice(0, 4),
    [user.id]
  );

  const [q, setQ] = useState('');
  const [, force] = useState(0);

  /* Recommendations may also use global recipes whose full detail is
     already cached from browsing — still zero extra API calls. */
  const recommendationPool = useMemo(() => {
    const cached = getCachedExternalRecipes().filter((r) => (r.ingredients || []).length > 0);
    const seen = new Set(recipes.map((r) => r.id));
    return [...recipes, ...cached.filter((r) => !seen.has(r.id))];
  }, [recipes]);

  const sections = useMemo(() => {
    if (!prefs.onboarded || !recommendationPool.length) return [];
    return buildHomeSections({ recipes: recommendationPool, prefs, pantry, savedRecipes, ratings, limit: 4 });
  }, [prefs, pantry, savedRecipes, recommendationPool, ratings]);

  const rate = (id) => ratings[id] || { avg: 0, count: 0 };

  /* Real engagement data: how many accounts saved each recipe. */
  const saveCounts = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      (u.savedRecipes || []).forEach((rid) => { counts[rid] = (counts[rid] || 0) + 1; });
    });
    return counts;
  }, [users]);

  const popular = recipes.slice()
    .sort((a, b) => {
      const diff = (saveCounts[b.id] || 0) - (saveCounts[a.id] || 0);
      if (diff !== 0) return diff;
      return rate(b.id).count - rate(a.id).count || new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 4);

  const trending = recipes.slice()
    .sort((a, b) => rate(b.id).count - rate(a.id).count || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  const topRated = recipes.slice()
    .sort((a, b) => rate(b.id).avg - rate(a.id).avg)
    .slice(0, 4);

  const chefs = users.filter((u) => recipes.some((r) => r.author === u.id)).length;

  const heroSearch = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
  };

  /* "#categories" navbar link scrolls to the categories section */
  useEffect(() => {
    if (location.hash === '#categories') {
      const el = document.getElementById('categories');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [location.hash]);

  const toggleSave = (id) => { toggleSaved(id, user.id); force((n) => n + 1); };

  const heroImages = [8, 24, 42, 6].map((i) => recipes[i]).filter(Boolean);

  const card = (r, extra = {}) => (
    <RecipeCard
      key={r.id}
      recipe={r}
      saved={savedIds.includes(r.id)}
      onToggleSave={() => toggleSave(r.id)}
      {...extra}
    />
  );

  /* One legacy section: heading + "View All" + recipe grid */
  const recipeSection = (title, sub, gridId, list) => (
    <section className="section-pad">
      <div className="container">
        <div className="section-head">
          <div>
            <h2 className="section-title">{title}</h2>
            <p className="section-sub">{sub}</p>
          </div>
          <Link to="/explore" className="btn btn-ghost btn-sm">{t('common.viewAll')} →</Link>
        </div>
        <div className="recipe-grid" id={gridId}>
          {list.map((r) => card(r))}
        </div>
      </div>
    </section>
  );

  const personalSection = (section) => (
    <section className="section-pad" key={section.id} id={'section-' + section.id}>
      <div className="container">
        <div className="section-head">
          <div>
            <h2 className="section-title">{section.title}</h2>
            <p className="section-sub">{section.subtitle}</p>
          </div>
          {section.id === 'cook' && <Link to="/pantry" className="btn btn-ghost btn-sm">{t('home.openPantry')} →</Link>}
          {section.id === 'recommended' && <Link to="/explore" className="btn btn-ghost btn-sm">{t('common.viewAll')} →</Link>}
        </div>
        <div className="recipe-grid">
          {section.recipes.map((entry) =>
            card(entry.recipe, { reasons: entry.reasons, warnings: entry.warnings })
          )}
        </div>
      </div>
    </section>
  );

  return (
    <UserLayout>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="hero-eyebrow">🍳 {t('home.eyebrow')}</span>
            <h1>{heroTitle[0]}<span className="highlight">{t('home.highlight')}</span>{heroTitle[1]}</h1>
            <p className="hero-sub">
              {t('home.sub')}{user ? ` · ${user.name}` : ''}
            </p>
            <form className="hero-search" id="hero-search-form" onSubmit={heroSearch}>
              <input
                id="hero-search"
                type="text"
                placeholder={t('home.searchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t('home.search')}
              />
              <button type="submit" className="btn btn-primary">{t('home.search')}</button>
            </form>
            <div className="hero-actions">
              <Link to="/explore" className="btn btn-primary">{t('home.explore')}</Link>
              <Link to="/create" className="btn btn-outline">{t('home.create')}</Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><div className="num">{recipes.length}</div><div className="lbl">{t('home.kitchenRecipes')}</div></div>
              <div className="hero-stat"><div className="num">{categories.length}</div><div className="lbl">{t('home.categories')}</div></div>
              <div className="hero-stat"><div className="num">{chefs}</div><div className="lbl">{t('home.chefs')}</div></div>
            </div>
            <p className="hero-stat-note">{t('home.globalNote', { n: recipes.length })}</p>
          </div>
          <div className="hero-art">
            {heroImages.map((r) => (
              <Link key={r.id} to={`/recipe/${r.id}`} title={r.name}>
                <img src={r.image} alt={r.name} loading="lazy" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Personalised welcome / invite ---------- */}
      {prefs.onboarded ? (
        <section className="welcome-strip">
          <div className="container welcome-inner">
            <div>
              <div className="welcome-eyebrow">{t('home.welcomeBack')}</div>
              <h2 className="welcome-name">{prefs.name || user.name} 👋</h2>
              <div className="pref-chips">
                {preferencesSummary(prefs).map((chip) => (
                  <span className="pref-chip" key={chip}>{chip}</span>
                ))}
              </div>
            </div>
            <div className="welcome-actions">
              <Link to="/pantry" className="btn btn-primary btn-sm">🧺 {t('home.openPantry')}</Link>
              <Link to="/onboarding" className="btn btn-outline btn-sm">{t('home.editPreferences')}</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="personalize-wrap">
          <div className="container">
            <div className="personalize-banner">
              <div>
                <strong>{t('home.personalizeTitle')}</strong>
                <p>{t('home.personalizeBody')}</p>
              </div>
              <Link to="/onboarding" className="btn btn-primary">{t('home.personalizeCta')}</Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Personalised sections ---------- */}
      {sections.map((section) => personalSection(section))}

      {/* ---------- Recently viewed ---------- */}
      {recentRecipes.length > 0 && (
        <section className="section-pad" style={{ background: 'var(--bg-alt)' }}>
          <div className="container">
            <div className="section-head">
              <div>
                <h2 className="section-title">🕘 {t('home.recentlyViewed')}</h2>
                <p className="section-sub">{t('home.recentlyViewedSub')}</p>
              </div>
              <Link to="/saved" className="btn btn-ghost btn-sm">{t('explore.savedRecipes')} →</Link>
            </div>
            <div className="recipe-grid">
              {recentRecipes.map((r) => card(r))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Popular ---------- */}
      {recipeSection('🔥 ' + t('home.popular'), t('home.popularSub'), 'popular-grid', popular)}

      {/* ---------- Trending ---------- */}
      {recipeSection('📈 ' + t('home.trending'), t('home.trendingSub'), 'trending-grid', trending)}

      {/* ---------- Top rated ---------- */}
      {recipeSection('⭐ ' + t('home.topRated'), t('home.topRatedSub'), 'toprated-grid', topRated)}

      {/* ---------- Categories ---------- */}
      <section id="categories" style={{ background: 'var(--bg-alt)', padding: '56px 0 64px' }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2 className="section-title">🍽️ {t('home.popularCategories')}</h2>
              <p className="section-sub">{t('home.pickMood')}</p>
            </div>
          </div>
          <div className="cat-grid" id="categories-grid">
            {categories.map((c) => (
              <Link key={c.id} className="cat-card" to={`/explore?q=${encodeURIComponent(c.name)}`}>
                <div className="cat-icon">{catIcon(c.name)}</div>
                <div className="cat-name">{c.name}</div>
                <div className="cat-count">{countCategoryRecipes(c, recipes)} recipes</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </UserLayout>
  );
}
