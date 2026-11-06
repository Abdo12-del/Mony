function comparePrices(previous, next) {
  if (!Number.isFinite(next) || next <= 0) throw new Error('السعر الجديد غير صالح');
  if (previous === null || previous === undefined) return { kind: 'baseline', change: 0, percent: 0 };
  if (!Number.isFinite(previous) || previous <= 0) throw new Error('السعر السابق غير صالح');
  const change = Number((next - previous).toFixed(2));
  if (change === 0) return { kind: 'stable', change: 0, percent: 0 };
  return { kind: change > 0 ? 'up' : 'down', change, percent: Number((change / previous * 100).toFixed(2)) };
}

function formatDzd(value) {
  return new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 2 }).format(value);
}

module.exports = { comparePrices, formatDzd };
