import type { Locale } from './i18n';
import type { MetricKey } from './skin-analysis/types';

export type ExplainingMetricKey =
  | MetricKey
  | 'overallConfidence'
  | 'pores'
  | 'skinType'
  | 'skinToneUniformity'
  | 'acne'
  | 'skinAge';

export interface MetricExplanation {
  key: ExplainingMetricKey;
  title: string;
  tag: string;
  whatItMeasures: string;
  howItIsCalculated: string;
  calculationSteps: string[];
  scaleMeaning: {
    title: string;
    description: string;
    minimal: string;
    mild: string;
    moderate: string;
    pronounced: string;
  };
  technicalSpecs: {
    regions: string;
    algorithm: string;
    normalization: string;
  };
  clinicalNote: string;
}

const EXPLANATIONS_EN: Record<ExplainingMetricKey, MetricExplanation> = {
  pigmentation: {
    key: 'pigmentation',
    title: 'Uneven Pigmentation',
    tag: 'Melanin & Tone Contrast',
    whatItMeasures:
      'Measures localized darkening, sunspots, freckles, and uneven pigment distribution standing out against your surrounding skin across the forehead, cheeks, and chin.',
    howItIsCalculated:
      'Each skin pixel (smoothed at 0.4 mm) is compared against its surrounding 8 mm neighborhood in CIELAB color space using the ratio ρ = C* / (L* + 16). This distinguishes genuine melanin pigmentation from lighting shadows. A Hessian eigenvalue filter discards thin creases, wrinkles, and folds. The raw measurement is the pigment-equivalent darkening ΔL* across the most affected 15% of skin, calibrated onto a 0–100 scale.',
    calculationSteps: [
      'Isolates forehead, cheeks, and chin while strictly excluding eyes, eyebrows, lips, and hair.',
      'Computes the local chroma-to-lightness ratio ρ = C* / (L* + 16) relative to surrounding tissue (8 mm Gaussian kernel).',
      'Filters out linear creases and natural skin folds using Hessian matrix eigenvalue ratios.',
      'Measures pigment-equivalent darkening ΔL* across the most affected 15% of skin.',
      'Interpolates linearly between calibration anchors (0, 0.8, 1.6, 2.6, 4.0 ΔL*) onto the 0–100 score.',
    ],
    scaleMeaning: {
      title: 'Score Scale (0–100)',
      description: 'Higher score indicates more visible localized pigment contrast in this photo.',
      minimal: '0–24 (Minimal): Exceptionally even tone with virtually no localized darkening.',
      mild: '25–49 (Mild): Subtle, faint sunspots or light natural freckling.',
      moderate: '50–74 (Moderate): Noticeable patches of hyperpigmentation or darker marks.',
      pronounced: '75–100 (Pronounced): Dense or prominent localized dark patches standing out distinctly.',
    },
    technicalSpecs: {
      regions: 'Forehead, Cheeks, Chin',
      algorithm: 'CIELAB Local Neighborhood Shading-Invariant Ratio + Hessian Filter',
      normalization: 'Measured relative to the person’s own surrounding skin (shading-invariant)',
    },
    clinicalNote:
      'Informational optical analysis from one photo. Not a medical diagnosis and does not differentiate between melasma, solar lentigines, or post-inflammatory marks.',
  },

  redness: {
    key: 'redness',
    title: 'Visible Redness',
    tag: 'Erythema & Vascular Tone',
    whatItMeasures:
      'Measures superficial vascular tone, capillary flushing, irritation, and visible redness standing out against your individual facial baseline.',
    howItIsCalculated:
      'Evaluates the colorimetric CIELAB a* coordinate (erythema correlate). To eliminate lighting gradients and shadow variations, it computes the shading-invariant ratio a* / (L* + 16). The 20th percentile over the face establishes your individual baseline. Excess redness above this baseline (minus a 2-unit tolerance ≈ 1 Just-Noticeable Difference) is averaged over the 20% most affected skin area.',
    calculationSteps: [
      'Analyzes skin across the forehead, nose, cheeks, and chin.',
      'Normalizes for shadow gradients using the shading-invariant ratio a* / (L* + 16).',
      'Determines your personal resting baseline color at the 20th percentile of facial skin.',
      'Calculates excess a* beyond baseline with a 2-unit tolerance (≈ 1 Just-Noticeable Difference).',
      'Averages excess redness across the top 20% most affected skin and maps anchors (0, 2.5, 5.5, 9, 14 a*) to 0–100.',
    ],
    scaleMeaning: {
      title: 'Score Scale (0–100)',
      description: 'Higher score indicates more visible vascular flushing or redness in this photo.',
      minimal: '0–24 (Minimal): Calm, balanced skin with no perceptible vascular flushing.',
      mild: '25–49 (Mild): Slight pinkness, delicate warmth, or localized faint redness.',
      moderate: '50–74 (Moderate): Noticeable vascular redness, flushing, or visible irritation.',
      pronounced: '75–100 (Pronounced): Distinct or widespread persistent erythema across multiple facial zones.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks, Chin',
      algorithm: 'CIELAB a* Ratio vs Individual Resting Baseline (Top 20% Area)',
      normalization: 'Invariant to shading and illumination intensity changes',
    },
    clinicalNote:
      'Informational appearance estimate. Not a clinical diagnosis of rosacea, contact dermatitis, or vascular lesions.',
  },

  texture: {
    key: 'texture',
    title: 'Skin Texture',
    tag: 'Micro-Relief & Roughness',
    whatItMeasures:
      'Measures micro-relief irregularity, fine surface roughness, cellular grain, and tactile bumps across the facial skin.',
    howItIsCalculated:
      'Applies a physical Difference-of-Gaussians (DoG) band-pass filter sensitive to 0.2–1.0 mm spatial wavelengths on log-luminance. The face is scaled to true physical millimeters using the inter-ocular distance (IOD = 63 mm). The camera sensor noise contribution (estimated via Immerkær high-pass noise filtering) is subtracted so low-light noise is not mistaken for skin roughness. Robust IQR amplitude contrast is calibrated onto 0–100.',
    calculationSteps: [
      'Scales the face to true physical millimeters using adult mean inter-ocular distance (IOD = 63 mm).',
      'Applies Difference-of-Gaussians bandpass filter tuned to 0.2–1.0 mm physical micro-relief.',
      'Estimates camera sensor noise via Immerkær high-pass operator and subtracts the noise contribution.',
      'Computes robust interquartile amplitude spread (IQR / 1.349) of log-luminance contrast.',
      'Calibrates raw contrast percentage (anchors: 0.5%, 2.2%, 3.6%, 5.2%, 7.5%) onto 0–100.',
    ],
    scaleMeaning: {
      title: 'Score Scale (0–100)',
      description: 'Higher score indicates more visible micro-relief irregularity or roughness in this photo.',
      minimal: '0–24 (Minimal): Exceptionally smooth, refined micro-relief.',
      mild: '25–49 (Mild): Natural healthy skin texture with delicate fine grain.',
      moderate: '50–74 (Moderate): Noticeable surface roughness, small tactile bumps, or enlarged grain.',
      pronounced: '75–100 (Pronounced): Significant surface roughness, coarseness, or prominent unevenness.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks, Chin',
      algorithm: 'Multi-Scale Difference of Gaussians (0.2–1.0 mm) on Log-Luminance',
      normalization: 'Sensor noise subtraction + physical millimetric facial scaling',
    },
    clinicalNote:
      'Measures visible optical micro-relief. Photographic focus, camera resolution, smoothing filters, and foundation makeup influence optical texture.',
  },

  blemishes: {
    key: 'blemishes',
    title: 'Visible Spots & Blemishes',
    tag: 'Focal Mark Detection',
    whatItMeasures:
      'Measures focal marks, darker spots, and red-toned blemishes that stand out distinctly against surrounding skin.',
    howItIsCalculated:
      'Multi-scale Difference-of-Gaussians blob detection (σ = 0.6, 1.0, 1.5 mm) on lightness L* (darker spots, ≥ 4 ΔL*) and erythema a* (redder spots, ≥ 3 Δa*), with non-maximum suppression. Each candidate must be surrounded by healthy skin. Spot counts are normalized per 10 cm² of facial skin and contrast-weighted onto a 0–100 score.',
    calculationSteps: [
      'Scans facial skin with multi-scale blob filters (σ = 0.6, 1.0, 1.5 mm).',
      'Identifies dark focal spots (≥ 4 ΔL*) and red focal spots (≥ 3 Δa*).',
      'Applies non-maximum suppression to eliminate overlapping duplicate detections.',
      'Normalizes spot count by physical skin area (contrast-weighted spots per 10 cm²).',
      'Calibrates density anchors (0, 0.6, 2.0, 4.5, 9.0 spots / 10 cm²) onto 0–100.',
    ],
    scaleMeaning: {
      title: 'Score Scale (0–100)',
      description: 'Higher score indicates a higher density or contrast of focal spots in this photo.',
      minimal: '0–24 (Minimal): Virtually spot-free skin with no noticeable focal marks.',
      mild: '25–49 (Mild): A few isolated faint spots, minor blemishes, or light marks.',
      moderate: '50–74 (Moderate): Multiple visible spots distributed across one or more regions.',
      pronounced: '75–100 (Pronounced): High density of prominent spots or active visible marks.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks, Chin',
      algorithm: 'Multi-Scale DoG Blob Detection + Non-Maximum Suppression',
      normalization: 'Scaled by physical skin surface area (spots per 10 cm²)',
    },
    clinicalNote:
      'Detects optical focal contrast. It cannot differentiate between active acne papules, comedones, benign nevi (moles), freckles, or post-acne pigmentation.',
  },

  shine: {
    key: 'shine',
    title: 'Surface Shine',
    tag: 'Specular Reflection & Oiliness',
    whatItMeasures:
      'Measures specular light reflection across the skin surface, indicating surface oiliness, sebum sheen, or cosmetic gloss.',
    howItIsCalculated:
      'Identifies specular highlight pixels that reflect direct light significantly brighter than surrounding diffuse skin (> 12% of scene illumination, estimated from the white sclera of the eyes to remain skin-tone neutral). Pixels must be desaturated or clipped to white. Weighted 60% T-zone (forehead and nose) and 40% cheeks, calibrated onto 0–100.',
    calculationSteps: [
      'Estimates ambient scene illumination from the eye sclera whites (tone-independent reference).',
      'Computes diffuse background skin reflectance excluding candidate highlights.',
      'Identifies highlight pixels exceeding diffuse baseline by > 12% of scene light with low chroma or white clipping.',
      'Computes specular area percentage for T-zone (forehead + nose) and cheeks.',
      'Weights regions (60% T-zone, 40% cheeks) and calibrates anchors (0%, 1.5%, 3.5%, 6%, 10%) onto 0–100.',
    ],
    scaleMeaning: {
      title: 'Score Scale (0–100)',
      description: 'Higher score indicates greater specular surface reflection and visible shine.',
      minimal: '0–24 (Minimal): Matte skin finish with virtually no specular reflection.',
      mild: '25–49 (Mild): Natural healthy radiance with subtle, balanced highlights.',
      moderate: '50–74 (Moderate): Noticeable oily shine across the forehead, nose, or cheeks.',
      pronounced: '75–100 (Pronounced): Strong specular glare and prominent surface oiliness.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks (Weighted 60% T-zone / 40% cheeks)',
      algorithm: 'Specular Highlight Detection via Sclera Illuminance Normalization',
      normalization: 'Normalized to ambient scene lighting via eye-white calibration',
    },
    clinicalNote:
      'Reflects physical light reflection in this photo. Lighting angle, direct camera flash, recent face washing, moisturizers, and sweat affect surface shine.',
  },

  underEye: {
    key: 'underEye',
    title: 'Under-Eye Darkness',
    tag: 'Periorbital Contrast',
    whatItMeasures:
      'Measures darkness and contrast in the infraorbital crescent beneath the lower eyelids compared to the adjacent upper cheek on each side.',
    howItIsCalculated:
      'Computes the colorimetric median lightness L* of the anatomical under-eye crescent minus the median L* of the adjacent upper cheek band on each side (the standard methodology used in dark-circle dermatology studies). Bilateral differentials are averaged and calibrated onto a 0–100 scale.',
    calculationSteps: [
      'Isolates anatomical infraorbital crescent polygons beneath both lower eyelids.',
      'Isolates adjacent upper cheek reference bands on each side.',
      'Calculates colorimetric median lightness L* for each under-eye and upper cheek region.',
      'Computes per-side differential: ΔL* = L*(upper cheek) - L*(under-eye).',
      'Averages both sides and calibrates anchors (0, 2.5, 5.0, 8.5, 13.0 ΔL*) onto 0–100.',
    ],
    scaleMeaning: {
      title: 'Score Scale (0–100)',
      description: 'Higher score indicates a greater contrast difference between under-eye skin and the cheek.',
      minimal: '0–24 (Minimal): Smooth, bright transition with minimal under-eye darkness.',
      mild: '25–49 (Mild): Subtle shadow or mild periorbital darkening.',
      moderate: '50–74 (Moderate): Noticeable dark circles contrasting against the cheeks.',
      pronounced: '75–100 (Pronounced): Deep, prominent periorbital discoloration or shadow hollows.',
    },
    technicalSpecs: {
      regions: 'Left & Right Under-Eye Crescents vs Adjacent Upper Cheeks',
      algorithm: 'Bilateral Median CIELAB ΔL* Differential',
      normalization: 'Measured relative to the person’s own adjacent upper cheek tone',
    },
    clinicalNote:
      'Overhead light cast downward creates shadows in the tear trough hollows. Not a diagnostic distinction between melanin pigment, vascular pooling, or structural anatomy.',
  },

  overallConfidence: {
    key: 'overallConfidence',
    title: 'Overall Analysis Confidence',
    tag: 'Quality & Reliability Rating',
    whatItMeasures:
      'Indicates the statistical reliability of the scan based on photo sharpness, resolution, lighting balance, head pose, and facial skin visibility.',
    howItIsCalculated:
      'Evaluates 8 core image quality factors (sharpness, exposure, lighting symmetry, head angle, resolution, sensor noise, expression, natural detail). Each metric’s individual reliability is combined with quality gating and facial skin coverage. The overall confidence is the composite score across all evaluated characteristics.',
    calculationSteps: [
      'Evaluates 8 image quality factors: sharpness, exposure, lighting symmetry, pose, resolution, detail, noise, expression.',
      'Enforces facial geometry gates: IOD ≥ 60 px, resolution ≥ 2.5 px/mm, yaw/pitch/roll < 15°.',
      'Calculates individual metric confidence = Reliability × Quality Factors × Usable Skin Coverage.',
      'Computes the overall score as the composite mean across all metrics.',
      'Labels confidence as High (≥ 75%), Moderate (55–74%), Low (40–54%), or Insufficient (< 40%).',
    ],
    scaleMeaning: {
      title: 'Confidence Levels',
      description: 'Reflects how clearly and reliably the photo could be algorithmically measured.',
      minimal: 'Insufficient (< 40%): Photo cannot be reliably analyzed; scores are withheld.',
      mild: 'Low (40–54%): Limited reliability due to blur, lighting glare, or head angle.',
      moderate: 'Moderate (55–74%): Acceptable photo with minor lighting or resolution compromises.',
      pronounced: 'High (≥ 75%): Clear frontal photo with optimal lighting and sharp detail.',
    },
    technicalSpecs: {
      regions: 'Full Facial Canvas & Anatomical Masks',
      algorithm: 'Multi-Factor Image Quality Gating + Composite Metric Reliability',
      normalization: 'Normalized 0–100% confidence rating',
    },
    clinicalNote:
      'High confidence indicates optimal photo conditions for computer vision measurement. It does not indicate clinical certainty or rule out medical conditions.',
  },

  pores: {
    key: 'pores',
    title: 'Pore Visibility',
    tag: 'Micro-Depression Optical Index',
    whatItMeasures:
      'Estimates the optical appearance index of visible follicular pore openings across the T-zone, nose, and cheeks.',
    howItIsCalculated:
      'Applies a second-derivative parabolic curvature operator tuned to 0.2–0.6 mm micro-depressions on log-luminance with camera noise subtraction. Requires a minimum spatial resolution of 2.8 px/mm for reliable measurement, mapping visibility onto a 0–100 index.',
    calculationSteps: [
      'Checks resolution threshold (> 2.8 px/mm) to ensure physical optical visibility.',
      'Applies parabolic valley filter to detect micro-concavities and dark focal depressions.',
      'Separates true follicular openings from sensor noise and superficial roughness.',
      'Calculates regional pore appearance index across forehead, nose, and cheeks.',
      'Generates normalized 0–100 appearance index and spatial heatmap.',
    ],
    scaleMeaning: {
      title: 'Pore Visibility Index (0–100)',
      description: 'Higher score indicates more visible follicular pore openings in this photo.',
      minimal: '0–24 (Minimal): Very tight, barely discernible pore appearance.',
      mild: '25–49 (Mild): Natural, normal visible pores under daylight.',
      moderate: '50–74 (Moderate): Noticeably enlarged or clearly visible pores in the T-zone or cheeks.',
      pronounced: '75–100 (Pronounced): Prominent, clearly dilated follicular pores.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks',
      algorithm: 'Parabolic Valley Curvature Analysis + Physical Scaled DoG',
      normalization: 'Gated by spatial resolution and camera noise subtraction',
    },
    clinicalNote:
      'An appearance estimate from this photo. Not a measurement of physical pore diameter, sebum secretion rate, or pore elasticity.',
  },

  skinType: {
    key: 'skinType',
    title: 'Skin Type & Visible Oiliness',
    tag: 'Glamour AI ViT Classification',
    whatItMeasures:
      'Estimates biological skin type (Dry, Normal, Oily) using a Vision Transformer classifier, paired with deterministic physical surface shine analysis.',
    howItIsCalculated:
      'Preprocesses segmented facial skin into a 224×224 float32 RGB tensor normalized to [-1.0, 1.0]. A Vision Transformer (ViT-Base, 85.8M parameters) generates class probabilities for Dry, Normal, and Oily. Simultaneously, deterministic computer vision measures physical specular highlights across the forehead, nose, and cheeks (0–100).',
    calculationSteps: [
      'Extracts segmented facial skin excluding eyes, eyebrows, hair, and lips.',
      'Preprocesses image to [1, 3, 224, 224] NCHW float32 tensor normalized to [-1.0, 1.0].',
      'Runs Vision Transformer image classifier to obtain logits and softmax probabilities.',
      'Assigns estimated skin type (Dry / Normal / Oily) based on highest probability.',
      'Independently evaluates surface specular reflectance score (0–100) across T-zone and cheeks.',
    ],
    scaleMeaning: {
      title: 'Skin Type Categories',
      description: 'Pattern classification based on visual facial skin characteristics.',
      minimal: 'Dry: Matte finish, delicate texture, minimal surface lipid reflection.',
      mild: 'Normal: Balanced hydration, moderate natural radiance, minimal excess shine.',
      moderate: 'Oily: Prominent surface reflection, visible follicular pores, active lipid sheen.',
      pronounced: 'Visible Shine (0–100): Direct physical measurement of specular light reflection.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks (ViT Full Face + Regional Shine)',
      algorithm: 'ViT-Base Image Classification (85.8M params) + Deterministic Specular CV',
      normalization: 'ViT Mean/Std 0.5 Normalization + Sclera Illuminance Baseline',
    },
    clinicalNote:
      'Skin type is estimated from photographic patterns. Weather, recent face washing, moisturizers, and ambient humidity temporarily affect surface oiliness.',
  },

  skinToneUniformity: {
    key: 'skinToneUniformity',
    title: 'Skin-Tone & Uniformity',
    tag: 'CIELAB colour measurement',
    whatItMeasures:
      'Describes the colour of your facial skin as measured in this photo (Individual Typology Angle category, nearest Monk Skin Tone swatch and hue) and how consistent that colour is across the forehead, cheeks, nose and chin.',
    howItIsCalculated:
      'Facial skin is converted to the CIELAB (D65) colour space, leaving out clipped highlights (RGB ≥ 248) and deep shadows (L* ≤ 12). The Individual Typology Angle, ITA = (180/π) × arctan((L* − 50)/b*) (Chardon et al. 1991), is grouped into the colour categories of Del Bino et al. (very light to dark); hue angle is reported as a second dimension of skin colour, as proposed by Thong et al. (ICCV 2023). The nearest Monk Skin Tone swatch is found by colour distance. Colour differences between regions (ΔE*ab) are combined into a 0–100 uniformity score, with an allowance for side lighting (|ΔL*| > 14). Colour measured from a photo depends on the lighting and camera, so it is not a skin-type classification (such as a Fitzpatrick phototype, which describes how skin reacts to the sun).',
    calculationSteps: [
      'Extracts non-shadow, non-specular facial skin pixels across Forehead, Cheeks, Nose, and Chin.',
      'Computes facial median CIELAB (L*, a*, b*) colorimetry and representative sRGB hex swatch.',
      'Calculates the Individual Typology Angle (ITA) and its colour category (very light, light, intermediate, tan, brown, dark).',
      'Perceptually matches to the nearest Monk Skin Tone scale standard (Monk 01 through Monk 10).',
      'Determines skin undertone (Cool, Neutral, Warm) from CIELAB hue angle and chroma ratio.',
      'Measures regional Delta E*ab distances and compensates for directional side lighting.',
      'Converts the regional colour differences into a 0–100 uniformity score.',
    ],
    scaleMeaning: {
      title: 'Uniformity Score (0–100)',
      description: 'Higher score indicates greater color and lightness consistency across facial zones.',
      minimal: '0–44 (Localized Variation): Noticeable regional color differentials or mottled appearance.',
      mild: '45–69 (Moderately Uniform): Normal natural tonal variations between forehead, cheeks, and chin.',
      moderate: '70–89 (Uniform): Strong color consistency with smooth regional transitions.',
      pronounced: '90–100 (Even & Uniform): Exceptionally consistent color and lightness across all regions.',
    },
    technicalSpecs: {
      regions: 'Forehead, Left Cheek, Right Cheek, Nose, Chin',
      algorithm: 'ITA (Chardon 1991) + hue angle (Thong et al. 2023) + CIELAB ΔE*ab distances + nearest Monk swatch',
      normalization: 'Exponential mapping of the regional colour differences to 0–100 (not clinically validated)',
    },
    clinicalNote:
      'An objective image-based appearance estimate of skin tone and color consistency across facial regions. Not a medical diagnosis or measurement of pigmentation disorders.',
  },

  acne: {
    key: 'acne',
    title: 'Spots & Acne Severity Estimate',
    tag: 'Lesion Counting & Clinical Grader',
    whatItMeasures:
      'Counts red-toned and dark-toned spot candidates across all facial zones and estimates severity using Hayashi count bands.',
    howItIsCalculated:
      'Combines a multi-scale spot detector with the clinical Hayashi spot-count grading criteria. Evaluates the count of inflammatory-looking spots across the forehead, cheeks, and chin, categorizing into Levels 0 through 3.',
    calculationSteps: [
      'Scans all anatomical facial regions for focal spots with red or dark contrast.',
      'Counts inflammatory-looking red spots and darker marks per region.',
      'Maps spot counts to Hayashi severity bands (Level 0: Minimal, Level 1: Mild, Level 2: Moderate, Level 3: Severe).',
      'Assesses agreement between count-based grading and neural image classification.',
    ],
    scaleMeaning: {
      title: 'Severity Levels',
      description: 'Estimated from Hayashi count thresholds of visible red-toned spots.',
      minimal: 'Level 0 (None or minimal): 0–5 inflammatory-looking spots.',
      mild: 'Level 1 (Mild): 6–20 inflammatory-looking spots.',
      moderate: 'Level 2 (Moderate): 21–50 inflammatory-looking spots.',
      pronounced: 'Level 3 (Severe): Over 50 inflammatory-looking spots.',
    },
    technicalSpecs: {
      regions: 'Forehead, Nose, Cheeks, Chin',
      algorithm: 'Hayashi Count-Band Grader + Multi-Scale Spot Detection',
      normalization: 'Physical facial area normalization',
    },
    clinicalNote:
      'Experimental estimate from one photograph. Red-toned spots are not always acne, and this is not a clinical diagnosis or dermatological grade.',
  },

  skinAge: {
    key: 'skinAge',
    title: 'Skin Apparent Age',
    tag: 'AI Visual Age Span',
    whatItMeasures:
      'Estimates the visual apparent age range of the face in this photo based on facial features, skin patterns, and contours.',
    howItIsCalculated:
      'Uses a Vision Transformer (ViT-B/16) fine-tuned on the balanced FairFace dataset (CC BY 4.0), which classifies faces into 9 age ranges based on visual human guess patterns across balanced ethnic groups. Shows a likely range with associated model probability.',
    calculationSteps: [
      'Aligns face chip to 224×224 normalized RGB tensor using MediaPipe facial contours.',
      'Executes FairFace Vision Transformer classifier to produce logits over 9 age spans.',
      'Applies softmax to obtain probability distribution across age ranges.',
      'Selects most probable age span (or adjacent spans when probability is split).',
    ],
    scaleMeaning: {
      title: 'Age Spans',
      description: 'Model predicts likelihood across 9 spans (0–2, 3–9, 10–19, 20–29, 30–39, 40–49, 50–59, 60–69, 70+).',
      minimal: 'Youthful spans: 10–19, 20–29',
      mild: 'Adult spans: 30–39, 40–49',
      moderate: 'Mature spans: 50–59, 60–69',
      pronounced: 'Advanced span: 70+',
    },
    technicalSpecs: {
      regions: 'Full Face Chip (224×224)',
      algorithm: 'FairFace ViT-B/16 Age Classification',
      normalization: 'Trained on 10,000 multi-ethnic balanced portraits',
    },
    clinicalNote:
      'An AI estimate of how old the face appears in this photo — not your real chronological age and not a biological health measurement.',
  },
};

