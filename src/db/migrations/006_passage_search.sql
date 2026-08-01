-- ============================================================================
-- WikiGov migration 006 — content-first passage retrieval
-- Adds full-text search over the FULL document text (not just the one evidence
-- passage per doc), gated to APPROVED content. This is what lets the RAG answer
-- open-domain topic questions "from the documents".
-- ============================================================================
BEGIN;

-- Link each document to the topic node it produced, so passages can be gated by
-- that node's approval status. Plain TEXT (soft ref) — the document is inserted
-- before the node in a transaction, so no FK ordering constraint.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS node_id TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_node ON documents(node_id);

-- Ranked full-text search over approved passages across ALL sources.
CREATE OR REPLACE FUNCTION search_passages(query_text TEXT, match_count INT DEFAULT 8)
RETURNS TABLE (
    passage_id        TEXT,
    text_content      TEXT,
    page_number       INT,
    section_label     VARCHAR(100),
    document_title    VARCHAR(512),
    issuing_authority VARCHAR(255),
    node_id           TEXT,
    node_type         VARCHAR(100),
    node_title        VARCHAR(255),
    rank              REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id::TEXT,
        p.text_content,
        p.page_number,
        p.section_label,
        dv.title,
        d.issuing_authority,
        n.id::TEXT,
        n.type,
        nv.title_en,
        ts_rank(to_tsvector('english', p.text_content),
                websearch_to_tsquery('english', query_text)) AS rank
    FROM passages p
    JOIN document_versions dv ON dv.id = p.version_id
    JOIN documents d          ON d.id  = dv.document_id
    JOIN nodes n              ON n.id  = d.node_id
    -- only surface passages whose topic node is approved + current
    JOIN LATERAL (
        SELECT v.title_en
        FROM node_versions v
        WHERE v.node_id = n.id AND v.status = 'approved' AND v.valid_to IS NULL
        ORDER BY v.valid_from DESC
        LIMIT 1
    ) nv ON TRUE
    WHERE to_tsvector('english', p.text_content) @@ websearch_to_tsquery('english', query_text)
    ORDER BY rank DESC
    LIMIT match_count;
$$;

COMMIT;
