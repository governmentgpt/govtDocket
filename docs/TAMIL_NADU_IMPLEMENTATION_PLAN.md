# WikiGov Tamil Nadu Implementation Plan

## Purpose

Build WikiGov as a Tamil Nadu-first public Government Knowledge Platform. Citizens must be able to ask natural-language questions without an account, receive a simple answer, inspect its evidence, and explore its policy context through an interactive knowledge map.

The product is not a generic chatbot. Every public claim must be traceable to an approved official source, a specific document version, and an exact passage. The knowledge graph is the product's canonical model; chat, timelines, related-content cards, and the 3D map are views over that model.

## Product Experience

### Citizen flow

1. A user asks a plain-language question in Tamil or English.
2. WikiGov identifies the most relevant verified topic, event, scheme, policy, or document.
3. The chat workspace presents a clear answer first, with a "verified as of" timestamp and citations.
4. The adjacent knowledge map centres on the active node and shows five to eight high-confidence connected nodes.
5. Selecting a node updates the answer, source panel, timeline, and map focus.
6. Follow-up questions retain context. An unrelated question creates a new map context while preserving the earlier conversation in history.

### Knowledge map principles

- Answer first; explore second; verify always.
- Use progressive expansion. Do not load or display the entire graph at once.
- Provide both a WebGL 3D map and an equivalent accessible 2D list/tree/timeline view.
- Show source authority, approval status, document date, effective date, and source timestamp on every node card.
- Label every visible edge with a relationship type. Proximity alone must never imply causation.
- Maintain a visible path such as `NEET issue → Paper leak → Re-exam → Result`.

### Visual graph semantics

The frontend derives visual properties from governed graph data; no visual property is the only representation of knowledge.

- Node size: relevance to the active question and verified importance.
- Node colour: entity type and publication/review state.
- Connector thickness: evidence count, authority weight, and relationship confidence.
- Connector length: graph distance and relationship type.
- Edge style: solid for approved, dashed for pending/disputed, muted for superseded.

## System Architecture

```text
Citizen web app
  ├─ Chat and answer workspace
  ├─ Source viewer and timeline
  └─ Interactive knowledge map (3D + accessible 2D fallback)
              │
              ▼
Query / retrieval API
  ├─ Intent + entity extraction
  ├─ Tamil/English keyword and metadata search
  ├─ Graph traversal and ranking
  ├─ Citation/evidence assembly
  └─ Grounded LLM answer writer
              │
              ▼
Postgres knowledge graph + search index
  ├─ Approved nodes and edges
  ├─ Source documents and passages
  ├─ Versions, validity periods, reviews
  └─ Retrieval projections
              ▲
              │
Knowledge factory
  ├─ Source discovery and capture
  ├─ OCR / extraction / normalisation
  ├─ Link and change proposals
  ├─ Steward review
  └─ Publish only approved changes
```

## Frontend Architecture

Use React, TypeScript, Vite, Tailwind CSS, TanStack Query, and Zustand. Use Three.js or `react-force-graph-3d` for the WebGL map, with D3 where a timeline or 2D graph is appropriate.

Build these modules:

- `SearchHome`: top searches, latest releases, schemes, departments, and categories.
- `SearchSuggestions`: schemes, GO numbers, departments, Acts, aliases, and common questions while typing.
- `ChatWorkspace`: continuous question/answer flow, context changes, history, and suggested follow-ups.
- `AnswerCard`: summary, detailed explanation, eligibility, process, latest update, uncertainty, citations, feedback, and answer version.
- `KnowledgeMap`: lazy-loaded 3D subgraph with expand, pan, zoom, select, and focus controls.
- `AccessibleGraphView`: list/tree/timeline fallback for mobile, keyboard users, screen readers, and low-power devices.
- `NodeInspector`: verified summary, approving authority, source status, dates, related nodes, and evidence.
- `SourceViewer`: original URL/PDF, preserved capture, OCR text, highlighted source passage, page/paragraph citation, download/share/print.
- `Timeline`: amendment history, event sequence, effective dates, and supersession.
- `FeedbackFlow`: helpful, incorrect, outdated, incomplete, translation error, and missing-information reports.
- `DepartmentAndSchemeViews`: public entry points generated from the same graph.

