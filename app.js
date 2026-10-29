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
    portfolioChart: $('portfolio-total-chart'), portfolioChartLine: $('portfolio-total-line'),
    portfolioChartArea: $('portfolio-total-area'), portfolioChartPoint: $('portfolio-total-point'),
    portfolioChartPoints: $('portfolio-total-points'), portfolioChartHint: $('portfolio-total-chart-hint'),
    portfolioTotalChange: $('portfolio-total-observed-change'), portfolioUpdated: $('portfolio-total-updated'),
    homeHoldingsPreview: $('home-holdings-preview'),
    goldForm: $('gold-form'), goldWeight: $('gold-weight'), goldKarat: $('gold-karat'), goldCost: $('gold-cost-per-gram'),
    goldSave: $('gold-save'), goldRemove: $('gold-remove'), goldValue: $('gold-value'), goldUnitPrice: $('gold-unit-price'),
    goldCostTotal: $('gold-cost-total'), goldDifference: $('gold-difference'), goldDifferenceRow: $('gold-difference-row'), goldStatus: $('gold-status'),
    goldFeedback: $('gold-feedback'),
    companySelect: $('company-select'), addCompany: $('add-company'), companyList: $('company-list'),
    focusSelect: $('focus-company-select'), focusName: $('focus-company-name'), focusSymbol: $('focus-company-symbol'),
    focusFullName: $('focus-company-full-name'), focusLogo: $('focus-company-logo'), focusFallback: $('focus-company-fallback'),
    detailsSymbol: $('details-symbol'), installButton: $('install-app')
  };
  const LEGACY_CACHE_KEY = 'nabd-ayrad-last-success-v1';
  const LEGACY_HISTORY_KEY = 'nabd-ayrad-observations-v1';
  const SELECTED_SYMBOL_KEY = 'mahfazati-selected-symbol-v1';
  const PORTFOLIO_KEY = 'mahfazati-portfolio-v2';
  const PORTFOLIO_HISTORY_KEY = 'mahfazati-portfolio-observations-v1';
  const GOLD_PORTFOLIO_HISTORY_KEY = 'mahfazati-combined-observations-v1';
  const GOLD_HOLDING_KEY = 'mahfazati-gold-holding-v1';
  const GOLD_QUOTE_KEY = 'mahfazati-gold-market-quote-v1';
  const LEGACY_PORTFOLIO_KEY = 'nabd-ayrad-portfolio-v1';
  const QUOTES_KEY = 'mahfazati-last-quotes-v1';
  let selectedSymbol = readSelectedSymbol();
  let positions = readPositions();
  let goldHolding = readGoldHolding();
  let draftSymbols = [];
  let quoteCache = readQuoteCache();
  let goldQuoteCache = readGoldQuoteCache();
  const number = value => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const dateTime = value => value ? new Intl.DateTimeFormat('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

  function readSelectedSymbol() {
    try {
      const symbol = localStorage.getItem(SELECTED_SYMBOL_KEY);
      return companies.get(symbol) ? symbol : 'AYRD';
    } catch (_) { return 'AYRD'; }
  }

  function historyKey(symbol) { return `mahfazati-${symbol.toLowerCase()}-observations-v1`; }

  function readHistory(symbol = selectedSymbol) {
    try {
      const saved = localStorage.getItem(historyKey(symbol));
      const legacy = symbol === 'AYRD' && saved === null ? localStorage.getItem(LEGACY_HISTORY_KEY) : null;
      const rows = JSON.parse(saved || legacy || '[]');
      return Array.isArray(rows) ? rows.filter(x => x && Number.isFinite(x.price)).slice(-60) : [];
    } catch (_) { return []; }
  }

  function isValidGoldHolding(value) {
    return value && Number.isFinite(value.grams) && value.grams > 0 && value.grams <= 100_000 &&
      [18, 21, 24].includes(value.karat) && Number.isFinite(value.paidPerGram) && value.paidPerGram > 0;
  }

  function readGoldHolding() {
    try {
      const saved = JSON.parse(localStorage.getItem(GOLD_HOLDING_KEY) || 'null');
      return isValidGoldHolding(saved) ? saved : null;
    } catch (_) { return null; }
  }

  function readGoldQuoteCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(GOLD_QUOTE_KEY) || 'null');
      if (!saved || !saved.prices || ![18, 21, 24].every(karat => Number.isFinite(saved.prices[karat]) && saved.prices[karat] > 0)) return null;
      return saved;
    } catch (_) { return null; }
  }

  function portfolioHistoryStorageKey() {
    return goldHolding ? GOLD_PORTFOLIO_HISTORY_KEY : PORTFOLIO_HISTORY_KEY;
  }

  function readPortfolioHistory() {
    try {
      const rows = JSON.parse(localStorage.getItem(portfolioHistoryStorageKey()) || '[]');
      return Array.isArray(rows)
        ? rows.filter(row => row && Number.isFinite(row.total) && row.total > 0 && Number.isFinite(row.time)).slice(-60)
        : [];
    } catch (_) { return []; }
  }

  function smoothLinePath(points) {
    if (points.length < 2) return '';
    const secants = points.slice(0, -1).map((point, index) => points[index + 1].y - point.y);
    const tangents = Array(points.length);
    tangents[0] = secants[0];
    tangents[tangents.length - 1] = secants[secants.length - 1];
    for (let index = 1; index < points.length - 1; index++) {
      const before = secants[index - 1], after = secants[index];
      tangents[index] = before * after <= 0 ? 0 : 2 * before * after / (before + after);
    }
    let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let index = 0; index < secants.length; index++) {
      const delta = secants[index];
      if (delta === 0) tangents[index] = tangents[index + 1] = 0;
      else {
        const alpha = tangents[index] / delta, beta = tangents[index + 1] / delta;
        const magnitude = alpha * alpha + beta * beta;
        if (magnitude > 9) {
          const scale = 3 / Math.sqrt(magnitude);
          tangents[index] = scale * alpha * delta;
          tangents[index + 1] = scale * beta * delta;
        }
      }
      const start = points[index], end = points[index + 1];
      const step = (end.x - start.x) / 3;
      path += ` C${(start.x + step).toFixed(1)},${(start.y + tangents[index] / 3).toFixed(1)} ${(end.x - step).toFixed(1)},${(end.y - tangents[index + 1] / 3).toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
    }
    return path;
  }

  function renderPortfolioChart(rows = readPortfolioHistory()) {
    if (!ui.portfolioChart || !ui.portfolioChartLine || !ui.portfolioChartArea || !ui.portfolioChartPoint || !ui.portfolioChartPoints || !ui.portfolioChartHint) return;
    const visible = rows.slice(-36);
    if (visible.length < 2) {
      ui.portfolioChart.hidden = true;
      ui.portfolioChartLine.setAttribute('d', '');
      ui.portfolioChartArea.setAttribute('d', '');
      ui.portfolioChartPoints.replaceChildren();
      ui.portfolioChartPoint.setAttribute('r', '0');
      ui.portfolioChart.classList.remove('trend-positive', 'trend-negative', 'trend-neutral');
      ui.portfolioChartHint.hidden = false;
      ui.portfolioChartHint.textContent = Object.keys(positions).length === 0 && !goldHolding
        ? 'أضف حيازة لبدء التتبّع'
        : visible.length === 0 ? 'يبدأ التتبّع بعد تحديثين ناجحين' : 'يحتاج المسار إلى قراءة ناجحة أخرى';
      return;
    }

    const values = visible.map(row => row.total);
    const min = Math.min(...values), max = Math.max(...values);
    const spread = max - min || Math.max(max * .05, 1);
    const points = values.map((value, index) => ({
      x: 4 + index * (252 / (values.length - 1)),
      y: max === min ? 20 : 32 - ((value - min) / spread) * 23
    }));
    const line = smoothLinePath(points);
    const first = points[0], last = points[points.length - 1];
    const previousTotal = visible[visible.length - 2].total;
    const latestTotal = visible[visible.length - 1].total;
    const trend = latestTotal > previousTotal ? 'positive' : latestTotal < previousTotal ? 'negative' : 'neutral';
    const trendLabel = trend === 'positive' ? 'اتجاه القيمة صاعد' : trend === 'negative' ? 'اتجاه القيمة هابط' : 'قيمة مستقرة';
    ui.portfolioChart.hidden = false;
    ui.portfolioChart.classList.remove('trend-positive', 'trend-negative', 'trend-neutral');
    ui.portfolioChart.classList.add(`trend-${trend}`);
    ui.portfolioChartHint.hidden = false;
    ui.portfolioChartHint.textContent = `${trendLabel} · ليس عائداً استثمارياً`;
    ui.portfolioChart.setAttribute('aria-label', `مسار القيمة الإجمالية المرصودة للمحفظة؛ ${trendLabel} مقارنة بالقراءة السابقة؛ لا يمثل عائداً استثمارياً.`);
    ui.portfolioChartLine.setAttribute('d', line);
    ui.portfolioChartArea.setAttribute('d', `${line} L${last.x.toFixed(1)},40 L${first.x.toFixed(1)},40 Z`);
    ui.portfolioChartPoints.replaceChildren();
    const markerCount = Math.min(points.length, 8);
    const markerIndices = new Set(Array.from({ length: markerCount }, (_, index) =>
      Math.round(index * (points.length - 1) / Math.max(1, markerCount - 1))));
    for (const index of markerIndices) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('class', 'portfolio-total-point-marker');
      marker.setAttribute('cx', points[index].x.toFixed(1));
      marker.setAttribute('cy', points[index].y.toFixed(1));
      marker.setAttribute('r', '1.6');
      ui.portfolioChartPoints.appendChild(marker);
    }
    ui.portfolioChartPoint.setAttribute('cx', last.x.toFixed(1));
    ui.portfolioChartPoint.setAttribute('cy', last.y.toFixed(1));
    ui.portfolioChartPoint.setAttribute('r', '2.8');
  }

  function goldQuoteIsRecent(quote = goldQuoteCache) {
    const timestamp = quote?.asOfDate ? Date.parse(`${quote.asOfDate}T00:00:00`) : NaN;
    return Number.isFinite(timestamp) && timestamp <= Date.now() + 86_400_000 && Date.now() - timestamp <= 7 * 86_400_000;
  }

  function savePortfolioObservation(refreshedSymbols, goldRefreshed = false) {
    try {
      const holdings = Object.entries(positions).map(([symbol, quantity]) => ({ symbol, quantity }));
      const snapshotQuotes = { ...quoteCache };
      const freshSymbols = new Set(refreshedSymbols);
      if (goldHolding) {
        if (!goldRefreshed || !goldQuoteIsRecent()) return;
        const goldSymbol = `GOLD${goldHolding.karat}`;
        holdings.push({ symbol: goldSymbol, quantity: goldHolding.grams, unit: 'gram' });
        snapshotQuotes[goldSymbol] = { price: goldQuoteCache?.prices?.[goldHolding.karat] };
        freshSymbols.add(goldSymbol);
      }
      if (!holdings.length) return;
      const snapshot = portfolio.createSnapshot(holdings, snapshotQuotes, freshSymbols, Date.now());
      if (!snapshot) return;
      const history = readPortfolioHistory();
      history.push(snapshot);
      localStorage.setItem(portfolioHistoryStorageKey(), JSON.stringify(history.slice(-60)));
    } catch (_) { /* Snapshot storage is optional; never block a successful quote refresh. */ }
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
      const quotes = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
      if (!quotes.AYRD) {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_CACHE_KEY) || 'null');
        if (legacy && Number.isFinite(legacy.price) && legacy.price > 0) {
          quotes.AYRD = { ...legacy, _retrievedAt: Date.parse(legacy.fetchedAt) || 0 };
        }
      }
      return quotes;
    } catch (_) { return {}; }
  }

  function renderFocusPicker() {
    if (!ui.focusSelect) return;
    ui.focusSelect.replaceChildren();
    for (const company of companies.all()) {
      const option = document.createElement('option'); option.value = company.symbol;
      option.textContent = companyDisplayName(company);
      ui.focusSelect.appendChild(option);
    }
    ui.focusSelect.value = selectedSymbol;
  }

  function renderSelectedQuote() {
    const company = companies.get(selectedSymbol);
    if (!company) return;
    const quote = quoteCache[selectedSymbol];
    if (ui.focusSelect) ui.focusSelect.value = selectedSymbol;
    if (ui.focusName) ui.focusName.textContent = company.arabicName;
    if (ui.focusSymbol) ui.focusSymbol.textContent = company.symbol;
    if (ui.focusFullName) ui.focusFullName.textContent = company.name;
    if (ui.detailsSymbol) ui.detailsSymbol.textContent = company.symbol;

    if (ui.focusLogo && ui.focusFallback) {
      ui.focusLogo.hidden = true;
      ui.focusFallback.hidden = Boolean(company.logoUrl);
      ui.focusFallback.textContent = company.symbol.slice(0, 1);
      ui.focusLogo.removeAttribute('src');
      ui.focusLogo.alt = company.logoUrl ? `شعار شركة ${company.arabicName}` : '';
      if (company.logoUrl) {
        ui.focusLogo.addEventListener('error', () => {
          ui.focusLogo.hidden = true; ui.focusFallback.hidden = false;
        }, { once: true });
        ui.focusLogo.src = company.logoUrl;
        ui.focusLogo.hidden = false;
      }
    }

    const hasPrice = quote && Number.isFinite(quote.price) && quote.price > 0;
    if (ui.sharePrice) ui.sharePrice.textContent = hasPrice ? `${number(quote.price)} دج` : 'لا توجد قراءة ناجحة';
    if (ui.type) ui.type.textContent = hasPrice ? quote.priceLabel || 'السعر المنشور' : 'بانتظار التحديث';
    const quoteIsStale = Boolean(quote?._retrievedAt && Date.now() - quote._retrievedAt > 60000);
    if (ui.note) {
      ui.note.textContent = !hasPrice
        ? 'لا توجد قراءة ناجحة لهذا السهم بعد.'
        : quoteIsStale
          ? 'آخر قراءة محفوظة وقد لا تكون حديثة.'
          : quote.priceType === 'close'
            ? 'إغلاق منشور من SGBV، وليس سعراً مباشراً.'
            : 'السعر المتاح افتتاحي/مرجعي من SGBV، وليس إغلاقاً.';
    }
    if (ui.date) ui.date.textContent = quote?.sessionDate || 'غير متاح من المصدر';
    if (ui.checked) ui.checked.textContent = hasPrice ? dateTime(quote.fetchedAt) : '—';
    if (ui.opening) ui.opening.textContent = Number.isFinite(quote?.openingPrice) ? `${number(quote.openingPrice)} دج` : 'غير منشور';
    if (ui.closing) ui.closing.textContent = Number.isFinite(quote?.closingPrice) ? `${number(quote.closingPrice)} دج` : 'غير منشور';
    const hasPreviousReading = Number.isFinite(quote?._observedDelta);
    if (ui.movementCaption) {
      ui.movementCaption.textContent = !hasPrice
        ? 'لا توجد قراءة لهذا السهم'
        : !hasPreviousReading
          ? 'لا توجد قراءة سابقة للمقارنة'
          : quote._observedDelta === 0
            ? 'لم يتغير السعر منذ آخر فحص ناجح'
            : quote._observedDelta > 0
              ? 'ارتفع السعر منذ آخر فحص ناجح'
              : 'انخفض السعر منذ آخر فحص ناجح';
    }
    if (!hasPreviousReading) showMovement(null, null);
    else showMovement(null, quote.price, quote._observedDelta);
    const history = readHistory(selectedSymbol);
    renderChart(history); renderActivity(history);
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
      const priceText = document.createElement('strong'); priceText.dir = 'auto'; priceText.textContent = price === null ? 'لا توجد قراءة ناجحة' : `${number(price)} دج`;
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
      const valueText = document.createElement('strong'); valueText.dir = 'auto'; valueText.textContent = value === null ? '—' : `${number(value)} دج`;
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

  function renderHomePortfolioPreview() {
    if (!ui.homeHoldingsPreview) return;
    ui.homeHoldingsPreview.replaceChildren();
    const held = Object.entries(positions).filter(([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0);
    if (!held.length && !goldHolding) {
      const empty = document.createElement('div'); empty.className = 'home-holdings-empty';
      const message = document.createElement('p'); message.textContent = 'لم تضف أسهماً أو ذهباً بعد. أضف حيازاتك لمتابعة قيمتها هنا.';
      const link = document.createElement('a'); link.href = '#portfolio'; link.className = 'home-add-holding'; link.textContent = 'إضافة حيازة';
      empty.append(message, link); ui.homeHoldingsPreview.appendChild(empty); return;
    }

    if (goldHolding) {
      const gold = document.createElement('article'); gold.className = 'home-holding-card home-gold-card';
      const heading = document.createElement('div'); heading.className = 'home-holding-heading';
      const identity = document.createElement('div'); identity.className = 'home-holding-identity';
      const mark = document.createElement('span'); mark.className = 'home-gold-mark'; mark.textContent = 'Au';
      const copy = document.createElement('span'); copy.className = 'home-holding-copy';
      const name = document.createElement('strong'); name.textContent = `ذهب عيار ${goldHolding.karat}`;
      const karat = document.createElement('small'); karat.textContent = 'مرجع السوق الموازية';
      copy.append(name, karat); identity.append(mark, copy);
      const unitPrice = goldQuoteCache?.prices?.[goldHolding.karat];
      const priceBlock = document.createElement('div'); priceBlock.className = 'home-holding-price';
      const label = document.createElement('small'); label.textContent = 'سعر الغرام الموازي';
      const price = document.createElement('strong'); price.textContent = Number.isFinite(unitPrice) ? `${number(unitPrice)} دج` : '—';
      priceBlock.append(label, price); heading.append(identity, priceBlock);
      const footer = document.createElement('div'); footer.className = 'home-holding-footer';
      const weight = document.createElement('span'); weight.textContent = `${number(goldHolding.grams)} غرام`;
      const value = document.createElement('span');
      const currentValue = Number.isFinite(unitPrice) ? portfolio.estimateGoldValue(goldHolding.grams, unitPrice) : null;
      value.textContent = currentValue === null ? 'القيمة التقديرية —' : `القيمة التقديرية ${number(currentValue)} دج`;
      footer.append(weight, value);
      const details = document.createElement('div'); details.className = 'home-holding-details';
      const difference = document.createElement('span'); difference.className = 'home-holding-change';
      if (currentValue === null) difference.textContent = 'بانتظار سعر السوق الموازية';
      else {
        const delta = Number((currentValue - goldHolding.grams * goldHolding.paidPerGram).toFixed(2));
        difference.classList.add(delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable');
        difference.textContent = delta > 0 ? `فرق عن التكلفة +${number(delta)} دج` : delta < 0 ? `فرق عن التكلفة −${number(Math.abs(delta))} دج` : 'القيمة مساوية للتكلفة';
      }
      const asOf = document.createElement('span'); asOf.className = 'home-holding-updated';
      asOf.textContent = goldQuoteCache?.asOfDate ? `مرجع ${goldQuoteCache.asOfDate}` : 'لم يُحدّث بعد';
      details.append(difference, asOf); gold.append(heading, footer, details);
      ui.homeHoldingsPreview.appendChild(gold);
    }

    for (const [symbol, quantity] of held.slice(0, 3)) {
      const company = companies.get(symbol);
      if (!company) continue;
      const quote = quoteCache[symbol];
      const price = quote && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
      const value = price === null ? null : portfolio.estimateValue(quantity, price);
      const card = document.createElement('article'); card.className = 'home-holding-card';

      const heading = document.createElement('div'); heading.className = 'home-holding-heading';
      const identity = document.createElement('div'); identity.className = 'home-holding-identity';
      const mark = document.createElement('span'); mark.className = 'home-company-mark';
      if (company.logoUrl) {
        const logo = document.createElement('img'); logo.src = company.logoUrl; logo.alt = ''; logo.loading = 'lazy'; logo.decoding = 'async';
        const fallback = document.createElement('span'); fallback.className = 'home-company-fallback';
        fallback.textContent = company.symbol.slice(0, 2); fallback.hidden = true;
        logo.addEventListener('error', () => { logo.hidden = true; fallback.hidden = false; }, { once: true });
        mark.append(logo, fallback);
      } else {
        mark.textContent = company.symbol.slice(0, 2);
      }
      const companyCopy = document.createElement('span'); companyCopy.className = 'home-holding-copy';
      const name = document.createElement('strong'); name.textContent = company.arabicName;
      const ticker = document.createElement('small'); ticker.textContent = `${company.symbol} · ${company.sector}`;
      companyCopy.append(name, ticker); identity.append(mark, companyCopy);
      const priceBlock = document.createElement('div'); priceBlock.className = 'home-holding-price';
      const priceLabel = document.createElement('small'); priceLabel.textContent = 'آخر سعر مسجل';
      const priceText = document.createElement('strong'); priceText.dir = 'auto'; priceText.textContent = price === null ? '—' : `${number(price)} دج`;
      priceBlock.append(priceLabel, priceText); heading.append(identity, priceBlock);

      const footer = document.createElement('div'); footer.className = 'home-holding-footer';
      const quantityText = document.createElement('span'); quantityText.textContent = `${new Intl.NumberFormat('ar-DZ').format(quantity)} سهم`;
      const valueText = document.createElement('span'); valueText.textContent = value === null ? 'القيمة التقديرية —' : `القيمة التقديرية ${number(value)} دج`;
      footer.append(quantityText, valueText);

      const details = document.createElement('div'); details.className = 'home-holding-details';
      const history = readHistory(symbol);
      const previous = history.length > 1 ? history[history.length - 2] : null;
      const latest = history.length ? history[history.length - 1] : null;
      const change = previous && latest ? Number((latest.price - previous.price).toFixed(2)) : null;
      const changeText = document.createElement('span'); changeText.className = 'home-holding-change';
      if (change === null) changeText.textContent = 'لا توجد مقارنة سابقة';
      else {
        changeText.classList.add(change > 0 ? 'up' : change < 0 ? 'down' : 'stable');
        changeText.textContent = change > 0 ? `↑ +${number(change)} دج بين فحصين` : change < 0 ? `↓ −${number(Math.abs(change))} دج بين فحصين` : '— دون تغير بين فحصين';
      }
      const updated = document.createElement('span'); updated.className = 'home-holding-updated';
      updated.textContent = quote?.fetchedAt ? dateTime(quote.fetchedAt) : 'لم يُحدّث بعد';
      details.append(changeText, updated); card.append(heading, footer, details);
      ui.homeHoldingsPreview.appendChild(card);
    }

    if (held.length > 3) {
      const more = document.createElement('a'); more.href = '#portfolio'; more.className = 'home-holdings-more';
      more.textContent = `عرض كل الحيازات (${new Intl.NumberFormat('ar-DZ').format(held.length)})`;
      ui.homeHoldingsPreview.appendChild(more);
    }
  }

  function renderPortfolioObservations() {
    const history = readPortfolioHistory();
    const latest = history[history.length - 1];
    if (ui.portfolioUpdated) ui.portfolioUpdated.textContent = latest
      ? `آخر قراءة مكتملة · ${dateTime(latest.time)}`
      : 'يظهر وقت آخر فحص ناجح هنا';
    if (!ui.portfolioTotalChange) return;
    const previous = history.length > 1 ? history[history.length - 2] : null;
    if (!previous || !latest) { ui.portfolioTotalChange.hidden = true; return; }
    const change = Number((latest.total - previous.total).toFixed(2));
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    ui.portfolioTotalChange.hidden = false;
    ui.portfolioTotalChange.className = `portfolio-total-observed-change ${trend}`;
    ui.portfolioTotalChange.textContent = change > 0
      ? `↑ +${number(change)} دج بين فحصين`
      : change < 0 ? `↓ −${number(Math.abs(change))} دج بين فحصين` : '— دون تغير بين فحصين';
  }

  function renderGoldHoldingDetails() {
    if (!ui.goldForm) return;
    ui.goldWeight.value = goldHolding ? String(goldHolding.grams) : '';
    ui.goldKarat.value = String(goldHolding?.karat || 21);
    ui.goldCost.value = goldHolding ? String(goldHolding.paidPerGram) : '';
    ui.goldRemove.hidden = !goldHolding;
    if (!goldHolding) {
      ui.goldUnitPrice.textContent = '—'; ui.goldValue.textContent = '—'; ui.goldCostTotal.textContent = '—';
      ui.goldDifference.textContent = '—'; ui.goldDifferenceRow.classList.remove('up', 'down', 'stable');
      ui.goldStatus.textContent = 'أدخل بيانات حيازتك لحفظها على هذا الجهاز.';
      return;
    }
    const unitPrice = goldQuoteCache?.prices?.[goldHolding.karat];
    const currentValue = Number.isFinite(unitPrice) ? portfolio.estimateGoldValue(goldHolding.grams, unitPrice) : null;
    const costTotal = Number((goldHolding.grams * goldHolding.paidPerGram).toFixed(2));
    ui.goldUnitPrice.textContent = Number.isFinite(unitPrice) ? `${number(unitPrice)} دج / غرام` : 'لا توجد قراءة';
    ui.goldValue.textContent = currentValue === null ? '—' : `${number(currentValue)} دج`;
    ui.goldCostTotal.textContent = `${number(costTotal)} دج`;
    ui.goldDifferenceRow.classList.remove('up', 'down', 'stable');
    if (currentValue === null) ui.goldDifference.textContent = '—';
    else {
      const difference = Number((currentValue - costTotal).toFixed(2));
      const trend = difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable';
      ui.goldDifferenceRow.classList.add(trend);
      ui.goldDifference.textContent = difference > 0 ? `+${number(difference)} دج` : difference < 0 ? `−${number(Math.abs(difference))} دج` : '0 دج';
    }
    if (goldQuoteCache?.asOfDate) {
      ui.goldStatus.textContent = `${goldQuoteIsRecent() ? 'آخر مرجع متاح' : 'آخر مرجع محفوظ وقد يكون قديماً'} من EXDZ · ${goldQuoteCache.asOfDate}`;
    } else ui.goldStatus.textContent = 'لا توجد قراءة سوق موازية محفوظة؛ اضغط «تحديث الأسعار». ';
  }

  function saveGoldHolding(event) {
    event?.preventDefault();
    const grams = Number(ui.goldWeight.value);
    const karat = Number(ui.goldKarat.value);
    const paidPerGram = Number(ui.goldCost.value);
    const next = { grams, karat, paidPerGram, savedAt: Date.now() };
    if (!isValidGoldHolding(next)) {
      showGoldFeedback('تحقق من الوزن والعيار وتكلفة الشراء للغرام.');
      return;
    }
    try {
      localStorage.setItem(GOLD_HOLDING_KEY, JSON.stringify(next));
      goldHolding = next;
      if (ui.goldFeedback) ui.goldFeedback.hidden = true;
      renderPortfolio();
      void refreshGoldQuote().then(() => renderPortfolio());
      showGoldFeedback('حُفظت حيازة الذهب على هذا الجهاز فقط.');
    } catch (_) { showGoldFeedback('تعذّر حفظ حيازة الذهب في هذا المتصفح.'); }
  }

  function removeGoldHolding() {
    try {
      localStorage.removeItem(GOLD_HOLDING_KEY);
      goldHolding = null;
      renderPortfolio();
      showGoldFeedback('أُزيلت حيازة الذهب من هذا الجهاز.');
    } catch (_) { showGoldFeedback('تعذّرت إزالة حيازة الذهب من هذا المتصفح.'); }
  }

  function showGoldFeedback(message) {
    if (!ui.goldFeedback) return;
    ui.goldFeedback.textContent = message;
    ui.goldFeedback.hidden = false;
  }

  async function refreshGoldQuote() {
    if (!goldHolding) return false;
    if (ui.goldStatus) ui.goldStatus.textContent = 'جارٍ جلب مرجع الذهب من السوق الموازية…';
    try {
      const response = await fetch('/api/gold', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json();
      const asOf = data?.asOfDate ? Date.parse(`${data.asOfDate}T00:00:00`) : NaN;
      const validPrices = data?.prices && [18, 21, 24].every(karat => Number.isFinite(data.prices[karat]) && data.prices[karat] > 0);
      if (!response.ok || !validPrices || !Number.isFinite(asOf) || Date.now() - asOf > 7 * 86_400_000 || asOf > Date.now() + 86_400_000) {
        throw new Error(data.error || 'لم يقدّم المصدر سعراً حديثاً صالحاً.');
      }
      goldQuoteCache = { ...data, _retrievedAt: Date.now() };
      try { localStorage.setItem(GOLD_QUOTE_KEY, JSON.stringify(goldQuoteCache)); } catch (_) {}
      if (ui.goldStatus) ui.goldStatus.textContent = `تم تحديث مرجع EXDZ للسوق الموازية · ${data.asOfDate}`;
      return true;
    } catch (error) {
      if (ui.goldStatus) ui.goldStatus.textContent = `${error.message || 'تعذّر تحديث سعر الذهب.'} ${goldQuoteCache ? `نعرض آخر مرجع محفوظ (${goldQuoteCache.asOfDate || 'تاريخه غير معروف'}).` : 'لا يوجد سعر محفوظ.'}`;
      return false;
    }
  }

  function showPortfolioFeedback(message) {
    ui.portfolioFeedback.textContent = message;
    ui.portfolioFeedback.hidden = false;
  }

  function calculateCombinedPortfolioTotal() {
    const held = Object.entries(positions).filter(([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0);
    const stockTotal = held.length
      ? portfolio.totalValue(held.map(([symbol, quantity]) => ({ quantity, price: quoteCache[symbol]?.price })))
      : 0;
    if (stockTotal === null) return null;
    const goldValue = goldHolding
      ? portfolio.estimateGoldValue(goldHolding.grams, goldQuoteCache?.prices?.[goldHolding.karat])
      : 0;
    if (goldValue === null || (!held.length && !goldHolding)) return null;
    return Number((stockTotal + goldValue).toFixed(2));
  }

  function renderPortfolio() {
    const held = Object.entries(positions).filter(([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0);
    const total = calculateCombinedPortfolioTotal();
    const formattedAmount = total === null ? '—' : number(total);
    const formattedTotal = total === null ? '—' : `${formattedAmount} دج`;
    if (ui.price) {
      ui.price.textContent = formattedAmount;
      const compactSize = Math.max(21, Math.min(40, 350 / (formattedAmount.length + 1)));
      ui.price.style.setProperty('--total-mobile-size', `${compactSize.toFixed(1)}px`);
    }
    if (ui.portfolioTotal) ui.portfolioTotal.textContent = formattedTotal;
    renderGoldHoldingDetails();
    renderCompanyList();
    renderHomePortfolioPreview();
    renderPortfolioObservations();
    renderPortfolioChart();
  }

  async function refresh() {
    if (ui.button.disabled) return;
    ui.button.disabled = true; ui.button.classList.add('loading');
    ui.status.textContent = 'جارٍ التحقق من أسعار الأسهم من المصدر الرسمي…';
    ui.error.hidden = true;
    const goldTask = goldHolding ? refreshGoldQuote() : Promise.resolve(false);
    try {
      const response = await fetch('/api/quotes', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.quotes || typeof data.quotes !== 'object') throw new Error(data.error || 'تعذّر قراءة أسعار الشركات.');
      const returnedSymbols = new Set();
      for (const [symbol, quote] of Object.entries(data.quotes)) {
        if (!companies.get(symbol) || !Number.isFinite(quote.price) || quote.price <= 0) continue;
        const previous = quoteCache[symbol];
        const change = previous && Number.isFinite(previous.price)
          ? Number((quote.price - previous.price).toFixed(2)) : null;
        quoteCache[symbol] = { ...quote, _retrievedAt: Date.now(), _observedDelta: change };
        const history = readHistory(symbol);
        history.push({ price: quote.price, time: quote.fetchedAt });
        localStorage.setItem(historyKey(symbol), JSON.stringify(history.slice(-60)));
        returnedSymbols.add(symbol);
      }
      const goldRefreshed = await goldTask;
      savePortfolioObservation(returnedSymbols, goldRefreshed);
      localStorage.setItem(QUOTES_KEY, JSON.stringify(quoteCache));
      renderPortfolio(); renderSelectedQuote();
      const unavailableHeld = Object.keys(positions).filter(symbol => !returnedSymbols.has(symbol));
      const selectedUnavailable = !returnedSymbols.has(selectedSymbol);
      const warning = [];
      if (selectedUnavailable) warning.push(`لم تصل قراءة حديثة لسهم ${selectedSymbol}`);
      if (unavailableHeld.length) warning.push('لم تصل قراءة حديثة لكل حيازات المحفظة');
      if (ui.quoteFeedback) {
        ui.quoteFeedback.textContent = warning.length
          ? `${warning.join('، ')}؛ نعرض آخر قراءة محفوظة إن توفرت، ولا يظهر الإجمالي إذا غاب سعر صالح.`
          : '';
        ui.quoteFeedback.hidden = warning.length === 0;
      }
      ui.status.textContent = 'تم فحص الأسعار المتاحة من SGBV';
    } catch (error) {
      const goldRefreshed = await goldTask;
      if (goldRefreshed) savePortfolioObservation(new Set(), true);
      renderPortfolio(); renderSelectedQuote();
      ui.error.textContent = `${error.message || 'تعذّر الاتصال بالمصدر الرسمي.'} ${Object.keys(quoteCache).length ? 'نعرض آخر الأسعار المحفوظة وقد لا تكون حديثة.' : 'لا توجد أسعار محفوظة.'}`;
      ui.error.hidden = false;
      ui.status.textContent = 'لم ينجح هذا الفحص';
    } finally {
      ui.button.disabled = false; ui.button.classList.remove('loading');
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

  renderCompanyPicker(); renderFocusPicker();
  renderPortfolio(); renderSelectedQuote();
  ui.addCompany?.addEventListener('click', addSelectedCompany);
  ui.focusSelect?.addEventListener('change', () => {
    selectedSymbol = companies.get(ui.focusSelect.value)?.symbol || 'AYRD';
    try { localStorage.setItem(SELECTED_SYMBOL_KEY, selectedSymbol); } catch (_) {}
    renderSelectedQuote();
  });
  ui.button.addEventListener('click', refresh);
  ui.goldForm?.addEventListener('submit', saveGoldHolding);
  ui.goldRemove?.addEventListener('click', removeGoldHolding);
  const mobileScreenQuery = window.matchMedia('(max-width: 650px)');
  const mobileScreenSections = [...document.querySelectorAll('[data-mobile-screen]')];
  const mobileNavLinks = [...document.querySelectorAll('.bottom-nav [data-screen-target]')];
  const mobileScreens = new Set(['home', 'portfolio', 'chart', 'history']);
  const hashScreens = {
    home: 'home', top: 'home', details: 'home', 'pwa-info': 'home',
    portfolio: 'portfolio', 'chart-section': 'chart', chart: 'chart',
    activity: 'history', history: 'history'
  };
  let activeMobileScreen = hashScreens[location.hash.slice(1)] || 'home';
  const mobileScrollPositions = { home: 0, portfolio: 0, chart: 0, history: 0 };

  function applyMobileScreen(screen, { updateHash = false, scroll = false } = {}) {
    if (!mobileScreens.has(screen)) return;
    const previousScreen = activeMobileScreen;
    if (mobileScreenQuery.matches && scroll && previousScreen !== screen) mobileScrollPositions[previousScreen] = window.scrollY;
    activeMobileScreen = screen;
    if (updateHash && location.hash !== `#${screen === 'chart' ? 'chart-section' : screen === 'history' ? 'activity' : screen}`) {
      history.pushState(null, '', `#${screen === 'chart' ? 'chart-section' : screen === 'history' ? 'activity' : screen}`);
    }
    const isMobile = mobileScreenQuery.matches;
    mobileScreenSections.forEach(section => {
      section.hidden = isMobile && section.dataset.mobileScreen !== screen;
    });
    mobileNavLinks.forEach(link => {
      const selected = link.dataset.screenTarget === screen;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (isMobile && scroll) {
      requestAnimationFrame(() => window.scrollTo({ top: mobileScrollPositions[screen] || 0, behavior: 'auto' }));
    }
  }

  mobileNavLinks.forEach(link => link.addEventListener('click', event => {
    if (!mobileScreenQuery.matches) return;
    event.preventDefault();
    applyMobileScreen(link.dataset.screenTarget, { updateHash: true, scroll: true });
  }));
  const syncScreenFromHash = () => {
    const screen = hashScreens[location.hash.slice(1)] || activeMobileScreen || 'home';
    applyMobileScreen(screen, { scroll: mobileScreenQuery.matches });
  };
  window.addEventListener('hashchange', syncScreenFromHash);
  window.addEventListener('popstate', syncScreenFromHash);
  mobileScreenQuery.addEventListener?.('change', () => applyMobileScreen(activeMobileScreen));
  applyMobileScreen(activeMobileScreen, { scroll: mobileScreenQuery.matches });

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
