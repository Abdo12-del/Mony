(() => {
  const $ = id => document.getElementById(id);
  const portfolio = window.NabdPortfolio;
  const ui = {
    price: $('price'), sharePrice: $('share-price'), type: $('price-kind'), note: $('price-note'), date: $('session-date'), checked: $('checked-at'),
    error: $('error'), button: $('refresh'), status: $('refresh-status'), movement: $('movement'),
    movementCaption: $('movement-caption'), opening: $('opening-price'), closing: $('closing-price'),
    chartLine: $('chart-line'), chartArea: $('chart-area'), chartPoint: $('chart-point'), chartEmpty: $('chart-empty'),
    chartCount: $('observation-count'), chartFirst: $('chart-first'), chartLast: $('chart-last'), activity: $('activity-list'),
    portfolioForm: $('portfolio-form'), sharesInput: $('shares-input'), portfolioTotal: $('portfolio-total'),
    portfolioPrice: $('portfolio-price'), holdingValue: $('holding-value'), portfolioFeedback: $('portfolio-feedback'),
    companyLogo: $('ayrade-logo'), companyLogoFallback: $('ayrade-logo-fallback'), installButton: $('install-app')
  };
  const CACHE_KEY = 'nabd-ayrad-last-success-v1';
  const HISTORY_KEY = 'nabd-ayrad-observations-v1';
  const PORTFOLIO_KEY = 'nabd-ayrad-portfolio-v1';
  let latestPrice = null;
  let ownedShares = null;
  const number = value => new Intl.NumberFormat('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const dateTime = value => value ? new Intl.DateTimeFormat('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

  function readHistory() {
    try {
      const rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(x => x && Number.isFinite(x.price)).slice(-60) : [];
    } catch (_) { return []; }
  }

  function renderChart(rows) {
    const visible = rows.slice(-36);
    ui.chartCount.textContent = `${new Intl.NumberFormat('ar-DZ').format(rows.length)} فحص`;
    if (visible.length < 2) {
      ui.chartLine.setAttribute('d', ''); ui.chartArea.setAttribute('d', ''); ui.chartPoint.setAttribute('r', '0');
      ui.chartEmpty.hidden = false; ui.chartFirst.textContent = '—'; ui.chartLast.textContent = '—'; return;
    }
    ui.chartEmpty.hidden = true;
    const values = visible.map(x => x.price);
    const min = Math.min(...values), max = Math.max(...values), spread = max - min || Math.max(max * .01, 1);
    const points = values.map((v, i) => ({ x: 5 + i * (710 / (values.length - 1)), y: 128 - ((v - min) / spread) * 100 }));
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    ui.chartLine.setAttribute('d', d);
    ui.chartArea.setAttribute('d', `${d} L${last.x.toFixed(1)},145 L${points[0].x.toFixed(1)},145 Z`);
    ui.chartPoint.setAttribute('cx', last.x.toFixed(1)); ui.chartPoint.setAttribute('cy', last.y.toFixed(1)); ui.chartPoint.setAttribute('r', '4');
    ui.chartFirst.textContent = dateTime(visible[0].time).split('،')[0];
    ui.chartLast.textContent = dateTime(visible[visible.length - 1].time).split('،')[0];
  }

  function renderActivity(rows) {
    if (!ui.activity) return;
    ui.activity.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'activity-empty';
      empty.textContent = 'تظهر القراءات هنا بعد نجاح الفحص الأول.';
      ui.activity.appendChild(empty);
      return;
    }
    rows.slice(-5).reverse().forEach((row, reverseIndex) => {
      const index = rows.length - 1 - reverseIndex;
      const previous = index > 0 ? rows[index - 1].price : null;
      const delta = previous === null ? null : Number((row.price - previous).toFixed(2));
      const item = document.createElement('article'); item.className = 'activity-row';
      const icon = document.createElement('span'); icon.className = 'activity-icon'; icon.textContent = delta === null ? '✓' : delta > 0 ? '↑' : delta < 0 ? '↓' : '·';
      const copy = document.createElement('div'); copy.className = 'activity-copy';
      const title = document.createElement('strong'); title.textContent = delta === null ? 'تم حفظ سعر الأساس' : delta > 0 ? 'رُصد ارتفاع بين فحصين' : delta < 0 ? 'رُصد انخفاض بين فحصين' : 'السعر دون تغير بين فحصين';
      const sub = document.createElement('small'); sub.textContent = `${dateTime(row.time)} · ${number(row.price)} دج`;
      copy.append(title, sub);
      const value = document.createElement('span'); value.className = `activity-value ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`;
      value.textContent = delta === null ? 'أساس' : delta > 0 ? `+${number(delta)} دج` : delta < 0 ? `−${number(Math.abs(delta))} دج` : 'ثابت';
      item.append(icon, copy, value); ui.activity.appendChild(item);
    });
  }

  function readOwnedShares() {
    try {
      const raw = localStorage.getItem(PORTFOLIO_KEY);
      return raw === null ? null : portfolio.parseQuantity(raw);
    } catch (_) { return null; }
  }

  function renderPortfolio(syncInput = false) {
    if (!ui.portfolioForm) return;
    if (syncInput && document.activeElement !== ui.sharesInput) {
      ui.sharesInput.value = ownedShares === null ? '' : String(ownedShares);
    }
    const formattedSharePrice = Number.isFinite(latestPrice) ? `${number(latestPrice)} دج` : 'لا توجد قراءة ناجحة';
    ui.portfolioPrice.textContent = formattedSharePrice;
    ui.sharePrice.textContent = formattedSharePrice;
    const holdingValue = ownedShares === null ? null : portfolio.estimateValue(ownedShares, latestPrice);
    const totalValue = ownedShares === null ? null : portfolio.totalValue([{ quantity: ownedShares, price: latestPrice }]);
    const formattedTotal = totalValue === null ? '—' : `${number(totalValue)} دج`;
    ui.price.textContent = totalValue === null ? '—' : number(totalValue);
    ui.portfolioTotal.textContent = formattedTotal;
    ui.holdingValue.textContent = holdingValue === null ? '—' : `${number(holdingValue)} دج`;
  }

  function saveOwnedShares(event) {
    event.preventDefault();
    const quantity = portfolio.parseQuantity(ui.sharesInput.value.trim());
    if (quantity === null) {
      ui.sharesInput.setCustomValidity('أدخل عدداً صحيحاً غير سالب.');
      ui.sharesInput.reportValidity();
      return;
    }
    ui.sharesInput.setCustomValidity('');
    try {
      localStorage.setItem(PORTFOLIO_KEY, String(quantity));
      ownedShares = quantity;
      renderPortfolio();
      ui.portfolioFeedback.textContent = `تم حفظ ${new Intl.NumberFormat('ar-DZ').format(quantity)} سهم AYRD على هذا الجهاز.`;
      ui.portfolioFeedback.hidden = false;
    } catch (_) {
      ui.portfolioFeedback.textContent = 'تعذّر حفظ الكمية في هذا المتصفح.';
      ui.portfolioFeedback.hidden = false;
    }
  }

  function showMovement(previous, current, knownChange) {
    const change = Number.isFinite(knownChange) ? knownChange : previous === null ? null : Number((current - previous).toFixed(2));
    if (change === null) { ui.movement.hidden = true; return; }
    ui.movement.hidden = false;
    ui.movement.className = `movement ${change > 0 ? 'up' : change < 0 ? 'down' : 'stable'}`;
    ui.movement.textContent = change > 0 ? `↑ +${number(change)} دج` : change < 0 ? `↓ −${number(Math.abs(change))} دج` : '— دون تغيّر';
  }

  function showQuote(data, cached = false) {
    latestPrice = Number.isFinite(data.price) && data.price > 0 ? data.price : null;
    ui.sharePrice.textContent = `${number(data.price)} دج`;
    ui.type.textContent = data.priceLabel || 'السعر المنشور';
    ui.note.textContent = cached
      ? 'آخر سعر محفوظ في هذا المتصفح؛ قد لا يكون حديثاً.'
      : data.priceType === 'close'
        ? 'هذا سعر إغلاق منشور من المصدر الرسمي.'
        : 'السعر المتاح افتتاحي/مرجعي؛ لم يُنشر إغلاق في صف التداول الرسمي.';
    ui.date.textContent = data.sessionDate || 'غير متاح من المصدر';
    ui.checked.textContent = dateTime(data.fetchedAt);
    ui.opening.textContent = Number.isFinite(data.openingPrice) ? `${number(data.openingPrice)} دج` : 'غير منشور';
    ui.closing.textContent = Number.isFinite(data.closingPrice) ? `${number(data.closingPrice)} دج` : 'غير منشور';
    if (cached) showMovement(null, data.price, Number.isFinite(data.observedDelta) ? data.observedDelta : null);
    renderPortfolio();
  }

  function showCached() {
    try {
      const old = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!old || !Number.isFinite(old.price)) return null;
      showQuote(old, true);
      renderChart(readHistory());
      renderActivity(readHistory());
      return old;
    } catch (_) { return null; }
  }

  async function refresh() {
    if (ui.button.disabled) return;
    const saved = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) { return null; } })();
    ui.button.disabled = true; ui.button.classList.add('loading');
    ui.status.textContent = 'جارٍ التحقق من المصدر الرسمي…'; ui.error.hidden = true;
    try {
      const response = await fetch('/api/ayrd', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Number.isFinite(data.price) || data.price <= 0) throw new Error(data.error || 'لم تصل بيانات سعر صالحة.');
      const previous = saved && Number.isFinite(saved.price) ? saved.price : null;
      const observedDelta = previous === null ? null : Number((data.price - previous).toFixed(2));
      data.observedDelta = observedDelta;
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      const history = readHistory();
      history.push({ price: data.price, time: data.fetchedAt });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-60)));
      showQuote(data); showMovement(previous, data.price); renderChart(history.slice(-60)); renderActivity(history.slice(-60));
      ui.status.textContent = 'تم الفحص بنجاح · البيانات من SGBV';
    } catch (error) {
      ui.error.textContent = `${error.message || 'تعذّر الاتصال.'} ${saved ? 'نعرض آخر سعر محفوظ وقد لا يكون حديثاً.' : 'لا يوجد سعر محفوظ لعرضه.'}`;
      ui.error.hidden = false; ui.status.textContent = 'لم ينجح هذا الفحص';
    } finally {
      ui.button.disabled = false; ui.button.classList.remove('loading');
    }
  }
  ownedShares = readOwnedShares();
  if (ui.companyLogo) {
    const showLogoFallback = () => { ui.companyLogo.hidden = true; ui.companyLogoFallback.hidden = false; };
    ui.companyLogo.addEventListener('error', showLogoFallback, { once: true });
    if (ui.companyLogo.complete && ui.companyLogo.naturalWidth === 0) showLogoFallback();
  }
  showCached(); renderChart(readHistory()); renderActivity(readHistory()); renderPortfolio(true);
  ui.portfolioForm?.addEventListener('submit', saveOwnedShares);
  ui.sharesInput?.addEventListener('input', () => ui.sharesInput.setCustomValidity(''));
  ui.button.addEventListener('click', refresh);
  document.querySelectorAll('.bottom-nav a').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
  }));

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (ui.installButton) ui.installButton.hidden = false;
  });
  ui.installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (_) {
      // The browser's built-in menu remains available if its install prompt is unavailable.
    } finally {
      ui.installButton.hidden = true;
    }
  });
  window.addEventListener('appinstalled', () => { if (ui.installButton) ui.installButton.hidden = true; });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    if (navigator.serviceWorker.controller) {
      let reloadingForWorkerUpdate = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadingForWorkerUpdate) return;
        reloadingForWorkerUpdate = true;
        window.location.reload();
      });
    }
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        await registration.update();
      } catch (_) {
        // The site still works online if service-worker installation is unavailable.
      }
    }, { once: true });
  }
  refresh();
})();
