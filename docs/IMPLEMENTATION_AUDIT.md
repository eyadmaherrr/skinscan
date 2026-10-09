# Implementation Audit: Dr Maher Vision AI (SkinScan)

**Audit Date:** October 2026  
**Auditor:** Senior Computer Vision & ML Engineering Team  
**Scope:** Full pipeline (`lib/skin-analysis/`, `models/`, `app/api/skin-scan/`, `components/`, `tests/`)

---

## Executive Summary

Dr Maher Vision AI v2.0/v2.1 represents an engineered, privacy-preserving, on-premise skin analysis system running on Node.js using ONNX Runtime. The architectural decision to use deterministic physical colorimetry and signal processing (CIELAB colorimetry, Difference-of-Gaussians, Immerkær noise estimation, sclera exposure normalization) backed by local neural networks (BlazeFace, Face Mesh V2, Selfie Multiclass Segmentation, and FairFace ViT) is sound, privacy-respecting, and explainable.

However, a rigorous line-by-line audit identified several critical bugs, mathematical approximations, and fragile assumptions that degrade diagnostic reliability, cause false rejections, or unfairly penalize certain facial structures:

1. **Critical: Expression / Smile Detection Flaw Suppressing Metrics on Neutral Faces:** In `quality.ts`, smile estimation used a naive `Math.max()` across independent geometrical ratios. In particular, a natural resting mouth width greater than 1.1× IOD triggered `smile = 1.0`, setting `expression = 0.0`. This halved confidence for pigmentation, texture, and under-eye darkness, causing valid neutral studio portraits (e.g. evaluation portrait S1) to withhold scores (`score: null`).
2. **Subpixel Array Indexing Bug in Hessian Blobness:** In `blobs.ts` / `acne.ts`, `hessianRatio()` accepted unrounded coordinate values. When floating-point peak coordinates were passed to array indices without `Math.round()`, JavaScript typed arrays returned `undefined`, resulting in `NaN` eigenvalues, dropping candidate blobness to 0.
3. **Face Detector Letterbox Edge-Bleed & Unclipped Bounding Boxes:** In `face-detection.ts`, `warpRgb` clamped out-of-boundary pixels to the nearest border instead of applying neutral zero-padding. Furthermore, the decoded bounding boxes and keypoints were not clamped to the original image dimensions, yielding negative coordinates or boxes extending past the canvas.
4. **Coarse Anatomical Region Boundaries:** Cheeks and chin in `regions.ts` were constructed using hardcoded rectangular/trapezoidal bounding boxes offset by empirical IOD fractions (e.g. `px(0.3)`) rather than tracing the zygomatic arch, infraorbital margin, and jawline landmarks provided by the 478-point Face Mesh.
5. **Pose Estimation Euler Angle Approximation:** Landmark-based yaw, pitch, and roll in `quality.ts` used 2D plane approximations that suffer from projection distortion when the face is slightly tilted or asymmetric.
6. **Separation of Photographic Appearance from Clinical Acne Grading:** In `acne-grade.ts`, heuristic spot counts were mapped directly to the Hayashi acne severity scale without sufficiently explicit differentiation between visual spot candidates and dermatologist-diagnosed acne lesions.

---

## Detailed Findings by Pipeline Stage

### 1. Ingestion & Preprocessing (`image/decode.ts`, `image/warp.ts`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-01** | `warpRgb` edge-clamp instead of zero-padding | Medium | `warp.ts:89-90` clamps `x0` and `y0` to `[0, sw-1]`. In `face-detection.ts`, letterboxed images bleed border colors into the padding areas. | Add a padding mode to `warpRgb` (default clamp, option for zero/black padding for neural net inputs). |
| **AUD-02** | Sharp pixel limit & color profile | Low | Tested with large files. Decodes safely, strips EXIF, converts to sRGB. Verified correct. | Maintain existing safeguards. |

---

