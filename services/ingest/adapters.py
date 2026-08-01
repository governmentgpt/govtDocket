"""
Source adapters: discover() finds artifacts; build_graph() turns a fetched
artifact into WikiGov graph structures (document + passages + nodes + edges),
all as status 'pending review'.

The discovery selectors here are deliberately generic (collect content links /
PDF links on the rendered page). TN's NIC sites share a common template, but the
exact CSS selectors should be CALIBRATED on the first run against the live DOM —
search for `CALIBRATE` below. Refining a selector only narrows what is collected;
the pipeline runs and stays governance-safe regardless.
"""

import re
import uuid
from datetime import date
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from slugify import slugify

import fetchers


# Strip NUL and other C0 control bytes (keep \t and \n) — Postgres text columns
# reject NUL (0x00), which OCR/PDF extraction occasionally emits.
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _clean(s):
    return _CTRL_RE.sub("", s or "").strip()


def _abs(base, href):
    return urljoin(base, href)


def _looks_internal(base, href):
    return href and not href.startswith(("mailto:", "javascript:", "#"))


# ── Discovery ────────────────────────────────────────────────────────────────
def discover(source_key, cfg, renderer, max_links=200):
    """Return a list of artifact dicts for one source.

    Strategy by focus:
      pdf  → collect all .pdf links on the list page (and one level of internal
             department pages, bounded by max_links).
      html → collect internal detail links (scheme / department pages).
    Whatsnew is special-cased into dated event artifacts.
    """
    list_url = _abs(cfg["base_url"], cfg["list_path"])
    html = renderer.render(list_url)
    soup = BeautifulSoup(html, "lxml")

    if source_key == "tn-whatsnew":
        return _discover_whatsnew(cfg, soup)

    anchors = soup.find_all("a", href=True)
    artifacts, seen = [], set()

    def add(url, title, atype):
        if url in seen:
            return
        seen.add(url)
        artifacts.append({
            "source_url": url, "artifact_type": atype,
            "title": (title or "").strip()[:400] or None,
            "published_date": None, "language": "EN", "meta": {"source": source_key},
        })

    # Direct artifacts on the list page.
    dept_links = []
    for a in anchors:
        href = a["href"].strip()
        if not _looks_internal(cfg["base_url"], href):
            continue
        url = _abs(cfg["base_url"], href)
        text = a.get_text(" ", strip=True)
        if href.lower().endswith(".pdf"):
            add(url, text, "pdf")
        elif re.search(r"\.(jpe?g|png|tiff?)$", href.lower()):
            add(url, text, "image")
        elif cfg["focus"] == "html" and text and cfg["base_url"] in url:
            add(url, text, "html")                       # CALIBRATE: detail-page filter
        elif cfg["focus"] == "pdf" and cfg["base_url"] in url:
            dept_links.append((url, text))               # candidate drill-down page

    # For PDF sources, follow one level of internal pages to reach the PDFs.
    if cfg["focus"] == "pdf":
        for url, _ in dept_links[:max_links]:
            try:
                sub = BeautifulSoup(renderer.render(url), "lxml")
            except Exception:
                continue
            for a in sub.find_all("a", href=True):
                href = a["href"].strip()
                low = href.lower()
                if low.endswith(".pdf"):
                    add(_abs(url, href), a.get_text(" ", strip=True), "pdf")
                elif re.search(r"\.(jpe?g|png|tiff?)$", low):
                    add(_abs(url, href), a.get_text(" ", strip=True), "image")
            if len(artifacts) >= max_links:
                break

    return artifacts[:max_links]


def _discover_whatsnew(cfg, soup):
    """What's New is a dated feed of update titles → lightweight event artifacts."""
    artifacts = []
    for row in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in row.find_all("td")]
        if len(cells) < 2:
            continue
        d, title = cells[0], cells[1]
        if not title:
            continue
        link = row.find("a", href=True)
        url = _abs(cfg["base_url"], link["href"]) if link else f"{cfg['base_url']}{cfg['list_path']}#{slugify(title)}"
        artifacts.append({
            "source_url": url, "artifact_type": "html", "title": title[:400],
            "published_date": _parse_date(d), "language": "EN",
            "meta": {"source": "tn-whatsnew", "feed_date": d},
        })
    return artifacts


def _parse_date(text):
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", text or "")
    if not m:
        return None
    try:
        from datetime import datetime
        return datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%B %d %Y").date().isoformat()
    except Exception:
        return None


