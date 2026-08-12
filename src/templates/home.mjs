import {
  esc, safeUrl, hasFullPrice, monthlyCost, money, priceLabel, logPosition, monthsSince, tierVar,
} from '../lib/util.mjs';

/**
 * Wraps every model name mentioned in free-text prose with a span colored by
 * that model's own tier, so e.g. the "Bootstrapped pick" column in "What to
 * use when" reads its actual mix of tiers instead of one flat color. Names
 * are matched longest-first so "Sonar Pro" wins over "Sonar" at the same
 * position. A name not found in `models` (an untracked variant mentioned in
 * passing, like "Llama 4 Scout") is left as plain text. There is no tier to
 * color it with.
 */
function colorizeMentions(text, models) {
  const byLength = models.slice().sort((a, b) => b.name.length - a.name.length);
  if (!byLength.length) return esc(text);

  const tierByName = new Map(byLength.map((m) => [m.name, m.tier]));
  const pattern = new RegExp(
    '(' + byLength.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')'
  );

  return text.split(pattern).map((part) => {
    const tier = tierByName.get(part);
    return tier ? `<span class="mention tier-${esc(tier)}">${esc(part)}</span>` : esc(part);
  }).join('');
}

/**
 * Positions and widths are computed from the data, but a strict
 * `style-src 'self'` policy forbids inline style attributes. So every computed
 * value is emitted as a CSS rule keyed by element id, and the build appends
 * those rules to the stylesheet. No inline styles anywhere on the site.
 */
function priceChart(models) {
  const plotted = models
    .filter((m) => m.plot && typeof m.pout === 'number' && m.pout > 0)
    .sort((a, b) => a.pout - b.pout);

  if (plotted.length < 2) return { html: '', css: '', spread: 0, count: 0 };

  const min = plotted[0].pout;
  const max = plotted[plotted.length - 1].pout;
  const spread = Math.round(max / min);
  const css = [];

  const gridlines = [1, 10]
    .filter((v) => v > min && v < max)
    .map((v, i) => {
      const left = logPosition(v, min, max).toFixed(2);
      css.push(`#gl-${i}, #gll-${i} { left: ${left}%; }`);
      return `<div class="gridline" id="gl-${i}"></div>` +
        `<span class="gridlabel" id="gll-${i}">$${esc(v)}</span>`;
    })
    .join('\n          ');

  const marks = plotted.map((m, i) => {
    const left = logPosition(m.pout, min, max).toFixed(2);
    const dir = i % 2 === 0 ? 'up' : 'down';
    css.push(`#pm-${m.id} { left: ${left}%; --t: ${tierVar(m)}; }`);

    const label =
      `<span class="mlabel">${esc(m.name)}<span class="mprice">$${esc(m.pout)}</span></span>`;
    const stem = '<span class="stem"></span>';
    const dot = '<span class="dot"></span>';
    const inner = dir === 'up' ? label + stem + dot : dot + stem + label;
    return `<div class="mark ${dir}" id="pm-${esc(m.id)}">${inner}</div>`;
  }).join('\n          ');

  const html = `      <div class="soundwrap" tabindex="0" role="group" aria-label="Output price of ${plotted.length} representative models on a logarithmic scale, scrollable">
        <div class="sound">
          <div class="sound-track"></div>
          ${gridlines}
          ${marks}
        </div>
      </div>`;

  return { html, css: css.join('\n'), spread, count: plotted.length };
}

function costBars(models, mIn, mOut) {
  const priced = models
    .filter(hasFullPrice)
    .map((m) => ({ m, cost: monthlyCost(m, mIn, mOut) }))
    .sort((a, b) => b.cost - a.cost);
  if (!priced.length) return { html: '', css: '' };

  const top = priced[0].cost;
  const css = [];

  const html = priced.map(({ m, cost }) => {
    const width = Math.max(0.4, (cost / top) * 100).toFixed(2);
    const origin = m.weights === 'open' ? 'open weight' : m.vendor;
    css.push(`#bf-${m.id} { width: ${width}%; --t: ${tierVar(m)}; }`);
    return `      <div class="bar-row">
        <span class="blabel">${esc(m.name)}<span class="bvendor">${esc(origin)} · $${esc(m.pin)} / $${esc(m.pout)}</span></span>
        <div class="bar-track"><div class="bar-fill" id="bf-${esc(m.id)}"></div></div>
        <span class="bprice">~${esc(money(cost))}</span>
      </div>`;
  }).join('\n');

  return { html, css: css.join('\n') };
}

