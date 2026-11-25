import test from 'node:test';
import assert from 'node:assert/strict';

import { LANGUAGES, TRANSLATIONS, EN, coverage } from '../src/i18n/translations.js';

const REQUIRED = ['en', 'hi', 'te', 'ta', 'es', 'fr', 'ar', 'ja'];

/* Strings every language must carry for the app to be usable without
   falling back to English on the primary journey. */
const MUST_HAVE = [
  'nav.home', 'nav.explore', 'nav.pantry', 'nav.saved', 'nav.profile',
  'common.search', 'common.loading', 'common.retry', 'common.save',
  'explore.title', 'details.ingredients', 'details.instructions',
  'pantry.title', 'saved.title', 'ai.title', 'ai.send'
];

test('only fully meaningful languages are offered', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), REQUIRED);
  REQUIRED.forEach((code) => assert.ok(TRANSLATIONS[code], `missing dictionary: ${code}`));
});

test('English carries every key (source of truth)', () => {
  const empty = Object.keys(EN).filter((k) => !String(EN[k] || '').trim());
  assert.deepEqual(empty, []);
});

test('every language covers the primary-journey keys', () => {
  REQUIRED.forEach((code) => {
    const missing = MUST_HAVE.filter((k) => !TRANSLATIONS[code][k]);
    assert.deepEqual(missing, [], `${code} is missing: ${missing.join(', ')}`);
  });
});

test('no dictionary has an empty or whitespace value', () => {
  REQUIRED.forEach((code) => {
    Object.keys(TRANSLATIONS[code]).forEach((key) => {
      assert.ok(String(TRANSLATIONS[code][key]).trim(), `${code}.${key} is empty`);
    });
  });
});

test('no dictionary defines a key that English does not', () => {
  const enKeys = new Set(Object.keys(EN));
  REQUIRED.filter((c) => c !== 'en').forEach((code) => {
    const extra = Object.keys(TRANSLATIONS[code]).filter((k) => !enKeys.has(k));
    assert.deepEqual(extra, [], `${code} has unknown keys: ${extra.join(', ')}`);
  });
});

test('no dictionary is a copy of the English string for a real sentence', () => {
  /* Product names and true cognates are intentionally identical. */
  const GLOBAL_ALLOWED = new Set(['nav.craveai', 'ai.title', 'ai.s1']);
  const PER_LANGUAGE = {
    fr: new Set(['nav.collections', 'nav.menu']),
    de: new Set(['nav.categories']),
    pt: new Set(['nav.categories'])
  };
  REQUIRED.filter((c) => c !== 'en').forEach((code) => {
    const allowed = PER_LANGUAGE[code] || new Set();
    Object.keys(TRANSLATIONS[code]).forEach((key) => {
      if (GLOBAL_ALLOWED.has(key) || allowed.has(key)) return;
      const value = String(TRANSLATIONS[code][key]);
      if (value === String(EN[key]) && value.length > 12) {
        assert.fail(`${code}.${key} still equals the English string`);
      }
    });
  });
});

test('interpolated placeholders survive translation', () => {
  REQUIRED.forEach((code) => {
    const value = TRANSLATIONS[code]['home.title'];
    if (value) assert.match(value, /\{highlight\}/, `${code} lost {highlight}`);
    const note = TRANSLATIONS[code]['home.globalNote'];
    if (note) assert.match(note, /\{n\}/, `${code} lost {n}`);
  });
});

test('Arabic is the only right-to-left language', () => {
  assert.deepEqual(LANGUAGES.filter((l) => l.rtl).map((l) => l.code), ['ar']);
});

test('coverage report', () => {
  const report = coverage();
  /* Printed so the figure reported to the user is reproducible. */
  console.log('Translation coverage (% of English key set):', report);
  /* Every supported language must cover the complete English key set:
     no key may silently fall back to English. */
  REQUIRED.forEach((code) => {
    assert.equal(report[code], 100, `${code} is only ${report[code]}% translated`);
  });
});
