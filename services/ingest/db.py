"""
Database writer for WikiGov ingestion (psycopg 3).

All graph writes land as status 'pending review' — nothing this script writes is
ever auto-approved. A steward promotes rows to 'approved' before they become
searchable (get_graph_rag_context only returns approved, current versions).

Every function is idempotent (INSERT ... ON CONFLICT) so re-runs are safe.
"""

import json
import psycopg

from config import require_db_url


def connect():
    return psycopg.connect(require_db_url())


# ── Source + crawl bookkeeping ───────────────────────────────────────────────
def get_source_id(cur, source_key: str):
    cur.execute("SELECT id FROM sources WHERE source_key = %s", (source_key,))
    row = cur.fetchone()
    return row[0] if row else None


def record_discovered(cur, source_id, artifact: dict):
    """Insert a discovered artifact into the work queue (no-op if already seen)."""
    cur.execute(
        """
        INSERT INTO discovered_artifacts
            (source_id, source_url, artifact_type, title, published_date, language, meta)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_url) DO NOTHING
        """,
        (
            source_id, artifact["source_url"], artifact["artifact_type"],
            artifact.get("title"), artifact.get("published_date"),
            artifact.get("language", "EN"), json.dumps(artifact.get("meta", {})),
        ),
    )


def pending_artifacts(cur, source_id, limit=200):
    cur.execute(
        """
        SELECT id, source_url, artifact_type, title, published_date, language, meta
        FROM discovered_artifacts
        WHERE source_id = %s AND status = 'new'
        ORDER BY discovered_at
        LIMIT %s
        """,
        (source_id, limit),
    )
    cols = ["id", "source_url", "artifact_type", "title", "published_date", "language", "meta"]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def set_artifact_status(cur, artifact_id, status, error=None, sha256=None):
    cur.execute(
        """
        UPDATE discovered_artifacts
        SET status = %s, error = %s, sha256 = COALESCE(%s, sha256), updated_at = now()
        WHERE id = %s
        """,
        (status, error, sha256, artifact_id),
    )


def touch_crawl_state(cur, source_id, path, content_hash):
    cur.execute(
        """
        INSERT INTO crawl_state (source_id, path, last_crawled_at, last_content_hash, status)
        VALUES (%s, %s, now(), %s, 'crawled')
        ON CONFLICT (source_id, path) DO UPDATE
        SET last_crawled_at = now(), last_content_hash = EXCLUDED.last_content_hash, status = 'crawled'
        """,
        (source_id, path, content_hash),
    )


# ── Provenance + graph writes ────────────────────────────────────────────────
def upsert_document(cur, source_id, doc):
    cur.execute(
        """
        INSERT INTO documents (id, source_id, original_url, doc_type, issuing_authority, lang, node_id)
        VALUES (%(id)s, %(source_id)s, %(url)s, %(doc_type)s, %(authority)s, %(lang)s, %(node_id)s)
        ON CONFLICT (id) DO NOTHING
        """,
        {**doc, "source_id": source_id},
    )
    cur.execute(
        """
        INSERT INTO document_versions (id, document_id, version_number, title, effective_date, sha256_hash)
        VALUES (%(vid)s, %(id)s, 1, %(title)s, %(effective_date)s, %(hash)s)
        ON CONFLICT (document_id, version_number) DO UPDATE
        SET title = EXCLUDED.title, sha256_hash = EXCLUDED.sha256_hash
        """,
        doc,
    )


def upsert_passages(cur, version_id, passages):
    for p in passages:
        cur.execute(
            """
            INSERT INTO passages (id, version_id, page_number, section_label, text_content, language)
            VALUES (%(id)s, %(vid)s, %(page)s, %(section)s, %(text)s, %(language)s)
            ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content
            """,
            {**p, "vid": version_id},
        )


def upsert_node(cur, node):
    cur.execute(
        "INSERT INTO nodes (id, type) VALUES (%(id)s, %(type)s) ON CONFLICT (id) DO NOTHING",
        node,
    )
    for alias in node.get("aliases", []):
        cur.execute(
            """
            INSERT INTO node_aliases (node_id, alias, language)
            VALUES (%s, %s, %s)
            ON CONFLICT (node_id, alias, language) DO NOTHING
            """,
            (node["id"], alias["alias"], alias["lang"]),
        )
    # If an identical current version already exists, do nothing (avoid churn).
    # Otherwise archive the current pending version and insert the fresh one —
    # this is what REPLACES stale/garbled content on a re-ingest. Approved
    # versions are never touched here (governance: supersede via review).
    cur.execute(
        "SELECT 1 FROM node_versions WHERE node_id=%(id)s AND valid_to IS NULL "
        "AND title_en=%(title_en)s AND summary_en=%(summary_en)s LIMIT 1",
        node,
    )
    if cur.fetchone():
        return
    cur.execute(
        "UPDATE node_versions SET valid_to = now() "
        "WHERE node_id=%(id)s AND valid_to IS NULL AND status='pending review'",
        node,
    )
    cur.execute(
        """
        INSERT INTO node_versions
            (node_id, title_en, title_ta, summary_en, summary_ta, details_en, details_ta, status, valid_from)
        VALUES (%(id)s, %(title_en)s, %(title_ta)s, %(summary_en)s, %(summary_ta)s,
                %(details_en)s, %(details_ta)s, 'pending review', now())
        """,
        node,
    )


def upsert_edge(cur, edge):
    # Get-or-create by the natural key (from, to, relationship): the edge id is a
    # fresh uuid every run, so we conflict on the triple, then resolve the real id
    # for the evidence link. This makes re-ingest idempotent (no dup-key errors).
    cur.execute(
        """
        INSERT INTO edges (id, from_node_id, to_node_id, relationship_type)
        VALUES (%(id)s, %(from)s, %(to)s, %(relationship)s)
        ON CONFLICT (from_node_id, to_node_id, relationship_type) DO NOTHING
        """,
        edge,
    )
    cur.execute(
        "SELECT id FROM edges WHERE from_node_id=%(from)s AND to_node_id=%(to)s "
        "AND relationship_type=%(relationship)s",
        edge,
    )
    row = cur.fetchone()
    edge_id = row[0] if row else edge["id"]
    ev = edge.get("evidence")
    if ev:
        cur.execute(
            """
            INSERT INTO edge_evidence (edge_id, passage_id, approved_by)
            VALUES (%s, %s, 'pending-review')
            ON CONFLICT (edge_id, passage_id) DO NOTHING
            """,
            (edge_id, ev["passage_id"]),
        )


def audit(cur, action, target_table, target_id, changes):
    cur.execute(
        """
        INSERT INTO audit_events (actor, action_type, target_table, target_id, changes)
        VALUES ('ingest-bot', %s, %s, %s, %s)
        """,
        (action, target_table, target_id, json.dumps(changes)),
    )
