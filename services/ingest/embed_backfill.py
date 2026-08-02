"""
Backfill embeddings for passages + node versions that don't have them yet —
so you can enable semantic search on already-scraped data WITHOUT re-scraping.

Usage:
  SUPABASE_DB_URL=... LLM_API_KEY=... python embed_backfill.py

Idempotent: only fills rows where embedding IS NULL. Safe to re-run (e.g. after
more ingestion). Requires migration 010_semantic.sql applied.
"""

import db
import embeddings

BATCH = 32


def _backfill(conn, select_sql, id_text_rows_to_update, table, input_type):
    total = 0
    while True:
        with conn.cursor() as cur:
            cur.execute(select_sql, (BATCH,))
            rows = cur.fetchall()
        if not rows:
            break
        vecs = embeddings.embed([r[1] or "" for r in rows], input_type=input_type)
        with conn.cursor() as cur:
            for (row_id, _), vec in zip(rows, vecs):
                lit = embeddings.to_pgvector(vec)
                if lit:
                    cur.execute(
                        f"UPDATE {table} SET embedding = %s::vector WHERE {id_text_rows_to_update} = %s",
                        (lit, row_id),
                    )
        conn.commit()
        total += len(rows)
        print(f"  {table}: embedded {total}")
    return total


def main():
    conn = db.connect()
    try:
        print("Backfilling passage embeddings…")
        _backfill(
            conn,
            "SELECT id, text_content FROM passages WHERE embedding IS NULL AND text_content <> '' LIMIT %s",
            "id", "passages", "passage",
        )
        print("Backfilling node embeddings…")
        _backfill(
            conn,
            "SELECT id, (title_en || '. ' || COALESCE(summary_en,'')) FROM node_versions "
            "WHERE embedding IS NULL AND valid_to IS NULL LIMIT %s",
            "id", "node_versions", "passage",
        )
        print("Done.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
