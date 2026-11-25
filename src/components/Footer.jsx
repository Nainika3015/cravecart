/* ============================================================
   CraveCart - Footer.jsx (same classes/structure as legacy)
   Localized through the shared i18n dictionary.
   ============================================================ */

import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { FBC_LOGO_SVG } from '../services/storageCore.js';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo" style={{ color: '#fff' }}>
              <span className="logo-icon" dangerouslySetInnerHTML={{ __html: FBC_LOGO_SVG }} />
              <span className="logo-text">Crave<span style={{ color: 'var(--accent)' }}>Cart</span></span>
            </div>
            <p className="small mt-1" style={{ color: '#9a9aa5', maxWidth: 300 }}>
              {t('footer.tagline')}
            </p>
          </div>
          <div>
            <h4>{t('footer.quickLinks')}</h4>
            <Link to="/">{t('nav.home')}</Link>
            <Link to="/explore">{t('home.explore')}</Link>
            <Link to="/collections">{t('nav.collections')}</Link>
            <Link to="/create">{t('nav.create')}</Link>
          </div>
          <div>
            <h4>{t('footer.account')}</h4>
            <Link to="/login">{t('nav.login')}</Link>
            <Link to="/signup">{t('nav.signup')}</Link>
            <Link to="/admin">{t('footer.admin')}</Link>
          </div>
        </div>
        <div className="footer-bottom">
          © 2026 CraveCart – {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
}
