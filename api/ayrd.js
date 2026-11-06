const SOURCE_URL = 'https://www.sgbv.dz/';
const SOURCE_NAME = 'بورصة الجزائر (SGBV)';

function decodeHtml(text) {
  return String(text)
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function visibleText(html) {
  return decodeHtml(String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')).replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
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
  let bytes = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error('حجم صفحة المصدر غير متوقع');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function numberFrom(value) {
  const cleaned = decodeHtml(value).replace(/<[^>]*>/g, ' ').trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned || /^(NC|N\.?C\.?|—|-|N\/A)$/i.test(cleaned)) return null;
  const result = Number(cleaned.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(result) ? result : null;
}

function findSessionDate(html) {
  // Search only visible page text and keep a tight window around the ticker;
  // notice/news dates elsewhere must not be mistaken for a session date.
  const text = visibleText(html);
  const ticker = /(?:AYRD|AYRADE)/i.exec(text);
  const context = ticker ? text.slice(Math.max(0, ticker.index - 260), ticker.index + 450) : '';
  const months = '(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|june|july|august|september|october|november|december)';
  let match = context.match(new RegExp(`(?:\\b)(\\d{1,2})\\s+(${months})\\s+(\\d{4})`, 'i'));
  if (match) return `${match[1]} ${match[2]} ${match[3]}`;
  match = context.match(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/);
  return match ? match[1] : null;
}

function parseOfficialHtml(html) {
  if (typeof html !== 'string' || !html.trim()) throw new Error('صفحة المصدر فارغة');
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => {
    const cells = [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => visibleText(c[1]));
    return cells;
  });
  // Prefer the official quotation row containing the ticker, not the index
  // composition table (which may show a previous close instead).
  const quote = rows.find(cells => cells.some(x => /^AYRD$/i.test(x.trim())) && cells.some(x => /AYRADE/i.test(x)));
  if (!quote) throw new Error('لم يُعثر على صف AYRADE/AYRD في جدول التداول الرسمي');
  const codeIndex = quote.findIndex(x => /^AYRD$/i.test(x.trim()));
  const opening = numberFrom(quote[codeIndex + 1]);
  const closingText = quote[codeIndex + 2] || '';
  const closing = numberFrom(closingText);
  const publishedPrice = closing !== null ? closing : opening;
  if (publishedPrice === null || publishedPrice <= 0) throw new Error('لم ينشر المصدر سعراً صالحاً لسهم AYRD');
  const priceType = closing !== null ? 'close' : 'reference';
  return {
    symbol: 'AYRD', company: 'AYRADE', currency: 'DZD',
    price: publishedPrice, priceType,
    priceLabel: closing !== null ? 'سعر الإغلاق المنشور' : 'سعر افتتاح منشور (مرجعي، ليس إغلاقاً)',
    openingPrice: opening, closingPrice: closing,
    sessionDate: findSessionDate(html),
    source: SOURCE_NAME, sourceUrl: SOURCE_URL,
    fetchedAt: new Date().toISOString()
  };
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
        headers: { 'User-Agent': 'Nabd-Ayrad/1.0 (market-data reader)', 'Accept': 'text/html' }
      });
      if (!response.ok) throw new Error(`تعذّر الوصول إلى المصدر الرسمي (${response.status})`);
      html = await readLimited(response, 5_000_000);
    } finally { clearTimeout(timeout); }
    const data = parseOfficialHtml(html);
    return res.status(200).json(data);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('AYRD source read failed:', error.message);
    return res.status(502).json({
      error: 'تعذّر جلب أو قراءة بيانات بورصة الجزائر. أعد المحاولة لاحقاً.',
      source: SOURCE_NAME,
      fetchedAt: new Date().toISOString()
    });
  }
}

module.exports = handler;
module.exports.parseOfficialHtml = parseOfficialHtml;
module.exports.numberFrom = numberFrom;
module.exports.findSessionDate = findSessionDate;
