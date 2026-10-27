'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const companies = require('../companies');

 test('company catalogue includes exchange shares and does not label preliminary screening as certification', () => {
  const all = companies.all();
  assert.deepEqual(new Set(all.map(company => company.symbol)), new Set(['AYRD', 'BIO', 'SAI', 'CREX', 'MST', 'AOM', 'AUR', 'ALL', 'BDL', 'CPA']));
  assert.equal(companies.get('SAI').name, 'SAIDAL');
  assert.equal(companies.get('AYRD').logoUrl, 'https://www.ayrade.com/wp-content/uploads/2026/04/logo-ayrade-lion.png');
  for (const symbol of ['BIO', 'SAI', 'MST']) assert.match(companies.get(symbol).logoUrl, /^https:\/\//);
  assert.equal(companies.get('CREX').logoUrl, undefined); // Use a ticker fallback rather than a possibly incorrect logo.
  assert.equal(companies.get('XYZ'), null);
  for (const candidate of companies.candidates()) {
    assert.match(candidate.screening, /مبدئياً/);
    assert.doesNotMatch(candidate.screening, /معتمدة|مضمونة|شهادة توافق/);
  }
});