The client must cache only public projection data, keep citations attached to claims, avoid exposing internal reviewer data, and honour a user preference for Tamil or English.

## Backend Architecture

Use Cloudflare Workers with Hono for the public API. Use Supabase Edge Functions and scheduled GitHub Actions for ingestion, validation, and governance jobs. Keep APIs provider-neutral so the deployment platform can change.

### Public services

- **Query Orchestrator:** converts a question into a retrieval plan; never treats an LLM answer as evidence.
- **Entity Resolver:** resolves GO/circular identifiers, scheme names, departments, districts, people, dates, Tamil aliases, English aliases, and transliterations.
- **Lexical Retrieval:** runs exact, phrase, metadata, and typo-tolerant lookup over approved material.
- **Graph Traversal:** retrieves approved one- or two-hop relationships around a selected node.
- **Evidence Service:** returns the exact source passage, original document/version, page/section, effective date, and official link.
- **Answer Composer:** uses an LLM only to explain retrieved evidence in natural language. It must cite every factual claim or return "No verified information was found."
- **Graph API:** returns a compact, ranked subgraph, for example `GET /v1/graph?root=neet-paper-leak-2026&hops=1&view=events`.
- **Feedback API:** accepts anonymous feedback with rate limits and sends it to the governance queue.

### Knowledge-factory services

- **Source Registry Manager:** owns domains, authority tiers, ingestion permissions, crawl policy, cadence, and departmental stewardship.
- **Capture Worker:** downloads or snapshots source content, records the original URL, MIME type, timestamp, response metadata, and SHA-256 hash.
- **Extraction Worker:** extracts text, tables, layout, and links from HTML, PDF, Office files, datasets, images, and media.
- **OCR and Transcript Worker:** produces page/timestamp-addressable output for scans, images, audio, and video; high-impact material requires visual or human verification.
- **Normalizer:** standardises dates, departments, districts, GO numbers, citations, language fields, and document type.
- **Entity and Relation Proposer:** identifies candidate nodes/edges and source evidence. It may use an LLM, but its output is always proposed, never published automatically.
- **Change Detector:** compares captures and versions to flag amended Acts, revised GOs, changed pages, dead links, and conflicting claims.
- **Governance Queue:** supports approval, rejection, merge, edit, escalation, assignment, and publication by accountable stewards.
- **Audit Service:** logs capture, extraction, decision, publish, answer, feedback, and download events.

## Database and Knowledge Graph

Start with Supabase Postgres. PostgreSQL is sufficient for the initial typed graph, document storage metadata, text retrieval, versioning, and governance workflow. Do not introduce a separate graph database until profiling shows that Postgres traversal is an operational bottleneck.

### Core tables

| Table group | Purpose |
|---|---|
| `sources`, `source_policies` | Official owner, domain, authority tier, terms/permission status, crawl rules, cadence, and steward |
| `captures`, `raw_assets` | Immutable source snapshot/URL, hash, fetch time, MIME type, storage location, and extraction status |
| `documents`, `document_versions` | GO, Gazette, Act, rule, circular, policy note, press release, dataset, media item, and supersession chain |
| `passages` | Page, section, paragraph, table, row, image region, or transcript timestamp that can be cited exactly |
| `nodes`, `node_versions`, `node_aliases` | Stable concepts and their Tamil/English names, aliases, definitions, publication state, and validity period |
| `edges`, `edge_evidence` | Typed relationships, their validity, approval state, strength inputs, and exact proving passages |
| `reviews`, `approvals`, `audit_events` | Proposed change, reviewer/steward decision, rationale, timestamps, and immutable audit history |
| `search_index` | Denormalised public, approved-only lexical retrieval projection |
| `queries`, `feedback` | Privacy-minimised anonymous product metrics and citizen reports |

### Node model

Nodes represent stable government concepts rather than arbitrary chat messages. Initial types include:

