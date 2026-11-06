const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOfficialHtml, numberFrom } = require('../api/ayrd');
const { comparePrices } = require('../lib/market');

const page = `<!doctype html><html><body><table><tr><th>Valeur</th><th>Code</th><th>Ouverture</th><th>Clôture</th><th>Var%</th></tr><tr><td>AYRADE</td><td>AYRD</td><td>830,00</td><td>NC</td><td>0,00</td></tr></table></body></html>`;

test('parses official AYRD quote without calling an unpublished close a close', () => {
  const data = parseOfficialHtml(page);
  assert.equal(data.price, 830);
  assert.equal(data.priceType, 'reference');
  assert.equal(data.closingPrice, null);
  assert.equal(data.openingPrice, 830);
  assert.match(data.priceLabel, /ليس إغلاقاً/);
});

test('uses published close when the official quotation contains one', () => {
  const data = parseOfficialHtml(page.replace('NC</td>', '835,50</td>'));
  assert.equal(data.price, 835.5);
  assert.equal(data.priceType, 'close');
  assert.equal(data.closingPrice, 835.5);
});

test('reports malformed or missing official quote as a source-read error', () => {
  assert.throws(() => parseOfficialHtml('<html><table><tr><td>Other</td></tr></table></html>'), /AYRADE/);
  assert.throws(() => parseOfficialHtml(''), /فارغة/);
});

test('parses French-formatted numbers and no-quote markers', () => {
  assert.equal(numberFrom('1 234,50'), 1234.5);
  assert.equal(numberFrom('NC'), null);
  assert.equal(numberFrom('—'), null);
});

test('first observation establishes baseline and does not report a movement', () => {
  assert.deepEqual(comparePrices(null, 830), { kind: 'baseline', change: 0, percent: 0 });
});

test('detects increases, decreases, and unchanged prices', () => {
  assert.deepEqual(comparePrices(800, 830), { kind: 'up', change: 30, percent: 3.75 });
  assert.deepEqual(comparePrices(830, 800), { kind: 'down', change: -30, percent: -3.61 });
  assert.deepEqual(comparePrices(830, 830), { kind: 'stable', change: 0, percent: 0 });
});

test('rejects invalid prices, including failed/offline reads rather than inventing a quote', () => {
  assert.throws(() => comparePrices(830, NaN), /غير صالح/);
  assert.throws(() => comparePrices(0, 830), /السابق غير صالح/);
});

test('API returns a source error when the official server is unreachable', async () => {
  const handler = require('../api/ayrd');
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('simulated network outage'); };
  const headers = {};
  let statusCode;
  let body;
  const res = {
    setHeader: (key, value) => { headers[key] = value; },
    status: code => { statusCode = code; return res; },
    json: value => { body = value; return value; }
  };
  try {
    await handler({ method: 'GET' }, res);
    assert.equal(statusCode, 502);
    assert.match(body.error, /تعذّر/);
    assert.ok(headers['X-Content-Type-Options']);
  } finally { global.fetch = originalFetch; }
});
