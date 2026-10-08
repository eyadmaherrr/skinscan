# Scoring methodology

**Read this first:** the scores are *visibility indices* computed from one
photo. They describe how visible a characteristic is in that photo. They
are **not** clinically validated measurements, medical grades or diagnoses,
and no scientifically validated thresholds exist for them. Lighting, camera,
make-up and expression change them.

## From pixels to a score

```
photo ──▶ quality gate ──▶ skin regions ──▶ raw measurement (physical units)
      ──▶ calibration anchors ──▶ 0–100 score + band
      ──▶ confidence (reliability × quality factors × coverage)
      ──▶ shown only if confidence ≥ 0.40, otherwise "Insufficient confidence"
```

- **Score** 0–100: higher = the characteristic is *more visible*.
- **Band**: 0–24 minimal · 25–49 mild · 50–74 moderate · 75–100 pronounced.
- **Confidence** 0–1, labelled high (≥ 0.75), moderate (≥ 0.55), low
  (≥ 0.40), insufficient (< 0.40 → no score is shown).
- **Overall analysis confidence** = mean of all metric confidences, so
  metrics that could not be measured lower it.
- Results are **deterministic**: the same photo always produces the same
  output (verified in the evaluation).

## Principles applied to every metric

1. **Measure relative to the person's own skin.** Skin colour differs
   between people and photos; a fixed colour threshold would systematically
   mis-score lighter or darker skin. Redness, pigmentation and under-eye
   darkness are therefore measured against the person's surrounding skin.
2. **Remove lighting effects.** Exposure is normalised with the eye whites
   (whose brightness does not depend on skin tone). Shading scales the
   CIELAB vector (L*+16, a*, b*) uniformly, so ratios like a*/(L*+16) are
   used to separate colour changes from shadows. Fine-detail measurements use
   log luminance (relative contrast) with the camera-noise contribution
   subtracted, because noise is relatively larger on darker skin and in dim
   light.
3. **Work in real-world units.** The face is scaled using the inter-ocular
   distance (adult mean 63 mm), so filter sizes are in millimetres and close
   and distant photos are measured at the same physical scale.
4. **Analyse regions separately.** Forehead, nose, both cheeks, chin and both
   under-eye areas; eyes, brows, lips, hair, accessories, deep shadows and
   overexposed pixels are excluded.

## Metrics

| Metric | Raw measurement (unit) | Regions | Calibration anchors (raw value at score 0 / 25 / 50 / 75 / 100) |
|---|---|---|---|
| Uneven pigmentation | Pigment-equivalent darkening ΔL* over the most affected 15% of skin | forehead, cheeks, chin | 0 / 0.8 / 1.6 / 2.6 / 4.0 |
| Visible redness | a* excess over the person's baseline ratio, over the most affected 20% of skin | forehead, nose, cheeks, chin | 0 / 2.5 / 5.5 / 9 / 14 |
| Skin texture | Noise-corrected 0.2–1 mm log-luminance contrast (%) | forehead, nose, cheeks, chin | 0.5 / 2.2 / 3.6 / 5.2 / 7.5 |
| Visible spots & blemishes | Contrast-weighted spots (≈1.5–5 mm, red or dark) per 10 cm² | forehead, nose, cheeks, chin | 0 / 0.6 / 2 / 4.5 / 9 |
| Shine | % of skin with specular highlights (T-zone 60%, cheeks 40%) | forehead, nose, cheeks | 0 / 1.5 / 3.5 / 6 / 10 |
| Under-eye darkness | ΔL* upper cheek − under-eye (per side, averaged) | under-eyes vs upper cheeks | 0 / 2.5 / 5 / 8.5 / 13 |

Scores between anchors are interpolated linearly (`lib/skin-analysis/scoring.ts`).

### Uneven pigmentation (`metrics/pigmentation.ts`)
Pigment makes skin darker *and* relatively more saturated; shadows make it
darker while keeping the chroma/(L*+16) ratio. Each pixel (smoothed 0.4 mm)
is compared with its surroundings (σ 8 mm):
`D = (L*ref + 16) · (1 − ρref/ρ)`, `ρ = C*/(L*+16)`. Shifts toward red are
excluded (that is redness), pixels near region borders are ignored, and
elongated evidence (folds, creases) is discarded by a shape test. Captures
spots and patches up to ≈1.5 cm; broader patches cannot be separated from
lighting in an uncontrolled photo.

### Visible redness (`metrics/redness.ts`)
CIELAB a* is the colorimetric correlate of erythema. The ratio
a*/(L*+16) is shading-invariant; its 20th percentile over the face is the
person's baseline. Each pixel's excess a* over that baseline (minus a
2-unit tolerance ≈ 1 JND) is averaged over the most affected 20% of skin, so
localised redness is not diluted. Limitation: uniformly red skin cannot be
told apart from warm lighting and is not captured.

### Skin texture (`metrics/texture.ts`)
Robust amplitude (IQR/1.349) of a 0.2–1.0 mm difference-of-Gaussians on log
luminance, minus the camera-noise contribution (Immerkær noise estimate
propagated through the filter). Not reported below 2.5 px/mm.

