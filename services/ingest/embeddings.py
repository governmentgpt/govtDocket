"""
Embeddings via an OpenAI-compatible endpoint (NVIDIA NIM by default).

Default model BAAI/bge-m3 — multilingual (English + Tamil), 1024-dim, which is
why it matches the vector(1024) columns in migration 010. Reuses LLM_API_KEY.
"""

import os

EMBED_BASE_URL = os.environ.get("EMBED_BASE_URL", "https://integrate.api.nvidia.com/v1")
EMBED_MODEL    = os.environ.get("EMBED_MODEL", "baai/bge-m3")
EMBED_KEY      = os.environ.get("EMBED_API_KEY") or os.environ.get("LLM_API_KEY", "")


def embed(texts, input_type="passage"):
    """Return a list of embedding vectors (lists of float) for `texts`, aligned
    by index. Returns None per item on failure so callers degrade gracefully."""
    if not texts:
        return []
    if not EMBED_KEY:
        print("[embed] no API key — export LLM_API_KEY (your NVIDIA key) or EMBED_API_KEY")
        return [None] * len(texts)
    import httpx
    # Provider-agnostic: base payload works for OpenAI/Jina/Cohere/etc.
    # `truncate` is NVIDIA-specific — only add it for NVIDIA endpoints.
    payload = {"model": EMBED_MODEL, "input": [t[:6000] for t in texts], "encoding_format": "float"}
    if "nvidia.com" in EMBED_BASE_URL:
        payload["truncate"] = "NONE"
    try:
        with httpx.Client(timeout=90) as client:
            resp = client.post(
                f"{EMBED_BASE_URL}/embeddings",
                headers={"Authorization": f"Bearer {EMBED_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            # keep API order
            data.sort(key=lambda d: d.get("index", 0))
            return [d.get("embedding") for d in data]
    except Exception as exc:  # noqa: BLE001
        print(f"[embed] failed: {exc}")
        return [None] * len(texts)


def to_pgvector(vec):
    """Format a Python float list as a pgvector literal, or None."""
    return ("[" + ",".join(f"{x:.6f}" for x in vec) + "]") if vec else None
