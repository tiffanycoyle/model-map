/**
 * Shared helpers for the build. Everything here is pure and dependency-free.
 */

/**
 * Escape text for use in HTML element content or a double-quoted attribute.
 * Every value interpolated into a template must pass through this.
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialise a value for embedding in a <script> block. Escapes the sequences
 * that could otherwise terminate the script element early.
 */
export function jsonScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Only http(s) links are allowed through to href attributes. */
export function safeUrl(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    /* fall through */
  }
  return '#';
}

export function hasFullPrice(model) {
  return typeof model.pin === 'number' && typeof model.pout === 'number';
}

/**
 * Monthly spend at a given volume, in dollars.
 * `cacheHit` is the fraction of input tokens served from cache (0-0.95); cached
 * input is billed at 10% of the list rate, which is the common industry rate.
 */
export function monthlyCost(model, mIn, mOut, cacheHit = 0) {
  if (!hasFullPrice(model)) return null;
  const hit = Math.min(Math.max(cacheHit, 0), 0.95);
  const inputCost = mIn * model.pin * (1 - hit) + mIn * model.pin * hit * CACHE_READ_RATE;
  return inputCost + mOut * model.pout;
}

export const CACHE_READ_RATE = 0.1;

export function money(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 100) return '$' + Math.round(n).toLocaleString('en-US');
  if (n >= 10) return '$' + n.toFixed(0);
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(2);
}

export function priceLabel(model) {
  if (hasFullPrice(model)) return '$' + model.pin + ' / $' + model.pout;
  if (typeof model.pout === 'number') return 'out $' + model.pout;
  return 'price unconfirmed';
}

/**
 * Position a price on a logarithmic 0-100 scale spanning [min, max].
 * Log scale because the market spans roughly 380x end to end.
 */
export function logPosition(value, min, max) {
  if (!(value > 0) || !(min > 0) || !(max > min)) return 0;
  const pct = ((Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

/** Whole months between an ISO date and now, used for the staleness notice. */
export function monthsSince(iso, now = new Date()) {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now - d) / (1000 * 60 * 60 * 24 * 30.44)));
}

/** Render a CSV cell, quoting and escaping per RFC 4180. */
export function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
