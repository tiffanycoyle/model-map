# The Model Map: context recap and handoff

**Purpose of this file:** a new chat session (or a future Claude with no
memory of this one) can pick up this project cold from here. Keep it
updated as work happens. When you finish a chunk of work, add a short entry
to the History log below and update "Current state" if it changed. This
file is not part of the built site. It lives at repo root, outside `src/`,
`data/`, and `public/`, so `npm run build` never touches or ships it.

## What this is

**The Model Map**: a static reference site comparing ~25 LLMs by price,
tier, and licensing, with a model picker and estimator tool. Built and
maintained for **Tiffany Coyle / Coyle Co**.

- **Live site:** https://tiffanycoyle.github.io/model-map/
- **Repo:** `tiffanycoyle/model-map` on GitHub, default branch `main`
- **Deploy:** GitHub Actions (`.github/workflows/deploy.yml`) builds and
  publishes on every push to `main`. No manual deploy step.
- **Stack:** zero dependencies. Node stdlib only (`src/build.mjs` renders
  `data/*.json` + `src/templates/*.mjs` into static HTML in `dist/`). No
  framework, no npm install needed to build.

## Local commands

```
npm run validate   # data/models.json integrity checks (src/validate.mjs)
npm run build      # renders dist/ (src/build.mjs)
npm run check      # validate + build + output checks (no inline styles/scripts,
                    # no broken links, CSP intact). Run this before every push.
npm run serve      # preview dist/ locally with production headers applied
npm run dev        # build + serve
```

Run `npm run check` before every push, no exceptions. It's what CI runs too
(`.github/workflows/ci.yml` on PRs).

## Brand source of truth

The palette is pulled from Tiffany's real Coyle Co brand file
(`audit-framework.html`, a client deliverable, not in this repo, uploaded to
chat directly). Extracted values:

| Role | Hex | Note |
|---|---|---|
| Primary accent | `#2F6BC8` | blue, used as-is |
| Ink (light mode) | `#0E0E0E` | near-black |
| Paper (light mode bg) | `#F5F1EB` | warm cream white |
| Secondary, rust | `#BE472D` | brand's `#C84B2F`, darkened for AA contrast |
| Secondary, green | `#1E6B45` | used as-is |
| Muted | `#746D62` | brand's `#7A7267`, darkened for AA contrast |

