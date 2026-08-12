import { esc, safeUrl, formatDate } from '../lib/util.mjs';

export function aboutPage(data, content) {
  const confirmed = data.models.filter((m) => typeof m.pin === 'number' && typeof m.pout === 'number').length;
  const vendors = new Set(data.models.map((m) => m.vendor)).size;
  const open = data.models.filter((m) => m.weights === 'open').length;

  return `  <div class="wrap">
    <header class="page">
      <p class="eyebrow">Methodology</p>
      <h1>About the data</h1>
      <p class="lede">What is in here, where it came from, what it deliberately does not claim, and how to correct it.</p>
    </header>

    <section>
      <h2>The short version</h2>
      <ul class="factlist">
        <li><strong>${esc(data.models.length)}</strong> models from <strong>${esc(vendors)}</strong> vendors</li>
        <li><strong>${esc(open)}</strong> with downloadable weights</li>
        <li><strong>${esc(confirmed)}</strong> with both input and output prices confirmed</li>
        <li>Compiled <strong>${esc(formatDate(data.compiled))}</strong>, data version <strong>${esc(data.version)}</strong></li>
      </ul>
    </section>

    <section>
      <h2>How prices are handled</h2>
      <p>Prices are US dollars per million tokens, quoted as input / output, at standard on-demand rates. Batch pricing, volume commitments, and provider-specific discounts are not included, because they vary too much to state honestly in a single number.</p>
      <p>Where a price could not be verified against a primary source, the field is <em>null</em> rather than estimated. Those models are shown with &ldquo;not confirmed&rdquo; and are excluded from every cost calculation on the site. This is why some well-known models have no monthly estimate: an unverified number that looks precise is worse than no number.</p>
      <p>The cost estimator applies a cache discount of one tenth of the list input rate to the share of input you say is cached. That matches the common vendor rate, but it is a simplification. Check your vendor&rsquo;s exact cache-read and cache-write pricing before budgeting on it.</p>
    </section>

    <section>
      <h2>What the rankings mean</h2>
      <p>The board at the top of the map quotes the Artificial Analysis composite index, which is a measure of capability, not of value. The internal <code>rank</code> field used to order the reference list and to award the &ldquo;most capable here&rdquo; badge is a relative editorial score, not a vendor-published figure. Do not read it as a benchmark result.</p>
      <p>Benchmark numbers quoted in individual model notes (SWE-bench Pro, GPQA, MATH-500) come from the sources listed below and were current when compiled. Benchmarks are gamed, saturate quickly, and rarely predict how a model behaves on your specific task. Prototype before you commit.</p>
    </section>

    <section>
      <h2>What this does not cover</h2>
      <p>Image, video, audio, and embedding models are out of scope: they are ranked per task rather than on a single intelligence axis, and mixing them in would make every comparison here meaningless. Latency and throughput are also excluded: they depend far more on your provider, region, and load than on the model.</p>
      <p>Availability constraints are recorded as flags where they are confirmed, but they are not legal advice. Data retention terms in particular change often and differ by contract tier. Confirm directly with any vendor before you rely on a flag here contractually.</p>
    </section>

    <section>
      <h2>Use the data yourself</h2>
      <p>The full dataset is published as JSON under a permissive licence. It is a static file with permissive CORS, so you can fetch it directly from a browser app.</p>
      <p class="exportrow">
        <a class="btn" href="../api/models.json">api/models.json</a>
        <a class="btn" href="../api/models.csv">api/models.csv</a>
      </p>
      <pre class="code"><code>fetch('https://example.com/api/models.json')
  .then(r =&gt; r.json())
  .then(d =&gt; console.log(d.models.length))</code></pre>
      <p>Every object carries a stable <code>id</code>. Ids will not be reused for a different model, so you can key off them safely.</p>
    </section>

    <section>
      <h2>Corrections</h2>
      <p>If a price is wrong or a model is missing, the fix is a one-line edit to <code>data/models.json</code> in the repository. The site rebuilds itself from that file, so no HTML needs touching. Open an issue or a pull request with a link to the vendor page showing the correct figure.</p>
      <p>Corrections that cite a primary source (a vendor pricing page or model card) are far quicker to accept than ones citing a secondary write-up.</p>
    </section>

    <section>
      <h2>Privacy</h2>
      <p>This site has no analytics, no cookies, no trackers, no fonts or scripts from other domains, and no server that could log you. Nothing you type into the estimator or the search box leaves your browser. The only thing stored on your device is your light or dark theme preference, in <code>localStorage</code>.</p>
      <p>Your picker and comparison selections are written into the address bar so links are shareable. That means anything you share also shares those settings, which are only ever the filters you chose, never your usage figures beyond the token counts you typed.</p>
    </section>

    <section>
      <h2>Sources</h2>
      <ul class="sourcelist">
${content.sources.map((s) => `        <li><a href="${esc(safeUrl(s.url))}" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('\n')}
      </ul>
      <p class="board-note">Claude pricing is taken from the Anthropic API reference.</p>
    </section>
  </div>
`;
}
