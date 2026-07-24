-- WikiGov Database Schema (PostgreSQL for Supabase)
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Sources Registry
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    authority_class CHAR(1) NOT NULL CHECK (authority_class IN ('A', 'B', 'C', 'D', 'E', 'F')),
    department VARCHAR(255) NOT NULL,
    crawl_cadence VARCHAR(50) DEFAULT 'weekly',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crawl Captures
CREATE TABLE IF NOT EXISTS captures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    sha256_hash CHAR(64) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_url TEXT,
    doc_type VARCHAR(100) NOT NULL, -- 'Government Order', 'Act', 'Circular', 'Gazette'
    issuing_authority VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title VARCHAR(512) NOT NULL,
    capture_id UUID REFERENCES captures(id) ON DELETE SET NULL,
    effective_date DATE NOT NULL,
    valid_to DATE,
    sha256_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, version_number)
);

-- 5. Document Passages (granular chunks for citations)
CREATE TABLE IF NOT EXISTS passages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    section_label VARCHAR(100), -- e.g., 'Section 4(b)'
    text_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Nodes (Concepts)
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(100) NOT NULL -- 'scheme', 'department', 'event', 'eligibility', 'process'
);

-- 7. Node Versions (temporal/validity state)
CREATE TABLE IF NOT EXISTS node_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    title_en VARCHAR(255) NOT NULL,
    title_ta VARCHAR(255) NOT NULL,
    summary_en TEXT NOT NULL,
    summary_ta TEXT NOT NULL,
    details_en TEXT[] NOT NULL DEFAULT '{}',
    details_ta TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending review', 'approved', 'archived')),
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Node Aliases (Search targets in Tamil and English)
CREATE TABLE IF NOT EXISTS node_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    language CHAR(2) NOT NULL CHECK (language IN ('EN', 'TA')),
    UNIQUE (node_id, alias, language)
);

-- 9. Edges (Relationships)
CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- 'governed_by', 'requires', 'clarifies', etc.
    UNIQUE (from_node_id, to_node_id, relationship_type)
);

-- 10. Edge Evidence (provenance for relationships)
CREATE TABLE IF NOT EXISTS edge_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    edge_id UUID NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
    passage_id UUID NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
    approved_by VARCHAR(100) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (edge_id, passage_id)
);

-- 11. Audit logs
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- 'create_node', 'approve_edge', 'revert_version'
    target_table VARCHAR(100) NOT NULL,
    target_id UUID NOT NULL,
    changes JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEXES FOR SPEED AND VECTORLESS RETRIEVAL
-- ==========================================

-- A. Lexical index for typo-tolerant / autocomplete search
CREATE INDEX IF NOT EXISTS idx_node_aliases_trgm ON node_aliases USING gin (alias gin_trgm_ops);

-- B. Full-text search index on passages for RAG queries
CREATE INDEX IF NOT EXISTS idx_passages_fts ON passages USING gin (to_tsvector('english', text_content));

-- C. Foreign keys indexes for fast graph traversals
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges (from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges (to_node_id);
CREATE INDEX IF NOT EXISTS idx_node_versions_active ON node_versions (node_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_edge_evidence_edge ON edge_evidence (edge_id);

-- ========================================================
-- RPC FUNCTION 1: match_node_aliases
-- Trigram similarity search over node_aliases table.
-- Called by the RAG API as: supabase.rpc('match_node_aliases', { query_text })
-- Returns: node_id, alias, sim_score ordered by best match
-- ========================================================
CREATE OR REPLACE FUNCTION match_node_aliases(query_text TEXT)
RETURNS TABLE (
    node_id   TEXT,
    alias     VARCHAR(255),
    language  CHAR(2),
    sim_score REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        na.node_id::TEXT,
        na.alias,
        na.language,
        similarity(na.alias, query_text) AS sim_score
    FROM node_aliases na
    WHERE
        na.alias % query_text
        OR na.alias ILIKE '%' || query_text || '%'
    ORDER BY sim_score DESC
    LIMIT 5;
$$;

-- ========================================================
-- RPC FUNCTION 2: get_graph_rag_context
-- Performs a 2-hop recursive graph traversal from a root node,
-- then joins all associated evidence passages and node versions.
-- Called by the RAG API as: supabase.rpc('get_graph_rag_context', { root_node_id, hops_count })
-- Returns: flattened rows with node info, edge info, and passage citations
-- ========================================================
CREATE OR REPLACE FUNCTION get_graph_rag_context(
    root_node_id TEXT,
    hops_count   INT DEFAULT 2
)
RETURNS TABLE (
    -- Node fields
    node_id       TEXT,
    node_type     VARCHAR(100),
    node_title    VARCHAR(255),
    node_summary  TEXT,
    node_details  TEXT[],
    -- Edge fields
    edge_id       TEXT,
    from_node_id  TEXT,
    to_node_id    TEXT,
    relationship_type VARCHAR(100),
    -- Evidence fields
    passage_id    TEXT,
    text_content  TEXT,
    page_number   INT,
    section_label VARCHAR(100),
    document_title VARCHAR(512),
    issuing_authority VARCHAR(255)
)
LANGUAGE sql
STABLE
AS $$
    WITH RECURSIVE graph_hops AS (
        -- Anchor: start from root node direct edges
        SELECT
            e.id       AS edge_id,
            e.from_node_id::TEXT,
            e.to_node_id::TEXT,
            e.relationship_type,
            1 AS depth
        FROM edges e
        WHERE e.from_node_id::TEXT = root_node_id

        UNION

        -- Recursive: walk outward up to hops_count hops
        SELECT
            e.id,
            e.from_node_id::TEXT,
            e.to_node_id::TEXT,
            e.relationship_type,
            gh.depth + 1
        FROM edges e
        INNER JOIN graph_hops gh ON e.from_node_id::TEXT = gh.to_node_id
        WHERE gh.depth < hops_count
    ),
    -- Include the root node itself as a virtual "self-edge" so it appears in results
    all_node_ids AS (
        SELECT root_node_id AS nid
        UNION
        SELECT from_node_id FROM graph_hops
        UNION
        SELECT to_node_id   FROM graph_hops
    )
    SELECT
        n.id::TEXT                        AS node_id,
        n.type                            AS node_type,
        nv.title_en                       AS node_title,
        nv.summary_en                     AS node_summary,
        nv.details_en                     AS node_details,
        gh.edge_id::TEXT,
        gh.from_node_id,
        gh.to_node_id,
        gh.relationship_type,
        p.id::TEXT                        AS passage_id,
        p.text_content,
        p.page_number,
        p.section_label,
        dv.title                          AS document_title,
        d.issuing_authority
    FROM all_node_ids ani
    JOIN nodes n
        ON n.id::TEXT = ani.nid
    -- Get the most recent approved version of each node
    JOIN LATERAL (
        SELECT *
        FROM node_versions nv2
        WHERE nv2.node_id = n.id
          AND nv2.status = 'approved'
          AND nv2.valid_to IS NULL
        ORDER BY nv2.valid_from DESC
        LIMIT 1
    ) nv ON TRUE
    -- Left join edges (root node has no outbound edge row)
    LEFT JOIN graph_hops gh
        ON gh.from_node_id = n.id::TEXT OR gh.to_node_id = n.id::TEXT
    -- Left join passage evidence via edge_evidence
    LEFT JOIN edge_evidence ee
        ON ee.edge_id = gh.edge_id
    LEFT JOIN passages p
        ON p.id = ee.passage_id
    LEFT JOIN document_versions dv
        ON dv.id = p.version_id
    LEFT JOIN documents d
        ON d.id = dv.document_id;
$$;