### Visible spots & blemishes (`metrics/blemishes.ts`)
Multi-scale difference-of-Gaussians blob detection (σ 0.6/1.0/1.5 mm) on
L* (darker spots, ≥ 4 ΔL*) and a* (redder spots, ≥ 3 Δa*), with
non-maximum suppression and a requirement that the spot is surrounded by
skin. It cannot tell what a spot is (blemish, mark, mole, freckle).

### Shine (`metrics/shine.ts`)
Specular highlights: brighter than the surrounding *diffuse* skin (a
reference computed with highlight candidates excluded, so broad highlights
do not hide themselves) by 12% of the scene illumination (estimated from the
eye whites, so independent of skin tone), and either less saturated than the
surrounding skin or fully clipped to white. Confidence is
capped at "moderate" because shine depends strongly on the light source.

### Under-eye darkness (`metrics/under-eye.ts`)
Median L* of the upper cheek minus median L* of the under-eye band, per side
(the colorimetric comparison used in dark-circle studies). Overhead light
creates shadows indistinguishable from darker skin, so confidence is capped
at "moderate" and reduced when the two sides disagree or lighting is uneven.

## How the anchors were set

Anchors were set from the observed distribution over the accepted reference
portraits of the evaluation set (`npm run evaluate`, see `docs/TESTING.md`)
so that the typical value lands in the *mild* band and the highest observed
values land around 75–85. Observed raw values (9 accepted reference
portraits, October 2026; shine re-measured after the robust-reference fix):

| Metric | Min | Median | Max |
|---|---|---|---|
| Pigmentation | 0.44 | 1.18 | 2.70 |
| Redness | 3.45 | 5.25 | 11.28 |
| Texture | 1.64 | 2.79 | 4.78 |
| Blemishes | 0 | 0.26 | 1.64 |
| Shine | 0.76 | 2.6 | 4.01 |
| Under-eye | 0 | 1.39 | 9.50 |

This is a small set of professional studio portraits. The calibration is
**provisional** and must be redone on consented photos captured with the
scan itself, ideally rated by the clinic's dermatologists (see "Next steps"
in docs/TESTING.md). Re-calibrating only changes `CALIBRATION` in
`scoring.ts`; bump `METHODOLOGY_VERSION` when doing so.

## Confidence model (`confidence.ts`)

```
confidence = reliability (metric-specific, e.g. shine ≤ 0.62, redness ≤ 0.92)
           × Π (1 − wᵢ + wᵢ · qᵢ)     image-quality factors qᵢ ∈ [0, 1]
           × (0.4 + 0.6 · coverage)   share of the needed skin that was usable
```

| Quality factor | Measured from |
|---|---|
| sharpness | re-blur index around the eyes |
| exposure | clipped/crushed skin pixels, eye-white brightness |
| lighting | luminance ratio between the two cheeks |
| pose | head yaw and pitch from the 3-D landmarks |
| resolution | pixels per millimetre on the face |
| noise | signal-to-noise ratio on the skin |
| natural detail | evidence of smoothing filters or heavy sharpening |
| expression | smile score from mouth width, opening and corner lift (smiling folds the cheeks) |

Weights wᵢ per metric are in `confidence.ts` (e.g. texture depends mostly on
sharpness and resolution; under-eye mostly on lighting; pigmentation, texture
and under-eye are reduced when the person is smiling, and the explanation
then asks for a neutral expression).

## Quality gate (photos are rejected, not scored)

| Check | Rule (see `QUALITY_THRESHOLDS` in `quality.ts`) |
|---|---|
| No face / several faces | BlazeFace; a second face scoring ≥ 0.6 and ≥ 20% of the main face's area |
| Face too small | inter-ocular distance < 70 px |
| Face cut off | > 4% of face-outline landmarks outside the photo |
| Head angle | yaw > 24°, pitch > 25° or roll > 30° |
| Too dark | > 20% of skin pixels near-black, eye whites L* < 32 (sharp photos only), skin L* < 10, or SNR < 5 |
| Too bright | > 15% of skin pixels clipped |
| Uneven lighting | cheek luminance ratio > 3.5 |
| Blurry | re-blur index > 0.62 |
| Filter / heavy edit | noise-corrected fine detail < 0.7% (smoothing) or > 9% (sharpening/HDR) |
| Not a colour photo | skin chroma < 4 or skin hue outside 5–95° |
| Glasses / sunglasses | segmenter "accessory" pixels around / inside the eyes |
| Face covered | > 30% of the face interior vetoed by the segmenter |
| Not enough skin | < 35% of the analysis regions usable |

None of these thresholds depends on how light or dark the skin is.

## Not measured

- **Pore visibility** — implemented, evaluated and removed (unstable; see
  docs/TESTING.md).
- **Dryness / hydration** — no valid visual correlate in a normal photo.
- **Acne severity, rosacea, melasma or any condition** — these are medical
  diagnoses and out of scope.
