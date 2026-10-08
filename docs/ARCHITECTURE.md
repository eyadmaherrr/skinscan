# Architecture

SkinScan by Dr Maher is a single Next.js application: a small client-side flow and
one analysis API. All computer vision runs on our own server — no image is
sent to any third-party service.

```
Browser                                    Server (Node.js, /api/skin-scan)
───────                                    ───────────────────────────────────────────
Landing → tips + consent                   rate limit (per IP hash) → size/type checks
  → camera (oval guide) or upload          → concurrency slot → deadline
  → resize ≤ 2560 px, re-encode JPEG       → lib/skin-analysis (pipeline below)
    (drops EXIF/GPS metadata)              → JSON: scores, confidence, explanations,
  → POST multipart "image"  ───────────▶     region outlines  (Cache-Control: no-store)
  ◀─────────────── results / retake advice  image bytes are discarded after the request
```

## Pipeline (`lib/skin-analysis/`)

```
decode (image/decode.ts)          magic-byte check, sharp decode with pixel limit,
                                  EXIF orientation, colour profile → sRGB, ≤ 2560 px
   │
face detection (face-detection)   MediaPipe BlazeFace, SSD anchors + weighted NMS
   │   └─ gate: no face / several faces
landmarks (landmarks.ts)          MediaPipe Face Mesh V2, 478 points, two passes
   │   └─ gate: face too small, cut off, turned/tilted (pose from 3-D landmarks)
alignment (alignment.ts)          rotate eyes level, scale to ≤ 420 px inter-ocular,
   │                              physical scale px/mm from 63 mm mean IOD,
   │                              CIELAB conversion, segmentation (segmentation.ts)
regions (regions.ts)              forehead, nose, cheeks, chin, under-eyes from landmarks;
   │                              eyes, brows, lips excluded
skin masks (skin-mask.ts)         segmentation vetoes hair/accessories/background,
   │                              deep shadows and clipped pixels removed, borders eroded
quality (quality.ts)              exposure (clipping, eye whites, noise), lighting balance,
   │   └─ gate: retake advice     sharpness, filters/heavy edits, colour, glasses,
   │                              occlusion, visible-skin coverage
exposure normalisation (index.ts) eye-white luminance → common reference exposure
   │
metrics (metrics/*.ts)            pigmentation · redness · texture · blemishes ·
   │                              shine · under-eye  → raw values in physical units
scoring (scoring.ts)              raw → 0–100 via documented calibration anchors
confidence (confidence.ts)        metric reliability × image-quality factors × coverage
explain (explain.ts)              plain-language, non-diagnostic sentences
```

`index.ts` orchestrates the stages, yields to the event loop between them
and enforces the scan deadline.

### Module responsibilities

| File | Responsibility |
|---|---|
| `types.ts` | Public API types (the response contract) |
| `errors.ts` | `ScanError` codes and all user-facing messages |
| `image/decode.ts` | Safe decoding and format sniffing |
| `image/color.ts` | sRGB → linear → CIELAB, ITA (evaluation only) |
| `image/filters.ts` | Gaussian/box blur, masked blur, morphology, noise estimate |
| `image/detail.ts` | Noise-corrected band-pass contrast |
| `image/warp.ts` | Affine resampling with anti-aliasing |
| `models/runtime.ts` | ONNX Runtime sessions, checksum verification |
| `face-detection.ts`, `landmarks.ts`, `segmentation.ts` | Model pre/post-processing |
| `alignment.ts`, `regions.ts`, `skin-mask.ts` | Geometry and skin selection |
| `quality.ts` | Quality gate and quality factors |
| `metrics/*.ts` | One file per measurement |
| `scoring.ts`, `confidence.ts`, `explain.ts`, `labels.ts` | Presentation of measurements |

### Replacing or adding a model

A model is three things: the file in `models/`, its entry (with SHA-256) in
`models/manifest.json`, and the pre/post-processing module that calls
`runModel()`. To swap one:

1. Put the new `.onnx` in `models/` and update `manifest.json` (use
   `scripts/convert/convert_models.py` for MediaPipe TFLite models, or add a
   new entry by hand for an ONNX model; run `npm run verify-models`).
2. Adapt the matching module (`face-detection.ts`, `landmarks.ts` or
   `segmentation.ts`) to the new input size / normalisation / outputs.
3. Run `npm test` and `npm run evaluate`, and compare `docs/TESTING.md`.

Adding a metric: create `metrics/<name>.ts` returning a `MetricMeasurement`
(raw value in a documented unit + reliability + coverage), add the key to
`METRIC_KEYS`, calibration anchors (`scoring.ts`), quality weights
(`confidence.ts`), labels and explanations, then evaluate it — and remove it
again if it is not stable (as was done for pore visibility).

## API

`POST /api/skin-scan` — `multipart/form-data` with one field `image`
(JPEG, PNG or WebP; ≤ 8 MB by default).

Success (200):

```json
{
  "success": true,
  "scanId": "uuid",
  "createdAt": "2026-10-09T10:00:00.000Z",
  "analysis": {
    "pigmentation": { "score": 37, "band": "mild", "confidence": 0.7, "confidenceLabel": "moderate",
                      "explanation": "A few small areas were slightly darker…", "regions": ["cheekR", "forehead"] },
    "redness":      { "score": 46, "band": "mild", "confidence": 0.82, "confidenceLabel": "high", "explanation": "…" },
    "texture":      { "score": 30, "band": "mild", "confidence": 0.74, "confidenceLabel": "moderate", "explanation": "…" },
    "blemishes":    { "score": 3,  "band": "minimal", "confidence": 0.53, "confidenceLabel": "low", "explanation": "…" },
    "shine":        { "score": 19, "band": "minimal", "confidence": 0.49, "confidenceLabel": "low", "explanation": "…" },
    "underEye":     { "score": null, "band": null, "confidence": 0.23, "confidenceLabel": "insufficient", "explanation": "…" }
  },
  "overallConfidence": 0.58,
  "imageQuality": { "acceptable": true, "notes": ["One side of your face was more brightly lit than the other."] },
  "regions": [{ "region": "forehead", "points": [[0.31, 0.22], …] }],
  "engine": "Dr Maher Vision AI v2.0",
  "methodologyVersion": "2.0.0"
}
```

