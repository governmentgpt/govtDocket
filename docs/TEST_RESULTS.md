# WikiGov — Test Run Results (2026-08-02)

Executed against the live hosted stack (Render UI + Cloudflare Worker + Supabase
+ GLM). Method: in-app browser + direct API calls from the Render origin.

**Run was partially blocked** by two live issues (below): the LLM endpoint was
timing out, and the browser automation pane became unresponsive part-way through,
so the conversational (Suite C) and most Explore-interaction (Suite D) cases could
not be exercised end-to-end. Backend (A) and landing (B) suites completed.

## Scorecard

| Suite | Pass | Fail | Partial | Blocked/Not run |
|-------|------|------|---------|-----------------|
| A — Backend/API | A1 A2 A3 A4 A5 A9 | **A6 A10** | — | A7 A8 |
| B — Landing | B1 B2 B4 B5 B6 | — | **B8** | B3 B7 B9 B10 |
| C — Conversational | — | — | — | C1–C10 (blocked) |
| D — Explore | D1 D13 | **D6** | D14 | D2–D5 D7–D12 D15 |
| E — Cross-cutting | — | **E3 E4** | — | E1 E2 E5 |

## Confirmed results

- **A1 Health PASS** — `status:ok`, `supabaseUrl/supabaseKey/llmKey` all true, 0.35s.
- **A2/A3 Graph PASS** — 418 approved nodes / 493 edges (3.7s). Types: department 48,
  order 166, budget_line 55, scheme 43, person 35, event 32, act 20, eligibility 16,
  hub 2, root 1. `status=all` == 418 (everything is approved; no pending backlog).
- **A4 Node detail PASS** — `/api/node?id=scheme-training-to-farmers` → title match,
  1 neighbour, 1 citation.
- **A5 Home PASS** — 48 departments, 8 schemes, 6 recent.
- **A9 CORS PASS** — cross-origin fetches from the Render origin succeed.
- **B1/B2/B4/B5 PASS** — landing is fully dynamic: real popular topics, real
  "Government service" cards with departments, real department list, recent profiles.
- **B6 PASS** — Explore nav routes to the 3D view.
- **D1 PASS** — Explore Map loads: backbone visible, "51 shown · 220 total",
  Map/Focus/Overview segmented control + Reset all present.
- **D13 PASS** — legend + expand hint render.

## FAIL / gaps found

1. **[CRITICAL] LLM synthesis unavailable — A6, A10, and all of Suite C.**
   `POST /api/query "training to farmers scheme"` returned after **127s**:
   `"Retrieved 10 verified source(s), but the answer service is unavailable
   (LLM endpoint responded 524)."` Retrieval + citations work; the GLM chat endpoint
   (`z-ai/glm-5.2`) is timing out (Cloudflare 524 from the provider). No grounded
   answers can be produced, and the request hung ~127s before the fallback fired.
   → *Fix shipped (needs `worker` redeploy):* `AbortSignal.timeout(30s)` on the LLM
   call and 15s on embeddings, so it now degrades to source passages in ~30s.
   → *Root cause is the provider* — verify/replace `LLM_BASE_URL` / `LLM_MODEL` /
   `LLM_API_KEY`, or switch provider. Nothing in the UI can be answer-tested until this is up.

2. **[HIGH] Overview sunburst rendered blank — D6.** Overview mode activated and its
   hint showed, but the SVG did not display any wedges.
   → *Fix shipped (frontend, auto-deploys):* render into a flex-centered wrapper with
   explicit pixel dimensions, measured after a `requestAnimationFrame`, built via
   `DOMParser` (guaranteed SVG namespace). **Needs live re-verification** after deploy.

3. **[MEDIUM] Data quality — E3.** An **"Unknown Department"** node exists (type
   `department`) and surfaces both in the graph and in the landing "Browse by
   department" list. Retrieved passages also include scraped **navigation chrome**
   (e.g. "Video Gallery, Polls, Discussion Forum, Sitemap…") instead of substantive
   text — this pollutes citations and dilutes retrieval.

4. **[MEDIUM] Language toggle cosmetic — B8.** தமிழ் highlights but no content or UI
   copy switches to Tamil (bilingual rendering not wired — a known deferred item).

5. **[LOW] "Recently updated" shows department profiles**, not the latest GOs /
   documents, despite the "Latest approved Government documents" label.

## Blocked (could not execute this run)

- **Suite C (conversational chat)** entirely — blocked by finding #1 (no answers) and
  the browser pane going unresponsive.
- **D2–D5, D7–D12** (Map expand/collapse, Focus ego-network, sunburst→map jump, Reset,
  search, toggles, drawer) and **D15/B10** (mobile) — browser pane became unresponsive
  after Overview; needs a clean re-run.

## Recommended next actions (priority order)

1. **Restore the LLM endpoint** (verify GLM key/base-url/model or switch provider),
   then `cd worker && npm run deploy` to ship the timeout fallback.
2. **Re-verify the sunburst** live once Render redeploys the frontend.
3. **Clean ingestion**: drop nav-chrome passages (min content length / menu-token
   filter) and resolve the "Unknown Department" node.
4. **Re-run Suites C + D interactions + mobile** end-to-end once #1 and the browser
   tooling are healthy.
5. Decide bilingual: wire Tamil rendering or hide the toggle until ready.
