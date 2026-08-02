-- ============================================================================
-- WikiGov migration 010 — semantic retrieval (pgvector)
-- Adds embeddings to passages + node versions so retrieval works on meaning
-- (natural-language + Tamil), and enables similarity-based entity dedup.
--
-- Dimension 2048 = nvidia/llama-3.2-nv-embedqa-1b-v2 (hosted on NVIDIA, multilingual
-- incl. Tamil). If you use a different embedding model, change vector(2048) to its
-- dimension (a mismatch shows up as an insert error stating the expected size).
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE passages      ADD COLUMN IF NOT EXISTS embedding vector(2048);
ALTER TABLE node_versions ADD COLUMN IF NOT EXISTS embedding vector(2048);

-- ANN indexes (cosine). HNSW = fast, good recall.
CREATE INDEX IF NOT EXISTS idx_passages_embedding
    ON passages USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_node_versions_embedding
    ON node_versions USING hnsw (embedding vector_cosine_ops);

-- Semantic passage search over approved content. The embedding is passed as a
-- JSON-array TEXT (e.g. '[0.1,0.2,...]') and cast to vector — avoids needing a
-- vector-aware client in the Worker.
CREATE OR REPLACE FUNCTION match_passages(query_embedding TEXT, match_count INT DEFAULT 8)
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
    similarity        REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id::TEXT, p.text_content, p.page_number, p.section_label,
        dv.title, d.issuing_authority, n.id::TEXT, n.type, nv.title_en,
        (1 - (p.embedding <=> query_embedding::vector))::REAL AS similarity
    FROM passages p
    JOIN document_versions dv ON dv.id = p.version_id
    JOIN documents d          ON d.id  = dv.document_id
    JOIN nodes n              ON n.id  = d.node_id
    JOIN LATERAL (
        SELECT v.title_en FROM node_versions v
        WHERE v.node_id = n.id AND v.status = 'approved' AND v.valid_to IS NULL
        ORDER BY v.valid_from DESC LIMIT 1
    ) nv ON TRUE
    WHERE p.embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding::vector
    LIMIT match_count;
$$;

-- Dedup helper: the most similar current node of a given type to an embedding.
CREATE OR REPLACE FUNCTION match_similar_node(p_type TEXT, query_embedding TEXT)
RETURNS TABLE (node_id TEXT, similarity REAL)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT n.id::TEXT, (1 - (nv.embedding <=> query_embedding::vector))::REAL AS similarity
    FROM nodes n
    JOIN node_versions nv ON nv.node_id = n.id AND nv.valid_to IS NULL
    WHERE n.type = p_type AND nv.embedding IS NOT NULL
    ORDER BY nv.embedding <=> query_embedding::vector
    LIMIT 1;
$$;

COMMIT;
