'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGoldHtml } = require('../api/gold');

const today = Date.parse('October 29, 2026') + 12 * 60 * 60 * 1000;
const page = `<!doctype html><html><body>
  <p>Last update <strong>October 27, 2026</strong></p>
  <a href="/gold/24k">Pure gold benchmark <strong>31,180 DZD</strong></a>
  <a href="/gold/21k">Common jewelry reference <strong>27,280 DZD</strong></a>
  <a href="/gold/18k">Durable jewelry grade <strong>23,390 DZD</strong></a>
</body></html>`;

test('parses the black-market gold reference for each karat and its update date', () => {
  const result = parseGoldHtml(page, today);
  assert.deepEqual(result.prices, { 18: 23390, 21: 27280, 24: 31180 });
  assert.equal(result.asOfDate, '2026-10-27');
  assert.equal(result.sourceUrl, 'https://www.exchangedz.com/gold');
});

test('parses the reference prices from visible EXDZ copy when price cards are not anchors', () => {
  const textOnly = `Last update October 27, 2026. Pure gold benchmark 31,180 DZD. Common jewelry reference 27,280 DZD. Durable jewelry grade 23,390 DZD.`;
  assert.deepEqual(parseGoldHtml(textOnly, today).prices, { 18: 23390, 21: 27280, 24: 31180 });
});

test('rejects missing prices and gold references older than seven days', () => {
  assert.throws(() => parseGoldHtml('<p>no market quotes</p>', today), /لم تُقرأ أسعار/);
  const stale = page.replace('October 27, 2026', 'October 10, 2026');
  assert.throws(() => parseGoldHtml(stale, today), /أقدم من سبعة أيام/);
});
