/* ============================================================
   CraveCart - RecipeDetails.jsx
   Handles BOTH local CraveCart recipes and global TheMealDB
   recipes:
     • TheMealDB ids (mealdb_…) are loaded via lookup.php, cached,
       and fully attributed to their original source.
     • Metadata TheMealDB does not provide (time, servings,
       difficulty) is labelled as unavailable — never fabricated.
   Save / collection / share / rate features work for both.
   ============================================================ */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import UserLayout from '../components/UserLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getData, saveData, LS_KEYS, fbGetRecipeById, fbGetRecipeRating,
  fbFormatDate, fbGenerateId, fbGetToday,
} from '../services/storageCore.js';
import {
  toggleSaved, isExternalRecipeId, resolveRecipe, getExternalRecipe,
  saveExternalRecipe, recordRecentlyViewed, FALLBACK_IMG,
} from '../services/storageService.js';
import { lookupMeal, youtubeId } from '../services/mealDb.js';
import { detectAllergens, allergenStatusLabel, ALLERGEN_DISCLAIMER } from '../services/allergens.js';
import { getPreferences } from '../services/preferences.js';
import { useI18n } from '../i18n/I18nContext.jsx';

/* Allergy information for this recipe, phrased honestly: detected,
   not identified in the listed ingredients, or incomplete. */
function AllergenPanel({ recipe, userId }) {
  const { t } = useI18n();
  const prefs = useMemo(() => getPreferences(userId), [userId, recipe && recipe.id]);
  const info = useMemo(() => detectAllergens(recipe || {}, prefs), [recipe, prefs]);
  const configured = (prefs.allergies || []).length > 0 || (prefs.customAvoid || []).length > 0;

  return (
    <div className={`allergen-panel ${info.status}`}>
      <h3>🛡️ {t('allergen.check')}</h3>
      <p className={`allergen-status ${info.status}`}>
        {info.status === 'detected' ? t('allergen.detected')
          : info.status === 'incomplete' ? t('allergen.incomplete')
            : t('allergen.clear')}
      </p>
      {!configured && (
        <p className="muted small">
          <Link to="/onboarding">{t('allergen.configure')}</Link>
        </p>
      )}
      {info.hits.length > 0 && (
        <ul className="allergen-hits">
          {info.hits.map((hit, i) => (
            <li key={i}><strong>{hit.allergen}</strong> — found in {hit.ingredient}</li>
          ))}
        </ul>
      )}
      {info.status === 'clear' && (
        <p className="muted small">{t('allergen.clearBody')}</p>
      )}
      <p className="field-note">{t('allergen.disclaimer')}</p>
    </div>
  );
}

function starsFor(n) { return '★★★★★'.slice(0, n) + '★★★★★'.slice(n); }

function isKnown(v) { return v !== null && v !== undefined && v !== ''; }

