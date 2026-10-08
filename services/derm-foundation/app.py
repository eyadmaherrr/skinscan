"""
Self-hosted Google Derm Foundation embedding service for SkinScan.

    POST /v1/embed   body: PNG/JPEG image bytes   ->   {"embedding": [6144 floats], "dim": 6144}
    GET  /healthz

Model loading and the serving signature follow the official model card
(https://huggingface.co/google/derm-foundation): the image is PNG-encoded,
wrapped in a serialized tf.train.Example under "image/encoded", passed to the
`serving_default` signature, and the "embedding" output is returned.

Requirements before this can run:
  * a Hugging Face account that has accepted the Health AI Developer
    Foundations (HAI-DEF) terms for google/derm-foundation, and its token in
    HF_TOKEN;
  * ~1.5 GB disk for the weights and ~3 GB RAM.

Privacy: images are processed in memory and never logged or stored. Run this
service only inside your own infrastructure and protect it with
DERM_FOUNDATION_TOKEN.

Status: written against the documented interface but NOT yet executed by the
SkinScan team — access to the gated weights had not been granted.
"""

from __future__ import annotations

import hmac
import io
import logging
import os

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, Header, HTTPException, Request
from huggingface_hub import from_pretrained_keras
from PIL import Image

logging.getLogger("uvicorn.access").disabled = True  # access logs are not needed and could reveal client details

MAX_BYTES = 6 * 1024 * 1024
SIZE = 448
SERVICE_TOKEN = os.environ.get("DERM_FOUNDATION_TOKEN", "")

app = FastAPI(title="derm-foundation-embeddings", docs_url=None, redoc_url=None, openapi_url=None)
_model = from_pretrained_keras("google/derm-foundation")
_infer = _model.signatures["serving_default"]


def _png_448(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        if img.size != (SIZE, SIZE):
            img = img.resize((SIZE, SIZE), Image.BICUBIC)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


@app.post("/v1/embed")
async def embed(request: Request, authorization: str = Header(default="")) -> dict:
    if SERVICE_TOKEN and not hmac.compare_digest(authorization, f"Bearer {SERVICE_TOKEN}"):
        raise HTTPException(status_code=401)
    data = await request.body()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(status_code=413)
    try:
        png = _png_448(data)
    except Exception:
        raise HTTPException(status_code=422, detail="unreadable image")
    example = tf.train.Example(
        features=tf.train.Features(feature={"image/encoded": tf.train.Feature(bytes_list=tf.train.BytesList(value=[png]))})
    ).SerializeToString()
    output = _infer(inputs=tf.constant([example]))
    embedding = np.asarray(output["embedding"]).astype(np.float32).flatten()
    if embedding.shape[0] != 6144 or not np.all(np.isfinite(embedding)):
        raise HTTPException(status_code=500, detail="invalid embedding")
    return {"embedding": embedding.tolist(), "dim": int(embedding.shape[0])}
