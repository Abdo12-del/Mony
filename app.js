(() => {
  const $ = id => document.getElementById(id);
  const portfolio = window.NabdPortfolio;
  const companies = window.NabdCompanies;
  const ui = {
    price: $('price'), sharePrice: $('share-price'), type: $('price-kind'), note: $('price-note'), date: $('session-date'), checked: $('checked-at'),
    error: $('error'), button: $('refresh'), status: $('refresh-status'), movement: $('movement'),
    movementCaption: $('movement-caption'), opening: $('opening-price'), closing: $('closing-price'),
    chartLine: $('chart-line'), chartArea: $('chart-area'), chartPoint: $('chart-point'), chartEmpty: $('chart-empty'),
    chartCount: $('observation-count'), chartFirst: $('chart-first'), chartLast: $('chart-last'), activity: $('activity-list'),
    portfolioTotal: $('portfolio-total'), portfolioFeedback: $('portfolio-feedback'), quoteFeedback: $('quote-refresh-feedback'),
    companySelect: $('company-select'), addCompany: $('add-company'), companyList: $('company-list'),
    installButton: $('install-app')
  };
  const CACHE_KEY = 'nabd-ayrad-last-success-v1';
  const HISTORY_KEY = 'nabd-ayrad-observations-v1';
  const PORTFOLIO_KEY = 'mahfazati-portfolio-v2';
  const LEGACY_PORTFOLIO_KEY = 'nabd-ayrad-portfolio-v1';
  const QUOTES_KEY = 'mahfazati-last-quotes-v1';
  let latestPrice = null;
  let positions = readPositions();
  let draftSymbols = [];
  let quoteCache = readQuoteCache();
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

  function readPositions() {
    try {
      const saved = JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        return Object.fromEntries(Object.entries(saved).filter(([symbol, quantity]) =>
          companies.get(symbol) && Number.isSafeInteger(quantity) && quantity > 0));
      }
      const legacy = localStorage.getItem(LEGACY_PORTFOLIO_KEY);
      const legacyQuantity = legacy === null ? null : portfolio.parseQuantity(legacy);
      return legacyQuantity > 0 ? { AYRD: legacyQuantity } : {};
    } catch (_) { return {}; }
  }

  function readQuoteCache() {
    try {
      const data = JSON.parse(localStorage.getItem(QUOTES_KEY) || '{}');
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (_) { return {}; }
  }

  function savePositions() {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(positions));
  }

  function companyDisplayName(company) {
    return `${company.arabicName} · ${company.symbol}`;
  }

  function renderCompanyPicker() {
    if (!ui.companySelect) return;
    ui.companySelect.replaceChildren();
    const group = document.createElement('optgroup');
    group.label = 'مرشحة مبدئياً حسب طبيعة النشاط — لا تُعد شهادة توافق شرعي';
    for (const company of companies.candidates()) {
      const option = document.createElement('option'); option.value = company.symbol;
      option.textContent = `${companyDisplayName(company)} — ${company.sector}`;
      group.appendChild(option);
    }
    ui.companySelect.appendChild(group);
  }

  function renderCompanyList() {
    if (!ui.companyList) return;
    const pendingValues = new Map([...ui.companyList.querySelectorAll('.holding-card[data-symbol]')]
      .map(card => [card.dataset.symbol, card.querySelector('input')?.value]));
    ui.companyList.replaceChildren();
    const symbols = [...new Set([...Object.keys(positions), ...draftSymbols])];
    if (!symbols.length) {
      const empty = document.createElement('div'); empty.className = 'company-list-empty';
      empty.textContent = 'لم تضف شركات بعد. اختر سهماً من القائمة وسجّل الكمية التي تملكها.';
      ui.companyList.appendChild(empty);
      return;
    }
    for (const symbol of symbols) {
      const company = companies.get(symbol);
      if (!company) continue;
      const quote = quoteCache[symbol];
      const quantity = positions[symbol];
      const price = quote && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
      const value = Number.isSafeInteger(quantity) && quantity > 0 && price !== null
        ? portfolio.estimateValue(quantity, price) : null;
      const card = document.createElement('article'); card.className = 'holding-card'; card.dataset.symbol = symbol;
      const identity = document.createElement('div'); identity.className = 'holding-company';
      const logoWrap = document.createElement('span'); logoWrap.className = 'company-logo-wrap';
      const logoFallback = document.createElement('span'); logoFallback.className = 'company-logo-fallback';
      logoFallback.textContent = company.symbol.slice(0, 2); logoFallback.hidden = Boolean(company.logoUrl);
      if (company.logoUrl) {
        const logo = document.createElement('img'); logo.src = company.logoUrl;
        logo.alt = `شعار شركة ${company.arabicName}`; logo.loading = 'lazy'; logo.decoding = 'async';
        logo.addEventListener('error', () => { logo.hidden = true; logoFallback.hidden = false; }, { once: true });
        logoWrap.appendChild(logo);
      }
      logoWrap.appendChild(logoFallback);
      const copy = document.createElement('span'); copy.className = 'holding-company-copy';
      const name = document.createElement('strong'); name.textContent = company.arabicName;
      const sub = document.createElement('small'); sub.textContent = `${company.name} · ${company.symbol} · ${company.sector}`;
      copy.append(name, sub); identity.append(logoWrap, copy);

      const priceMetric = document.createElement('div'); priceMetric.className = 'holding-metric';
      const priceLabel = document.createElement('span'); priceLabel.textContent = 'آخر سعر متاح من SGBV';
      const priceText = document.createElement('strong'); priceText.textContent = price === null ? 'لا توجد قراءة ناجحة' : `${number(price)} دج`;
      const quoteNote = document.createElement('small');
      quoteNote.textContent = price === null ? 'بانتظار قراءة رسمية' : `${quote.priceLabel || 'السعر المنشور'}${quote._retrievedAt && Date.now() - quote._retrievedAt > 60000 ? ' · آخر قراءة محفوظة وقد لا تكون حديثة' : ''}`;
      priceMetric.append(priceLabel, priceText, quoteNote);

      const quantityLabel = document.createElement('label'); quantityLabel.className = 'holding-quantity';
      const quantityCaption = document.createElement('span'); quantityCaption.textContent = 'عدد الأسهم التي تملكها';
      const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.step = '1'; input.inputMode = 'numeric';
      input.placeholder = 'أدخل الكمية'; input.autocomplete = 'off'; input.setAttribute('aria-label', `عدد أسهم ${company.arabicName}`);
      input.value = pendingValues.has(symbol) ? pendingValues.get(symbol) : quantity ? String(quantity) : '';
      quantityLabel.append(quantityCaption, input);

      const valueMetric = document.createElement('div'); valueMetric.className = 'holding-metric holding-value';
      const valueLabel = document.createElement('span'); valueLabel.textContent = 'قيمة الحيازة التقديرية';
      const valueText = document.createElement('strong'); valueText.textContent = value === null ? '—' : `${number(value)} دج`;
      valueMetric.append(valueLabel, valueText);

      const actions = document.createElement('div'); actions.className = 'holding-actions';
      const saveButton = document.createElement('button'); saveButton.className = 'save-shares-button'; saveButton.type = 'button'; saveButton.textContent = 'حفظ الكمية';
      saveButton.addEventListener('click', () => {
        const parsed = portfolio.parseQuantity(input.value.trim());
        if (parsed === null || parsed < 1) {
          input.setCustomValidity('أدخل عدداً صحيحاً من الأسهم، لا يقل عن سهم واحد.'); input.reportValidity(); return;
        }
        input.setCustomValidity('');
        positions[symbol] = parsed;
        draftSymbols = draftSymbols.filter(item => item !== symbol);
        try { savePositions(); renderPortfolio(); showPortfolioFeedback(`تم حفظ ${new Intl.NumberFormat('ar-DZ').format(parsed)} سهم من ${company.arabicName} على هذا الجهاز.`); }
        catch (_) { showPortfolioFeedback('تعذّر حفظ الحيازة في هذا المتصفح.'); }
      });
      const removeButton = document.createElement('button'); removeButton.className = 'remove-holding-button'; removeButton.type = 'button';
      removeButton.textContent = 'إزالة'; removeButton.setAttribute('aria-label', `إزالة ${company.arabicName} من المحفظة`);
      removeButton.addEventListener('click', () => {
        delete positions[symbol]; draftSymbols = draftSymbols.filter(item => item !== symbol);
        try { savePositions(); renderPortfolio(); showPortfolioFeedback(`تمت إزالة ${company.arabicName} من المحفظة.`); }
        catch (_) { showPortfolioFeedback('تعذّر تحديث المحفظة في هذا المتصفح.'); }
      });
      actions.append(saveButton, removeButton);
      const screening = document.createElement('small'); screening.className = 'screening-note'; screening.textContent = company.screening;
      card.append(identity, priceMetric, quantityLabel, valueMetric, actions, screening);
      ui.companyList.appendChild(card);
    }
  }

  function showPortfolioFeedback(message) {
    ui.portfolioFeedback.textContent = message;
    ui.portfolioFeedback.hidden = false;
  }

  function renderPortfolio() {
    const held = Object.entries(positions).filter(([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0);
    const values = held.map(([symbol, quantity]) => ({ quantity, price: quoteCache[symbol]?.price }));
    const total = portfolio.totalValue(values);
    const formattedTotal = total === null ? '—' : `${number(total)} دج`;
    if (ui.price) ui.price.textContent = total === null ? '—' : number(total);
    if (ui.portfolioTotal) ui.portfolioTotal.textContent = formattedTotal;
    if (ui.sharePrice) {
      const ayPrice = Number.isFinite(latestPrice) ? latestPrice : quoteCache.AYRD?.price;
      ui.sharePrice.textContent = Number.isFinite(ayPrice) ? `${number(ayPrice)} دج` : 'لا توجد قراءة ناجحة';
    }
    renderCompanyList();
  }

  async function refreshPortfolioQuotes() {
    try {
      const response = await fetch('/api/quotes', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.quotes || typeof data.quotes !== 'object') throw new Error(data.error || 'تعذّر قراءة أسعار الشركات.');
      const returnedSymbols = new Set();
      for (const [symbol, quote] of Object.entries(data.quotes)) {
        if (companies.get(symbol) && Number.isFinite(quote.price) && quote.price > 0) {
          quoteCache[symbol] = { ...quote, _retrievedAt: Date.now() };
          returnedSymbols.add(symbol);
        }
      }
      localStorage.setItem(QUOTES_KEY, JSON.stringify(quoteCache));
      renderPortfolio();
      const unavailableHeld = Object.keys(positions).filter(symbol => !returnedSymbols.has(symbol));
      if (ui.quoteFeedback) {
        ui.quoteFeedback.textContent = unavailableHeld.length
          ? 'لم تصل قراءة حديثة لكل الأسهم في المحفظة؛ نعرض آخر قراءة محفوظة إن توفرت، ولا يظهر الإجمالي عند غياب سعر صالح.'
          : '';
        ui.quoteFeedback.hidden = unavailableHeld.length === 0;
      }
    } catch (error) {
      renderPortfolio();
      if (ui.quoteFeedback) {
        ui.quoteFeedback.textContent = `${error.message || 'تعذّر تحديث الأسعار.'} ${Object.keys(quoteCache).length ? 'نعرض آخر الأسعار المحفوظة وقد لا تكون حديثة.' : 'لا توجد أسعار محفوظة لعرضها.'}`;
        ui.quoteFeedback.hidden = false;
      }
    }
  }

  function addSelectedCompany() {
    const symbol = ui.companySelect?.value;
    const company = companies.get(symbol);
    if (!company) return;
    if (positions[symbol] || draftSymbols.includes(symbol)) {
      showPortfolioFeedback(`${company.arabicName} موجودة بالفعل في المحفظة.`); return;
    }
    draftSymbols.push(symbol);
    renderPortfolio();
    ui.companyList?.lastElementChild?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
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
    if (Number.isFinite(data.price) && data.price > 0) quoteCache.AYRD = { ...(quoteCache.AYRD || {}), ...data };
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
    refreshPortfolioQuotes();
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
  renderCompanyPicker();
  showCached(); renderChart(readHistory()); renderActivity(readHistory()); renderPortfolio();
  ui.addCompany?.addEventListener('click', addSelectedCompany);
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
