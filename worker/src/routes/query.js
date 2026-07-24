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
  const NVIDIA_API_KEY    = c.env.NVIDIA_API_KEY;
  // NVIDIA NIM model id — override via env; defaults to Llama 3.1 70B Instruct.
  const NVIDIA_MODEL      = c.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';

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

  // ── STEP 1: Trigram alias match ─────────────────────────────────────────────
  const aliasRes = await supabaseRpc(SUPABASE_URL, SUPABASE_ANON_KEY, 'match_node_aliases', {
    query_text: queryText,
  });

  if (aliasRes.error) {
    console.error('[RAG] match_node_aliases error:', aliasRes.error);
    return c.json({ error: 'Alias lookup failed.', detail: aliasRes.error }, 502);
  }

  if (!aliasRes.data || aliasRes.data.length === 0) {
    return c.json({
      answer: 'No verified information was found.',
      citations: [],
      graph: { nodes: [], edges: [] },
    });
  }

  const rootNodeId = aliasRes.data[0].node_id;
  const matchScore = aliasRes.data[0].sim_score;
  console.log(`[RAG] Best alias match: "${rootNodeId}" (score: ${matchScore})`);

  // ── STEP 2 & 3: Graph traversal + evidence assembly ─────────────────────────
  const contextRes = await supabaseRpc(SUPABASE_URL, SUPABASE_ANON_KEY, 'get_graph_rag_context', {
    root_node_id: rootNodeId,
    hops_count: 2,
  });

  if (contextRes.error) {
    console.error('[RAG] get_graph_rag_context error:', contextRes.error);
    return c.json({ error: 'Graph context fetch failed.', detail: contextRes.error }, 502);
  }

  // Deduplicate rows into structured sets
  const passages   = [];
  const nodesMap   = {};
  const edgesMap   = {};

  for (const row of (contextRes.data || [])) {
    if (row.node_id && !nodesMap[row.node_id]) {
      nodesMap[row.node_id] = {
        id:      row.node_id,
        type:    row.node_type,
        title:   row.node_title,
        summary: row.node_summary,
        details: row.node_details,
      };
    }
    if (row.edge_id && !edgesMap[row.edge_id]) {
      edgesMap[row.edge_id] = {
        id:           row.edge_id,
        from:         row.from_node_id,
        to:           row.to_node_id,
        relationship: row.relationship_type,
      };
    }
    if (row.passage_id && !passages.some((p) => p.id === row.passage_id)) {
      passages.push({
        id:        row.passage_id,
        text:      row.text_content,
        page:      row.page_number,
        section:   row.section_label,
        docTitle:  row.document_title,
        authority: row.issuing_authority,
      });
    }
  }

  // ── STEP 4: Grounded synthesis ───────────────────────────────────────────────
  const answer = await generateGroundedAnswer(queryText, passages, NVIDIA_API_KEY, NVIDIA_MODEL);

  return c.json({
    answer,
    citations: passages.map((p) => ({
      document:  p.docTitle,
      authority: p.authority,
      page:      p.page,
      section:   p.section,
    })),
    graph: {
      nodes: Object.values(nodesMap),
      edges: Object.values(edgesMap),
    },
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

// ── NVIDIA NIM grounded synthesis ─────────────────────────────────────────────
// Uses NVIDIA's OpenAI-compatible chat-completions endpoint. The API key is a
// Cloudflare encrypted binding (env.NVIDIA_API_KEY) — never in source.
async function generateGroundedAnswer(query, passages, apiKey, model) {
  // If the key is not bound yet, return the raw passages as plain text
  if (!apiKey) {
    console.warn('[RAG] NVIDIA_API_KEY not bound — returning raw passage text.');
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

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
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
    console.error('[RAG] NVIDIA API error:', err);
    throw new Error(`NVIDIA responded ${res.status}`);
  }

  const result = await res.json();
  return (
    result.choices?.[0]?.message?.content ||
    'No verified information was found.'
  );
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
