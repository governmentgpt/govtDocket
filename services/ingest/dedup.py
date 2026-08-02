"""
Entity dedup — merge near-duplicate concept nodes (schemes/events) that describe
the same real thing but were minted separately across sources.

Uses the embeddings from migration 010 (run embed_backfill.py FIRST). Departments
already dedup deterministically (departments.py), so this targets scheme/event.

DRY-RUN by default (reports the clusters it would merge). Pass --apply to merge.
The steward should review the report before applying.

Usage:
  SUPABASE_DB_URL=... python dedup.py --type scheme            # report only
  SUPABASE_DB_URL=... python dedup.py --type scheme --apply    # merge
"""

import argparse
import math

import db

THRESHOLD = 0.92   # cosine similarity above which two nodes are "the same"


def _parse_vec(s):
    return [float(x) for x in s.strip("[]").split(",")] if s else None


def _cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def load_nodes(cur, ntype):
    cur.execute(
        "SELECT n.id, nv.title_en, nv.embedding::text, "
        "(SELECT count(*) FROM edges e WHERE e.from_node_id = n.id OR e.to_node_id = n.id) AS deg "
        "FROM nodes n JOIN node_versions nv ON nv.node_id = n.id AND nv.valid_to IS NULL "
        "WHERE n.type = %s AND nv.embedding IS NOT NULL",
        (ntype,),
    )
    nodes = []
    for nid, title, emb, deg in cur.fetchall():
        v = _parse_vec(emb)
        if v:
            nodes.append({"id": nid, "title": title, "vec": v, "deg": deg})
    return nodes


def clusters(nodes):
    parent = {n["id"]: n["id"] for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            if _cosine(nodes[i]["vec"], nodes[j]["vec"]) >= THRESHOLD:
                parent[find(nodes[i]["id"])] = find(nodes[j]["id"])

    groups = {}
    for n in nodes:
        groups.setdefault(find(n["id"]), []).append(n)
    return [g for g in groups.values() if len(g) > 1]


def merge(cur, canonical_id, dup_id):
    """Repoint everything from dup → canonical, conflict-safe, then drop dup."""
    c, d = canonical_id, dup_id
    # documents
    cur.execute("UPDATE documents SET node_id = %s WHERE node_id = %s", (c, d))
    # drop dup edges that would collide with an existing canonical edge
    cur.execute(
        "DELETE FROM edges e WHERE e.from_node_id = %s AND EXISTS "
        "(SELECT 1 FROM edges x WHERE x.from_node_id = %s AND x.to_node_id = e.to_node_id "
        " AND x.relationship_type = e.relationship_type)", (d, c))
    cur.execute(
        "DELETE FROM edges e WHERE e.to_node_id = %s AND EXISTS "
        "(SELECT 1 FROM edges x WHERE x.to_node_id = %s AND x.from_node_id = e.from_node_id "
        " AND x.relationship_type = e.relationship_type)", (d, c))
    # repoint remaining edges, then remove any self-loops created
    cur.execute("UPDATE edges SET from_node_id = %s WHERE from_node_id = %s", (c, d))
    cur.execute("UPDATE edges SET to_node_id = %s WHERE to_node_id = %s", (c, d))
    cur.execute("DELETE FROM edges WHERE from_node_id = to_node_id")
    # move aliases (unique on node_id,alias,language)
    cur.execute(
        "INSERT INTO node_aliases (node_id, alias, language) "
        "SELECT %s, alias, language FROM node_aliases WHERE node_id = %s "
        "ON CONFLICT (node_id, alias, language) DO NOTHING", (c, d))
    # drop the duplicate node (cascades its versions/aliases/edge_evidence)
    cur.execute("DELETE FROM nodes WHERE id = %s", (d,))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", default="scheme")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = db.connect()
    try:
        with conn.cursor() as cur:
            nodes = load_nodes(cur, args.type)
        print(f"Loaded {len(nodes)} '{args.type}' nodes with embeddings.")
        groups = clusters(nodes)
        print(f"Found {len(groups)} duplicate cluster(s) (cosine ≥ {THRESHOLD}).\n")

        merges = 0
        for g in groups:
            g.sort(key=lambda n: n["deg"], reverse=True)   # keep the best-connected as canonical
            canonical = g[0]
            print(f"● keep: {canonical['title']}  ({canonical['id']}, deg={canonical['deg']})")
            for dup in g[1:]:
                print(f"    merge: {dup['title']}  ({dup['id']}, deg={dup['deg']})")
                if args.apply:
                    with conn.cursor() as cur:
                        merge(cur, canonical["id"], dup["id"])
                    conn.commit()
                    merges += 1
            print()

        print(f"{'Merged' if args.apply else 'Would merge'} {sum(len(g)-1 for g in groups)} duplicate node(s)."
              + ("" if args.apply else "  Re-run with --apply to merge."))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
