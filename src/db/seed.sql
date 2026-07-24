-- WikiGov Seed Data (PostgreSQL for Supabase)
-- To be run after schema.sql is executed

BEGIN;

-- 1. Insert Core Source
INSERT INTO sources (id, domain, authority_class, department, crawl_cadence, is_active)
VALUES (
    'a4d538f5-93df-498c-85a2-944d6db8a2bf',
    'https://www.tn.gov.in',
    'A',
    'Social Welfare and Women Empowerment Department',
    'weekly',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert Ingestion Capture
INSERT INTO captures (id, source_id, original_url, storage_path, sha256_hash, mime_type, fetched_at)
VALUES (
    'c25e839e-2bbd-41a4-b0db-b27bcfb9264a',
    'a4d538f5-93df-498c-85a2-944d6db8a2bf',
    'https://www.tn.gov.in/go_ms_118',
    'raw_captures/go_ms_118.txt',
    'f2b187b6a12bd0c4959db27bcfb9264a1234567890abcdef1234567890abcdef',
    'text/plain',
    '2026-07-22 09:00:00+05:30'
) ON CONFLICT (id) DO NOTHING;

-- 3. Insert Document metadata
INSERT INTO documents (id, original_url, doc_type, issuing_authority)
VALUES (
    'd81e3a1f-13fb-464a-9ef8-13fe05cb8f8b',
    'https://www.tn.gov.in/go_ms_118',
    'Government Order',
    'Social Welfare and Women Empowerment Department'
) ON CONFLICT (id) DO NOTHING;

-- 4. Insert Document Version
INSERT INTO document_versions (id, document_id, version_number, title, capture_id, effective_date, valid_to, sha256_hash)
VALUES (
    'v83df02a-3bcf-46d2-a7cf-cf019385bfcb',
    'd81e3a1f-13fb-464a-9ef8-13fe05cb8f8b',
    1,
    'G.O. (Ms) No. 118: Implementation guidelines for Kalaignar Magalir Urimai Thittam',
    'c25e839e-2bbd-41a4-b0db-b27bcfb9264a',
    '2026-07-14',
    NULL,
    'f2b187b6a12bd0c4959db27bcfb9264a1234567890abcdef1234567890abcdef'
) ON CONFLICT (id) DO NOTHING;

-- 5. Insert Document Passages (Page-granular citations)
INSERT INTO passages (id, version_id, page_number, section_label, text_content)
VALUES 
(
    'p89df10a-3456-4b2a-89a1-7cf019283fba',
    'v83df02a-3bcf-46d2-a7cf-cf019385bfcb',
    1,
    'Page 1: Scope',
    'The scheme provides a monthly financial support of Rs. 1,000 to eligible women heads of households in Tamil Nadu.'
),
(
    'p89df10b-3456-4b2a-89a1-7cf019283fbb',
    'v83df02a-3bcf-46d2-a7cf-cf019385bfcb',
    2,
    'Page 2: Eligibility criteria',
    'Eligible applicants must be women who are permanent residents of Tamil Nadu, above 21 years of age, and whose annual household income is below Rs. 2.5 Lakhs.'
),
(
    'p89df10c-3456-4b2a-89a1-7cf019283fbc',
    'v83df02a-3bcf-46d2-a7cf-cf019385bfcb',
    3,
    'Page 3: Required documents',
    'Applications must be submitted through designated registration camps. Required documents include Aadhaar Card, Smart Family Card, and Income Certificate.'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Concept Nodes
INSERT INTO nodes (id, type)
VALUES 
    ('widow-pension-scheme', 'scheme'),
    ('dept-social-welfare', 'department')
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Node Versions
INSERT INTO node_versions (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from)
VALUES 
(
    'widow-pension-scheme',
    'Kalaignar Magalir Urimai Thittam',
    'கலைஞர் மகளிர் உரிமைத் திட்டம்',
    'This scheme provides monthly financial assistance of Rs. 1,000 to eligible women heads of households in Tamil Nadu, governed by G.O. (Ms) No. 118.',
    'குடும்பத் தலைவிகளுக்கு மாதம் ரூ. 1,000 நிதியுதவி வழங்கும் திட்டம். இது அரசாணை எண் 118-ன் கீழ் செயல்படுகிறது.',
    ARRAY[
        'Must be a permanent resident of Tamil Nadu.',
        'Must be above 21 years of age.',
        'Annual household income must be below Rs. 2.5 Lakhs.',
        'Required documents: Aadhaar Card, Smart Family Card, Income Certificate.'
    ],
    ARRAY[
        'தமிழ்நாட்டின் நிரந்தர குடியிருப்பாளராக இருக்க வேண்டும்.',
        'வயது 21 நிரம்பியவராக இருக்க வேண்டும்.',
        'குடும்ப ஆண்டு வருமானம் ரூ. 2.5 லட்சத்திற்கு மிகாமல் இருக்க வேண்டும்.',
        'தேவையான ஆவணங்கள்: ஆதார் அட்டை, ஸ்மார்ட் குடும்ப அட்டை, வருமானச் சான்றிதழ்.'
    ],
    'approved',
    '2026-07-14 00:00:00+05:30'
),
(
    'dept-social-welfare',
    'Social Welfare & Women Empowerment Dept',
    'சமூக நலன் மற்றும் மகளிர் உரிமைத் துறை',
    'State department responsible for formulating policies and guidelines for social assistance, women empowerment, and managing schemes like Kalaignar Magalir Urimai Thittam.',
    'சமூக உதவி, மகளிர் மேம்பாடு மற்றும் கலைஞர் மகளிர் உரிமைத் திட்டம் போன்ற திட்டங்களை நிர்வகிக்கும் அரசுத் துறை.',
    ARRAY[
        'Responsible for scheme guidelines publishing.',
        'Manages registration camps and application validation queues.'
    ],
    ARRAY[
        'திட்ட வழிகாட்டுதல்களை வெளியிடுவதற்கு பொறுப்பானது.',
        'பதிவு முகாம்கள் மற்றும் விண்ணப்ப சரிபார்ப்பு வரிசைகளை நிர்வகிக்கிறது.'
    ],
    'approved',
    '2026-07-14 00:00:00+05:30'
)
ON CONFLICT (node_id, status) DO NOTHING; -- (Note: To keep this simple we avoid version collision)

-- 8. Insert Node Aliases (Trigram search hooks)
INSERT INTO node_aliases (node_id, alias, language)
VALUES 
    ('widow-pension-scheme', 'pension', 'EN'),
    ('widow-pension-scheme', 'magalir', 'EN'),
    ('widow-pension-scheme', 'urimai', 'EN'),
    ('widow-pension-scheme', 'kalaignar', 'EN'),
    ('widow-pension-scheme', 'women', 'EN'),
    ('widow-pension-scheme', 'benefit', 'EN'),
    ('widow-pension-scheme', 'eligibility', 'EN'),
    ('widow-pension-scheme', 'income', 'EN'),
    ('widow-pension-scheme', 'monthly', 'EN'),
    ('widow-pension-scheme', 'rs. 1000', 'EN'),
    ('widow-pension-scheme', 'residents', 'EN'),
    ('widow-pension-scheme', 'மகளிர் உரிமை', 'TA'),
    ('widow-pension-scheme', 'உரிமைத் திட்டம்', 'TA'),
    ('dept-social-welfare', 'welfare', 'EN'),
    ('dept-social-welfare', 'empowerment', 'EN'),
    ('dept-social-welfare', 'social welfare', 'EN'),
    ('dept-social-welfare', 'women department', 'EN'),
    ('dept-social-welfare', 'சமூக நலத்துறை', 'TA')
ON CONFLICT (node_id, alias, language) DO NOTHING;

-- 9. Insert Edge relationships
INSERT INTO edges (id, from_node_id, to_node_id, relationship_type)
VALUES (
    'e18f2a1b-3bcf-46d2-a7cf-cf019385bfca',
    'widow-pension-scheme',
    'dept-social-welfare',
    'governed_by'
) ON CONFLICT (id) DO NOTHING;

-- 10. Insert Edge Evidence (provenance citations)
INSERT INTO edge_evidence (edge_id, passage_id, approved_by)
VALUES (
    'e18f2a1b-3bcf-46d2-a7cf-cf019385bfca',
    'p89df10a-3456-4b2a-89a1-7cf019283fba',
    'system-ingest-steward'
) ON CONFLICT (edge_id, passage_id) DO NOTHING;

COMMIT;
