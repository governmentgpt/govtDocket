const data = {
  topics: [
    'Property Registration', 'Pension', 'Farmer Subsidy', 'EB Connection',
    'Scholarships', 'Health Insurance', 'Women Welfare', 'Patta',
  ],
  schemes: [
    { name: 'Kalaignar Magalir Urimai Thittam', dept: 'Social Welfare and Women Empowerment', updated: 'Official source pending connection' },
    { name: 'Chief Minister’s Comprehensive Health Insurance', dept: 'Health and Family Welfare', updated: 'Official source pending connection' },
    { name: 'Farmer Income Support', dept: 'Agriculture and Farmers Welfare', updated: 'Official source pending connection' },
    { name: 'Domestic Electricity Services', dept: 'Energy Department', updated: 'Official source pending connection' },
  ],
  releases: [
    ['GOVERNMENT ORDER', 'Newly published Government Orders will appear here after source verification.'],
    ['POLICY UPDATE', 'Policy amendments and their effective dates will be added to the governed timeline.'],
    ['PUBLIC NOTICE', 'Official department notices will be available with original source links.'],
  ],
  categories: ['Education', 'Health', 'Revenue', 'Agriculture', 'Finance', 'Transport', 'Women Welfare', 'Labour', 'Housing', 'Industry', 'Environment'],
};

const graph = {
  root: 'education-topic',
  nodes: {
    'education-topic': {
      title: 'School examination information',
      kicker: 'EDUCATION TOPIC',
      type: 'topic',
      status: 'Needs source connection',
      summary: 'This demonstration node shows how WikiGov will organise an education-related question into verified updates, notices, schedules, and official references. The production answer will be generated only from approved Tamil Nadu sources.',
      details: ['Use the map to inspect connected information.', 'Every production node will carry an approving authority and exact source passage.', 'Unverified information will not be presented as fact.'],
      sources: [
        ['Source registry required', 'Official department source will be attached after review'],
      ],
    },
    'official-notice': {
      title: 'Official examination notice', kicker: 'OFFICIAL NOTICE', type: 'document', status: 'Proposed',
      summary: 'Official notices will be captured as versioned documents. The source viewer will identify the publishing authority, document date, capture time, and the exact cited passage.',
      details: ['Original document preserved as an immutable capture.', 'OCR text is linked back to page and paragraph.', 'Publication requires a source-policy and stewardship check.'],
      sources: [['Directorate / department', 'Approval pending for demonstration content']],
    },
    'exam-schedule': {
      title: 'Examination schedule', kicker: 'SCHEDULE', type: 'event', status: 'Proposed',
      summary: 'A schedule node represents a specific official date or time window. It can be amended, superseded, or marked complete without rewriting previous history.',
      details: ['Effective dates appear in the timeline.', 'Any revised schedule links to its earlier version.', 'The public view always shows its verification status.'],
      sources: [['Official schedule', 'Will be cited to the issuing document']],
    },
    'results-update': {
      title: 'Results update', kicker: 'RESULT UPDATE', type: 'event', status: 'Proposed',
      summary: 'Results information is connected to the relevant examination and official notice, so citizens can understand which result, publication date, and authority are being referenced.',
      details: ['Related results can be navigated by year and examination.', 'Date/time is drawn from the official publication.'],
      sources: [['Result publication', 'Will be cited to the official source']],
    },
    'department': {
      title: 'School Education Department', kicker: 'DEPARTMENT', type: 'department', status: 'Directory verified',
      summary: 'Department nodes provide the accountable publisher, official web presence, associated schemes, and the steward responsible for maintaining connected knowledge.',
      details: ['Department ownership is explicit.', 'Source policies control what can be captured and republished.'],
      sources: [['Tamil Nadu department registry', 'Official directory connection required']],
    },
    'policy-history': {
      title: 'Policy and examination history', kicker: 'TIMELINE', type: 'history', status: 'Proposed',
      summary: 'This node groups approved policy changes, historical notices, and superseded documents without presenting older material as the current rule.',
      details: ['Each point has valid-from and valid-to dates.', 'Superseded information stays available for traceability.'],
      sources: [['Versioned document chain', 'Source evidence required']],
    },
    'widow-pension-scheme': {
      title: 'Kalaignar Magalir Urimai Thittam',
      kicker: 'SCHEME BENEFIT',
      type: 'scheme',
      status: 'Source verified',
      summary: 'This scheme provides monthly financial assistance of Rs. 1,000 to eligible women heads of households in Tamil Nadu, governed by G.O. (Ms) No. 118.',
      details: [
        'Must be a permanent resident of Tamil Nadu.',
        'Must be above 21 years of age.',
        'Annual household income must be below Rs. 2.5 Lakhs.',
        'Required documents: Aadhaar Card, Smart Family Card, Income Certificate.'
      ],
      sources: [
        ['G.O. (Ms) No. 118, Dated 14.07.2026', 'Social Welfare and Women Empowerment Department Guidelines (Page 2-3)']
      ]
    },
    'dept-social-welfare': {
      title: 'Social Welfare & Women Empowerment Dept',
      kicker: 'DEPARTMENT',
      type: 'department',
      status: 'Directory verified',
      summary: 'State department responsible for formulating policies and guidelines for social assistance, women empowerment, and managing schemes like Kalaignar Magalir Urimai Thittam.',
      details: [
        'Responsible for scheme guidelines publishing.',
        'Manages registration camps and application validation queues.'
      ],
      sources: [
        ['Tamil Nadu Department Registry', 'Official directory connection verified']
      ]
    }
  },
  edges: [
    ['education-topic', 'official-notice', 'published through', 0.95],
    ['education-topic', 'exam-schedule', 'has schedule', 0.82],
    ['education-topic', 'results-update', 'has result', 0.76],
    ['education-topic', 'department', 'governed by', 0.9],
    ['education-topic', 'policy-history', 'has history', 0.65],
    ['official-notice', 'exam-schedule', 'announces', 0.73],
    ['exam-schedule', 'results-update', 'precedes', 0.58],
    ['widow-pension-scheme', 'dept-social-welfare', 'governed by', 0.95]
  ],
};

