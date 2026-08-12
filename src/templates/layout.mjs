import { esc } from '../lib/util.mjs';

/**
 * The inline bootstrap that applies the saved theme before first paint, so the
 * page never flashes the wrong colours. This is the only inline script on the
 * site; the build hashes it and pins that hash in the CSP.
 */
export const THEME_BOOTSTRAP =
  "(function(){try{var t=localStorage.getItem('mm-theme');" +
  "if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();";

/**
 * @param {object} opts
 * @param {string} opts.title      Page title, without the site suffix.
 * @param {string} opts.description Meta description.
 * @param {string} opts.body       Pre-rendered page HTML.
 * @param {string} opts.rel        Relative prefix back to site root ('' or '../').
 * @param {string[]} opts.scripts  Script filenames to load from assets/.
 * @param {string} opts.csp        Content-Security-Policy value.
 * @param {string} opts.active     Nav key for the current page.
 * @param {string} opts.canonical  Absolute canonical URL, or ''.
 */
export function layout(opts) {
  const {
    title, description, body, rel, scripts = [], csp, active = '', canonical = '',
    siteName, version, compiled,
  } = opts;

  const fullTitle = title ? `${title} · ${siteName}` : siteName;

  const navLinks = [
    { href: rel || './', key: 'home', label: 'The map' },
    { href: `${rel}compare/`, key: 'compare', label: 'Compare' },
    { href: `${rel}about/`, key: 'about', label: 'About the data' },
  ];

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F5F1EB" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14120F" media="(prefers-color-scheme: dark)">
<meta name="generator" content="model-map static build">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="mm:version" content="${esc(version)}">
<meta name="mm:compiled" content="${esc(compiled)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n` : ''}<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/json" href="${rel}api/models.json" title="Model data as JSON">
<link rel="stylesheet" href="${rel}assets/tokens.css">
<link rel="stylesheet" href="${rel}assets/site.css">
<script>${THEME_BOOTSTRAP}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="topbar">
  <div class="topbar-inner">
    <a class="wordmark" href="${rel || './'}">Model Map</a>
    <nav class="sitenav" aria-label="Site">
      ${navLinks.map((l) => `<a href="${esc(l.href)}"${l.key === active ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`).join('\n      ')}
    </nav>
    <button class="themetoggle" id="theme-toggle" type="button" aria-live="polite">
      <span class="visually-hidden">Colour theme:</span>
      <span data-theme-label>System</span>
    </button>
  </div>
</div>
<main id="main">
${body}
</main>
<footer class="sitefoot">
  <div class="wrap">
    <p><strong>${esc(siteName)}</strong> · data version ${esc(version)}, compiled ${esc(compiled)}. Prices are per million tokens, input / output. Fields marked &ldquo;not confirmed&rdquo; could not be verified against a primary source and are left out of all cost maths.</p>
    <p>Rankings and prices move monthly. Treat every figure here as a snapshot to check, not a quote. <a href="${rel}about/">How this data is put together</a> · <a href="${rel}api/models.json">Raw JSON</a> · <a href="${rel}styleguide/">Design system</a></p>
  </div>
</footer>
${scripts.map((s) => `<script src="${rel}assets/${esc(s)}" defer></script>`).join('\n')}
</body>
</html>
`;
}
