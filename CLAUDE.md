# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WikiGov (repo `govtDocket`) is a public, source-verifiable Government Knowledge Platform for Tamil Nadu. Answers must be official, traceable to an approved source passage, and continuously governed — never merely plausible AI output. Read [`docs/ARCHITECTURE_PROTOCOL.md`](docs/ARCHITECTURE_PROTOCOL.md) before changing platform architecture, retrieval, or source governance; it is the binding contract for those areas.

## Four independently deployable layers

The system is deliberately split so each layer can be deployed and swapped without touching the others:

1. **Web client** — `index.html` + `src/main.js` + `src/styles.css`. Dependency-free vanilla JS (no framework, no build). Deployed as a Render static site (`render.yaml`), auto-redeployed on push to `main`. Live: https://govt-docket-ui.onrender.com
2. **API / retrieval** — `worker/`. A Cloudflare Worker (Hono) that runs the vectorless RAG pipeline. This is the **only** live API code. `src/api/query.js` is a deprecated stub — do not add logic there.
3. **Ingestion / knowledge factory** — `src/ingestion/`. Node CLI prototypes that scrape sources, propose node/edge structure, write git-backed JSON, and compile SQL.
4. **Data store** — Supabase (PostgreSQL). Schema and RPCs in `src/db/`. The user applies migrations manually (see Testing).

Data flow at query time: **Render UI → Cloudflare Worker → Supabase RPCs → NVIDIA NIM synthesis → grounded answer + citations + graph**.

## Vectorless RAG pipeline (the core design)

Retrieval is deterministic-first and must support running without any vector/embedding store. Implemented in [`worker/src/routes/query.js`](worker/src/routes/query.js) as a 4-step ladder:

1. **Alias match** — `match_node_aliases` RPC: `pg_trgm` trigram similarity over `node_aliases` to find the root concept node.
2. **Graph traversal** — `get_graph_rag_context` RPC: recursive 2-hop CTE outward from the root node.
3. **Evidence assembly** — same RPC returns passages + citations (page, section, document, authority) joined via `edge_evidence`.
4. **Grounded synthesis** — NVIDIA NIM (OpenAI-compatible `integrate.api.nvidia.com/v1`, model via `NVIDIA_MODEL`, temperature 0.1) with a strict anti-hallucination system prompt.

Non-negotiable behaviors when editing this pipeline:
- Return exactly `"No verified information was found."` rather than inventing anything unsupported.
- Every factual claim in an answer carries a citation token `[Source Name, Page N]`.
- Both RPCs live in [`src/db/schema.sql`](src/db/schema.sql); the Worker calls them over Supabase's REST `/rpc/` endpoint using native `fetch` (no `@supabase/supabase-js` — keeps the bundle tiny). Changing an RPC signature means updating both the SQL and the Worker call.
- The Worker degrades gracefully: no Supabase secrets → `simulateResponse()` mock; no `NVIDIA_API_KEY` → raw passage text. Preserve these fallbacks.

## Data model (Supabase)

Knowledge is a versioned graph, not chat history. Key tables in [`src/db/schema.sql`](src/db/schema.sql):
- Provenance chain: `sources → captures → documents → document_versions → passages`.
- Graph: `nodes` (typed: scheme/department/event/eligibility/process) → `node_versions` (bilingual EN/TA, with lifecycle `status`) → `node_aliases`; `edges` + `edge_evidence` link every relationship back to a source passage.
- `audit_events` records all governance actions.

Lifecycle is `draft → pending review → approved → archived`. `get_graph_rag_context` only surfaces the latest **approved**, currently-valid (`valid_to IS NULL`) node version. Never silently overwrite a source, citation, or version — supersede with a new version instead.

## Commands

Frontend (from repo root — no build step):
```sh
python3 -m http.server 8000
```

Cloudflare Worker (from `worker/`):
```sh
npm run dev      # wrangler dev — local Worker
npm run deploy   # wrangler deploy
```
Worker secrets are Cloudflare encrypted bindings set via `wrangler secret put` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NVIDIA_API_KEY`) — accessed only through `env.*`, never in `wrangler.toml` or source. Non-secret config goes in the `[vars]` block of [`worker/wrangler.toml`](worker/wrangler.toml).

Ingestion (from repo root, Node):
```sh
node src/ingestion/onboard.js   # scrape → structure → write git_storage JSON
node src/ingestion/sync.js      # compile git_storage JSON → src/db/sync_data.sql
```

## Ingestion / git-backed storage

`src/data/git_storage/` (`nodes/`, `edges/`, `documents/`) is the version-controlled source of truth for governed knowledge, one JSON file per entity. `onboard.js` proposes and writes these; `sync.js` compiles all of them into a single **idempotent** `src/db/sync_data.sql` (uses `ON CONFLICT ... DO UPDATE`) that the user applies to Supabase manually. Both scripts are currently prototypes driven by mock source data.

## Testing & deployment (important — no local testing)

Per [`AGENTS.md`](AGENTS.md): **do not run local browser or server tests.** All functional/visual UI testing happens on the hosted Render instance. Database schema changes are authored as SQL migration files here; the user applies them to their Supabase instance manually before live testing. Verify changes by reasoning about the code and committing; the user validates on the deployed environment.

## Conventions

- 2-space indent for HTML/CSS/JS. `camelCase` JS vars/functions, `PascalCase` component constructors, `kebab-case` CSS classes and asset filenames.
- Bilingual by default: node content carries `_en` and `_ta` fields; the UI has an EN/தமிழ் toggle.
- Government claims in UI copy must cite an official source or be clearly marked demonstration/prototype content. The current UI (`src/main.js`) uses labelled demonstration data until sources are connected.
- Conventional Commit messages (`feat:`, `fix:`, `chore:`, `docs:`), scoped to one intent. Flag any change to government content, source attribution, or configuration in PRs.