function referenceRow(m) {
  const specs = [
    ['Price in / out', priceLabel(m), hasFullPrice(m) ? '' : ' unk'],
    ['Handles', m.ctx || 'not confirmed', m.ctx ? '' : ' unk'],
    ['License', m.license, ' plain'],
  ];
  if (m.params) specs.push(['Size', m.params, '']);
  if (!m.zdr) specs.push(['Note', 'Retention required', ' plain']);
  if (m.oneGpu) specs.push(['Local', 'One GPU', ' plain']);

  const specHtml = specs.map(([k, v, cls]) =>
    `<span class="spec"><span class="k">${esc(k)}</span><span class="v${cls}">${esc(v)}</span></span>`
  ).join('');

  // data-* attributes drive client-side search and sort without re-fetching.
  // tier-${m.tier} sets --t so hovering the name shows this model's own tier
  // color, not a single flat accent for every row.
  return `  <details class="mrow tier-${esc(m.tier)}" id="model-${esc(m.id)}"
    data-name="${esc(m.name.toLowerCase())}"
    data-vendor="${esc(m.vendor.toLowerCase())}"
    data-jobs="${esc(m.jobs.join(' '))}"
    data-license="${esc(m.license.toLowerCase())}"
    data-pout="${m.pout === null ? '' : esc(m.pout)}"
    data-rank="${esc(m.rank)}">
    <summary>
      <span class="sname">${esc(m.name)}<span class="sorigin">${esc(m.vendor)} · ${esc(m.country)}</span></span>
      <span class="sprice">${esc(priceLabel(m))}</span>
    </summary>
    <div class="mbody">
      <div class="specs">${specHtml}</div>
      <p class="bestat"><strong>Best at</strong> ${esc(m.best)}</p>
      <p class="mlinks"><a href="compare/?m=${esc(m.id)}">Compare this model</a></p>
    </div>
  </details>`;
}

function pickerCard(m, mIn, mOut, topRank, showBadge) {
  const cost = monthlyCost(m, mIn, mOut);
  const specs = [
    ['Price', priceLabel(m), hasFullPrice(m) ? '' : ' unk'],
    ['Handles', m.ctx || 'not confirmed', m.ctx ? '' : ' unk'],
    ['Weights', m.license, ' plain'],
  ];
  if (m.params) specs.push(['Size', m.params, '']);

  let costHtml;
  if (m.costNote) costHtml = `<div class="cost unk">${esc(m.costNote)}</div>`;
  else if (cost === null) costHtml = '<div class="cost unk">Cannot estimate: pricing unconfirmed</div>';
  else costHtml = `<div class="cost">About <strong>${esc(money(cost))}</strong> a month at your usage</div>`;

  const badge = showBadge && m.rank === topRank
    ? `<span class="badge${m.weights === 'open' ? ' open' : ''}">Most capable here</span>` : '';

  return `    <article class="card w-${m.weights === 'open' ? 'open' : 'closed'}">
      <div class="cardtop">
        <span class="cname">${esc(m.name)}<span class="corigin">${esc(m.vendor)} · ${esc(m.country)}</span></span>
        ${badge}
      </div>
      <div class="cardspecs">${specs.map(([k, v, cls]) =>
        `<span class="cs"><span class="csk">${esc(k)}</span><span class="csv${cls}">${esc(v)}</span></span>`).join('')}</div>
      ${costHtml}
      <p class="why">${esc(m.best)}</p>
      <p class="cardlinks"><a href="compare/?m=${esc(m.id)}">Compare</a> · <a href="#model-${esc(m.id)}">Full specs</a></p>
    </article>`;
}

