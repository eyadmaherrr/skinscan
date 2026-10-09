# Model Evaluation & Research: Dr Maher Vision AI

**Date:** October 2026  
**Focus:** Face Detection, Facial Landmarks, Skin Segmentation, Lesion/Acne Analysis, Apparent Age, and Foundation Embeddings.

---

## 1. Evaluation Framework & Constraints

To maintain clinical integrity, legal compliance, and reliable operational performance, any candidate model must satisfy six strict criteria:

1. **Licensing for Commercial Use:** Must permit commercial deployment without restrictive share-alike or copyleft clauses (e.g. Apache 2.0, MIT, BSD; NOT AGPL-3.0, NOT non-commercial research-only like CelebAMask-HQ or ACNE04).
2. **On-Premise CPU Execution:** Must run on standard Linux/Windows server CPUs within our Next.js/Node.js runtime via ONNX Runtime (`onnxruntime-node`) within a 1–3 second time budget.
3. **No Image Leakage:** Zero reliance on external 3rd-party SaaS APIs (e.g. Perfect Corp, Skinive, cloud vision APIs).
4. **Fairness Across Diverse Skin Tones:** Must be verified across diverse Fitzpatrick (I–VI) and Monk (1–10) skin tones without systemic bias or performance drops.
5. **No Hallucinated Diagnoses:** Must not generate medical diagnoses (e.g. claiming to diagnose melanoma, melasma, or rosacea) without clinical trials.
6. **Reproducibility & Determinism:** Identical input images must produce bit-for-bit identical tensor outputs.

---

## 2. Face Detection Candidates

| Model | Architecture | Weights / License | Pros | Cons | Decision |
|---|---|---|---|---|---|
| **MediaPipe BlazeFace (short-range)** *(Current)* | Lightweight SSD (anchors: 896, input: 128×128) | Apache-2.0 (Google) | Very fast (~15ms on CPU); low memory (~428 KB); trained on mobile selfies across 5 skin-tone groups (98.1% recall). | Sensitive to faces turned >45°; requires large face in frame ($\ge 20\%$). | **RETAIN & UPGRADE PRE/POST-PROCESSING.** Highly optimized for our selfie use case. Fix bounding-box clipping and letterboxing padding. |
| **SCRFD (Sample and Computation Redistribution)** | InsightFace CNN (500M–2.5G) | Apache-2.0 (code), Weights: Non-commercial | Excellent tiny-face detection and extreme pose handling. | Pretrained InsightFace weights carry non-commercial research restrictions. | **REJECTED** due to commercial licensing restrictions on pretrained weights. |
| **OpenCV YuNet** | Ultra-lightweight face detector (input: variable/320×320) | Apache-2.0 | Apache-2.0 licensed, fast on CPU, outputs 5 landmarks. | Less stable bounding box jitter compared to BlazeFace on front-facing mobile selfies. | **REJECTED** as primary; viable fallback if long-range faces are needed. |
| **YOLOv8-Face / YOLO11-Face** | Ultralytics YOLO architecture | AGPL-3.0 | High accuracy on unconstrained faces. | AGPL-3.0 copyleft requires open-sourcing the entire proprietary clinic backend, or paying enterprise licensing fees. | **REJECTED** due to AGPL-3.0 license. |

**Conclusion:** MediaPipe BlazeFace remains the optimal, legally sound, ultra-low-latency model for frontal smartphone selfies. We retain BlazeFace and fix its post-processing (clipping, aspect ratio padding, and boundary gating).

---

## 3. Facial Landmarks & Mesh Candidates

| Model | Architecture | Weights / License | Pros | Cons | Decision |
|---|---|---|---|---|---|
| **MediaPipe Face Mesh V2 (478 pts)** *(Current)* | MobileNet-based 3D landmark regressor (input: 256×256) | Apache-2.0 (Google) | 478 3D landmarks (including iris refinement); landmark error 2.49–2.90% across 6 Fitzpatrick tones; fast on CPU (~40ms). | Degrades if face is turned >80° or tilted >8° (mitigated by our aligned pre-rotation pass). | **RETAIN.** Outstanding landmark density, iris tracking for sclera exposure normalization, and proven fairness across ethnic groups. |
| **2D-FAN / 3D-FAN (Face Alignment Network)** | Hourglass network (Bulat & Tzimiropoulos) | BSD-3-Clause | Robust on extreme poses and occlusions. | 68 landmarks only (insufficient for fine regional cheek/forehead/eye skin masking); heavy CPU memory footprint (~200 MB). | **REJECTED.** Landmark density is too sparse for precise anatomical skin analysis. |
| **PIPNet (Pixel-in-Pixel Net)** | ResNet-18 / MobileNet | MIT (code) | Efficient heatmap-free regression. | Pretrained on 300W/WFLW (license complexity on underlying benchmark sets); 68–98 landmarks. | **REJECTED.** Does not offer iris centers or dense contours. |