// Live API base URL. Set window.WIKIGOV_API_URL in index.html to the deployed
// Worker origin (e.g. https://wikigov-api.<subdomain>.workers.dev). When empty,
// the UI runs on the built-in demonstration data.
const API_BASE_URL = (typeof window !== 'undefined' && window.WIKIGOV_API_URL) || '';

const state = {
  screen: 'home', lang: 'EN', query: '', selected: graph.root,
  mapOpen: (typeof window !== 'undefined' ? window.innerWidth > 820 : true),   // closed by default on mobile so chat shows
  turns: [],   // conversational history: [{ query, answer, citations, graph, loading }]
  sessionGraph: { nodes: {}, edges: {} },   // cumulative map across the conversation
  home: null,  // { departments, schemes, recent } from /api/home
  sourceView: null,   // citation currently shown in the source viewer overlay
};

// Source viewer overlay — shows a citation's original passage + link to the doc.
function renderSourceOverlay() {
  const c = state.sourceView;
  if (!c) return '';
  const meta = [c.authority, c.page ? `Page ${c.page}` : '', c.section].filter(Boolean).map(esc).join(' · ');
  return `<div class="source-overlay" data-src-close><div class="source-modal">
    <button class="source-close" data-src-close aria-label="Close">✕</button>
    <span class="drawer-type">SOURCE</span>
    <h3>${esc(c.document || 'Source')}</h3>
    ${meta ? `<div class="source-meta">${meta}</div>` : ''}
    <p class="source-text">${esc(c.text || 'The original passage text is not available for this citation.')}</p>
    ${c.url ? `<a class="source-open" href="${esc(c.url)}" target="_blank" rel="noopener">Open original document ${icon('external')}</a>` : ''}
  </div></div>`;
}

async function sendFeedback(idx, rating) {
  const turn = state.turns[idx];
  if (!turn) return;
  const row = document.getElementById(`fb-${idx}`);
  if (row) row.innerHTML = '<span>Thanks — your feedback was recorded.</span>';
  if (!API_BASE_URL) return;
  try {
    await fetch(`${API_BASE_URL}/api/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: turn.query, answer: turn.answer, rating }),
    });
  } catch (e) { /* non-blocking */ }
}

// ── Landing page data (real when the API is configured, else demo) ─────────────
async function loadHome() {
  if (!API_BASE_URL) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/home`);
    if (!res.ok) return;
    const h = await res.json();
    if (h && (h.departments?.length || h.schemes?.length || h.recent?.length)) {
      state.home = h;
      if (state.screen === 'home') render();
    }
  } catch (e) { /* keep demo data */ }
}

// Resolves each landing section to real data, falling back to demo per-section.
function homeData() {
  const h = state.home;
  const schemes = (h && h.schemes) || [];
  const depts = (h && h.departments) || [];
  const recent = (h && h.recent) || [];
  const topics = schemes.slice(0, 8).map((s) => s.title);
  return {
    topics: topics.length ? topics : data.topics,
    schemes: schemes.length
      ? schemes.slice(0, 4).map((s) => ({ name: s.title, dept: s.department || 'Government of Tamil Nadu', updated: '' }))
      : data.schemes,
    releases: recent.length
      ? recent.slice(0, 4).map((r) => [(r.doc_type || 'Document').toUpperCase(), r.title, r.date])
      : data.releases.map(([t, title]) => [t, title, '']),
    categories: depts.length ? depts.map((d) => d.title) : data.categories,
    live: !!(h && (schemes.length || depts.length || recent.length)),
  };
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); } catch (e) { return d; }
}

function shorten(s, n = 28) { return s && s.length > n ? `${s.slice(0, n - 1)}…` : s; }

