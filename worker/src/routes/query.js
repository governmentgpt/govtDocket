/**
 * WikiGov RAG Query Route
 *
 * Implements the 4-step Vectorless RAG Retrieval Ladder:
 *
 *   Step 1 — Alias matching      pg_trgm similarity over node_aliases
 *   Step 2 — Graph traversal     Recursive 2-hop CTE via get_graph_rag_context RPC
 *   Step 3 — Evidence assembly   Passages + citations returned by the same RPC
 *   Step 4 — Grounded synthesis  Gemini called with strict anti-hallucination prompt
 *
 * Secrets come from Cloudflare encrypted bindings (env.*), never from source code.
 */

/**
 * @param {import('hono').Context} c
 */
export async function handleQuery(c) {
  // Pull secrets from the Worker env binding
  const SUPABASE_URL      = c.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = c.env.SUPABASE_ANON_KEY;
  // LLM synthesis — any OpenAI-compatible chat endpoint (GLM / NVIDIA / etc.).
  const LLM_API_KEY  = c.env.LLM_API_KEY;
  const LLM_MODEL    = c.env.LLM_MODEL    || 'z-ai/glm-5.2';
  const LLM_BASE_URL = c.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

  const queryText =
    c.req.query('q') ||
    (await c.req.json().catch(() => ({}))).query || '';

  if (!queryText.trim()) {
    return c.json({ error: 'Query parameter "q" is required.' }, 400);
  }

  console.log(`[RAG] Received query: "${queryText}"`);

  // ── If Supabase is not yet wired, fall back to simulation ──────────────────
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[RAG] Supabase secrets not bound — running in simulation mode.');
    return c.json(simulateResponse(queryText));
  }

  const passages = [];
  const seen     = new Set();
  const nodesMap = {};
  const edgesMap = {};

  // ── STEP 1: Content retrieval — full-text search over ALL approved passages ──
  // This is the primary path: it answers open-domain topic questions from the
  // whole corpus (What's New, Gazette, GOs, dept updates), not just one node.
  const ftsRes = await supabaseRpc(SUPABASE_URL, SUPABASE_ANON_KEY, 'search_passages', {
    query_text: queryText,
    match_count: 8,
  });
  if (ftsRes.error) {
    console.error('[RAG] search_passages error:', ftsRes.error);
  } else {
    for (const r of (ftsRes.data || [])) {
      if (seen.has(r.passage_id)) continue;
      seen.add(r.passage_id);
      passages.push({
        id: r.passage_id, text: r.text_content, page: r.page_number,
        section: r.section_label, docTitle: r.document_title, authority: r.issuing_authority,
      });
      if (r.node_id && !nodesMap[r.node_id]) {
        nodesMap[r.node_id] = { id: r.node_id, type: r.node_type || 'topic', title: r.node_title, summary: '', details: [] };
      }
    }
  }

  // ── STEP 2: Entity/graph context — best-effort, powers the 3D knowledge map ──
  const aliasRes = await supabaseRpc(SUPABASE_URL, SUPABASE_ANON_KEY, 'match_node_aliases', {
    query_text: queryText,
  });
  if (!aliasRes.error && aliasRes.data && aliasRes.data.length) {
    const rootNodeId = aliasRes.data[0].node_id;
    const contextRes = await supabaseRpc(SUPABASE_URL, SUPABASE_ANON_KEY, 'get_graph_rag_context', {
      root_node_id: rootNodeId, hops_count: 2,
    });
    if (!contextRes.error) {
      for (const row of (contextRes.data || [])) {
        if (row.node_id && !nodesMap[row.node_id]) {
          nodesMap[row.node_id] = { id: row.node_id, type: row.node_type, title: row.node_title, summary: row.node_summary, details: row.node_details };
        }
        if (row.edge_id && !edgesMap[row.edge_id]) {
          edgesMap[row.edge_id] = { id: row.edge_id, from: row.from_node_id, to: row.to_node_id, relationship: row.relationship_type };
        }
        if (row.passage_id && !seen.has(row.passage_id)) {
          seen.add(row.passage_id);
          passages.push({ id: row.passage_id, text: row.text_content, page: row.page_number, section: row.section_label, docTitle: row.document_title, authority: row.issuing_authority });
        }
      }
    }
  }

  if (passages.length === 0) {
    return c.json({ answer: 'No verified information was found.', citations: [], graph: { nodes: Object.values(nodesMap), edges: [] } });
  }

  // ── STEP 3: Grounded synthesis over the top passages ─────────────────────────
  const top = passages.slice(0, 10);
  let answer;
  try {
    answer = await generateGroundedAnswer(queryText, top, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL);
  } catch (err) {
    // Retrieval succeeded but the LLM failed — surface it distinctly instead of
    // masking it as "No verified information was found".
    console.error('[RAG] synthesis failed:', err.message);
    answer = `Retrieved ${top.length} verified source(s), but the answer service is unavailable (${err.message}).`;
  }

  return c.json({
    answer,
    citations: top.map((p) => ({ document: p.docTitle, authority: p.authority, page: p.page, section: p.section })),
    graph: { nodes: Object.values(nodesMap), edges: Object.values(edgesMap) },
  });
}

