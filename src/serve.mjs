#!/usr/bin/env node
/**
 * Local preview server for dist/.
 *
 * Mirrors what the hosts do: directory URLs resolve to index.html, unknown
 * paths get 404.html, and the security headers from _headers are applied so
 * you see Content-Security-Policy problems locally rather than in production.
 *
 * Binds to localhost only — this is a preview tool, not a production server.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Parse the generated _headers file into [pattern, headers] pairs. */
async function loadHeaders() {
  let text;
  try {
    text = await readFile(join(DIST, '_headers'), 'utf8');
  } catch {
    return [];
  }

  const rules = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx > 0) current.headers.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
    }
  }
  return rules;
}

function matches(pattern, path) {
  if (pattern.endsWith('/*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

const rules = await loadHeaders();

async function resolveFile(urlPath) {
  // normalize() collapses "..", and the prefix check refuses anything that
  // would escape dist/ even so.
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let target = resolve(DIST, '.' + (clean.startsWith('/') ? clean : '/' + clean));
  if (target !== DIST && !target.startsWith(DIST + sep)) return null;

  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');
  } catch {
    if (!extname(target)) target = join(target, 'index.html');
  }

  try {
    return { body: await readFile(target), path: target };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];
  const found = await resolveFile(path);

  const send = (status, body, type) => {
    const headers = { 'content-type': type };
    for (const rule of rules) {
      if (matches(rule.pattern, path)) {
        for (const [k, v] of rule.headers) {
          // HSTS on plain http would be ignored anyway and confuses the browser.
          if (k.toLowerCase() !== 'strict-transport-security') headers[k] = v;
        }
      }
    }
    res.writeHead(status, headers);
    res.end(body);
  };

  if (!found) {
    const fallback = await resolveFile('/404.html');
    send(404, fallback ? fallback.body : 'Not found', 'text/html; charset=utf-8');
    return;
  }

  send(200, found.body, TYPES[extname(found.path)] || 'application/octet-stream');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Serving dist/ at http://localhost:${PORT}`);
  console.log('Security headers from dist/_headers are applied (HSTS omitted over http).');
  console.log('Press Ctrl+C to stop.');
});
