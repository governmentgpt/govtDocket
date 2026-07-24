/**
 * WikiGov Onboarding & Ingestion CLI Prototype
 * 
 * This script simulates the ingestion workflow:
 * 1. Discover & Scrape (HTML/PDF raw text)
 * 2. Structure Proposal (Simulating LLM extraction to nodes/edges schema)
 * 3. Git-Backed Local Storage (Version control/reversion safety)
 * 4. DB Sync (Generating SQL imports for Supabase)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Target paths for git-backed storage
const STORAGE_DIR = path.join(__dirname, '../data/git_storage');
const NODES_DIR = path.join(STORAGE_DIR, 'nodes');
const EDGES_DIR = path.join(STORAGE_DIR, 'edges');
const DOCS_DIR = path.join(STORAGE_DIR, 'documents');

// Ensure directories exist
[STORAGE_DIR, NODES_DIR, EDGES_DIR, DOCS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// A database mockup of scraped sources for demonstration
const MOCK_SOURCES = {
  'https://www.tn.gov.in/go_ms_118': {
    title: 'Kalaignar Magalir Urimai Thittam - Guidelines',
    docType: 'Government Order',
    issuingAuthority: 'Social Welfare and Women Empowerment Department',
    date: '2026-07-14',
    content: `GOVERNMENT OF TAMIL NADU
Social Welfare and Women Empowerment Department
G.O. (Ms) No. 118, Dated 14.07.2026

SUBJECT: Implementation of Kalaignar Magalir Urimai Thittam - Release of basic guidelines for eligibility.
ORDER:
The Government of Tamil Nadu hereby registers the basic guidelines for the Kalaignar Magalir Urimai Thittam scheme.
Page 1: The scheme provides a monthly financial support of Rs. 1,000 to eligible women heads of households.
Page 2: Eligible applicants must be women who are permanent residents of Tamil Nadu, above 21 years of age, and whose annual household income is below Rs. 2.5 Lakhs.
Page 3: Applications must be submitted through the designated registration camps. Required documents include Aadhaar Card, Smart Family Card, and Income Certificate.`
  }
};

/**
 * 1. Simulates Scrape/Capture
 */
function scrapeSource(url) {
  console.log(`\n[1/4] Scraping source URL: ${url}`);
  const data = MOCK_SOURCES[url];
  if (!data) {
    throw new Error(`URL ${url} not registered in mock registry.`);
  }
  const sha256 = crypto.createHash('sha256').update(data.content).digest('hex');
  console.log(`✔ Scraped content verified. Hash: ${sha256.substring(0, 8)}...`);
  return { ...data, url, hash: sha256 };
}

/**
 * 2. Simulates LLM Entity/Edge extraction based on schema
 */
