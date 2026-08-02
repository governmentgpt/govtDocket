/**
 * Closed-book grounding eval (feature #4).
 *
 * Off-corpus questions MUST refuse ("No verified information was found") — if the
 * model answers them, it's using parametric memory, not the RAG. In-corpus
 * questions MUST answer (and, with citation-ID binding, be grounded).
 *
 * Usage:
 *   WIKIGOV_API_URL=https://wikigov-api.<sub>.workers.dev node worker/eval/grounding.mjs
 *
 * Edit the two lists for your corpus. Exit code is non-zero if any check fails.
 */

const API = process.env.WIKIGOV_API_URL;
if (!API) { console.error('Set WIKIGOV_API_URL'); process.exit(2); }

// Should REFUSE — not in the TN government corpus:
const MUST_REFUSE = [
  'what is the capital of France',
  'who won the 2010 FIFA world cup',
  'write me a poem about the moon',
];
// Should ANSWER — in the corpus (adjust to your approved data):
const MUST_ANSWER = [
  'who is the finance minister',
  'social welfare scheme eligibility',
];

const REFUSAL = /no verified information was found/i;

async function ask(q) {
  const r = await fetch(`${API}/api/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  return (await r.json()).answer || '';
}

let failures = 0;
for (const q of MUST_REFUSE) {
  const a = await ask(q);
  const pass = REFUSAL.test(a);
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} [refuse] "${q}" -> ${a.slice(0, 70)}`);
}
for (const q of MUST_ANSWER) {
  const a = await ask(q);
  const pass = !REFUSAL.test(a) && a.length > 0;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} [answer] "${q}" -> ${a.slice(0, 70)}`);
}
console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures ? 1 : 0);
