# WikiGov — End-to-End Test Plan

Elaborative functional + visual test process covering every feature and
visualization across the four layers (Render UI → Worker → Supabase → LLM).
All UI testing runs against the **live hosted instance** per `AGENTS.md`:

- Frontend: https://govt-docket-ui.onrender.com
- API: https://govtdocket.product-governmentgpt.workers.dev

Legend: **PASS** / **FAIL** / **PARTIAL** / **N/A**. Each case lists steps and the
expected result. Results are recorded in `docs/TEST_RESULTS.md` after a run.

---

## Suite A — Backend / API layer

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| A1 | Health | GET `/api/health` | `status:ok`; env `supabaseUrl/supabaseKey/llmKey` all `true` |
| A2 | Graph dump (approved) | GET `/api/graph?status=approved` | `{nodes,edges}` non-empty; nodes carry `id,type,title` |
| A3 | Graph dump (all) | GET `/api/graph?status=all` | node count ≥ approved count |
| A4 | Node detail | GET `/api/node?id=<real id>` | `{node,neighbors,citations}`; node title matches |
| A5 | Home payload | GET `/api/home` | `departments`, `schemes`, `recent` populated |
| A6 | Query — in corpus | POST `/api/query {query}` | grounded `answer` with `[Source, Page]` citations + `citations[]` |
| A7 | Query — off corpus | POST `/api/query {query:"capital of France"}` | exactly `No verified information was found.` |
| A8 | Feedback | POST `/api/feedback {...}` | `{ok:true}` |
| A9 | CORS | fetch from Render origin | no CORS error |
| A10 | Latency | time A6 | answer returns < ~15s |

## Suite B — Landing / Home page

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| B1 | Loads | open `/` | hero, search box, nav render; no console errors |
| B2 | Dynamic popular topics | inspect chips | topics come from live data (not hardcoded demo) |
| B3 | Popular topic click | click a chip | populates search / runs query |
| B4 | Department cards | scroll to services | real department names, clickable |
| B5 | Schemes list | scroll | real scheme names shown |
| B6 | Nav — Explore | click Explore | routes to Explore view |
| B7 | Nav — Home | click Home from Explore | routes back |
| B8 | Language toggle EN/TA | click தமிழ் | UI/content switches where bilingual data exists |
| B9 | "Open knowledge map" link | click | opens Explore |
| B10 | Responsive (mobile) | resize 375px | layout stacks, no horizontal scroll |

## Suite C — Conversational query

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| C1 | Ask via button | type + Ask | answer turn appears |
| C2 | Enter-to-send | type + Enter | submits query |
| C3 | Grounded answer | ask in-corpus Q | answer text + citation chips `[Source, Page]` |
| C4 | Citation chip click | click a chip | source overlay opens with passage/document |
| C5 | Refusal | ask off-corpus Q | "No verified information was found." |
| C6 | Feedback buttons | click 👍/👎 | acknowledged (no error) |
| C7 | Multi-turn scroll | ask 2nd Q | scrolls to newest, prior turns retained |
| C8 | Session 3D graph | after answers | cumulative graph renders + grows |
| C9 | Empty state | before first Q | empty-chat prompt shown |
| C10 | Mobile chat | 375px, ask | chat visible, graph not eating screen |

## Suite D — Explore visualization

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| D1 | Map default | open Explore | 3D graph loads; backbone (root/hubs/depts) visible; Map active |
| D2 | Expand node | click a department | children appear |
| D3 | Collapse node | click expanded node again | children hide |
| D4 | Focus mode | click Focus, click node | shows node + immediate neighbours only |
| D5 | Focus re-focus | click a neighbour | recenters on it |
| D6 | Overview sunburst | click Overview | SVG sunburst renders (dept wedges + children) |
| D7 | Sunburst wedge → Map | click a wedge | switches to Map, node revealed + flown-to |
| D8 | Reset | expand nodes, click Reset | returns to backbone-only view |
| D9 | Search | type a topic + Enter | reveals/focuses matching node |
| D10 | Toggle: show documents | check box | document nodes appear |
| D11 | Toggle: include unreviewed | check box | pending nodes appear |
| D12 | Node drawer | click node | drawer opens with detail + neighbours + citations |
| D13 | Legend | inspect | colour legend + expand hint shown |
| D14 | Mode switch stability | Map↔Focus↔Overview repeatedly | no stale canvas / crash |
| D15 | Mobile Explore | 375px | toolbar wraps, graph usable, drawer bottom-sheet |

## Suite E — Cross-cutting

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| E1 | Console errors | monitor throughout | no uncaught JS errors |
| E2 | Network failures | monitor XHR | API calls 200; no 4xx/5xx |
| E3 | Data quality | inspect node titles | no "Unknown"/garbled/mojibake titles |
| E4 | Grounding integrity | C3 vs C5 | answers only from corpus; off-corpus refused |
| E5 | Performance | observe | pages interactive < ~3s; graph < ~5s |
