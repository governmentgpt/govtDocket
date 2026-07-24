-- WikiGov Compiled Sync Script
-- Generated on: 2026-07-22T03:46:59.571Z
BEGIN;

-- Disable triggers during sync if needed

INSERT INTO documents (id, original_url, doc_type, issuing_authority) VALUES ('42045c7c-f22b-4337-8406-a783cfb76acd', 'https://www.tn.gov.in/go_ms_118', 'Government Order', 'Social Welfare and Women Empowerment Department') ON CONFLICT (id) DO UPDATE SET original_url = EXCLUDED.original_url, doc_type = EXCLUDED.doc_type, issuing_authority = EXCLUDED.issuing_authority;
INSERT INTO document_versions (id, document_id, version_number, title, effective_date, sha256_hash) VALUES ('919604a0-ffe1-4cff-993f-eb7cd6c90c4a', '42045c7c-f22b-4337-8406-a783cfb76acd', 1, 'Kalaignar Magalir Urimai Thittam - Guidelines', '2026-07-14', 'f2b187b63fabdf4edddc5f56de9084ec90ebca64c1fe74eec8060356c32a13a4') ON CONFLICT (document_id, version_number) DO UPDATE SET title = EXCLUDED.title, effective_date = EXCLUDED.effective_date, sha256_hash = EXCLUDED.sha256_hash;
INSERT INTO passages (id, version_id, page_number, section_label, text_content) VALUES ('4439b5d2-f6f2-446a-b54b-725557b2fc08', '919604a0-ffe1-4cff-993f-eb7cd6c90c4a', 1, 'Header Info', 'GOVERNMENT OF TAMIL NADU
Social Welfare and Women Empowerment Department
G.O. (Ms) No. 118, Dated 14.07.2026

SUBJECT: Implementation of Kalaignar Magalir Urimai Thittam - Release of basic guidelines for eligibility.
ORDER:
The Government of Tamil Nadu hereby registers the basic guidelines for the Kalaignar Magalir Urimai Thittam scheme.') ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content, section_label = EXCLUDED.section_label;
INSERT INTO passages (id, version_id, page_number, section_label, text_content) VALUES ('b0fafd8c-dfa5-4569-ab13-e60ad28d2d64', '919604a0-ffe1-4cff-993f-eb7cd6c90c4a', 2, 'Page 1', '1: The scheme provides a monthly financial support of Rs. 1,000 to eligible women heads of households.') ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content, section_label = EXCLUDED.section_label;
INSERT INTO passages (id, version_id, page_number, section_label, text_content) VALUES ('b664dba1-c99b-4fe6-8e38-778b1471fd3c', '919604a0-ffe1-4cff-993f-eb7cd6c90c4a', 3, 'Page 2', '2: Eligible applicants must be women who are permanent residents of Tamil Nadu, above 21 years of age, and whose annual household income is below Rs. 2.5 Lakhs.') ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content, section_label = EXCLUDED.section_label;
INSERT INTO passages (id, version_id, page_number, section_label, text_content) VALUES ('f22a3184-2673-43b0-8248-b70455e0ad5d', '919604a0-ffe1-4cff-993f-eb7cd6c90c4a', 4, 'Page 3', '3: Applications must be submitted through the designated registration camps. Required documents include Aadhaar Card, Smart Family Card, and Income Certificate.') ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content, section_label = EXCLUDED.section_label;
INSERT INTO nodes (id, type) VALUES ('dept-social-welfare', 'department') ON CONFLICT (id) DO NOTHING;
UPDATE node_versions SET valid_to = CURRENT_TIMESTAMP WHERE node_id = 'dept-social-welfare' AND status = 'approved' AND valid_to IS NULL;
INSERT INTO node_versions (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from) VALUES ('dept-social-welfare', 'Social Welfare and Women Empowerment', 'சமூக நலன் மற்றும் மகளிர் உரிமைத் துறை', 'State department responsible for social assistance and women empowerment.', 'சமூக உதவி மற்றும் மகளிர் மேம்பாட்டிற்கு பொறுப்பான அரசுத் துறை.', ARRAY['Responsible for Kalaignar Magalir scheme implementation.'], ARRAY['கலைஞர் மகளிர் உரிமைத் திட்டத்தை செயல்படுத்துவதற்குப் பொறுப்பானது.'], 'approved', '2026-07-14T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO node_aliases (node_id, alias, language) VALUES ('dept-social-welfare', 'Social Welfare Department', 'EN') ON CONFLICT (node_id, alias, language) DO NOTHING;
INSERT INTO node_aliases (node_id, alias, language) VALUES ('dept-social-welfare', 'சமூக நலத்துறை', 'TA') ON CONFLICT (node_id, alias, language) DO NOTHING;
INSERT INTO nodes (id, type) VALUES ('widow-pension-scheme', 'scheme') ON CONFLICT (id) DO NOTHING;
UPDATE node_versions SET valid_to = CURRENT_TIMESTAMP WHERE node_id = 'widow-pension-scheme' AND status = 'approved' AND valid_to IS NULL;
INSERT INTO node_versions (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from) VALUES ('widow-pension-scheme', 'Kalaignar Magalir Urimai Thittam', 'கலைஞர் மகளிர் உரிமைத் திட்டம்', 'Monthly financial assistance of Rs. 1,000 for women heads of households.', 'குடும்பத் தலைவிகளுக்கு மாதம் ரூ. 1,000 நிதியுதவி வழங்கும் திட்டம்.', ARRAY['Monthly financial assistance of Rs. 1,000.','Annual household income must be under Rs. 2.5 Lakhs.','Age must be above 21 years.'], ARRAY['மாதாந்திர உதவித்தொகை ரூ. 1,000.','குடும்ப ஆண்டு வருமானம் ரூ. 2.5 லட்சத்திற்கு மிகாமல் இருக்க வேண்டும்.','வயது 21 நிரம்பியவராக இருக்க வேண்டும்.'], 'approved', '2026-07-14T00:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO node_aliases (node_id, alias, language) VALUES ('widow-pension-scheme', 'Kalaignar Magalir Scheme', 'EN') ON CONFLICT (node_id, alias, language) DO NOTHING;
INSERT INTO node_aliases (node_id, alias, language) VALUES ('widow-pension-scheme', 'Magalir Urimai Thittam', 'EN') ON CONFLICT (node_id, alias, language) DO NOTHING;
INSERT INTO node_aliases (node_id, alias, language) VALUES ('widow-pension-scheme', 'மகளிர் உரிமைத் திட்டம்', 'TA') ON CONFLICT (node_id, alias, language) DO NOTHING;
INSERT INTO edges (id, from_node_id, to_node_id, relationship_type) VALUES ('4fd5bf79-d087-414d-82cb-a39d76593d1d', 'widow-pension-scheme', 'dept-social-welfare', 'governed_by') ON CONFLICT (id) DO UPDATE SET relationship_type = EXCLUDED.relationship_type;
INSERT INTO edge_evidence (edge_id, passage_id, approved_by) VALUES ('4fd5bf79-d087-414d-82cb-a39d76593d1d', '4439b5d2-f6f2-446a-b54b-725557b2fc08', 'system-ingest-steward') ON CONFLICT (edge_id, passage_id) DO NOTHING;

COMMIT;