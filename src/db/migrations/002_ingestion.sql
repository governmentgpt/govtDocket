-- ============================================================================
-- WikiGov migration 002 — ingestion support
-- Idempotent. Run AFTER src/db/schema.sql. Extends the base schema for
-- multi-source scraping (crawl state, artifact queue, source registry, language).
-- ============================================================================
BEGIN;

-- 1. Sources: allow multiple paths per host; add a stable natural key + config.
--    The base schema declares domain UNIQUE, which blocks the five tn.gov.in
--    paths — drop it and key sources by source_key instead.
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_domain_key;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_key     VARCHAR(64);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS base_url       TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS list_path      TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS artifact_types TEXT[] DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_source_key ON sources(source_key);

-- 2. Documents: link back to the originating source + capture language.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS lang      CHAR(2) DEFAULT 'EN';

-- 3. Passages: language tag for EN/TA retrieval.
ALTER TABLE passages ADD COLUMN IF NOT EXISTS language CHAR(2) DEFAULT 'EN';

-- 4. Nodes: audit timestamp.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 5. Crawl state — per source/path incremental cursor for cheap re-runs.
CREATE TABLE IF NOT EXISTS crawl_state (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id         UUID REFERENCES sources(id) ON DELETE CASCADE,
    path              TEXT NOT NULL,
    last_crawled_at   TIMESTAMPTZ,
    last_content_hash CHAR(64),
    cursor            JSONB DEFAULT '{}'::jsonb,
    status            VARCHAR(30) DEFAULT 'idle',
    UNIQUE (source_id, path)
);

-- 6. Discovered artifacts — the crawl → fetch → parse → ingest work queue.
CREATE TABLE IF NOT EXISTS discovered_artifacts (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id      UUID REFERENCES sources(id) ON DELETE CASCADE,
    source_url     TEXT NOT NULL UNIQUE,
    artifact_type  VARCHAR(20) NOT NULL,          -- pdf | image | html | excel
    title          TEXT,
    published_date DATE,
    language       CHAR(2) DEFAULT 'EN',
    sha256         CHAR(64),
    storage_path   TEXT,
    status         VARCHAR(20) DEFAULT 'new',      -- new|fetched|parsed|ingested|error
    error          TEXT,
    meta           JSONB DEFAULT '{}'::jsonb,
    discovered_at  TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discovered_status ON discovered_artifacts(status);
CREATE INDEX IF NOT EXISTS idx_discovered_source ON discovered_artifacts(source_id);

-- 7. Seed the eight primary TN sources (see docs/DATA_SOURCES.md).
INSERT INTO sources (source_key, domain, authority_class, department, crawl_cadence, base_url, list_path, artifact_types)
VALUES
  ('tn-whatsnew',   'tn.gov.in',                    'B','Government of Tamil Nadu',        'daily',     'https://www.tn.gov.in',            '/whatsnew.php',       ARRAY['html']),
  ('tn-go',         'tn.gov.in',                    'A','All Departments',                 'weekly',    'https://www.tn.gov.in',            '/godept_list.php',    ARRAY['pdf']),
  ('tn-schemes',    'tn.gov.in',                    'B','All Departments',                 'monthly',   'https://www.tn.gov.in',            '/schemes.php',        ARRAY['html']),
  ('tn-departments','tn.gov.in',                    'B','All Departments',                 'monthly',   'https://www.tn.gov.in',            '/department_list.php',ARRAY['html']),
  ('tn-press',      'tn.gov.in',                    'D','Information and Public Relations', 'daily',     'https://www.tn.gov.in',            '/press_release.php',  ARRAY['pdf','image']),
  ('tn-assembly',   'assembly.tn.gov.in',           'A','Legislative Assembly',            'monthly',   'https://www.assembly.tn.gov.in',   '/',                   ARRAY['html','pdf']),
  ('tn-gazette',    'stationeryprinting.tn.gov.in', 'A','Stationery and Printing',         'weekly',    'https://stationeryprinting.tn.gov.in','/home.php',        ARRAY['pdf']),
  ('tn-finance',    'financedept.tn.gov.in',        'B','Finance',                         'quarterly', 'https://financedept.tn.gov.in',    '/en/',                ARRAY['pdf','excel'])
ON CONFLICT (source_key) DO UPDATE SET
  authority_class = EXCLUDED.authority_class,
  department      = EXCLUDED.department,
  crawl_cadence   = EXCLUDED.crawl_cadence,
  base_url        = EXCLUDED.base_url,
  list_path       = EXCLUDED.list_path,
  artifact_types  = EXCLUDED.artifact_types;

COMMIT;
