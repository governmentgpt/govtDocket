"""
Council of Ministers adapter — people data.

Follows docs/INGESTION_CONTRACT.md: each minister becomes a `person` node (with
name aliases), a bio `passage` (name + role + portfolio — the searchable text),
a `document` linked via node_id, and a `person —heads→ department` edge. Everything
lands as 'pending review'. No query-engine changes are needed — search picks this
up organically once approved.

Source: https://www.tn.gov.in/minister_list.php
Structure (verified): div.minister_col_description → h4[0]=name, h4[1]=role, <p>=portfolio.
"""

import re
import uuid
from datetime import date

from bs4 import BeautifulSoup
from slugify import slugify

import db
import fetchers

SOURCE_KEY = "tn-ministers"
LIST_URL = "https://www.tn.gov.in/minister_list.php"
AUTHORITY = "Government of Tamil Nadu"

_HONORIFIC = re.compile(r"^(Thiru|Dr\.?|Selvi|Tmt\.?|Thirumathi|Ms\.?|Mr\.?|Er\.?)\s+", re.I)


def _clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def _dept_from_role(role):
    m = re.search(r"Minister for (.+)", role, re.I)
    if m:
        return _clean(m.group(1))
    if "Chief Minister" in role:
        return "Chief Minister's Office"
    return None


def build_person(name, role, portfolio):
    """Return a contract bundle (document + passages + nodes + edges) for one minister."""
    name, role, portfolio = _clean(name), _clean(role), _clean(portfolio)
    person_id = f"person-{slugify(name)[:48]}"
    bio = f"{name} — {role}. Portfolio: {portfolio}" if portfolio else f"{name} — {role}."

    passage = {"id": str(uuid.uuid4()), "page": 1, "section": "Profile", "text": bio, "language": "EN"}
    document = {
        "id": str(uuid.uuid4()), "vid": str(uuid.uuid4()), "url": LIST_URL,
        "doc_type": "Minister Profile", "authority": AUTHORITY, "lang": "EN",
        "title": f"{name} ({role})"[:400], "effective_date": date.today().isoformat(),
        "hash": fetchers.sha256_bytes(bio.encode("utf-8")), "node_id": person_id,
    }

    aliases = [{"alias": name, "lang": "EN"}]
    bare = _HONORIFIC.sub("", name).strip()
    if bare and bare != name:
        aliases.append({"alias": bare, "lang": "EN"})     # name without honorific

    person = {
        "id": person_id, "type": "person", "title_en": name, "title_ta": name,
        "summary_en": role, "summary_ta": role,
        "details_en": [role] + ([f"Portfolio: {portfolio}"] if portfolio else []),
        "details_ta": [role],
        "aliases": aliases,
    }
    nodes = [person]
    edges = []

    dept_name = _dept_from_role(role)
    if dept_name:
        dept_id = f"dept-{slugify(dept_name)[:48]}"
        nodes.append({
            "id": dept_id, "type": "department", "title_en": dept_name, "title_ta": dept_name,
            "summary_en": f"Department headed by {name}.", "summary_ta": f"{name} தலைமையிலான துறை.",
            "details_en": [f"Minister: {name}"], "details_ta": [f"அமைச்சர்: {name}"],
            "aliases": [{"alias": dept_name, "lang": "EN"}],
        })
        edges.append({
            "id": str(uuid.uuid4()), "from": person_id, "to": dept_id,
            "relationship": "heads", "evidence": {"passage_id": passage["id"]},
        })

    return {"document": document, "passages": [passage], "nodes": nodes, "edges": edges}


def run(conn, source_id, renderer):
    """Render the Council of Ministers page, parse each card, and ingest."""
    soup = BeautifulSoup(renderer.render(LIST_URL), "lxml")
    cards = soup.select("div.minister_col_description")
    print(f"  parsed {len(cards)} minister cards")

    count = 0
    for card in cards:
        h4 = card.find_all("h4")
        if not h4:
            continue
        name = h4[0].get_text(" ", strip=True)
        role = h4[1].get_text(" ", strip=True) if len(h4) > 1 else ""
        portfolio = " ".join(p.get_text(" ", strip=True) for p in card.find_all("p") if p.get_text(strip=True))
        if not name:
            continue
        bundle = build_person(name, role, portfolio)
        try:
            with conn.cursor() as cur:
                db.upsert_document(cur, source_id, bundle["document"])
                db.upsert_passages(cur, bundle["document"]["vid"], bundle["passages"])
                for node in bundle["nodes"]:
                    db.upsert_node(cur, node)
                for edge in bundle["edges"]:
                    db.upsert_edge(cur, edge)
                db.audit(cur, "ingest_minister", "nodes", bundle["nodes"][0]["id"], {"name": name})
            conn.commit()
            count += 1
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            print(f"    ! {name}: {exc}")

    print(f"  ingested {count} ministers (pending review)")
