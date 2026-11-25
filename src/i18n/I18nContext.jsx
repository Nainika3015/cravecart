/* ============================================================
   CraveCart - i18n/I18nContext.jsx
   Lightweight localisation: no runtime dependency, 8 languages.

   - t('nav.home') returns the active translation, falling back to
     English and then to the key itself.
   - {placeholders} are replaced from the second argument.
   - The choice persists in localStorage and is mirrored into the
     signed-in user's preferences so it survives across devices of
     the same demo profile.
   - Arabic switches the document to RTL automatically.
   ============================================================ */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, TRANSLATIONS, DEFAULT_LANGUAGE } from './translations.js';
import { getPreferences, savePreferences } from '../services/preferences.js';
import { useAuth } from '../context/AuthContext.jsx';

const LANG_KEY = 'cravecart_language';

export const LANGUAGE_OPTIONS = LANGUAGES;

export function isRtl(code) {
  const meta = LANGUAGES.find((l) => l.code === code);
  return !!(meta && meta.rtl);
}

export function normalizeLanguage(code) {
  return TRANSLATIONS[code] ? code : DEFAULT_LANGUAGE;
}

/* Map a stored preference name ("Hindi", "Telugu", …) to a code. */
export function codeForLanguageName(name) {
  const meta = LANGUAGES.find(
    (l) => l.label.toLowerCase() === String(name || '').toLowerCase()
  );
  return meta ? meta.code : null;
}

function readStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANG_KEY) || '');
  } catch (e) {
    return DEFAULT_LANGUAGE;
  }
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(readStoredLanguage);

  /* A signed-in profile keeps its language in preferences. */
  useEffect(() => {
    if (!user || !user.id) return;
    const prefs = getPreferences(user.id);
    const fromPrefs = codeForLanguageName(prefs.language);
    if (fromPrefs && fromPrefs !== lang) {
      setLangState(fromPrefs);
      try { localStorage.setItem(LANG_KEY, fromPrefs); } catch (e) { /* ignore */ }
    }
  }, [user && user.id]); // eslint-disable-line

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  const setLanguage = useCallback((code) => {
    const next = normalizeLanguage(code);
    setLangState(next);
    try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
    if (user && user.id) {
      const meta = LANGUAGES.find((l) => l.code === next);
      savePreferences(user.id, { language: meta ? meta.label : 'English' });
    }
  }, [user && user.id]); // eslint-disable-line

  const t = useCallback((key, vars) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANGUAGE];
    let text = dict[key];
    if (text === undefined) text = TRANSLATIONS[DEFAULT_LANGUAGE][key];
    if (text === undefined) return key;
    if (!vars) return text;
    return Object.keys(vars).reduce(
      (acc, name) => acc.split('{' + name + '}').join(String(vars[name])),
      text
    );
  }, [lang]);

  const current = useMemo(() => LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0], [lang]);

  const value = useMemo(
    () => ({ lang, language: current, languages: LANGUAGES, setLanguage, t, isRtl: isRtl(lang) }),
    [lang, current, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { lang: DEFAULT_LANGUAGE, t: (k) => k, setLanguage: () => {}, languages: LANGUAGES, isRtl: false };
  }
  return ctx;
}
