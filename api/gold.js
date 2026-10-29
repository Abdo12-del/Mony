'use strict';

const SOURCE_URL = 'https://www.exchangedz.com/gold';
const SOURCE_NAME = 'EXDZ · مرجع أسعار السوق الموازية';
const KARATS = [18, 21, 24];

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function visibleText(html) {
  return decodeHtml(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function parseAmount(text) {
  const match = String(text).match(/(?:^|[^\d])([\d][\d, .\u00a0]*)(?=\s*DZD\b)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/[,.\s\u00a0]/g, ''));
  return Number.isFinite(value) && value >= 1000 && value <= 1_000_000 ? value : null;
}

function priceInAnchor(html, karat) {
  const anchors = [...String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  for (const [, attrs, body] of anchors) {
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    if (!new RegExp(`(?:^|/)gold/${karat}k(?:[/?#]|$)`, 'i').test(href)) continue;
    const price = parseAmount(visibleText(body));
    if (price !== null) return price;
  }
  return null;
}

function fallbackPrice(text, karat) {
  const label = { 24: 'pure gold benchmark', 21: 'common jewelry reference', 18: 'durable jewelry grade' }[karat];
  const patterns = [
    new RegExp(`(?:latest\\s+)?${karat}K\\s+gold(?:\\s+reference)?\\s+price(?:\\s+is)?\\s*([\\d, .]+)\\s*DZD`, 'i'),
    new RegExp(`${label}[^\\d]{0,90}([\\d, .]+)\\s*DZD`, 'i')
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const price = Number(match[1].replace(/[,.\s]/g, ''));
    if (Number.isFinite(price) && price >= 1000 && price <= 1_000_000) return price;
  }
  return null;
}

function parseGoldHtml(html, now = Date.now()) {
  if (typeof html !== 'string' || !html.trim()) throw new Error('صفحة مصدر الذهب فارغة');
  const text = visibleText(html);
  const prices = {};
  for (const karat of KARATS) {
    prices[karat] = priceInAnchor(html, karat) ?? fallbackPrice(text, karat);
  }
  if (KARATS.some(karat => !Number.isFinite(prices[karat]))) {
    throw new Error('لم تُقرأ أسعار عيارات الذهب من مصدر السوق الموازية');
  }
  const updateMatch = text.match(/Last\s+update\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
  const dateText = updateMatch?.[1]?.replace(/,(?=\s)/, ',') || null;
  const parsedDate = dateText ? Date.parse(dateText) : NaN;
  if (!Number.isFinite(parsedDate)) throw new Error('تاريخ تحديث سعر الذهب غير متاح من المصدر');
  const age = now - parsedDate;
  if (age < -86_400_000 || age > 7 * 86_400_000) throw new Error('آخر سعر منشور للذهب أقدم من سبعة أيام');
  return {
    prices,
    asOfDate: new Date(parsedDate).toISOString().slice(0, 10),
    fetchedAt: new Date(now).toISOString(),
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL
  };
}

async function readLimited(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('حجم صفحة الذهب غير متوقع');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('حجم صفحة الذهب غير متوقع');
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let bytes = 0, text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new Error('حجم صفحة الذهب غير متوقع'); }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'الطريقة غير مدعومة' });
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let html;
    try {
      const response = await fetch(SOURCE_URL, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mahfazati/1.0 (market-reference reader)', Accept: 'text/html' }
      });
      if (!response.ok) throw new Error(`تعذّر الوصول إلى مصدر الذهب (${response.status})`);
      html = await readLimited(response, 3_000_000);
    } finally { clearTimeout(timeout); }
    const data = parseGoldHtml(html);
    return res.status(200).json(data);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('parallel gold price read failed:', error.message);
    return res.status(502).json({ error: 'تعذّر جلب سعر الذهب الموازي أو التحقق من حداثته؛ أُبقي آخر سعر محفوظ إن وُجد.', source: SOURCE_NAME });
  }
}

module.exports = handler;
module.exports.parseGoldHtml = parseGoldHtml;
module.exports.visibleText = visibleText;
