#!/usr/bin/env node
/**
 * The Model Map — static site build.
 *
 * Reads data/*.json, renders every page to plain HTML, and writes dist/.
 * Uses only the Node standard library: there is no dependency tree to audit,
 * and `npm install` is not needed to build or deploy this site.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { layout, THEME_BOOTSTRAP } from './templates/layout.mjs';
import { homePage } from './templates/home.mjs';
import { comparePage } from './templates/compare.mjs';
import { aboutPage } from './templates/about.mjs';
import { styleguidePage } from './templates/styleguide.mjs';
import { jsonScript, csvCell } from './lib/util.mjs';
import { validate } from './validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIST = join(ROOT, 'dist');

/**
 * Absolute site origin, used for canonical URLs and the sitemap.
 * Set SITE_URL at build time (the deploy workflows do). Without it the build
 * still succeeds and simply omits canonical links rather than guessing wrong.
 */
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

/**
 * Path the site is mounted at, with a trailing slash. Root on Cloudflare Pages
 * and on a custom domain; `/<repo>/` for a GitHub Pages project site.
 * Only the 404 page needs it: it is served in place of arbitrary deep URLs, so
 * relative asset paths would resolve against the wrong directory.
 */
const BASE_PATH = (() => {
  if (!SITE_URL) return '/';
  try {
    const p = new URL(SITE_URL).pathname;
    return p.endsWith('/') ? p : p + '/';
  } catch {
    return '/';
  }
})();

/** Assets copied verbatim into dist/assets/. site.css is handled separately
 *  because the build appends data-derived rules to it. */
const ASSETS = ['tokens.css', 'site.js', 'app.js', 'compare.js'];

/**
 * Content-Security-Policy.
 *
 * `default-src 'none'` means anything not listed below is refused outright.
 * The single inline script is the pre-paint theme bootstrap; it is pinned by
 * SHA-256 hash rather than allowed with 'unsafe-inline', so no other inline
 * script can run even if one were somehow injected into the markup.
 */
function buildCsp(inlineHash) {
  const shared = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "img-src 'self' data:",
    "style-src 'self'",
    `script-src 'self' '${inlineHash}'`,
    "connect-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];
  return {
    // frame-ancestors is ignored inside a <meta> tag and logs a console warning,
    // so it is only sent as a real header.
    meta: shared.join('; '),
    header: ["frame-ancestors 'none'", ...shared].join('; '),
  };
}

function sha256Base64(text) {
  return 'sha256-' + createHash('sha256').update(text, 'utf8').digest('base64');
}

/** Recursively copy a directory if it exists. Returns the files copied. */
async function copyTree(from, to, prefix = '') {
  let entries;
  try {
    entries = await readdir(from, { withFileTypes: true });
  } catch {
    return []; // public/ is optional
  }

  const copied = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      copied.push(...await copyTree(join(from, entry.name), to, rel));
    } else {
      await mkdir(dirname(join(to, rel)), { recursive: true });
      await copyFile(join(from, entry.name), join(to, rel));
      copied.push(rel);
    }
  }
  return copied;
}

