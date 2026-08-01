-- Reset errored artifacts back to 'new' so ingestion retries them after fixes.
-- Run AFTER applying migrations/004_node_id_text.sql, then:
--   python services/ingest/run.py --source all --mode ingest
-- Targets only 'error' (never 're-ingests' already-'ingested' rows, which would
-- create duplicate documents).
UPDATE discovered_artifacts
SET status = 'new', error = NULL
WHERE status = 'error';
