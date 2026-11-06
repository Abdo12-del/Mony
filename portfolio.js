'use strict';

(function registerPortfolio(root) {
  function parseQuantity(raw) {
    if (typeof raw === 'number') {
      return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
    }
    if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return null;
    const quantity = Number(raw.trim());
    return Number.isSafeInteger(quantity) ? quantity : null;
  }

  function estimateValue(quantity, unitPrice) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
    const value = quantity * unitPrice;
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  function estimateGoldValue(grams, unitPrice) {
    if (!Number.isFinite(grams) || grams <= 0 || grams > 100_000) return null;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
    const value = grams * unitPrice;
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  function totalValue(positions) {
    if (!Array.isArray(positions) || positions.length === 0) return null;
    let total = 0;
    for (const position of positions) {
      if (!position) return null;
      const value = position.unit === 'gram'
        ? estimateGoldValue(position.quantity, position.price)
        : estimateValue(position.quantity, position.price);
      if (value === null) return null;
      total += value;
      if (!Number.isFinite(total)) return null;
    }
    return Number(total.toFixed(2));
  }

  function createSnapshot(holdings, quotes, refreshedSymbols, time) {
    if (!Array.isArray(holdings) || holdings.length === 0 || !quotes || !(refreshedSymbols instanceof Set) || !Number.isFinite(time)) return null;
    if (holdings.some(position => !position || typeof position.symbol !== 'string' ||
      (position.unit === 'gram'
        ? !Number.isFinite(position.quantity) || position.quantity <= 0 || position.quantity > 100_000
        : !Number.isSafeInteger(position.quantity) || position.quantity <= 0) || !refreshedSymbols.has(position.symbol))) return null;
    const total = totalValue(holdings.map(({ symbol, quantity, unit }) => ({ quantity, unit, price: quotes[symbol]?.price })));
    return total === null ? null : { time, total };
  }

  const api = Object.freeze({ parseQuantity, estimateValue, estimateGoldValue, totalValue, createSnapshot });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabdPortfolio = api;
})(globalThis);
