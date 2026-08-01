-- ============================================================================
-- WikiGov migration 005 — read RPCs run as owner (SECURITY DEFINER)
-- The Worker reads via the anon key (role `anon`). With RLS enabled on the
-- graph tables, anon sees zero rows, so get_full_graph / the query RPCs returned
-- empty even though the data exists (the SQL editor, a privileged role, sees it).
--
-- Making these read-only functions SECURITY DEFINER runs them as the owner,
-- bypassing RLS — the controlled, correct way to expose public data through
-- vetted functions while keeping the tables themselves locked to anon.
-- `SET search_path = public` is the required safety pin for SECURITY DEFINER.
-- ============================================================================
BEGIN;

ALTER FUNCTION get_full_graph(text)                 SECURITY DEFINER SET search_path = public;
ALTER FUNCTION match_node_aliases(text)             SECURITY DEFINER SET search_path = public;
ALTER FUNCTION get_graph_rag_context(text, integer) SECURITY DEFINER SET search_path = public;

COMMIT;
