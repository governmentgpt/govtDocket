# WikiGov Data Sources (Tamil Nadu)

Primary, source-verifiable inputs for the knowledge graph. All are official TN
government properties (NIC-built) or government-approved. Pages are **dynamically
rendered** (a plain HTTP GET returns an empty shell) so the crawler must render
with a headless browser; most documents are **PDF or scanned images** and need
text extraction / OCR (English **and** Tamil).

> `whatsnew.php?year=MjAyNg==` — the `year` param is base64: `MjAyNg==` = `2026`.

## Crawl registry

| key | Source | Path | Artifact | Frequency | Authority |
|---|---|---|---|---|---|
| `tn-whatsnew` | What's New | `whatsnew.php?year=b64(YYYY)` → links out | HTML index | **Daily** | change-feed |
| `tn-go` | Government Orders (dept-wise) | `godept_list.php` → dept (×38) → GO row → PDF icon | **PDF** (EN+TA, some scanned) | Weekly/dept | A |
| `tn-schemes` | Schemes | `schemes.php` → Dept / Beneficiary / A-Z → detail | HTML | Monthly | B |
| `tn-departments` | Department details | `department_list.php` → dept → full page | HTML | Monthly | B |
| `tn-press` | Press Releases | `press_release.php` → dated feed (Release No, EN+TA) | **PDF + image** (OCR) | **Daily** | D |
| `tn-assembly` | Legislative Assembly | `assembly.tn.gov.in` → Members / Bills / Debates / Acts | HTML + PDF | Session (~monthly) | A |
| `tn-gazette` | Gazette (Stationery & Printing) | `stationeryprinting.tn.gov.in` → Gazettes / Manuals | **PDF** (scanned→OCR) | Weekly | A |
| `tn-finance` | Finance Department | `financedept.tn.gov.in/en/` → Budget / Reports / Acts / Manuals | **PDF** (+ Excel) | Budget annual · Reports quarterly | B |

## What each source contributes to the graph

1. **What's New — discovery driver (not content).** Tells the crawler *what changed and when*; drives incremental ingestion, `valid_from` dates, and supersede detection. It is the trigger, not a node.
2. **GO list — evidence backbone.** ⭐ Each GO PDF → `document` + `document_version` + OCR `passages`; spawns **scheme / eligibility / process** nodes and `governed_by` / `amends` / `supersedes` / `requires` edges. Every factual answer cites a GO passage.
3. **Schemes — citizen-facing model.** ⭐ Scheme pages → **scheme** nodes (benefit/eligibility/process) + edges to dept/documents. Beneficiary facet → **aliases** ("women", "farmer", "student").
4. **Department details — accountability spine.** **department** nodes (owner/publisher, functions, contacts) that schemes/GOs hang off via `published_by`.
5. **Press Releases — recency + early warning.** Daily → **event** nodes with dates + `announces` edges; often the first signal of a scheme before its GO. Powers the timeline.
6. **Assembly — legislative lineage.** **Act / Bill** documents + **person** (MLA→constituency→minister) nodes; `implements` (GO→Act), `represents`. Deepens provenance to the law level.
7. **Gazette — statutory record (highest authority).** Gazette notification PDFs → high-authority documents; name-change/appointment/winding-up → **event** nodes; manuals → **process** nodes.
8. **Finance — the money dimension.** Budget/report PDFs → **budget_line** / dataset nodes + `allocates` / `funded_by` edges; answers "how much / is it funded?".

## Crawl mechanics

- **Render:** headless browser (Playwright) — pages are JS-driven.
- **Extract:** PDF → text layer (`pypdf`); scanned PDF / press-release images → **OCR** (`tesseract`, `eng+tam`).
- **Incremental:** crawl `tn-whatsnew` daily, diff against `crawl_state.last_content_hash`, and only fetch newly-linked artifacts. Avoids re-crawling 38 departments each run.
- **Governance:** every artifact lands as `status='pending review'`; a steward approves before it is searchable. Nothing auto-publishes.

## Supplementary (kept, not primary)

- **data.gov.in** — structured JSON API (adapter already built) for datasets/statistics.
