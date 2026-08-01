"""
WikiGov ingestion configuration.

Mirrors the source registry seeded in src/db/migrations/002_ingestion.sql.
Secrets and connection strings come from the environment — never hard-coded.

Env:
  SUPABASE_DB_URL   Postgres connection string (service role) for writes.
  OCR_LANGS         Tesseract languages (default 'eng+tam').
  INGEST_STORAGE    Local dir for downloaded raw artifacts (audit copies).
"""

import os

SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL", "")
OCR_LANGS       = os.environ.get("OCR_LANGS", "eng+tam")
STORAGE_DIR     = os.environ.get("INGEST_STORAGE", "./.artifacts")
REQUEST_TIMEOUT = int(os.environ.get("INGEST_TIMEOUT", "45"))

# Per-source crawl + graph-mapping config. `primary_node_type` / `edge` drive the
# generic transform (services/ingest/adapters.py). `focus` is the artifact type the
# adapter collects. Selectors are intentionally generic — calibrate on first run.
# Per source:
#   seeds  — one or more listing pages to crawl (verified against the live sites)
#   follow — regex; when set, discovery only follows internal links matching it
#            (to reach PDFs on detail pages) instead of every link on the page.
SOURCES = {
    "tn-whatsnew": {
        "base_url": "https://www.tn.gov.in", "list_path": "/whatsnew.php?year=MjAyNg==",
        "seeds": ["/whatsnew.php?year=MjAyNg=="], "follow": None,
        "focus": "html", "primary_node_type": "event", "edge": "announces",
        "authority": "Government of Tamil Nadu", "doc_type": "Update Notice",
    },
    "tn-go": {
        "base_url": "https://www.tn.gov.in", "list_path": "/godept_list.php",
        # godept_list.php → go.php?dep_id=<b64>&year=<b64> → GO PDFs
        "seeds": ["/godept_list.php"], "follow": r"go\.php\?dep_id",
        "focus": "pdf", "primary_node_type": "order", "edge": "published_by",
        "authority": "Government of Tamil Nadu", "doc_type": "Government Order",
    },
    "tn-schemes": {
        "base_url": "https://www.tn.gov.in", "list_path": "/schemes.php",
        # schemes.php → scheme_list.php?dep_id (follow) → scheme_details.php?id (detail)
        "seeds": ["/schemes.php"], "follow": r"scheme_list\.php", "detail": r"scheme_details\.php",
        "focus": "html", "primary_node_type": "scheme", "edge": "governed_by",
        "authority": "Government of Tamil Nadu", "doc_type": "Scheme Guideline",
    },
    "tn-departments": {
        "base_url": "https://www.tn.gov.in", "list_path": "/department_list.php",
        # department_list.php → dept_profile.php?dep_id (detail, directly on the list page)
        "seeds": ["/department_list.php"], "follow": None, "detail": r"dept_profile\.php",
        "focus": "html", "primary_node_type": "department", "edge": None,
        "authority": "Government of Tamil Nadu", "doc_type": "Department Profile",
    },
    "tn-press": {
        "base_url": "https://www.tn.gov.in", "list_path": "/press_release.php",
        "seeds": ["/press_release.php"], "follow": None,
        "focus": "pdf", "primary_node_type": "event", "edge": "published_by",
        "authority": "Information and Public Relations Department", "doc_type": "Press Release",
    },
    "tn-assembly": {
        "base_url": "https://www.assembly.tn.gov.in", "list_path": "/documents/menu.php",
        # Real docs are under /documents/menu.php (the homepage '/' has stale /pdfdocs 404s)
        "seeds": ["/documents/menu.php"], "follow": None,
        "focus": "pdf", "primary_node_type": "act", "edge": "published_by",
        "authority": "Tamil Nadu Legislative Assembly", "doc_type": "Legislative Document",
    },
    "tn-gazette": {
        "base_url": "https://stationeryprinting.tn.gov.in", "list_path": "/gazette.php",
        # gazette.php → gazette_list_details.php?id=<b64>&date=<b64> → gazette PDFs
        "seeds": ["/gazette.php", "/extra_ordinary_lists.php?id=MjAyNg==", "/archives.php"],
        "follow": r"gazette_list_details|extra_ordinary_lists|gazette_view",
        "focus": "pdf", "primary_node_type": "event", "edge": "published_by",
        "authority": "Stationery and Printing Department", "doc_type": "Gazette Notification",
    },
    "tn-finance": {
        "base_url": "https://financedept.tn.gov.in", "list_path": "/en/",
        "seeds": ["/en/"], "follow": None,
        "focus": "pdf", "primary_node_type": "budget_line", "edge": "allocates",
        "authority": "Finance Department", "doc_type": "Budget Document",
    },
}


def require_db_url() -> str:
    if not SUPABASE_DB_URL:
        raise SystemExit(
            "SUPABASE_DB_URL is not set. Export your Supabase Postgres connection "
            "string (service role) before running ingestion."
        )
    return SUPABASE_DB_URL
