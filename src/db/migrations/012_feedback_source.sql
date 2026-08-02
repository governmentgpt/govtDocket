-- ============================================================================
-- WikiGov migration 012 — feedback capture + source viewer
-- Adds a feedback table (+ anon-safe insert RPC) and extends the passage-search
-- RPCs to return the original document URL so citations can open the source.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS feedback (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query      TEXT,
    answer     TEXT,
    rating     VARCHAR(30),
    detail     TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION add_feedback(p_query TEXT, p_answer TEXT, p_rating TEXT, p_detail TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO feedback (query, answer, rating, detail)
    VALUES (left(p_query, 2000), left(p_answer, 8000), p_rating, left(p_detail, 2000));
$$;

-- Re-create the two passage-search functions with an added document_url column.
DROP FUNCTION IF EXISTS search_passages(TEXT, INT);
CREATE FUNCTION search_passages(query_text TEXT, match_count INT DEFAULT 8)
RETURNS TABLE (
    passage_id TEXT, text_content TEXT, page_number INT, section_label VARCHAR(100),
    document_title VARCHAR(512), issuing_authority VARCHAR(255), document_url TEXT,
    node_id TEXT, node_type VARCHAR(100), node_title VARCHAR(255), rank REAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT p.id::TEXT, p.text_content, p.page_number, p.section_label,
           dv.title, d.issuing_authority, d.original_url, n.id::TEXT, n.type, nv.title_en,
           ts_rank(to_tsvector('english', p.text_content), websearch_to_tsquery('english', query_text)) AS rank
    FROM passages p
    JOIN document_versions dv ON dv.id = p.version_id
    JOIN documents d          ON d.id  = dv.document_id
    JOIN nodes n              ON n.id  = d.node_id
    JOIN LATERAL (SELECT v.title_en FROM node_versions v
                  WHERE v.node_id = n.id AND v.status = 'approved' AND v.valid_to IS NULL
                  ORDER BY v.valid_from DESC LIMIT 1) nv ON TRUE
    WHERE to_tsvector('english', p.text_content) @@ websearch_to_tsquery('english', query_text)
    ORDER BY rank DESC LIMIT match_count;
$$;

DROP FUNCTION IF EXISTS match_passages(TEXT, INT);
CREATE FUNCTION match_passages(query_embedding TEXT, match_count INT DEFAULT 8)
RETURNS TABLE (
    passage_id TEXT, text_content TEXT, page_number INT, section_label VARCHAR(100),
    document_title VARCHAR(512), issuing_authority VARCHAR(255), document_url TEXT,
    node_id TEXT, node_type VARCHAR(100), node_title VARCHAR(255), similarity REAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT p.id::TEXT, p.text_content, p.page_number, p.section_label,
           dv.title, d.issuing_authority, d.original_url, n.id::TEXT, n.type, nv.title_en,
           (1 - (p.embedding <=> query_embedding::vector))::REAL AS similarity
    FROM passages p
    JOIN document_versions dv ON dv.id = p.version_id
    JOIN documents d          ON d.id  = dv.document_id
    JOIN nodes n              ON n.id  = d.node_id
    JOIN LATERAL (SELECT v.title_en FROM node_versions v
                  WHERE v.node_id = n.id AND v.status = 'approved' AND v.valid_to IS NULL
                  ORDER BY v.valid_from DESC LIMIT 1) nv ON TRUE
    WHERE p.embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding::vector LIMIT match_count;
$$;

COMMIT;