Failure: `{ "success": false, "error": { "code", "message" },
"imageQuality"?: { "acceptable": false, "issues": [{ "code", "message" }] } }`

| Status | Code | When |
|---|---|---|
| 400 | `invalid_request` | No image / not multipart |
| 413 | `file_too_large` | Upload or pixel count over the limit |
| 415 | `unsupported_type` | Not a real JPEG/PNG/WebP (checked by content, not name) |
| 422 | `image_unreadable` | Corrupt image |
| 200 | `image_quality` | Analysis ran but the photo needs a retake (`success: false`, `imageQuality.acceptable: false`, `issues` explain how) |
| 429 | `rate_limited` | Too many scans from one client (`Retry-After`) |
| 503 | `busy` | All analysis slots in use (`Retry-After`) |
| 504 | `timeout` | Over the time budget |
| 500 | `analysis_failed` | Unexpected error (details only in server logs) |

`GET /api/health` loads and verifies the models (deployment readiness check).

Model names and internal measurements are deliberately not part of the API.

## Extension components (methodology 2.1)

```
core pipeline (unchanged) ──▶ ctx (aligned face, masks, quality, spots)
        │
        ├─ extensions/acne.ts            spot candidates (+ jawline), Hessian fold filter, overlay data
        ├─ extensions/acne-severity.ts   optional ResNet-50 classifier (SKINSCAN_ACNE_SEVERITY_MODEL)
        ├─ extensions/pores.ts           task-specific gate, DoG pores, regional index, heat map
        ├─ extensions/projection.ts      crop → photo coordinates, heat-map PNG rendering
        └─ extensions/derm-foundation.ts optional HTTP client for services/derm-foundation
```

`extensions/index.ts` runs them after the core metrics. Each is wrapped
separately: a failure yields `status: "failed"` for that section only; the
core analysis and other sections are returned unchanged. Spot detection is
shared with the blemish metric (`ctx.spots`), so nothing is computed twice.

Optional models load through `getOptionalSession()` (path + SHA-256 from the
adjacent `.json`, cached per process). The Derm Foundation model runs in a
separate self-hosted service because it is a ≈1.5 GB TensorFlow model.

### Response additions (all optional, additive)

```json
"acne": {
  "status": "ok", "method": "heuristic_spot_detection",
  "lesionCandidateCount": 4, "redToneCount": 0, "darkToneCount": 4,
  "lesions": [{ "x": 0.41, "y": 0.22, "r": 0.004, "tone": "dark", "region": "forehead" }],
  "regionalSummary": { "forehead": { "count": 3, "visible": true }, "jawL": { "count": 0, "visible": false } },
  "severity": { "status": "disabled", "label": null, "scale": null, "probabilities": null },
  "explanation": "…", "limitations": ["…"]
},
"pores": {
  "status": "ok" | "insufficient_quality" | …, "visibilityScore": 8, "scoreScale": "…",
  "confidence": 0.42, "confidenceLabel": "low",
  "regionalSummary": { "nose": 10, "forehead": 8 }, "heatmap": "data:image/png;base64,…",
  "explanation": "…", "limitations": ["…"]
},
"dermFoundation": { "enabled": false, "featureExtractionStatus": "not_run", "downstreamTasks": [] },
"analysisQuality": { "imageQuality": "acceptable", "limitations": ["…"] }
```

Statuses: `ok`, `insufficient_quality`, `disabled`, `not_configured`,
`failed` (`not_run` for Derm Foundation when switched off). Values are `null`
whenever they were not computed — never defaults. Embeddings, model paths and
model names are never returned.

## Security

- Uploads: content-length pre-check, `multipart/form-data` only, declared type
  allow-list, magic-byte sniffing, sharp `limitInputPixels` (decompression
  bombs) and `failOn: 'error'`; no SVG, no file is ever written to disk or
  executed.
- Rate limiting (hashed client IP, sliding window) and a per-instance
  concurrency cap; cooperative deadline.
- Responses `Cache-Control: no-store`; errors never contain stack traces.
- Security headers on every route (CSP in production, `X-Frame-Options:
  DENY`, `nosniff`, `Permissions-Policy: camera=(self)`, HSTS).
- Model files are checksum-verified before loading.

## Future Dr. Maher integration (not implemented)

The app is intentionally stateless today: no accounts, no database, no
image storage. The planned path:

```
Scan ─▶ "Save to my account" (optional) ─▶ sign in with the drmahermahmoud.com
account (shared session cookie on .drmahermahmoud.com, or OAuth/OIDC) ─▶
POST results (scores + methodologyVersion, never the photo unless the
patient explicitly consents) to a patient-records API ─▶ patient dashboard
```

Seams prepared for this:

- `ScanSuccess` already carries `scanId`, `createdAt` and
  `methodologyVersion`, so stored results remain interpretable after
  re-calibration.
- `NEXT_PUBLIC_API_BASE_URL` allows the API to live on another host.
- The rate limiter and concurrency cap are isolated (`lib/rate-limit.ts`,
  `lib/concurrency.ts`) so they can be backed by Redis when the main site's
  infrastructure is used.
- Saving should be a separate endpoint called after the user opts in; the
  analysis endpoint should stay storage-free.