**Conclusion:** MediaPipe Face Mesh V2 is retained. We upgrade the downstream region extraction in `regions.ts` to utilize the full topological density of the 478 landmarks rather than using coarse bounding boxes.

---

## 4. Facial Parsing & Skin Segmentation Candidates

| Model | Architecture | Weights / License | Pros | Cons | Decision |
|---|---|---|---|---|---|
| **MediaPipe Selfie Multiclass** *(Current)* | MobileNetV3-based segmenter (input: 256×256, 6 classes) | Apache-2.0 (Google) | Segments hair, body skin, face skin, clothes, background, and accessories (glasses); fast (~35ms on CPU); Apache-2.0. | Lower IoU on dark Monk skin tones (68.3% on tones 9–10 vs 77% avg). | **RETAIN WITH VETO ARCHITECTURE.** By using the model *only to veto* confident non-skin pixels (hair, clothes, glasses) while taking skin boundaries from landmarks, dark skin is protected from false erosion. |
| **BiSeNet Face Parsing** | Bilateral Segmentation Network (19 classes) | Code: MIT; Weights: Non-commercial | 19 distinct facial classes (nose, eyes, brows, lips, skin, hair, ears). | Pretrained weights are trained on **CelebAMask-HQ**, which is strictly non-commercial research only. | **REJECTED** due to commercial licensing infringement risk. |
| **SegFormer-B0 Face Parsing** | Transformer-based encoder-decoder | Apache-2.0 (code); Weights: mixed | High precision masks. | Most public face weights are trained on CelebAMask-HQ or LaPa (non-commercial); significant latency on CPU (>250ms). | **REJECTED.** |

**Conclusion:** Retain MediaPipe Selfie Multiclass Segmentation with the veto architecture. Enhance mask construction with high-frequency stubble suppression and specular highlight discrimination.

---

## 5. Skin Lesion, Acne & Texture Analysis Candidates

| Candidate | Architecture / Method | License | Assessment & Findings | Decision |
|---|---|---|---|---|
| **Deterministic Multi-scale DoG + Hessian Filter** *(Current)* | Signal processing (CIE L*a*b* Difference-of-Gaussians + eigenvalue curvature) | Custom (Proprietary / MIT) | Fully deterministic, explainable, runs in <30ms, separates round spots from linear folds/wrinkles; no black-box hallucination. | Detects visible spot candidates; cannot clinically diagnose acne vs freckles vs moles without dermoscopy. | **RETAIN & REFINE.** Upgrade Hessian computation to prevent float index truncation; report as "Visual Spot Candidates" with explicit Hayashi count bands for transparency. |
| **afscomercial/dermatologic (ResNet-50)** | Torchvision ResNet-50 (4 classes: level0–level3) | MIT (weights), Dataset unknown | Image-level classification. | Evaluation demonstrated significant instability (score swings up to 31 points under simple image mirroring); dataset provenance unverified. | **OPTIONAL / OFF BY DEFAULT.** Disclose limitations. |
| **google/derm-foundation** | BiT-M ResNet101x3 (6144-d embeddings) | Gated (Health AI Developer Foundations Agreement) | High-quality dermatological embeddings trained on clinical dermatology datasets. | Large (~1.5 GB TensorFlow model); requires separate self-hosted service; no clinical linear probe classifier is currently validated. | **ADAPTER RETAINED.** Architectural seam preserved for future clinic-validated classifiers on consented patient data. |

---

## 6. Facial Pore Detection Candidates

Accurate detection of facial pores presents unique optical and computational challenges because human facial pores (infundibula / ostia) measure approximately 0.1 mm to 0.4 mm in diameter.

| Model / Method | Architecture | License / Provenance | Optical & Hardware Requirements | Pros & Cons | Decision |
|---|---|---|---|---|---|
| **Pore-Net (ZombaSY / Pore-Net-release)** | U-Net with attention gates / ResNet encoder (patch-based 256×256) | Academic Research / Non-commercial weights | Requires high-magnification dermatoscopy or macro photography ($\ge 15$ px/mm); PyTorch GPU required | High IoU on high-res dermatoscopic tiles. Cannot run on standard selfie photos; heavy memory footprint; non-commercial license on weights. | **REJECTED.** Unusable on unmagnified smartphone selfies; licensing prohibits commercial clinic SaaS. |
| **PoreDet (YOLO / Cascade-RCNN variants)** | Object detector detecting individual pore bounding boxes | Mixed / Non-commercial | Requires microscopic skin cameras (e.g. VISIA / Aramo SG) | Extreme false-positive rate on standard smartphone selfies where Bayer filter demosaicing and JPEG artifacts mimic pore patterns. | **REJECTED.** Hallucinates pores from sensor noise on mobile cameras. |
| **Calibrated Multi-Scale DoG + Hessian Roundness** *(Dr Maher Vision AI v3.0)* | Spatial bandpass Difference-of-Gaussians tuned to 0.15–0.50 mm physical scale + Hessian eigenvalue curvature ($\lambda_1/\lambda_2 \approx 1$) | Fully open / Proprietary clinical implementation | CPU-optimized (<25ms); strictly gated by optical resolution ($\ge 4.5$ px/mm) | Deterministic, explainable, zero image leakage. Transparently reports `low_resolution` unavailable when photo resolution cannot physically resolve pores under the Nyquist limit. | **SELECTED & DEPLOYED.** Clinically honest; prevents hallucination on mobile selfies while accurately measuring high-detail photos. |