async function writeFileIn(relPath, contents) {
  const target = join(DIST, relPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  return target;
}

function modelsCsv(data) {
  const cols = ['id', 'name', 'vendor', 'country', 'pin', 'pout', 'ctx', 'weights', 'license', 'params', 'rank', 'jobs'];
  const lines = [cols.join(',')];
  for (const m of data.models) {
    lines.push(cols.map((c) => csvCell(c === 'jobs' ? (m.jobs || []).join(' ') : m[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Model Map">
  <rect width="32" height="32" rx="7" fill="#2F6BC8"/>
  <path d="M5 21h22" stroke="#7CA8E8" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>
  <circle cx="8" cy="21" r="2.6" fill="#7CA8E8"/>
  <circle cx="16" cy="14.5" r="2.6" fill="#FAF7F1"/>
  <circle cx="24" cy="8" r="2.6" fill="#E8926F"/>
  <path d="M8 21l8-6.5L24 8" stroke="#FAF7F1" stroke-width="1.5" stroke-linejoin="round" fill="none" opacity=".65"/>
</svg>
`;

/**
 * Cloudflare Pages reads this file and turns it into real response headers.
 * GitHub Pages ignores it (it cannot set headers at all) — see SECURITY.md.
 */
function headersFile(csp) {
  return `# Response headers for Cloudflare Pages.
# GitHub Pages does not support custom headers; the equivalent CSP ships as a
# <meta> tag in every page so the policy still applies there.

/*
  Content-Security-Policy: ${csp.header}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

# The dataset is meant to be reused, so it is the one thing served cross-origin.
/api/*
  Access-Control-Allow-Origin: *
  Cross-Origin-Resource-Policy: cross-origin
  Cache-Control: public, max-age=3600

/assets/*
  Cache-Control: public, max-age=3600
`;
}

async function build() {
  const [modelsRaw, contentRaw] = await Promise.all([
    readFile(join(ROOT, 'data', 'models.json'), 'utf8'),
    readFile(join(ROOT, 'data', 'content.json'), 'utf8'),
  ]);

  const data = JSON.parse(modelsRaw);
  const content = JSON.parse(contentRaw);

  const problems = validate(data, content);
  if (problems.length) {
    console.error('Data validation failed:\n' + problems.map((p) => '  - ' + p).join('\n'));
    process.exitCode = 1;
    return;
  }

  const csp = buildCsp(sha256Base64(THEME_BOOTSTRAP));
  const now = new Date();

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const common = {
    csp: csp.meta,
    siteName: content.site.title,
    version: data.version,
    compiled: data.compiled,
  };

  const home = homePage(data, content, now);

  const pages = [
    {
      path: 'index.html',
      route: '/',
      active: 'home',
      title: '',
      description: content.site.description,
      rel: '',
      scripts: ['data.js', 'site.js', 'app.js'],
      body: home.html,
    },
    {
      path: 'compare/index.html',
      route: '/compare/',
      active: 'compare',
      title: 'Compare models',
      description: 'Sort every model by price, context, licence and size, then pin any of them side by side.',
      rel: '../',
      scripts: ['data.js', 'site.js', 'compare.js'],
      body: comparePage(data),
    },
    {
      path: 'about/index.html',
      route: '/about/',
      active: 'about',
      title: 'About the data',
      description: 'How the model data is compiled, what it deliberately does not claim, and how to correct it.',
      rel: '../',
      scripts: ['site.js'],
      body: aboutPage(data, content),
    },
    {
      path: 'styleguide/index.html',
      route: '/styleguide/',
      active: '',
      title: 'Style guide',
      description: 'The design tokens, type scale, and component patterns The Model Map is built from.',
      rel: '../',
      scripts: ['site.js'],
      body: styleguidePage(data, content),
    },
  ];

  for (const page of pages) {
    const html = layout({
      ...common,
      ...page,
      canonical: SITE_URL ? SITE_URL + page.route : '',
    });
    await writeFileIn(page.path, html);
  }

  // Both hosts serve /404.html for unknown paths. It uses absolute URLs because
  // it can be rendered at any depth.
  await writeFileIn('404.html', layout({
    ...common,
    title: 'Page not found',
    description: 'That page does not exist on The Model Map.',
    rel: BASE_PATH,
    active: '',
    canonical: '',
    scripts: ['site.js'],
    body: `  <div class="wrap">
    <header class="page">
      <p class="eyebrow">404</p>
      <h1>That page isn&rsquo;t here</h1>
      <p class="lede">The link may be out of date, or the address may have a typo in it. Everything on this site lives under three pages.</p>
      <p class="exportrow">
        <a class="btn" href="${BASE_PATH}">The map</a>
        <a class="btn" href="${BASE_PATH}compare/">Compare models</a>
        <a class="btn" href="${BASE_PATH}about/">About the data</a>
      </p>
    </header>
  </div>
`,
  }));

  // Client-side data: an external file, so no inline script is needed for it.
  await writeFileIn(
    'assets/data.js',
    '/* Generated by src/build.mjs. Edit data/models.json instead. */\n' +
    'window.MM_DATA = ' + jsonScript({
      version: data.version,
      compiled: data.compiled,
      usage: content.usage,
      models: data.models,
    }) + ';\n'
  );

  await mkdir(join(DIST, 'assets'), { recursive: true });
  for (const asset of ASSETS) {
    await copyFile(join(HERE, 'assets', asset), join(DIST, 'assets', asset));
  }

  // Base stylesheet plus the rules derived from the data (chart positions,
  // bar widths). Appending keeps it to a single stylesheet request.
  const baseCss = await readFile(join(HERE, 'assets', 'site.css'), 'utf8');
  await writeFileIn('assets/site.css', baseCss + '\n\n' + home.css + '\n');

  // Public dataset.
  await writeFileIn('api/models.json', JSON.stringify(data, null, 2) + '\n');
  await writeFileIn('api/models.csv', modelsCsv(data));

  await writeFileIn('favicon.svg', FAVICON);
  await writeFileIn('_headers', headersFile(csp));

  // Anything in public/ is copied verbatim. That is where a CNAME file for a
  // custom domain goes, since dist/ is wiped on every build.
  const publicDir = join(ROOT, 'public');
  const copied = await copyTree(publicDir, DIST);
  if (copied.length) console.log(`Copied ${copied.length} file(s) from public/`);

  // Tells GitHub Pages to serve the directory as-is rather than running Jekyll,
  // which would otherwise skip files and folders beginning with an underscore.
  await writeFileIn('.nojekyll', '');

  await writeFileIn(
    'robots.txt',
    'User-agent: *\nAllow: /\n' + (SITE_URL ? `\nSitemap: ${SITE_URL}/sitemap.xml\n` : '')
  );

  if (SITE_URL) {
    const lastmod = data.compiled;
    const urls = pages.map((p) =>
      `  <url>\n    <loc>${SITE_URL}${p.route}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    ).join('\n');
    await writeFileIn(
      'sitemap.xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls + '\n</urlset>\n'
    );
  }

  // Not part of the site — written next to it so the output checker knows what
  // base path the absolute URLs in 404.html were generated against.
  await writeFile(
    join(ROOT, '.build-info.json'),
    JSON.stringify({ siteUrl: SITE_URL, basePath: BASE_PATH, version: data.version }, null, 2) + '\n',
    'utf8'
  );

  const written = await readdir(DIST, { recursive: true });
  const files = written.filter((f) => f.includes('.')).sort();
  console.log(`Built ${pages.length} pages and ${files.length} files into dist/`);
  console.log(files.map((f) => '  ' + f).join('\n'));
  if (!SITE_URL) {
    console.log('\nNote: SITE_URL not set, so canonical links and sitemap.xml were skipped.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
