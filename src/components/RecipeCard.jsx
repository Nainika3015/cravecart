/* ============================================================
   CraveCart - RecipeCard.jsx
   Markup ported 1:1 from legacy fbRecipeCard() so the existing
   stylesheet (global.css) applies: .card-img-wrap, .card-body,
   .card-title, .card-meta, .card-foot, .rating-line.

   Global (TheMealDB) recipes do not ship time / diet / difficulty,
   so those badges are simply omitted instead of showing fake data.
   Optional `reasons` / `warnings` render only when a recommendation
   engine passes them (Phase 2).
   ============================================================ */

import React from 'react';
import { Link } from 'react-router-dom';
import { fbGetRecipeRating } from '../services/storageCore.js';
import { FALLBACK_IMG } from '../services/storageService.js';

export default function RecipeCard({ recipe, saved, onToggleSave, reasons, warnings, allergenStatus }) {
  if (!recipe) return null;

  const rating = fbGetRecipeRating(recipe.id);
  const isSaved = !!saved;
  const isGlobal = recipe.source === 'mealdb';

  const hasPrep = recipe.prepTime !== null && recipe.prepTime !== undefined && recipe.prepTime !== '';
  const hasCook = recipe.cookTime !== null && recipe.cookTime !== undefined && recipe.cookTime !== '';
  const totalTime = hasPrep || hasCook ? (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0) : null;
  const hasReasons = !!(reasons && reasons.length);
  const hasWarnings = !!(warnings && warnings.length);

  return (
    <article className="recipe-card">
      <div className="card-img-wrap">
        <Link to={`/recipe/${recipe.id}`}>
          <img
            src={recipe.image || FALLBACK_IMG}
            alt={recipe.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
          />
        </Link>
        <div className="card-badges">
          {recipe.cuisine && <span className="badge badge-cuisine">{recipe.cuisine}</span>}
          {totalTime !== null && <span className="badge badge-time">⏱ {totalTime} min</span>}
        </div>
        {onToggleSave && (
          <button
            type="button"
            className={`card-save${isSaved ? ' saved' : ''}`}
            title={isSaved ? 'Remove from saved' : 'Save recipe'}
            aria-label={`${isSaved ? 'Remove' : 'Save'} ${recipe.name} ${isSaved ? 'from' : 'to'} saved recipes`}
            aria-pressed={isSaved}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
          >
            {isSaved ? '♥' : '♡'}
          </button>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          <Link to={`/recipe/${recipe.id}`}>{recipe.name}</Link>
        </h3>
        {recipe.description && <p className="card-desc">{recipe.description}</p>}
        <div className="card-meta">
          {recipe.category && <span className="badge">{recipe.category}</span>}
          {recipe.dietaryPreference && <span className="badge badge-diet">{recipe.dietaryPreference}</span>}
          {recipe.difficulty && <span className="badge badge-diff">{recipe.difficulty}</span>}
          {isGlobal && <span className="badge badge-source">🌍 TheMealDB</span>}
          {allergenStatus === 'detected' && (
            <span className="badge badge-danger" title="One of your selected allergens is listed in this recipe">🛡️ Allergen</span>
          )}
          {allergenStatus === 'incomplete' && (
            <span className="badge badge-source" title="The source does not list ingredients for this recipe">ℹ Allergen info incomplete</span>
          )}
          {hasWarnings && (
            <span className="badge badge-warn" title={warnings.join(' · ')}>⚠ Check details</span>
          )}
        </div>
        {hasReasons && (
          <ul className="card-reasons">
            {reasons.slice(0, 2).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="card-foot">
          <span className="rating-line">
            <span className="stars">{rating.avg > 0 ? '★★★★★'.slice(0, Math.round(rating.avg)) : '☆'}</span>
            {' '}{rating.avg > 0 ? rating.avg.toFixed(1) : 'New'}{' '}
            <span className="count">({rating.count})</span>
          </span>
          <Link to={`/recipe/${recipe.id}`} className="btn btn-primary btn-sm">View Recipe</Link>
        </div>
      </div>
    </article>
  );
}