### 2. Face Detection & Validation (`face-detection.ts`, `quality.ts`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-03** | Unclipped Detection Bounding Boxes | Medium | `face-detection.ts:153-159` computes `toSrcX(d.xmin)`, `toSrcY(d.ymin)` which can be negative or exceed image width/height when faces are near edges. | Clamp `x, y` to `[0, width]` and ensure `width, height` remain strictly inside image bounds. |
| **AUD-04** | Detection gate misses edge-severed faces | Medium | `checkDetections` in `quality.ts:76` only checks `detections.length === 0` and multiple faces, letting severed faces pass to landmarks. | Add a bounding-box margin check in `checkDetections` to catch severely cut-off detections early. |
| **AUD-05** | SSD Anchor decoding constants | Low | Verified: 896 anchors with 4 strides `[8, 16, 16, 16]` match BlazeFace short-range spec. Decoding math is mathematically sound. | Keep decoding structure; ensure numerical stability with `Math.min/max`. |

---

### 3. Facial Landmarks, Pose & Alignment (`landmarks.ts`, `alignment.ts`, `quality.ts`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-06** | Euler pose approximation vulnerability | Medium | `quality.ts:89-108` estimates yaw, pitch, roll using simple landmark ratios. Pitch and yaw interact non-linearly under perspective projection. | Improve 3D landmark vector projection using canonical 3D facial feature points (nose bridge, tip, chin, eye corners). |
| **AUD-07** | Landmark Outlier & Integrity Check | Low | Currently only checks `presence < 0.5` and oval points outside image. If a landmark collapses to (0,0), alignment continues. | Add a landmark geometric plausibility validator (e.g. check eye-to-eye and eye-to-mouth distance ratios). |

---

### 4. Facial Region Segmentation (`regions.ts`, `segmentation.ts`, `skin-mask.ts`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-08** | Cheeks and Chin defined by arbitrary trapezoids | High | `regions.ts:141-152` defines `cheekL` using `[sideL[0] - px(0.1), cheekTopL]` and `[midXAt(cheekTopL) - px(0.3), cheekTopL]`. This arbitrary shape extends outside the face and ignores actual facial morphology. | Trace the actual anatomical contours: infraorbital margin (landmarks 116..123), alar base (234..), mouth corners, and jawline contour landmarks. |
| **AUD-09** | Facial hair / stubble contamination | Medium | Stubble in male portraits registers as false positive texture and pores. | In `skin-mask.ts` and `regions.ts`, refine perioral and chin masks to downweight or filter areas where dark, high-frequency directional stubble is detected. |
| **AUD-10** | Segmentation Veto Fairness | Low (Positive) | `segmentation.ts` correctly uses Selfie Multiclass as a veto only. This prevents shrinking masks on darker skin tones (Monk tones 9-10). | Retain and document this mechanism. |

---

### 5. Image Quality Assessment (`quality.ts`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-11** | **CRITICAL: Smile detection false positives** | **Critical** | `quality.ts:157`: `smile = Math.max(ramp(0.9, 1.1, mouthWidth), ...)` flags any face with natural resting mouth width $\ge 1.1$ as smiling (`smile=1`). This zeroes `expression`, causing confidence drops below 0.40 and withholding valid metrics on neutral portraits (confirmed on eval set S1). | Require coordinated action: mouth width must be coupled with corner elevation and lip opening, or require corner lift relative to the stomion line. |
| **AUD-12** | Sclera mask erosion in small images | Low | `quality.ts:217` erodes eye mask by `iod * 0.015`. On lower-resolution photos, sclera pixel count can drop below 20. | Provide a fallback to diffuse skin percentile if sclera pixels are insufficient. |

---

