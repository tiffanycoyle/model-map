# Security

## What this site is

A static site. There is no server, no database, no authentication, no user
accounts, no form submission, no upload, no API that accepts input, and no
third-party code. Every page is a file on a CDN.

That shape removes most of the categories of vulnerability a web application
normally has. What remains is essentially: could someone get content injected
into a page, and is the site configured to limit the damage if they did.

## What is deliberately absent

- **No dependencies.** Not a small dependency tree — none. The build uses only
  the Node standard library, so there is no `npm install`, no lockfile to audit,
  no transitive package that can be compromised upstream.
- **No third-party resources.** No CDN scripts, no web fonts, no analytics, no
  embedded widgets, no tracking pixels. Every byte the browser loads comes from
  the site's own origin. This is enforced, not just intended: `npm run check`
  fails if any tag references another origin.
- **No cookies, no storage of anything personal.** The only thing written to a
  visitor's device is a light/dark theme preference in `localStorage`.
- **No inline scripts or styles**, except one hash-pinned script (see below).

## Content-Security-Policy

```
default-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none';        (header only — see below)
img-src 'self' data:;
style-src 'self';
script-src 'self' 'sha256-<hash of the theme bootstrap>';
connect-src 'self';
font-src 'self';
manifest-src 'self';
object-src 'none';
upgrade-insecure-requests
```

`default-src 'none'` means anything not explicitly listed is refused.

The single inline script is the pre-paint theme bootstrap, which reads the saved
theme before first paint so the page does not flash the wrong colours. It is
allowed by **SHA-256 hash**, not by `'unsafe-inline'`. The hash is computed from
the script source at build time, so it cannot drift out of sync — and because
`'unsafe-inline'` is absent, no *other* inline script can execute even if one
were somehow injected into the markup.

`style-src 'self'` with no `'unsafe-inline'` means inline `style=` attributes are
refused too. Values that genuinely vary with the data — price-chart positions,
cost-bar widths — are emitted as CSS rules keyed by element id and appended to the
stylesheet during the build.

## What each host can enforce

This is the one thing to be clear-eyed about. A `<meta>` CSP tag is a real policy
and browsers enforce it, but three directives only work as HTTP response headers
and are silently ignored in a meta tag: `frame-ancestors`, `report-uri`, and
`sandbox`. GitHub Pages cannot set response headers at all.

| Protection | Cloudflare Pages | GitHub Pages |
| --- | --- | --- |
| Content-Security-Policy (`default-src 'none'`, hash-pinned scripts) | ✅ header | ✅ meta tag |
| `frame-ancestors 'none'` / `X-Frame-Options` (clickjacking) | ✅ | ❌ not possible |
| `Strict-Transport-Security` (HSTS) | ✅ | ❌ not possible[^1] |
| `X-Content-Type-Options: nosniff` | ✅ | ❌ not possible |
| `Referrer-Policy` | ✅ header | ✅ meta tag |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` / `-Embedder-Policy` | ✅ | ❌ not possible |
| `Permissions-Policy` | ✅ | ❌ not possible |
| HTTPS enforced | ✅ | ✅ (Enforce HTTPS setting) |

[^1]: `github.io` is on the browser HSTS preload list, so a project site at
`<user>.github.io` gets HSTS from the preload list rather than from a header. A
GitHub Pages site on a **custom domain** does not.

**If clickjacking protection matters to you, deploy on Cloudflare Pages.** It is
the only one of the two that can send the headers that provide it. Everything
else meaningful — the CSP itself, HTTPS, the absence of third-party code — is the
same on both.

The header set is generated into `dist/_headers` by the build, so the CSP in the
headers and the CSP in the meta tags can never disagree. `npm run serve` applies
those same headers locally, so a policy violation shows up during development
rather than in production.

## Handling of untrusted input

There is no server-side input. Two client-side inputs exist:

- **The search boxes and number fields.** Values are used only for comparison and
  arithmetic, and are written back to the page with `textContent`, never as
  markup. Number inputs are clamped to a sane range.
- **The query string.** Picker filters and comparison selections are read from
  the URL so links are shareable. Every value is checked against a known set of
  valid keys before it is used — an unrecognised job, constraint, budget, or
  model id is discarded rather than passed through. Model ids are additionally
  constrained by the data validator to `[a-z0-9-]`.

Client-side rendering builds DOM nodes with `createElement` and `textContent`.
No user-influenced value is ever concatenated into an HTML string. Build-time
templates do use string interpolation, but every interpolated value passes
through the `esc()` helper in `src/lib/util.mjs`, and external URLs additionally
pass through `safeUrl()`, which permits only `http:` and `https:`.

## Supply chain

- No runtime dependencies and no build dependencies.
- GitHub Actions workflows request the minimum permissions they need
  (`contents: read` plus the Pages tokens on the deploy job only) and check out
  with `persist-credentials: false`.
- Actions are pinned to major versions. If you want stricter guarantees, pin them
  to full commit SHAs.

## Reporting a problem

Open an issue. If you believe you have found something that should not be
discussed publicly, mark it as such and it can be moved to a private advisory.

Given the architecture, the most valuable reports are likely to be: a way to get
content into a page that the escaping misses, a CSP weakness, or a factual error
in the data that would lead someone to a bad decision. The last one counts — the
point of this site is to be relied on.
