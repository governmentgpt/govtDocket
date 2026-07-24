/**
 * WikiGov Git-Storage Compiler & Sync Tool
 * 
 * Reads all structured JSON files in the git_storage folder (representing 
 * the governed state of nodes, edges, and document references) and compiles 
 * them into a single, idempotent SQL sync script (src/db/sync_data.sql) 
 * for manual application to Supabase.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../data/git_storage');
const NODES_DIR = path.join(STORAGE_DIR, 'nodes');
const EDGES_DIR = path.join(STORAGE_DIR, 'edges');
const DOCS_DIR = path.join(STORAGE_DIR, 'documents');
const OUTPUT_SQL_FILE = path.join(__dirname, '../db/sync_data.sql');

function compileGitStorage() {
  console.log('Starting WikiGov Git Storage compilation...');
  
  const sqlStatements = [
    `-- WikiGov Compiled Sync Script`,
    `-- Generated on: ${new Date().toISOString()}`,
    `BEGIN;`,
    `\n-- Disable triggers during sync if needed\n`
  ];

  // 1. Compile Documents, Versions and Passages
  if (fs.existsSync(DOCS_DIR)) {
    const docFiles = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.json'));
    console.log(`Compiling ${docFiles.length} document assets...`);
    
    docFiles.forEach(file => {
      const doc = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, file), 'utf8'));
      
      // Insert document metadata
      sqlStatements.push(
        `INSERT INTO documents (id, original_url, doc_type, issuing_authority) ` +
        `VALUES ('${doc.id}', '${doc.url}', '${doc.docType}', '${doc.issuingAuthority}') ` +
        `ON CONFLICT (id) DO UPDATE SET ` +
        `original_url = EXCLUDED.original_url, doc_type = EXCLUDED.doc_type, issuing_authority = EXCLUDED.issuing_authority;`
      );

      // Insert version
      if (doc.version) {
        const v = doc.version;
        sqlStatements.push(
          `INSERT INTO document_versions (id, document_id, version_number, title, effective_date, sha256_hash) ` +
          `VALUES ('${v.id}', '${v.documentId}', ${v.versionNumber}, '${v.title.replace(/'/g, "''")}', '${v.effectiveDate}', '${v.hash}') ` +
          `ON CONFLICT (document_id, version_number) DO UPDATE SET ` +
          `title = EXCLUDED.title, effective_date = EXCLUDED.effective_date, sha256_hash = EXCLUDED.sha256_hash;`
        );
      }

      // Insert passages
      if (doc.passages && Array.isArray(doc.passages)) {
        doc.passages.forEach(p => {
          sqlStatements.push(
            `INSERT INTO passages (id, version_id, page_number, section_label, text_content) ` +
            `VALUES ('${p.id}', '${p.versionId}', ${p.pageNumber}, '${p.sectionLabel}', '${p.textContent.replace(/'/g, "''")}') ` +
            `ON CONFLICT (id) DO UPDATE SET ` +
            `text_content = EXCLUDED.text_content, section_label = EXCLUDED.section_label;`
          );
        });
      }
    });
  }

  // 2. Compile Concept Nodes, Versions & Aliases
  if (fs.existsSync(NODES_DIR)) {
    const nodeFiles = fs.readdirSync(NODES_DIR).filter(f => f.endsWith('.json'));
    console.log(`Compiling ${nodeFiles.length} node entities...`);

    nodeFiles.forEach(file => {
      const node = JSON.parse(fs.readFileSync(path.join(NODES_DIR, file), 'utf8'));

      // Insert Node base
      sqlStatements.push(
        `INSERT INTO nodes (id, type) VALUES ('${node.id}', '${node.type}') ` +
        `ON CONFLICT (id) DO NOTHING;`
      );

      // Insert active version
      if (node.version) {
        const nv = node.version;
        const detailsEn = `ARRAY['${nv.detailsEn.map(d => d.replace(/'/g, "''")).join("','")}']`;
        const detailsTa = `ARRAY['${nv.detailsTa.map(d => d.replace(/'/g, "''")).join("','")}']`;

        // Archive previous active versions by setting valid_to if inserting a new active one
        sqlStatements.push(
          `UPDATE node_versions SET valid_to = CURRENT_TIMESTAMP ` +
          `WHERE node_id = '${node.id}' AND status = 'approved' AND valid_to IS NULL;`
        );

        sqlStatements.push(
          `INSERT INTO node_versions (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from) ` +
          `VALUES ('${node.id}', '${nv.titleEn.replace(/'/g, "''")}', '${nv.titleTa.replace(/'/g, "''")}', '${nv.summaryEn.replace(/'/g, "''")}', '${nv.summaryTa.replace(/'/g, "''")}', ${detailsEn}, ${detailsTa}, '${nv.status}', '${nv.validFrom}') ` +
          `ON CONFLICT DO NOTHING;`
        );
      }

      // Insert Aliases
      if (node.aliases && Array.isArray(node.aliases)) {
        node.aliases.forEach(a => {
          sqlStatements.push(
            `INSERT INTO node_aliases (node_id, alias, language) ` +
            `VALUES ('${node.id}', '${a.alias.replace(/'/g, "''")}', '${a.lang}') ` +
            `ON CONFLICT (node_id, alias, language) DO NOTHING;`
          );
        });
      }
    });
  }

  // 3. Compile Edges and Evidence Linkers
  if (fs.existsSync(EDGES_DIR)) {
    const edgeFiles = fs.readdirSync(EDGES_DIR).filter(f => f.endsWith('.json'));
    console.log(`Compiling ${edgeFiles.length} relationship edges...`);

    edgeFiles.forEach(file => {
      const edge = JSON.parse(fs.readFileSync(path.join(EDGES_DIR, file), 'utf8'));

      // Insert Edge Base
      sqlStatements.push(
        `INSERT INTO edges (id, from_node_id, to_node_id, relationship_type) ` +
        `VALUES ('${edge.id}', '${edge.from}', '${edge.to}', '${edge.relationship}') ` +
        `ON CONFLICT (id) DO UPDATE SET ` +
        `relationship_type = EXCLUDED.relationship_type;`
      );

      // Insert Edge Evidence
      if (edge.evidence) {
        const ev = edge.evidence;
        sqlStatements.push(
          `INSERT INTO edge_evidence (edge_id, passage_id, approved_by) ` +
          `VALUES ('${edge.id}', '${ev.passageId}', '${ev.approvedBy}') ` +
          `ON CONFLICT (edge_id, passage_id) DO NOTHING;`
        );
      }
    });
  }

  sqlStatements.push(`\nCOMMIT;`);
  
  // Write to Output DB file
  fs.writeFileSync(OUTPUT_SQL_FILE, sqlStatements.join('\n'));
  console.log(`✔ SQL Sync File written successfully to: ${OUTPUT_SQL_FILE.replace(process.cwd(), '.')}`);
}

compileGitStorage();
