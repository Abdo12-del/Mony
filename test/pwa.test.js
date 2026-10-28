'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('PWA manifest names محفظتي and declares installable app icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'محفظتي');
  assert.equal(manifest.short_name, 'محفظتي');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.purpose === 'any');
    assert.ok(icon, `missing ${size}px standard icon`);
    const assetPath = path.join(root, icon.src.slice(1));
    assert.ok(fs.existsSync(assetPath), `missing asset ${icon.src}`);
    const png = fs.readFileSync(assetPath);
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', `${icon.src} is not a PNG`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size]);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('PWA shell supports offline launch without caching the stock API', () => {
  const worker = read('sw.js');
  for (const asset of ['/', '/index.html', '/styles.css', '/app.js', '/portfolio.js', '/companies.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']) {
    assert.ok(worker.includes(`'${asset}'`), `offline shell missing ${asset}`);
  }
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /cache\.match\('\/'\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
});

test('portfolio hero shows only the independent total; selected-share details stay in a separate card', () => {
  const html = read('index.html');
  const hero = html.match(/<section class="instrument-card portfolio-total-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /quote-caption">إجمالي<\/span>[\s\S]*?id="price"/);
  assert.doesNotMatch(hero, /AYRD|focus-company-select|share-price|السهم/);
  const stockCard = html.match(/<section class="stock-quote-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(stockCard);
  assert.match(stockCard, /id="focus-company-select"[\s\S]*?id="share-price"/);
  assert.match(stockCard, /id="price-kind"/);
  assert.match(stockCard, /id="focus-quote-updated"/);
  assert.doesNotMatch(html, /welcome-mark/);
  const app = read('app.js');
  assert.ok(app.includes("new Intl.NumberFormat('de-DE'"));
  assert.ok(app.includes('لم يتغير السعر منذ آخر فحص ناجح'));
  assert.ok(app.includes('إغلاق منشور من SGBV، وليس سعراً مباشراً.'));
});

test('portfolio total card contains an accessible history sparkline and never invents a trend', () => {
  const html = read('index.html');
  const hero = html.match(/<section class="instrument-card portfolio-total-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /id="portfolio-total-chart"[^>]*role="img"/);
  assert.match(hero, /id="portfolio-total-chart-hint"/);
  const app = read('app.js');
  assert.match(app, /portfolio\.createSnapshot\(holdings, quoteCache, refreshedSymbols, Date\.now\(\)\)/);
  assert.match(app, /history\.push\(snapshot\)/);
  assert.match(app, /visible\.length < 2/);
  assert.match(app, /smoothLinePath\(points\)/);
  assert.match(app, /path \+= ` C/);
  assert.match(app, /لا يمثل عائداً استثمارياً/);
  assert.match(read('sw.js'), /mahfazati-shell-v14/);
});

test('finance UI uses clear rectangular cards with a single prominent portfolio total', () => {
  const css = read('styles.css');
  const designSystem = css.slice(css.lastIndexOf('/* Unified finance-app card system'));
  assert.match(designSystem, /--card-radius:\s*12px/);
  assert.match(designSystem, /\.stock-quote-card,[\s\S]*?\.portfolio-section,[\s\S]*?\.chart-panel,[\s\S]*?\.summary-card/);
  assert.match(designSystem, /\.portfolio-total-card\s*\{[\s\S]*?min-height:\s*144px[\s\S]*?border-radius:\s*var\(--card-radius\)/);
  assert.match(designSystem, /\.summary-card\.summary-date\s*\{[^}]*background:\s*var\(--card-surface\)/);
  const worker = read('sw.js');
  assert.match(worker, /mahfazati-shell-v14/);
});

test('mobile experience uses four real app tabs with a persistent touch-friendly bottom bar', () => {
  const html = read('index.html');
  for (const screen of ['home', 'portfolio', 'chart', 'history']) {
    assert.ok(html.includes(`data-screen-target="${screen}"`));
    assert.ok(html.includes(`data-mobile-screen="${screen}"`));
  }
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<nav class="bottom-nav" aria-label="التنقل الرئيسي">/);
  const css = read('styles.css');
  assert.match(css, /\.bottom-nav a \{ min-height: 48px; gap: 1px/);
  assert.match(css, /padding: 7px 9px calc\(8px \+ env\(safe-area-inset-bottom/);
  const app = read('app.js');
  assert.match(app, /applyMobileScreen\(link\.dataset\.screenTarget, \{ updateHash: true, scroll: true \}\)/);
  assert.match(app, /mobileScrollPositions\[previousScreen\] = window\.scrollY/);
});

test('web app links its manifest, install metadata and service worker registration', () => {
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /id="install-app"/);
  assert.match(html, /apple-mobile-web-app-title" content="محفظتي"/);
  assert.match(html, /<span class="quote-caption">إجمالي<\/span>/);
  assert.match(html, /id="share-price"/);
  assert.match(html, /id="focus-company-select"/);
  assert.match(html, /id="focus-company-logo"/);
  assert.match(html, /id="details-symbol"/);
  const app = read('app.js');
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(app.includes('portfolio.totalValue(values)'));
  assert.ok(app.includes('ui.price.textContent = formattedAmount;'));
  assert.match(html, /id="company-select"/);
  assert.match(html, /id="company-list"/);
  assert.match(html, /id="quote-refresh-feedback"/);
  assert.ok(app.includes("fetch('/api/quotes'"));
  assert.ok(app.includes('logoWrap.appendChild(logo)'));
  assert.ok(app.includes("logo.addEventListener('error'"));
  assert.ok(app.includes('company-logo-fallback'));
  assert.ok(app.includes('renderSelectedQuote()'));
  assert.ok(app.includes("selectedSymbol = companies.get(ui.focusSelect.value)"));
  assert.ok(app.includes('historyKey(symbol)'));
  assert.ok(app.includes("localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(positions))"));
  const contentSecurityPolicy = vercel.headers.find(rule => rule.source === '/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;
  for (const host of ['https://www.ayrade.com', 'https://www.biopharmdz.com', 'https://www.saidalgroup.dz', 'https://moustachir.dz']) assert.ok(contentSecurityPolicy.includes(host));
  assert.match(read('dev-server.js'), /pathname === '\/api\/quotes'/);
  assert.ok(read('scripts/build.js').includes("'companies.js'"));
  assert.ok(app.includes("navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })"));
  assert.match(read('app.js'), /controllerchange/);
  assert.match(read('app.js'), /beforeinstallprompt/);
  assert.ok(vercel.headers.some(rule => rule.source === '/sw.js' && rule.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-store'))));
});
