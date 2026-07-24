/**
 * data.gov.in source adapter
 *
 * data.gov.in exposes every dataset ("resource") over a REST API:
 *   https://api.data.gov.in/resource/<RESOURCE_ID>?api-key=<KEY>&format=json&limit=&offset=
 *
 * This adapter fetches a resource and normalizes it into the SAME structure the
 * git-storage compiler (sync.js) expects: { document, documentVersion, passages,
 * nodes, edges }. Records land as status 'pending review' — NEVER auto-approved —
 * so a human steward must approve them before get_graph_rag_context will surface
 * them. That preserves the "no auto-publish uncertain sources" guardrail.
 *
 * The API key is read from env (DATA_GOV_API_KEY); it is never hard-coded.
 */

const crypto = require('crypto');

const API_ROOT = 'https://api.data.gov.in/resource';

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'dataset';
}

/** Flatten one record object into a readable, citable passage string. */
function recordToText(record) {
  return Object.entries(record)
    .filter(([, v]) => v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

/**
 * Fetch a single data.gov.in resource (one page of records).
 * Uses the global fetch available in Node 18+.
 */
async function fetchResource(resourceId, { apiKey, limit = 50, offset = 0 } = {}) {
  if (!apiKey) throw new Error('DATA_GOV_API_KEY is required to fetch data.gov.in resources.');
  const url = `${API_ROOT}/${resourceId}?api-key=${apiKey}&format=json&limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`data.gov.in HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Normalize a data.gov.in resource payload into WikiGov graph structures.
 * @param {string} resourceId
 * @param {object} payload  Raw JSON from fetchResource().
 */
function normalizeResource(resourceId, payload) {
  const title    = payload.title || payload.index_name || `data.gov.in resource ${resourceId}`;
  const desc     = payload.desc || payload.description || title;
  const org      = Array.isArray(payload.org) ? payload.org : (payload.org ? [payload.org] : []);
  const sector   = Array.isArray(payload.sector) ? payload.sector : [];
  const records  = Array.isArray(payload.records) ? payload.records : [];
  const authority = org[0] || 'Government of India';

  const docId     = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const sourceUrl = `https://data.gov.in/resource/${resourceId}`;
  const hash      = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');

  const document = {
    id: docId,
    url: sourceUrl,
    docType: 'Open Government Dataset',
    issuingAuthority: authority,
  };
  const documentVersion = {
    id: versionId,
    documentId: docId,
    versionNumber: 1,
    title,
    effectiveDate: (payload.updated_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    hash,
  };

  // Passage 0 is the dataset overview; each record becomes its own citable passage.
  const passages = [
    {
      id: crypto.randomUUID(),
      versionId,
      pageNumber: 1,
      sectionLabel: 'Dataset Overview',
      textContent: `${title}. ${desc}`.trim(),
    },
    ...records.map((rec, i) => ({
      id: crypto.randomUUID(),
      versionId,
      pageNumber: i + 2,
      sectionLabel: `Record ${i + 1}`,
      textContent: recordToText(rec),
    })),
  ];

  // Topic node for the dataset, and a department node for the publishing org.
  // Tamil fields mirror English as a placeholder until a steward translates them.
  const topicId = slugify(title);
  const deptId  = `dept-${slugify(authority)}`;

  const topicNode = {
    id: topicId,
    type: 'dataset',
    version: {
      titleEn: title,
      titleTa: title,
      summaryEn: desc.slice(0, 500),
      summaryTa: desc.slice(0, 500),
      detailsEn: sector.length ? sector : ['Open government dataset published on data.gov.in.'],
      detailsTa: sector.length ? sector : ['data.gov.in-ல் வெளியிடப்பட்ட அரசுத் தரவுத்தொகுப்பு.'],
      status: 'pending review',
      validFrom: new Date().toISOString(),
    },
    aliases: [
      { alias: title, lang: 'EN' },
      ...sector.map((s) => ({ alias: s, lang: 'EN' })),
    ],
  };

  const deptNode = {
    id: deptId,
    type: 'department',
    version: {
      titleEn: authority,
      titleTa: authority,
      summaryEn: `Publishing authority for "${title}" on data.gov.in.`,
      summaryTa: `data.gov.in-ல் "${title}" வெளியிட்ட அமைப்பு.`,
      detailsEn: ['Source authority recorded from the data.gov.in catalog metadata.'],
      detailsTa: ['data.gov.in பட்டியல் தரவிலிருந்து பதிவு செய்யப்பட்ட ஆதார அமைப்பு.'],
      status: 'pending review',
      validFrom: new Date().toISOString(),
    },
    aliases: [{ alias: authority, lang: 'EN' }],
  };

  const edges = [
    {
      id: crypto.randomUUID(),
      from: topicId,
      to: deptId,
      relationship: 'published_by',
      evidence: {
        passageId: passages[0].id,   // cite the dataset overview
        approvedBy: 'pending-review',
      },
    },
  ];

  return { document, documentVersion, passages, nodes: [topicNode, deptNode], edges };
}

module.exports = { fetchResource, normalizeResource, slugify };
