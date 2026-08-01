-- ============================================================================
-- WikiGov migration 008 — graph backbone (root + hubs)
-- Anchors the department-centric map: a root "Government of Tamil Nadu" and two
-- parallel hubs (Council of Ministers, Legislative Assembly). Departments link
-- part_of the root; ministers member_of the council. Seeded as APPROVED so the
-- backbone always renders. Idempotent.
-- ============================================================================
BEGIN;

INSERT INTO nodes (id, type) VALUES
  ('root-tn-government',        'root'),
  ('hub-council-of-ministers',  'hub'),
  ('hub-legislative-assembly',  'hub')
ON CONFLICT (id) DO NOTHING;

INSERT INTO node_versions
  (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from)
VALUES
  ('root-tn-government', 'Government of Tamil Nadu', 'தமிழ்நாடு அரசு',
   'Root of the Tamil Nadu knowledge graph — all departments branch from here.',
   'தமிழ்நாடு அறிவுத் தொகுப்பின் மூலம்.', ARRAY['Root node'], ARRAY['மூல முனை'], 'approved', now()),
  ('hub-council-of-ministers', 'Council of Ministers', 'அமைச்சரவை',
   'The Council of Ministers of Tamil Nadu.', 'தமிழ்நாடு அமைச்சரவை.',
   ARRAY['Ministers hub'], ARRAY['அமைச்சர்கள்'], 'approved', now()),
  ('hub-legislative-assembly', 'Tamil Nadu Legislative Assembly', 'தமிழ்நாடு சட்டமன்றப் பேரவை',
   'The Legislative Assembly of Tamil Nadu.', 'தமிழ்நாடு சட்டமன்றப் பேரவை.',
   ARRAY['Assembly hub'], ARRAY['சட்டமன்றம்'], 'approved', now())
ON CONFLICT DO NOTHING;

INSERT INTO edges (id, from_node_id, to_node_id, relationship_type) VALUES
  (uuid_generate_v4(), 'hub-council-of-ministers', 'root-tn-government', 'part_of'),
  (uuid_generate_v4(), 'hub-legislative-assembly',  'root-tn-government', 'part_of')
ON CONFLICT (from_node_id, to_node_id, relationship_type) DO NOTHING;

COMMIT;
