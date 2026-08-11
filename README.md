# The Model Map

A priced, labelled field reference to the AI model market. Twenty-five models
from thirteen vendors, with a cost estimator that answers the question people
actually have: *what would this cost me, at my volume, given my constraints?*

Built as a static site with **no dependencies at all** — not a small dependency
tree, none. The build uses only the Node standard library, and the site loads
nothing from any other origin.

---

## Quick start

```bash
npm run build     # render the site into dist/
npm run serve     # preview at http://localhost:4173 with production headers
npm run dev       # build, then serve
npm run check     # validate data, build, and check the output
```

There is no `npm install` step. There is nothing to install.

## Updating the data

Everything on the site is generated from two files:

| File | Contains |
| --- | --- |
| `data/models.json` | The models: prices, context, licence, flags, capsule descriptions |
| `data/content.json` | Editorial copy: tiers, the "what to use when" table, routing advice, sources |

Edit those, run `npm run check`, and every page, chart, table and estimate
updates itself. The price chart positions, cost-bar widths, and the counts in
the prose ("the spread is roughly 385x") are all computed at build time — there
are no hard-coded numbers in the templates.

Use `null` for anything you could not verify against a primary source. Nulls
render as "not confirmed" and are excluded from cost maths. An unverified number
that looks precise is worse than no number.

`npm run validate` catches duplicate ids, malformed prices, a job label no model
uses, and a model marked for the price chart without a confirmed price.

---

## Deploying

The same build output works on both hosts. Pick either, or run both.

### GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and
   deploys automatically.

The site lands at `https://<user>.github.io/<repo>/`. The workflow passes that
URL to the build as `SITE_URL`, so canonical links and `sitemap.xml` are correct
at the subpath. Every other link on the site is relative, so the same build works
at a subpath or at a domain root without reconfiguration.

**One real limitation:** GitHub Pages cannot set HTTP response headers. The
Content-Security-Policy still applies — it ships as a `<meta>` tag in every page —
but `frame-ancestors`, `Strict-Transport-Security`, and `X-Frame-Options` cannot be
enforced there, because those only work as real headers. See
[SECURITY.md](SECURITY.md) for exactly what you do and do not get on each host.

### Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git**, and pick this repository.
2. Build settings:
   - **Build command**: `node src/build.mjs`
   - **Build output directory**: `dist`
   - **Root directory**: leave blank
3. Environment variables:
   - `NODE_VERSION` = `22`
   - `SITE_URL` = your final URL, e.g. `https://modelmap.example.com` (no trailing slash)
4. Deploy.

Cloudflare reads the generated `dist/_headers` file and applies the full header
set, including HSTS and `frame-ancestors`. This is the stronger option of the two
on security, and the faster one on delivery.

### Custom domain

Put a `CNAME` file containing your domain in `public/` — everything in that
directory is copied verbatim into the build:

```bash
echo 'modelmap.example.com' > public/CNAME
```

Then point the domain at your host and set `SITE_URL` to match. On Cloudflare,
add the domain under **Custom domains** instead; the `CNAME` file is only needed
for GitHub Pages.

---

## URLs

No `.html` anywhere. Pages are built as directories, which both hosts serve as
clean paths:

```
/            the map
/compare/    side-by-side comparison table
/about/      methodology, sources, and how to correct the data
/api/models.json    the full dataset
/api/models.csv     the same data as CSV
```

`/api/models.json` is served with permissive CORS so anyone can build on it.

---

## How it is put together

```
data/           models.json, content.json     the only files you edit routinely
src/
  build.mjs         renders every page into dist/
  validate.mjs      data integrity checks; runs in CI and before each build
  check-output.mjs  post-build guards: no inline styles, no cross-origin loads,
                    no broken internal links, CSP intact
  serve.mjs         local preview with the production headers applied
  lib/util.mjs      escaping, cost maths, formatting
  templates/        layout, home, compare, about
  assets/           site.css, site.js, app.js, compare.js
public/         copied verbatim into the build (CNAME, etc.)
dist/           build output — generated, never committed
```

Pages are **pre-rendered**: all 25 models, the full comparison table, the cost
bars and the default picker results are real HTML in the served file. JavaScript
adds search, sorting, live cost estimates and shareable URLs on top. With
JavaScript disabled the site still works as a complete reference — which also
means search engines and link previews see the actual content.

### Design decisions worth knowing

- **No inline styles or scripts.** Computed values — chart positions, bar widths —
  are emitted as CSS rules keyed by element id and appended to the stylesheet at
  build time. The one inline script is the theme bootstrap that prevents a
  flash of the wrong colours; it is pinned in the CSP by SHA-256 hash. `npm run
  check` fails the build if anything else inline appears.
- **DOM construction, never HTML strings.** Client-side rendering builds nodes
  with `document.createElement` and `textContent`. There is no path by which
  data could be interpreted as markup.
- **State lives in the URL.** Picker filters and comparison selections are
  written to the query string, so results are bookmarkable and shareable. Values
  read back out of the URL are validated against known keys before use.
- **Nothing is stored about anyone.** No analytics, no cookies, no fonts or
  scripts from other domains, no server. The only thing written to a visitor's
  device is their theme preference.

---

## Licence

Code is MIT. The compiled dataset in `data/models.json` is published under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — use it, just credit
it. Figures are gathered from the public sources listed on the About page and on
the site footer; each vendor's pricing remains theirs to change without notice.
