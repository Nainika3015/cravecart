import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeIngredient, classifyMatch, countsAsAvailable, splitCompoundIngredient
} from '../src/services/ingredients.js';
import { matchRecipe } from '../src/services/recommendations.js';

const level = (required, pantry) => classifyMatch(required, pantry);

test('tomato and tomatoes match', () => {
  assert.equal(normalizeIngredient('Tomatoes'), 'tomato');
  assert.equal(level('Tomato', 'tomatoes'), 'exact');
  assert.ok(countsAsAvailable(level('Tomato', 'tomatoes')));
});

test('tomato and tomato ketchup do not match', () => {
  const l = level('Tomato', 'tomato ketchup');
  assert.equal(l, 'related');
  assert.equal(countsAsAvailable(l), false);
});

test('tomato and tomato paste do not match', () => {
  const l = level('tomato', 'Tomato paste');
  assert.equal(l, 'related');
  assert.equal(countsAsAvailable(l), false);
});

test('milk and condensed milk do not match', () => {
  assert.equal(level('milk', 'condensed milk'), 'related');
  assert.equal(countsAsAvailable(level('milk', 'condensed milk')), false);
});

test('rice and rice flour do not match', () => {
  assert.equal(level('rice', 'rice flour'), 'related');
  assert.equal(countsAsAvailable(level('rice', 'rice flour')), false);
});

test('onion and onions match', () => {
  assert.equal(level('onion', 'Onions'), 'exact');
});

test('garlic and garlic cloves match', () => {
  assert.equal(normalizeIngredient('Garlic cloves'), 'garlic');
  assert.equal(level('garlic', 'garlic cloves'), 'exact');
});

test('garlic and garlic powder are a substitution only', () => {
  assert.equal(level('garlic', 'garlic powder'), 'related');
  assert.equal(countsAsAvailable(level('garlic', 'garlic powder')), false);
});

test('chicken and chicken stock do not match', () => {
  assert.equal(level('chicken', 'chicken stock'), 'related');
  assert.equal(countsAsAvailable(level('chicken', 'chicken stock')), false);
});

test('potato and potato starch do not match', () => {
  assert.equal(level('potato', 'potato starch'), 'related');
  assert.equal(countsAsAvailable(level('potato', 'potato starch')), false);
});

test('verified regional synonyms are equivalent, not substring matches', () => {
  assert.equal(level('coriander', 'cilantro'), 'exact');
  assert.equal(level('aubergine', 'eggplant'), 'exact');
  assert.equal(level('capsicum', 'bell pepper'), 'exact');
  assert.equal(level('yogurt', 'curd'), 'exact');
});

test('unrelated ingredients never match', () => {
  assert.equal(level('tomato', 'tofu'), 'none');
  assert.equal(level('milk', 'almond milk'), 'none');
});

test('compound ingredient lines split into separate requirements', () => {
  assert.deepEqual(splitCompoundIngredient('Capsicum & onion, cubed'), ['Capsicum', 'onion, cubed']);
  assert.deepEqual(splitCompoundIngredient('Salt and pepper'), ['Salt', 'pepper']);
});

test('match percentage counts only confirmed ingredients', () => {
  const recipe = {
    ingredients: [
      { name: 'Tomato', quantity: '2', unit: 'medium' },
      { name: 'Onion', quantity: '1', unit: 'medium' },
      { name: 'Garlic', quantity: '3', unit: 'cloves' },
      { name: 'Rice', quantity: '1', unit: 'cup' }
    ]
  };
  const pantry = [
    { name: 'tomatoes', status: 'fresh' },
    { name: 'onion', status: 'fresh' },
    { name: 'garlic powder', status: 'fresh' }, /* processed → not counted */
    { name: 'rice flour', status: 'fresh' }     /* processed → not counted */
  ];
  const match = matchRecipe(recipe, pantry, {});
  assert.equal(match.total, 4);
  assert.equal(match.confirmed.length, 2);
  assert.equal(match.percentage, 50);
  assert.deepEqual(match.related.map((r) => r.name).sort(), ['Garlic', 'Rice']);
  assert.equal(match.missingCount, 2);
  assert.ok(match.missing[0].amount, 'required quantities are kept');
});

test('assumed staples never inflate the confirmed percentage', () => {
  const recipe = { ingredients: ['Salt', 'Water', 'Tomato'] };
  const pantry = [{ name: 'tomato', status: 'fresh' }];
  const strict = matchRecipe(recipe, pantry, {});
  assert.equal(strict.percentage, 33);
  assert.equal(strict.assumed.length, 0);

  const withStaples = matchRecipe(recipe, pantry, { assumeStaples: true });
  assert.equal(withStaples.percentage, 33);
  assert.equal(withStaples.percentageWithStaples, 100);
  assert.deepEqual(withStaples.assumed.map((a) => a.name), ['Salt', 'Water']);
});

test('expired pantry items are never counted', () => {
  const recipe = { ingredients: ['Spinach', 'Tomato'] };
  const pantry = [
    { name: 'spinach', status: 'expired', expired: true },
    { name: 'tomato', status: 'fresh' }
  ];
  const match = matchRecipe(recipe, pantry, {});
  assert.equal(match.percentage, 50);
  assert.deepEqual(match.expiredMatches, ['spinach']);
});
