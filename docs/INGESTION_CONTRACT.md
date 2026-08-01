# WikiGov Ingestion Contract

**Read this before building any new data adapter or pipeline** (minister data, a new
source, a new attribute, anything). It defines the *shape* every ingestion must
produce so the data becomes **searchable, graph-visible, and governable with zero
changes to the query engine**.

The search layer is deliberately **generic** — it never hardcodes a data type. If
your adapter honours this contract, your data is automatically part of search the
moment it is ingested and approved. If it doesn't, it silently won't be found.

Related: [ARCHITECTURE_PROTOCOL.md](ARCHITECTURE_PROTOCOL.md) · [GRAPH_MODEL.md](GRAPH_MODEL.md) · [DATA_SOURCES.md](DATA_SOURCES.md)

---

## The golden rule

> **A new data *type* needs a new *adapter* (to fetch/parse it). It must NOT need a
> new *search function*.** Capture data as **text (passages) + typed nodes + edges**,
> never as bespoke structured columns. Then FTS and the graph pick it up organically.

If you find yourself wanting to add a column to `node_versions` or a new RPC to make
your data searchable — stop. Model it as passages/details/nodes/edges instead.

---

## Two layers — where each piece of information goes

| Information | Goes to | Table | Notes |
|---|---|---|---|
| Raw source doc (PDF/HTML/image) provenance | Provenance | `documents` → `document_versions` | one per artifact; `original_url`, `doc_type`, `issuing_authority`, `sha256` |
| **The actual answerable text** (any length) | Provenance | `passages` | ⭐ **this is what full-text search reads** — put ALL content here |
| A concept users ask about (scheme, person, dept, event, order…) | Concept | `nodes` (+ `node_versions`) | typed, versioned, bilingual EN/TA |
| Names/synonyms to find a concept | Concept | `node_aliases` | ⭐ entity lookup depends on these |
| A relationship between concepts | Concept | `edges` (+ `edge_evidence`) | every edge cites a passage |
| The link that makes passages searchable | Provenance | `documents.node_id` | ⭐ **must point at the topic node**, or the doc is invisible to search |

**Where do "new attributes" go?** Into **passage text** and/or the node's `details_en/ta`
arrays — as text. A minister's portfolio, phone, constituency → write them into a
passage and the summary/details. Do **not** add columns. FTS + GLM answer from text.

---

## The contract object (what an adapter must emit)

Every adapter produces this shape (see `services/ingest/adapters.py :: build_graph`).
`services/ingest/db.py` writes it; everything lands as **`status = 'pending review'`**.

```python
{
  "document": {
    "id": "<uuid>", "vid": "<uuid>",          # document + version ids
    "url": "<source url>",
    "doc_type": "<e.g. Government Order>",
    "authority": "<issuing authority>",
    "lang": "EN" | "TA",
    "title": "<clean, human title>",           # NEVER mojibake — see quality rules
    "effective_date": "YYYY-MM-DD",
    "hash": "<sha256 of source bytes>",
    "node_id": "<topic node id>"               # ⭐ REQUIRED — gates search by approval
  },
  "passages": [                                 # ⭐ the searchable content — put text here
    { "id": "<uuid>", "page": 1, "section": "…", "text": "<clean text>", "language": "EN" },
    ...
  ],
  "nodes": [                                    # concepts (topic + any others, e.g. person, dept)
    {
      "id": "<type>-<slug>",                    # ⭐ DETERMINISTIC slug id (enables dedup)
      "type": "scheme|department|person|event|order|act|…",   # free text — no schema change
      "title_en": "…", "title_ta": "…",
      "summary_en": "…", "summary_ta": "…",
      "details_en": ["…"], "details_ta": ["…"], # ⭐ put extra attributes here as text
      "aliases": [ { "alias": "…", "lang": "EN" }, ... ]      # ⭐ names to be found by
    },
    ...
  ],
  "edges": [                                    # relationships, each with evidence
    { "id": "<uuid>", "from": "<node id>", "to": "<node id>",
      "relationship": "governed_by|published_by|represents|heads|…",
      "evidence": { "passage_id": "<passage id from above>" } }
  ]
}
```