// ── Live retrieval API ─────────────────────────────────────────────────────────
async function askApi(query, history) {
  const res = await fetch(`${API_BASE_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, history }),   // history gives follow-ups context
  });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json();   // { answer, citations:[], graph:{ nodes:[], edges:[] } }
}

// Accumulates each turn's graph into the session map so the view navigates/grows
// across follow-ups instead of resetting each question.
function mergeSession(g) {
  (g.nodes || []).forEach((n) => { state.sessionGraph.nodes[n.id] = n; });
  (g.edges || []).forEach((e) => { state.sessionGraph.edges[e.id || `${e.from}>${e.to}>${e.relationship}`] = e; });
}

// Builds a small subgraph from the built-in demo data (for the no-API mode).
function demoSubgraph(nodeId) {
  const nodes = {};
  const edges = [];
  const add = (id) => { const n = graph.nodes[id]; if (n) nodes[id] = { id, type: n.type, title: n.title, summary: n.summary, details: n.details }; };
  add(nodeId);
  graph.edges.forEach(([from, to, rel], i) => {
    if (from === nodeId || to === nodeId) { add(from); add(to); edges.push({ id: 'e' + i, from, to, relationship: rel }); }
  });
  return { nodes: Object.values(nodes), edges };
}

// Appends a new turn to the conversation and answers it (live API or demo).
async function runQuery(query) {
  const turn = { query, answer: '', citations: [], graph: { nodes: [], edges: [] }, loading: true };
  state.turns.push(turn);
  state.screen = 'workspace';
  render();

  if (!API_BASE_URL) {
    const nodeId = resolveVectorlessRAG(query);
    const node = graph.nodes[nodeId] || graph.nodes[graph.root];
    turn.answer = node.summary;
    turn.citations = (node.sources || []).map(([name]) => ({ document: name }));
    turn.graph = demoSubgraph(nodeId);
    mergeSession(turn.graph);
    turn.loading = false;
    return render();
  }
  try {
    const history = state.turns.slice(0, -1).slice(-3)
      .flatMap((t) => [{ role: 'user', text: t.query }, { role: 'assistant', text: t.answer }]);
    const data = await askApi(query, history);
    turn.answer = data.answer;
    turn.citations = data.citations || [];
    turn.graph = data.graph || { nodes: [], edges: [] };
    mergeSession(turn.graph);
  } catch (err) {
    turn.answer = `The knowledge service is unavailable right now (${err.message}).`;
  } finally {
    turn.loading = false;
    render();
  }
}

const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function icon(name) {
  const paths = {
    search: '<path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h6"/>',
    map: '<path d="m9 18-5.2 2.6A.5.5 0 0 1 3 20.2V5.8a.5.5 0 0 1 .3-.5L9 2.5l6 3 5.2-2.6a.5.5 0 0 1 .8.4v14.4a.5.5 0 0 1-.3.5L15 21.5Zm0-15.5v15.5m6-12.5v16"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function renderHeader() {
  return `<header class="site-header">
    <button class="brand" data-action="home" aria-label="WikiGov home">
      <span class="brand-mark">W</span><span><b>WikiGov</b><small>Government Knowledge Platform</small></span>
    </button>
    <nav class="top-nav"><button class="${state.screen === 'home' ? 'active' : ''}" data-action="home">Home</button><button class="${state.screen === 'explore' ? 'active' : ''}" data-action="explore">Explore</button></nav>
    <div class="header-actions">
      <div class="language-toggle" aria-label="Language selection"><button class="${state.lang === 'EN' ? 'active' : ''}" data-lang="EN">EN</button><button class="${state.lang === 'TA' ? 'active' : ''}" data-lang="TA">தமிழ்</button></div>
      <span class="public-pill"><i></i> Public access</span>
    </div>
  </header>`;
}

function renderHome() {
  const h = homeData();
  return `<main class="home-page">
    <section class="hero">
      <div class="hero-copy"><p class="eyebrow light">TAMIL NADU · PUBLIC ACCESS</p><h1>Search verified<br />Government Knowledge.</h1><p>Ask in simple language. Every production answer will be traceable to an approved Government Order, Act, circular, notification, or department source.</p></div>
      <form class="hero-search" id="search-form">
        ${icon('search')}<input id="hero-query" value="${esc(state.query)}" autocomplete="off" placeholder="Ask about schemes, GO, Acts, departments, applications..." aria-label="Ask WikiGov" />
        <button type="submit">Ask ${icon('arrow')}</button>
      </form>
      <div class="topic-row"><span>Popular topics</span>${h.topics.map((topic) => `<button class="topic-chip" data-query="${esc(topic)}">${esc(shorten(topic))}</button>`).join('')}</div>
    </section>
    <section class="content-section schemes-section"><div class="section-heading"><div><p class="eyebrow">START HERE</p><h2>Explore Government services</h2><p>Designed around everyday citizen questions.</p></div><button class="text-button" data-action="explore">Open knowledge map ${icon('arrow')}</button></div>
      <div class="scheme-grid">${h.schemes.map((scheme) => `<button class="scheme-card" data-query="${esc(scheme.name)}"><span class="official-dot"><i></i> GOVERNMENT SERVICE</span><strong>${esc(scheme.name)}</strong><span>${esc(scheme.dept)}</span>${scheme.updated ? `<small>${esc(scheme.updated)}</small>` : ''}</button>`).join('')}</div>
    </section>
    <section class="content-section release-section"><div class="section-heading"><div><p class="eyebrow">LIVE GOVERNMENT RECORD</p><h2>Recently updated</h2><p>${h.live ? 'Latest approved Government documents.' : 'Verified updates will appear here as sources are approved.'}</p></div></div>
      <div class="release-list">${h.releases.map(([type, title, date]) => `<div class="release-item">${date ? `<time>${esc(fmtDate(date))}</time>` : '<time>COMING<br />SOON</time>'}<span class="timeline-dot"></span><div><b>${esc(type)}</b><p>${esc(title)}</p></div><button aria-label="Explore" data-query="${esc(title)}">${icon('arrow')}</button></div>`).join('')}</div>
    </section>
    <section class="content-section category-section"><p class="eyebrow">BROWSE BY DEPARTMENT</p><h2>Find the right starting point</h2><div class="category-grid">${h.categories.map((category) => `<button data-query="${esc(category)}">${esc(shorten(category, 34))} ${icon('arrow')}</button>`).join('')}</div></section>
    <footer><span>${h.live ? 'Answers are grounded in approved Tamil Nadu Government sources.' : 'This interface uses demonstration data until official sources are connected and approved.'}</span><div><a href="#">Source policy</a><a href="#">Accessibility</a><a href="#">Privacy</a></div></footer>
  </main>`;
}

function nodePosition(id) {
  return {
    'education-topic': [52, 47], 'official-notice': [27, 22], 'exam-schedule': [78, 25],
    'results-update': [83, 64], 'department': [27, 72], 'policy-history': [54, 84],
    'widow-pension-scheme': [40, 50], 'dept-social-welfare': [15, 48]
  }[id];
}

function renderMap() {
  const selected = state.selected;
  const lines = graph.edges.map(([from, to, label, strength]) => {
    const [x1, y1] = nodePosition(from); const [x2, y2] = nodePosition(to);
    return `<g class="graph-edge ${from === selected || to === selected ? 'connected' : ''}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${1 + strength * 2.8}"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 2}">${label}</text></g>`;
  }).join('');
  const nodes = Object.entries(graph.nodes).map(([id, node]) => {
    const [x, y] = nodePosition(id); const active = id === selected;
    return `<g class="graph-node ${node.type} ${active ? 'selected' : ''}" data-node="${id}" tabindex="0" role="button" aria-label="Explore ${esc(node.title)}"><circle cx="${x}" cy="${y}" r="${active ? 7.2 : 4.8}"/><circle class="halo" cx="${x}" cy="${y}" r="${active ? 11.5 : 0}"/><text x="${x}" y="${y + (active ? 12 : 9)}">${esc(node.title)}</text></g>`;
  }).join('');
  return `<section class="knowledge-map" aria-label="Interactive knowledge map">
    <div class="map-grid"></div><div class="map-glow glow-one"></div><div class="map-glow glow-two"></div>
    <div class="map-heading"><div><span class="map-kicker">KNOWLEDGE MAP</span><strong>Explore verified connections</strong></div><button class="map-info" title="The map shows approved connections between information.">${icon('info')}</button></div>
    <div class="map-legend"><span><i class="legend-active"></i> Active topic</span><span><i class="legend-doc"></i> Official source</span><span><i class="legend-event"></i> Event / update</span></div>
    <svg class="graph-canvas" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-label="Knowledge graph. Select a node to explore its verified information.">${lines}${nodes}</svg>
    <div class="map-controls"><button data-map="fit" title="Fit map">⌘</button><button data-map="zoom-in" title="Zoom in">+</button><button data-map="zoom-out" title="Zoom out">−</button></div>
    <p class="map-hint">Drag to navigate · Select a node to inspect</p>
  </section>`;
}

