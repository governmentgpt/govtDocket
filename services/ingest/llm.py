"""
LLM chat helper for ingestion-time extraction (OpenAI-compatible endpoint).
Reuses the same env as the Worker: LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
"""

import os

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://integrate.api.nvidia.com/v1")
LLM_MODEL    = os.environ.get("LLM_MODEL", "z-ai/glm-5.2")
LLM_KEY      = os.environ.get("LLM_API_KEY", "")


def chat(prompt, system="You extract structured JSON from government documents. Reply with JSON only.", max_tokens=900):
    """Return the model's text output, or '' on any failure (caller degrades)."""
    if not LLM_KEY:
        return ""
    import httpx
    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": max_tokens,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"] or ""
    except Exception as exc:  # noqa: BLE001
        print(f"[llm] {exc}")
        return ""
