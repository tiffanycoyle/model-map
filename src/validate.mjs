/**
 * Data integrity checks. Run on every build and in CI, so a bad edit to
 * data/models.json fails loudly instead of shipping a broken page.
 */

const REQUIRED_STRINGS = ['id', 'name', 'vendor', 'country', 'license', 'best'];
const REQUIRED_BOOLS = ['oneGpu', 'eu', 'zdr', 'm1'];
const NULLABLE_NUMBERS = ['pin', 'pout'];
const WEIGHTS = new Set(['open', 'closed']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function validate(data, content) {
  const problems = [];
  const push = (msg) => problems.push(msg);

  if (!data || !Array.isArray(data.models)) {
    return ['data/models.json: "models" must be an array'];
  }
  if (!data.version) push('data/models.json: missing "version"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.compiled || '')) {
    push('data/models.json: "compiled" must be an ISO date (YYYY-MM-DD)');
  }

  const seenIds = new Set();
  const seenNames = new Set();

  data.models.forEach((m, i) => {
    const where = `models[${i}]${m && m.id ? ` (${m.id})` : ''}`;

    for (const key of REQUIRED_STRINGS) {
      if (typeof m[key] !== 'string' || !m[key].trim()) {
        push(`${where}: "${key}" must be a non-empty string`);
      }
    }

    if (typeof m.id === 'string') {
      if (!ID_PATTERN.test(m.id)) {
        push(`${where}: "id" must be lowercase letters, digits and hyphens only`);
      }
      if (seenIds.has(m.id)) push(`${where}: duplicate id "${m.id}"`);
      seenIds.add(m.id);
    }

    if (typeof m.name === 'string') {
      if (seenNames.has(m.name)) push(`${where}: duplicate name "${m.name}"`);
      seenNames.add(m.name);
    }

    for (const key of NULLABLE_NUMBERS) {
      const v = m[key];
      if (v !== null && (typeof v !== 'number' || !isFinite(v) || v < 0)) {
        push(`${where}: "${key}" must be null or a non-negative number`);
      }
    }

    if (typeof m.pin === 'number' && typeof m.pout === 'number' && m.pout < m.pin) {
      // Not fatal — Perplexity's Sonar is genuinely flat-rated — but worth flagging.
      if (m.pout !== m.pin) {
        push(`${where}: output price (${m.pout}) is below input price (${m.pin}); confirm this is right`);
      }
    }

    for (const key of REQUIRED_BOOLS) {
      if (typeof m[key] !== 'boolean') push(`${where}: "${key}" must be true or false`);
    }

    if (!WEIGHTS.has(m.weights)) {
      push(`${where}: "weights" must be "open" or "closed"`);
    }
    if (m.weights === 'open' && m.oneGpu === undefined) {
      push(`${where}: open-weight models must state "oneGpu"`);
    }

    if (typeof m.rank !== 'number' || m.rank < 0 || m.rank > 100) {
      push(`${where}: "rank" must be a number from 0 to 100`);
    }

    if (!Array.isArray(m.jobs) || m.jobs.length === 0) {
      push(`${where}: "jobs" must be a non-empty array`);
    }

    if (m.ctx !== null && typeof m.ctx !== 'string') {
      push(`${where}: "ctx" must be null or a string such as "1M"`);
    }
    if (m.params !== null && typeof m.params !== 'string') {
      push(`${where}: "params" must be null or a string`);
    }

    if (m.plot === true && typeof m.pout !== 'number') {
      push(`${where}: cannot be plotted on the price chart without a confirmed "pout"`);
    }
  });

  if (content) {
    const declaredJobs = new Set((content.jobs || []).map((j) => j[0]));
    const usedJobs = new Set();
    data.models.forEach((m) => (m.jobs || []).forEach((j) => usedJobs.add(j)));

    for (const job of usedJobs) {
      if (!declaredJobs.has(job)) {
        push(`data/content.json: job "${job}" is used by a model but has no label in "jobs"`);
      }
    }
    for (const job of declaredJobs) {
      if (!usedJobs.has(job)) {
        push(`data/content.json: job "${job}" has a label but no model uses it`);
      }
    }

    (content.sources || []).forEach((s, i) => {
      if (!s.url || !/^https:\/\//.test(s.url)) {
        push(`data/content.json: sources[${i}] must have an https URL`);
      }
    });

    const plotted = data.models.filter((m) => m.plot).length;
    if (plotted < 2) push('data/models.json: at least two models need "plot": true for the price chart');
  }

  return problems;
}

/* Allow `node src/validate.mjs` as a standalone check. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');

  const data = JSON.parse(await readFile(join(root, 'data', 'models.json'), 'utf8'));
  const content = JSON.parse(await readFile(join(root, 'data', 'content.json'), 'utf8'));
  const problems = validate(data, content);

  if (problems.length) {
    console.error(`${problems.length} problem(s) found:\n` + problems.map((p) => '  - ' + p).join('\n'));
    process.exit(1);
  }
  console.log(`data/models.json OK — ${data.models.length} models, version ${data.version}`);
}
