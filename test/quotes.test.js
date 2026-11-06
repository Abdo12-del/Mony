'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOfficialHtml, numberFrom } = require('../api/quotes');

test('SGBV quote parser extracts only listed equity symbols and respects missing closes', () => {
  const html = `
    <p>Informations de marché 27 octobre 2026</p>
    <table>
      <tr><th>Société</th><th>Code</th><th>Ouverture</th><th>Clôture</th></tr>
      <tr><td>AYRADE</td><td>AYRD</td><td>830,00</td><td>NC</td><td>0,00</td></tr>
      <tr><td>BIOPHARM</td><td>BIO</td><td>2 358,00</td><td>2 357,00</td><td>-0,04</td></tr>
      <tr><td>BANQUE DE DEVELOPPEMENT LOCAL</td><td>BDL</td><td>1 398,00</td><td>1 391,00</td><td>-0,50</td></tr>
      <tr><td>OTHER COMPANY</td><td>XYZ</td><td>99</td><td>99</td></tr>
    </table>`;
  const result = parseOfficialHtml(html);
  assert.equal(result.AYRD.price, 830);
  assert.equal(result.AYRD.priceType, 'reference');
  assert.equal(result.AYRD.closingPrice, null);
  assert.equal(result.AYRD.sessionDate, '27 octobre 2026');
  assert.equal(result.BIO.price, 2357);
  assert.equal(result.BIO.priceType, 'close');
  assert.equal(result.BDL.price, 1391);
  assert.equal(result.XYZ, undefined);
});

test('quote parser rejects pages without valid official quote rows', () => {
  assert.throws(() => parseOfficialHtml('<html>no quote</html>'), /لم يُعثر/);
  assert.equal(numberFrom('NC'), null);
  assert.equal(numberFrom('1 398,50'), 1398.5);
  assert.equal(numberFrom('1.398,50'), 1398.5);
  assert.equal(numberFrom('1.398'), 1398);
});
