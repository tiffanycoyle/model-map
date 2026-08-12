/* Compare page: column sorting, filtering, and a URL-backed selection. */
(function () {
  'use strict';

  var table = document.getElementById('cmptable');
  if (!table) return;

  var tbody = table.querySelector('tbody');
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cmpcard'));
  var searchInput = document.getElementById('cmpsearch');
  var countEl = document.getElementById('cmpcount');
  var hintEl = document.getElementById('detail-hint');
  var clearBtn = document.getElementById('cmp-clear');
  var copyBtn = document.getElementById('cmp-copy');
  var csvBtn = document.getElementById('cmp-csv');

  var VALID_IDS = {};
  rows.forEach(function (r) { VALID_IDS[r.dataset.id] = true; });

  var selected = readSelection();

  function readSelection() {
    var set = Object.create(null);
    try {
      var raw = new URLSearchParams(window.location.search).get('m');
      if (raw) {
        raw.split(',').forEach(function (id) {
          var trimmed = id.trim();
          if (VALID_IDS[trimmed]) set[trimmed] = true;
        });
      }
    } catch (e) { /* ignore malformed query strings */ }
    return set;
  }

  function selectedIds() {
    return rows
      .map(function (r) { return r.dataset.id; })
      .filter(function (id) { return selected[id]; });
  }

  function writeUrl() {
    var ids = selectedIds();
    var qs = ids.length ? '?m=' + ids.map(encodeURIComponent).join(',') : '';
    try {
      window.history.replaceState(null, '', window.location.pathname + qs);
    } catch (e) { /* ignore */ }
  }

  /* ---------- sorting ---------- */
  var sortKey = null;
  var sortDir = 1;

  function cellValue(row, key, type) {
    var v = row.dataset[key];
    if (type === 'num') {
      if (v === '' || v === undefined) return null;
      var n = parseFloat(v);
      return isFinite(n) ? n : null;
    }
    return v || '';
  }

  function sortBy(key, type) {
    if (sortKey === key) sortDir = -sortDir;
    else { sortKey = key; sortDir = 1; }

    var sorted = rows.slice().sort(function (a, b) {
      var av = cellValue(a, key, type);
      var bv = cellValue(b, key, type);

      if (type === 'num') {
        // Unconfirmed values always sink to the bottom, whichever way we sort.
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av - bv) * sortDir;
      }
      return String(av).localeCompare(String(bv)) * sortDir;
    });

    var frag = document.createDocumentFragment();
    sorted.forEach(function (r) { frag.appendChild(r); });
    tbody.appendChild(frag);

    Array.prototype.forEach.call(table.querySelectorAll('th[data-sort]'), function (th) {
      if (th.dataset.sort === key) {
        th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      } else {
        th.setAttribute('aria-sort', 'none');
      }
    });
  }

  Array.prototype.forEach.call(table.querySelectorAll('th[data-sort]'), function (th) {
    th.tabIndex = 0;
    th.setAttribute('role', 'button');
    var go = function () { sortBy(th.dataset.sort, th.dataset.type); };
    th.addEventListener('click', go);
    th.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });

  /* ---------- filter + selection ---------- */
  function apply() {
    var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    var shown = 0;

    rows.forEach(function (r) {
      var hay = (r.dataset.name || '') + ' ' + (r.dataset.vendor || '') + ' ' +
        (r.dataset.license || '') + ' ' + (r.dataset.country || '');
      var hit = !q || hay.indexOf(q) !== -1;
      r.hidden = !hit;
      if (hit) shown++;
      r.classList.toggle('selected', !!selected[r.dataset.id]);
      var box = r.querySelector('.pickbox');
      if (box) box.checked = !!selected[r.dataset.id];
    });

    var ids = selectedIds();
    var any = ids.length > 0;

    cards.forEach(function (c) { c.hidden = any ? !selected[c.dataset.id] : true; });

    if (hintEl) {
      hintEl.textContent = any
        ? ids.length + ' model' + (ids.length === 1 ? '' : 's') + ' pinned. Untick to remove.'
        : 'Tick models in the table above to pin them here.';
    }
    if (clearBtn) clearBtn.hidden = !any;
    if (copyBtn) copyBtn.hidden = !any || !navigator.clipboard || !window.isSecureContext;

    if (countEl) {
      countEl.textContent = q
        ? shown + ' of ' + rows.length + ' shown'
        : rows.length + ' models';
    }
  }

  tbody.addEventListener('change', function (e) {
    var box = e.target.closest('.pickbox');
    if (!box) return;
    if (box.checked) selected[box.value] = true;
    else delete selected[box.value];
    apply();
    writeUrl();
  });

  if (searchInput) {
    searchInput.addEventListener('input', apply);
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      selected = Object.create(null);
      apply();
      writeUrl();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(window.location.href).then(function () {
        var was = copyBtn.textContent;
        copyBtn.textContent = 'Link copied';
        setTimeout(function () { copyBtn.textContent = was; }, 1800);
      }, function () { /* clipboard denied, leave the label alone */ });
    });
  }

  if (csvBtn && window.MM_DATA) {
    csvBtn.hidden = false;
    csvBtn.addEventListener('click', function () {
      var ids = selectedIds();
      var chosen = window.MM_DATA.models.filter(function (m) {
        return ids.length ? selected[m.id] : true;
      });
      var cols = ['id', 'name', 'vendor', 'country', 'pin', 'pout', 'ctx', 'weights', 'license', 'params'];
      var lines = [cols.join(',')];
      chosen.forEach(function (m) {
        lines.push(cols.map(function (c) {
          var s = m[c] === null || m[c] === undefined ? '' : String(m[c]);
          return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(','));
      });
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'model-map-compare.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  apply();
})();
