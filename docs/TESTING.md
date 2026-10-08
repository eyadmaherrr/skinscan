# Testing and validation

This document describes how the scan is tested, what the latest evaluation
showed, and what has **not** been validated. No claim of clinical accuracy is
made: there is no ground-truth dataset of dermatologist-rated photos yet.

## 1. Automated tests (`npm test`)

`tests/core.test.ts` and `tests/api.test.ts` (Node's built-in test runner via
tsx), 20 tests:

- colour conversion (CIELAB extremes, redness/yellowness signs, ITA ordering);
- calibration is monotonic and bounded for every metric; band edges;
- confidence drops with image quality; unmeasurable metrics are never scored;
- image format sniffing (JPEG/PNG/WebP accepted; SVG, PDF, fake PNG refused);
- filters (blur keeps constants, erosion/dilation areas), robust statistics,
  noise-gain bounds, fold suppression (lines removed, spots kept);
- rate limiting window;
- API: missing image (400), non-multipart (400), disguised file (415),
  unsupported declared type (415), blank image → retake advice with no stack
  trace, and a real frontal photo analysed **deterministically** (identical
  output twice).

## 2. Evaluation harness (`npm run evaluate`)

`scripts/evaluate.ts` runs the full pipeline on reference photos
(`npx tsx scripts/fetch-test-images.ts` downloads them into the git-ignored
`test-data/` folder) and on synthetic variants of every accepted photo. It
reports quality-gate decisions, results by skin-tone group, stability,
construct checks, determinism and timing. Subjects are reported only as
S1…S19.

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
| red 22 mm areas on both cheeks | redness | redness score must rise |
| two brown 10 mm patches | pigmentation | pigmentation score must rise |

Synthetic noise uses a fixed-seed generator, so every run is reproducible.

## 3. Latest results

Run of `npm run evaluate`, 9 October 2026, methodology 2.0.0 (19 reference
photos, 21 synthetic variants of each of the 9 accepted photos). Values in
brackets are confidences; "—" means the metric was withheld (confidence
below 0.40). All results were identical when the same photo was analysed
twice (determinism check passed for 19/19 photos).

### Quality gate decisions

| Condition | Expected | Matched |
|---|---|---|
| original (frontal reference photos) | accept | 9/9 |
| S4 original: multiple faces | reject | yes (no_face) |
| S5 original: head turned ~51° | reject | yes (face_angle) |
| S6 original: no face | reject | yes (no_face) |
| S8 original: heavily sharpened / 'clarity'-edited portrait | reject | yes (filter_detected) |
| S14 original: wearing glasses | reject | yes (glasses) |
| S15 original: sunglasses, head turned | reject | yes (face_angle) |
| S16 original: head turned ~31° | reject | yes (face_angle) |
| S17 original: heavily edited portrait, clipped highlights | reject | yes (filter_detected) |
| S18 original: strong one-sided lighting, head turned ~17° | reject | yes (uneven_lighting) |
| S19 original: wearing glasses, bright flash | reject | yes (glasses, too_bright) |
| mirror | accept | 9/9 |
| rescale_85 | accept | 9/9 |
| reencode_q80 | accept | 9/9 |
| noise_mild | accept | 9/9 |
| jpeg_q30 | accept | 9/9 |
| blur_mild | accept | 9/9 |
| blur_strong | reject: blurry | 9/9 |
| dark_mild | accept | 9/9 |
| dark_severe | reject: too_dark | 9/9 |
| overexposed | reject: too_bright | 9/9 |
| side_light | reject: uneven_lighting | 9/9 |
| beauty_filter | reject: filter_detected | 7/9 |
| greyscale | reject: not_color | 9/9 |
| tiny_face | reject: face_too_small / no_face | 9/9 |
| low_resolution | accept | 9/9 |
| rotated_15 | accept | 9/9 |
| half_face | reject: face_cropped / no_face / face_angle | 9/9 |
| two_faces | reject: multiple_faces | 9/9 |
| red_spots | accept | 9/9 |
| brown_patch | accept | 9/9 |
| red_area | accept | 9/9 |

### Results by skin-tone group (accepted originals)

