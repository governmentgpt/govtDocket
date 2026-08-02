# Self-hosting bge-m3 embeddings (for later)

The pipeline is embedding-provider-agnostic — it calls any OpenAI-compatible
`/embeddings` endpoint via three settings:

| Setting | Where | Now (Jina) | Self-hosted bge-m3 |
|---|---|---|---|
| `EMBED_BASE_URL` | env (ingest) / `wrangler.toml` var (Worker) | `https://api.jina.ai/v1` | `http://<your-host>:8080/v1` |
| `EMBED_MODEL`    | same | `jina-embeddings-v3` | `baai/bge-m3` |
| `EMBED_API_KEY`  | env / Worker secret | Jina key | your host's key (or blank) |

Both current models are **1024-dim**, so `vector(1024)` in migration 010 stays — swapping is config-only, no re-migration.

## Serve bge-m3 with an OpenAI-compatible endpoint

**Option 1 — Hugging Face Text Embeddings Inference (TEI)** (GPU or CPU):
```bash
docker run -p 8080:80 -v $PWD/data:/data \
  ghcr.io/huggingface/text-embeddings-inference:cpu-latest \
  --model-id BAAI/bge-m3
# OpenAI-compatible route: POST http://<host>:8080/v1/embeddings
```

**Option 2 — Infinity** (clean OpenAI-compatible, multi-model):
```bash
docker run -p 8080:8080 michaelf34/infinity:latest \
  v2 --model-id BAAI/bge-m3 --port 8080
# POST http://<host>:8080/embeddings  (OpenAI-compatible)
```

## Switch to it
1. Deploy the container on a host the Worker can reach (VPC / public with auth).
2. Set `EMBED_BASE_URL` → your endpoint, `EMBED_MODEL=baai/bge-m3`, `EMBED_API_KEY` if the host requires one — in both the ingest env and the Worker (`wrangler.toml` var + secret).
3. Re-embed (only if you want to regenerate): `python embed_backfill.py` after clearing embeddings, or leave existing Jina vectors — **note:** don't mix vectors from two different models in the same index; if you switch model, re-embed everything so the space is consistent.

That's the only caveat: **embeddings from different models aren't comparable** — a model switch means a one-time full re-embed (`UPDATE passages SET embedding = NULL; UPDATE node_versions SET embedding = NULL;` then `embed_backfill.py`).
