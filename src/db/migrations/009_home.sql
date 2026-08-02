-- ============================================================================
-- WikiGov migration 009 — landing page data in one lightweight call
-- get_home_data() returns { departments, schemes, recent } from the approved
-- graph so the home page renders from real data with a single request.
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION get_home_data(scheme_limit INT DEFAULT 8, recent_limit INT DEFAULT 6)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    WITH approved_nodes AS (
        SELECT n.id, n.type, nv.title_en
        FROM nodes n
        JOIN LATERAL (
            SELECT v.title_en
            FROM node_versions v
            WHERE v.node_id = n.id AND v.status = 'approved' AND v.valid_to IS NULL
            ORDER BY v.valid_from DESC LIMIT 1
        ) nv ON TRUE
    ),
    depts AS (
        SELECT id, title_en FROM approved_nodes WHERE type = 'department' ORDER BY title_en
    ),
    schemes AS (
        SELECT an.id, an.title_en,
            (SELECT dn.title_en
             FROM edges e JOIN approved_nodes dn ON dn.id = e.to_node_id
             WHERE e.from_node_id = an.id AND e.relationship_type = 'governed_by'
             LIMIT 1) AS dept
        FROM approved_nodes an
        WHERE an.type = 'scheme'
        ORDER BY an.title_en
        LIMIT scheme_limit
    ),
    recent AS (
        SELECT dv.title, d.doc_type, d.issuing_authority, dv.effective_date, d.original_url
        FROM documents d
        JOIN document_versions dv ON dv.document_id = d.id
        JOIN approved_nodes an ON an.id = d.node_id
        ORDER BY dv.effective_date DESC NULLS LAST
        LIMIT recent_limit
    )
    SELECT jsonb_build_object(
        'departments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title_en)) FROM depts), '[]'::jsonb),
        'schemes',     COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title_en, 'department', dept)) FROM schemes), '[]'::jsonb),
        'recent',      COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'title', title, 'doc_type', doc_type, 'authority', issuing_authority,
                            'date', effective_date, 'url', original_url)) FROM recent), '[]'::jsonb)
    ) INTO result;

    RETURN result;
END;
$$;

COMMIT;