export function homePage(data, content, now) {
  const models = data.models;
  const DEFAULT_IN = 50;
  const DEFAULT_OUT = 5;

  const chart = priceChart(models);
  const bars = costBars(models, DEFAULT_IN, DEFAULT_OUT);
  const staleMonths = monthsSince(data.compiled, now);

  const closed = models.filter((m) => m.weights === 'closed').sort((a, b) => b.rank - a.rank);
  const open = models.filter((m) => m.weights === 'open').sort((a, b) => b.rank - a.rank);

  // Default picker state: no job filter, no constraints, medium usage.
  const defaultHits = models.slice().sort((a, b) => {
    const ap = a.pout === null ? Infinity : a.pout;
    const bp = b.pout === null ? Infinity : b.pout;
    return ap !== bp ? ap - bp : b.rank - a.rank;
  });
  const topRank = defaultHits.reduce((acc, m) => Math.max(acc, m.rank), 0);

  const staleNotice = staleMonths >= 3
    ? `  <div class="wrap"><p class="stale" role="status">Heads up: this data was compiled ${esc(staleMonths)} months ago (${esc(data.compiled)}). Model prices move fast. Verify anything you are about to rely on.</p></div>\n`
    : '';

  const html = `${staleNotice}  <div class="wrap">
  <header class="page">
    <p class="eyebrow">${esc(content.site.tagline)}</p>
    <h1>The Model <em>Map</em></h1>
    <p class="lede">${esc(content.site.lede)}</p>
    <ul class="contents">
${content.nav.map((n) => `      <li><a href="#${esc(n.id)}">${esc(n.long)}</a></li>`).join('\n')}
    </ul>
  </header>
  </div>

  <nav class="sticky" aria-label="Sections">
    <div class="navinner">
      <span class="brand">Model Map</span>
${content.nav.map((n) => `      <a href="#${esc(n.id)}">${esc(n.short)}</a>`).join('\n')}
    </div>
  </nav>

  <div class="wrap">
  <section id="prices">
    <p class="eyebrow">Why cost comes first</p>
    <h2>The price range</h2>
    <p class="sublede">What each model charges to produce a million words&rsquo; worth of output, on a log scale so the whole market fits on one line. The spread is roughly ${esc(chart.spread)}x from cheapest to most expensive, which is why &ldquo;just use the best one&rdquo; is advice for people with a budget line rather than a rule.</p>
  </div>
${chart.html}
  <div class="wrap">
    <p class="sound-caption">Dollars per million output tokens. Colours follow the five tiers below. Scroll sideways on a narrow window, or use the arrow keys once it has focus. This plots ${esc(chart.count)} models spanning the full range rather than all ${esc(models.length)}; the complete list is in the reference below.</p>
  </section>

  <section id="board">
    <p class="eyebrow">${esc(content.board.eyebrow)}</p>
    <h2>${esc(content.board.heading)}</h2>
    <ol class="board">
${content.board.rows.map((r) => `      <li class="board-row"><span class="rank">${esc(r.rank)}</span><span class="name">${esc(r.name)}<span class="vendor">${esc(r.vendor)}</span></span><span class="score">${esc(r.score)}</span></li>`).join('\n')}
    </ol>
    <p class="board-note">${esc(content.board.note)}</p>
  </section>

  <section id="tiers">
    <p class="eyebrow">The shape of the market</p>
    <h2>The five tiers</h2>
    <p class="sublede">Nearly every model on the market falls into one of these five groups. Knowing the group tells you the tradeoff you are making.</p>
    <div class="ledger">
${content.tiers.map((t) => `      <div class="lrow tier-${esc(t.key)}">
        <div><span class="tname">${esc(t.name)}<span class="trange">${esc(t.range)}</span></span></div>
        <div>
          <p class="models">${esc(t.models)}</p>
          <p class="buy">${esc(t.buy)}</p>
        </div>
      </div>`).join('\n')}
    </div>
  </section>

  <section id="reference">
    <p class="eyebrow">Every model, expandable</p>
    <h2>Full reference</h2>
    <p class="sublede">Grouped by whether you can download the weights, because that decides more than price does: it sets whether you can self-host, fine-tune, run disconnected from the internet, or get cut off by a vendor policy change. Select any row for full specs.</p>

    <div class="reftools" data-enhance="reftools">
      <div class="searchfield">
        <label for="refsearch">Search models</label>
        <input id="refsearch" type="search" placeholder="Name, vendor, or licence" autocomplete="off" spellcheck="false">
        <kbd class="hint" aria-hidden="true">/</kbd>
      </div>
      <div class="sortfield">
        <label for="refsort">Order by</label>
        <select id="refsort">
          <option value="rank">Most capable first</option>
          <option value="price-asc">Cheapest first</option>
          <option value="price-desc">Most expensive first</option>
          <option value="name">Name, A to Z</option>
          <option value="vendor">Vendor, A to Z</option>
        </select>
      </div>
      <p class="refcount" id="refcount" role="status" aria-live="polite"></p>
    </div>

    <div class="grouphead">
      <span class="gname gname-closed">Closed weights</span>
      <span class="gnote">Rented through an API. The vendor sets the terms.</span>
    </div>
    <div id="ref-closed" class="refgroup">
${closed.map(referenceRow).join('\n')}
    </div>
    <p class="noresults" id="noresults-closed" hidden>No closed-weight models match that search.</p>

    <div class="grouphead">
      <span class="gname gname-open">Open weights</span>
      <span class="gnote">Downloadable. Self-host, fine-tune, or rent from any provider.</span>
    </div>
    <div id="ref-open" class="refgroup">
${open.map(referenceRow).join('\n')}
    </div>
    <p class="noresults" id="noresults-open" hidden>No open-weight models match that search.</p>

    <p class="exportrow">
      <a class="btn" href="api/models.json" download>Download JSON</a>
      <button class="btn" type="button" id="export-csv" hidden>Download CSV</button>
      <a class="btn" href="compare/">Compare side by side</a>
    </p>
  </section>

  <section id="costs">
    <p class="eyebrow">The same job, every model</p>
    <h2>What it actually costs</h2>
    <p class="sublede">One heavy month on each fully priced model: roughly ${esc(DEFAULT_IN)} million tokens in and ${esc(DEFAULT_OUT)} million out, with no caching discounts. This is the honest version of why almost nobody runs a frontier model for everything.</p>
    <div class="bars">
${bars.html}
    </div>
    <p class="bars-note">Caching and batch discounts cut the large-model numbers substantially, but they never change the ordering. Want these figures at your own volume, with caching factored in? The tool at the bottom does that.</p>
  </section>

  <section id="when">
    <p class="eyebrow">Quick answers</p>
    <h2>What to use when</h2>
    <p class="sublede">If you already know the job, this is the short version. Two columns because the answer genuinely differs depending on whether cost is a constraint.</p>
    <div class="tablewrap" tabindex="0" role="group" aria-label="Recommendations by job, scrollable">
      <table>
        <caption class="visually-hidden">Recommended models for each kind of job, with a cheaper alternative</caption>
        <thead><tr><th scope="col">Job</th><th scope="col">If budget allows</th><th scope="col">Bootstrapped pick</th></tr></thead>
        <tbody>
${content.when.map((r) => `          <tr><th scope="row">${esc(r.job)}</th><td class="pick">${esc(r.pick)}</td><td class="alt">${colorizeMentions(r.alt, models)}</td></tr>`).join('\n')}
        </tbody>
      </table>
    </div>
  </section>

  <section id="routing">
    <p class="eyebrow">The pattern that works</p>
    <h2>How to route</h2>
    <p class="sublede">Almost nobody should run one model for everything. The cost curve rewards mixing tiers, and setting that up is cheap.</p>
    <div class="steps">
${content.routing.map((s) => `      <div class="step">
        <span class="sn">${esc(s.when)}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.body)}</p>
      </div>`).join('\n')}
    </div>
    <div class="callout">
      <p class="label">${esc(content.retentionCallout.label)}</p>
${content.retentionCallout.paras.map((p) => `      <p>${esc(p)}</p>`).join('\n')}
    </div>
  </section>

  <section id="build">
    <p class="eyebrow">Now make it yours</p>
    <h2>Work out your own setup</h2>
    <p class="sublede">Answer as few or as many of these as you like. The list underneath narrows to the models that actually qualify, cheapest first, with a real monthly estimate at your own usage. Your answers go into the address bar, so you can bookmark or share the result.</p>

    <form class="picker" id="picker" data-enhance="picker">
      <div class="fgroup">
        <span class="qlabel" id="q1">1. What do you want it to do?</span>
        <p class="qhelp">Pick the one that fits best. Leave it blank to see everything.</p>
        <div class="chips" id="jobs" role="group" aria-labelledby="q1">
${content.jobs.map(([k, l]) => `          <button class="chip" type="button" data-key="${esc(k)}" aria-pressed="false">${esc(l)}</button>`).join('\n')}
        </div>
      </div>
      <div class="fgroup">
        <span class="qlabel" id="q2">2. Any rules you cannot break?</span>
        <p class="qhelp">Only tick these if they are genuine requirements. Each one removes models from the list.</p>
        <div class="chips" id="cons" role="group" aria-labelledby="q2">
${content.constraints.map(([k, l]) => `          <button class="chip" type="button" data-key="${esc(k)}" aria-pressed="false">${esc(l)}</button>`).join('\n')}
        </div>
      </div>
      <div class="fgroup">
        <span class="qlabel" id="q3">3. How much do you want to spend?</span>
        <p class="qhelp">A ceiling on what a model charges to produce a million words of output.</p>
        <div class="chips" id="budget" role="group" aria-labelledby="q3">
${content.budgets.map(([k, l]) => `          <button class="chip" type="button" data-key="${esc(k)}" aria-pressed="${k === 'any' ? 'true' : 'false'}">${esc(l)}</button>`).join('\n')}
        </div>
      </div>
      <div class="fgroup">
        <span class="qlabel" id="q4">4. How much will you use it?</span>
        <p class="qhelp">Used only to estimate your monthly bill. Models charge separately for text you send in and text they write back, measured in tokens: roughly 750 words per thousand tokens.</p>
        <div class="chips" id="usage" role="group" aria-labelledby="q4">
${content.usage.map(([k, l]) => `          <button class="chip" type="button" data-key="${esc(k)}" aria-pressed="${k === 'medium' ? 'true' : 'false'}">${esc(l)}</button>`).join('\n')}
        </div>
        <div class="custom">
          <span class="vfield">
            <label for="vin">Or, million tokens in</label>
            <input id="vin" name="vin" type="number" min="0" max="1000000" step="1" value="${esc(DEFAULT_IN)}" inputmode="decimal">
          </span>
          <span class="vfield">
            <label for="vout">Million tokens out</label>
            <input id="vout" name="vout" type="number" min="0" max="1000000" step="1" value="${esc(DEFAULT_OUT)}" inputmode="decimal">
          </span>
          <span class="vfield vfield-wide">
            <label for="vcache">Share of input served from cache: <output id="vcache-out">0%</output></label>
            <input id="vcache" name="vcache" type="range" min="0" max="95" step="5" value="0">
          </span>
        </div>
        <p class="qhelp">Cached input is billed at roughly a tenth of the list rate on most vendors. If you send the same long prompt or document repeatedly, this is the single biggest lever on your bill.</p>
      </div>
    </form>

    <div class="resulthead">
      <span class="rcount" id="rcount" role="status" aria-live="polite"><span>${esc(defaultHits.length)}</span> of ${esc(models.length)} models fit</span>
      <span class="rnote" id="rnote">Cheapest suitable option first.</span>
      <span class="resultactions">
        <button class="btn" type="button" id="copylink" hidden>Copy link to these results</button>
        <button class="reset" type="button" id="reset">Start over</button>
      </span>
    </div>
    <div class="results" id="results">
${defaultHits.map((m) => pickerCard(m, DEFAULT_IN, DEFAULT_OUT, topRank, true)).join('\n')}
    </div>
  </section>

  <section id="sources">
    <p class="eyebrow">Show your working</p>
    <h2>Where this came from</h2>
    <p class="sublede">Compiled from published leaderboards and vendor pricing pages. Every figure is traceable to one of these.</p>
    <ul class="sourcelist">
${content.sources.map((s) => `      <li><a href="${esc(safeUrl(s.url))}" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('\n')}
    </ul>
    <p class="board-note">Claude pricing is taken from the Anthropic API reference. See <a href="about/">about the data</a> for how to correct anything on this page.</p>
  </section>
  </div>
`;

  return {
    html,
    css: [
      '/* Generated from data/models.json by src/build.mjs. */',
      chart.css,
      bars.css,
    ].filter(Boolean).join('\n'),
  };
}
