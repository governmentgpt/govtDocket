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

import departments
import fetchers

ROOT_ID = "root-tn-government"


# Strip NUL and other C0 control bytes (keep \t and \n) — Postgres text columns
# reject NUL (0x00), which OCR/PDF extraction occasionally emits.
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _clean(s):
    return _CTRL_RE.sub("", s or "").strip()


def _looks_garbled(s):
    """Detect mojibake from PDFs with legacy (non-Unicode) Tamil fonts, where
    pypdf returns raw font bytes as junk like 'àÁŠHù˜ ¬è«ò´'. Good chars are
    ASCII-printable or in the Tamil Unicode block (U+0B80–U+0BFF)."""
    if not s:
        return False
    good = sum(
        1 for c in s
        if (c.isascii() and c.isprintable()) or ("஀" <= c <= "௿") or c in " \n\t"
    )
    return good / len(s) < 0.65


def _abs(base, href):
    return urljoin(base, href)


def _host(cfg):
    return cfg["base_url"].split("//")[-1].replace("www.", "").rstrip("/")


def _internal(cfg, url):
    """Strict same-site check for navigation/follow links — does NOT bleed into
    sibling subdomains (tn.gov.in must not follow into assembly.tn.gov.in)."""
    host = _host(cfg)
    return ("//" + host) in url or ("//www." + host) in url


def _url_host(url):
    m = re.search(r"//([^/]+)", url)
    return m.group(1).lower() if m else ""


def _same_domain(cfg, url):
    """Looser check for ARTIFACT links (PDF/image): allow any subdomain under the
    source's domain, since docs are often on cms./static. hosts (e.g. press PDFs
    live on cms.tn.gov.in)."""
    return _url_host(url).endswith(_host(cfg))


def _is_pdf(url):
    return url.lower().split("?")[0].endswith(".pdf")


def _is_image(url):
    return bool(re.search(r"\.(jpe?g|png|tiff?)$", url.lower().split("?")[0]))


def _title_from(a, url):
    """Best-effort human title for a link. Many TN PDFs have EMPTY anchor text
    (assembly /documents), so fall back to the surrounding row/label, then to a
    humanised filename."""
    t = (a.get_text(" ", strip=True) or "").strip()
    if t:
        return t[:400]
    for tag in ("tr", "li", "td", "p", "h3", "h4"):
        parent = a.find_parent(tag)
        if parent:
            pt = parent.get_text(" ", strip=True)
            if pt and len(pt) < 300:
                return pt[:400]
    name = url.split("?")[0].rstrip("/").rsplit("/", 1)[-1]
    name = re.sub(r"\.(pdf|jpe?g|png|tiff?)$", "", name, flags=re.I)
    name = re.sub(r"[_\-]+", " ", name).strip()
    return name.title()[:400] or None