**Fonts were not changed.** Tiffany said keep them. Model Map still uses
Palatino/Iowan Old Style (serif headings), system-ui (body), and
ui-monospace (numbers/prices), not the brand file's DM Serif/DM Sans/DM Mono
(Google Fonts anyway, which would violate the site's CSP, `font-src
'self'`).

Full token definitions live in `src/assets/tokens.css` (Layer 1: primitives
plus semantic light/dark mapping). `src/assets/site.css` (Layer 2) consumes
only `var()` references. Never hardcode a color there. The live, browsable
token reference is `/styleguide/` on the site itself
(`src/templates/styleguide.mjs`). It renders real swatches from the actual
CSS, so it can't drift from what's shipped.

**Attribution:** footer and `<meta name="author">` on every page credit
"Tiffany Coyle" (https://tiffanycoyle.com) and "Coyle Co"
(https://coyleco.no).

## The five-tier system

Every model has an explicit `"tier"` field in `data/models.json`: one of
`frontier`, `work`, `small`, `open`, `spec`. This is editorial, not derived
from price. An earlier price-threshold heuristic was flat-out wrong: it
labeled Sonnet 5, a $15/M-out workhorse model, as "small," and forced every
open-weight model to the same color regardless of whether it was a flagship
release or a cheap small one. Don't reintroduce a price-based tier guess.
Add or edit the `tier` field by hand when a model is added or its role
changes, matching the definitions in `data/content.json`'s `tiers` array.

`tier` is independent of `weights` (open/closed). A small cheap open model
is tier `small`, not `open`. `open` as a tier specifically means "a large,
notable open-weight release" (GLM-5.2, DeepSeek V4 Pro, Qwen 3 235B, MiniMax
M3, Kimi K2.6, Mistral Large 3, Llama 4 Maverick), not "any open-weight
model."

`tierVar(model)` in `src/lib/util.mjs` is the single place that maps a
model's tier to its CSS color variable. It's used by the price chart dots,
the cost bars (the `--bar` fallback only applies when no tier is set),
hovering a model name in the Full Reference list (sets `--t` via a
`tier-${tier}` class on each row), and the colorized model mentions in the
"Bootstrapped pick" column of the "What to use when" table
(`colorizeMentions()` in `home.mjs` matches model names longest-first
against free-text prose, so "Sonar Pro" doesn't get swallowed by "Sonar").
A mentioned model not in the dataset, like "Llama 4 Scout," is left as
plain text. There's no tier to color it with.

**Section identity colors** (a separate, smaller idea): Board, Costs, When,
and Routing each set `--section-accent` to give their eyebrow, and a couple
of specific elements (board's score, routing's step labels and callout), an
ambient hue, purely for scroll wayfinding. Prices, Tiers, Reference, and
Build are deliberately left on the default accent because they already show
real tier or weights color internally. A different ambient hue there would
make color mean two things in the same place. Don't reuse `--open` or
`--tier-open` decoratively outside actual weights or tier meaning. That
one's a hard rule documented on the style guide page itself.

## Security posture: don't relax these

- CSP is `default-src 'none'`, no `unsafe-inline`. The only inline script is
  the theme bootstrap, pinned by SHA-256 hash. No inline `style=` attributes
  anywhere. Any computed value (chart position, bar width, tier color)
  becomes a generated CSS rule keyed by element id, appended to
  `assets/site.css` at build time. `check-output.mjs` fails the build on any
  inline style or unpinned script.
- `src/check-output.mjs` also checks: no cross-origin resource loads, all
  internal links resolve, CSP present on every page. Run via `npm run check`.

## History (most recent last)

1. **Got GitHub Pages live.** Found an unmerged PR with the full site
   sitting on an empty `main`. Merged it, then hit a GitHub Pages
   environment branch-policy bug: the `github-pages` environment's
   deployment-branch allowlist doesn't auto-update when you change the
   repo's default branch. That's a separate setting under Settings →
   Environments. The user deleted and recreated the repo fresh rather than
   keep fighting the stale environment rule, which is why git history
   starts clean at the first real commit rather than having older history.
2. **Rebrand to the token-based design draft.** User uploaded a draft
   `tokens.css`/`app.css`/`styleguide.html` (a teal-led five-hue palette:
   teal, rust, slate, moss, plum). Split the CSS into a proper two-layer
   token system, added `/styleguide/` as a real page, and fixed a real
   dark-mode bug in the draft: a `:where()` wrapper zeroed out CSS
   specificity, so system dark mode never actually applied. Fixed with a
   plain `:not([data-theme])` selector instead.
3. **"Add more color throughout."** Gave Board, Costs, When, and Routing
   their own ambient `--section-accent`. Repointed cost bars from teal to
   plum.
4. **User said the branding didn't look like theirs.** The teal-led draft
   from step 2 wasn't their actual brand. It was pulled from an earlier
   session's draft files, not confirmed brand assets. User provided their
   real Coyle Co brand file (`audit-framework.html`). Rebased the entire
   palette on it: blue accent, near-black and warm-white neutrals, rust and
   green as secondaries, fonts untouched. Section-accent mapping updated to
   match (Costs → green, When → blue).
5. **Added creator credit.** Footer line and `<meta name="author">`, linked
   to tiffanycoyle.com and coyleco.no.
6. **Per-model tier coloring.** Added the explicit `tier` field to
   `data/models.json` (see "five-tier system" above; this also fixed a real
   mislabeling bug in the old price-threshold heuristic). Wired it into
   hovering a model name in Full Reference (now shows that model's own tier
   color), the "Bootstrapped pick" column (colorizes each mentioned model
   by its real tier), and the cost bars (each bar is now its model's tier
   color, not a flat green).
7. **Started this handoff doc.**
8. **Rewrote repo copy in Tiffany's voice.** No em dashes anywhere in the
   repo: docs, data notes, code comments, even the two hardcoded "not
   confirmed" fallback strings in `money()` (`src/lib/util.mjs` and
   `src/assets/app.js`) that used to return an em dash glyph for a null
   cost. Both call sites already guard against null before calling
   `money()`, so this was dead code in practice, but fixed anyway for
   consistency. No AI-register vocabulary found (the actual site content
   was already direct and specific, nothing to fix there). See
   `RHETORICALSTYLE.md` / `OPINIONS.md` / `DA_IDENTITY.md` (uploaded to
   chat, not in this repo) for the full style rules if this needs doing
   again on new content.

## Open items / ideas not yet acted on

- None outstanding as of the last entry above. If the user raises something
  and it isn't done in the same turn, log it here so it isn't lost.
