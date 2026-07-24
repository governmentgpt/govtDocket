/**
 * WikiGov RAG API — Cloudflare Worker entry point
 *
 * Architecture:
 *   Render (static frontend) → Cloudflare Worker (this file) → Supabase (graph DB) → NVIDIA NIM (synthesis)
 *
 * All secrets (SUPABASE_URL, SUPABASE_ANON_KEY, NVIDIA_API_KEY) are bound as
 * Cloudflare encrypted secrets via `wrangler secret put`. They are accessed
 * through the `env` parameter — they are NEVER in source code or .env files.
 *
 * Routing (Hono):
 *   GET  /api/query?q=<text>   — vectorless RAG retrieval + grounded answer
 *   GET  /api/health            — health check for monitoring
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleQuery } from './routes/query.js';

const app = new Hono();

// ── CORS ────────────────────────────────────────────────────────────────────
// Allow requests from the Render frontend and any preview URLs.
// Tighten `origin` to your exact Render domain once it is stable.
app.use('*', cors({
  origin: [
    'https://govt-docket-ui.onrender.com',
    'http://localhost:8000',           // local frontend dev
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'wikigov-api', version: '1.0.0' });
});

// ── RAG Query ────────────────────────────────────────────────────────────────
app.get('/api/query', handleQuery);
app.post('/api/query', handleQuery);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ── Error handler ─────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[Worker Error]', err.message);
  return c.json({ error: 'Internal server error', detail: err.message }, 500);
});

export default app;
