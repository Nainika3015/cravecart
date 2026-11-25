/* ============================================================
   CraveCart - Login.jsx
   Shared Login page for both User and Admin modules.

   Layout: a centred, max-1120px two-column card (orange brand panel
   + form). The page no longer puts a grid class on <body>, which was
   the reason the form was squeezed into the left half of the screen.

   Auth itself is still the original local-storage implementation;
   see README → "Authentication limits".
   ============================================================ */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { isValidEmail } from '../services/authService.js';
import { isDemoEnvironment } from '../services/env.js';
import { FBC_LOGO_SVG } from '../services/storageCore.js';

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const showDemo = isDemoEnvironment();

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errs = {};
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) errs.email = t('auth.errEmail');
    else if (!isValidEmail(cleanEmail)) errs.email = t('auth.errInvalidEmail');
    if (!password) errs.password = t('auth.errPassword');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    /* Let the button paint its loading state before the synchronous
       local-storage check runs. */
    await new Promise((resolve) => setTimeout(resolve, 220));

    const result = login(cleanEmail, password);
    if (!result.ok) {
      setErrors({ form: result.error || t('auth.errPassword') });
      setSubmitting(false);
      return;
    }

    const from = location.state && location.state.from;
    if (result.role === 'admin') navigate('/admin', { replace: true });
    else navigate(from && from.startsWith('/') ? from : '/', { replace: true });
  };

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <aside className="auth-side">
          <div className="auth-side-inner">
            <div className="auth-logo">
              <span className="auth-logo-icon" dangerouslySetInnerHTML={{ __html: FBC_LOGO_SVG }} />
              <span>Crave<span style={{ color: '#ffe066' }}>Cart</span></span>
            </div>
            <h1>{t('auth.welcome')}</h1>
            <p>{t('auth.welcomeSub')}</p>
            <ul className="auth-features">
              <li><span className="tick" aria-hidden="true">✓</span> Pick up where you left off</li>
              <li><span className="tick" aria-hidden="true">✓</span> Your collections, ready to cook</li>
              <li><span className="tick" aria-hidden="true">✓</span> Step-by-step cooking instructions</li>
            </ul>
          </div>
        </aside>

        <section className="auth-panel" aria-labelledby="login-heading">
          <div className="auth-card">
            <h2 id="login-heading">{t('auth.loginTitle')} 👋</h2>
            <p className="auth-sub">{t('auth.loginSub')}</p>

            <form onSubmit={submit} noValidate>
              <div className="form-group">
                <label htmlFor="login-email">
                  {t('auth.email')} <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '', form: '' })); }}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                />
                {errors.email && <div className="field-error" id="login-email-error" role="alert">{errors.email}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="login-password">
                  {t('auth.password')} <span className="req" aria-hidden="true">*</span>
                </label>
                <div className="input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '', form: '' })); }}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                    title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    <span aria-hidden="true">{showPassword ? '🙈' : '👁'}</span>
                  </button>
                </div>
                {errors.password && <div className="field-error" id="login-password-error" role="alert">{errors.password}</div>}
              </div>

              {errors.form && (
                <div className="field-error" role="alert" style={{ marginBottom: 12 }}>{errors.form}</div>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} aria-busy={submitting}>
                {submitting ? <><span className="auth-spinner" aria-hidden="true" /> {t('auth.loggingIn')}</> : t('auth.login')}
              </button>
            </form>

            <p className="auth-alt">
              {t('auth.noAccount')} <Link to="/signup">{t('auth.createAccount')}</Link>
            </p>

            {showDemo && (
              <details className="auth-demo">
                <summary>🔑 {t('auth.demoTitle')}</summary>
                <div className="auth-demo-body">
                  <strong>{t('auth.demoTitle')}</strong>
                  Nainika — <code>nainika@cravecart.com</code> / <code>demo123</code><br />
                  Alisha — <code>alisha@cravecart.com</code> / <code>demo123</code><br />
                  Swaroopa — <code>swaroopa@cravecart.com</code> / <code>demo123</code>
                  <strong>{t('auth.adminTitle')}</strong>
                  <code>admin@cravecart.com</code> / <code>admin123</code>
                  <div className="auth-demo-hint">{t('auth.demoHint')}</div>
                </div>
              </details>
            )}

            <div className="auth-back"><Link to="/">← {t('auth.backHome')}</Link></div>
          </div>
        </section>
      </div>
    </div>
  );
}
