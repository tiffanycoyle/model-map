# Contributing

The most useful contribution is a correction. Prices move monthly and this is a
snapshot; if something is wrong, it is probably wrong because it changed.

## Fixing a price or a fact

Everything on the site comes from `data/models.json`. Nothing needs to be edited
in any template.

```bash
# edit data/models.json
npm run check     # validate, build, and check the output
npm run serve     # look at it
```

Then open a pull request with **a link to the vendor's own pricing page or model
card**. Corrections citing a primary source are quick to accept; ones citing a
secondary write-up need checking first and take longer.

## Adding a model

Add an object to `models` in `data/models.json`:

```jsonc
{
  "id": "vendor-model-name",     // lowercase, hyphens; permanent, never reused
  "name": "Model Name",
  "vendor": "Vendor",
  "country": "United States",
  "pin": 1.5,                    // input $ per million tokens, or null
  "pout": 6,                     // output $ per million tokens, or null
  "ctx": "200K",                 // context window as a string, or null
  "weights": "closed",           // "open" or "closed"
  "license": "Proprietary",
  "params": null,                // "70B", "1T / 32B active", or null
  "rank": 75,                    // relative capability, 0-100, for ordering only
  "jobs": ["coding", "production"],
  "oneGpu": false,               // runs on a single ordinary GPU
  "eu": false,                   // European vendor
  "zdr": true,                   // usable without vendor data retention
  "m1": false,                   // handles roughly a million tokens of context
  "plot": false,                 // show on the home page price chart
  "best": "One or two sentences on what this model is actually for."
}
```

Rules the validator enforces, so you will hear about it if you miss one:

- **`id` must be unique and permanent.** Other people key off these; never reuse
  an id for a different model.
- **Use `null`, never a guess.** If you cannot verify a price against a primary
  source, `null` is the correct value. It renders as "not confirmed" and is
  excluded from every calculation. A plausible-looking wrong number is worse than
  an honest gap.
- **Every string in `jobs` needs a label** in `data/content.json` under `jobs`,
  and every declared label needs at least one model using it.
- **`plot: true` requires a confirmed `pout`.** Keep the plotted set to a
  representative spread across the price range — around a dozen — or the chart
  labels collide.

`rank` is an editorial ordering score, not a benchmark result. It decides the
order of the reference list and which model gets the "most capable here" badge.
Keep it roughly consistent with the composite index cited on the About page.

## Editorial changes

Tier descriptions, the "what to use when" table, routing advice and the source
list live in `data/content.json`. Prose belongs there rather than in templates.

## Code changes

`npm run check` must pass. It runs three things:

1. `validate.mjs` — data integrity
2. `build.mjs` — the build itself
3. `check-output.mjs` — post-build guards

That third one is the one to know about. It fails the build if the output
contains an inline style attribute, an inline script that is not the hash-pinned
theme bootstrap, a resource loaded from another origin, a broken internal link, a
missing document-shell tag, or a weakened CSP. Those are all things that would
otherwise break silently in a browser rather than loudly in CI.

Two constraints on any code you add:

- **No dependencies.** The build is Node standard library only, and the site
  loads nothing from another origin. Both are enforced by the checks above, and
  both are the point rather than an accident.
- **Build DOM nodes, do not concatenate HTML.** Client-side code uses
  `createElement` and `textContent`. Build-time templates interpolate strings,
  but every value goes through `esc()` first.

## Testing by hand

`npm run serve` applies the real production headers, including the CSP, so a
policy violation appears in the browser console locally instead of in
production. Worth checking before opening a pull request:

- The page with JavaScript disabled — it should still be a complete reference
- A narrow viewport, around 360px
- Both themes, and the System setting
- Whatever you changed, actually changed