function proposeGraphData(scraped) {
  console.log(`[2/4] Running entity and relation extractor (simulated AI)...`);
  
  const docId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  
  // Document and version metadata
  const document = {
    id: docId,
    url: scraped.url,
    docType: scraped.docType,
    issuingAuthority: scraped.issuingAuthority
  };

  const documentVersion = {
    id: versionId,
    documentId: docId,
    versionNumber: 1,
    title: scraped.title,
    effectiveDate: scraped.date,
    hash: scraped.hash
  };

  // Break text into addressable passages (by pages)
  const passages = scraped.content.split('Page ').map((chunk, idx) => {
    return {
      id: crypto.randomUUID(),
      versionId: versionId,
      pageNumber: idx + 1,
      sectionLabel: idx === 0 ? 'Header Info' : `Page ${idx}`,
      textContent: chunk.trim()
    };
  });

  // Extract Nodes
  const nodeIdScheme = 'widow-pension-scheme'; // Stable concept ID
  const nodeIdDept = 'dept-social-welfare';
  
  const nodes = [
    {
      id: nodeIdScheme,
      type: 'scheme',
      version: {
        titleEn: 'Kalaignar Magalir Urimai Thittam',
        titleTa: 'கலைஞர் மகளிர் உரிமைத் திட்டம்',
        summaryEn: 'Monthly financial assistance of Rs. 1,000 for women heads of households.',
        summaryTa: 'குடும்பத் தலைவிகளுக்கு மாதம் ரூ. 1,000 நிதியுதவி வழங்கும் திட்டம்.',
        detailsEn: [
          'Monthly financial assistance of Rs. 1,000.',
          'Annual household income must be under Rs. 2.5 Lakhs.',
          'Age must be above 21 years.'
        ],
        detailsTa: [
          'மாதாந்திர உதவித்தொகை ரூ. 1,000.',
          'குடும்ப ஆண்டு வருமானம் ரூ. 2.5 லட்சத்திற்கு மிகாமல் இருக்க வேண்டும்.',
          'வயது 21 நிரம்பியவராக இருக்க வேண்டும்.'
        ],
        status: 'approved',
        validFrom: '2026-07-14T00:00:00Z'
      },
      aliases: [
        { alias: 'Kalaignar Magalir Scheme', lang: 'EN' },
        { alias: 'Magalir Urimai Thittam', lang: 'EN' },
        { alias: 'மகளிர் உரிமைத் திட்டம்', lang: 'TA' }
      ]
    },
    {
      id: nodeIdDept,
      type: 'department',
      version: {
        titleEn: 'Social Welfare and Women Empowerment',
        titleTa: 'சமூக நலன் மற்றும் மகளிர் உரிமைத் துறை',
        summaryEn: 'State department responsible for social assistance and women empowerment.',
        summaryTa: 'சமூக உதவி மற்றும் மகளிர் மேம்பாட்டிற்கு பொறுப்பான அரசுத் துறை.',
        detailsEn: ['Responsible for Kalaignar Magalir scheme implementation.'],
        detailsTa: ['கலைஞர் மகளிர் உரிமைத் திட்டத்தை செயல்படுத்துவதற்குப் பொறுப்பானது.'],
        status: 'approved',
        validFrom: '2026-07-14T00:00:00Z'
      },
      aliases: [
        { alias: 'Social Welfare Department', lang: 'EN' },
        { alias: 'சமூக நலத்துறை', lang: 'TA' }
      ]
    }
  ];

  // Extract Edges & link to evidence (passage index 1 holds the scheme details)
  const edges = [
    {
      id: crypto.randomUUID(),
      from: nodeIdScheme,
      to: nodeIdDept,
      relationship: 'governed_by',
      evidence: {
        passageId: passages[0].id, // Cites Document Header info
        approvedBy: 'system-ingest-steward'
      }
    }
  ];

  console.log(`✔ Extracted: 2 Nodes, 1 Edge, 4 Passages.`);
  return { document, documentVersion, passages, nodes, edges };
}

/**
 * 3. Saves extracted graph details to Git-backed structured files (Local Wiki storage)
 */
function saveToGitStorage(data) {
  console.log(`[3/4] Saving structured models to Git-backed local storage...`);

  // Save document metadata
  fs.writeFileSync(
    path.join(DOCS_DIR, `${data.document.id}.json`),
    JSON.stringify({ ...data.document, version: data.documentVersion, passages: data.passages }, null, 2)
  );

  // Save nodes with stable file paths (easy git diffs & commits)
  data.nodes.forEach(node => {
    fs.writeFileSync(
      path.join(NODES_DIR, `${node.id}.json`),
      JSON.stringify(node, null, 2)
    );
  });

  // Save edges
  data.edges.forEach(edge => {
    fs.writeFileSync(
      path.join(EDGES_DIR, `${edge.id}.json`),
      JSON.stringify(edge, null, 2)
    );
  });

  console.log(`✔ Local git files updated under: ${STORAGE_DIR.replace(process.cwd(), '.')}`);
}

/**
 * 4. Generates SQL queries to populate Supabase
 */