function renderSources(node) {
  return `<section class="source-panel"><div class="panel-label">SOURCE EVIDENCE</div><div class="source-status"><span class="status-dot"></span><span>${esc(node.status)}</span></div>${node.sources.map(([name, desc]) => `<div class="source-card"><div class="source-icon">${icon('file')}</div><div><b>${esc(name)}</b><p>${esc(desc)}</p></div><button title="Open source">${icon('external')}</button></div>`).join('')}<p class="source-note">Production nodes show the original source, exact citation, review status, and capture time.</p></section>`;
}

function renderTurn(turn, idx, isLatest) {
  const user = `<div class="user-message">${esc(turn.query)}</div>`;
  if (turn.loading) {
    return `${user}<article class="answer-card"><div class="answer-head"><span class="answer-mark">W</span><div><b>WikiGov verified answer</b><small>Retrieving verified sources…</small></div></div><p class="answer-lead">Searching the approved knowledge base…</p></article>`;
  }
  const citeStrip = (turn.citations || []).slice(0, 8).map((c, j) =>
    `<button class="citation-chip" data-cite="${idx}:${j}">${icon('file')} ${esc(c.document || 'Source')}${c.page ? `, p.${esc(c.page)}` : ''}</button>`
  ).join('');
  const related = isLatest ? (turn.graph?.nodes || []).slice(0, 6).map((n) =>
    `<button data-query="${esc(n.title || n.id)}">${esc(n.title || n.id)}</button>`
  ).join('') : '';
  return `${user}<article class="answer-card"><div class="answer-head"><span class="answer-mark">W</span><div><b>WikiGov verified answer</b><small>Grounded in approved Tamil Nadu sources</small></div><span class="answer-badge">${icon('info')} Live</span></div>
      <p class="answer-lead">${esc(turn.answer || 'No verified information was found.')}</p>
      ${citeStrip ? `<div class="citation-strip">${citeStrip}</div>` : ''}
      <div class="answer-feedback" id="fb-${idx}"><span>Is this helpful?</span><button data-fb="helpful" data-turn="${idx}">Helpful</button><button data-fb="needs improvement" data-turn="${idx}">Needs improvement</button><button class="report" data-fb="report issue" data-turn="${idx}">Report issue</button></div>
    </article>
    ${related ? `<div class="followups"><span>Related</span>${related}</div>` : ''}`;
}

function renderWorkspace() {
  const latest = state.turns[state.turns.length - 1];
  const chat = state.turns.length
    ? state.turns.map((t, i) => renderTurn(t, i, i === state.turns.length - 1)).join('')
    : `<div class="empty-chat">Ask a question to begin exploring verified Government knowledge.</div>`;
  const railHistory = state.turns.length
    ? state.turns.map((t, i) => `<button class="conversation ${i === state.turns.length - 1 ? 'active' : ''}"><span class="conversation-icon">${icon('search')}</span><span>${esc((t.query || '').slice(0, 40))}</span></button>`).join('')
    : '<button class="conversation active"><span>New conversation</span></button>';
  return `<main class="workspace">
    <aside class="conversation-rail"><div class="rail-top"><span class="panel-label">CONVERSATION</span><button class="new-chat" data-action="new-chat">+ New search</button></div>${railHistory}<div class="rail-bottom"><span class="lock-icon">⌁</span><p>No account required.<br /><small>Private conversations stay in this browser.</small></p></div></aside>
    <section class="chat-stage">
      <div class="workspace-mobile-title"><button data-action="home">←</button><span>WikiGov workspace</span><button data-toggle-map>${icon('map')}</button></div>
      <div class="chat-scroll" id="chat-scroll">${chat}</div>
      <form class="composer" id="chat-form"><textarea id="chat-query" rows="1" placeholder="Ask a follow-up or a new question..." aria-label="Ask a follow-up"></textarea><button type="submit" aria-label="Send question">${icon('send')}</button><small>WikiGov will answer only from approved source material.</small></form>
    </section>
    <aside class="map-rail ${state.mapOpen ? '' : 'closed'}"><section class="knowledge-map" aria-label="3D knowledge map"><div class="map-heading"><div><span class="map-kicker">KNOWLEDGE MAP</span><strong>Nearest and related nodes</strong></div></div><div id="graph3d" class="graph3d-canvas"></div><p class="map-hint">Drag to rotate · scroll to zoom · click a node to focus</p></section></aside>
  </main>`;
}

