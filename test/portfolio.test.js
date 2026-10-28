'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSnapshot, estimateValue, parseQuantity, totalValue } = require('../portfolio');

test('portfolio quantity accepts only non-negative whole share counts', () => {
  assert.equal(parseQuantity('0'), 0);
  assert.equal(parseQuantity('125'), 125);
  assert.equal(parseQuantity(7), 7);
  for (const invalid of ['', '  ', '-1', '1.5', '1e2', 'shares', '9007199254740992', null, undefined, NaN]) {
    assert.equal(parseQuantity(invalid), null, `expected ${String(invalid)} to be rejected`);
  }
});

test('single holding value uses its share quantity and available quote', () => {
  assert.equal(estimateValue(3, 830), 2490);
  assert.equal(estimateValue(3, 830.125), 2490.38);
  assert.equal(estimateValue(0, 830), 0);
  assert.equal(estimateValue(null, 830), null);
  assert.equal(estimateValue(3, null), null);
  assert.equal(estimateValue(3, 0), null);
  assert.equal(estimateValue(3, -1), null);
  assert.equal(estimateValue(3, NaN), null);
});

test('overall portfolio value sums each holding and avoids partial totals', () => {
  assert.equal(totalValue([
    { quantity: 3, price: 830 },
    { quantity: 2, price: 415 }
  ]), 3320);
  assert.equal(totalValue([{ quantity: 1, price: 830.25 }, { quantity: 3, price: 10.1 }]), 860.55);
  assert.equal(totalValue([]), null);
  assert.equal(totalValue([{ quantity: 1, price: 830 }, { quantity: 2, price: null }]), null);
});

test('portfolio trend snapshots require fresh official readings for every current holding', () => {
  const holdings = [{ symbol: 'AYRD', quantity: 3 }, { symbol: 'BIO', quantity: 2 }];
  const quotes = { AYRD: { price: 830 }, BIO: { price: 415 } };
  assert.deepEqual(createSnapshot(holdings, quotes, new Set(['AYRD', 'BIO']), 1234), { time: 1234, total: 3320 });
  assert.equal(createSnapshot(holdings, quotes, new Set(['AYRD']), 1234), null);
  assert.equal(createSnapshot(holdings, { AYRD: quotes.AYRD }, new Set(['AYRD', 'BIO']), 1234), null);
  assert.equal(createSnapshot([], quotes, new Set(['AYRD', 'BIO']), 1234), null);
});
