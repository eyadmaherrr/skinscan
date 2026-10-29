# Testing and validation

This document describes how the scan is tested, what the latest evaluation
showed, and what has **not** been validated. No claim of clinical accuracy is
made: there is no ground-truth dataset of dermatologist-rated photos yet.

## 1. Automated tests (`npm test`)

`tests/*.test.ts` (Node's built-in test runner via tsx): 102 tests in 35
suites as of v4.0 (28 October 2026, all passing). Among them:

- colour conversion (CIELAB extremes, redness/yellowness signs, ITA ordering);
- calibration is monotonic and bounded for every metric; band edges;
- confidence drops with image quality; unmeasurable metrics are never scored;
- image format sniffing (JPEG/PNG/WebP accepted; SVG, PDF, fake PNG refused);
- filters, robust statistics, noise-gain bounds, fold suppression;
- **measurement regions** (`region-alignment.test.ts`): the under-eye band is
  a real band below the lower lid and the cheeks start below it and stop at
  the mouth corners. This test fails on the v3.0–v3.5 geometry;
- **anatomical zones** (`v3-pipeline.test.ts`): zone scores come only from
  the face-wide evidence, are never more confident than the face-wide
  result, are withheld whenever it is withheld, and are never labelled
  "calibrated";
- rate limiting, sign-in, site lock, SEO routes, report, i18n;
- API: missing image (400), non-multipart (400), disguised file (415),
  unsupported declared type (415), blank image → retake advice with no stack
  trace, and a real frontal photo analysed **deterministically** (identical
  output twice).

## 2. Evaluation harness (`npm run evaluate`)

`scripts/evaluate.ts` runs the full pipeline on reference photos
(`npx tsx scripts/fetch-test-images.ts` downloads them into the git-ignored
`test-data/` folder) and on synthetic variants of every accepted photo. It
reports quality-gate decisions, results by skin-tone group, stability,
construct checks (core metrics and extensions), determinism and the
analysis time of accepted photos. Subjects are reported only as S1…S19.

### Reference set

19 photos from Wikimedia Commons, all public domain (official US government
portraits) or CC0, chosen to cover a range of skin tones, ages and sexes plus
deliberate failure cases (multiple faces, no face, turned heads, glasses,
sunglasses, heavily edited portraits, harsh side lighting). Attribution is
saved in `test-data/reference/CREDITS.json`. Photos of real people are never
committed.

### Synthetic variants (per accepted photo)

| Variant | Simulates | Expected |
|---|---|---|
| mirror, rescale 85%, re-encode q80 | harmless changes | accept, scores stable |
| mild sensor noise, JPEG q30 | cheap camera, heavy compression | accept |
| mild blur (0.6% of IOD) | slight focus miss | accept (lower texture confidence) |
| strong blur (3.5% of IOD) | out of focus / motion | reject: blurry |
| 40% exposure | dim room | accept |
| 4% exposure + noise | very dark | reject: too dark |
| 4× exposure | overexposed / flash | reject: too bright |
| one-sided darkening to 15% | harsh side light | reject: uneven lighting |
| edge-preserving smoothing | beauty filter | reject: filter |
| greyscale | B&W filter | reject: not colour |
| face shrunk to 50 px IOD | too far away | reject: too small |
| face at 110 px IOD | low-resolution camera | accept (texture withheld) |
| 15° rotation | tilted head | accept (corrected by alignment) |
| cut through the nose | half face | reject |
| photo duplicated side by side | two people | reject: multiple faces |
| six red 3 mm spots on the cheeks | blemishes | blemish score must rise |
| twenty red 2–3 mm spots on cheeks and chin | acne-like marks | spot candidates must rise |
| red 22 mm areas on both cheeks | redness | redness score must rise |
| two brown 10 mm patches | pigmentation | pigmentation must rise, uniformity must fall |

Synthetic noise uses a fixed-seed generator, so every run is reproducible.

## 3. Latest results: v4.0 compared with v3.5 (28 October 2026)

Both versions were run with the same harness, on the same machine, one after
the other (methodology 4.0.0 vs the shipped 3.5.0; 19 reference photos and
22 synthetic variants of each accepted photo). Every photo gave identical
output when analysed twice, in both versions.

### What changed in 4.0, and why

| Problem found in v3.5 | Evidence | Fix in 4.0 |
|---|---|---|
| The measurement regions validated in the October 2026 evaluation had been replaced by raw landmark contours: cheeks reaching up to the eyes and including the nasolabial fold and smile crease, an under-eye band reduced to a sliver on the lash line, a small chin | debug overlays; one ordinary portrait newly rejected as "uneven lighting" (the shadowed fold inside the cheek region); weak construct responses below | October geometry restored (`regions.ts`) and guarded by a test |
| The 27 anatomical zones were scored by a separate, simplified engine that ran *before* exposure correction, ignored expression/lighting confidence (confidence floored at 0.30), still measured pores, and labelled the results "calibrated" | `features-v3/engine.ts` | engine deleted; zones are summarised from each metric's own evidence with its confidence and withheld with it (`aggregation-v3.ts`, docs/SCORING.md) |
| Up to 25.8 s per scan (the server limit is 25 s) | timings below | no duplicate zone engine, faster filters, analysis capped at 320 px eye distance (≈ 5.1 px/mm, inside the calibrated range) |
| Skin-tone uniformity rated every face "variable" and did not react to added brown patches | extension table below | switched off by default (`SKINSCAN_SKIN_TONE_UNIFORMITY`) until reworked |
| Public pages claimed calibration "across all Fitzpatrick phototypes I–VI", ITA-adapted redness thresholds, hydration measurement and an overhead-light check — none of which exist | `lib/content/pages-content.ts` vs this document §4 | copy corrected (English and Arabic) |

### Quality gate decisions

| Condition | Expected | v3.5 | v4.0 |
|---|---|---|---|
| original (frontal reference photos) | accept | 8/9 | **9/9** |
| problem originals (no face, several faces, turned heads, glasses, edits, side light) | reject for the right reason | 10/10 | 10/10 |
| mirror / rescale / re-encode / jpeg q30 / blur mild / dark mild / low resolution / rotated 15° | accept | all | all |
| noise_mild | accept | 7/8 | **9/9** |
| blur_strong, dark_severe, overexposed, greyscale, tiny_face, half_face, two_faces | reject | all | all |
| side_light | reject: uneven_lighting | 7/8 | **9/9** |
| beauty_filter | reject: filter_detected | 6/8 | 7/9 |

(v3.5 accepted only 8 of the 9 reference portraits, so its variant counts are out of 8.)

### Results by skin-tone group (v4.0, accepted originals)

Values in brackets are confidences; "—" means withheld (confidence below 0.40).

| Subject | ITA° group | Overall confidence | pigmentation | redness | texture | blemishes | shine | underEye |
|---|---|---|---|---|---|---|---|---|
| S1 | very light (ITA > 55°) | 0.53 | 15 (0.49) | 48 (0.83) | — (0.39) | 0 (0.59) | 33 (0.57) | — (0.32) |
| S2 | very light (ITA > 55°) | 0.50 | — (0.34) | 58 (0.81) | 22 (0.50) | 0 (0.63) | 35 (0.54) | — (0.20) |
| S3 | intermediate (28–41°) | 0.51 | — (0.34) | 54 (0.79) | 46 (0.53) | 17 (0.64) | 43 (0.55) | — (0.19) |
| S7 | tan (10–28°) | 0.56 | 5 (0.47) | 36 (0.86) | 54 (0.50) | 11 (0.65) | 13 (0.59) | — (0.31) |
| S9 | tan (10–28°) | 0.53 | — (0.35) | 35 (0.82) | 35 (0.50) | 10 (0.64) | 35 (0.55) | — (0.31) |
| S10 | light (41–55°) | 0.50 | — (0.40) | 85 (0.86) | — (0.33) | 29 (0.58) | 39 (0.59) | — (0.22) |
| S11 | light (41–55°) | 0.43 | — (0.25) | 46 (0.67) | 30 (0.52) | 3 (0.53) | 41 (0.49) | — (0.14) |
| S12 | intermediate (28–41°) | 0.40 | — (0.27) | 33 (0.72) | — (0.29) | 12 (0.49) | 40 (0.47) | — (0.16) |
| S13 | intermediate (28–41°) | 0.35 | — (0.21) | 86 (0.54) | — (0.39) | 44 (0.40) | 55 (0.43) | — (0.11) |

These are the values of the October 2026 evaluation (same geometry) within
rounding, as expected: the core metrics were not changed.

### Construct checks (score change after synthetic edits)

| Edit | Metric | v3.5 | v4.0 |
|---|---|---|---|
| red_spots | blemishes | +7.8 (8/8 increased) | **+13.6** (8/8) |
| brown_patch | pigmentation | +5.3 (3/3) | **+17.5** (2/2) |
| red_area | redness | +2.6 (8/8) | +2.9 (8/9) |
| acne_like | spot candidates | +12.8 (8/8) | +11.7 (9/9) |
| brown_patch | skin-tone unevenness | −0.13 (0/8) | −0.11 (0/9) — fails |

Restoring the regions roughly doubled the response of blemishes and
pigmentation to real changes. The pigmentation counts are small because it
is withheld on smiling photos (below).

### Stability (v4.0; mean / max absolute score change vs. original)

| Change | pigmentation | redness | texture | blemishes | shine | underEye |
|---|---|---|---|---|---|---|
| mirror | 2.0 / 2 | 1.7 / 3 | 0.6 / 1 | 2.4 / 8 | 2.9 / 7 | n/a |
| rescale_85 | 6.5 / 12 | 0.8 / 1 | 0.6 / 2 | 1.5 / 3 | 2.2 / 8 | n/a |
| reencode_q80 | 2.5 / 4 | 0.8 / 2 | 0.8 / 2 | 2.0 / 7 | 2.0 / 5 | n/a |
| noise_mild | 1.5 / 2 | 0.6 / 1 | 3.2 / 4 | 1.4 / 6 | 1.0 / 4 | n/a |
| jpeg_q30 | 11.5 / 20 | 2.8 / 5 | 0.8 / 2 | 3.1 / 8 | 3.9 / 14 | n/a |
| blur_mild | 1.0 / 1 | 0.8 / 3 | n/a | 2.0 / 4 | 2.9 / 6 | n/a |
| dark_mild | 3.0 / 6 | 2.4 / 7 | 0.6 / 1 | 1.8 / 6 | 1.3 / 3 | n/a |
| rotated_15 | 3.0 / 6 | 0.6 / 2 | 2.0 / 4 | 2.6 / 6 | 1.4 / 5 | n/a |
| low_resolution | 5.0 / 9 | 1.0 / 2 | n/a | 1.2 / 6 | 6.3 / 13 | n/a |

Compared with v3.5, blemishes are steadier (max change 3 / 4 / 6 instead of
10 / 10 / 10 under rescaling, mild blur and low resolution); the other
metrics are within a couple of points of v3.5. Pigmentation (measured on only
2 photos here) moves up to 20 points under JPEG quality 30: block artefacts
look like small pigment spots. It is stable at quality 50 and above
(checked separately: 15 → 11 → 8 → 35 for quality 100/80/50/30 on S1), and
the app always re-encodes uploads at quality 0.85–0.92, so this only
affects photos that were already heavily compressed before upload.

### Extensions (v4.0)

| Subject | Apparent age (span, p) | Skin-tone uniformity (score, band) | Spot candidates (red) |
|---|---|---|---|
| S1 | 20–29 (0.75) | 20 (variable) | 0 (0) |
| S2 | 20–29 (0.66) | 24 (variable) | 0 (0) |
| S3 | 20–39 (0.89) | 16 (variable) | 1 (0) |
| S7 | 30–39 (0.60) | 15 (variable) | 0 (0) |
| S9 | 20–29 (0.69) | 15 (variable) | 0 (0) |
| S10 | 30–49 (0.83) | 8 (variable) | 5 (0) |
| S11 | 20–29 (0.75) | 16 (variable) | 1 (1) |
| S12 | 30–49 (0.79) | 20 (variable) | 0 (0) |
| S13 | 30–49 (0.78) | 12 (variable) | 3 (0) |

- **Skin-tone uniformity** (evaluated here for the first time) rated all nine
  ordinary portraits "variable" (8–24 / 100) and did not change when brown
  patches were added (0/9). It is stable (≤ 3 points) only because it barely
  responds to the skin. It is **off by default since v4.0** and must be
  reworked and re-evaluated before it is shown again.
- **Apparent age** keeps its range under harmless changes except at range
  boundaries (a 10-year jump in at most one photo per change); it is shown as
  a range with the model's probability.
- **Spot candidates** rise for every photo with added acne-like marks (+11.7,
  9/9) and change by ≤ 6 under harmless changes.

### Analysis time (accepted photos, same machine)

| | median | max |
|---|---|---|
| v3.5 | ≈ 9.9 s | **25.8 s** (over the 25 s server limit) |
| v4.0 | 4.6 s | 6.9 s |

(Earlier versions of this document quoted the median over all photos,
including rejected ones that stop early; the harness now reports accepted
photos only.)

### Reading these results

- **Quality gate:** every good reference photo is accepted again and every
  problem photo is rejected for the right reason. Misses: the synthetic
  beauty filter on two photos (one below the 3 px/mm needed to judge fine
  detail, where texture is withheld anyway).
- **Withheld metrics:** every reference portrait shows a broad smile
  (smile score 0.65–1.0), and smiling folds the cheeks, so pigmentation is
  withheld on 7 of 9, under-eye darkness on all 9 and texture on 4. The smile
  detector correctly scores closed-mouth faces 0 (checked with
  `scripts/expression-check.ts` on the rejected neutral portraits), so these
  penalties should not apply to the neutral-expression photos the app asks
  for — but **no accepted neutral-expression photo exists in this set**, so
  that has not been measured.
- **Redness:** two ordinary portraits score "pronounced" (85, 86). The
  calibration places the highest values of this small studio set around
  75–85 by design (docs/SCORING.md); it is provisional until expert ratings
  exist.

### Earlier evaluation (9 October 2026, methodology 2.0)

The first evaluation found and led to fixes for: exposure-dependent colour
scores (eye-white normalisation), shading counted as pigmentation
(shading-invariant ratio, fold suppression), lighting-dependent shine
(highlight-robust reference), noise inflating texture on darker/dimmer
images (noise correction), an over-strict lighting gate, missed thin-framed
glasses, and an unstable pore metric (removed). Its region geometry is the
one restored in v4.0.

## 4. Skin-tone fairness

Design measures (see docs/SCORING.md):

- No threshold in the quality gate depends on skin brightness: exposure is
  judged from clipping, the eye whites and sensor noise; lighting balance
  from luminance *ratios*.
- Colour metrics are relative to the person's own skin; texture uses
  relative contrast with the camera-noise contribution removed (noise is
  relatively larger on darker skin).
- The segmenter, whose model card reports lower accuracy on the darkest
  Monk tones (IoU 68% vs 77%), is only used to *veto* non-skin pixels; the
  analysed regions come from the landmark model (skin-tone error spread
  2.49–2.90% of IOD on its model card).
- ITA° is computed only to slice evaluation results — never for scoring.

What the evaluation shows and does not show: the accepted reference photos
cover the very light, light, intermediate and tan ITA° groups (2–3 photos
each) with similar acceptance and confidence levels, but **no accepted photo
falls in the brown or dark groups**: the darkest-skinned subjects in the set
were rejected for reasons unrelated to skin tone (a heavily edited portrait,
a turned head, harsh one-sided lighting). Fairness across the full range of
skin tones is therefore **not yet demonstrated** and is the first priority for
the next evaluation round (below). (v4.0 re-ran this check: same groups,
same conclusion. The public pages no longer claim otherwise.)

## 5. Known limitations

- **Expression:** smiling creases the cheeks; folds look like darker or
  rougher skin. Pigmentation, texture and under-eye confidence are reduced
  when a smile is detected and pigmentation is usually withheld. All reference
  portraits were smiling, so pigmentation could not be evaluated on neutral
  faces.
- **Studio portraits only:** the reference photos are professional portraits;
  phone selfies (wide-angle distortion, HDR processing, beauty modes) still
  need to be tested.
- **Calibration is provisional** (small set, no expert ratings).
- **Beauty-filter detection** needs ≥ 3 px/mm of face detail; on very
  low-resolution photos smoothing filters can pass undetected (texture is
  then withheld for low resolution anyway).
- **Shine** depends on the light source; **under-eye darkness** cannot be
  separated from overhead shadows — both are capped at moderate confidence.
- **Group photos with small faces** are reported as "no face" rather than
  "multiple faces" (the detector is tuned for selfie-distance faces).
- **Pore visibility was removed** after evaluation: it changed by up to 17
  points with mild camera noise and ±15 with compression or rotation.
- **Heavily compressed photos:** JPEG block artefacts at quality ~30 raise
  pigmentation by up to 20 points (§3). Uploads from the app are re-encoded
  at quality 0.85–0.92, so this needs a photo that was already heavily
  compressed (for example forwarded several times through messaging apps).
- **Skin-tone uniformity is off** (§3): it did not respond to added pigment
  patches and rated every reference face "variable".
- **Zones are noisier than the face-wide scores:** a zone summarises 20–500 mm²
  of skin, so one highlight or spot can move it a lot (for example a
  specular highlight on the nose tip gives that zone a shine score of 100).
  Zone confidence is reduced for small zones, but zone scores are best read
  as "where", not "how much".

## 6. Next steps before relying on the scores

1. Collect consented scans made with this tool (neutral expression, phone
   cameras, all Fitzpatrick / Monk groups, several lighting conditions).
2. Have the clinic's dermatologists rate the same photos (e.g. visible
   redness, pigmentation, texture on a 0–4 scale) and compute agreement
   (Spearman correlation, Bland–Altman) per metric and per skin-tone group.
3. Re-fit the calibration anchors on that data; remove or rework any metric
   that does not agree with expert ratings or differs systematically between
   skin-tone groups.
4. Repeat-scan reliability: the same person, minutes apart, same and
   different lighting (intra-class correlation).
5. Add neutral-expression, phone-camera photos to the reference set (public
   domain or consented): every accepted reference photo today is a broad
   smile, which hides how pigmentation and under-eye darkness behave on the
   photos the app actually asks for.