const EXPLANATIONS_AR: Record<ExplainingMetricKey, MetricExplanation> = {
  pigmentation: {
    key: 'pigmentation',
    title: 'عدم تجانس التصبغ',
    tag: 'الميلانين وتباين اللون',
    whatItMeasures:
      'يقيس التغميق الموضعي، وبقع الشمس، والنمش، وتراكم الميلانين البارز مقارنة بالجلد المحيط في الجبهة والوجنتين والذقن.',
    howItIsCalculated:
      'تتم مقارنة كل بكسل مع محيطه البالغ 8 مم في فضاء الألوان CIELAB باستخدام النسبة ρ = C* / (L* + 16). يفصل هذا المعيار تصبغ الميلانين الحقيقي عن ظلال الإضاءة. يستبعد مرشح مصفوفة هيسيان (Hessian) التجاعيد والخطوط الرفيعة. القياس الأولي هو التغميق المكافئ للتصبغ ΔL* في أكثر 15% من الجلد تأثراً، ويُعاير على مقياس من 0 إلى 100.',
    calculationSteps: [
      'عزل مناطق الجبهة والوجنتين والذقن مع استبعاد العينين والحاجبين والشفاه والشعر تماماً.',
      'حساب نسبة التشبع إلى السطوع الموضعية ρ = C* / (L* + 16) مقارنة بالأنسجة المحيطة (نواة غاوسية 8 مم).',
      'فلترة طيات الجلد والتجاعيد التعبيرية الرفيعة باستخدام نسب القيم الذاتية لمصفوفة هيسيان.',
      'قياس التغميق المكافئ للميلانين ΔL* في أكثر 15% من مساحة الجلد تأثراً.',
      'معايرة النقاط المرجعية (0، 0.8، 1.6، 2.6، 4.0 ΔL*) خطياً على مقياس من 0 إلى 100.',
    ],
    scaleMeaning: {
      title: 'مقياس الدرجات (0–100)',
      description: 'الدرجة الأعلى تعني تبايناً لونياً وتصبغاً أكثر وضوحاً في هذه الصورة.',
      minimal: '0–24 (أدنى حد): لون موحد ومتجانس للغاية مع انعدام التغميق الموضعي.',
      mild: '25–49 (خفيف): بقع شمس طفيفة أو نمش طبيعي باهت.',
      moderate: '50–74 (متوسط): تصبغات ملحوظة أو بقع داكنة واضحة في مناطق محددة.',
      pronounced: '75–100 (واضح): بقع داكنة بارزة أو تفاوت لوني كثيف ومكثف.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الوجنتان، الذقن',
      algorithm: 'نسبة CIELAB الموضعية المستقلة عن الظلال + مرشح هيسيان',
      normalization: 'مُقاس مقارنة بالجلد المحيط للمريض نفسه لتفادي أخطاء الإضاءة',
    },
    clinicalNote:
      'تحليل بصري معلوماتي من صورة واحدة. ليس تشخيصاً طبياً ولا يفرق بين الكلف، أو النمش الشمسي، أو تصبغات ما بعد الالتهاب.',
  },

  redness: {
    key: 'redness',
    title: 'الاحمرار المرئي',
    tag: 'الحمامى والشعيرات السطحية',
    whatItMeasures:
      'يقيس الاحمرار السطحي، وتوهج الشعيرات الدموية، والتهيج الوعائي البارز مقارنة باللون الأساسي المستقر لبشرتك.',
    howItIsCalculated:
      'يقيم القناة اللونية CIELAB a* (المعبرة عن الاحمرار). ولإلغاء تأثيرات الظلال وزوايا الإضاءة، يعتمد النسبة المستقلة عن الإضاءة a* / (L* + 16). يُحدد خط الأساس الشخصي عند الشريحة المئوية العشرين للبشرة. يتم حساب الاحمرار الزائد فوق هذا الأساس في أكثر 20% من مساحة الجلد تأثراً.',
    calculationSteps: [
      'تحليل جلد الجبهة والأنف والوجنتين والذقن.',
      'تعديل تدرجات الظلال باستخدام النسبة المستقلة عن الإضاءة a* / (L* + 16).',
      'تحديد خط الأساس الطبيعي للبشرة عند الشريحة المئوية 20 من الوجه.',
      'حساب فائض a* فوق خط الأساس مع هامش تسامح قدره وحدتان (≈ 1 فارق ملحوظ).',
      'حساب متوسط الفائض في أكثر 20% من الجلد تأثراً وتدريج النقاط (0، 2.5، 5.5، 9، 14) إلى مقياس 0–100.',
    ],
    scaleMeaning: {
      title: 'مقياس الدرجات (0–100)',
      description: 'الدرجة الأعلى تعني احمراراً وعائياً أو توهجاً أكثر وضوحاً في هذه الصورة.',
      minimal: '0–24 (أدنى حد): بشرة هادئة ومتوازنة وخالية من التوهج الوعائي.',
      mild: '25–49 (خفيف): توريد طفيف، دفء خفيف، أو احمرار موضعي محدود.',
      moderate: '50–74 (متوسط): احمرار وعائي ملحوظ أو تهيج بارز في مناطق الوجه.',
      pronounced: '75–100 (واضح): حمامى شديدة أو احمرار مستمر ومكثف في عدة مناطق.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان، الذقن',
      algorithm: 'فائض CIELAB a* مقارنة بخط الأساس الهادئ (أعلى 20% مساحة)',
      normalization: 'مستقل تماماً عن تدرجات الظلال وشدة الإضاءة الخارجية',
    },
    clinicalNote:
      'تقدير بصري معلوماتي. ليس تشخيصاً طبياً للوردية، أو التهاب الجلد، أو الآفات الوعائية.',
  },

  texture: {
    key: 'texture',
    title: 'ملمس البشرة',
    tag: 'الملمس الدقيق والخشونة',
    whatItMeasures:
      'يقيس تفاوت الملمس الدقيق، والخشونة السطحية، والنتوءات الصغيرة، وتعرجات المسام الدقيقة على سطح البشرة.',
    howItIsCalculated:
      'يطبق مرشح فرق الدوال الغاوسية (DoG) الفيزيائي الحساس للأطوال الموجية الدقيقة بين 0.2 و 1.0 مم على لوغاريتم السطوع. يتم ضبط مقياس الوجه بالمليمترات الحقيقية عبر المسافة بين الحدقتين (IOD = 63 مم). يُطرح إسهام ضوضاء حساس الكاميرا (المقدر عبر مرشح Immerkær) لمنع الخلط بين ضوضاء الإضاءة الخافتة وخشونة الجلد.',
    calculationSteps: [
      'تعديل مقياس الوجه بالمليمترات الحقيقية وفق المسافة بين العينين (متوسط البالغين 63 مم).',
      'تطبيق مرشح فرق الدوال الغاوسية الحساس للملمس المجهري الفيزيائي بين 0.2 و 1.0 مم.',
      'تقدير ضوضاء حساس الكاميرا عبر مرشح الترددات العالية وطرحها بدقة لمنع تشويش النتيجة.',
      'حساب سعة التباين الموثوقة (IQR / 1.349) على لوغاريتم السطوع.',
      'معايرة نسب التباين الأصلية (0.5%، 2.2%، 3.6%، 5.2%، 7.5%) على مقياس من 0 إلى 100.',
    ],
    scaleMeaning: {
      title: 'مقياس الدرجات (0–100)',
      description: 'الدرجة الأعلى تشير إلى تفاوت ملمس أو خشونة سطحية أكثر وضوحاً في هذه الصورة.',
      minimal: '0–24 (أدنى حد): ملمس ناعم ونقي ومجهري الانسيابية للغاية.',
      mild: '25–49 (خفيف): ملمس بشرة طبيعي وصحي مع حبيبات دقيقة ناعمة.',
      moderate: '50–74 (متوسط): خشونة ملحوظة، نتوءات صغيرة، أو حبيبات بارزة على السطح.',
      pronounced: '75–100 (واضح): ملمس غير متجانس، خشونة واضحة، أو تفاوت ملموس على نطاق واسع.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان، الذقن',
      algorithm: 'مرشح فرق الدوال الغاوسية متعدد النطاقات (0.2–1.0 مم) على لوغاريتم السطوع',
      normalization: 'طرح ضوضاء حساس الكاميرا + القياس بالمليمتر الفيزيائي الدقيق',
    },
    clinicalNote:
      'يقيس الملمس البصري الظاهر في الصورة. يؤثر تركيز العدسة، ودقة الكاميرا، وفلاتر التنعيم، ومستحضرات التجميل على النتيجة.',
  },

  blemishes: {
    key: 'blemishes',
    title: 'البقع والشوائب المرئية',
    tag: 'كشف الآفات والبقع البؤرية',
    whatItMeasures:
      'يقيس البقع البؤرية المنعزلة، والعلامات الداكنة، والشوائب ذات النبرة الحمراء البارزة مقارنة بالجلد المحيط بها.',
    howItIsCalculated:
      'يستخدم خوارزمية كشف النقط متعددة المقاييس (DoG Blobs بـ σ = 0.6، 1.0، 1.5 مم) على السطوع L* (البقع الداكنة، ≥ 4 ΔL*) والاحمرار a* (البقع الحمراء، ≥ 3 Δa*) مع كبت التكرارات غير القصوى. تشترط الخوارزمية إحاطة البقعة بجلد سليم، وتُحسب كثافة البقع المرجحة لكل 10 سم² من الجلد.',
    calculationSteps: [
      'مسح جلد الوجه بمرشحات الكشف البؤري متعددة المقاييس (σ = 0.6، 1.0، 1.5 مم).',
      'تحديد البقع الداكنة (فارق ≥ 4 ΔL*) والبقع الحمراء (فارق ≥ 3 Δa*).',
      'كبت التكرارات المتجاورة لمنع الحساب المزدوج للبقعة الواحدة.',
      'حساب كثافة البقع وفق المساحة الفيزيائية للجلد (عدد البقع المرجحة لكل 10 سم²).',
      'معايرة نقاط الكثافة (0، 0.6، 2.0، 4.5، 9.0 بقعة / 10 سم²) إلى مقياس من 0 إلى 100.',
    ],
    scaleMeaning: {
      title: 'مقياس الدرجات (0–100)',
      description: 'الدرجة الأعلى تعني كثافة أو تبايناً أعلى للبقع البؤرية في هذه الصورة.',
      minimal: '0–24 (أدنى حد): بشرة خالية تقريباً من الشوائب والعلامات البؤرية.',
      mild: '25–49 (خفيف): بضع بقع منعزلة خفيفة أو شوائب صغيرة نادرة.',
      moderate: '50–74 (متوسط): عدة بقع ملحوظة متوزعة عبر منطقة أو أكثر في الوجه.',
      pronounced: '75–100 (واضح): كثافة عالية من البقع البارزة أو الشوائب النشطة.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان، الذقن',
      algorithm: 'كاشف النقط الغاوسية متعدد المقاييس + كبت التكرار غير الأقصى',
      normalization: 'مُعاير حسب المساحة الفيزيائية لجلد الوجه (لكل 10 سم²)',
    },
    clinicalNote:
      'يكتشف التباين البصري للبقع. لا يفرق بين حب الشباب، والرؤوس السوداء، والشامات الحميدة، والنمش، وتصبغات ما بعد البثور.',
  },

  shine: {
    key: 'shine',
    title: 'اللمعان السطحي',
    tag: 'الانعكاس البصري والدهنية',
    whatItMeasures:
      'يقيس انعكاس الضوء المباشر على سطح البشرة الناتج عن الإفرازات الدهنية، أو الرطوبة، أو مستحضرات التجميل اللامعة.',
    howItIsCalculated:
      'يرصد بكسلات الانعكاس المرآوي الأشد سطوعاً من الجلد الانتشاري المحيط بأكثر من 12% من إضاءة المشهد الكلية (المقدرة عبر بياض صلبة العينين لضمان الحيادية تجاه لون البشرة). يُوزع الحساب بنسبة 60% لمنطقة T (الجبهة والأنف) و 40% للوجنتين، ويُعاير على مقياس من 0 إلى 100.',
    calculationSteps: [
      'تقدير الإضاءة المحيطة في الصورة من بياض صلبة العينين (مرجع محايد لا يتأثر بلون البشرة).',
      'حساب الانعكاس الانتشاري الأساسي للجلد مع استبعاد مناطق اللمعان.',
      'تحديد بكسلات الانعكاس الفائق التي تتجاوز الأساس بـ > 12% مع انخفاض التشبع أو السطوع المشبع.',
      'حساب النسبة المئوية للمساحة اللامعة في منطقة T والوجنتين.',
      'دمج النسبتين (60% لمنطقة T و 40% للوجنتين) وتدريج النقاط المرجعية (0%، 1.5%، 3.5%، 6%، 10%) إلى 0–100.',
    ],
    scaleMeaning: {
      title: 'مقياس الدرجات (0–100)',
      description: 'الدرجة الأعلى تشير إلى لمعان وانعكاس ضوئي سطحي أوضح.',
      minimal: '0–24 (أدنى حد): مظهر غير لامع (مات) مع انعدام الانعكاسات المباشرة.',
      mild: '25–49 (خفيف): نضارة صحية طبيعية مع لمعان متوازن ومتفرق.',
      moderate: '50–74 (متوسط): لمعان دهني ملحوظ في الجبهة أو الأنف أو الوجنتين.',
      pronounced: '75–100 (واضح): بريق وانعكاس ضوئي قوي يدل على دهنية سطحية بارزة.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان (60% منطقة T / 40% الوجنتان)',
      algorithm: 'كشف الانعكاس المرآوي الموزون بمعايرة إضاءة صلبة العين',
      normalization: 'معايرة الإضاءة المحيطة عبر بياض العينين لضمان الحيادية العرقية',
    },
    clinicalNote:
      'يعكس انعكاس الضوء الفيزيائي في الصورة. تؤثر زاوية الإضاءة، وفلاش الكاميرا المباشر، وغسل الوجه الحديث، والمرطبات، والعرق على النتيجة.',
  },

  underEye: {
    key: 'underEye',
    title: 'الهالات تحت العينين',
    tag: 'تباين محيط العين',
    whatItMeasures:
      'يقيس التغميق والتباين اللوني في الهلال التشريحي تحت الجفنين السفليين مقارنة بالمنطقة العلوية المجاورة من الوجنة.',
    howItIsCalculated:
      'يحسب الفارق اللوني للسطوع ΔL* بين وسيط سطوع هلال تحت العين ووسيط سطوع أعلى الوجنة لكل جهة بشكل مستقل (وهي المنهجية المعتمدة في الدراسات الجلدية المتخصصة في الهالات). يُؤخذ متوسط الفارق للجهتين ويُعاير على مقياس من 0 إلى 100.',
    calculationSteps: [
      'تحديد مضلع الهلال التشريحي تحت العين أسفل كلا الجفنين السفليين بدقة.',
      'تحديد النطاق المرجعي المقابل في الجزء العلوي من الوجنة لكل جهة.',
      'حساب وسيط السطوع L* لمنطقة تحت العين ومنطقة أعلى الوجنة.',
      'حساب فارق السطوع لكل جانب: ΔL* = سطوع الوجنة - سطوع تحت العين.',
      'حساب متوسط الجانبين وتدريج النقاط المرجعية (0، 2.5، 5.0، 8.5، 13.0 ΔL*) إلى 0–100.',
    ],
    scaleMeaning: {
      title: 'مقياس الدرجات (0–100)',
      description: 'الدرجة الأعلى تعني تبايناً وتغديقاً أشد وضوحاً تحت العينين مقارنة بالوجنتين.',
      minimal: '0–24 (أدنى حد): انتقال انسيابي ومشرق مع انعدام الهالات الداكنة.',
      mild: '25–49 (خفيف): ظل طفيف أو اسمرار بسيط في محيط العين السفلي.',
      moderate: '50–74 (متوسط): هالات داكنة ملحوظة تتباين بوضوح مع الوجنتين.',
      pronounced: '75–100 (واضح): تصبغ عميق أو تجويف ظللي بارز تحت العينين.',
    },
    technicalSpecs: {
      regions: 'الهلالان تحت العينين مقارنة بأعلى الوجنتين (لكل جهة)',
      algorithm: 'فارق وسيط السطوع CIELAB ΔL* ثنائي الجانب',
      normalization: 'مُقاس مقارنة باللون الطبيعي لوجنة المريض نفسه',
    },
    clinicalNote:
      'تُحدث الإضاءة العلوية الساقطة من الأعلى ظلالاً في مزاريب الدمع تحت العين. ليس تفريقاً طبياً بين تصبغ الميلانين، أو احتقان الأوعية، أو التجاويف العظمية.',
  },

  overallConfidence: {
    key: 'overallConfidence',
    title: 'موثوقية التحليل الإجمالية',
    tag: 'تقييم جودة الصورة ودقة الخوارزميات',
    whatItMeasures:
      'يوضح مدى الموثوقية الإحصائية لنتائج الفحص استناداً إلى وضوح الصورة، ودقة الإضاءة، وزاوية الوجه، والمساحة المرئية من الجلد.',
    howItIsCalculated:
      'تقيم الخوارزمية 8 عوامل أساسية لجودة الصورة (الحدة، التعريض، توازن الإضاءة، زاوية الرأس، الدقة المليمترية، تشويش الحساس، تعبير الوجه، التفاصيل الطبيعية). تُدمج موثوقية كل معيار على حدة مع تغطية الجلد لحساب النسبة المئوية الإجمالية.',
    calculationSteps: [
      'فحص 8 عوامل لجودة الصورة: الحدة، التعريض، الإضاءة، الزاوية، الدقة، التفاصيل، التشويش، والتعبير.',
      'التحقق من بوابات هندسة الوجه: مسافة العينين ≥ 60 بكسل، الدقة ≥ 2.5 بكسل/مم، الزوايا < 15 درجة.',
      'حساب موثوقية كل معيار = الموثوقية الخوارزمية × عوامل جودة الصورة × مساحة الجلد القابلة للتحليل.',
      'حساب الدرجة الإجمالية كمتوسط تركيبي لجميع المعايير.',
      'تصنيف الموثوقية: عالية (≥ 75%)، متوسطة (55–74%)، منخفضة (40–54%)، أو غير كافية (< 40%).',
    ],
    scaleMeaning: {
      title: 'مستويات الموثوقية',
      description: 'توضح درجة دقة الخوارزميات الحاسوبية في قراءة بيانات هذه الصورة.',
      minimal: 'غير كافية (< 40%): جودة الصورة لا تتيح تحليلاً موثوقاً؛ تُحجب الدرجات منعاً للتضليل.',
      mild: 'منخفضة (40–54%): موثوقية محدودة بسبب ضبابية أو إضاءة غير متوازنة أو زاوية مائلة.',
      moderate: 'متوسطة (55–74%): صورة مقبولة مع بعض التأثيرات الطفيفة للإضاءة أو الدقة.',
      pronounced: 'عالية (≥ 75%): صورة أمامية واضحة ومثالية بإضاءة ممتازة وتفاصيل دقيقة.',
    },
    technicalSpecs: {
      regions: 'كامل لوحة الوجه والخرائط التشريحية',
      algorithm: 'بوابات فحص الجودة متعددة المعايير + تكامل موثوقية القياسات',
      normalization: 'نسبة مئوية موحدة وموثوقة من 0 إلى 100%',
    },
    clinicalNote:
      'الموثوقية العالية تعني توافر شروط تصوير مثالية لقراءة الخوارزميات الحاسوبية، ولا تعني جزماً طبياً أو تشخيصاً سريرياً.',
  },

  pores: {
    key: 'pores',
    title: 'وضوح المسام',
    tag: 'المؤشر البصري للمسام السطحية',
    whatItMeasures:
      'يقدر المؤشر البصري لظهور فوهات المسام الجريبية في منطقة T والأنف والوجنتين.',
    howItIsCalculated:
      'يطبق مرشح انحناء القطع المكافئ الحساس للتجاويف الدقيقة (0.2–0.6 مم) على لوغاريتم السطوع مع طرح تشويش الكاميرا. يتطلب دقة مكانية لا تقل عن 2.8 بكسل/مم لضمان وضوح الأبعاد الفيزيائية للمسام.',
    calculationSteps: [
      'التحقق من تجاوز عتبة الدقة المكانية (> 2.8 بكسل/مم) لضمان إمكانية رصد المسام فيزيائياً.',
      'تطبيق مرشح انحناء القطع المكافئ لرصد التجاويف المجهرية والانخفاضات الداكنة الدقيقة.',
      'فصل الفوهات الجريبية الحقيقية عن ضوضاء الحساس والخشونة السطحية المسطحة.',
      'حساب مؤشر ظهور المسام الإقليمي في الجبهة والأنف والوجنتين.',
      'توليد درجة الظهور من 0 إلى 100 والخريطة الحرارية المكانية للمسام.',
    ],
    scaleMeaning: {
      title: 'مؤشر ظهور المسام (0–100)',
      description: 'الدرجة الأعلى تعني مساماً أكثر اتساعاً ووضوحاً للعين في هذه الصورة.',
      minimal: '0–24 (أدنى حد): مسام دقيقة ومشدودة للغاية وبالكاد تُلحظ بصرياً.',
      mild: '25–49 (خفيف): مسام طبيعية معتادة في ظروف الإضاءة النهارية الطبيعية.',
      moderate: '50–74 (متوسط): مسام متسعة بوضوح في منطقة الجبهة أو الأنف أو الوجنتين.',
      pronounced: '75–100 (واضح): مسام جريبية بارزة وواسعة وظاهرة بشكل جلي.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان',
      algorithm: 'تحليل انحناء القطع المكافئ + مرشح DoG بالقياس الفيزيائي',
      normalization: 'مشروط بالدقة المكانية العالية وطرح ضوضاء حساس الكاميرا',
    },
    clinicalNote:
      'تقدير بصري لمظهر المسام في هذه الصورة. ليس قياساً لقطر المسام الفيزيائي، أو معدل إفراز الدهون، أو مرونة الأنسجة الجريبية.',
  },

  skinType: {
    key: 'skinType',
    title: 'نوع البشرة والدهنية',
    tag: 'تصنيف Glamour AI عبر محولات الرؤية ViT',
    whatItMeasures:
      'يصنف نوع البشرة إلى (جافة، عادية، دهنية) باستخدام محول الرؤية البصري ViT، إلى جانب قياس فيزيائي مستقل لدرجة اللمعان السطحي.',
    howItIsCalculated:
      'يُعالج جلد الوجه المعزول في مصفوفة أبعاد 224×224 بكسل بتطبيع [-1.0، 1.0]. يحلل نموذج محول الرؤية البصري (ViT-Base بـ 85.8 مليون معامل) الأنماط النسيجية لتحديد احتمالات الفئات الثلاث. في الوقت نفسه، تقيس خوارزميات الرؤية الحاسوبية الانعكاس المرآوي المباشر في منطقة T والوجنتين (0–100).',
    calculationSteps: [
      'عزل مساحات جلد الوجه مع استبعاد العينين والحاجبين والشعر والشفاه.',
      'تجهيز الصورة في مصفوفة عائمة [1, 3, 224, 224] بنطاق تطبيع [-1.0, 1.0].',
      'تشغيل نموذج المحول البصري لاستخراج احتمالات الفئات (جافة، عادية، دهنية).',
      'تحديد النوع المرجح بناءً على أعلى نسبة احتمال.',
      'حساب مستقل لدرجة اللمعان الدهني السطحي (0–100) عبر ارتداد الضوء في منطقة T والوجنتين.',
    ],
    scaleMeaning: {
      title: 'تصنيفات نوع البشرة',
      description: 'تصنيف نمطي مستند إلى الخصائص البصرية لنسيج البشرة ولمعانها.',
      minimal: 'جافة (Dry): مظهر غير لامع، نسيج دقيق، وانعدام الانعكاسات الدهنية السطحية.',
      mild: 'عادية (Normal): ترطيب متوازن، نضارة طبيعية معتدلة، وانعدام الزيوت الزائدة.',
      moderate: 'دهنية (Oily): انعكاس سطحي واضح، مسام جريبية نشطة، وبريق دهني بارز.',
      pronounced: 'اللمعان السطحي (0–100): قياس فيزيائي مستقل لدرجة انعكاس الضوء السطحي.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان (نموذج ViT لكامل الوجه + لمعان إقليمي)',
      algorithm: 'تصنيف ViT-Base (85.8M معامل) + خوارزمية ارتداد الضوء المرآوي',
      normalization: 'تطبيع ViT المعياري 0.5 + معايرة إضاءة صلبة العين',
    },
    clinicalNote:
      'تقدير للأنماط الظاهرة في الصورة. تؤثر التغيرات المناخية، والغسيل الحديث للوجه، والمرطبات، والرطوبة الجوية على دهنية السطح مؤقتاً.',
  },

  skinToneUniformity: {
    key: 'skinToneUniformity',
    title: 'درجة وتجانس لون البشرة',
    tag: 'قياس اللون بنظام CIELAB',
    whatItMeasures:
      'يصف لون بشرة وجهك كما قيس في هذه الصورة (فئة زاوية النمط الفردي ITA، وأقرب درجة في مقياس Monk، وزاوية التدرج اللوني) ومدى ثبات هذا اللون بين الجبهة والخدين والأنف والذقن.',
    howItIsCalculated:
      'تُحوَّل بشرة الوجه إلى فضاء الألوان CIELAB (D65) مع استبعاد اللمعان المشبع (RGB ≥ 248) والظلال العميقة (L* ≤ 12). تُحسب زاوية النمط الفردي ITA = (180/π) × arctan((L* − 50)/b*) (Chardon وزملاؤه 1991) وتُصنَّف ضمن فئات Del Bino وزملائه اللونية (فاتحة جدًا إلى داكنة)، وتُعرض زاوية التدرج اللوني كبُعد ثانٍ للون البشرة كما اقترح Thong وزملاؤه (ICCV 2023). وتُحدَّد أقرب درجة في مقياس Monk بحسب المسافة اللونية. ثم تُجمع الفروق اللونية بين المناطق (ΔE*ab) في درجة تجانس من 0 إلى 100 مع مراعاة الإضاءة الجانبية (|ΔL*| > 14). يتأثر اللون المقاس من الصورة بالإضاءة والكاميرا، لذلك فهو ليس تصنيفًا لنوع البشرة (مثل نمط فيتزباتريك الذي يصف استجابة البشرة للشمس).',
    calculationSteps: [
      'استخراج بكسلات الجلد غير المظللة وغير المشبعة عبر الجبهة والوجنتين والأنف والذقن.',
      'حساب وسيط قيم CIELAB (L*, a*, b*) وعينة اللون التمثيلية بصيغة sRGB hex.',
      'حساب زاوية النمط الفردي (ITA) وفئتها اللونية (فاتحة جدًا، فاتحة، متوسطة، حنطية، سمراء، داكنة).',
      'المطابقة الإدراكية مع أقرب درجة من مقياس مونك العالمي لدرجات البشرة (Monk 01 إلى Monk 10).',
      'تحديد المسحة التحتية للبشرة (باردة، محايدة، دافئة) من زاوية التدرج اللوني ونسبة التشبع.',
      'قياس المسافات اللونية الإدراكية بين المناطق مع تعويض أثر الإضاءة الجانبية الموجهة.',
      'تحويل الفروق اللونية بين المناطق إلى درجة تجانس من 0 إلى 100.',
    ],
    scaleMeaning: {
      title: 'مقياس التجانس (0–100)',
      description: 'الدرجة الأعلى تشير إلى تناغم واستقرار لوني أكبر عبر مناطق الوجه المختلفة.',
      minimal: '0–44 (تفاوت موضعي): فروق لونية ملحوظة أو تفاوتات موضعية بين مناطق الوجه.',
      mild: '45–69 (معتدل التجانس): تباينات لونية طبيعية معتادة بين الجبهة والوجنتين والذقن.',
      moderate: '70–89 (متجانس): تناغم لوني قوي وانتقال انسيابي بين ملامح الوجه.',
      pronounced: '90–100 (موحد ومتجانس تماماً): استقرار لوني واستواء لوني استثنائي عبر كامل الوجه.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الوجنة اليسرى، الوجنة اليمنى، الأنف، الذقن',
      algorithm: 'زاوية ITA (Chardon 1991) + زاوية التدرج اللوني (Thong 2023) + مسافات CIELAB ΔE*ab + أقرب درجة Monk',
      normalization: 'تحويل أسي للفروق اللونية بين المناطق إلى 0–100 (غير مُتحقق منه سريريًا)',
    },
    clinicalNote:
      'تقييم بصري موضوعي لمظهر ولون البشرة واتساق التصبغ في الصورة. ليس تشخيصاً طبياً لاضطرابات التصبغ، أو الكلف، أو البهاق.',
  },

  acne: {
    key: 'acne',
    title: 'البقع وتقدير حب الشباب',
    tag: 'تعداد الآفات وتدريج هياشي السريري',
    whatItMeasures:
      'يعد البقع ذات النبرة الحمراء والداكنة عبر مناطق الوجه ويقدر مستوى الشدة استناداً إلى شرائح تعداد هياشي السريرية.',
    howItIsCalculated:
      'يدمج كاشف الشوائب متعدد المقاييس مع معايير تدريج حب الشباب بالعد (Hayashi Grading). يقيم عدد البقع الحمراء الملتهبة في الجبهة والوجنتين والذقن ويصنفها إلى 4 مستويات (المستوى 0 إلى 3).',
    calculationSteps: [
      'مسح كافة مناطق الوجه التشريحية لرصد البقع البؤرية ذات التباين الأحمر أو الداكن.',
      'تعداد البقع ذات النبرة الحمراء المشابهة للالتهاب في كل منطقة.',
      'تصنيف التعداد وفق شرائح هياشي (المستوى 0: أدنى حد، 1: خفيف، 2: متوسط، 3: شديد).',
      'تقييم التوافق بين التدريج القائم على العد والتصنيف العصبي البصري.',
    ],
    scaleMeaning: {
      title: 'مستويات الشدة التقديرية',
      description: 'مستند إلى عتبات تعداد البقع الحمراء الملتهبة الظاهرة.',
      minimal: 'المستوى 0 (منعدم أو أدنى حد): 0–5 بقع حمراء ظاهرة.',
      mild: 'المستوى 1 (خفيف): 6–20 بقعة حمراء ظاهرة.',
      moderate: 'المستوى 2 (متوسط): 21–50 بقعة حمراء ظاهرة.',
      pronounced: 'المستوى 3 (شديد): أكثر من 50 بقعة حمراء ظاهرة.',
    },
    technicalSpecs: {
      regions: 'الجبهة، الأنف، الوجنتان، الذقن',
      algorithm: 'مُدرج شرائح تعداد هياشي + كشف النقط الغاوسية',
      normalization: 'معايرة حسب مساحة الوجه الفيزيائية',
    },
    clinicalNote:
      'تقدير تجريبي من صورة واحدة. البقع ذات النبرة الحمراء ليست دائماً حب شباب، وهذا التقدير ليس درجة طبية أو تشخيصاً سريرياً.',
  },

  skinAge: {
    key: 'skinAge',
    title: 'تقدير عمر مظهر البشرة',
    tag: 'المدى العمري البصري بالذكاء الاصطناعي',
    whatItMeasures:
      'يقدر المدى العمري الظاهري لمظهر الوجه في هذه الصورة بناءً على الملامح والخطوط ومظهر نسيج الجلد.',
    howItIsCalculated:
      'يستخدم نموذج محول الرؤية البصري (ViT-B/16) المدرب على قاعدة بيانات FairFace المتوازنة عرقياً (CC BY 4.0)، والتي تصنف الوجوه إلى 9 فئات عمرية بناءً على أنماط التقدير البشري المعتادة عبر مجموعات عرقية متنوعة.',
    calculationSteps: [
      'ضبط قصاصة الوجه في مصفوفة 224×224 مطبعة باستخدام معالم MediaPipe.',
      'تشغيل نموذج FairFace ViT لإنتاج مصفوفة التوزيع الاحتمالي للفئات العمرية التسع.',
      'تطبيق دالة سوفت ماكس لاستخراج النسب المئوية الدقيقة لكل فئة عمرية.',
      'تحديد المدى العمري الأكثر ترجيحاً مع نسبة ثقة النموذج.',
    ],
    scaleMeaning: {
      title: 'الفئات العمرية للنموذج',
      description: 'يقيس الاحتمالية عبر 9 فئات (0–2، 3–9، 10–19، 20–29، 30–39، 40–49، 50–59، 60–69، 70+).',
      minimal: 'فئات الشباب: 10–19، 20–29',
      mild: 'فئات النضج: 30–39، 40–49',
      moderate: 'فئات الوقار: 50–59، 60–69',
      pronounced: 'الفئة المتقدمة: 70+',
    },
    technicalSpecs: {
      regions: 'قصاصة الوجه الكاملة (224×224)',
      algorithm: 'تصنيف الأعمار FairFace ViT-B/16',
      normalization: 'مدرب على 10,000 صورة شخصية متوازنة عبر سبع مجموعات عرقية',
    },
    clinicalNote:
      'تقدير تقريبي للمظهر في هذه الصورة تحديداً، وليس عمرك الزمني الحقيقي ولا مقياساً لصحة الجلد البيولوجية.',
  },
};

export function getMetricExplanation(key: ExplainingMetricKey, locale: Locale = 'en'): MetricExplanation {
  const dict = locale === 'ar' ? EXPLANATIONS_AR : EXPLANATIONS_EN;
  return dict[key] ?? dict.pigmentation;
}