// Renders the live subgraph into a WebGL 3D force graph (loaded via CDN in
// index.html). Silently no-ops if the library or container is unavailable.
function initGraph3D() {
  if (state.screen !== 'workspace' || typeof window.ForceGraph3D !== 'function') return;
  const el = document.getElementById('graph3d');
  if (!el || el.__built) return;
  el.__built = true;
  // Cumulative session map: this turn's nodes are highlighted; earlier ones stay dimmed.
  const latest = state.turns[state.turns.length - 1];
  const recent = new Set((latest?.graph?.nodes || []).map((n) => n.id));
  const nodes = Object.values(state.sessionGraph.nodes).map((n) => ({ id: n.id, name: n.title || n.id, type: n.type, recent: recent.has(n.id) }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = Object.values(state.sessionGraph.edges)
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, label: e.relationship }));
  if (!nodes.length) { el.innerHTML = '<p class="map-hint" style="padding:1rem">Ask a question to populate the map.</p>'; return; }
  const fg = window.ForceGraph3D()(el)
    .backgroundColor('rgba(0,0,0,0)')
    .graphData({ nodes, links })
    .nodeVal((n) => (n.recent ? 6 : 2))
    .nodeColor((n) => (n.recent ? (TYPE_COLORS[n.type] || '#8aa0b4') : '#4b5a66'))
    .nodeThreeObjectExtend(true)
    .nodeThreeObject((n) => {
      if (typeof window.SpriteText !== 'function') return null;
      const s = new window.SpriteText(n.name);
      s.color = n.recent ? '#eaf3f8' : '#8aa0b4';
      s.textHeight = n.recent ? 5 : 3;
      s.material.depthWrite = false;
      return s;
    })
    .linkColor(() => 'rgba(150,180,205,0.3)')
    .linkLabel('label')
    .linkDirectionalArrowLength(2.5).linkDirectionalArrowRelPos(1)
    .onNodeClick((n) => {
      const dist = 60; const r = 1 + dist / Math.hypot(n.x, n.y, n.z || 1);
      fg.cameraPosition({ x: n.x * r, y: n.y * r, z: (n.z || 0) * r }, n, 1000);
    })
    .width(el.clientWidth)
    .height(el.clientHeight || 340);
}

function screenBody() {
  if (state.screen === 'home') return renderHome();
  if (state.screen === 'explore') return renderExplore();
  return renderWorkspace();
}

let _prevScreen = null;
function render() {
  document.getElementById('app').innerHTML = `${renderHeader()}${screenBody()}${renderSourceOverlay()}`;
  if (state.screen !== _prevScreen) { window.scrollTo(0, 0); _prevScreen = state.screen; }
  bindEvents();
  try { initGraph3D(); } catch (e) { /* graph errors must not block the UI */ }
  try { initExplorer(); } catch (e) { /* ignore */ }
  scrollChatToLatest();
}

// Scrolls the chat container so the newest question sits at the top (answer below).
// Uses container-relative math (robust) + a delayed retry for late layout.
function scrollChatToLatest() {
  const doScroll = () => {
    const scroll = document.getElementById('chat-scroll');
    if (!scroll) return;
    const msgs = scroll.querySelectorAll('.user-message');
    const last = msgs[msgs.length - 1];
    if (last) {
      const delta = last.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
      scroll.scrollTop += delta - 8;
    } else {
      scroll.scrollTop = scroll.scrollHeight;
    }
  };
  requestAnimationFrame(doScroll);
  setTimeout(doScroll, 80);
}

const nodeAliases = {
  'widow-pension-scheme': ['pension', 'magalir', 'urimai', 'kalaignar', 'women', 'benefit', 'eligibility', 'income', 'monthly', 'rs. 1000', 'residents'],
  'dept-social-welfare': ['welfare', 'empowerment', 'social welfare', 'women department'],
  'education-topic': ['education', 'exam', 'school', 'examination', 'class'],
  'official-notice': ['notice', 'announcement', 'official examine'],
  'exam-schedule': ['schedule', 'timetable', 'date', 'dates', 'time window'],
  'results-update': ['result', 'grade', 'marks', 'results update', 'publication'],
  'department': ['school education department', 'education dept', 'education agency'],
  'policy-history': ['history', 'policy', 'amendment', 'timeline', 'supersede', 'validity']
};

function resolveVectorlessRAG(query) {
  const normalized = query.toLowerCase();
  let matchedNode = null;
  let bestScore = 0;
  for (const [nodeId, aliases] of Object.entries(nodeAliases)) {
    for (const alias of aliases) {
      if (normalized.includes(alias)) {
        const score = alias.length;
        if (score > bestScore) {
          bestScore = score;
          matchedNode = nodeId;
        }
      }
    }
  }
  return matchedNode || 'education-topic';
}

function openWorkspace(query = '') {
  if (query) return runQuery(query);
  state.screen = 'workspace'; render();
}

