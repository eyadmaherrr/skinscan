# Dr Maher Vision AI v3.0 — Architectural Specification & Migration Plan

## 1. Executive Summary

This document specifies the architecture and implementation of **Dr Maher Vision AI v3.0** for SkinScan by Dr Maher Mahmoud Clinics.

The v3.0 engine transforms the system from a coarse 6-area heuristic scanner into a **region-by-region, anatomically guided facial image analysis engine**. Every facial region is analyzed independently using its own anatomical boundaries, quality metrics, feature algorithms, and confidence calculations.

---

## 2. Pipeline Stages

The v3.0 pipeline executes in 13 clearly delineated, versioned stages:

```
1. IMAGE INGESTION
   └─ Format sniffing, magic bytes, sharp decode, EXIF orientation correction.

2. IMAGE VALIDATION & NORMALIZATION
   └─ sRGB profile normalization, max side 2560 px, pixel integrity checks.

3. FACE DETECTION
   └─ BlazeFace ONNX, zero-padded letterbox warp, bounding-box clamping, single-face validation.

4. LANDMARK DETECTION
   └─ MediaPipe Face Mesh V2 (478 3D points), two-pass refinement, pose estimation.

5. FACE ALIGNMENT & GEOMETRY VALIDATION
   └─ Eye leveling, canonical crop (≤ 420 px IOD), physical scale (px/mm from 63 mm mean IOD),
      reversible affine transforms (cropToSource, sourceToCrop).

6. FACIAL PARSING & SKIN SEGMENTATION
   └─ Selfie Multiclass ONNX, parsing face skin, body skin, hair, accessories, clothes, background.
      Identification of specular saturation and deep shadow veto masks.

7. ANATOMICAL REGION GENERATION (24 Regions)
   └─ Disjoint polygon construction from landmarks, segmentation veto, coverage calculations.

8. REGION-SPECIFIC QUALITY ASSESSMENT
   └─ Local sharpness, exposure (clipped/crushed), SNR, occlusion, lighting balance per region.

9. REGION-SPECIFIC FEATURE EXTRACTION
   └─ Independent calculation of Pigmentation, Redness, Blemishes, Texture, Shine, Under-eye, Pores.

10. MEASUREMENT VALIDATION & CONFIDENCE
    └─ States: 'measured' | 'low_quality' | 'unavailable' | 'not_supported' | 'processing_error'.
       Confidence derived strictly from verified local quality and signal reliability.

11. RESULT AGGREGATION
    └─ Transparent, weighted rollup of regional feature measurements into core metrics.

12. HEATMAPS & EXPLAINABLE RESULTS
    └─ Continuous calibrated 0–100 response heatmaps projected to original image coordinates.

13. REPORT GENERATION
    └─ Bilingual (EN/AR) patient summaries, non-diagnostic phrasing, explicit limitations.
```

---

## 3. The 24 Anatomical Facial Regions

Rather than treating the face as a single canvas or using arbitrary fixed percentages, v3.0 defines 24 anatomical subregions:

