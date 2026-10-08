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

## Extension candidates (acne, pores, Derm Foundation) — October 2026

Each candidate was checked for code licence, weight licence, training-data
licence, format and runtime fit before use.

| Candidate | What it is | Licence findings | Decision |
|---|---|---|---|
| [afscomercial/dermatologic](https://huggingface.co/afscomercial/dermatologic) | torchvision ResNet-50, whole-image acne severity, 4 classes `level0`–`level3`, 224×224, ImageNet normalisation; self-reported val. accuracy 0.85; "intended for educational purposes" | Weights tagged MIT. **Training dataset not named**; the four labels match ACNE04's grading (ACNE04: academic use only, no commercial use). Provenance unresolved. | **Integrated as an optional, disabled-by-default component** (`SKINSCAN_ACNE_SEVERITY_MODEL`). Converted with our own safe loader (`scripts/convert/safe_torch_load.py` — never executes the pickle) and `convert_acne_classifier.py`; weights are **not committed** (`models/optional/`, git-ignored). Do not enable commercially until the author confirms the data licence. Evaluation below shows it labels clear studio portraits as mild/moderate acne, i.e. it is not reliable on SkinScan photos. |
| [will702/acne-cv-models](https://huggingface.co/will702/acne-cv-models) | 21 scikit-learn/CatBoost classifiers on 42 hand-crafted features (Haar faces, LBP, GLCM, redness), 3 grades | Tagged MIT, but **trained on ACNE04** (academic use only). Weights are Python pickles (loading executes code) and need scikit-learn 1.7.2 exactly; the feature pipeline (Haar cascades, CLAHE) would have to be re-implemented bit-for-bit. | **Not integrated** (licence + security + runtime). Its published per-class F1 (moderate 0.46, severe 0.55) is also weak. |
| [Merligus/acne-detection](https://github.com/Merligus/acne-detection) | YOLO26 lesion detector, SegFormer-B1 segmentation, DINOv3 multi-task severity/count | **No licence file** (all rights reserved). Weights on Google Drive, trained on ACNE04. YOLO (Ultralytics) is AGPL-3.0; SegFormer weights use NVIDIA's non-commercial licence; DINOv3 has its own licence. | **Not integrated.** A licensed lesion detector would need commercially usable annotated data (e.g. the clinic's own, consented and labelled photos). |
| [DurtyDhiana/skin-scan](https://github.com/DurtyDhiana/skin-scan) | Python/OpenCV/MediaPipe; pores = DoG high-pass + Otsu threshold + 4–80 px blobs, normalised by the per-image maximum | **MIT** (code); no weights. | **Idea reused** (high-pass + blob detection + density heatmap), re-implemented in TypeScript with physical scale and absolute, noise-adaptive thresholds. Its per-image max normalisation was *not* adopted: it always "finds" pores and makes scores incomparable between photos. |
| [google/derm-foundation](https://huggingface.co/google/derm-foundation) | BiT-M ResNet101x3 (TensorFlow SavedModel), 448×448 input, 6144-d embeddings; no predictions on its own | **Gated** — requires accepting the Health AI Developer Foundations terms with a Hugging Face account. Terms: use only per the agreement; pass the §3.2 use restrictions on to users; include a HAI-DEF notice; seek regulatory authorisation where applicable; no use that could make Google a medical-device manufacturer. | **Adapter integrated** (`lib/skin-analysis/extensions/derm-foundation.ts`, off by default) plus a self-hosted reference service (`services/derm-foundation/`). **Not executed:** access to the gated weights was not granted, the ≈1.5 GB TensorFlow model cannot run inside the Node/Vercel runtime, and there is no commercially usable labelled acne/pore data to train or validate a downstream classifier on its embeddings. No result currently uses it. |
| [SkinCAP](https://huggingface.co/datasets/joshuachou/SkinCAP) | 4,000 images (Fitzpatrick17k, DDI) with dermatologist captions | **CC BY-NC-SA 4.0** plus a KAUST research-use agreement (non-commercial, no derivatives, no clinical use). No acne-severity, lesion-box or pore labels. | **Not used** — non-commercial, and its captions do not support the tasks. |
| ACNE04 (Layered-Labs/ACNE04, xpwu95/LDL) | 1,457 images, severity + 18,983 lesion boxes | Academic/research use only; commercial use not permitted. | **Not used.** |

**What would unblock a validated acne model:** a dataset the clinic may use
commercially — ideally the clinic's own consented photos with dermatologist
severity grades and lesion boxes across skin tones — or written commercial
permission from the ACNE04 authors. With such data, a linear classifier on
Derm Foundation embeddings (Google's recommended use) or a small detector
could be trained and compared against the current heuristics on a held-out
test set.

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
| Pore-visibility metric v1 (our own, DoG blob density, in the core score list) | Removed from the core metrics in v2.0: scores changed by up to 17 points with mild camera noise. Re-introduced in v2.1 as a separate **experimental** section with a strict resolution/sharpness/noise gate, spot exclusion and noise-adaptive thresholds (see docs/SCORING.md). |
| "Hydration / dryness" from colour | No valid visual correlate in a normal photo; would be invented |

## Attribution notice

This product includes MediaPipe models by Google LLC, licensed under the
Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
The models were converted from TFLite to ONNX format; no weights were
modified.
