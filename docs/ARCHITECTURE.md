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

## Pipeline: Dr Maher Vision AI v3.0 (`lib/skin-analysis/`)

```
IMAGE INGESTION (image/decode.ts)
   │  magic-byte sniff, sharp decode with pixel limit, EXIF orientation, sRGB, ≤ 2560 px
IMAGE VALIDATION & GATING
   │  detect empty, corrupt, extreme aspect-ratio, or unreadable images
FACE DETECTION (face-detection.ts)
   │  MediaPipe BlazeFace SSD + weighted NMS; reject no-face or multiple prominent faces
LANDMARK DETECTION (landmarks.ts)
   │  MediaPipe Face Mesh V2, 478 points in two passes; presence & bounds check
FACE ALIGNMENT & GEOMETRY (alignment.ts, quality.ts)
   │  re-orient eyes horizontal, scale to ≤ 420 px IOD, compute px/mm from 63 mm mean IOD,
   │  estimate 3D head pose (yaw, pitch, roll); gate off-angle or blurry portraits
FACIAL PARSING & SKIN SEGMENTATION (segmentation.ts, skin-mask.ts)
   │  DeepLabV3 face parsing into faceSkin, hair, bodySkin, background, clothes, others
ANATOMICAL REGION GENERATION (regions-v3.ts)
   │  24 canonical anatomical regions mapped from 478 MediaPipe landmark anchors;
   │  enforces strict zero-overlap pairwise disjointness precedence tree and affine mapping
REGION-SPECIFIC QUALITY ASSESSMENT (quality-v3.ts)
   │  independent local SNR, gradient sharpness, highlight blowout, shadow clipping,
   │  hair occlusion, and accessory obstruction per individual region
REGION-SPECIFIC FEATURE EXTRACTION (features-v3/engine.ts)
   │  modular measurement of pigmentation, redness, texture, blemishes, shine,
   │  under-eye, and pores directly inside each region mask;
   │  explicit reason codes for low-quality or unavailable regions (never fabricated zeros)
MEASUREMENT VALIDATION & CONFIDENCE (confidence.ts, scoring.ts)
   │  region and feature confidence based on local image quality, coverage, and SNR
RESULT AGGREGATION & ROLLUP (aggregation-v3.ts)
   │  area-weighted feature summaries across regions + backward-compatible legacy structures
HEATMAPS & EXPLAINABLE RESULTS (extensions/projection.ts, explain.ts)
   │  calibrated regional heatmaps + bilingual (English & Arabic) plain-language explanations
REPORT GENERATION (report.ts, route.ts)
   │  signed ScanSuccess response with legacy scores + new v3 anatomical breakdown
```

`index.ts` orchestrates the stages, yields to the event loop between heavy operations,
and enforces the scan deadline.

### Module responsibilities

| File | Responsibility |
|---|---|
| `types.ts`, `types-v3.ts` | Public API types (ScanSuccess, RegionReportV3, DetailedV3PipelineResult) |
| `errors.ts` | `ScanError` codes, retake reasons, and bilingual advice |
| `image/decode.ts` | Safe decoding, metadata stripping, and format sniffing |
| `image/color.ts` | sRGB → linear → CIELAB, ITA (individual typology angle) |
| `image/filters.ts` | Gaussian blur, cached blurs, morphology, noise estimation |
| `image/detail.ts` | Noise-corrected band-pass contrast |
| `image/warp.ts` | Affine resampling with anti-aliasing |
| `models/runtime.ts` | ONNX Runtime CPU sessions, SHA-256 manifest verification |
| `face-detection.ts`, `landmarks.ts`, `segmentation.ts` | ONNX model pre/post-processing |
| `alignment.ts`, `face-topology.ts` | 478-landmark indices, canonical anchors, face alignment crop |
| `regions-v3.ts` | 24 canonical anatomical regions with zero-overlap precedence |
| `quality-v3.ts` | Region-specific quality assessment and feature feasibility gating |
| `features-v3/engine.ts` | Regional measurement engine for pigmentation, redness, texture, etc. |
| `aggregation-v3.ts` | Rollup of regional scores into feature summaries & legacy results |
| `scoring.ts`, `confidence.ts`, `explain.ts` | Documented calibration anchors, confidence weighting, explanations |

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

## Extension components (methodology 2.1 & 2.2)

