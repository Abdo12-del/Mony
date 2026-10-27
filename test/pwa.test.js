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

test('web app links its manifest, install metadata and service worker registration', () => {
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /id="install-app"/);
  assert.match(html, /apple-mobile-web-app-title" content="محفظتي"/);
  assert.match(html, /<span class="quote-caption">إجمالي محفظتي<\/span>/);
  assert.match(html, /id="share-price"/);
  assert.match(html, /id="focus-company-select"/);
  assert.match(html, /id="focus-company-logo"/);
  assert.match(html, /id="details-symbol"/);
  const app = read('app.js');
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(app.includes('portfolio.totalValue(values)'));
  assert.ok(app.includes("if (ui.price) ui.price.textContent = total === null ? '—' : number(total);"));
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