export default function RecipeDetails() {
  const { id } = useParams();
  const { user, refreshSession } = useAuth();
  const toast = useToast();
  const [, force] = useState(0);

  const [recipe, setRecipe] = useState(() => resolveRecipe(id));
  const [loadState, setLoadState] = useState('idle');   /* idle | loading | ready | error */
  const [loadError, setLoadError] = useState('');

  /* Modal state: 'collection' | 'share' | null */
  const [modal, setModal] = useState(null);
  const [newCollName, setNewCollName] = useState('');
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [, setSavedTick] = useState(false);
  const { t, lang } = useI18n();

  /* Resolve the recipe: local catalogue first, then cached TheMealDB,
     otherwise a live lookup (global recipes opened from a shared link). */
  useEffect(() => {
    if (!id) return;
    const local = fbGetRecipeById(id);
    if (local) {
      setRecipe(local);
      setLoadState('ready');
      recordRecentlyViewed(user.id, id);
      return;
    }

    const cached = getExternalRecipe(id);
    if (cached && !cached.partial) {
      setRecipe(cached);
      setLoadState('ready');
      recordRecentlyViewed(user.id, cached.id);
      return;
    }

    if (!isExternalRecipeId(id)) {
      setRecipe(null);
      setLoadState('ready');
      return;
    }

    let alive = true;
    setLoadState('loading');
    setLoadError('');
    lookupMeal(String(id).replace('mealdb_', ''))
      .then((meal) => {
        if (!alive) return;
        if (!meal) {
          setRecipe(null);
          setLoadState('error');
          setLoadError('This recipe is no longer available from TheMealDB.');
          return;
        }
        saveExternalRecipe(meal);
        setRecipe(meal);
        setLoadState('ready');
        recordRecentlyViewed(user.id, meal.id);
      })
      .catch((err) => {
        if (!alive) return;
        setRecipe(null);
        setLoadState('error');
        setLoadError(err.message);
      });
    return () => { alive = false; };
  }, [id, user.id]); // eslint-disable-line

  if (!recipe) {
    if (loadState === 'loading' || loadState === 'idle') {
      return (
        <UserLayout>
          <div className="container section-pad">
            <div className="skeleton-detail" aria-busy="true" aria-label="Loading recipe">
              <div className="sk-img" />
              <div>
                <div className="sk-line" />
                <div className="sk-line short" />
                <div className="sk-line tiny" />
                <div className="sk-line" style={{ marginTop: 26 }} />
                <div className="sk-line" />
                <div className="sk-line short" />
              </div>
            </div>
          </div>
        </UserLayout>
      );
    }
    return (
      <UserLayout>
        <div className="container section-pad">
          <div className="empty-state">
            <div className="empty-icon">🥄</div>
            <h3>{t('details.notFound')}</h3>
            <p>{loadError || t('details.unavailable')}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/explore" className="btn btn-primary">{t('details.backToExplore')}</Link>
              {loadState === 'error' && isExternalRecipeId(id) && (
                <button className="btn btn-outline" onClick={() => window.location.reload()}>Try Again</button>
              )}
            </div>
          </div>
        </div>
      </UserLayout>
    );
  }

  const isGlobal = recipe.source === 'mealdb';
  const hasPrep = isKnown(recipe.prepTime);
  const hasCook = isKnown(recipe.cookTime);
  const total = hasPrep || hasCook ? (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0) : null;
  const rating = fbGetRecipeRating(recipe.id);
  const savedIds = getData(LS_KEYS.USERS).find((u) => u.id === user.id)?.savedRecipes || [];
  const isSaved = savedIds.includes(recipe.id);
  const ytId = youtubeId(recipe.video);
  /* Only real web links are rendered (TheMealDB data is third-party). */
  const safeSourceUrl = /^https?:\/\//i.test(recipe.sourceUrl || '') ? recipe.sourceUrl : '';

  const myColls = (getData(LS_KEYS.COLLECTIONS) || []).filter((c) => c.userId === user.id);
  const reviews = (getData(LS_KEYS.REVIEWS) || [])
    .filter((rv) => rv.recipeId === recipe.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const myReview = reviews.find((rv) => rv.userId === user.id);
  const alreadyReviewed = !!myReview;

  const onToggleSave = () => {
    if (isGlobal) saveExternalRecipe(recipe);
    const nowSaved = toggleSaved(recipe.id, user.id);
    refreshSession();
    setSavedTick((t) => !t);
    toast(
      nowSaved ? 'Recipe added to your Saved Recipes' : 'Removed from Saved Recipes',
      nowSaved ? 'success' : 'info'
    );
  };

  const toggleInCollection = (colId, checked) => {
    const all = getData(LS_KEYS.COLLECTIONS) || [];
    const idx = all.findIndex((c) => c.id === colId);
    if (idx === -1) return;
    all[idx].recipeIds = all[idx].recipeIds || [];
    if (checked) {
      if (all[idx].recipeIds.indexOf(recipe.id) === -1) {
        all[idx].recipeIds.push(recipe.id);
        toast(`Added to "${all[idx].name}"`, 'success');
      }
    } else {
      all[idx].recipeIds = all[idx].recipeIds.filter((x) => x !== recipe.id);
      toast(`Removed from "${all[idx].name}"`, 'info');
    }
    saveData(LS_KEYS.COLLECTIONS, all);
    force((n) => n + 1);
  };

  const quickCreateColl = () => {
    const name = newCollName.trim();
    if (!name) { toast('Please enter a collection name', 'error'); return; }
    const all = getData(LS_KEYS.COLLECTIONS) || [];
    all.push({ id: fbGenerateId('coll'), name, userId: user.id, recipeIds: [recipe.id], createdAt: fbGetToday() });
    saveData(LS_KEYS.COLLECTIONS, all);
    toast(`Collection "${name}" created and recipe added`, 'success');
    setNewCollName('');
    force((n) => n + 1);
  };

  const shareText = `Check out this recipe: ${recipe.name} on CraveCart!`;
  const shareUrl = window.location.href;

  const copyLink = () => {
    const url = shareUrl;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast('Recipe link copied to clipboard', 'success'))
        .catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
  };
  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Recipe link copied to clipboard', 'success'); }
    catch (e) { toast('Could not copy the link', 'error'); }
    document.body.removeChild(ta);
  };

  const submitReview = () => {
    if (selectedRating === 0) { toast('Please select a star rating first', 'error'); return; }
    if (alreadyReviewed) { toast('You have already rated this recipe', 'error'); return; }
    const all = getData(LS_KEYS.REVIEWS) || [];
    all.push({
      id: fbGenerateId('review'),
      recipeId: recipe.id,
      userId: user.id,
      userName: user.name,
      rating: selectedRating,
      review: reviewText.trim(),
      date: fbGetToday(),
    });
    saveData(LS_KEYS.REVIEWS, all);
    toast('Review submitted. Thank you!', 'success');
    setReviewText('');
    setTimeout(() => force((n) => n + 1), 300);
  };

  /* Recipe text (names, ingredient lines, steps) comes from the source in
     English. Without a configured translation service the original is shown
     unchanged and labelled as such — it is never presented as translated. */
  const shownIngredients = (recipe.ingredients || []).map(() => null);
  const shownSteps = recipe.instructions || [];

  return (
    <UserLayout>
      <section className="detail-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/explore">Explore</Link>
            {recipe.category ? <> › {recipe.category}</> : null} › {recipe.name}
          </div>
          <div className="detail-layout">
            <div>
              <img
                className="detail-img"
                src={recipe.image || FALLBACK_IMG}
                alt={recipe.name}
                onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
              />
            </div>
            <div className="detail-info">
              <div className="detail-badges">
                {recipe.cuisine && <span className="badge badge-cuisine">{recipe.cuisine}</span>}
                {recipe.category && <span className="badge">{recipe.category}</span>}
                {recipe.dietaryPreference && <span className="badge badge-diet">{recipe.dietaryPreference}</span>}
                {recipe.difficulty && <span className="badge badge-diff">{recipe.difficulty}</span>}
                {isGlobal && <span className="badge badge-source">🌍 TheMealDB</span>}
              </div>
              <h1>{recipe.name}</h1>
              {isGlobal ? (
                <p className="by-line">
                  Recipe from <strong>TheMealDB</strong>
                  {safeSourceUrl && (
                    <> · <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer">Original source ↗</a></>
                  )}
                </p>
              ) : (
                <p className="by-line">By <strong>{recipe.authorName || 'Unknown Chef'}</strong> · Added {fbFormatDate(recipe.createdAt)}</p>
              )}
              {recipe.description && <p className="detail-desc">{recipe.description}</p>}

              <div className="detail-meta-grid">
                {hasPrep && <div className="meta-box"><div className="m-val">{recipe.prepTime} {t('common.min')}</div><div className="m-lbl">{t('details.prepTime')}</div></div>}
                {hasCook && <div className="meta-box"><div className="m-val">{recipe.cookTime} {t('common.min')}</div><div className="m-lbl">{t('details.cookTime')}</div></div>}
                {total !== null && <div className="meta-box"><div className="m-val">{total} {t('common.min')}</div><div className="m-lbl">{t('details.totalTime')}</div></div>}
                {isKnown(recipe.servings) && <div className="meta-box"><div className="m-val">{recipe.servings}</div><div className="m-lbl">{t('details.servingsLabel')}</div></div>}
                {recipe.difficulty && <div className="meta-box"><div className="m-val">{recipe.difficulty}</div><div className="m-lbl">{t('details.difficultyLabel')}</div></div>}
                <div className="meta-box"><div className="m-val">{rating.avg > 0 ? rating.avg.toFixed(1) : '—'}</div><div className="m-lbl">{t('details.avgRating')} ({rating.count})</div></div>
              </div>

              {isGlobal && total === null && !isKnown(recipe.servings) && (
                <p className="source-note">
                  Prep time, cooking time, servings and difficulty are not provided by TheMealDB for this recipe, so they are not shown.
                </p>
              )}

              <div className="detail-actions">
                <button className="btn btn-primary" id="detail-save-btn" onClick={onToggleSave}>
                  {isSaved ? `♥ ${t('common.unsave')}` : `♡ ${t('common.saveRecipe')}`}
                </button>
                <button className="btn btn-outline" id="detail-coll-btn" onClick={() => setModal('collection')}>📁 {t('details.addCollection')}</button>
                <button className="btn btn-ghost" id="detail-rate-btn" onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })}>⭐ {t('details.rateRecipe')}</button>
                <button className="btn btn-ghost" id="detail-share-btn" onClick={() => setModal('share')}>🔗 {t('details.shareRecipe')}</button>
                {safeSourceUrl && (
                  <a className="btn btn-ghost" href={safeSourceUrl} target="_blank" rel="noopener noreferrer">↗ {t('details.originalRecipe')}</a>
                )}
              </div>
              {(recipe.tags || []).length > 0 && (
                <div className="tag-row mt-2">
                  {recipe.tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="detail-section">
          <div className="detail-section-head">
            <h2>🥘 {t('details.ingredients')}</h2>
            {lang !== 'en' && (
              <span className="source-note" title={t('details.originalLanguageNote')}>
                🌐 {t('details.originalLanguage')}
              </span>
            )}
          </div>
          <AllergenPanel recipe={recipe} userId={user && user.id} />
          <div className="detail-cols">
            <div>
              <div className="ing-list">
                {(recipe.ingredients || []).map((i, idx) => {
                  const amount = i.raw || [i.quantity, i.unit].filter(Boolean).join(' ');
                  return (
                    <div className="ing-item" key={idx}>
                      <span>{shownIngredients[idx] || i.name}</span>
                      <span className="qty">{shownIngredients[idx] ? '' : amount}</span>
                    </div>
                  );
                })}
                {(recipe.ingredients || []).length === 0 && (
                  <p className="muted small">{t('details.unavailableIngredients')}</p>
                )}
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', marginBottom: 16 }}>👨‍🍳 {t('details.instructions')}</h2>
              <div className="step-list">
                {shownSteps.map((s, idx) => (
                  <div className="step-item" key={idx}>{s}</div>
                ))}
                {(recipe.instructions || []).length === 0 && (
                  <p className="muted small">{t('details.unavailableInstructions')}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {ytId && (
          <section className="detail-section">
            <h2>🎬 {t('details.watchVideo')}</h2>
            <div className="video-wrap">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                title={`${recipe.name} — cooking video`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="source-note">Video linked by the recipe's original source.</p>
          </section>
        )}

        <section className="detail-section" id="reviews">
          <h2>⭐ {t('details.reviewsTitle')}</h2>
          <div className="rating-summary" id="rating-summary">
            <div className="rating-big">
              <div className="big-num">{rating.avg > 0 ? rating.avg.toFixed(1) : '—'}</div>
              <div className="stars" role="img" aria-label={`${rating.avg} out of 5 stars`}>{rating.avg > 0 ? starsFor(Math.round(rating.avg)) : '☆☆☆☆☆'}</div>
              <div className="count-lbl">{rating.count} rating{rating.count === 1 ? '' : 's'}</div>
            </div>
            <div>
              <h3 style={{ marginBottom: 4 }}>{t('details.rateThis')}</h3>
              <p className="small muted">
                {alreadyReviewed
                  ? `You rated this recipe ★${myReview.rating}. One rating per user.`
                  : 'Click a star, add an optional comment and submit.'}
              </p>
            </div>
          </div>

          <div className="review-form">
            <div className="star-input" id="star-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={selectedRating >= n ? 'active' : ''}
                  data-star={n}
                  onClick={() => setSelectedRating(n)}
                  aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                  aria-pressed={selectedRating >= n}
                >★</button>
              ))}
            </div>
            <div className="form-group">
              <textarea
                id="review-text"
                className="form-control"
                placeholder={t('details.writeReview')}
                maxLength={400}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" id="submit-review-btn" onClick={submitReview}>{t('details.submitReview')}</button>
          </div>

          <div id="reviews-list">
            {reviews.length === 0 ? (
              <p className="muted">{t('details.noReviews')}</p>
            ) : (
              reviews.map((rv) => (
                <div className="review-item" key={rv.id}>
                  <div className="review-head">
                    <div className="review-avatar">{(rv.userName || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="review-name">{rv.userName || 'Anonymous'}</div>
                      <div className="review-stars" role="img" aria-label={`${rv.rating} out of 5 stars`}>{starsFor(rv.rating)}</div>
                    </div>
                    <span className="review-date">{fbFormatDate(rv.date)}</span>
                  </div>
                  {rv.review ? <p className="review-text">{rv.review}</p> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* -------- Add to collection modal -------- */}
      {modal === 'collection' && (
        <div className="modal-overlay open" id="fb-addcoll-modal" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal-box">
            <div className="modal-head">
              <h3>Add "{recipe.name}" to Collection</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setModal(null)}>&times;</button>
            </div>
            {myColls.length ? myColls.map((c) => {
              const has = (c.recipeIds || []).indexOf(recipe.id) !== -1;
              return (
                <label key={c.id} className="filter-check" style={{ padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                  <input type="checkbox" checked={has} onChange={(e) => toggleInCollection(c.id, e.target.checked)} /> <strong>{c.name}</strong>
                  <span className="muted small" style={{ marginLeft: 'auto' }}>{(c.recipeIds || []).length} recipes</span>
                </label>
              );
            }) : <p className="muted small">{t('details.noCollections')}</p>}
            <div className="form-group mt-2">
              <label>{t('details.newCollection')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('details.collectionName')}
                  maxLength={40}
                  value={newCollName}
                  onChange={(e) => setNewCollName(e.target.value)}
                />
                <button type="button" className="btn btn-outline" onClick={quickCreateColl}>{t('details.createCollection')}</button>
              </div>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={() => setModal(null)}>{t('common.done')}</button></div>
          </div>
        </div>
      )}

      {/* -------- Share modal -------- */}
      {modal === 'share' && (
        <div className="modal-overlay open" id="fb-share-modal" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal-box">
            <div className="modal-head">
              <h3>Share "{recipe.name}"</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary btn-block" onClick={copyLink}>🔗 {t('common.copyLink')}</button>
              <a className="btn btn-outline btn-block" style={{ textDecoration: 'none' }} target="_blank" rel="noopener noreferrer"
                 href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}>💬 Share on WhatsApp</a>
              {navigator.share && (
                <button className="btn btn-ghost btn-block" onClick={() => navigator.share({ title: recipe.name, text: shareText, url: shareUrl }).catch(() => {})}>
                  📤 More Share Options
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
}
