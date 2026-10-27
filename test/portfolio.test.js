'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateValue, parseQuantity } = require('../portfolio');

test('portfolio quantity accepts only non-negative whole share counts', () => {
  assert.equal(parseQuantity('0'), 0);
  assert.equal(parseQuantity('125'), 125);
  assert.equal(parseQuantity(7), 7);
  for (const invalid of ['', '  ', '-1', '1.5', '1e2', 'shares', '9007199254740992', null, undefined, NaN]) {
    assert.equal(parseQuantity(invalid), null, `expected ${String(invalid)} to be rejected`);
  }
});

test('portfolio valuation uses a valid available quote and handles zero shares', () => {
  assert.equal(estimateValue(3, 830), 2490);
  assert.equal(estimateValue(3, 830.125), 2490.38);
  assert.equal(estimateValue(0, 830), 0);
  assert.equal(estimateValue(null, 830), null);
  assert.equal(estimateValue(3, null), null);
  assert.equal(estimateValue(3, 0), null);
  assert.equal(estimateValue(3, -1), null);
  assert.equal(estimateValue(3, NaN), null);
});
