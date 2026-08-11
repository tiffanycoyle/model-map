/* Shared behaviour: theme toggle and section scrollspy. Loaded on every page. */
(function () {
  'use strict';

  var STORAGE_KEY = 'mm-theme';
  var ORDER = ['system', 'light', 'dark'];
  var LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

  function readTheme() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* storage unavailable (private mode, blocked cookies) — theme still applies for this page */
    }
  }

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    var labelEl = toggle.querySelector('[data-theme-label]');
    var current = readTheme();

    var paint = function () {
      if (labelEl) labelEl.textContent = LABELS[current];
      toggle.setAttribute(
        'title',
        'Colour theme: ' + LABELS[current] + '. Click for ' + LABELS[ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]] + '.'
      );
    };

    paint();
    toggle.addEventListener('click', function () {
      current = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      applyTheme(current);
      paint();
    });
  }

  /* Highlight the section currently in view in the sticky nav. */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('nav.sticky a[href^="#"]'));
  if (navLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    var targets = [];
    navLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (section) {
        byId[id] = a;
        targets.push(section);
      }
    });

    var visible = Object.create(null);
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible[entry.target.id] = entry.intersectionRatio;
        else delete visible[entry.target.id];
      });

      var best = null;
      targets.forEach(function (t) {
        if (visible[t.id] !== undefined && best === null) best = t.id;
      });

      navLinks.forEach(function (a) { a.classList.remove('current'); });
      if (best && byId[best]) byId[best].classList.add('current');
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    targets.forEach(function (t) { observer.observe(t); });
  }
})();