```
core pipeline ──────────────────▶ ctx (aligned face, masks, quality, spots)
        │
        ├─ extensions/acne.ts            spot candidates (+ jawline), Hessian fold filter, overlay data
        ├─ extensions/acne-severity.ts   optional ResNet-50 classifier (SKINSCAN_ACNE_SEVERITY_MODEL)
        ├─ extensions/pores.ts           task-specific gate, DoG pores, regional index, heat map
        ├─ extensions/skin-age.ts        FairFace ViT-B/16 int8 ONNX apparent age range estimation (v2.2)
        ├─ extensions/projection.ts      crop → photo coordinates, calibrated 0-100 metric heatmaps (v2.2)
        └─ extensions/derm-foundation.ts optional HTTP client for services/derm-foundation
```

`extensions/index.ts` runs them after the core metrics. Each is wrapped
separately: a failure yields `status: "failed"` for that section only; the
core analysis and other sections are returned unchanged. Spot detection is
shared with the blemish metric (`ctx.spots`), so nothing is computed twice.

Models load through `getModelSession()` (cached per process) or `getOptionalSession()`.
The Derm Foundation model runs in a separate self-hosted service because it is a ≈1.5 GB TensorFlow model.

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

## Patient sign-in (shared with drmahermahmoud.com)

Scans require a signed-in clinic patient (`SKINSCAN_REQUIRE_AUTH`, default
on). SkinScan has no accounts, passwords or database of its own:

```
"Sign in" ─▶ drmahermahmoud.com/login?next=<this page>   (email + password, reCAPTCHA)
          └▶ drmahermahmoud.com/api/auth/google?next=…    (Google)
   └─ the clinic website sets its patient_session cookie for .drmahermahmoud.com
      and redirects back ─▶ skinscan.drmahermahmoud.com/?scan=1 ─▶ photo step
```

- `lib/auth.ts` reads the session token (x-patient-session header, else the
  cookie) and checks it with the clinic website's `GET /api/auth/me`. Only the
  patient's name and email are kept, to greet them in the header.
- `POST /api/auth/logout` revokes the session on the clinic website and
  removes the cookie (the shared copy and any older host-only copy).
- `GET /api/auth/me` tells the page who is signed in and whether sign-in is
  required.
- Requirements on the clinic website: it must accept absolute `next` URLs on
  `*.drmahermahmoud.com` and set the cookie with `Domain=.drmahermahmoud.com`.
  Locally (localhost) the shared cookie cannot exist, so run with
  `SKINSCAN_REQUIRE_AUTH=false`.

## Languages

English at `/`, Arabic (right-to-left) at `/ar` — same convention as
drmahermahmoud.com. `app/(en)` and `app/ar` are two root layouts (each sets
`<html lang dir>`); unknown URLs use `app/global-not-found.tsx`.
Interface text is in `lib/messages.ts`; every sentence the analysis returns
(explanations, retake guidance, notes, limitations) is in
`lib/skin-analysis/text.ts` and selected by the request's `locale`
(`?locale=ar` or a `locale` form field). Scores never depend on the language.

## Maintenance (503) and missing pages (404)

SkinScan follows the clinic website's maintenance switch — the admin
panel's site lock, published at `https://www.drmahermahmoud.com/api/site/status`.
`proxy.ts` asks for it (cached like the clinic site: 10 s fresh, 30 s
stale-while-refreshing, fails open) and, while it is on, redirects every
page to `/503` (`/ar/503` for Arabic pages). The API and the 503 pages are
never redirected; on the 503 page every navigation link points back to it.

Unknown URLs reach `app/(en)/[...missing]` or `app/ar/[...missing]`, which
return a 404 with the clinic-style page in that language
(`components/StatusPage.tsx`, shared with the 503 page).

## Downloadable report

"Download report" builds a PDF in the browser (`lib/client/report.ts`):
pages are drawn on a canvas — so Arabic shaping and right-to-left layout are
handled by the browser — and wrapped by a small PDF writer
(`lib/client/report-pdf.ts`). Nothing is uploaded.

## Future: saving results (not implemented)

```
Scan ─▶ "Save to my account" (optional) ─▶ POST results (scores +
methodologyVersion, never the photo unless the patient explicitly consents)
to a patient-records API ─▶ patient dashboard
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
