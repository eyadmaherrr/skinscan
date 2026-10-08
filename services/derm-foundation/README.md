# Derm Foundation embedding service (optional)

A small self-hosted service that runs Google's
[Derm Foundation](https://huggingface.co/google/derm-foundation) and returns
6144-dimensional embeddings to SkinScan. SkinScan calls it only when
`DERM_FOUNDATION_ENABLED=true` and `DERM_FOUNDATION_URL` is set; embeddings are
validated and kept on the server, never returned to users.

**Status:** not yet executed — the model is gated and access had not been
granted when this was written. No SkinScan result depends on it, and no
downstream classifier has been trained (see docs/AI_SOURCES.md).

## Before you run it

1. Read and accept the Health AI Developer Foundations terms on
   https://huggingface.co/google/derm-foundation with the clinic's Hugging Face
   account. The terms require passing their use restrictions (Section 3.2) on
   to users, a notice file stating "HAI-DEF is provided under and subject to
   the Health AI Developer Foundations Terms of Use", and regulatory
   authorisation where applicable. Have counsel review them before clinical or
   commercial use.
2. Create a read token for that account (`HF_TOKEN`).
3. Plan for ~1.5 GB of weights and ~3 GB of RAM (CPU works; a GPU is faster).
   This does not fit in a Vercel function — run it on a VM/container inside
   your own infrastructure.

## Run

```bash
docker build -t skinscan-derm-foundation services/derm-foundation
docker run -p 8080:8080 -e HF_TOKEN=... -e DERM_FOUNDATION_TOKEN=<random secret> skinscan-derm-foundation
```

Then set in SkinScan:

```
DERM_FOUNDATION_ENABLED=true
DERM_FOUNDATION_URL=https://<internal-host>:8080   # HTTPS, or http:// to localhost / an internal hostname
DERM_FOUNDATION_TOKEN=<same secret>
```

## API

`POST /v1/embed` — body: image bytes (PNG or JPEG; SkinScan sends a 448×448
face crop). Response: `{"embedding": [...6144 floats], "dim": 6144}`.
`GET /healthz` — liveness.
