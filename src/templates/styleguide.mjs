import { esc } from '../lib/util.mjs';

/**
 * Documents the two-layer token system (tokens.css primitives + semantic
 * layer, consumed by site.css) that the rest of the site is built from.
 * Values shown here are read from the same data and content the live pages
 * use — a closed-weight and an open-weight model, and the real tier
 * descriptions from content.json — so this page cannot drift from the site
 * it is describing.
 */

const SEM = [
  ['--bg', 'tok-bg', 'Page background', '#F5F1EB', '#14120F'],
  ['--surface', 'tok-surface', 'Panel', '#FAF7F1', '#1C1A16'],
  ['--raised', 'tok-raised', 'Elevated', '#FFFFFF', '#242119'],
  ['--ink', 'tok-ink', 'Primary text', '#0E0E0E', '#F2EEE6'],
  ['--ink-soft', 'tok-ink-soft', 'Secondary text', '#43403A', '#C7BFB2'],
  ['--ink-faint', 'tok-ink-faint', 'Tertiary text', '#746D62', '#948C7D'],
  ['--line', 'tok-line', 'Border', '#D4CEC5', '#322E27'],
  ['--chip-line', 'tok-chip-line', 'Chip border', '#CBC3B6', '#3D3830'],
  ['--accent', 'tok-accent', 'Accent', '#2F6BC8', '#7CA8E8'],
  ['--accent-ink', 'tok-accent-ink', 'On accent', '#FFFFFF', '#14120F'],
  ['--callout-bg', 'tok-callout-bg', 'Callout', '#EDF2FC', '#182430'],
  ['--bar', 'tok-bar', 'Data bar', '#1E6B45', '#6FBB93'],
];

const SIG = [
  ['--closed', 'tok-closed', 'Closed weights', '#2F6BC8', '#7CA8E8'],
  ['--open', 'tok-open', 'Open weights', '#BE472D', '#E8926F'],
  ['--tier-frontier', 'tok-tier-frontier', 'Frontier', '#2F6BC8', '#7CA8E8'],
  ['--tier-work', 'tok-tier-work', 'Workhorse', '#234C82', '#6D93C4'],
  ['--tier-small', 'tok-tier-small', 'Small', '#1E6B45', '#6FBB93'],
  ['--tier-open', 'tok-tier-open', 'Open', '#BE472D', '#E8926F'],
  ['--tier-spec', 'tok-tier-spec', 'Specialist', '#746D62', '#B3A99A'],
];

const SPACE = [
  ['--sp-1', 1], ['--sp-2', 2], ['--sp-3', 3], ['--sp-4', 4], ['--sp-5', 5],
  ['--sp-6', 6], ['--sp-7', 7], ['--sp-8', 8], ['--sp-9', 9],
];

function swatchGrid(list) {
  return list.map(([varName, cls, label, light, dark]) => `      <div class="sw">
        <div class="chip-swatch ${esc(cls)}"></div>
        <div class="meta">
          <span class="name">${esc(label)}</span>
          <span class="val">${esc(varName)}</span><br>
          <span class="val">${esc(light)} light &middot; ${esc(dark)} dark</span>
        </div>
      </div>`).join('\n');
}