| Group | Anatomical Region Key | Anatomical Name (EN) | Anatomical Name (AR) | Primary Landmarks / Boundaries |
|---|---|---|---|---|
| **Forehead** | `foreheadCenter` | Central Forehead | منتصف الجبهة | Forehead arc to glabella, bounded by inner brow verticals |
| | `foreheadLeft` | Left Forehead | الجبهة اليسرى | Between left hairline and left inner brow |
| | `foreheadRight` | Right Forehead | الجبهة اليمنى | Between right hairline and right inner brow |
| **Temples** | `templeLeft` | Left Temple | الصدغ الأيسر | Outer left brow to zygomatic hairline contour |
| | `templeRight` | Right Temple | الصدغ الأيمن | Outer right brow to zygomatic hairline contour |
| **Glabella** | `glabella` | Glabella | ما بين الحاجبين | Inter-eyebrow area above nasion |
| **Periocular** | `upperEyeLeft` | Left Upper Eyelid Skin | جفن العين الأيسر العلوي | Between left upper lid and left eyebrow lower margin |
| | `upperEyeRight` | Right Upper Eyelid Skin | جفن العين الأيمن العلوي | Between right upper lid and right eyebrow lower margin |
| | `underEyeLeft` | Left Under-Eye | أسفل العين اليسرى | Lower eyelid margin down to infraorbital tear trough |
| | `underEyeRight` | Right Under-Eye | أسفل العين اليمنى | Lower eyelid margin down to infraorbital tear trough |
| **Nose** | `noseBridge` | Nose Bridge | جسر الأنف | Nasal dorsum from nasion to supratip |
| | `noseTip` | Nose Tip | أرنبة الأنف | Nasal tip lobule and infratip lobule |
| | `nasalSidewallLeft` | Left Nasal Sidewall | جانب الأنف الأيسر | Lateral slope between bridge and left cheek |
| | `nasalSidewallRight` | Right Nasal Sidewall | جانب الأنف الأيمن | Lateral slope between bridge and right cheek |
| | `alarSkinLeft` | Left Alar Skin | جناح الأنف الأيسر | Left nasal ala, excluding nostril opening |
| | `alarSkinRight` | Right Alar Skin | جناح الأنف الأيمن | Right nasal ala, excluding nostril opening |
| **Cheeks** | `cheekLeft` | Left Cheek | الخد الأيسر | Malar eminence, lateral cheek, medial to nasolabial line |
| | `cheekRight` | Right Cheek | الخد الأيمن | Malar eminence, lateral cheek, medial to nasolabial line |
| **Perioral** | `perioralUpper` | Upper Perioral / Philtrum | أعلى الشفة العليا | Subnasale down to upper vermilion border |
| | `perioralLower` | Lower Perioral Skin | أسفل الشفة السفلى | Lower vermilion border to labiomental crease |
| | `perioralLeft` | Left Perioral Skin | محيط الفم الأيسر | Left commissure and lateral oral commissure area |
| | `perioralRight` | Right Perioral Skin | محيط الفم الأيمن | Right commissure and lateral oral commissure area |
| **Chin** | `chinCenter` | Central Chin (Mental Prominence) | منتصف الذقن | Mental protuberance below labiomental crease |
| | `chinLeft` | Left Chin | الجانب الأيسر للذقن | Lateral mental tubercle left |
| | `chinRight` | Right Chin | الجانب الأيمن للذقن | Lateral mental tubercle right |
| **Jawline** | `jawlineLeft` | Left Jawline | خط الفك الأيسر | Mandibular border from angle to mental foramen |
| | `jawlineRight` | Right Jawline | خط الفك الأيمن | Mandibular border from angle to mental foramen |

---

## 4. Coordinate System & Invertible Transformations

To prevent coordinate drift across preprocessing, inference, and rendering, all spatial operations reference an explicit coordinate tree:

```
Source Photo (W_src × H_src)
   ▲                    │
   │ cropToSource       │ sourceToCrop
   │ (Affine)           ▼
Aligned Face Crop (W_crop × H_crop) [Eyes level, IOD ≤ 420 px]
   │
   ├─ Normalized Crop Space (0..1, 0..1)
   └─ Normalized Photo Space (xs / W_src, ys / H_src) [Used for client SVG & PDF]
```

Every transformation is strictly typed and reversible.

---

## 5. Output Contract & Backward Compatibility

The API response contract `ScanSuccess` maintains full backward compatibility for existing client consumers (`analysis`, `regions`, `acne`, `pores`, `skinAge`, `heatmaps`, `imageQuality`, `overallConfidence`), while attaching the complete v3 structured analysis:

```typescript
export interface ScanSuccess {
  success: true;
  scanId: string;
  createdAt: string;
  engine: "Dr Maher Vision AI v3.0";
  methodologyVersion: "3.0.0";
  overallConfidence: number;
  imageQuality: { acceptable: true; notes: string[] };
  
  // Legacy / rollup fields:
  analysis: Record<MetricKey, MetricResult>;
  regions: RegionOutline[];
  acne?: AcneReport;
  pores?: PoreReport;
  skinAge?: SkinAgeReport;
  heatmaps?: Partial<Record<HeatmapKey, string>>;

  // New v3.0 Region-by-Feature Engine Data:
  regionsV3: Record<RegionKeyV3, RegionReportV3>;
  v3: DetailedV3PipelineResult;
}
```

---

## 6. Scientific & Medical Safeguards

1. **Non-diagnostic**: Features describe observable photometric phenomena (e.g., "visible redness", "tonal variation", "specular highlights"), never diagnostic pathologies (e.g., "erythema", "melasma", "seborrhea").
2. **Honest Unavailable States**: When a region lacks sufficient resolution, is occluded, or exhibits severe lighting artifacts, its measurement state is explicitly set to `unavailable` with a documented reason code, rather than defaulting to 0 or interpolating fabricated values.
3. **Local References**: Pigmentation and redness are evaluated against each patient's own unaffected adjacent skin to prevent systematic demographic bias across Fitzpatrick and Monk skin tones.