// ── Explore tab: full-graph 3D navigation (Obsidian / Google-Earth style) ─────
// Palette for department clusters — each department + its subtree share one hue.
const CLUSTER_PALETTE = ['#4f9dff', '#38c793', '#f2a03d', '#e06d9c', '#b98cff', '#f2c94c',
  '#63c2c2', '#e0a458', '#7fa8d0', '#d98d5b', '#7bd0a0', '#9cc88b', '#c98cff', '#5bd1c0', '#ff9e6d', '#6dd3ff'];
const DOC_TYPES = new Set(['order', 'event', 'dataset']);
const CHILD_CAP = 50;        // cap for AUTO-opened nodes (keeps the first view clean)
const USER_CHILD_CAP = 300;  // when the user explicitly expands, show (nearly) all children
// Per-type palette for the conversation map (Explore uses cluster colours instead).
const TYPE_COLORS = {
  root: '#ffcf5c', hub: '#5bd1c0', department: '#38c793', scheme: '#4f9dff', order: '#f2a03d',
  event: '#e06d9c', person: '#f2c94c', eligibility: '#e0a458', document_requirement: '#d98d5b',
  act: '#b98cff', budget_line: '#c98d5b', constituency: '#9cc88b', topic: '#8aa0b4',
};

let _fg = null;
let _all = { nodes: {}, edges: [] };   // full graph
let _adj = {};                          // id -> [{id, rel}] (sorted by neighbour degree)
let _expanded = new Set();              // currently-expanded node ids
let _userExpanded = new Set();          // subset the user explicitly clicked → show all children
let _deptOf = {};                       // node id -> owning department id (cluster)
let _deptColor = {};                    // department id -> colour
let _graphNodes = [];                   // currently-visible nodes (sim-mutated with x/y/z)

function nodeSize(n) {
  const base = { root: 16, hub: 11, department: 7, person: 3, scheme: 3 }[n.type] || 2;
  return base + Math.min(8, (n.degree || 0) * 0.3);
}

function nodeColor(n) {
  if (n.status && n.status !== 'approved') return '#4b5a66';
  if (n.type === 'root') return '#ffcf5c';
  if (n.type === 'hub') return '#e8eef2';
  if (n.type === 'department') return _deptColor[n.id] || '#8aa0b4';
  const d = _deptOf[n.id];
  return d ? _deptColor[d] : '#5b6b78';
}

// Build id maps, adjacency, and assign every node to its nearest department (cluster).
function buildIndex(data) {
  _all = { nodes: {}, edges: data.edges || [] };
  (data.nodes || []).forEach((n) => { _all.nodes[n.id] = n; });
  const deg = {};
  _adj = {};
  for (const e of _all.edges) {
    (_adj[e.from] = _adj[e.from] || []).push({ id: e.to, rel: e.relationship });
    (_adj[e.to] = _adj[e.to] || []).push({ id: e.from, rel: e.relationship });
    deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1;
  }
  Object.values(_adj).forEach((list) => list.sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0)));
  _all.deg = deg;

  // cluster assignment: multi-source BFS from departments; root/hub/other-depts are barriers
  _deptOf = {}; _deptColor = {};
  const depts = Object.values(_all.nodes).filter((n) => n.type === 'department').map((n) => n.id);
  depts.forEach((d, i) => { _deptColor[d] = CLUSTER_PALETTE[i % CLUSTER_PALETTE.length]; _deptOf[d] = d; });
  const q = [...depts];
  while (q.length) {
    const id = q.shift();
    for (const nb of (_adj[id] || [])) {
      const n = _all.nodes[nb.id];
      if (!n || _deptOf[nb.id] || n.type === 'root' || n.type === 'hub' || n.type === 'department') continue;
      _deptOf[nb.id] = _deptOf[id];
      q.push(nb.id);
    }
  }
}

// BFS from root/hubs through expanded nodes → the set of nodes to render.
function computeVisible() {
  const visible = new Set();
  const roots = Object.values(_all.nodes).filter((n) => n.type === 'root' || n.type === 'hub');
  if (!roots.length) {                         // demo / no backbone: show a capped slice
    Object.keys(_all.nodes).slice(0, 120).forEach((id) => visible.add(id));
    return visible;
  }
  const q = [];
  roots.forEach((r) => { visible.add(r.id); q.push(r.id); });
  while (q.length) {
    const id = q.shift();
    if (!_expanded.has(id)) continue;
    const cap = _userExpanded.has(id) ? USER_CHILD_CAP : CHILD_CAP;
    let added = 0;
    for (const nb of (_adj[id] || [])) {
      if (added >= cap) break;
      if (!visible.has(nb.id)) { visible.add(nb.id); q.push(nb.id); added++; }
    }
  }
  return visible;
}

function visibleGraph() {
  const vis = computeVisible();
  _graphNodes = [...vis].map((id) => {
    const n = _all.nodes[id];
    const hiddenChildren = (_adj[id] || []).some((nb) => !vis.has(nb.id));
    return {
      id, name: n.title || id, type: n.type, status: n.status, summary: n.summary,
      degree: _all.deg[id] || 0, color: nodeColor(n),
      expandable: hiddenChildren && !_expanded.has(id),
    };
  });
  const links = _all.edges.filter((e) => vis.has(e.from) && vis.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, relationship: e.relationship }));
  return { nodes: _graphNodes, links };
}

function toggleExpand(id) {
  if (_expanded.has(id)) { _expanded.delete(id); _userExpanded.delete(id); }
  else { _expanded.add(id); _userExpanded.add(id); }   // explicit expand → show all children
  if (_fg) _fg.graphData(visibleGraph());
  updateExploreMeta();
}