### 6. Skin Feature Metrics (`metrics/*.ts`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-13** | **CRITICAL: Subpixel float index in Hessian ratio** | **High** | `blobs.ts:87-88`: `const cx = Math.min(w - 2, Math.max(1, x))` does not round `x` or `y`. If non-integers are passed, `Float32Array[float]` evaluates to `undefined`, yielding `NaN` and failing blobness. | Enforce `const cx = Math.min(w - 2, Math.max(1, Math.round(x)))` in `hessianRatio()`. |
| **AUD-14** | Redness baseline sensitivity to lighting tint | Medium | `metrics/redness.ts` uses 20th percentile of $a^* / (L^* + 16)$. While shading-invariant, strong yellow/orange indoor lighting shifts $a^*$. | Ensure color temperature diagnostics inform redness reliability. |
| **AUD-15** | Under-eye shadow vs pigment confounding | Medium | Overhead lighting creates orbital shadows. `metrics/under-eye.ts` caps reliability at 0.66, but cheek reference band can be inconsistent if cheek top is offset. | Ensure upper cheek reference band is directly adjacent to the infraorbital margin. |
| **AUD-16** | Texture measurement validation | Low | `metrics/texture.ts` properly uses Weber contrast on log luminance and Immerkær noise subtraction. Calibrated on 63mm adult IOD. | Document physical scale assumptions and verify noise gain propagation. |

---

### 7. Extensions (`extensions/`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-17** | Acne clinical severity overclaim | High | `extensions/acne-grade.ts` uses Hayashi count bands. Without dermatologist validation, reporting this as clinical acne grade is medically unsupported. | Frame acne severity explicitly as "Visual Blemish Density Index" with clear clinical disclaimer and keep method transparent (`count_grader`). |
| **AUD-18** | Pore visibility resolution gate | Low (Positive) | `extensions/pores.ts` enforces a strict $\ge 6\text{ px/mm}$ gate, correctly withholding pore analysis on distant/blurry photos. | Maintain strict gating. |
| **AUD-19** | FairFace Age Model Output Validation | Low | `extensions/skin-age.ts` uses `dima806/fairface_age_image_detection`. Probabilities are appropriately grouped into spans. | Clarify that apparent age reflects overall facial features, not cellular/biological skin age. |

---

### 8. API, Security & Privacy (`app/api/skin-scan/`)

| ID | Issue | Severity | Evidence | Intended Fix |
|---|---|---|---|---|
| **AUD-20** | Concurrency and Resource Limits | Low (Positive) | IP rate limiting, concurrency semaphore (`tryAcquire`), cooperative timeout deadline, and strict payload limits are already implemented. | Retain and verify in stress testing. |
| **AUD-21** | Zero data retention guarantee | Low (Positive) | Image buffer is processed in memory and discarded upon request completion; no temporary image files are written to disk. | Retain privacy guarantee. |

---

## Action Plan & Implementation Priority

1. **Fix Critical Correctness Issues:**
   - Correct `smileScore()` in `quality.ts` to prevent false-positive smile detection on neutral faces.
   - Enforce integer coordinate rounding in `hessianRatio()` (`blobs.ts`).
   - Add bounding box clipping and edge checks in `face-detection.ts`.
2. **Upgrade Facial Understanding & Geometry:**
   - Redesign `regions.ts` to follow anatomical Face Mesh landmarks for cheeks, forehead, chin, nose, and under-eye.
   - Improve 3D pose estimation robustness in `quality.ts`.
3. **Refine Metrics & Quality Gates:**
   - Enhance redness, pigmentation, and under-eye reference alignment.
   - Improve stubble and specular highlight isolation in skin masks.
4. **Refactor Acne & Scoring Presentation:**
   - Update `acne-grade.ts` and `scoring.ts` to ensure transparent, defensible, and non-diagnostic reporting.
   - Update multi-factor confidence calculations.
5. **Testing & Documentation:**
   - Write comprehensive automated regression tests (repeatability, perturbations, synthetic cases).
   - Author `docs/MODEL_EVALUATION.md` and update `docs/ARCHITECTURE.md`, `docs/SCORING.md`, `docs/AI_SOURCES.md`.