# ── Fetch + parse one artifact into passages ─────────────────────────────────
def extract_passages(artifact, renderer):
    """Return (passages, sha256). Passages: list of {page, section, text}."""
    atype = artifact["artifact_type"]
    if atype == "pdf":
        data = fetchers.download(artifact["source_url"])
        pages = fetchers.pdf_to_pages(data)
        if not any(pages):                       # scanned PDF → OCR fallback
            pages = fetchers.ocr_pdf_page_images(data)
        passages = [
            {"page": i + 1, "section": f"Page {i + 1}", "text": _clean(t)}
            for i, t in enumerate(pages) if _clean(t)
        ]
        return passages, fetchers.sha256_bytes(data)

    if atype == "image":
        data = fetchers.download(artifact["source_url"])
        text = _clean(fetchers.ocr_image(data))
        return ([{"page": 1, "section": "Scanned notice", "text": text}] if text else []), fetchers.sha256_bytes(data)

    # html
    html = renderer.render(artifact["source_url"])
    soup = BeautifulSoup(html, "lxml")
    main = soup.find("main") or soup.find(id="content") or soup.body or soup   # CALIBRATE
    text = main.get_text("\n", strip=True) if main else ""
    chunks = _chunk(text)
    passages = [{"page": i + 1, "section": f"Section {i + 1}", "text": _clean(c)} for i, c in enumerate(chunks)]
    return passages, fetchers.sha256_bytes(html.encode("utf-8"))


def _chunk(text, size=900):
    text = re.sub(r"\n{2,}", "\n", text or "").strip()
    if not text:
        return []
    out, buf = [], ""
    for line in text.split("\n"):
        if len(buf) + len(line) > size and buf:
            out.append(buf.strip()); buf = ""
        buf += line + "\n"
    if buf.strip():
        out.append(buf.strip())
    return out[:40]


# ── Transform passages → graph bundle ────────────────────────────────────────
def build_graph(source_key, cfg, artifact, passages, sha256):
    """Assemble a document + versioned passages + a topic node + a department
    node + one evidenced edge. Everything is 'pending review'."""
    doc_id, version_id = str(uuid.uuid4()), str(uuid.uuid4())
    title = _clean(artifact.get("title")) or f"{cfg['doc_type']} ({source_key})"
    authority = cfg["authority"]
    eff_date = artifact.get("published_date") or date.today().isoformat()

    document = {
        "id": doc_id, "vid": version_id, "url": artifact["source_url"],
        "doc_type": cfg["doc_type"], "authority": authority, "lang": artifact.get("language", "EN"),
        "title": title, "effective_date": eff_date, "hash": sha256,
    }
    passage_rows = [
        {"id": str(uuid.uuid4()), "page": p["page"], "section": p["section"],
         "text": p["text"], "language": artifact.get("language", "EN")}
        for p in passages
    ]

    topic_id = f"{cfg['primary_node_type']}-{slugify(title)[:48]}"
    dept_id = f"dept-{slugify(authority)[:48]}"
    summary = (passages[0]["text"][:480] if passages else title)

    topic = {
        "id": topic_id, "type": cfg["primary_node_type"],
        "title_en": title, "title_ta": title,
        "summary_en": summary, "summary_ta": summary,
        "details_en": [f"Source: {source_key}", f"Authority: {authority}"],
        "details_ta": [f"ஆதாரம்: {source_key}", f"அமைப்பு: {authority}"],
        "aliases": [{"alias": title, "lang": "EN"}],
    }
    dept = {
        "id": dept_id, "type": "department",
        "title_en": authority, "title_ta": authority,
        "summary_en": f"Publishing authority: {authority}.",
        "summary_ta": f"வெளியீட்டு அமைப்பு: {authority}.",
        "details_en": ["Recorded from source metadata."],
        "details_ta": ["ஆதார தரவிலிருந்து பதிவு செய்யப்பட்டது."],
        "aliases": [{"alias": authority, "lang": "EN"}],
    }

    edges = []
    if cfg["edge"] and passage_rows:
        edges.append({
            "id": str(uuid.uuid4()), "from": topic_id, "to": dept_id,
            "relationship": cfg["edge"], "evidence": {"passage_id": passage_rows[0]["id"]},
        })

    return {"document": document, "passages": passage_rows, "nodes": [topic, dept], "edges": edges}
