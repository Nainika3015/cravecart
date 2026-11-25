/* ============================================================
   CraveCart - Onboarding.jsx
   Optional, skippable cooking-preferences wizard (Phase 2).

   Values are stored per account with preferences.js; nothing is
   sent anywhere. Re-opening this page edits the saved answers.
   ============================================================ */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserLayout from '../components/UserLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getPreferences, savePreferences, CUISINES, DIETS, ALLERGIES, EXPERIENCES,
  EQUIPMENT, GOALS, CURRENCIES, LANGUAGES, COUNTRIES, DEFAULT_PREFERENCES
} from '../services/preferences.js';

const STEPS = [
  { key: 'about', label: 'About you', hint: 'How should we greet you, and where do you cook?' },
  { key: 'taste', label: 'Taste', hint: 'Cuisines you love, diets you follow and anything to avoid.' },
  { key: 'kitchen', label: 'Kitchen', hint: 'Your cooking level, time, servings and equipment.' },
  { key: 'goals', label: 'Budget & goals', hint: 'What should CraveCart optimise for?' },
  { key: 'review', label: 'Review', hint: 'Check your answers and save. You can edit them anytime.' }
];

const TIME_PRESETS = [15, 30, 45, 60];

function ChipGroup({ label, hint, options, values, onToggle }) {
  return (
    <div className="form-group">
      <div className="onb-label">{label}</div>
      {hint && <div className="field-note" style={{ marginTop: 0, marginBottom: 8 }}>{hint}</div>}
      <div className="chip-wrap" role="group" aria-label={label}>
        {options.map((option) => {
          const active = values.indexOf(option) !== -1;
          return (
            <button
              key={option}
              type="button"
              className={`choice-chip${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(option)}
            >
              {active ? '✓ ' : ''}{option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const initial = useMemo(() => getPreferences(user.id), [user.id]);
  const [prefs, setPrefs] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [avoidTerm, setAvoidTerm] = useState('');

  useEffect(() => {
    if (!initial.name) setPrefs((p) => ({ ...p, name: user.name || '' }));
  }, [initial.name, user.name]);

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  const toggleIn = (field, value) => {
    setPrefs((p) => {
      const list = p[field] || [];
      return { ...p, [field]: list.indexOf(value) !== -1 ? list.filter((x) => x !== value) : [...list, value] };
    });
  };

  const addAvoid = () => {
    const term = avoidTerm.trim();
    if (!term) return;
    if ((prefs.customAvoid || []).some((t) => t.toLowerCase() === term.toLowerCase())) {
      setAvoidTerm('');
      return;
    }
    set({ customAvoid: [...(prefs.customAvoid || []), term] });
    setAvoidTerm('');
  };

  const removeAvoid = (term) => set({ customAvoid: (prefs.customAvoid || []).filter((t) => t !== term) });

  const validate = () => {
    if (step === 0) {
      if (!prefs.name.trim()) return 'Please enter the name you would like to be greeted with.';
      if (prefs.name.trim().length < 2) return 'That name looks too short.';
    }
    if (step === 2) {
      const time = Number(prefs.maxTime);
      if (!time || time < 5 || time > 240) return 'Cooking time should be between 5 and 240 minutes.';
      const servings = Number(prefs.servings);
      if (!servings || servings < 1 || servings > 20) return 'Servings should be between 1 and 20.';
    }
    if (step === 3 && prefs.budget !== '') {
      const budget = Number(prefs.budget);
      if (isNaN(budget) || budget < 0) return 'Budget should be a positive number, or leave it empty.';
    }
    return '';
  };

  const next = () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const finish = () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    savePreferences(user.id, {
      ...prefs,
      name: prefs.name.trim() || user.name,
      maxTime: Number(prefs.maxTime) || DEFAULT_PREFERENCES.maxTime,
      servings: Number(prefs.servings) || DEFAULT_PREFERENCES.servings,
      budget: prefs.budget === '' ? '' : String(prefs.budget),
      onboarded: true
    });
    toast('Your preferences are saved. The homepage is now personalised.', 'success');
    navigate('/');
  };

  const skip = () => {
    savePreferences(user.id, { skipped: true });
    toast('No problem — you can personalise CraveCart anytime from your profile.', 'info');
    navigate('/');
  };

  const summary = [];
  if (prefs.cuisines.length) summary.push({ label: 'Cuisines', value: prefs.cuisines.join(', ') });
  if (prefs.diets.length) summary.push({ label: 'Diet', value: prefs.diets.join(', ') });
  if (prefs.allergies.length) summary.push({ label: 'Avoiding', value: prefs.allergies.join(', ') });
  if (prefs.experience) summary.push({ label: 'Experience', value: prefs.experience });
  summary.push({ label: 'Max cooking time', value: `≤ ${prefs.maxTime} minutes` });
  summary.push({ label: 'Servings', value: String(prefs.servings) });
  if (prefs.budget !== '') summary.push({ label: 'Meal budget', value: `${prefs.currency} ${prefs.budget}` });
  if (prefs.equipment.length) summary.push({ label: 'Equipment', value: prefs.equipment.join(', ') });
  if (prefs.goals.length) summary.push({ label: 'Goals', value: prefs.goals.join(', ') });

  return (
    <UserLayout>
      <div className="page-head">
        <div>
          <h1>🍽️ Personalise CraveCart</h1>
          <p>Tell us how you cook so recipes, pantry matches and recommendations fit your kitchen.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>Skip for now</button>
      </div>

      <div className="container section-pad" style={{ paddingTop: 0 }}>
        <div className="onb-wrap">
          <div className="onb-card">
            <div className="onb-progress-head">
              <span className="onb-step-count">Step {step + 1} of {STEPS.length}</span>
              <span className="muted small">{STEPS[step].label}</span>
            </div>
            <div
              className="onb-progress"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={step + 1}
              aria-label="Onboarding progress"
            >
              <div className="onb-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>

            <h2 className="onb-title">{STEPS[step].label}</h2>
            <p className="onb-hint">{STEPS[step].hint}</p>

            {step === 0 && (
              <>
                <div className="form-group">
                  <label htmlFor="onb-name">Preferred name <span className="req">*</span></label>
                  <input
                    id="onb-name"
                    type="text"
                    className="form-control"
                    maxLength={40}
                    placeholder="e.g. Nainika"
                    value={prefs.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="onb-country">Country or region</label>
                    <select id="onb-country" className="form-control" value={prefs.country} onChange={(e) => set({ country: e.target.value })}>
                      <option value="">Prefer not to say</option>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="field-note">Used to suggest ingredients that are easy to find near you.</div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="onb-language">Preferred language</label>
                    <select id="onb-language" className="form-control" value={prefs.language} onChange={(e) => set({ language: e.target.value })}>
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <div className="field-note">Saved for the upcoming translation work — recipes stay in English for now.</div>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <ChipGroup label="Favourite cuisines" hint="Pick as many as you like." options={CUISINES} values={prefs.cuisines} onToggle={(v) => toggleIn('cuisines', v)} />
                <ChipGroup label="Dietary preferences" hint="Recipes that conflict with these are filtered out of recommendations." options={DIETS} values={prefs.diets} onToggle={(v) => toggleIn('diets', v)} />
                <ChipGroup label="Food allergies" hint="Recipes containing these ingredients are excluded. Where a recipe has no ingredient list, we show a warning instead of guessing." options={ALLERGIES} values={prefs.allergies} onToggle={(v) => toggleIn('allergies', v)} />

                <div className="form-group">
                  <label htmlFor="onb-avoid">Other ingredients to avoid</label>
                  <div className="avoid-add">
                    <input
                      id="onb-avoid"
                      type="text"
                      className="form-control"
                      placeholder="e.g. mushrooms, shellfish"
                      value={avoidTerm}
                      onChange={(e) => setAvoidTerm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAvoid(); } }}
                      maxLength={40}
                    />
                    <button type="button" className="btn btn-outline btn-sm" onClick={addAvoid}>Add</button>
                  </div>
                  {(prefs.customAvoid || []).length > 0 && (
                    <div className="chip-wrap" style={{ marginTop: 8 }}>
                      {prefs.customAvoid.map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="choice-chip active"
                          onClick={() => removeAvoid(term)}
                          aria-label={`Remove ${term} from ingredients to avoid`}
                        >
                          ✓ {term} ✕
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="field-note">Checked against ingredient names wherever recipes are shown.</div>
                </div>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={!!prefs.assumeStaples}
                    onChange={(e) => set({ assumeStaples: e.target.checked })}
                  />
                  <span>Assume common pantry staples (salt, water, oil, sugar, pepper)</span>
                </label>
                <div className="field-note">
                  Assumed staples are listed separately in Smart Pantry and never added to the confirmed match percentage.
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <ChipGroup label="Cooking experience" options={EXPERIENCES} values={prefs.experience ? [prefs.experience] : []} onToggle={(v) => set({ experience: v })} />
                <div className="form-group">
                  <label htmlFor="onb-time">Preferred cooking time (minutes)</label>
                  <input
                    id="onb-time"
                    type="number"
                    className="form-control"
                    min="5"
                    max="240"
                    step="5"
                    value={prefs.maxTime}
                    onChange={(e) => set({ maxTime: e.target.value })}
                  />
                  <div className="chip-wrap" style={{ marginTop: 8 }} role="group" aria-label="Quick cooking time presets">
                    {TIME_PRESETS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`choice-chip${Number(prefs.maxTime) === mins ? ' active' : ''}`}
                        aria-pressed={Number(prefs.maxTime) === mins}
                        onClick={() => set({ maxTime: mins })}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="onb-servings">Number of servings</label>
                    <input
                      id="onb-servings"
                      type="number"
                      className="form-control"
                      min="1"
                      max="20"
                      value={prefs.servings}
                      onChange={(e) => set({ servings: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <span className="onb-label">Equipment you have</span>
                    <div className="chip-wrap" role="group" aria-label="Available equipment">
                      {EQUIPMENT.map((item) => {
                        const active = prefs.equipment.indexOf(item) !== -1;
                        return (
                          <button
                            key={item}
                            type="button"
                            className={`choice-chip${active ? ' active' : ''}`}
                            aria-pressed={active}
                            onClick={() => toggleIn('equipment', item)}
                          >
                            {active ? '✓ ' : ''}{item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="onb-budget">Meal budget (optional)</label>
                    <input
                      id="onb-budget"
                      type="number"
                      className="form-control"
                      min="0"
                      step="10"
                      placeholder="e.g. 300"
                      value={prefs.budget}
                      onChange={(e) => set({ budget: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="onb-currency">Currency</label>
                    <select id="onb-currency" className="form-control" value={prefs.currency} onChange={(e) => set({ currency: e.target.value })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field-note" style={{ marginTop: -6, marginBottom: 18 }}>
                  Recipe sources do not publish prices, so the budget is not used to invent costs. The
                  budget-friendly section ranks recipes by fewer ingredients and better pantry coverage.
                </div>
                <ChipGroup label="Cooking goals" hint="These adjust how recipes are ranked." options={GOALS} values={prefs.goals} onToggle={(v) => toggleIn('goals', v)} />
              </>
            )}

            {step === 4 && (
              <>
                <div className="onb-summary">
                  <div className="onb-summary-row"><span>Name</span><strong>{prefs.name || user.name}</strong></div>
                  {prefs.country && <div className="onb-summary-row"><span>Country / region</span><strong>{prefs.country}</strong></div>}
                  <div className="onb-summary-row"><span>Language</span><strong>{prefs.language}</strong></div>
                  {summary.map((row) => (
                    <div className="onb-summary-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>
                  ))}
                </div>
                <p className="field-note">
                  All of this is stored on this device with your CraveCart account. You can change or reset it
                  from your profile at any time.
                </p>
              </>
            )}

            {error && <div className="form-error-banner" role="alert">⚠ {error}</div>}

            <div className="onb-actions">
              {step > 0 ? (
                <button type="button" className="btn btn-ghost" onClick={back}>← Back</button>
              ) : (
                <Link to="/" className="btn btn-ghost">← Cancel</Link>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>Skip</button>
                {step < STEPS.length - 1 ? (
                  <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={finish}>Save Preferences</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
