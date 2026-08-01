-- ============================================================================
-- Reset ONE source's ingested data for a clean re-run (downstream included).
-- Replace BOTH occurrences of 'tn-assembly' with the source_key you want to reset.
--
-- documents FK-cascade to document_versions → passages → edge_evidence, so the
-- provenance chain clears itself; we then drop edges/nodes left with no evidence
-- (i.e. the ones that belonged only to this source) and finally the crawl queue.
--
-- NOTE: with the idempotent ingest (db.py get-or-create + version-replace) you
-- usually DON'T need this — just re-run `--mode ingest` and it replaces stale
-- content without dup-key errors. Use this only for a fully clean drop.
-- ============================================================================
BEGIN;

-- 1. Provenance chain (cascades to versions, passages, edge_evidence).
DELETE FROM documents
WHERE source_id = (SELECT id FROM sources WHERE source_key = 'tn-assembly');

-- 2. Edges with no remaining evidence (belonged only to the deleted source).
DELETE FROM edges
WHERE id NOT IN (SELECT edge_id FROM edge_evidence);

-- 3. Nodes no longer referenced by any edge (cascades node_versions + aliases).
DELETE FROM nodes
WHERE id NOT IN (
    SELECT from_node_id FROM edges
    UNION
    SELECT to_node_id   FROM edges
);

-- 4. Discovery queue for this source.
DELETE FROM discovered_artifacts
WHERE source_id = (SELECT id FROM sources WHERE source_key = 'tn-assembly');

COMMIT;
