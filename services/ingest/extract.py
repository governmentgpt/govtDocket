"""
Relation extraction — turn the thin graph into the real connected model.

For each scheme (default) or GO, reads its passage text and has the LLM pull
structured facts, then writes edges to shared concept nodes:
  eligibility        → has_eligibility → (eligibility node)
  required_documents → requires_document → (document_requirement node)
  process            → appended to the node's details (steps are scheme-specific)

Everything lands 'pending review'. Idempotent: nodes already carrying these edges
are skipped. Run after ingestion; approve the new nodes/edges to publish.

Usage:
  SUPABASE_DB_URL=... LLM_API_KEY=... python extract.py --type scheme --limit 100
"""

import argparse
import json
import re
import uuid

import db
import llm
from slugify import slugify

PROMPT = (
    "From this Tamil Nadu government document, extract ONLY facts explicitly stated. "
    "Return JSON only, no prose:\n"
    '{"eligibility": ["short criterion"], "required_documents": ["document name"], '
    '"process": ["application step"]}\n'
    "Use [] where nothing applies.\n\nDOCUMENT:\n"
)


def _parse_json(s):
    if not s:
        return {}
    m = re.search(r"\{.*\}", s, re.S)
    try:
        return json.loads(m.group(0)) if m else {}
    except Exception:
        return {}


def _concept(node_id, ntype, text):
    t = text.strip()[:200]
    return {
        "id": node_id, "type": ntype,
        "title_en": t, "title_ta": t,
        "summary_en": text.strip()[:400], "summary_ta": text.strip()[:400],
        "details_en": [], "details_ta": [],
        "aliases": [{"alias": t, "lang": "EN"}],
    }


def targets(cur, ntype, limit):
    cur.execute(
        "SELECT n.id, nv.title_en FROM nodes n "
        "JOIN node_versions nv ON nv.node_id = n.id AND nv.valid_to IS NULL "
        "WHERE n.type = %s "
        "AND EXISTS (SELECT 1 FROM documents d WHERE d.node_id = n.id) "
        "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.from_node_id = n.id "
        "                AND e.relationship_type IN ('has_eligibility','requires_document')) "
        "LIMIT %s",
        (ntype, limit),
    )
    return cur.fetchall()


def node_text(cur, node_id):
    cur.execute(
        "SELECT p.id, p.text_content FROM passages p "
        "JOIN document_versions dv ON dv.id = p.version_id "
        "JOIN documents d ON d.id = dv.document_id "
        "WHERE d.node_id = %s ORDER BY p.page_number LIMIT 20",
        (node_id,),
    )
    rows = cur.fetchall()
    text = " ".join(r[1] for r in rows if r[1])[:6000]
    passage_id = rows[0][0] if rows else None
    return text, passage_id


def extract_one(cur, node_id):
    text, passage_id = node_text(cur, node_id)
    if not text or not passage_id:
        return 0
    data = _parse_json(llm.chat(PROMPT + text))
    made = 0

    def link(items, prefix, ntype, rel):
        nonlocal made
        for raw in (items or [])[:8]:
            item = (raw or "").strip()
            if len(item) < 3:
                continue
            cid = f"{prefix}-{slugify(item)[:48]}"
            db.upsert_node(cur, _concept(cid, ntype, item))
            db.upsert_edge(cur, {"id": str(uuid.uuid4()), "from": node_id, "to": cid,
                                 "relationship": rel, "evidence": {"passage_id": passage_id}})
            made += 1

    link(data.get("eligibility"), "eligibility", "eligibility", "has_eligibility")
    link(data.get("required_documents"), "requirement", "document_requirement", "requires_document")

    steps = [s.strip() for s in (data.get("process") or []) if s and s.strip()][:8]
    if steps:
        cur.execute(
            "UPDATE node_versions SET details_en = details_en || %s "
            "WHERE node_id = %s AND valid_to IS NULL",
            ([f"Step: {s}" for s in steps], node_id),
        )
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", default="scheme")
    ap.add_argument("--limit", type=int, default=100)
    args = ap.parse_args()

    conn = db.connect()
    try:
        with conn.cursor() as cur:
            tgts = targets(cur, args.type, args.limit)
        print(f"{len(tgts)} '{args.type}' node(s) to extract relations for.")
        total = 0
        for node_id, title in tgts:
            try:
                with conn.cursor() as cur:
                    made = extract_one(cur, node_id)
                conn.commit()
                total += made
                print(f"  {(title or node_id)[:50]}: +{made} relations")
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                print(f"  ! {(title or node_id)[:50]}: {exc}")
        print(f"\nCreated {total} relation edges (pending review). Approve to publish.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