---

## Non-negotiable rules (what keeps it organic + governed)

1. **Every document sets `node_id`** to its topic node. Passages are only searchable
   when their document's node is **approved** — no `node_id`, no search.
2. **Every node carries `aliases`** (names/synonyms). Entity lookup (`match_node_aliases`)
   depends on them. A person node with no name alias can't be found by name.
3. **Node ids are deterministic slugs** (`type-slugified-title`). Identical concepts
   collapse via `ON CONFLICT (id) DO NOTHING`; this is the cheap dedup. (Semantic
   dedup of *differently-worded* duplicates is the future turbovec layer.)
4. **Put content in passages, attributes in details/summary — as text.** Never add
   columns to make something searchable.
5. **Nothing auto-publishes.** Everything is `pending review`; a steward approves.
   Ingestion sets `approved_by = 'pending-review'` on evidence.
6. **Clean text only.** Strip NUL/control bytes; detect mojibake (legacy Tamil fonts)
   and OCR-fallback (`_looks_garbled`, `ocr_pdf_page_images`). Garbage text poisons
   retrieval and makes the LLM refuse — store nothing rather than garbage.
7. **Re-ingest is idempotent.** `db.upsert_edge` is get-or-create on the natural key;
   `db.upsert_node` replaces a changed pending version. Re-running never dup-errors.

---

## How search consumes your data (so you know the downstream)

| Function | Reads | Purpose |
|---|---|---|
| `search_passages(q, k)` | `passages` (approved via `documents.node_id` → node) | ⭐ **primary** content retrieval — FTS over ALL text |
| `match_node_aliases(q)` | `node_aliases` | find the entry-point concept (for the graph) |
| `get_graph_rag_context(id, hops)` | `edges` + `edge_evidence` + `nodes` | graph context + related passages |
| `get_full_graph(status)` | `nodes` + `edges` | the 3D Explore view |

All are **type-agnostic** and `SECURITY DEFINER`. Add data → it flows through these
unchanged. GLM 5.2 synthesizes the grounded answer over the retrieved passages.

---

## New-adapter checklist

1. Add a source entry to `services/ingest/config.py :: SOURCES` (`seeds`, `follow`/`detail`,
   `focus`, `primary_node_type`, `edge`, `authority`, `doc_type`).
2. Implement discovery/parsing in `adapters.py` (or reuse the generic `discover`/`extract_passages`).
3. Emit the **contract object** via `build_graph` — set `node_id`, aliases, clean text.
4. Seed the source row in `src/db/migrations/002_ingestion.sql` (or an add-on migration).
5. Run `python run.py --source <key> --mode all`; confirm rows land as `pending review`.
6. Approve; verify with `search_passages` and the Explore tab. **No query-engine edits.**

## Anti-patterns (do NOT do)

- ❌ Adding a column/table just to search a new attribute → put it in passages/details.
- ❌ A document without `node_id` → invisible to search.
- ❌ A node without aliases → unfindable by name.
- ❌ Random (non-slug) node ids → breaks dedup, creates duplicates.
- ❌ Auto-approving ingested data → violates governance.
- ❌ Storing mojibake / un-OCR'd garbage → poisons retrieval.
- ❌ A per-source search function → the search is generic; never fork it.

---

### Example: the minister adapter (illustrative)

Fetch Council of Ministers / Assembly members → for each person emit a `person`
node (`person-<name-slug>`, aliases = name variants, details = portfolio/constituency
as text), a passage with their bio/details, a `document` (`node_id` = the person node),
and an edge `person —heads→ department` (or `represents → constituency`) with the bio
passage as evidence. Approve → "who is the finance minister" is answered from the
passage text, and the person appears in the graph. **Zero query-engine changes.**
