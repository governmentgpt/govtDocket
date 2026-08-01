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
SOURCES = {
    "tn-whatsnew": {
        "base_url": "https://www.tn.gov.in", "list_path": "/whatsnew.php?year=MjAyNg==",
        "focus": "html", "primary_node_type": "event", "edge": "announces",
        "authority": "Government of Tamil Nadu", "doc_type": "Update Notice",
    },
    "tn-go": {
        "base_url": "https://www.tn.gov.in", "list_path": "/godept_list.php",
        "focus": "pdf", "primary_node_type": "order", "edge": "published_by",
        "authority": "Government of Tamil Nadu", "doc_type": "Government Order",
    },
    "tn-schemes": {
        "base_url": "https://www.tn.gov.in", "list_path": "/schemes.php",
        "focus": "html", "primary_node_type": "scheme", "edge": "governed_by",
        "authority": "Government of Tamil Nadu", "doc_type": "Scheme Guideline",
    },
    "tn-departments": {
        "base_url": "https://www.tn.gov.in", "list_path": "/department_list.php",
        "focus": "html", "primary_node_type": "department", "edge": None,
        "authority": "Government of Tamil Nadu", "doc_type": "Department Profile",
    },
    "tn-press": {
        "base_url": "https://www.tn.gov.in", "list_path": "/press_release.php",
        "focus": "pdf", "primary_node_type": "event", "edge": "published_by",
        "authority": "Information and Public Relations Department", "doc_type": "Press Release",
    },
    "tn-assembly": {
        "base_url": "https://www.assembly.tn.gov.in", "list_path": "/",
        "focus": "pdf", "primary_node_type": "act", "edge": "published_by",
        "authority": "Tamil Nadu Legislative Assembly", "doc_type": "Legislative Document",
    },
    "tn-gazette": {
        "base_url": "https://stationeryprinting.tn.gov.in", "list_path": "/home.php",
        "focus": "pdf", "primary_node_type": "event", "edge": "published_by",
        "authority": "Stationery and Printing Department", "doc_type": "Gazette Notification",
    },
    "tn-finance": {
        "base_url": "https://financedept.tn.gov.in", "list_path": "/en/",
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