// ── Supabase RPC helper ───────────────────────────────────────────────────────
// Uses the native fetch() available in all Cloudflare Workers.
// No @supabase/supabase-js dependency needed — keeps the Worker bundle tiny.
async function supabaseRpc(url, anonKey, fnName, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        anonKey,
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `HTTP ${res.status}: ${text}` };
  }

  const data = await res.json();
  return { data, error: null };
}

// ── LLM grounded synthesis ────────────────────────────────────────────────────
// Calls any OpenAI-compatible chat-completions endpoint (GLM, NVIDIA NIM, etc.).
// The key is a Cloudflare encrypted binding (env.LLM_API_KEY) — never in source.
async function generateGroundedAnswer(query, passages, apiKey, model, baseUrl) {
  // If the key is not bound yet, return the raw passages as plain text
  if (!apiKey) {
    console.warn('[RAG] LLM_API_KEY not bound — returning raw passage text.');
    return passages
      .map((p) => `[${p.docTitle}, Page ${p.page}]: ${p.text}`)
      .join('\n\n');
  }

  if (passages.length === 0) {
    return 'No verified information was found.';
  }

  const passagesContext = passages
    .map(
      (p, i) =>
        `[Passage ${i + 1}] Source: "${p.docTitle}", Authority: "${p.authority}", ` +
        `Page: ${p.page}, Section: "${p.section}"\nContent: "${p.text}"`
    )
    .join('\n\n');

  const systemPrompt =
    `You are the WikiGov QA Steward. Answer the citizen's question using ONLY the ` +
    `verified passages provided below. Rules:\n` +
    `1. Every factual claim must be followed by a citation token: [Source Name, Page N].\n` +
    `2. Do NOT add any information that is not in the passages.\n` +
    `3. If the passages do not contain the answer, reply exactly: "No verified information was found."\n` +
    `4. Write in simple language suitable for a citizen unfamiliar with bureaucratic terms.\n\n` +
    `Verified Passages:\n${passagesContext}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: query },
      ],
      temperature: 0.1,   // near-deterministic
      max_tokens:  800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[RAG] LLM API error:', err);
    throw new Error(`LLM endpoint responded ${res.status}`);
  }

  const result = await res.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    // Distinguish an LLM problem (wrong base URL/model → no choices) from a
    // genuine refusal. Silently defaulting to "No verified information" hid this.
    console.error('[RAG] LLM returned no content:', JSON.stringify(result).slice(0, 800));
    throw new Error('LLM returned no content (check LLM_BASE_URL / LLM_MODEL)');
  }
  return content;
}

// ── Simulation fallback ───────────────────────────────────────────────────────
// Returns mock answers when Supabase secrets are not yet configured.
function simulateResponse(query) {
  const q = query.toLowerCase();

  if (q.includes('magalir') || q.includes('pension') || q.includes('income') || q.includes('eligib')) {
    return {
      answer:
        'Under G.O. (Ms) No. 118 [G.O. (Ms) No. 118, Page 1], the Kalaignar Magalir ' +
        'Urimai Thittam scheme provides Rs. 1,000 monthly to eligible women heads of ' +
        'households in Tamil Nadu. Applicants must be permanent residents, above 21 years ' +
        'of age, with an annual household income below Rs. 2.5 Lakhs ' +
        '[G.O. (Ms) No. 118, Page 2]. Required documents: Aadhaar Card, Smart Family Card, ' +
        'and Income Certificate [G.O. (Ms) No. 118, Page 3].',
      citations: [
        { document: 'G.O. (Ms) No. 118', authority: 'Social Welfare Dept', page: 2, section: 'Eligibility' },
        { document: 'G.O. (Ms) No. 118', authority: 'Social Welfare Dept', page: 3, section: 'Documents' },
      ],
      graph: {
        nodes: [
          { id: 'widow-pension-scheme', type: 'scheme',     title: 'Kalaignar Magalir Urimai Thittam' },
          { id: 'dept-social-welfare',  type: 'department', title: 'Social Welfare & Women Empowerment Dept' },
        ],
        edges: [
          { id: 'e1', from: 'widow-pension-scheme', to: 'dept-social-welfare', relationship: 'governed_by' },
        ],
      },
    };
  }

  return {
    answer: 'No verified information was found.',
    citations: [],
    graph: { nodes: [], edges: [] },
  };
}
