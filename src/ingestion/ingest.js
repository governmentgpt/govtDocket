/**
 * WikiGov ingestion orchestrator
 *
 * Pulls records from an approved source, normalizes them into the git-backed
 * knowledge store, then (via sync.js) compiles them to idempotent SQL for
 * Supabase. Ingested records are written as status 'pending review'; a steward
 * approves them before they become searchable.
 *
 * Usage:
 *   DATA_GOV_API_KEY=xxx node src/ingestion/ingest.js --source datagovin --resource <RESOURCE_ID> [--limit 50]
 *   node src/ingestion/ingest.js --source datagovin --fixture path/to/sample.json   # offline, no key needed
 *
 * After running, compile and review:
 *   node src/ingestion/sync.js          # regenerates src/db/sync_data.sql
 *   git diff src/data/git_storage       # review the proposed knowledge changes
 */

const fs = require('fs');
const path = require('path');
const datagovin = require('./sources/datagovin');

const STORAGE_DIR = path.join(__dirname, '../data/git_storage');
const NODES_DIR = path.join(STORAGE_DIR, 'nodes');
const EDGES_DIR = path.join(STORAGE_DIR, 'edges');
const DOCS_DIR = path.join(STORAGE_DIR, 'documents');

[STORAGE_DIR, NODES_DIR, EDGES_DIR, DOCS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function saveToGitStorage({ document, documentVersion, passages, nodes, edges }) {
  fs.writeFileSync(
    path.join(DOCS_DIR, `${document.id}.json`),
    JSON.stringify({ ...document, version: documentVersion, passages }, null, 2)
  );
  nodes.forEach((node) =>
    fs.writeFileSync(path.join(NODES_DIR, `${node.id}.json`), JSON.stringify(node, null, 2))
  );
  edges.forEach((edge) =>
    fs.writeFileSync(path.join(EDGES_DIR, `${edge.id}.json`), JSON.stringify(edge, null, 2))
  );
  console.log(
    `✔ Wrote 1 document, ${nodes.length} nodes, ${edges.length} edges to git_storage (status: pending review).`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source || 'datagovin';

  if (source !== 'datagovin') {
    throw new Error(`Unknown source "${source}". Supported: datagovin.`);
  }

  const resourceId = args.resource || 'fixture';
  let payload;

  if (args.fixture) {
    console.log(`[ingest] Reading fixture: ${args.fixture}`);
    payload = JSON.parse(fs.readFileSync(args.fixture, 'utf8'));
  } else {
    console.log(`[ingest] Fetching data.gov.in resource ${resourceId} ...`);
    payload = await datagovin.fetchResource(resourceId, {
      apiKey: process.env.DATA_GOV_API_KEY,
      limit: Number(args.limit) || 50,
    });
  }

  const graph = datagovin.normalizeResource(resourceId, payload);
  saveToGitStorage(graph);

  console.log('\nNext: `node src/ingestion/sync.js` to compile SQL, then review `git diff`.');
}

main().catch((err) => {
  console.error('[ingest] failed:', err.message);
  process.exit(1);
});
