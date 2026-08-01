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
    """Download a binary artifact (PDF/image) with httpx."""
    import httpx
    with httpx.Client(follow_redirects=True, timeout=REQUEST_TIMEOUT) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.content


def pdf_to_pages(data: bytes) -> list[str]:
    """Extract text per page from a PDF. Empty strings signal scanned pages
    that need OCR (handled by the caller)."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return [(page.extract_text() or "").strip() for page in reader.pages]


def ocr_image(data: bytes) -> str:
    """OCR a scanned image (EN+TA) into text."""
    import pytesseract
    from PIL import Image
    img = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(img, lang=OCR_LANGS).strip()


def ocr_pdf_page_images(data: bytes) -> list[str]:
    """Fallback OCR for scanned PDFs: rasterize pages then OCR.
    Requires pdf2image + poppler; returns [] if unavailable so the caller can
    degrade gracefully."""
    try:
        import pytesseract
        from pdf2image import convert_from_bytes
    except Exception:
        return []
    images = convert_from_bytes(data)
    return [pytesseract.image_to_string(im, lang=OCR_LANGS).strip() for im in images]