- Scheme, benefit, eligibility criterion, required document, application process.
- Government Order, Act, rule, section, circular, notification, Gazette publication.
- Department, agency, statutory board, district, local body, programme.
- Budget allocation, event, announcement, court/judicial outcome, report, dataset.
- Official source document and source passage.

Each node has a stable identifier plus versions. Node versions include language fields, valid-from/valid-to dates, source status, reviewer, and publication state.

### Edge model

Use a controlled relationship vocabulary: `governed_by`, `defined_by`, `amended_by`, `supersedes`, `implements`, `announced_by`, `applies_to`, `requires`, `funded_by`, `located_in`, `published_by`, `clarifies`, `related_event`, and `supported_by`.

```text
edge:
  from_node: widow-pension-scheme
  relation: amended_by
  to_node: go-ms-118-2026
  valid_from: 2026-07-14
  status: approved
  strength: 0.94
  evidence_count: 3

edge_evidence:
  document_version_id: ...
  passage_id: ...
  page_number: 4
  reviewed_by: social-welfare-steward
  approved_at: ...
```

No relationship can become public without at least one approved evidence record. Causal relationships require particularly strong source wording; co-occurrence or similarity must be labelled as such.

## Vectorless Retrieval Design

Run a retrieval ladder before considering semantic/vector search:

1. Exact references: GO number, Gazette number, Act, rule, circular, scheme, department, district.
2. Controlled aliases in Tamil and English, transliteration variants, abbreviations, and common citizen wording.
3. Metadata filters: department, topic, document type, date, geography, status, and authority tier.
4. Full-text phrase matching and trigram similarity over approved document passages and node aliases.
5. Approved graph expansion from the strongest matched node(s).
6. Optional semantic/vector retrieval only when lexical and graph retrieval cannot produce enough verified evidence.

Use PostgreSQL full-text fields, `pg_trgm`, normalised aliases, and separate Tamil/English searchable fields. Do not rely on English-centric stemming for Tamil. Add curated aliases only through governance, for example mapping a citizen term to a specific official scheme where the link has been reviewed.

The LLM may help interpret queries, translate, simplify, draft summaries, extract candidates, and maintain conversation context. It may not contribute facts that do not exist in retrieved approved passages.

## Tamil Nadu Source Policy and Registry

### Operating rule

Do not assume that public availability means unrestricted reuse. Official publication establishes provenance, but storage, crawling, reproduction, and republication must be checked per source policy. Register a permission/terms decision for every source domain. Attribute source ownership prominently, preserve links to originals, honour access restrictions, and request permission where a department policy requires it.

