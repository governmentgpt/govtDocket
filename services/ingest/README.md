# WikiGov ingestion service

Scrapes the eight primary TN government sources (see
[`docs/DATA_SOURCES.md`](../../docs/DATA_SOURCES.md)), transforms them into the
graph model ([`docs/GRAPH_MODEL.md`](../../docs/GRAPH_MODEL.md)), and writes them
to Supabase as **`pending review`**. A steward approves before anything is
searchable. Nothing here auto-publishes.

## One-time setup

```bash
cd services/ingest
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium          # headless browser for JS-rendered pages
# system deps for OCR: tesseract (with Tamil), and poppler for scanned PDFs
#   macOS:  brew install tesseract tesseract-lang poppler
```

## Prepare the database (apply in Supabase SQL editor, in order)

1. `src/db/schema.sql`               — base schema + RPCs (if not already applied)
2. `src/db/migrations/002_ingestion.sql` — crawl state, artifact queue, source seed, language cols

## Run (manual — this is the first full pull)

```bash
export SUPABASE_DB_URL="postgresql://postgres:<pwd>@<host>:5432/postgres"   # service role
export OCR_LANGS="eng+tam"

# Full first-time pull of every source (discover + ingest):
python run.py --source all --mode all

# Or one section at a time, on its own cadence:
python run.py --source tn-go       --mode all     # weekly
python run.py --source tn-press    --mode all     # daily
python run.py --source tn-schemes  --mode all     # monthly
```

Modes: `discover` (fill the queue only) · `ingest` (process queued artifacts) ·
`all` (both). Re-running is safe and idempotent — the same command works for
periodic refreshes.

## Reset between test runs

To wipe everything ingested and start clean (schema + `sources` are preserved):

```sql
-- Supabase SQL editor
\i src/db/reset_ingested.sql
```

Then re-run `python run.py ...`.

## Calibration note

The sites are JS-rendered; discovery selectors are generic (collect content/PDF
links). Search `CALIBRATE` in `adapters.py` — on the first run, tighten those to
the live DOM (e.g. the exact GO-table row, the scheme-detail container) to cut
noise. The pipeline runs and stays governance-safe before calibration; tuning
only improves precision.
