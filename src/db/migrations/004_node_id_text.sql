-- ============================================================================
-- WikiGov migration 004 — node ids are TEXT slugs, not UUIDs
-- The base schema mistyped node ids as UUID, but the app, git_storage, the RPCs
-- (which cast n.id::TEXT), and the ingestion service all use human-readable
-- slugs like 'widow-pension-scheme'. This aligns the column types so inserts
-- stop failing with: invalid input syntax for type uuid: "order-...".
--
-- Safe to run on an empty graph. Apply in the Supabase SQL editor.
-- ============================================================================
BEGIN;

-- Drop FKs that depend on the node id type.
ALTER TABLE node_versions DROP CONSTRAINT IF EXISTS node_versions_node_id_fkey;
ALTER TABLE node_aliases  DROP CONSTRAINT IF EXISTS node_aliases_node_id_fkey;
ALTER TABLE edges         DROP CONSTRAINT IF EXISTS edges_from_node_id_fkey;
ALTER TABLE edges         DROP CONSTRAINT IF EXISTS edges_to_node_id_fkey;

-- Convert the id columns UUID -> TEXT.
ALTER TABLE nodes         ALTER COLUMN id DROP DEFAULT;
ALTER TABLE nodes         ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE node_versions ALTER COLUMN node_id TYPE TEXT USING node_id::text;
ALTER TABLE node_aliases  ALTER COLUMN node_id TYPE TEXT USING node_id::text;
ALTER TABLE edges         ALTER COLUMN from_node_id TYPE TEXT USING from_node_id::text;
ALTER TABLE edges         ALTER COLUMN to_node_id   TYPE TEXT USING to_node_id::text;

-- Re-create the FKs against the new TEXT type.
ALTER TABLE node_versions ADD CONSTRAINT node_versions_node_id_fkey
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE;
ALTER TABLE node_aliases  ADD CONSTRAINT node_aliases_node_id_fkey
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE;
ALTER TABLE edges         ADD CONSTRAINT edges_from_node_id_fkey
    FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE;
ALTER TABLE edges         ADD CONSTRAINT edges_to_node_id_fkey
    FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE;

COMMIT;
