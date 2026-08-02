/**
 * WikiGov graph routes — for the Explore (3D) tab.
 *
 *   GET /api/graph?status=approved|pending|all   full-graph dump { nodes, edges }
 *   GET /api/node?id=<node_id>                    one node's detail + neighbours + citations
 *
 * Secrets come from Cloudflare bindings (env.*). Degrades to demo data when
 * Supabase is not configured, so the tab still renders.
 */

const ALLOWED_STATUS = ['approved', 'pending', 'all'];

export async function handleGraph(c) {
  const raw = (c.req.query('status') || 'approved').toLowerCase();
  const status = ALLOWED_STATUS.includes(raw) ? raw : 'approved';

  const URL = c.env.SUPABASE_URL;
  const KEY = c.env.SUPABASE_ANON_KEY;
  if (!URL || !KEY) return c.json(demoGraph());

  const res = await supabaseRpc(URL, KEY, 'get_full_graph', { p_status: status });
  if (res.error) return c.json({ error: 'graph fetch failed', detail: res.error }, 502);
  return c.json(res.data || { nodes: [], edges: [] });
}

export async function handleNode(c) {
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'id required' }, 400);

  const URL = c.env.SUPABASE_URL;
  const KEY = c.env.SUPABASE_ANON_KEY;
  if (!URL || !KEY) {
    return c.json({ node: { id, title: id, summary: 'Live API not configured.', details: [] }, neighbors: [], citations: [] });
  }

  const res = await supabaseRpc(URL, KEY, 'get_graph_rag_context', { root_node_id: id, hops_count: 1 });
  if (res.error) return c.json({ error: 'node fetch failed', detail: res.error }, 502);

  const rows = res.data || [];
  let node = { id, title: id, summary: '', details: [], type: '', status: 'approved' };
  const neighbors = {};
  const citations = [];
  const seenPassage = new Set();

  for (const r of rows) {
    if (r.node_id === id) {
      node = { id, title: r.node_title, summary: r.node_summary, details: r.node_details || [], type: r.node_type, status: 'approved' };
    } else if (r.node_id && !neighbors[r.node_id]) {
      neighbors[r.node_id] = { id: r.node_id, title: r.node_title, type: r.node_type, relationship: r.relationship_type };
    }
    if (r.passage_id && !seenPassage.has(r.passage_id)) {
      seenPassage.add(r.passage_id);
      citations.push({ document: r.document_title, authority: r.issuing_authority, page: r.page_number, section: r.section_label });
    }
  }

  return c.json({ node, neighbors: Object.values(neighbors), citations });
}

// ── Landing page data (departments + schemes + recent) in one call ───────────
export async function handleHome(c) {
  const URL = c.env.SUPABASE_URL;
  const KEY = c.env.SUPABASE_ANON_KEY;
  if (!URL || !KEY) return c.json(demoHome());

  const res = await supabaseRpc(URL, KEY, 'get_home_data', { scheme_limit: 8, recent_limit: 6 });
  if (res.error || !res.data) return c.json(demoHome());
  return c.json(res.data);
}

function demoHome() {
  return {
    departments: [
      { id: 'dept-finance', title: 'Finance Department' },
      { id: 'dept-health', title: 'Health and Family Welfare Department' },
      { id: 'dept-revenue', title: 'Revenue and Disaster Management Department' },
      { id: 'dept-social-welfare', title: 'Social Welfare and Women Empowerment Department' },
    ],
    schemes: [
      { id: 'widow-pension-scheme', title: 'Kalaignar Magalir Urimai Thittam', department: 'Social Welfare and Women Empowerment Department' },
    ],
    recent: [],
  };
}

// ── Feedback capture ─────────────────────────────────────────────────────────
export async function handleFeedback(c) {
  const b = await c.req.json().catch(() => ({}));
  const URL = c.env.SUPABASE_URL;
  const KEY = c.env.SUPABASE_ANON_KEY;
  if (!URL || !KEY) return c.json({ ok: true });   // demo mode: accept, no-op
  const res = await supabaseRpc(URL, KEY, 'add_feedback', {
    p_query: b.query || '', p_answer: b.answer || '', p_rating: b.rating || '', p_detail: b.detail || '',
  });
  return c.json({ ok: !res.error });
}

// ── Supabase RPC helper (native fetch; no supabase-js) ───────────────────────
async function supabaseRpc(url, anonKey, fnName, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { data: null, error: `HTTP ${res.status}: ${await res.text()}` };
  return { data: await res.json(), error: null };
}

// ── Demo fallback graph (when Supabase secrets are not bound) ─────────────────
function demoGraph() {
  return {
    nodes: [
      { id: 'widow-pension-scheme', type: 'scheme', title: 'Kalaignar Magalir Urimai Thittam', summary: 'Monthly assistance for women heads of households.', status: 'approved', degree: 1 },
      { id: 'dept-social-welfare', type: 'department', title: 'Social Welfare & Women Empowerment Dept', summary: 'Administers social welfare schemes.', status: 'approved', degree: 1 },
    ],
    edges: [{ id: 'e1', from: 'widow-pension-scheme', to: 'dept-social-welfare', relationship: 'governed_by' }],
  };
}
