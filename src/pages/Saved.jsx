/* ============================================================
   CraveCart - Saved.jsx
   Saved recipes now resolve from BOTH the local catalogue and the
   cached TheMealDB set, so global recipes bookmark exactly like
   local ones. Missing global details are fetched once, then cached.
   ============================================================ */

import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import UserLayout from '../components/UserLayout.jsx';
import RecipeCard from '../components/RecipeCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
  getSavedIds, toggleSaved, resolveRecipe, isExternalRecipeId,
  getExternalRecipe, hydrateExternalRecipes,
} from '../services/storageService.js';

export default function Saved() {
  const { user, refreshSession } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [, force] = useState(0);
  const [hydrating, setHydrating] = useState(false);

  const savedIds = getSavedIds(user.id);
  const recipes = savedIds.map(resolveRecipe).filter(Boolean);
  const savedKey = savedIds.join('|');

  /* Global ids saved on another session/link may not be cached yet. */
  useEffect(() => {
    const missing = savedIds.filter((rid) => isExternalRecipeId(rid) && !getExternalRecipe(rid));
    if (!missing.length) {
      setHydrating(false);
      return;
    }
    let alive = true;
    setHydrating(true);
    hydrateExternalRecipes(missing).then((fetched) => {
      if (!alive) return;
      setHydrating(false);
      if (fetched.length) force((n) => n + 1);
    });
    return () => { alive = false; };
  }, [savedKey]); // eslint-disable-line

  /* After un-saving, re-render so the card disappears (legacy 350 ms) */
  const onToggleSave = useCallback(
    (rid) => {
      const nowSaved = toggleSaved(rid, user.id);
      refreshSession();
      toast(nowSaved ? 'Recipe saved to your collection' : 'Recipe removed from saved', nowSaved ? 'success' : 'info');
      if (!nowSaved) setTimeout(() => force((n) => n + 1), 350);
      else force((n) => n + 1);
    },
    [user.id] // eslint-disable-line
  );

  return (
    <UserLayout>
      <div className="page-head">
        <div className="container">
          <h1>🔖 {t('saved.title')}</h1>
          <p className="sub">{t('saved.sub')} ({savedIds.length} {t('common.saved').toLowerCase()})</p>
        </div>
      </div>

      <div className="container section-pad" style={{ paddingTop: 0 }}>
        {recipes.length === 0 && hydrating ? (
          <div className="recipe-grid" aria-busy="true" aria-label="Loading saved recipes">
            {[0, 1, 2, 3].map((i) => (
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
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔖</div>
            <h3>{t('saved.emptyTitle')}</h3>
            <p>{t('saved.emptyBody')}</p>
            <Link to="/explore" className="btn btn-primary">{t('home.explore')}</Link>
          </div>
        ) : (
          <div className="recipe-grid" id="saved-grid">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} saved onToggleSave={() => onToggleSave(r.id)} />
            ))}
          </div>
        )}
      </div>
    </UserLayout>
  );
}
