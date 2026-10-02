import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, filterPlaces } from './places-data.js';

test('ZIP filtering returns only places in the requested ZIP', () => {
  const results = filterPlaces(PLACES, { zip: '50310' });
  assert.deepEqual(results.map((place) => place.id), ['central', 'hope']);
  assert.ok(results.every((place) => place.zips.includes('50310')));
});

test('service and neighborhood filters compose', () => {
  const results = filterPlaces(PLACES, { zip: '50309', neighborhood: 'East Village', service: 'food-bank' });
  assert.deepEqual(results.map((place) => place.id), ['central']);
});

test('every filtered place is represented by a map coordinate and list identity', () => {
  const results = filterPlaces(PLACES, { zip: '50309' });
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((place) => place.id), results.map((place) => place.id));
  assert.ok(results.every((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)));
});
