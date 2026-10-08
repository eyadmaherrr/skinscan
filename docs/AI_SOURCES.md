# AI sources, models and licences

Every model, library and published method used by SkinScan by Dr Maher,
with its source, licence and the reason it was chosen. Licence checks were made
against the official model cards and package metadata (October 2026). This
is an engineering summary, not legal advice — have the clinic's counsel
confirm before commercial launch.

## Dr Maher Vision AI v2.0 — what it consists of

"Dr Maher Vision AI v2.0" is the name of SkinScan's analysis engine. It is
made of:

1. the three open-source MediaPipe models below (unchanged weights, Apache
   2.0) for face detection, facial landmarks and hair/skin/accessory
   segmentation, and
2. the clinic's own code in `lib/skin-analysis/`: the image-quality gate,
   region geometry, exposure normalisation and the colorimetric / texture
   measurements described in docs/SCORING.md.

No part of it was trained on patient photos or on any restricted dataset.

## Machine-learning models (all run on our own server)

All three models are official Google MediaPipe releases, downloaded from
Google's own model storage, verified against pinned SHA-256 checksums and
converted to ONNX by `scripts/convert/convert_models.py` (our own converter —
see "Conversion" below). Checksums of both the originals and the converted
files are recorded in `models/manifest.json`; the server refuses to load a
model whose checksum does not match.

### 1. MediaPipe BlazeFace (short range) — face detection

| | |
|---|---|
| Source | `face_detector.tflite` inside the official `face_landmarker.task` bundle: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task |
| Model card | https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf |
| Paper | Bazarevsky et al., *BlazeFace: Sub-millisecond Neural Face Detection on Mobile GPUs*, CVPR Workshops 2019 (arXiv:2006.10204) |
| Licence | **Apache License 2.0** (stated on the model card) |
| Used for | Finding faces; rejecting photos with no face or several faces; initial face position for the landmark model |
| Why | Designed for selfie-distance smartphone photos (our exact use case); trained on consented images; published fairness evaluation |
| Fairness (model card) | Recall 94.7–100% across 5 skin-tone groups (avg 98.1%); precision 98.6–100% |
| Limitations | Only detects faces that are relatively large in the frame (≥ ~20% of the image side); not for faces turned > 45° or further than ~2 m |
| Commercial use | Yes (Apache 2.0, attribution + licence notice) |

### 2. MediaPipe Face Mesh V2 — 478 facial landmarks

| | |
|---|---|
| Source | `face_landmarks_detector.tflite` inside the same official `face_landmarker.task` bundle |
| Model card | https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf |
| Licence | **Apache License 2.0** (stated on the model card) |
| Used for | Locating the eyes, brows, lips, nose, face outline and irises; defining the analysed regions (forehead, nose, cheeks, chin, under-eyes); head pose; aligning the face; physical scale (inter-ocular distance) |
| Why | Dense, stable landmarks; runs fast on CPU; trained on consented smartphone selfies; published fairness evaluation |
| Fairness (model card) | Landmark error 2.49–2.90% of inter-ocular distance across 6 Fitzpatrick types (tracking mode), within the human-annotator discrepancy of 2.56% ± spread; 17 world regions evaluated |
| Limitations | Not suitable for faces turned > 80°, tilted > 8° in its input (we rotate the crop first), or less than 50% visible |
| Commercial use | Yes (Apache 2.0) |

### 3. MediaPipe Selfie Multiclass Segmentation (256×256) — hair / skin / accessory segmentation

| | |
|---|---|
| Source | https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite |
| Model card | https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf |
| Licence | **Apache License 2.0** (stated on the model card) |
| Classes | background, hair, body skin, face skin, clothes, others (accessories) |
| Used for | Excluding hair, glasses/accessories, background and clothing from the analysed skin; glasses / sunglasses / occlusion checks |
| Fairness (model card) | Mean IoU 77.2% overall; **68.3% for Monk skin tones 9–10** (vs 73.5–79.2% for tones 1–8) |
| How we compensate | Because the mask is less accurate for the darkest skin tones, the segmenter is used **only to veto** pixels it is confident are hair / accessory / background / clothing. Skin regions themselves come from the landmarks, so segmentation errors on darker skin cannot shrink or shift the analysed area. |
| Commercial use | Yes (Apache 2.0) |

### Conversion (TFLite → ONNX)

`scripts/convert/tflite_to_onnx.py` is a small converter written for this
project (numpy + onnx + the `tflite` flatbuffer schema; no TensorFlow). It
supports only the operators these three models use and fails loudly on
anything else. The converted models were validated by running them on real
portraits and checking detections, landmark overlays and segmentation masks
(`scripts/debug-overlay.ts`). Converter dependencies:

