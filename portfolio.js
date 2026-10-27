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

  const api = Object.freeze({ parseQuantity, estimateValue });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabdPortfolio = api;
})(globalThis);
