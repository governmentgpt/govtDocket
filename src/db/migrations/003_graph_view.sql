-- ============================================================================
-- WikiGov migration 003 — full-graph view for the Explore (3D) tab
-- Idempotent. Returns the whole knowledge graph as { nodes, edges } JSON for the
-- visualiser. Respects governance: default returns only approved, current nodes;
-- 'pending' or 'all' are opt-in (used by the "Include unreviewed" toggle).
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION get_full_graph(p_status TEXT DEFAULT 'approved')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    WITH sel AS (
        -- latest current version per node, filtered by requested status
        SELECT n.id, n.type, nv.title_en, nv.title_ta, nv.summary_en, nv.status
        FROM nodes n
        JOIN LATERAL (
            SELECT v.*
            FROM node_versions v
            WHERE v.node_id = n.id
              AND v.valid_to IS NULL
              AND (
                    p_status = 'all'
                 OR (p_status = 'approved' AND v.status = 'approved')
                 OR (p_status = 'pending'  AND v.status = 'pending review')
              )
            ORDER BY v.valid_from DESC
            LIMIT 1
        ) nv ON TRUE
    ),
    e AS (
        SELECT ed.id, ed.from_node_id, ed.to_node_id, ed.relationship_type
        FROM edges ed
        WHERE ed.from_node_id IN (SELECT id FROM sel)
          AND ed.to_node_id   IN (SELECT id FROM sel)
    ),
    deg AS (
        SELECT s.id,
               (SELECT count(*) FROM e WHERE e.from_node_id = s.id OR e.to_node_id = s.id) AS degree
        FROM sel s
    )
    SELECT jsonb_build_object(
        'nodes', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id',       sel.id,
                'type',     sel.type,
                'title',    sel.title_en,
                'title_ta', sel.title_ta,
                'summary',  sel.summary_en,
                'status',   sel.status,
                'degree',   (SELECT degree FROM deg WHERE deg.id = sel.id)
            )) FROM sel), '[]'::jsonb),
        'edges', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id',           e.id,
                'from',         e.from_node_id,
                'to',           e.to_node_id,
                'relationship', e.relationship_type
            )) FROM e), '[]'::jsonb)
    ) INTO result;

    RETURN result;
END;
$$;

COMMIT;
