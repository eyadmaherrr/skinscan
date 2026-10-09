# SkinScan by Dr Maher — Dr. Maher Mahmoud Clinics

An informational, computer-vision based analysis of **visible** skin
characteristics from a facial photo, powered by the clinic's analysis engine
**Dr Maher Vision AI v2.0**. It is not a diagnosis and does not replace an
examination by a dermatologist.

Production URL (planned): **https://skinscan.drmahermahmoud.com**

**Dr Maher Vision AI v2.0** = three open-source Google MediaPipe models
(face detection, 478-point face landmarks, face/hair/skin segmentation;
Apache-2.0) + the clinic's own image-quality gate and colorimetric /
texture measurement methods (this repository). No model in it was trained
on patient photos; see [docs/AI_SOURCES.md](docs/AI_SOURCES.md).

- Real analysis of the uploaded image — no random or demo scores.
- Open-source models (Google MediaPipe, Apache-2.0) running **on our own
  server**; photos are processed in memory and never stored or sent to
  third parties.
- Every score comes with a confidence; unreliable measurements are shown as
  "Insufficient confidence" instead of a number.
- Bad photos (dark, blurry, filtered, glasses, turned head, several faces…)
  are rejected with clear retake advice.

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline, modules, API contract, sign-in, languages, report, security |
| [docs/SCORING.md](docs/SCORING.md) | What each score measures, units, calibration, confidence, quality gate |
| [docs/AI_SOURCES.md](docs/AI_SOURCES.md) | Models, libraries, papers, licences, rejected alternatives |
| [docs/PRIVACY.md](docs/PRIVACY.md) | What happens to a photo, logging, analytics rules |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy, evaluation results, skin-tone checks, limitations |

## Requirements

- Node.js 20.9+ (22 LTS recommended), npm 10+
- ~350 MB disk for `node_modules` (ONNX Runtime ships native binaries)

## Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000 (English) or http://localhost:3000/ar (Arabic).
On a phone on the same network the live camera needs HTTPS; over plain HTTP
the "Take a photo" button falls back to the phone's own camera app.

Scans require a signed-in clinic patient. Sign-in happens on
drmahermahmoud.com and is shared through a cookie on `.drmahermahmoud.com`,
so it cannot work on localhost: put `SKINSCAN_REQUIRE_AUTH=false` in
`.env.local` for local development.

Other scripts:

| Command | Purpose |
|---|---|
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit + API tests (`node:test` via tsx) |
| `npm run verify-models` | Check model files against `models/manifest.json` |
| `npx tsx scripts/fetch-test-images.ts` | Download the public-domain evaluation photos into `test-data/` |
| `npm run evaluate` | Run the evaluation (quality gate, stability, skin-tone slices) |
| `npx tsx scripts/diagnose.ts photo.jpg` | Print diagnostics and raw measurements for a photo |
| `npx tsx scripts/debug-overlay.ts photo.jpg` | Render landmarks, regions and skin masks to `test-data/debug/` |

## Environment variables

Copy `.env.example` to `.env.local`. All are optional.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Canonical URL (metadata). Production: `https://skinscan.drmahermahmoud.com` |
| `NEXT_PUBLIC_API_BASE_URL` | *(same origin)* | Only if the API is hosted elsewhere |
| `NEXT_PUBLIC_BOOKING_URL` | `https://www.drmahermahmoud.com/book` | "Book a Consultation" (Arabic pages use `/ar/book`) |
| `NEXT_PUBLIC_CLINIC_URL` | `https://www.drmahermahmoud.com` | Clinic website: sign-in, account, footer link |
| `SKINSCAN_REQUIRE_AUTH` | `true` | Scans require a signed-in clinic patient (`false` for local development) |
| `CLINIC_URL` | `NEXT_PUBLIC_CLINIC_URL` | Clinic website the server checks sessions with |
| `SKIN_SCAN_MODEL_DIR` | `./models` | Model folder |
| `SKIN_SCAN_MAX_UPLOAD_MB` | `8` | Upload limit |
| `SKIN_SCAN_MAX_INPUT_MEGAPIXELS` | `40` | Decompression-bomb guard |
| `SKIN_SCAN_MAX_ANALYSIS_SIDE` | `2560` | Images are downsized to this before analysis |
| `SKIN_SCAN_TIMEOUT_MS` | `25000` | Per-scan time budget |
| `SKIN_SCAN_MAX_CONCURRENT` | `2` | Scans processed at once per server instance |
| `SKIN_SCAN_ONNX_THREADS` | `2` | CPU threads per model inference |
| `SKIN_SCAN_RATE_LIMIT` / `SKIN_SCAN_RATE_LIMIT_WINDOW_SECONDS` | `8` / `600` | Scans per client per window |
| `ONNXRUNTIME_NODE_INSTALL` | `skip` (via `.npmrc`) | Skips ONNX Runtime's optional CUDA download on Linux |
| `SKINSCAN_ACNE_LESIONS` | `true` | Spot & acne-like mark candidates (experimental section) |
| `SKINSCAN_PORES` | `true` | Pore-visibility estimate (experimental section) |
| `SKINSCAN_ACNE_SEVERITY_MODEL` | *(empty = off)* | File name (in `models/optional/`) of the optional acne-severity ONNX model (licence unresolved — see docs/AI_SOURCES.md) |
| `DERM_FOUNDATION_ENABLED` / `DERM_FOUNDATION_URL` / `DERM_FOUNDATION_TOKEN` / `DERM_FOUNDATION_TIMEOUT_MS` | off | Optional self-hosted Derm Foundation embedding service (`services/derm-foundation`) |