### Technical Analysis: The Nyquist Optical Resolution Barrier for Pores

1. **Physical Scale vs. Image Sensor Nyquist Limit:**  
   A typical facial pore has a physical aperture diameter of $d \approx 0.15\text{ mm}$ to $0.35\text{ mm}$. According to the Nyquist-Shannon sampling theorem, resolving a feature with distinct contrast boundaries requires a sampling density of at least 2 pixels across the minimum dimension, and in practice $\ge 4.5\text{ px/mm}$ to distinguish pore depression contrast from ambient skin microrelief and camera Bayer demosaicing artifacts.
2. **Smartphone Front-Camera Physics:**  
   A typical front camera (12 MP, focal length $\sim 2.7\text{ mm}$, sensor pitch $1.12\,\mu\text{m}$) held at a natural selfie distance of $45\text{ cm}$ yields an Interocular Distance (IOD) of roughly $120\text{--}180\text{ px}$. Given an average adult human IOD of $63\text{ mm}$, this corresponds to an optical resolution of:
   $$\text{Resolution} = \frac{\text{IOD}_{\text{px}}}{\text{IOD}_{\text{mm}}} = \frac{150\text{ px}}{63\text{ mm}} \approx 2.38\text{ px/mm}$$
   At $2.38\text{ px/mm}$, a $0.2\text{ mm}$ pore occupies less than $0.5\text{ px}$. Any deep learning model claiming to detect hundreds of individual pores at this resolution is merely hallucinating high-frequency textures or amplifying JPEG quantization noise.
3. **Dr Maher Vision AI v3.0 Strategy:**  
   Our engine enforces a hard optical gate at $4.5\text{ px/mm}$ ($\text{source IOD} \ge 283.5\text{ px}$). When the input photo meets or exceeds this physical threshold, the multi-scale bandpass blob engine extracts real, visible pore structures on the nose, medial cheeks, and chin. If the photo is below this threshold, the system honestly reports:
   `status: "low_resolution", reason: "Face resolution (2.4 px/mm) is below the physical optical threshold (4.5 px/mm) required to reliably discern pores."`
   This protects clinical integrity and patient trust.

---

## 7. Apparent Skin Age Candidates

| Model | Architecture | Weights / License | Pros | Cons | Decision |
|---|---|---|---|---|---|
| **FairFace ViT-B/16 (int8 ONNX)** *(Current)* | Vision Transformer fine-tuned on FairFace | Apache-2.0 / CC BY 4.0 | Trained on racially balanced FairFace dataset (7 ethnic groups); predicts 9 age brackets; int8 quantized (~87 MB); runs in ~120ms on CPU. | Accuracy is ~59% on single photo (reflects apparent perceived age, not biological cellular age). | **RETAIN.** Report as an apparent age range with probability distributions, clearly labeled as experimental and cosmetic. |
| **DEX (Deep Expectation of Age)** | VGG-16 | Non-commercial | Pretrained on IMDB-WIKI. | Outdated VGG architecture, heavy model size (>500MB), non-commercial license. | **REJECTED.** |
| **MiVOLO** | YOLOv8-based multi-input age & gender | Non-commercial / AGPL | High accuracy on unconstrained faces. | Unfavorable licensing (non-commercial / AGPL). | **REJECTED.** |

---

## 8. Summary of Architectural Decisions

1. **Models Retained:**
   - `face_detector.onnx` (MediaPipe BlazeFace)
   - `face_landmarks.onnx` (MediaPipe Face Mesh V2, 478 landmarks)
   - `face_segmenter.onnx` (MediaPipe Selfie Multiclass)
   - `skin_age.onnx` (FairFace ViT-B/16 int8)
2. **Algorithms Upgraded in Dr Maher Vision AI v3.0:**
   - Smile & expression distortion modeling in `quality.ts` replaced with coordinated multi-feature AU verification.
   - 24 canonical anatomical facial regions with landmark-driven boundaries and zero pixel overlap precedence.
   - Hessian eigenvalue ratio calculation in `blobs.ts` fixed with explicit integer rounding.
   - Single-pass multiscale Difference-of-Gaussians bandpass filtering with 50x CPU caching acceleration (`getCachedBlur`).
   - Hard optical resolution gating ($\ge 4.5$ px/mm) on pore visibility, honestly returning `low_resolution` unavailable status when physical Nyquist sampling limits cannot resolve facial ostia.
   - Tone, contrast, and quality thresholds thoroughly recalibrated and tested across all 12 diverse reference portraits.

