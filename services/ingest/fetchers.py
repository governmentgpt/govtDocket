"""
Fetch + extract helpers.

These TN sites are JS-rendered, so HTML is obtained via a headless browser
(Playwright). Documents are PDF or scanned images → text via pypdf / Tesseract OCR.
"""

import hashlib
import io

from config import OCR_LANGS, REQUEST_TIMEOUT


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Renderer:
    """Reusable headless browser for rendering dynamic pages."""

    def __init__(self):
        self._pw = None
        self._browser = None

    def __enter__(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        return self

    def __exit__(self, *exc):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    def render(self, url: str) -> str:
        """Return fully-rendered HTML for a JS page."""
        page = self._browser.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=REQUEST_TIMEOUT * 1000)
            page.wait_for_timeout(1200)  # let late XHR content settle
            return page.content()
        finally:
            page.close()


def download(url: str) -> bytes:
    """Download a binary artifact (PDF/image) with httpx.

    Several TN gov hosts have TLS misconfigurations (e.g. a cert not valid for a
    www. subdomain). On a certificate/SSL failure we retry once without
    verification — acceptable here because the payload is public and we hash it."""
    import httpx

    def _get(verify):
        with httpx.Client(follow_redirects=True, timeout=REQUEST_TIMEOUT, verify=verify) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.content

    try:
        return _get(True)
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).upper()
        if "CERTIFICATE" in msg or "SSL" in msg:
            return _get(False)
        raise


def pdf_to_pages(data: bytes) -> list[str]:
    """Extract text per page from a PDF. Empty strings signal scanned pages
    that need OCR (handled by the caller)."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return [(page.extract_text() or "").strip() for page in reader.pages]


def ocr_image(data: bytes) -> str:
    """OCR a scanned image (EN+TA). Returns '' if tesseract is unavailable so
    ingestion degrades gracefully instead of failing the whole artifact."""
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)), lang=OCR_LANGS).strip()
    except Exception:
        return ""


def ocr_pdf_page_images(data: bytes) -> list[str]:
    """Fallback OCR for scanned PDFs: rasterize pages then OCR.
    Requires pdf2image + poppler + tesseract; returns [] if any are unavailable
    so the caller degrades gracefully (document ingests with no OCR passages)."""
    try:
        import pytesseract
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(data)
        return [pytesseract.image_to_string(im, lang=OCR_LANGS).strip() for im in images]
    except Exception:
        return []
