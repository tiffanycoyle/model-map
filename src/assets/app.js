/* Home page: reference search and sort, and the URL-backed setup picker.
   Every node is built with DOM APIs — no HTML string interpolation anywhere. */
(function () {
  'use strict';

  var DATA = window.MM_DATA;
  if (!DATA || !DATA.models) return;

  var MODELS = DATA.models;
  var CACHE_READ_RATE = 0.1;

  /* ---------- small DOM helpers ---------- */
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 100) return '$' + Math.round(n).toLocaleString('en-US');
    if (n >= 10) return '$' + n.toFixed(0);
    return '$' + n.toFixed(2);
  }

  function fullyPriced(m) { return typeof m.pin === 'number' && typeof m.pout === 'number'; }

  function priceLabel(m) {
    if (fullyPriced(m)) return '$' + m.pin + ' / $' + m.pout;
    if (typeof m.pout === 'number') return 'out $' + m.pout;
    return 'price unconfirmed';
  }

  /* ================= Reference: search + sort ================= */
  var refTools = document.querySelector('[data-enhance="reftools"]');
  if (refTools) {
    var searchInput = document.getElementById('refsearch');
    var sortSelect = document.getElementById('refsort');
    var countEl = document.getElementById('refcount');
    var groups = [
      { box: document.getElementById('ref-closed'), empty: document.getElementById('noresults-closed') },
      { box: document.getElementById('ref-open'), empty: document.getElementById('noresults-open') },
    ].filter(function (g) { return g.box; });

    var comparators = {
      rank: function (a, b) { return num(b, 'rank') - num(a, 'rank'); },
      'price-asc': function (a, b) { return priceOf(a) - priceOf(b); },
      'price-desc': function (a, b) {
        var pa = priceOf(a), pb = priceOf(b);
        // Unconfirmed prices stay last in both directions.
        if (pa === Infinity && pb === Infinity) return 0;
        if (pa === Infinity) return 1;
        if (pb === Infinity) return -1;
        return pb - pa;
      },
      name: function (a, b) { return str(a, 'name').localeCompare(str(b, 'name')); },
      vendor: function (a, b) {
        return str(a, 'vendor').localeCompare(str(b, 'vendor')) || str(a, 'name').localeCompare(str(b, 'name'));
      },
    };

    function num(node, key) { return parseFloat(node.dataset[key]) || 0; }
    function str(node, key) { return node.dataset[key] || ''; }
    function priceOf(node) {
      var v = node.dataset.pout;
      return v === '' || v === undefined ? Infinity : parseFloat(v);
    }

    function applyRef() {
      var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
      var mode = sortSelect ? sortSelect.value : 'rank';
      var shown = 0;

      groups.forEach(function (g) {
        var rows = Array.prototype.slice.call(g.box.querySelectorAll('details.mrow'));
        var visibleCount = 0;

        rows.forEach(function (row) {
          var hay = row.dataset.name + ' ' + row.dataset.vendor + ' ' +
            row.dataset.license + ' ' + row.dataset.jobs;
          var hit = !q || hay.indexOf(q) !== -1;
          row.hidden = !hit;
          if (hit) { visibleCount++; shown++; }
        });

        rows.slice().sort(comparators[mode] || comparators.rank).forEach(function (row) {
          g.box.appendChild(row);
        });

        if (g.empty) g.empty.hidden = visibleCount !== 0;
      });

      if (countEl) {
        countEl.textContent = q
          ? shown + ' of ' + MODELS.length + ' models match “' + q + '”'
          : MODELS.length + ' models';
      }
    }

    if (searchInput) searchInput.addEventListener('input', applyRef);
    if (sortSelect) sortSelect.addEventListener('change', applyRef);
    applyRef();

    /* Press "/" anywhere to jump to search. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (!searchInput) return;
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    });
  }

  /* ================= CSV export ================= */
  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv(models) {
    var cols = ['id', 'name', 'vendor', 'country', 'pin', 'pout', 'ctx', 'weights', 'license', 'params', 'jobs'];
    var lines = [cols.join(',')];
    models.forEach(function (m) {
      lines.push(cols.map(function (c) {
        return csvCell(c === 'jobs' ? (m.jobs || []).join(' ') : m[c]);
      }).join(','));
    });
    return lines.join('\r\n');
  }

  function download(filename, text, mime) {
    var blob = new Blob(['﻿' + text], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var csvBtn = document.getElementById('export-csv');
  if (csvBtn) {
    csvBtn.hidden = false;
    csvBtn.addEventListener('click', function () {
      download('model-map-' + DATA.version + '.csv', buildCsv(MODELS), 'text/csv');
    });
  }

  /* ================= The picker ================= */
  var picker = document.querySelector('[data-enhance="picker"]');
  if (!picker) return;

  var jobsEl = document.getElementById('jobs');
  var consEl = document.getElementById('cons');
  var budgetEl = document.getElementById('budget');
  var usageEl = document.getElementById('usage');
  var inEl = document.getElementById('vin');
  var outEl = document.getElementById('vout');
  var cacheEl = document.getElementById('vcache');
  var cacheOut = document.getElementById('vcache-out');
  var resultsEl = document.getElementById('results');
  var rcountEl = document.getElementById('rcount');
  var rnoteEl = document.getElementById('rnote');

  var USAGE_PRESETS = {};
  if (usageEl) {
    Array.prototype.forEach.call(usageEl.children, function (b) {
      USAGE_PRESETS[b.dataset.key] = null; // filled from DATA below
    });
  }
  (DATA.usage || []).forEach(function (u) { USAGE_PRESETS[u[0]] = { in: u[2], out: u[3] }; });

  var VALID_JOBS = {};
  MODELS.forEach(function (m) { (m.jobs || []).forEach(function (j) { VALID_JOBS[j] = true; }); });
  var VALID_CONS = { open: 1, oneGpu: 1, m1: 1, eu: 1, zdr: 1 };
  var VALID_BUDGETS = { any: 1, '1': 1, '5': 1, '20': 1 };

  var state = { job: null, cons: {}, budget: 'any', usage: 'medium', vin: 50, vout: 5, cache: 0 };

  /* ---------- URL state ---------- */
  function clampNum(v, min, max, fallback) {
    var n = parseFloat(v);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function readUrl() {
    var p;
    try { p = new URLSearchParams(window.location.search); } catch (e) { return; }

    var job = p.get('job');
    if (job && VALID_JOBS[job]) state.job = job;

    var cons = (p.get('c') || '').split(',');
    cons.forEach(function (c) { if (VALID_CONS[c]) state.cons[c] = true; });

    var b = p.get('b');
    if (b && VALID_BUDGETS[b]) state.budget = b;

    if (p.has('in') || p.has('out')) {
      state.vin = clampNum(p.get('in'), 0, 1000000, 50);
      state.vout = clampNum(p.get('out'), 0, 1000000, 5);
      state.usage = matchPreset(state.vin, state.vout);
    } else {
      var u = p.get('u');
      if (u && USAGE_PRESETS[u]) {
        state.usage = u;
        state.vin = USAGE_PRESETS[u].in;
        state.vout = USAGE_PRESETS[u].out;
      }
    }

    if (p.has('cache')) state.cache = clampNum(p.get('cache'), 0, 95, 0);
  }

  function matchPreset(vin, vout) {
    var found = null;
    Object.keys(USAGE_PRESETS).forEach(function (k) {
      var u = USAGE_PRESETS[k];
      if (u && u.in === vin && u.out === vout) found = k;
    });
    return found;
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.job) p.set('job', state.job);
    var cons = Object.keys(state.cons).filter(function (k) { return state.cons[k]; }).sort();
    if (cons.length) p.set('c', cons.join(','));
    if (state.budget !== 'any') p.set('b', state.budget);
    if (state.usage && USAGE_PRESETS[state.usage]) {
      if (state.usage !== 'medium') p.set('u', state.usage);
    } else {
      p.set('in', String(state.vin));
      p.set('out', String(state.vout));
    }
    if (state.cache > 0) p.set('cache', String(state.cache));

    var qs = p.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '') + '#build';
    try { window.history.replaceState(null, '', url); } catch (e) { /* ignore */ }
  }

  /* ---------- cost model ---------- */
  function monthlyCost(m) {
    if (!fullyPriced(m)) return null;
    var hit = Math.min(Math.max(state.cache / 100, 0), 0.95);
    var input = state.vin * m.pin * (1 - hit) + state.vin * m.pin * hit * CACHE_READ_RATE;
    return input + state.vout * m.pout;
  }

  function matches(m) {
    if (state.job && (m.jobs || []).indexOf(state.job) === -1) return false;
    if (state.cons.open && m.weights !== 'open') return false;
    if (state.cons.oneGpu && !m.oneGpu) return false;
    if (state.cons.m1 && !m.m1) return false;
    if (state.cons.eu && !m.eu) return false;
    if (state.cons.zdr && !m.zdr) return false;
    if (state.budget !== 'any') {
      if (typeof m.pout !== 'number') return false;
      if (m.pout > parseFloat(state.budget)) return false;
    }
    return true;
  }

  /* ---------- rendering ---------- */
  function specSpan(key, value, cls) {
    var wrap = el('span', 'cs');
    wrap.appendChild(el('span', 'csk', key));
    wrap.appendChild(el('span', 'csv' + (cls || ''), value));
    return wrap;
  }

  function card(m, topRank, showBadge) {
    var cost = monthlyCost(m);
    // Class rather than an inline style: style-src 'self' forbids style attributes.
    var art = el('article', 'card ' + (m.weights === 'open' ? 'w-open' : 'w-closed'));

    var top = el('div', 'cardtop');
    var name = el('span', 'cname', m.name);
    name.appendChild(el('span', 'corigin', m.vendor + ' · ' + m.country));
    top.appendChild(name);
    if (showBadge && m.rank === topRank) {
      top.appendChild(el('span', 'badge' + (m.weights === 'open' ? ' open' : ''), 'Most capable here'));
    }
    art.appendChild(top);

    var specs = el('div', 'cardspecs');
    specs.appendChild(specSpan('Price', priceLabel(m), fullyPriced(m) ? '' : ' unk'));
    specs.appendChild(specSpan('Handles', m.ctx || 'not confirmed', m.ctx ? '' : ' unk'));
    specs.appendChild(specSpan('Weights', m.license, ' plain'));
    if (m.params) specs.appendChild(specSpan('Size', m.params, ''));
    art.appendChild(specs);

    if (m.costNote) {
      art.appendChild(el('div', 'cost unk', m.costNote));
    } else if (cost === null) {
      art.appendChild(el('div', 'cost unk', 'Cannot estimate: pricing unconfirmed'));
    } else {
      var c = el('div', 'cost');
      c.appendChild(document.createTextNode('About '));
      c.appendChild(el('strong', null, money(cost)));
      c.appendChild(document.createTextNode(' a month at your usage'));
      if (state.cache > 0) {
        c.appendChild(el('span', null, ' (with ' + state.cache + '% cached input)'));
      }
      art.appendChild(c);
    }

    art.appendChild(el('p', 'why', m.best));

    var links = el('p', 'cardlinks');
    var cmp = el('a', null, 'Compare');
    cmp.href = 'compare/?m=' + encodeURIComponent(m.id);
    var full = el('a', null, 'Full specs');
    full.href = '#model-' + m.id;
    links.appendChild(cmp);
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(full);
    art.appendChild(links);

    return art;
  }

  function render() {
    var hits = MODELS.filter(matches);
    var topRank = hits.reduce(function (acc, m) { return Math.max(acc, m.rank); }, 0);

    hits.sort(function (a, b) {
      var ap = typeof a.pout === 'number' ? a.pout : Infinity;
      var bp = typeof b.pout === 'number' ? b.pout : Infinity;
      if (ap !== bp) return ap - bp;
      return b.rank - a.rank;
    });

    if (rcountEl) {
      rcountEl.textContent = '';
      rcountEl.appendChild(el('span', null, String(hits.length)));
      rcountEl.appendChild(document.createTextNode(' of ' + MODELS.length + ' models fit'));
    }

    var hiddenByBudget = state.budget !== 'any'
      ? MODELS.filter(function (m) { return typeof m.pout !== 'number'; }).length : 0;

    if (rnoteEl) {
      if (!hits.length) rnoteEl.textContent = '';
      else if (hiddenByBudget > 0) {
        rnoteEl.textContent = 'Cheapest first. ' + hiddenByBudget + ' models hidden: price unconfirmed.';
      } else rnoteEl.textContent = 'Cheapest suitable option first.';
    }

    resultsEl.textContent = '';

    if (!hits.length) {
      resultsEl.appendChild(el('div', 'empty',
        'Nothing meets all of those rules at once. Try raising the spending limit or dropping one requirement.'));
      return;
    }

    var frag = document.createDocumentFragment();
    hits.forEach(function (m) { frag.appendChild(card(m, topRank, hits.length > 1)); });
    resultsEl.appendChild(frag);
  }

  /* ---------- controls ---------- */
  function syncChips() {
    function set(container, isOn) {
      if (!container) return;
      Array.prototype.forEach.call(container.children, function (b) {
        b.setAttribute('aria-pressed', isOn(b.dataset.key) ? 'true' : 'false');
      });
    }
    set(jobsEl, function (k) { return state.job === k; });
    set(consEl, function (k) { return !!state.cons[k]; });
    set(budgetEl, function (k) { return state.budget === k; });
    set(usageEl, function (k) { return state.usage === k; });

    if (inEl) inEl.value = String(state.vin);
    if (outEl) outEl.value = String(state.vout);
    if (cacheEl) cacheEl.value = String(state.cache);
    if (cacheOut) cacheOut.textContent = state.cache + '%';
  }

  function update() {
    syncChips();
    render();
    writeUrl();
  }

  function wireChips(container, onPick) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn || !container.contains(btn)) return;
      onPick(btn.dataset.key);
      update();
    });
  }

  wireChips(jobsEl, function (k) { state.job = state.job === k ? null : k; });
  wireChips(consEl, function (k) { state.cons[k] = !state.cons[k]; });
  wireChips(budgetEl, function (k) { state.budget = k; });
  wireChips(usageEl, function (k) {
    var u = USAGE_PRESETS[k];
    if (!u) return;
    state.usage = k;
    state.vin = u.in;
    state.vout = u.out;
  });

  if (inEl) {
    inEl.addEventListener('input', function () {
      state.vin = clampNum(inEl.value, 0, 1000000, 0);
      state.usage = matchPreset(state.vin, state.vout);
      update();
    });
  }
  if (outEl) {
    outEl.addEventListener('input', function () {
      state.vout = clampNum(outEl.value, 0, 1000000, 0);
      state.usage = matchPreset(state.vin, state.vout);
      update();
    });
  }
  if (cacheEl) {
    cacheEl.addEventListener('input', function () {
      state.cache = clampNum(cacheEl.value, 0, 95, 0);
      update();
    });
  }

  var resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      state = { job: null, cons: {}, budget: 'any', usage: 'medium', vin: 50, vout: 5, cache: 0 };
      update();
    });
  }

  var copyBtn = document.getElementById('copylink');
  if (copyBtn && navigator.clipboard && window.isSecureContext) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(window.location.href).then(function () {
        var was = copyBtn.textContent;
        copyBtn.textContent = 'Link copied';
        setTimeout(function () { copyBtn.textContent = was; }, 1800);
      }, function () {
        copyBtn.textContent = 'Press Ctrl+C to copy';
      });
    });
  }

  /* A form with no action would reload the page on Enter. */
  picker.addEventListener('submit', function (e) { e.preventDefault(); });

  readUrl();
  syncChips();
  render();
})();
