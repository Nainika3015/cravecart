/* ============================================================
   CraveCart - Navbar.jsx
   Primary links stay on one line; recipe management and account
   actions live in dropdowns so nothing wraps or stacks.
   ============================================================ */

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { FBC_LOGO_SVG } from '../services/storageCore.js';

const PRIMARY = [
  { to: '/', key: 'nav.home', match: (loc) => loc.pathname === '/' && !loc.hash },
  { to: '/explore', key: 'nav.explore', match: (loc) => loc.pathname.startsWith('/explore') },
  { to: '/pantry', key: 'nav.pantry', match: (loc) => loc.pathname.startsWith('/pantry') },
  { to: '/#categories', key: 'nav.categories', match: (loc) => loc.hash === '#categories' },
  { to: '/saved', key: 'nav.saved', match: (loc) => loc.pathname.startsWith('/saved') }
];

const RECIPE = [
  { to: '/create', key: 'nav.create' },
  { to: '/my-recipes', key: 'nav.myRecipes' },
  { to: '/collections', key: 'nav.collections' }
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLanguage, languages } = useI18n();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const navRef = useRef(null);

  const handleLogout = () => {
    setMenu(null);
    setOpen(false);
    logout();
    toast('You have been logged out. See you soon!', 'info');
  };

  useEffect(() => {
    setMenu(null);
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const isActive = (l) => (l.match ? l.match(location) : false);
  const recipeActive = RECIPE.some((l) => location.pathname.startsWith(l.to));

  return (
    <header className="navbar">
      <div className="container nav-inner" ref={navRef}>
        <Link to="/" className="logo" aria-label="CraveCart home">
          <span className="logo-icon" dangerouslySetInnerHTML={{ __html: FBC_LOGO_SVG }} />
          <span className="logo-text">Crave<span>Cart</span></span>
        </Link>

        <nav className={`nav-main${open ? ' open' : ''}`} aria-label="Main navigation">
          {PRIMARY.map((l) => (
            <Link
              key={l.key}
              to={l.to}
              className={`nav-link${isActive(l) ? ' active' : ''}`}
              aria-current={isActive(l) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {t(l.key)}
            </Link>
          ))}

          <div className={`nav-drop${menu === 'recipes' ? ' open' : ''}`}>
            <button
              type="button"
              className={`nav-link nav-drop-btn${recipeActive ? ' active' : ''}`}
              aria-haspopup="true"
              aria-expanded={menu === 'recipes'}
              onClick={() => setMenu((m) => (m === 'recipes' ? null : 'recipes'))}
            >
              {t('nav.recipes')} <span className="nav-chev" aria-hidden="true">▾</span>
            </button>
            <div className="nav-drop-panel" role="menu">
              {RECIPE.map((l) => (
                <Link
                  key={l.key}
                  to={l.to}
                  role="menuitem"
                  className={`nav-drop-item${location.pathname.startsWith(l.to) ? ' active' : ''}`}
                  onClick={() => { setMenu(null); setOpen(false); }}
                >
                  {t(l.key)}
                </Link>
              ))}
            </div>
          </div>

          {!user && (
            <div className="nav-mobile-auth">
              <Link to="/login" className="nav-link" onClick={() => setOpen(false)}>{t('nav.login')}</Link>
              <Link to="/signup" className="nav-link" onClick={() => setOpen(false)}>{t('nav.signup')}</Link>
            </div>
          )}
        </nav>

        <div className="nav-user">
          <label className="nav-lang">
            <span className="sr-only">{t('nav.language')}</span>
            <span aria-hidden="true" className="nav-lang-icon">🌐</span>
            <select
              className="lang-select"
              value={lang}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label={t('nav.language')}
              title={t('nav.language')}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
          </label>

          {user ? (
            <div className={`nav-drop user-drop${menu === 'user' ? ' open' : ''}`}>
              <button
                type="button"
                className="nav-user-btn"
                aria-haspopup="true"
                aria-expanded={menu === 'user'}
                onClick={() => setMenu((m) => (m === 'user' ? null : 'user'))}
              >
                <span className="avatar">{(user.name || 'U').charAt(0).toUpperCase()}</span>
                <span className="nav-user-name">{user.name}</span>
                <span className="nav-chev" aria-hidden="true">▾</span>
              </button>
              <div className="nav-drop-panel nav-drop-right" role="menu">
                <Link to="/profile" role="menuitem" className="nav-drop-item" onClick={() => setMenu(null)}>
                  {t('nav.profile')}
                </Link>
                <button type="button" role="menuitem" className="nav-drop-item nav-drop-danger" onClick={handleLogout}>
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          ) : (
            <div className="nav-auth">
              <Link to="/login" className="btn btn-outline btn-sm">{t('nav.login')}</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">{t('nav.signup')}</Link>
            </div>
          )}

          <button
            className="nav-toggle"
            aria-label={t('nav.menu')}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >☰</button>
        </div>
      </div>
    </header>
  );
}