| Subject | ITA° group | Overall confidence | pigmentation | redness | texture | blemishes | shine | underEye |
|---|---|---|---|---|---|---|---|---|
| S1 | very light (ITA > 55°) | 0.49 | — (0.36) | 48 (0.83) | — (0.34) | 0 (0.59) | 33 (0.57) | — (0.26) |
| S2 | very light (ITA > 55°) | 0.51 | — (0.34) | 58 (0.81) | 23 (0.53) | 0 (0.65) | 37 (0.55) | — (0.19) |
| S3 | intermediate (28–41°) | 0.51 | — (0.34) | 55 (0.79) | 46 (0.54) | 18 (0.64) | 44 (0.55) | — (0.19) |
| S7 | tan (10–28°) | 0.53 | — (0.38) | 36 (0.86) | 54 (0.46) | 11 (0.65) | 13 (0.59) | — (0.27) |
| S9 | tan (10–28°) | 0.53 | — (0.35) | 36 (0.82) | 36 (0.53) | 10 (0.65) | 36 (0.55) | — (0.31) |
| S10 | light (41–55°) | 0.5 | — (0.40) | 85 (0.86) | — (0.33) | 29 (0.58) | 39 (0.59) | — (0.22) |
| S11 | light (41–55°) | 0.43 | — (0.25) | 46 (0.67) | 30 (0.52) | 3 (0.53) | 41 (0.49) | — (0.14) |
| S12 | intermediate (28–41°) | 0.4 | — (0.27) | 33 (0.72) | — (0.29) | 12 (0.49) | 40 (0.47) | — (0.16) |
| S13 | intermediate (28–41°) | 0.34 | — (0.20) | 86 (0.54) | — (0.38) | 44 (0.40) | 55 (0.43) | — (0.11) |

### Stability (mean / max absolute score change vs. original)

| Change | pigmentation | redness | texture | blemishes | shine | underEye |
|---|---|---|---|---|---|---|
| mirror | n/a | 1.6 / 4 | 0.4 / 1 | 2.9 / 8 | 2.9 / 6 | n/a |
| rescale_85 | n/a | 0.6 / 1 | 1.0 / 2 | 1.4 / 3 | 2.2 / 8 | n/a |
| reencode_q80 | n/a | 0.6 / 2 | 0.2 / 1 | 2.6 / 7 | 2.1 / 5 | n/a |
| noise_mild | n/a | 0.4 / 1 | 3.0 / 4 | 1.3 / 5 | 1.0 / 4 | n/a |
| jpeg_q30 | n/a | 2.7 / 5 | 1.0 / 2 | 3.3 / 8 | 4.0 / 14 | n/a |
| blur_mild | n/a | 0.6 / 3 | n/a | 2.1 / 4 | 3.1 / 6 | n/a |
| dark_mild | n/a | 2.4 / 7 | 0.2 / 1 | 2.4 / 6 | 1.3 / 3 | n/a |
| rotated_15 | n/a | 0.6 / 2 | 2.4 / 4 | 2.4 / 5 | 1.9 / 5 | n/a |
| low_resolution | n/a | 1.0 / 2 | n/a | 1.3 / 6 | 6.8 / 13 | n/a |

### Construct checks (score change after synthetic edits)

| Edit | Metric | Mean change | Increased in |
|---|---|---|---|
| red_spots | blemishes | 14.3 | 8/8 |
| red_area | redness | 2.7 | 8/9 |

Median analysis time: 1174 ms

**Reading these results**

- **Quality gate:** every good reference photo was accepted and every problem
  photo was rejected for the right reason. The only gate misses were the
  synthetic beauty filter on one low-resolution photo (2.7 px/mm, below the
  3 px/mm needed to judge fine detail; texture is withheld there anyway) and
  one filtered photo rejected as *blurry* instead of *filtered* (still a
  correct rejection, different message).
- **Stability:** harmless changes (mirroring, resizing, re-encoding, mild
  noise, rotation, dimmer exposure) move reported scores by about 1–3
  points on average and at most 8, except shine under heavy JPEG compression
  or very low resolution (max 13–14).
- **Construct checks:** adding small red spots raised the blemish score in
  8/8 photos (+14 on average); adding red areas raised redness in 8/9
  (+2.7 — the measure is deliberately conservative). The brown-patch check
  could not be scored because pigmentation was withheld.
- **Withheld metrics:** every reference portrait shows a broad smile, so
  pigmentation and under-eye darkness were withheld on all of them (smile
  folds are indistinguishable from darker skin), and texture was withheld
  where low resolution added to that. This is the intended behaviour, but it
  means **pigmentation and under-eye darkness still have to be validated on
  neutral-expression photos.**
- **Earlier iterations** of this evaluation found and led to fixes for:
  exposure-dependent colour scores (fixed with eye-white normalisation),
  shading counted as pigmentation (shading-invariant ratio, fold
  suppression), lighting-dependent shine (highlight-robust reference), noise
  inflating texture on darker/dimmer images (noise correction), an
  over-strict lighting gate, missed thin-framed glasses, and an unstable
  pore metric (removed).

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
the next evaluation round (below).

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