| Package | Licence |
|---|---|
| numpy 1.26 | BSD-3-Clause |
| onnx 1.16 | Apache-2.0 |
| tflite 2.18 (schema bindings) | Apache-2.0 |
| flatbuffers 24.3 | Apache-2.0 |

## Runtime libraries

| Library | Version | Licence | Use |
|---|---|---|---|
| onnxruntime-node (Microsoft) | 1.24.3 | MIT | Runs the three ONNX models on the server CPU |
| sharp / libvips | 0.35.5 | Apache-2.0 (sharp), LGPL-3.0 (libvips, dynamically linked prebuilt binary) | Safe image decoding, EXIF orientation, colour-profile conversion, resizing |
| Next.js / React | 16.3 / 19.3 | MIT | Web application |
| lucide-react | 1.53 | ISC | Icons |

## Published methods implemented in our own code

| Method | Reference | Used for |
|---|---|---|
| CIELAB colorimetry (a* as erythema correlate, L*/b* for pigmentation) | Standard skin colorimetry; e.g. Clarys et al., *Skin color measurements: comparison between three instruments*, Skin Res Technol 2000 | Redness and pigmentation measurements |
| Individual Typology Angle (ITA°) | Chardon, Cretois & Hourseau, *Skin colour typology and suntanning pathways*, Int J Cosmet Sci 1991; groups per Del Bino et al. 2006 | **Evaluation only** — slicing results by skin tone; never used for scoring |
| Shading-invariant chromaticity ratio | Multiplicative shading scales (L*+16, a*, b*) uniformly; cf. intrinsic-image / log-chromaticity literature and Tsumura et al., *Image-based skin color and texture analysis/synthesis by extracting hemoglobin and melanin information*, SIGGRAPH 2003 | Separating pigment/redness from lighting |
| Fast noise variance estimation | Immerkær, *Fast Noise Variance Estimation*, CVIU 1996 | Removing camera-noise contribution from texture measurements; SNR check |
| No-reference blur metric (re-blur) | Crété-Roffet et al., *The blur effect: perception and estimation with a new no-reference perceptual blur metric*, SPIE 2007 | Blurry-photo rejection |
| Difference-of-Gaussians blob detection | Lindeberg, *Feature detection with automatic scale selection*, IJCV 1998 | Spot / blemish detection |
| Box-filter Gaussian approximation | Kovesi / Wells, standard 3-pass box blur | Fast large-scale smoothing |

## Evaluated and NOT used

| Candidate | Reason |
|---|---|
| Paid skin-analysis APIs (Perfect Corp, Skinive, etc.) | Proprietary; excluded by requirement; images would leave our infrastructure |
| face-parsing.PyTorch / BiSeNet face parsing | Code is MIT, but weights are trained on **CelebAMask-HQ**, which is licensed for non-commercial research only (including derived data) |
| InsightFace landmark / parsing models | Pretrained weights are non-commercial |
| YOLOv8/YOLO11 acne detectors (Ultralytics) | **AGPL-3.0** (network use triggers source disclosure) or a paid Ultralytics licence; most public acne weights are trained on datasets without a clear commercial licence (e.g. ACNE04, assorted Roboflow sets) and none had published validation across skin tones |
| An acne CNN for "acne severity" | Would be a medical grading; out of scope for a non-diagnostic tool |
| **ACNE04** (Wu et al., ICCV 2019; Hugging Face `Layered-Labs/ACNE04`) | Considered for training/testing the blemish measurement (1,457 images, severity labels, 18,983 lesion boxes). Its card states *"academic/research use only"*, *"commercial use is not permitted"* and *"not intended for clinical deployment"*; other uses require permission from the original author (Xiaoping Wu, xpwu95/LDL). Not used. Can be used once written permission for commercial use is obtained. Note also that its images come from a single population, so results would need checking across skin tones. |
| LLM / vision-language "skin analysis" | Not reproducible or explainable; would be pretending a model analysed the skin |
| Pore-visibility metric (our own, DoG blob density) | Implemented and **removed**: scores changed by up to 17 points with mild camera noise and ±15 with JPEG compression or rotation (see docs/TESTING.md). Reliable pore measurement needs close-up / macro imaging. |
| "Hydration / dryness" from colour | No valid visual correlate in a normal photo; would be invented |

## Attribution notice

This product includes MediaPipe models by Google LLC, licensed under the
Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
The models were converted from TFLite to ONNX format; no weights were
modified.
