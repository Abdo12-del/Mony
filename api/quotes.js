const SOURCE_URL = 'https://www.sgbv.dz/';
const SOURCE_NAME = 'بورصة الجزائر (SGBV)';
const COMPANY_NAMES = {
  AYRD: /AYRADE/i,
  BIO: /BIOPHARM/i,
  SAI: /SAIDAL/i,
  CREX: /CRAPC\s*EXPERTISE|CREX/i,
  MST: /Moustachir/i,
  AOM: /AOM\s*Invest|AOM/i,
  AUR: /El\s*Aurassi/i,
  ALL: /ALLIANCE\s*ASSURANCES/i,
  BDL: /BANQUE\s+DE\s+DEVELOPPEMENT\s+LOCAL/i,
  CPA: /CREDIT\s+POPULAIRE\s+D.?ALGERIE/i
};
const SYMBOLS = Object.keys(COMPANY_NAMES);

function decodeHtml(text) {
  return String(text).replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function visibleText(html) {
  return decodeHtml(String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
}

async function readLimited(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('حجم صفحة المصدر غير متوقع');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('حجم صفحة المصدر غير متوقع');
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let bytes = 0, text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new Error('حجم صفحة المصدر غير متوقع'); }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function numberFrom(value) {
  let cleaned = decodeHtml(value).replace(/<[^>]*>/g, ' ').trim().replace(/[\s\u00a0]/g, '');
  if (!cleaned || /^(NC|N\.?C\.?|—|-|N\/A)$/i.test(cleaned)) return null;
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, '');
  const result = Number(cleaned.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(result) ? result : null;
}

function findSessionDate(html, symbol) {
  const text = visibleText(html);
  const ticker = new RegExp(`\\b${symbol}\\b`, 'i').exec(text);
  if (!ticker) return null;
  const context = text.slice(Math.max(0, ticker.index - 260), ticker.index + 450);
  const months = '(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|june|july|august|september|october|november|december)';
  const named = context.match(new RegExp(`\\b(\\d{1,2})\\s+(${months})\\s+(\\d{4})`, 'i'));
  if (named) return `${named[1]} ${named[2]} ${named[3]}`;
  const numeric = context.match(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/);
  return numeric ? numeric[1] : null;
}

function parseOfficialHtml(html) {
  if (typeof html !== 'string' || !html.trim()) throw new Error('صفحة المصدر فارغة');
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match =>
    [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => visibleText(cell[1]))
  );
  const quotes = {};
  for (const cells of rows) {
    const symbolIndex = cells.findIndex(cell => SYMBOLS.includes(cell.trim().toUpperCase()));
    if (symbolIndex < 0) continue;
    const symbol = cells[symbolIndex].trim().toUpperCase();
    const companyCell = cells.find((cell, index) => index !== symbolIndex && COMPANY_NAMES[symbol].test(cell));
    if (!companyCell) continue;
    // SGBV's quotation rows publish symbol, opening, closing, then change.
    const openingPrice = numberFrom(cells[symbolIndex + 1]);
    const closingPrice = numberFrom(cells[symbolIndex + 2]);
    const price = closingPrice !== null && closingPrice > 0 ? closingPrice : openingPrice;
    if (price === null || price <= 0) continue;
    quotes[symbol] = {
      symbol, company: companyCell, currency: 'DZD', price,
      priceType: closingPrice !== null && closingPrice > 0 ? 'close' : 'reference',
      priceLabel: closingPrice !== null && closingPrice > 0 ? 'سعر الإغلاق المنشور' : 'سعر افتتاح/مرجع منشور',
      openingPrice, closingPrice, sessionDate: findSessionDate(html, symbol),
      source: SOURCE_NAME, sourceUrl: SOURCE_URL, fetchedAt: new Date().toISOString()
    };
  }
  if (!Object.keys(quotes).length) throw new Error('لم يُعثر على أسعار أسهم قابلة للقراءة في جدول SGBV');
  return quotes;
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'الطريقة غير مدعومة' });
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let html;
    try {
      const response = await fetch(SOURCE_URL, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mahfazati/1.0 (market-data reader)', Accept: 'text/html' }
      });
      if (!response.ok) throw new Error(`تعذّر الوصول إلى المصدر الرسمي (${response.status})`);
      html = await readLimited(response, 5_000_000);
    } finally { clearTimeout(timeout); }
    const quotes = parseOfficialHtml(html);
    return res.status(200).json({ quotes, source: SOURCE_NAME, sourceUrl: SOURCE_URL, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('SGBV quotes read failed:', error.message);
    return res.status(502).json({ error: 'تعذّر جلب أو قراءة أسعار بورصة الجزائر. أُبقيت آخر الأسعار المحفوظة فقط.', source: SOURCE_NAME });
  }
}

module.exports = handler;
module.exports.parseOfficialHtml = parseOfficialHtml;
module.exports.numberFrom = numberFrom;
