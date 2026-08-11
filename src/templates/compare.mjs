import { esc, hasFullPrice, priceLabel } from '../lib/util.mjs';

const COLUMNS = [
  { key: 'name', label: 'Model', type: 'text' },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'country', label: 'Origin', type: 'text' },
  { key: 'pin', label: 'In $/M', type: 'num' },
  { key: 'pout', label: 'Out $/M', type: 'num' },
  { key: 'ctx', label: 'Context', type: 'text' },
  { key: 'license', label: 'Licence', type: 'text' },
  { key: 'params', label: 'Size', type: 'text' },
  { key: 'weights', label: 'Weights', type: 'text' },
];

function cell(m, col) {
  const v = m[col.key];
  if (col.key === 'pin' || col.key === 'pout') {
    return v === null || v === undefined
      ? '<span class="unk">n/c</span>'
      : `<span class="num">${esc(v)}</span>`;
  }
  if (v === null || v === undefined || v === '') return '<span class="unk">n/c</span>';
  return esc(v);
}

function flagList(m) {
  const flags = [];
  if (m.weights === 'open') flags.push('Open weights');
  if (m.oneGpu) flags.push('Single GPU');
  if (m.m1) flags.push('~1M context');
  if (m.eu) flags.push('EU vendor');
  if (!m.zdr) flags.push('Retention required');
  return flags;
}

export function comparePage(data) {
  const models = data.models.slice().sort((a, b) => b.rank - a.rank);

  const rows = models.map((m) => {
    const attrs = COLUMNS.map((c) => {
      const v = m[c.key];
      const sortVal = c.type === 'num'
        ? (v === null || v === undefined ? '' : v)
        : String(v ?? '').toLowerCase();
      return `data-${esc(c.key)}="${esc(sortVal)}"`;
    }).join(' ');

    return `        <tr data-id="${esc(m.id)}" data-rank="${esc(m.rank)}" ${attrs}>
          <td class="selcell">
            <input type="checkbox" class="pickbox" id="pick-${esc(m.id)}" value="${esc(m.id)}">
            <label for="pick-${esc(m.id)}"><span class="visually-hidden">Compare ${esc(m.name)}</span></label>
          </td>
${COLUMNS.map((c) => {
  const tag = c.key === 'name' ? 'th' : 'td';
  const extra = c.key === 'name' ? ' scope="row" class="rowname"' : ` class="col-${esc(c.key)}"`;
  return `          <${tag}${extra}>${cell(m, c)}</${tag}>`;
}).join('\n')}
        </tr>`;
  }).join('\n');

  const detailCards = models.map((m) => `      <article class="cmpcard" data-id="${esc(m.id)}" hidden>
        <h3>${esc(m.name)}</h3>
        <p class="cmporigin">${esc(m.vendor)} · ${esc(m.country)}</p>
        <dl class="cmpspecs">
          <div><dt>Price in / out</dt><dd${hasFullPrice(m) ? '' : ' class="unk"'}>${esc(priceLabel(m))}</dd></div>
          <div><dt>Context</dt><dd${m.ctx ? '' : ' class="unk"'}>${esc(m.ctx || 'not confirmed')}</dd></div>
          <div><dt>Licence</dt><dd>${esc(m.license)}</dd></div>
          <div><dt>Size</dt><dd${m.params ? '' : ' class="unk"'}>${esc(m.params || 'not confirmed')}</dd></div>
        </dl>
        ${flagList(m).length ? `<p class="cmpflags">${flagList(m).map((f) => `<span class="flag">${esc(f)}</span>`).join('')}</p>` : ''}
        <p class="cmpbest">${esc(m.best)}</p>
      </article>`).join('\n');

  return `  <div class="wrap">
    <header class="page">
      <p class="eyebrow">Side by side</p>
      <h1>Compare models</h1>
      <p class="lede">Every model in one table. Sort by any column, tick the ones you care about, and the detail cards underneath narrow to just those. Your selection goes into the address bar, so you can share the exact comparison.</p>
    </header>

    <div class="cmptools" data-enhance="cmptools">
      <div class="searchfield">
        <label for="cmpsearch">Filter</label>
        <input id="cmpsearch" type="search" placeholder="Name, vendor, or licence" autocomplete="off" spellcheck="false">
        <kbd class="hint" aria-hidden="true">/</kbd>
      </div>
      <span class="cmpactions">
        <button class="btn" type="button" id="cmp-clear" hidden>Clear selection</button>
        <button class="btn" type="button" id="cmp-copy" hidden>Copy link</button>
        <button class="btn" type="button" id="cmp-csv" hidden>Download CSV</button>
      </span>
      <p class="refcount" id="cmpcount" role="status" aria-live="polite"></p>
    </div>
  </div>

  <div class="wrap wide">
    <div class="tablewrap sticky-head" tabindex="0" role="group" aria-label="Full model comparison table, scrollable">
      <table class="cmptable" id="cmptable">
        <caption class="visually-hidden">All models with price, context, licence and size. Column headers sort the table.</caption>
        <thead>
          <tr>
            <th scope="col"><span class="visually-hidden">Select for comparison</span></th>
${COLUMNS.map((c) => `            <th scope="col" class="col-${esc(c.key)}" data-sort="${esc(c.key)}" data-type="${esc(c.type)}" aria-sort="none">${esc(c.label)}</th>`).join('\n')}
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
    <p class="tablenote">&ldquo;n/c&rdquo; means not confirmed against a primary source. Those values are left out of every calculation rather than estimated. Sorting by a price column puts unconfirmed rows last.</p>
  </div>

  <div class="wrap">
    <section id="detail">
      <h2 id="detail-heading">Details</h2>
      <p class="sublede" id="detail-hint">Tick models in the table above to pin them here.</p>
      <div class="cmpgrid" id="cmpgrid">
${detailCards}
      </div>
    </section>
  </div>
`;
}
