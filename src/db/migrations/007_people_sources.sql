-- ============================================================================
-- WikiGov migration 007 — people sources (ministers, MLAs)
-- Registers the Council of Ministers source used by the custom people adapter
-- (services/ingest/ministers.py). Idempotent.
-- ============================================================================
BEGIN;

INSERT INTO sources (source_key, domain, authority_class, department, crawl_cadence, base_url, list_path, artifact_types)
VALUES
  ('tn-ministers', 'tn.gov.in', 'B', 'Government of Tamil Nadu', 'monthly',
   'https://www.tn.gov.in', '/minister_list.php', ARRAY['html'])
ON CONFLICT (source_key) DO UPDATE SET
  authority_class = EXCLUDED.authority_class,
  department      = EXCLUDED.department,
  crawl_cadence   = EXCLUDED.crawl_cadence,
  base_url        = EXCLUDED.base_url,
  list_path       = EXCLUDED.list_path,
  artifact_types  = EXCLUDED.artifact_types;

COMMIT;
