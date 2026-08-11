#!/usr/bin/env node
/**
 * Post-build guard rails. These check the things that would silently break at
 * runtime rather than at build time: a Content-Security-Policy violation, a
 * resource loaded from another origin, or an internal link that 404s.
 *
 * Run with `npm run check` after a build.
 */

import { createHash } from 'node:crypto';
import { readFile, stat, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { THEME_BOOTSTRAP } from './templates/layout.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const problems = [];
const fail = (msg) => problems.push(msg);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(full));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

const expectedHash = 'sha256-' + createHash('sha256').update(THEME_BOOTSTRAP, 'utf8').digest('base64');

if (!await exists(DIST)) {
  console.error('dist/ does not exist — run the build first.');
  process.exit(1);
}

/** The base path the build used for absolute URLs (404.html). */
let basePath = '/';
try {
  basePath = JSON.parse(await readFile(join(ROOT, '.build-info.json'), 'utf8')).basePath || '/';
} catch {
  /* no build info: assume the site is mounted at the root */
}

const pages = await htmlFiles(DIST);
if (!pages.length) fail('no HTML pages were produced');

for (const page of pages) {
  const rel = relative(DIST, page);
  const html = await readFile(page, 'utf8');
  const where = (msg) => fail(`${rel}: ${msg}`);

  // 1. No inline style attributes — style-src 'self' refuses them.
  const styleAttrs = html.match(/\sstyle\s*=\s*"/g);
  if (styleAttrs) where(`${styleAttrs.length} inline style attribute(s) found; move the value into a CSS rule`);

  // 2. Every inline script must be the theme bootstrap pinned in the CSP.
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, body] of inlineScripts) {
    if (body.trim() !== THEME_BOOTSTRAP.trim()) {
      where('an inline script does not match the hash pinned in the CSP');
    }
  }
  if (inlineScripts.length > 1) where(`${inlineScripts.length} inline scripts; expected exactly 1`);

  // 3. The CSP must be present, and must carry the bootstrap hash.
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  if (!csp) where('no Content-Security-Policy meta tag');
  else {
    const value = csp[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    if (!value.includes(expectedHash)) where('CSP does not contain the current theme-bootstrap hash');
    if (!value.includes("default-src 'none'")) where("CSP is missing default-src 'none'");
    if (value.includes('unsafe-inline') || value.includes('unsafe-eval')) {
      where('CSP contains unsafe-inline or unsafe-eval');
    }
  }

  // 4. The document shell that a bare artifact file would be missing.
  for (const [needle, label] of [
    ['<!doctype html>', 'doctype'],
    ['<html lang=', 'lang attribute'],
    ['<meta charset="utf-8">', 'charset'],
    ['name="viewport"', 'viewport meta'],
    ['<title>', 'title'],
    ['name="description"', 'meta description'],
  ]) {
    if (!html.includes(needle)) where(`missing ${label}`);
  }

  // 5. Nothing may be *loaded* from another origin. rel="canonical" points at
  //    the live origin by design and is a reference, not a subresource.
  for (const [tag] of html.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*>/g)) {
    if (/\brel="(canonical|alternate)"/.test(tag)) continue;
    const url = (tag.match(/\s(?:src|href)="([^"]+)"/) || [])[1];
    if (url && /^(https?:)?\/\//i.test(url)) where(`loads a cross-origin resource: ${url}`);
  }

  // 6. Internal links must resolve to something that exists.
  const pageDir = dirname(page);
  for (const [, url] of html.matchAll(/<a[^>]*\shref="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|#)/i.test(url)) continue;
    const [beforeHash, hash] = url.split('#');
    const path = beforeHash.split('?')[0]; // a query string is not part of the path
    if (!path) {
      // A bare "#id" or "?query#id" link points at the current page.
      if (hash && !html.includes(`id="${hash}"`)) where(`anchor #${hash} has no matching id`);
      continue;
    }

    // Absolute paths are mounted at basePath; relative ones resolve from the page.
    let target;
    if (path.startsWith('/')) {
      const stripped = path.startsWith(basePath) ? path.slice(basePath.length) : path.slice(1);
      target = join(DIST, stripped);
    } else {
      target = resolve(pageDir, path);
    }
    if (path.endsWith('/')) target = join(target, 'index.html');

    if (!await exists(target)) {
      where(`link target does not exist: ${url}`);
      continue;
    }

    // Same-page anchors must point at a real id.
    if (hash && (path === '' || resolve(pageDir, path) === page)) {
      if (!html.includes(`id="${hash}"`)) where(`anchor #${hash} has no matching id`);
    }
  }
}

// 7. The generated stylesheet must carry the data-derived rules.
const cssPath = join(DIST, 'assets', 'site.css');
if (!await exists(cssPath)) fail('assets/site.css was not written');
else {
  const css = await readFile(cssPath, 'utf8');
  if (!/#pm-[a-z0-9-]+\s*\{/.test(css)) fail('assets/site.css has no generated price-chart rules');
  if (!/#bf-[a-z0-9-]+\s*\{/.test(css)) fail('assets/site.css has no generated cost-bar rules');
}

// 8. The public dataset must be valid JSON with the expected shape.
const apiPath = join(DIST, 'api', 'models.json');
if (!await exists(apiPath)) fail('api/models.json was not written');
else {
  try {
    const api = JSON.parse(await readFile(apiPath, 'utf8'));
    if (!Array.isArray(api.models) || !api.models.length) fail('api/models.json has no models');
  } catch (e) {
    fail(`api/models.json is not valid JSON: ${e.message}`);
  }
}

// 9. Cloudflare header file must exist and match the pages' policy.
const headersPath = join(DIST, '_headers');
if (!await exists(headersPath)) fail('_headers was not written');
else {
  const headers = await readFile(headersPath, 'utf8');
  for (const h of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Strict-Transport-Security']) {
    if (!headers.includes(h)) fail(`_headers is missing ${h}`);
  }
  if (!headers.includes(expectedHash)) fail('_headers CSP does not contain the current theme-bootstrap hash');
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}

console.log(`Output checks passed for ${pages.length} pages: no inline styles, no cross-origin loads, no broken internal links, CSP intact.`);
