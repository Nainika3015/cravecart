import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectAllergens, ingredientHasAllergen, normalizeAllergyKey, isHiddenByAllergens, allergenStatusLabel
} from '../src/services/allergens.js';

const recipe = (...names) => ({ ingredients: names.map((name) => ({ name })) });

test('milk allergy flags cheese', () => {
  const result = detectAllergens(recipe('Cheddar cheese', 'Tomato'), { allergies: ['Milk'] });
  assert.equal(result.status, 'detected');
  assert.equal(result.hits[0].allergen, 'Milk');
});

test('peanut allergy flags peanut butter', () => {
  const result = detectAllergens(recipe('Peanut butter'), { allergies: ['Peanuts'] });
  assert.equal(result.status, 'detected');
});

test('egg allergy flags egg-containing mayonnaise', () => {
  const result = detectAllergens(recipe('Mayonnaise'), { allergies: ['Eggs'] });
  assert.equal(result.status, 'detected');
});

test('unknown ingredients are reported as incomplete, never safe', () => {
  const result = detectAllergens({ ingredients: [] }, { allergies: ['Milk'] });
  assert.equal(result.status, 'incomplete');
  assert.equal(allergenStatusLabel(result.status), 'Allergen information incomplete');
});

test('clear status does not claim allergen-free', () => {
  const result = detectAllergens(recipe('Tomato', 'Onion'), { allergies: ['Milk'] });
  assert.equal(result.status, 'clear');
  assert.match(allergenStatusLabel(result.status), /not.*guarantee|No selected allergen/i);
});

test('derivatives are detected but kept separate from equivalence', () => {
  assert.equal(ingredientHasAllergen('whey powder', 'Milk'), true);
  assert.equal(ingredientHasAllergen('casein', 'Milk'), true);
  assert.equal(ingredientHasAllergen('semolina', 'Wheat'), true);
  assert.equal(ingredientHasAllergen('tofu', 'Soy'), true);
  assert.equal(ingredientHasAllergen('groundnuts', 'Peanuts'), true);
  assert.equal(ingredientHasAllergen('tahini', 'Sesame'), true);
});

test('plant milks and nut butters are not dairy allergens', () => {
  assert.equal(ingredientHasAllergen('coconut milk', 'Milk'), false);
  assert.equal(ingredientHasAllergen('almond milk', 'Milk'), false);
  assert.equal(ingredientHasAllergen('peanut butter', 'Milk'), false);
  assert.equal(ingredientHasAllergen('gluten free flour', 'Wheat'), false);
  assert.equal(ingredientHasAllergen('rice flour', 'Wheat'), false);
});

test('eggplant is not an egg allergen', () => {
  assert.equal(ingredientHasAllergen('eggplant', 'Eggs'), false);
});

test('custom avoid list is applied', () => {
  const result = detectAllergens(recipe('Fresh coriander'), { customAvoid: ['coriander'] });
  assert.equal(result.status, 'detected');
  assert.equal(result.hits[0].allergen, 'Custom: coriander');
});

test('legacy Dairy and Gluten preferences migrate', () => {
  assert.equal(normalizeAllergyKey('Dairy'), 'Milk');
  assert.equal(normalizeAllergyKey('Gluten'), 'Wheat');
});

test('strict mode hides incomplete information', () => {
  assert.equal(isHiddenByAllergens('incomplete', { strict: true }), true);
  assert.equal(isHiddenByAllergens('incomplete', { strict: false }), false);
  assert.equal(isHiddenByAllergens('detected', { hideDetected: true }), true);
  assert.equal(isHiddenByAllergens('detected', { hideDetected: false }), false);
});