function generateSyncSQL(data) {
  console.log(`[4/4] Generating SQL seed migration script...`);
  
  const sqlLines = [
    `-- WikiGov Ingestion Sync - ${new Date().toISOString()}`,
    `BEGIN;`,
    `\n-- Ingest Document & Version`
  ];

  // Document Inserts
  sqlLines.push(
    `INSERT INTO documents (id, original_url, doc_type, issuing_authority) ` +
    `VALUES ('${data.document.id}', '${data.document.url}', '${data.document.docType}', '${data.document.issuingAuthority}') ` +
    `ON CONFLICT (id) DO NOTHING;`
  );
  
  sqlLines.push(
    `INSERT INTO document_versions (id, document_id, version_number, title, effective_date, sha256_hash) ` +
    `VALUES ('${data.documentVersion.id}', '${data.documentVersion.documentId}', ${data.documentVersion.versionNumber}, '${data.documentVersion.title.replace(/'/g, "''")}', '${data.documentVersion.effectiveDate}', '${data.documentVersion.hash}') ` +
    `ON CONFLICT DO NOTHING;`
  );

  // Passages Inserts
  sqlLines.push(`\n-- Ingest Passages`);
  data.passages.forEach(p => {
    sqlLines.push(
      `INSERT INTO passages (id, version_id, page_number, section_label, text_content) ` +
      `VALUES ('${p.id}', '${p.versionId}', ${p.pageNumber}, '${p.sectionLabel}', '${p.textContent.replace(/'/g, "''")}') ` +
      `ON CONFLICT (id) DO NOTHING;`
    );
  });

  // Nodes, Versions & Aliases
  sqlLines.push(`\n-- Ingest Nodes`);
  data.nodes.forEach(n => {
    sqlLines.push(`INSERT INTO nodes (id, type) VALUES ('${n.id}', '${n.type}') ON CONFLICT (id) DO NOTHING;`);
    
    // Arrays format for postgres
    const detailsEnFormatted = `ARRAY['${n.version.detailsEn.map(d => d.replace(/'/g, "''")).join("','")}']`;
    const detailsTaFormatted = `ARRAY['${n.version.detailsTa.map(d => d.replace(/'/g, "''")).join("','")}']`;

    sqlLines.push(
      `INSERT INTO node_versions (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from) ` +
      `VALUES ('${n.id}', '${n.version.titleEn.replace(/'/g, "''")}', '${n.version.titleTa.replace(/'/g, "''")}', '${n.version.summaryEn.replace(/'/g, "''")}', '${n.version.summaryTa.replace(/'/g, "''")}', ${detailsEnFormatted}, ${detailsTaFormatted}, '${n.version.status}', '${n.version.validFrom}') ` +
      `ON CONFLICT DO NOTHING;`
    );

    n.aliases.forEach(a => {
      sqlLines.push(
        `INSERT INTO node_aliases (node_id, alias, language) ` +
        `VALUES ('${n.id}', '${a.alias.replace(/'/g, "''")}', '${a.language}') ` +
        `ON CONFLICT DO NOTHING;`
      );
    });
  });

  // Edges & Evidence
  sqlLines.push(`\n-- Ingest Edges & Evidence`);
  data.edges.forEach(e => {
    sqlLines.push(
      `INSERT INTO edges (id, from_node_id, to_node_id, relationship_type) ` +
      `VALUES ('${e.id}', '${e.from}', '${e.to}', '${e.relationship}') ` +
      `ON CONFLICT (id) DO NOTHING;`
    );
    sqlLines.push(
      `INSERT INTO edge_evidence (edge_id, passage_id, approved_by) ` +
      `VALUES ('${e.id}', '${e.evidence.passageId}', '${e.evidence.approvedBy}') ` +
      `ON CONFLICT DO NOTHING;`
    );
  });

  sqlLines.push(`\nCOMMIT;`);
  
  const sqlFile = path.join(STORAGE_DIR, 'sync_data.sql');
  fs.writeFileSync(sqlFile, sqlLines.join('\n'));
  console.log(`✔ SQL Sync script generated at: ${sqlFile.replace(process.cwd(), '.')}`);
  console.log(`\n======================================================`);
  console.log(`Ingestion Complete! Check local git files to review commits.`);
  console.log(`Apply sync_data.sql to your Supabase instance to sync the graph.`);
  console.log(`======================================================\n`);
}

// Automatically trigger prototype run for demonstration
try {
  const scraped = scrapeSource('https://www.tn.gov.in/go_ms_118');
  const graph = proposeGraphData(scraped);
  saveToGitStorage(graph);
  generateSyncSQL(graph);
} catch (err) {
  console.error('Ingestion failed:', err.message);
}