// Reveal a node (used by search + drawer neighbours): expand its cluster + itself, fly to it.
function revealNode(id) {
  const dept = _deptOf[id];
  if (dept) { _expanded.add(dept); _userExpanded.add(dept); }
  _expanded.add(id); _userExpanded.add(id);
  if (_fg) _fg.graphData(visibleGraph());
  updateExploreMeta();
  setTimeout(() => {
    const nn = _graphNodes.find((n) => n.id === id);
    if (nn) { flyTo(nn); openNodeDrawer(nn); }
  }, 450);
}

function openExplore() { state.live = null; state.screen = 'explore'; render(); }

function renderExplore() {
  return `<main class="explore-page">
    <div class="explore-toolbar">
      <div class="explore-title"><span class="map-kicker">KNOWLEDGE UNIVERSE</span><strong>Explore verified topics</strong></div>
      <input id="explore-search" placeholder="Find a topic…" aria-label="Find a topic" />
      <label class="explore-toggle"><input type="checkbox" id="explore-docs" /> Show documents</label>
      <label class="explore-toggle"><input type="checkbox" id="explore-pending" /> Include unreviewed</label>
      <span id="explore-count" class="explore-count"></span>
    </div>
    <div id="graph-explorer" class="graph-explorer"></div>
    <div id="explore-legend" class="explore-legend"></div>
    <aside id="explore-drawer" class="explore-drawer closed"></aside>
  </main>`;
}

async function loadGraphData(status) {
  if (!API_BASE_URL) return demoGraphData();
  const res = await fetch(`${API_BASE_URL}/api/graph?status=${status}`);
  if (!res.ok) throw new Error(`graph ${res.status}`);
  return res.json();
}

function demoGraphData() {
  const nodes = Object.entries(graph.nodes).map(([id, n]) => ({ id, title: n.title, type: n.type, status: 'approved', summary: n.summary }));
  const edges = graph.edges.map(([from, to, rel]) => ({ from, to, relationship: rel }));
  return { nodes, edges };
}

function filterDocs(data) {
  const nodes = (data.nodes || []).filter((n) => !DOC_TYPES.has(n.type));
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: (data.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to)) };
}

async function loadIndex() {
  const pending = document.getElementById('explore-pending')?.checked;
  const showDocs = document.getElementById('explore-docs')?.checked;
  let data = await loadGraphData(pending ? 'all' : 'approved');
  if (!showDocs) data = filterDocs(data);
  buildIndex(data);
  // start expanded at the root(s) so departments + hubs show; expand hubs too if no root
  _expanded = new Set(Object.values(_all.nodes).filter((n) => n.type === 'root').map((n) => n.id));
  if (!_expanded.size) Object.values(_all.nodes).filter((n) => n.type === 'hub').forEach((n) => _expanded.add(n.id));
  _userExpanded = new Set();
}

async function initExplorer() {
  if (state.screen !== 'explore' || typeof window.ForceGraph3D !== 'function') return;
  const el = document.getElementById('graph-explorer');
  if (!el || el.__built) return;
  el.__built = true;
  try {
    await loadIndex();
    buildExplorer(el);
    wireExploreToolbar();
    updateExploreMeta();
  } catch (err) {
    el.innerHTML = `<p class="explore-empty">Could not load graph: ${esc(err.message)}</p>`;
  }
}

function buildExplorer(el) {
  _fg = window.ForceGraph3D()(el)
    .backgroundColor('#08131f')
    .graphData(visibleGraph())
    .nodeVal(nodeSize)
    .nodeColor((n) => n.color)
    .nodeOpacity(0.95)
    .nodeThreeObjectExtend(true)
    .nodeThreeObject((n) => {
      if (typeof window.SpriteText !== 'function') return null;
      const s = new window.SpriteText(n.expandable ? `${n.name}  ⊕` : n.name);
      s.color = '#e9f2f8';
      s.textHeight = { root: 9, hub: 7, department: 5 }[n.type] || 3.4;
      s.material.depthWrite = false;
      return s;
    })
    .linkColor(() => 'rgba(150,180,205,0.20)')
    .linkDirectionalArrowLength(2.2)
    .linkDirectionalArrowRelPos(1)
    .onNodeClick((node) => { flyTo(node); toggleExpand(node.id); openNodeDrawer(node); })
    .width(el.clientWidth)
    .height(el.clientHeight);
}

function flyTo(node) {
  if (!_fg || node.x === undefined) return;
  const dist = 60;
  const ratio = 1 + dist / Math.hypot(node.x, node.y, node.z || 0.001);
  _fg.cameraPosition({ x: node.x * ratio, y: node.y * ratio, z: (node.z || 0) * ratio }, node, 1200);
}

function updateExploreMeta() {
  const count = document.getElementById('explore-count');
  if (count) count.textContent = `${_graphNodes.length} shown · ${Object.keys(_all.nodes).length} total`;
  const legend = document.getElementById('explore-legend');
  if (legend) legend.innerHTML =
    `<span><i style="background:#ffcf5c"></i>root</span>` +
    `<span><i style="background:#e8eef2"></i>hub</span>` +
    `<span>each colour = a department cluster</span>` +
    `<span>⊕ click a node to expand · click again to collapse</span>`;
}

function wireExploreToolbar() {
  const search = document.getElementById('explore-search');
  if (search) search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = search.value.trim().toLowerCase();
    if (!q) return;
    const hit = Object.values(_all.nodes).find((n) => (n.title || n.id).toLowerCase().includes(q));
    if (hit) revealNode(hit.id);
  });
  const reload = async () => { try { await loadIndex(); if (_fg) _fg.graphData(visibleGraph()); updateExploreMeta(); } catch (e) { /* keep */ } };
  const pending = document.getElementById('explore-pending');
  if (pending) pending.addEventListener('change', reload);
  const docs = document.getElementById('explore-docs');
  if (docs) docs.addEventListener('change', reload);
}