Tamil Nadu department policies commonly permit reproduction only with proper attribution and, in some cases, prior permission; third-party material needs separate authorization. See the [Directorate of Town Panchayats copyright policy](https://www.tnurbantree.tn.gov.in/project/reports/Public/WebsitePolicies.php) and [Centre for Professional Excellence policy](https://www.cpe.tn.gov.in/portalpolicies.pdf).

### Authority tiers

| Tier | Source class | WikiGov treatment |
|---|---|---|
| A — legal authority | Tamil Nadu Gazette, extraordinary gazettes, Acts, rules, notified Government Orders | Primary evidence; highest authority |
| B — departmental authority | Secretariat/department sites, commissionerates, district portals, GO/circular lists, policy notes, manuals | Primary evidence for departmental schemes and processes |
| C — financial authority | Budget documents, demand-for-grants, outcome budgets, Finance/Treasury releases | Budgets, allocations, programme context |
| D — public communication | DIPR, Lok Bhavan, department press releases, official verified government social/video accounts | Current announcement evidence; do not automatically treat as legal authority |
| E — statutory transparency | Published RTI Section 4 disclosures, public reports, dashboards, open-data releases | Supporting evidence when clearly public and non-personal |
| F — judicial / quasi-judicial | Official judgments, orders, commissions, and tribunal publications relevant to Tamil Nadu | Legal context, clearly labelled by issuing authority |

The Gazette is published by authority and carries notifications/orders; it is a first-priority connector. [Tamil Nadu Government Gazette](https://www.stationeryprinting.tn.gov.in/gazette/2024/50_II_2_2024.pdf) Department sites already publish searchable GO lists, including the [Rural Development and Panchayat Raj GO register](https://tnrd.tn.gov.in/rdweb_newsite/project/reports/Public/ListOfGO.php?scheme_code=MTE%3D&scheme_type=MQ%3D%3D). The [Tamil Nadu RTI portal](https://lnxstgweb.tn.gov.in/rtimis/index.php) is useful for identifying public authorities and departments, but submitted RTI requests/responses must not be ingested unless officially and publicly published.

### Supported source formats

Ingest only policy-approved official content in these formats:

- HTML pages, RSS/Atom feeds, JSON/XML APIs.
- Text PDFs, scanned PDFs, Gazette pages, tables, and annexures.
- DOC/DOCX, XLS/XLSX, CSV, PowerPoint, and ODT files.
- Images/scanned notices, with OCR and human verification for material claims.
- Audio/video, with timestamp-addressable transcripts and source review.
- Maps, GeoJSON, KML, dashboards, charts, and downloadable datasets.
- Official social posts, preserved with official account identity, post ID, timestamp, media, URL, and capture hash.

Never ingest leaked or private material, personal data, non-public RTI responses, citizen comments, unofficial news reporting, unverified social accounts, or a government-looking portal whose ownership is not confirmed. The [Tamil Nadu Data Policy 2022](https://it.tn.gov.in/sites/default/files/2022-09/TN%20DataPolicy_2022.pdf) requires safeguards for personal data and permissioned data sharing.

## Deployment and Operations

- **Frontend:** Cloudflare Pages, using preview deployments for pull requests.
- **Public API:** Cloudflare Workers, with caching, rate limiting, request validation, and abuse protection.
- **Database/auth/storage:** Supabase Postgres, Auth for internal users only, and Storage only for permitted source copies/extraction artefacts.
- **Background work:** scheduled GitHub Actions and Cloudflare Cron Triggers; make ingestion jobs idempotent and resumable.
- **Secrets:** Cloudflare/Supabase/GitHub encrypted secrets. Never expose service-role credentials to the client.
- **Monitoring:** structured logs, health checks, job runs, dead-letter/retry state, source-health reports, and error alerts.
- **Testing:** Vitest for logic, Playwright for citizen/admin flows, source/citation fixtures for retrieval correctness, and accessibility testing for the map fallback.

## Delivery Sequence

### Milestone 1: trustworthy public retrieval

Start with Social Welfare and Women Empowerment, School Education, and Revenue/Land Administration. Ingest a constrained, approved corpus of GOs, schemes, circulars, policy notes, and official source pages. Build 100–300 high-quality nodes, review all public links, and launch:

- Citizen search and answer workspace.
- Source viewer with exact citations.
- Tamil/English interface and aliases.
- Basic timeline and related-content cards.
- 2D graph/list exploration.

### Milestone 2: interactive knowledge map

Add a lazy-loaded 3D map, graph navigation, node inspection, conversation-to-map focus changes, and feedback. Keep every experience fully usable without the 3D view.

### Milestone 3: governed knowledge factory

Add source registry tooling, scheduled discovery/capture, OCR/extraction, proposal generation, change detection, steward queues, audits, and department ownership. No uncertain material auto-publishes.

### Milestone 4: statewide expansion

Onboard departments in waves, measure source freshness and citizen knowledge gaps, add public transparency analytics, and only then evaluate semantic/vector retrieval for specific unresolved recall problems.

## Success Criteria

- Every public factual answer links to approved evidence.
- Every node and edge has a source, version, status, and accountable review trail.
- Citizens can obtain useful information without knowing government terminology.
- The graph makes policy context easier to understand without overstating evidence.
- The platform remains useful when the LLM is unavailable: verified search, source viewing, timelines, and graph navigation still work.
- Tamil language and mobile/accessibility support are first-class requirements.
