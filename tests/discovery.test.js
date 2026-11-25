import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBrowsePlan, pendingSources, nextSources, mergeUniqueRecipes,
  countNewRecipes, loadedLabel, showingLabel, mapWithConcurrency
} from '../src/services/discovery.js';

const meal = (id, name = 'Meal ' + id) => ({ id, name, source: 'themealdb' });

test('browse plan covers the whole alphabet, categories and cuisines', () => {
  const plan = buildBrowsePlan({ categories: ['Beef', 'Dessert'], areas: ['Italian', 'Indian'] });
  assert.equal(plan.length, 26 + 2 + 2);
  assert.equal(plan[0].key, 'letter:a');
  assert.equal(plan[26].key, 'category:Beef');
  assert.equal(plan[28].key, 'area:Italian');
});

test('sources are visited at most once', () => {
  const plan = buildBrowsePlan({ categories: ['Beef'], areas: [] });
  const first = nextSources(plan, new Set(), 2);
  assert.deepEqual(first.map((s) => s.key), ['letter:a', 'letter:b']);

  const loaded = new Set(first.map((s) => s.key));
  const second = nextSources(plan, loaded, 2);
  assert.deepEqual(second.map((s) => s.key), ['letter:c', 'letter:d']);
  assert.equal(pendingSources(plan, new Set(plan.map((s) => s.key))).length, 0);
});

test('Load More keeps only unique recipes', () => {
  const loaded = [meal('1'), meal('2')];
  const incoming = [meal('2'), meal('3'), meal('1'), meal('4')];
  const merged = mergeUniqueRecipes(loaded, incoming);
  assert.deepEqual(merged.map((m) => m.id), ['1', '2', '3', '4']);
  assert.equal(countNewRecipes(loaded, incoming), 2);
  assert.equal(countNewRecipes(loaded, incoming), 2, 'replaying the same batch adds nothing');
});

test('duplicate ids inside one API batch are collapsed', () => {
  const merged = mergeUniqueRecipes([], [meal('10'), meal('10'), meal('11')]);
  assert.equal(merged.length, 2);
});

test('counters describe loaded recipes, not an unsupported total', () => {
  assert.equal(loadedLabel(69), '69 recipes loaded');
  assert.equal(loadedLabel(1), '1 recipe loaded');
  assert.equal(showingLabel(24, 69), 'Showing 24 of 69 loaded recipes');
  assert.equal(showingLabel(90, 69), 'Showing 69 of 69 loaded recipes');
});

test('bounded concurrency never exceeds the limit and keeps order', async () => {
  let active = 0;
  let peak = 0;
  const items = [1, 2, 3, 4, 5, 6, 7];
  const results = await mapWithConcurrency(items, 3, async (n) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active -= 1;
    return n * 2;
  });
  assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14]);
  assert.ok(peak <= 3, 'peak concurrency was ' + peak);
});

test('a failed detail request does not break the batch', async () => {
  const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error('429');
    return n;
  });
  assert.deepEqual(results, [1, null, 3]);
});