async function openNodeDrawer(node) {
  const drawer = document.getElementById('explore-drawer');
  if (!drawer) return;
  drawer.classList.remove('closed');
  const badge = node.status && node.status !== 'approved' ? ` · ${esc(node.status)}` : '';
  const expandHint = node.expandable ? '<p class="muted">Click the node to expand its connections.</p>' : '';
  drawer.innerHTML = `<button class="drawer-close" id="drawer-close">✕</button>
    <span class="drawer-type">${esc(node.type || 'topic')}${badge}</span>
    <h3>${esc(node.name || node.id)}</h3>
    ${expandHint}
    <div id="drawer-body"><p class="muted">Loading…</p></div>`;
  document.getElementById('drawer-close').onclick = () => drawer.classList.add('closed');
  const body = document.getElementById('drawer-body');

  if (!API_BASE_URL) { body.innerHTML = `<p>${esc(node.summary || 'Demonstration node.')}</p>`; return; }
  try {
    const res = await fetch(`${API_BASE_URL}/api/node?id=${encodeURIComponent(node.id)}`);
    const info = await res.json();
    body.innerHTML = renderDrawerBody(info);
    body.querySelectorAll('[data-node-explore]').forEach((b) => { b.onclick = () => revealNode(b.dataset.nodeExplore); });
    body.querySelectorAll('[data-query]').forEach((b) => { b.onclick = () => runQuery(b.dataset.query); });
  } catch (err) {
    body.innerHTML = `<p class="muted">Details unavailable (${esc(err.message)}).</p>`;
  }
}

function renderDrawerBody(info) {
  const n = info.node || {};
  const details = (n.details || []).map((d) => `<li>${esc(d)}</li>`).join('');
  const neighbors = (info.neighbors || []).map((x) =>
    `<button class="drawer-neighbor" data-node-explore="${esc(x.id)}"><b>${esc(x.title || x.id)}</b><small>${esc(x.relationship || 'linked')} · ${esc(x.type || '')}</small></button>`).join('');
  const cites = (info.citations || []).map((c) =>
    `<div class="drawer-source">${icon('file')} <span>${esc(c.document || 'Source')}${c.page ? `, p.${esc(c.page)}` : ''}</span></div>`).join('');
  return `${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
    ${details ? `<ul class="drawer-details">${details}</ul>` : ''}
    ${neighbors ? `<h4>Connected topics — click to explore</h4><div class="drawer-neighbors">${neighbors}</div>` : ''}
    ${cites ? `<h4>Source artefacts</h4>${cites}` : ''}
    ${n.title ? `<button class="drawer-ask" data-query="${esc(n.title)}">Ask about this ${icon('arrow')}</button>` : ''}`;
}

function bindEvents() {
  document.querySelectorAll('[data-action="home"]').forEach((el) => el.addEventListener('click', () => { state.screen = 'home'; render(); }));
  document.querySelectorAll('[data-action="new-chat"]').forEach((el) => el.addEventListener('click', () => { state.turns = []; state.sessionGraph = { nodes: {}, edges: {} }; state.screen = 'home'; render(); }));
  document.querySelectorAll('[data-action="workspace"]').forEach((el) => el.addEventListener('click', () => openWorkspace()));
  document.querySelectorAll('[data-action="explore"]').forEach((el) => el.addEventListener('click', openExplore));
  document.querySelectorAll('[data-lang]').forEach((el) => el.addEventListener('click', () => { state.lang = el.dataset.lang; render(); }));
  document.querySelectorAll('[data-query]').forEach((el) => el.addEventListener('click', () => runQuery(el.dataset.query)));
  const searchForm = $('#search-form');
  if (searchForm) searchForm.addEventListener('submit', (event) => { event.preventDefault(); const query = $('#hero-query').value.trim(); runQuery(query || 'Help me understand Tamil Nadu school examination information.'); });
  const chatForm = $('#chat-form');
  if (chatForm) chatForm.addEventListener('submit', (event) => { event.preventDefault(); const query = $('#chat-query').value.trim(); if (query) runQuery(query); });
  const chatInput = $('#chat-query');
  if (chatInput) chatInput.addEventListener('keydown', (event) => {
    // Enter (or Ctrl/Cmd+Enter) sends; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const query = chatInput.value.trim();
      if (query) runQuery(query);
    }
  });
  document.querySelectorAll('[data-node]').forEach((el) => el.addEventListener('click', () => { state.selected = el.dataset.node; render(); }));
  document.querySelectorAll('.graph-node').forEach((el) => { el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selected = el.dataset.node; render(); } }); });
  const mapToggle = $('[data-toggle-map]'); if (mapToggle) mapToggle.addEventListener('click', () => { state.mapOpen = !state.mapOpen; render(); });
  // Clickable citations → source viewer
  document.querySelectorAll('[data-cite]').forEach((el) => el.addEventListener('click', () => {
    const [i, j] = el.dataset.cite.split(':').map(Number);
    const c = state.turns[i] && state.turns[i].citations && state.turns[i].citations[j];
    if (c) { state.sourceView = c; render(); }
  }));
  document.querySelectorAll('[data-src-close]').forEach((el) => el.addEventListener('click', () => { state.sourceView = null; render(); }));
  const srcModal = $('.source-modal'); if (srcModal) srcModal.addEventListener('click', (e) => e.stopPropagation());
  // Feedback capture
  document.querySelectorAll('[data-fb]').forEach((el) => el.addEventListener('click', () => sendFeedback(Number(el.dataset.turn), el.dataset.fb)));
}

render();
loadHome();   // fetch real landing-page data (departments / schemes / recent), then re-render
