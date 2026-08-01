-- ============================================================================
-- WikiGov — clear all ingested data (repeatable test reset)
-- Wipes the knowledge graph, provenance, and crawl queue so you can re-run the
-- scraping + ingestion job from a clean slate. PRESERVES the schema and the
-- `sources` registry (seeded by migrations/002_ingestion.sql).
--
-- Apply in the Supabase SQL editor whenever you want a fresh ingestion test.
-- ============================================================================
BEGIN;

TRUNCATE TABLE
    edge_evidence,
    edges,
    node_aliases,
    node_versions,
    nodes,
    passages,
    document_versions,
    documents,
    captures,
    discovered_artifacts,
    crawl_state,
    audit_events
RESTART IDENTITY CASCADE;

-- Reset crawl cursors on the retained sources (belt-and-suspenders; crawl_state
-- was truncated above, but keep this explicit for clarity).
-- sources rows are intentionally NOT truncated.

COMMIT;

-- After a reset, the sources registry remains. Re-run the scraper to repopulate.