# ── Discovery ────────────────────────────────────────────────────────────────
def discover(source_key, cfg, renderer, max_links=300):
    """Return a list of artifact dicts for one source.

    Crawls each configured seed page. Direct PDF/image links become artifacts;
    when cfg['follow'] is set, internal links matching it are followed one level
    to collect the PDFs on their detail pages (e.g. gazette issue pages, GO dept
    pages). Titles use _title_from() so empty-anchor PDFs still get a name.
    """
    seeds = cfg.get("seeds") or [cfg["list_path"]]
    follow_re = re.compile(cfg["follow"]) if cfg.get("follow") else None
    detail_re = re.compile(cfg["detail"]) if cfg.get("detail") else None
    artifacts, seen = [], set()

    def add(url, title, atype, dept=None):
        if url in seen:
            return
        seen.add(url)
        meta = {"source": source_key}
        if dept:
            meta["department"] = dept          # the dept whose page we followed (GO/scheme)
        artifacts.append({
            "source_url": url, "artifact_type": atype,
            "title": (title or "").strip()[:400] or None,
            "published_date": None, "language": "EN", "meta": meta,
        })

    def scan(soup, base, dept=None):
        """Collect artifacts on a page; return (url, title) links to follow one level.
        PDFs/images are collected across sibling subdomains (_same_domain); detail
        and follow links stay strict same-host (_internal). `dept` propagates the
        owning department name (from the followed dept page) onto the artifacts."""
        to_follow = []
        for a in soup.find_all("a", href=True):
            url = _abs(base, a["href"].strip())
            if "#" in url:
                continue
            if _is_pdf(url) and _same_domain(cfg, url):
                add(url, _title_from(a, url), "pdf", dept)
            elif _is_image(url) and _same_domain(cfg, url):
                add(url, _title_from(a, url), "image", dept)
            elif detail_re and detail_re.search(url) and _internal(cfg, url):
                add(url, _title_from(a, url), "html", dept)          # explicit detail page
            elif follow_re and follow_re.search(url) and _internal(cfg, url):
                to_follow.append((url, _title_from(a, url)))         # (dept page url, dept name)
            elif cfg["focus"] == "html" and not detail_re and not follow_re and _internal(cfg, url):
                add(url, _title_from(a, url), "html", dept)          # generic html fallback
        return to_follow

    for seed in seeds:
        seed_url = _abs(cfg["base_url"], seed)
        try:
            soup = BeautifulSoup(renderer.render(seed_url), "lxml")
        except Exception:
            continue

        if source_key == "tn-whatsnew":
            for art in _discover_whatsnew(cfg, soup):
                add(art["source_url"], art["title"], art["artifact_type"])
            continue

        for follow_url, follow_title in scan(soup, seed_url)[:max_links]:
            try:
                sub = BeautifulSoup(renderer.render(follow_url), "lxml")
            except Exception:
                continue
            scan(sub, follow_url, dept=follow_title)                 # tag artifacts with the dept
            if len(artifacts) >= max_links:
                break
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
        # OCR-fallback when there's no text layer OR the text is mojibake
        # (legacy Tamil font). OCR (tam+eng) yields clean Unicode.
        if not any(pages) or _looks_garbled(" ".join(pages)[:3000]):
            ocr_pages = fetchers.ocr_pdf_page_images(data)
            # Use OCR if it produced text; otherwise store nothing rather than
            # keep mojibake (garbage passages poison retrieval + synthesis).
            pages = ocr_pages if ocr_pages else []
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
def _edge(frm, to, rel, passage_id=None):
    return {"id": str(uuid.uuid4()), "from": frm, "to": to, "relationship": rel,
            "evidence": ({"passage_id": passage_id} if passage_id else None)}


def _document(artifact, cfg, title, eff_date, sha256, node_id):
    return {
        "id": str(uuid.uuid4()), "vid": str(uuid.uuid4()), "url": artifact["source_url"],
        "doc_type": cfg["doc_type"], "authority": cfg["authority"], "lang": artifact.get("language", "EN"),
        "title": title, "effective_date": eff_date, "hash": sha256, "node_id": node_id,
    }


def build_graph(source_key, cfg, artifact, passages, sha256):
    """Assemble a document + passages + a concept node linked to its CANONICAL
    department (which links part_of the root). Department profile pages become
    the canonical department node directly. Everything is 'pending review'."""
    title = _clean(artifact.get("title")) or f"{cfg['doc_type']} ({source_key})"
    eff_date = artifact.get("published_date") or date.today().isoformat()
    dept_name = (artifact.get("meta") or {}).get("department") or cfg["authority"]
    ptype = cfg["primary_node_type"]

    passage_rows = [
        {"id": str(uuid.uuid4()), "page": p["page"], "section": p["section"],
         "text": p["text"], "language": artifact.get("language", "EN")}
        for p in passages
    ]
    summary = (passage_rows[0]["text"][:480] if passage_rows else title)

    # A department profile page IS the canonical department node.
    if ptype == "department":
        dept = departments.dept_node(title)
        document = _document(artifact, cfg, title, eff_date, sha256, dept["id"])
        return {"document": document, "passages": passage_rows,
                "nodes": [dept], "edges": [_edge(dept["id"], ROOT_ID, "part_of")]}

    # Otherwise: a concept node (scheme/order/event/…) linked to its department.
    topic_id = f"{ptype}-{slugify(title)[:48]}"
    dept = departments.dept_node(dept_name)
    topic = {
        "id": topic_id, "type": ptype,
        "title_en": title, "title_ta": title,
        "summary_en": summary, "summary_ta": summary,
        "details_en": [f"Department: {dept['title_en']}", f"Source: {source_key}"],
        "details_ta": [f"ஆதாரம்: {source_key}"],
        "aliases": [{"alias": title, "lang": "EN"}],
    }
    document = _document(artifact, cfg, title, eff_date, sha256, topic_id)

    edges = [_edge(dept["id"], ROOT_ID, "part_of")]
    if cfg.get("edge") and passage_rows:
        edges.append(_edge(topic_id, dept["id"], cfg["edge"], passage_rows[0]["id"]))

    return {"document": document, "passages": passage_rows, "nodes": [topic, dept], "edges": edges}
