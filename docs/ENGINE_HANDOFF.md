# Engine handoff (11 November 2026)

Work done on the scan engine after 4.0 (`f570b06`), uncommitted on `main`,
and what is left. Read `CLAUDE.md` → the knowledge base first.

## Done (affects what patients see) — tests 122/122, `tsc` clean

| Change | Files | Evidence |
|---|---|---|
| **Blemish score no longer counts skin folds.** The roundness test (`blobness`) moved from the acne report into the spot detector, so the score and the spot list agree. | `metrics/blemishes.ts`, `extensions/acne.ts` | Before: a score of 44 with 3 real candidates, and "11/100" above "0 spot candidates". After, on the 9 reference portraits: 0, 3, 3, 7, 0, 0, 13, 0, 0. |
| **Landmarks averaged over the mirrored face.** The landmark model is not left/right symmetric; it now runs on the crop and its flip, averaged through a verified mirror table. | `landmarks.ts`, `landmark-mirror.ts`, `scripts/derive-landmark-mirror.ts` | Lossless-mirror landmark shift: median 1.0–2.2% of IOD (max 6%) → 0.13–0.34% (max 0.75%). Costs two extra landmark inferences. |
| **Shine measured at a fixed physical sharpness (0.4 mm)**, so it no longer drops on lower-resolution cameras. | `metrics/shine.ts` | Worst portrait: 55 → 40 between full and 40% size before; 52 → 46 after. |
| **Shadowed eye whites no longer over-brighten the photo.** The exposure reference is never darker than the skin. | `index.ts` (`referenceWhiteY`) | Two portraits had eye whites darker than skin and gains of 1.34 / 1.56. |
| **Withheld results give the right advice**: "neutral expression" only when that alone would fix it, otherwise expression *and* lighting. | `index.ts`, `text.ts` (EN + AR) | New reason `expression_and_conditions`. |
| **Tight close-ups are accepted.** A photo that trims about 5% of the hairline, chin or sides was always rejected as "face cropped" (2 of 36 outline points outside was enough). Now the eyes, brows, nose and mouth must be in the photo and at most 5% of the measured skin may be outside it; only skin inside the photo is measured. | `quality.ts` (`checkLandmarks`, `maxSkinOutsidePhoto`), `index.ts` | 5% trims: 0/9 accepted before, 15/18 after, scores within a few points of the uncropped photo. 10% trims are still rejected: shine drifted 9-20 points when they were let through. |
| **Head tilt is measured from level.** The forehead-to-chin line leans back about 7.5 degrees on an upright head, so the 25 degree limit was really +17 / -32. | `quality.ts` (`neutralPitchDeg`) | Level reference portraits read 3-18 degrees before (median 7.8), about -4 to +10 after. Also raises the pose confidence factor on level faces. |
| **A failed upload no longer leaks a scan slot** (two leaks made every scan return "busy" until restart). | `app/api/skin-scan/route.ts` | — |

## Left for the next session (no effect on what patients see)

1. **Run the full evaluation** (`npm run evaluate`, ~70 min) and replace
   `docs/TESTING.md` §3 with the new numbers. Expect blemish values to be
   lower and steadier, shine steadier across `low_resolution` and
   `rescale_85`, mirror differences near zero.
2. **Re-check the calibration anchors** for blemishes and shine in
   `scoring.ts` against the new raw values (`docs/SCORING.md` "How the
   anchors were set"); bump `METHODOLOGY_VERSION` (4.1.0) and, if wanted, the
   engine name (it appears in `lib/brand.ts`, `lib/site-metadata.ts`,
   `lib/content/pages-content.ts` and the docs).
3. **Tests** for the new behaviour: mirror table is a self-inverse
   permutation; a line-shaped detection is not counted as a blemish; shine
   on a down-scaled copy stays within a few points; `referenceWhiteY`;
   the `expression_and_conditions` reason; the slot is released when
   reading the upload throws.
4. **Docs and knowledge base**: `docs/SCORING.md` (blemishes, shine,
   exposure reference), `docs/ARCHITECTURE.md` (landmark averaging),
   vault notes in `D:\DrMaher\03 - SkinScan AI\` (Architecture, Known
   Issues, Testing, Change Log, Work Queue).
   Also for the two acceptance changes above: tests for `checkLandmarks`
   (trimmed outline accepted, missing eye or mouth rejected) and the
   `outsidePhoto` limit; `docs/SCORING.md` rejection table (head angle,
   face cropped); an evaluation variant for a 5% and a 10% trim.
5. **Known, not fixed**: pigmentation is noisy near zero (one portrait
   ranges 9–35 across harmless edits) and under heavy JPEG compression;
   redness reads "pronounced" on two ordinary portraits (provisional
   anchors); every accepted reference photo is a broad smile (WQ-18);
   scans take 2–8 s on this machine.
6. **"Too bright" is strict for bright, warm phone photos, on purpose.**
   Copies of the accepted portraits made about a third of a stop brighter,
   or tinted warm, are rejected 7 times out of 9, because more than 15% of
   the skin then has a maxed-out red channel. Counting only fully white
   pixels as blown out was tried and reverted: the red-clipped pixels pull
   the redness baseline down and redness rose by up to 19 points. A real
   fix needs highlight recovery or a white-balance step, plus real phone
   photos to test on. Also untested for lack of photos: hijab, beards,
   fringes, heavy make-up. HEIC files only open in Safari (the upload
   message already says so).
7. `warpRgb` takes at most 4×4 samples per output pixel, so the face
   detector input (128 px from up to 2560 px) is slightly aliased. No
   failure was traced to it.
