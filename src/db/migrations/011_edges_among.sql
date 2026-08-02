-- ============================================================================
-- WikiGov migration 011 — connect the answer graph
-- Returns all edges whose BOTH endpoints are in a given set of node ids, so the
-- conversation/knowledge map can wire up the retrieved nodes (not float them).
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION get_edges_among(node_ids TEXT[])
RETURNS TABLE (id TEXT, from_node_id TEXT, to_node_id TEXT, relationship_type VARCHAR(100))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.id::TEXT, e.from_node_id, e.to_node_id, e.relationship_type
    FROM edges e
    WHERE e.from_node_id = ANY(node_ids) AND e.to_node_id = ANY(node_ids);
$$;

COMMIT;
