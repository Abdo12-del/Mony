(() => {
  const $ = id => document.getElementById(id);
  const ui = {
    price: $('price'), type: $('price-kind'), note: $('price-note'), date: $('session-date'), checked: $('checked-at'),
    error: $('error'), button: $('refresh'), status: $('refresh-status'), movement: $('movement'),
    movementCaption: $('movement-caption'), opening: $('opening-price'), closing: $('closing-price'),
    chartLine: $('chart-line'), chartArea: $('chart-area'), chartPoint: $('chart-point'), chartEmpty: $('chart-empty'),
    chartCount: $('observation-count'), chartFirst: $('chart-first'), chartLast: $('chart-last')
  };
  const CACHE_KEY = 'nabd-ayrad-last-success-v1';
  const HISTORY_KEY = 'nabd-ayrad-observations-v1';
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

  function showMovement(previous, current, knownChange) {
    const change = Number.isFinite(knownChange) ? knownChange : previous === null ? null : Number((current - previous).toFixed(2));
    if (change === null) { ui.movement.hidden = true; return; }
    ui.movement.hidden = false;
    ui.movement.className = `movement ${change > 0 ? 'up' : change < 0 ? 'down' : 'stable'}`;
    ui.movement.textContent = change > 0 ? `↑ +${number(change)} دج` : change < 0 ? `↓ −${number(Math.abs(change))} دج` : '— دون تغيّر';
  }

  function showQuote(data, cached = false) {
    ui.price.textContent = number(data.price);
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
  }

  function showCached() {
    try {
      const old = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!old || !Number.isFinite(old.price)) return null;
      showQuote(old, true);
      renderChart(readHistory());
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
      showQuote(data); showMovement(previous, data.price); renderChart(history.slice(-60));
      ui.status.textContent = 'تم الفحص بنجاح · البيانات من SGBV';
    } catch (error) {
      ui.error.textContent = `${error.message || 'تعذّر الاتصال.'} ${saved ? 'نعرض آخر سعر محفوظ وقد لا يكون حديثاً.' : 'لا يوجد سعر محفوظ لعرضه.'}`;
      ui.error.hidden = false; ui.status.textContent = 'لم ينجح هذا الفحص';
    } finally {
      ui.button.disabled = false; ui.button.classList.remove('loading');
    }
  }
  showCached(); renderChart(readHistory());
  ui.button.addEventListener('click', refresh);
  refresh();
})();
