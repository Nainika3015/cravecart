/* ============================================================
   CraveCart - Signup.jsx
   Same centred two-column shell as Login. Account Type selector
   (User / Admin); admin registration requires the authorization
   code. The code is never printed in the UI.
   ============================================================ */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { FBC_LOGO_SVG } from '../services/storageCore.js';

export default function Signup() {
  const { signup } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [f, setF] = useState({
    name: '', email: '', password: '', confirmPassword: '', accountType: 'user', adminCode: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = signup(f);
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors || {});
      return;
    }
    toast('Account created successfully! You can now log in.', 'success');
    navigate('/login');
  };

  const fieldError = (key) =>
    errors[key] ? <div className="field-error" role="alert">{errors[key]}</div> : null;

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <aside className="auth-side">
          <div className="auth-side-inner">
            <div className="auth-logo">
              <span className="auth-logo-icon" dangerouslySetInnerHTML={{ __html: FBC_LOGO_SVG }} />
              <span>Crave<span style={{ color: '#ffe066' }}>Cart</span></span>
            </div>
            <h1>{t('signup.joinTitle')}</h1>
            <p>{t('signup.joinSub')}</p>
            <ul className="auth-features">
              <li><span className="tick" aria-hidden="true">✓</span> Save recipes and build collections</li>
              <li><span className="tick" aria-hidden="true">✓</span> Match recipes to your pantry</li>
              <li><span className="tick" aria-hidden="true">✓</span> Save and organise your favourites</li>
            </ul>
          </div>
        </aside>

        <section className="auth-panel" aria-labelledby="signup-heading">
          <div className="auth-card">
            <h2 id="signup-heading">{t('auth.createAccount')} ✨</h2>
            <p className="auth-sub">{t('signup.sub')}</p>

            <div className="acct-tabs form-group" role="group" aria-label={t('signup.accountType')}>
              <button
                type="button"
                className={f.accountType === 'user' ? 'active' : ''}
                aria-pressed={f.accountType === 'user'}
                onClick={() => set('accountType', 'user')}
              >
                🍽️ {t('signup.user')}
              </button>
              <button
                type="button"
                className={f.accountType === 'admin' ? 'active' : ''}
                aria-pressed={f.accountType === 'admin'}
                onClick={() => set('accountType', 'admin')}
              >
                🛡️ {t('signup.admin')}
              </button>
            </div>

            <form onSubmit={submit} noValidate>
              <div className="form-group">
                <label htmlFor="signup-name">{t('auth.fullName')} <span className="req" aria-hidden="true">*</span></label>
                <input
                  id="signup-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Nainika Sharma"
                  autoComplete="name"
                  value={f.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={errors.name ? 'true' : 'false'}
                />
                {fieldError('name')}
              </div>

              <div className="form-group">
                <label htmlFor="signup-email">{t('auth.email')} <span className="req" aria-hidden="true">*</span></label>
                <input
                  id="signup-email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={f.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={errors.email ? 'true' : 'false'}
                />
                {fieldError('email')}
              </div>

              <PasswordInput
                label={`${t('auth.password')} *`}
                value={f.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Minimum 6 characters"
              />
              {fieldError('password')}

              <PasswordInput
                label={`${t('auth.confirmPassword')} *`}
                value={f.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                placeholder="Repeat the same password"
              />
              {fieldError('confirmPassword')}

              {f.accountType === 'admin' && (
                <div className="form-group">
                  <label htmlFor="signup-admin-code">Admin Authorization Code <span className="req" aria-hidden="true">*</span></label>
                  <input
                    id="signup-admin-code"
                    type="password"
                    className="form-control"
                    placeholder="Required for admin accounts"
                    autoComplete="off"
                    value={f.adminCode}
                    onChange={(e) => set('adminCode', e.target.value)}
                    aria-invalid={errors.adminCode ? 'true' : 'false'}
                  />
                  <div className="form-hint">Administrator sign-ups require the authorization code issued to your organisation.</div>
                  {fieldError('adminCode')}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} aria-busy={submitting}>
                {submitting ? <><span className="auth-spinner" aria-hidden="true" /> {t('signup.creating')}</> : t('signup.create')}
              </button>
            </form>

            <p className="auth-alt">
              {t('signup.haveAccount')} <Link to="/login">{t('nav.login')}</Link>
            </p>
            <div className="auth-back"><Link to="/">← {t('auth.backHome')}</Link></div>
          </div>
        </section>
      </div>
    </div>
  );
}
