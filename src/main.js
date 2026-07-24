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

const state = {
  screen: 'home', lang: 'EN', query: '', selected: graph.root, mapOpen: true,
  messages: [{ role: 'user', text: 'Help me understand Tamil Nadu school examination information.' }],
};

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
    <div class="header-actions">
      <div class="language-toggle" aria-label="Language selection"><button class="${state.lang === 'EN' ? 'active' : ''}" data-lang="EN">EN</button><button class="${state.lang === 'TA' ? 'active' : ''}" data-lang="TA">தமிழ்</button></div>
      <span class="public-pill"><i></i> Public access</span>
    </div>
  </header>`;
}

function renderHome() {
  return `<main class="home-page">
    <section class="hero">
      <div class="hero-copy"><p class="eyebrow light">TAMIL NADU · PUBLIC ACCESS</p><h1>Search verified<br />Government Knowledge.</h1><p>Ask in simple language. Every production answer will be traceable to an approved Government Order, Act, circular, notification, or department source.</p></div>
      <form class="hero-search" id="search-form">
        ${icon('search')}<input id="hero-query" value="${esc(state.query)}" autocomplete="off" placeholder="Ask about schemes, GO, Acts, departments, applications..." aria-label="Ask WikiGov" />
        <button type="submit">Ask ${icon('arrow')}</button>
      </form>
      <div class="topic-row"><span>Popular topics</span>${data.topics.map((topic) => `<button class="topic-chip" data-query="${esc(topic)}">${esc(topic)}</button>`).join('')}</div>
    </section>
    <section class="content-section schemes-section"><div class="section-heading"><div><p class="eyebrow">START HERE</p><h2>Explore Government services</h2><p>Designed around everyday citizen questions.</p></div><button class="text-button" data-action="workspace">Open knowledge workspace ${icon('arrow')}</button></div>
      <div class="scheme-grid">${data.schemes.map((scheme) => `<button class="scheme-card" data-query="${esc(scheme.name)}"><span class="official-dot"><i></i> GOVERNMENT SERVICE</span><strong>${esc(scheme.name)}</strong><span>${esc(scheme.dept)}</span><small>${esc(scheme.updated)}</small></button>`).join('')}</div>
    </section>
    <section class="content-section release-section"><div class="section-heading"><div><p class="eyebrow">LIVE GOVERNMENT RECORD</p><h2>Recently updated policies</h2><p>Verified updates will appear here as sources are approved.</p></div></div>
      <div class="release-list">${data.releases.map(([type, title], index) => `<div class="release-item"><time>COMING<br />SOON</time><span class="timeline-dot"></span><div><b>${type}</b><p>${title}</p></div><button aria-label="Explore ${type}" data-action="workspace">${icon('arrow')}</button></div>`).join('')}</div>
    </section>
    <section class="content-section category-section"><p class="eyebrow">BROWSE BY TOPIC</p><h2>Find the right starting point</h2><div class="category-grid">${data.categories.map((category) => `<button data-query="${esc(category)}">${esc(category)} ${icon('arrow')}</button>`).join('')}</div></section>
    <footer><span>This interface uses demonstration data until official sources are connected and approved.</span><div><a href="#">Source policy</a><a href="#">Accessibility</a><a href="#">Privacy</a></div></footer>
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

function renderWorkspace() {
  const node = graph.nodes[state.selected];
  return `<main class="workspace">
    <aside class="conversation-rail"><div class="rail-top"><span class="panel-label">CONVERSATION</span><button class="new-chat" data-action="home">+ New search</button></div><button class="conversation active"><span class="conversation-icon">${icon('search')}</span><span>School examination information<small>Current exploration</small></span></button><div class="rail-group"><span>RECENTLY EXPLORED</span><button class="conversation"><span>Women welfare schemes</span></button><button class="conversation"><span>Property registration process</span></button><button class="conversation"><span>Farmer support programmes</span></button></div><div class="rail-bottom"><span class="lock-icon">⌁</span><p>No account required.<br /><small>Private conversations stay in this browser.</small></p></div></aside>
    <section class="chat-stage">
      <div class="workspace-mobile-title"><button data-action="home">←</button><span>WikiGov workspace</span><button data-toggle-map>${icon('map')}</button></div>
      <div class="chat-scroll">
        <div class="user-message">${esc(state.messages[0].text)}</div>
        <article class="answer-card"><div class="answer-head"><span class="answer-mark">W</span><div><b>WikiGov verified answer</b><small>Demonstration response · source connection required</small></div><span class="answer-badge">${icon('info')} Prototype</span></div>
          <p class="answer-lead">${esc(node.summary)}</p>
          <div class="answer-detail"><h3>What this knowledge map can show</h3><ul>${node.details.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
          <div class="citation-strip"><span>${icon('file')} ${esc(node.kicker)}</span><button data-select-source>View source model ${icon('arrow')}</button></div>
          <div class="answer-feedback"><span>Is this helpful?</span><button>Helpful</button><button>Needs improvement</button><button class="report">Report issue</button></div>
        </article>
        <div class="followups"><span>Explore next</span><button data-node="official-notice">Show official notices</button><button data-node="policy-history">Show policy history</button><button data-node="department">Which department owns this?</button></div>
      </div>
      <form class="composer" id="chat-form"><textarea id="chat-query" rows="1" placeholder="Ask a follow-up or a new question..." aria-label="Ask a follow-up"></textarea><button type="submit" aria-label="Send question">${icon('send')}</button><small>WikiGov will answer only from approved source material.</small></form>
    </section>
    <aside class="map-rail ${state.mapOpen ? '' : 'closed'}">${renderMap()}${renderSources(node)}</aside>
  </main>`;
}

function render() {
  document.getElementById('app').innerHTML = `${renderHeader()}${state.screen === 'home' ? renderHome() : renderWorkspace()}`;
  bindEvents();
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
  if (query) {
    state.messages[0].text = query;
    state.selected = resolveVectorlessRAG(query);
  } else {
    state.selected = graph.root;
  }
  state.query = ''; state.screen = 'workspace'; render();
}

function bindEvents() {
  document.querySelectorAll('[data-action="home"]').forEach((el) => el.addEventListener('click', () => { state.screen = 'home'; render(); }));
  document.querySelectorAll('[data-action="workspace"]').forEach((el) => el.addEventListener('click', () => openWorkspace()));
  document.querySelectorAll('[data-lang]').forEach((el) => el.addEventListener('click', () => { state.lang = el.dataset.lang; render(); }));
  document.querySelectorAll('[data-query]').forEach((el) => el.addEventListener('click', () => openWorkspace(`Tell me about ${el.dataset.query}.`)));
  const searchForm = $('#search-form');
  if (searchForm) searchForm.addEventListener('submit', (event) => { event.preventDefault(); const query = $('#hero-query').value.trim(); openWorkspace(query || 'Help me understand Tamil Nadu school examination information.'); });
  const chatForm = $('#chat-form');
  if (chatForm) chatForm.addEventListener('submit', (event) => { event.preventDefault(); const query = $('#chat-query').value.trim(); if (query) { state.messages[0].text = query; state.selected = resolveVectorlessRAG(query); render(); } });
  document.querySelectorAll('[data-node]').forEach((el) => el.addEventListener('click', () => { state.selected = el.dataset.node; render(); }));
  document.querySelectorAll('.graph-node').forEach((el) => { el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selected = el.dataset.node; render(); } }); });
  const mapToggle = $('[data-toggle-map]'); if (mapToggle) mapToggle.addEventListener('click', () => { state.mapOpen = !state.mapOpen; render(); });
}

render();
