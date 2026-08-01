"""
WikiGov ingestion runner.

Pipeline:  discover → (fetch + extract) → transform → ingest (pending review)

Examples
--------
  # First-time full pull of ALL sources (discover + ingest):
  SUPABASE_DB_URL=... python run.py --source all --mode all

  # Re-run just one section on its own cadence:
  SUPABASE_DB_URL=... python run.py --source tn-press --mode all

  # Only discover (fill the queue) without writing the graph:
  SUPABASE_DB_URL=... python run.py --source tn-go --mode discover

Nothing is auto-approved: all graph rows land as status 'pending review'.
To wipe and retry, apply src/db/reset_ingested.sql, then re-run.
"""

import argparse
import sys

import adapters
import db
from config import SOURCES
from fetchers import Renderer


def do_discover(conn, renderer, source_key, cfg):
    with conn.cursor() as cur:
        source_id = db.get_source_id(cur, source_key)
        if not source_id:
            print(f"  ! {source_key}: not in sources table (run migrations/002_ingestion.sql)")
            return
        artifacts = adapters.discover(source_key, cfg, renderer)
        for a in artifacts:
            db.record_discovered(cur, source_id, a)
        db.touch_crawl_state(cur, source_id, cfg["list_path"], None)
        conn.commit()
        print(f"  discovered {len(artifacts)} artifacts for {source_key}")


def do_ingest(conn, renderer, source_key, cfg, limit):
    with conn.cursor() as cur:
        source_id = db.get_source_id(cur, source_key)
        if not source_id:
            return
        queue = db.pending_artifacts(cur, source_id, limit)
    print(f"  ingesting {len(queue)} pending artifacts for {source_key}")

    for art in queue:
        try:
            passages, sha = adapters.extract_passages(art, renderer)
            bundle = adapters.build_graph(source_key, cfg, art, passages, sha)
            with conn.cursor() as cur:
                db.upsert_document(cur, source_id, bundle["document"])
                db.upsert_passages(cur, bundle["document"]["vid"], bundle["passages"])
                for node in bundle["nodes"]:
                    db.upsert_node(cur, node)
                for edge in bundle["edges"]:
                    db.upsert_edge(cur, edge)
                db.set_artifact_status(cur, art["id"], "ingested", sha256=sha)
                db.audit(cur, "ingest_artifact", "documents", bundle["document"]["id"],
                         {"source": source_key, "url": art["source_url"], "passages": len(passages)})
            conn.commit()
        except Exception as exc:  # noqa: BLE001 — keep the batch going, record the error
            conn.rollback()
            with conn.cursor() as cur:
                db.set_artifact_status(cur, art["id"], "error", error=str(exc)[:500])
            conn.commit()
            print(f"    ! {art['source_url']}: {exc}")


def main():
    ap = argparse.ArgumentParser(description="WikiGov ingestion runner")
    ap.add_argument("--source", default="all", help="source_key or 'all'")
    ap.add_argument("--mode", default="all", choices=["discover", "ingest", "all"])
    ap.add_argument("--limit", type=int, default=200, help="max artifacts per source when ingesting")
    args = ap.parse_args()

    keys = list(SOURCES) if args.source == "all" else [args.source]
    unknown = [k for k in keys if k not in SOURCES]
    if unknown:
        sys.exit(f"Unknown source(s): {unknown}. Known: {list(SOURCES)}")

    conn = db.connect()
    try:
        with Renderer() as renderer:
            for key in keys:
                cfg = SOURCES[key]
                print(f"\n=== {key} ({cfg['base_url']}{cfg['list_path']}) ===")
                if args.mode in ("discover", "all"):
                    do_discover(conn, renderer, key, cfg)
                if args.mode in ("ingest", "all"):
                    do_ingest(conn, renderer, key, cfg, args.limit)
    finally:
        conn.close()
    print("\nDone. Review pending-review nodes, then approve to publish.")


if __name__ == "__main__":
    main()