export function styleguidePage(data, content) {
  const closedExample = data.models.find((m) => m.weights === 'closed' && m.rank === Math.max(...data.models.filter((x) => x.weights === 'closed').map((x) => x.rank)));
  const openExample = data.models.find((m) => m.weights === 'open' && m.rank === Math.max(...data.models.filter((x) => x.weights === 'open').map((x) => x.rank)));

  const modelCard = (m, showBadge) => `      <div class="card w-${m.weights === 'open' ? 'open' : 'closed'}">
        <div class="cardtop">
          <span class="cname">${esc(m.name)}<span class="corigin">${esc(m.vendor)}</span></span>
          ${showBadge ? `<span class="badge${m.weights === 'open' ? ' open' : ''}">Most capable here</span>` : ''}
        </div>
        <p class="why">Left border reads <code>--w</code>, set from the data flag. Same markup for both cards &mdash; only the variable changes.</p>
      </div>`;

  return `  <div class="wrap">
    <header class="page">
      <p class="eyebrow">Design system &middot; compiled with data version ${esc(data.version)}</p>
      <h1>Model Map <em>Style Guide</em></h1>
      <p class="lede">The tokens on this page are the same ones every other page loads from <code>assets/tokens.css</code>. Nothing here is a picture of the design &mdash; it is the design, rendered live, so this page breaks the moment the token layer does.</p>
    </header>

    <section>
      <p class="eyebrow">Layer 1</p>
      <h2>Semantic surfaces and ink</h2>
      <p class="sublede">Components reference only these names. They remap per theme while keeping the same name, so switch the theme in the top bar to see every swatch below update in place.</p>
      <div class="swatches">
${swatchGrid(SEM)}
      </div>
    </section>

    <section>
      <p class="eyebrow">Meaning-bearing color</p>
      <h2>Weights and tiers</h2>
      <p class="sublede">These carry data meaning and must never be swapped for aesthetic reasons. Weights is a binary open/closed flag; tier is the five-way classification used throughout the reference and the price chart.</p>
      <div class="swatches">
${swatchGrid(SIG)}
      </div>

      <div class="ledger">
${content.tiers.map((t) => `        <div class="lrow tier-${esc(t.key)}">
          <div><span class="tname">${esc(t.name)}<span class="trange">${esc(t.range)}</span></span></div>
          <div><p class="models">${esc(t.models)}</p></div>
        </div>`).join('\n')}
      </div>
    </section>

    <section>
      <p class="eyebrow">Type</p>
      <h2>Typography</h2>
      <div class="tokspecimens">
        <div class="tokspecimen"><span class="k">--fs-display / serif</span><span class="tok-display">The Model Map</span></div>
        <div class="tokspecimen"><span class="k">--fs-h2 / serif</span><span class="tok-h2sample">The price range</span></div>
        <div class="tokspecimen"><span class="k">--fs-eyebrow</span><span class="eyebrow">Field reference</span></div>
        <div class="tokspecimen"><span class="k">--fs-lede</span><span class="lede">No single model wins everything.</span></div>
        <div class="tokspecimen"><span class="k">--fs-body</span><span class="tok-bodytext">Body copy sits at 0.94rem with 1.55 line height.</span></div>
        <div class="tokspecimen"><span class="k">--font-mono tabular</span><span class="mono">$0.13 &middot; $2.00 &middot; $15.00 &middot; $75.00</span></div>
      </div>
    </section>

    <section>
      <p class="eyebrow">Rhythm</p>
      <h2>Space scale</h2>
      <div class="tokscale">
${SPACE.map(([varName, n]) => `        <div class="tokscale-row"><span class="mono">${esc(varName)}</span><span class="mono">${esc(n)}</span><div class="tokscale-bar tokscale-bar-${n}"></div></div>`).join('\n')}
      </div>
    </section>

    <section>
      <p class="eyebrow">Components</p>
      <h2>Patterns</h2>

      <h3>Model card, closed weights</h3>
${closedExample ? modelCard(closedExample, true) : ''}

      <h3>Model card, open weights</h3>
${openExample ? modelCard(openExample, true) : ''}

      <h3>Callout</h3>
      <div class="callout">
        <p class="label">${esc(content.retentionCallout.label)}</p>
        <p>${esc(content.retentionCallout.paras[0])}</p>
      </div>

      <h3>Cost bar</h3>
      <div class="bar-track"><div class="bar-fill bar-fill-demo"></div></div>
      <p class="qhelp">Real cost bars are generated by the build from <code>data/models.json</code>; see <a href="../#costs">What it actually costs</a>.</p>
    </section>

    <section>
      <p class="eyebrow">Rules</p>
      <h2>Usage</h2>
      <div class="do-dont">
        <div class="dd yes"><h4>Do</h4>Reference semantic tokens in components. Set <code>--w</code> or <code>--t</code> on a wrapper and let children inherit it. Define a new color as a primitive plus a semantic alias in <code>tokens.css</code>.</div>
        <div class="dd no"><h4>Don't</h4>Hardcode a hex value in a component rule. Reuse tier colors decoratively outside their data meaning. Set colour or layout with an inline <code>style</code> attribute &mdash; the site's Content-Security-Policy forbids it.</div>
      </div>
    </section>
  </div>
`;
}