`NEXT_PUBLIC_*` values are inlined at build time — rebuild after changing them.

## How the AI works (short version)

1. **Quality check** — exposure (judged from clipping, the eye whites and
   sensor noise, never from skin brightness), lighting balance, sharpness,
   filters/heavy edits, glasses, head angle, framing.
2. **Face & landmarks** — MediaPipe BlazeFace finds the face; MediaPipe Face
   Mesh V2 places 478 landmarks; the face is rotated level and scaled to
   real-world millimetres.
3. **Skin regions** — forehead, nose, cheeks, chin and under-eyes from the
   landmarks; MediaPipe multiclass segmentation removes hair, glasses and
   background; eyes, brows and lips are excluded.
4. **Measurements** — in CIELAB colour space and log luminance, relative to
   the person's own skin and corrected for lighting, shading and camera
   noise: pigmentation, redness, texture, spots/blemishes, shine, under-eye
   darkness.
5. **Scores & confidence** — documented calibration to 0–100, confidence
   from photo quality and usable skin; low-confidence results are withheld.

Details: [docs/SCORING.md](docs/SCORING.md).

## Optional / experimental components

| Component | Default | Notes |
|---|---|---|
| Spot & acne-like mark candidates | on | Heuristic detector + fold filter; overlay and regional counts. Not a trained acne detector. |
| Pore visibility | on | Only reported for close, sharp, low-noise photos; heat-map overlay. Appearance estimate, not pore size. |
| Acne severity classifier | **off** | `python scripts/convert/convert_acne_classifier.py <pytorch_model.bin>` (from huggingface.co/afscomercial/dermatologic) writes `models/optional/acne_severity.onnx`; then set `SKINSCAN_ACNE_SEVERITY_MODEL=acne_severity.onnx` (a file name inside `models/optional/`). Resolve its data licence first. |
| Derm Foundation | **off** | See `services/derm-foundation/README.md` (gated model, HAI-DEF terms, ~3 GB RAM service). No downstream task uses it yet. |

## Changing or adding models

Models live in `models/` with SHA-256 checksums in `models/manifest.json`
(checked at load time). To rebuild them from Google's official files:

```bash
python -m venv .venv
.venv/Scripts/pip install -r scripts/convert/requirements.txt   # (bin/ on macOS/Linux)
.venv/Scripts/python scripts/convert/convert_models.py
npm run verify-models && npm test && npm run evaluate
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#replacing-or-adding-a-model)
for swapping a model or adding a metric.

## Deploying

### Vercel (same platform as drmahermahmoud.com)

1. Import the GitHub repository in Vercel (framework: Next.js; defaults are fine).
2. Environment variables (Production): `NEXT_PUBLIC_APP_URL=https://skinscan.drmahermahmoud.com`
   and `ONNXRUNTIME_NODE_INSTALL=skip`; optionally the `SKIN_SCAN_*` limits.
3. Function settings: the API route declares `maxDuration = 60`; give
   functions at least 1 GB memory (a scan peaks at ~460 MB including the
   loaded models; measured October 2026). On a VPS allow ~2 GB with the
   default of 2 concurrent scans.
4. The build traces only the Linux x64 ONNX Runtime binaries and the
   `models/` folder into the function (see `next.config.ts`).
5. Keep the upload under Vercel's 4.5 MB request limit — the browser already
   resizes photos to ≤ 3.5 MB.

### Docker / VPS

```bash
docker build -t drmaher-skinscan --build-arg NEXT_PUBLIC_APP_URL=https://skinscan.drmahermahmoud.com .
docker run -p 3000:3000 drmaher-skinscan
```

Put it behind an HTTPS reverse proxy (Caddy, Nginx, Cloudflare). The image
has a health check on `/api/health`.

### Connecting skinscan.drmahermahmoud.com

1. In the hosting project (Vercel: *Settings → Domains*) add
   `skinscan.drmahermahmoud.com`.
2. At the DNS provider for drmahermahmoud.com add the record the host asks
   for — on Vercel a `CNAME scan → cname.vercel-dns.com` (for Docker/VPS an
   `A` record to the server's IP).
3. Wait for the TLS certificate to be issued, then set
   `NEXT_PUBLIC_APP_URL=https://skinscan.drmahermahmoud.com` and redeploy.
4. Optionally link to the scan from the main site (e.g. a "Try the AI Skin
   Scan" button). The scan's "Book a Consultation" button already points to
   `https://drmahermahmoud.com/book`.

## Project layout

```
app/                 page, layout, styles, API routes (/api/skin-scan, /api/health)
components/          the scan flow (landing, photo step, camera, analysing, results)
lib/skin-analysis/   the analysis pipeline (see docs/ARCHITECTURE.md)
lib/client/          browser-side image preparation and API client
models/              ONNX models, manifest with checksums, licence
scripts/             evaluation, diagnostics, model conversion
tests/               unit and API tests
docs/                documentation
```

## Disclaimer

For informational purposes only. The scan describes visible characteristics
in a photo and does not provide medical advice or a diagnosis. Scores are
not clinically validated.
