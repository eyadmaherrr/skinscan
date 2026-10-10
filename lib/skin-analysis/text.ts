import type { Locale } from '../i18n';
import type { MetricKey, QualityIssueCode, ScanErrorCode, ScoreBand } from './types';

/**
 * Every sentence the analysis returns, in English and Arabic. Wording
 * describes what is *visible in the photo* and never names a condition or
 * implies a diagnosis — in both languages.
 */

export type RegionGroup = 'forehead' | 'nose' | 'cheeks' | 'chin' | 'underEyes' | 'jawline';
export type InsufficientReason = 'low_resolution' | 'not_enough_skin' | 'not_visible' | 'low_confidence' | 'expression';
/** Non-blocking observations about the photo. */
export type QualityNoteCode = 'uneven_side_light' | 'partly_covered' | 'low_resolution' | 'smiling';

/** A template gets the region list and a metric-specific qualifier (tone, undertone). */
type Template = (where: string, qualifier: string) => string;

export interface AnalysisText {
  regions: Record<RegionGroup, string>;
  joinList(names: string[]): string;
  analysedSkin: string;
  templates: Record<MetricKey, Record<ScoreBand, Template>>;
  mostlyRed: string;
  mostlyDark: string;
  cooler: string;
  warmer: string;
  shineNote: string;
  underEyeNote: string;
  insufficient: Record<InsufficientReason, string>;
  quality: Record<QualityIssueCode, string>;
  errors: Record<ScanErrorCode, string>;
  notes: Record<QualityNoteCode, string>;
  acne: {
    limitations: string[];
    jawHidden: string;
    none: string;
    mostRed: string;
    mostDark: string;
    mixed: string;
    summary(tones: string, region: string | null): string;
    failed: string;
    disabled: string;
  };
  pores: {
    scale: string;
    limitations: string[];
    tooFar: string;
    notSharp: string;
    grainy: string;
    smoothed: string;
    notEnoughArea: string;
    unreliable: string;
    notEnoughSkin: string;
    conditions: string;
    conditionsHelp: string;
    level(score: number): string;
    where: { nose: string; forehead: string; cheeks: string };
    summary(level: string, where: string | null): string;
    failed: string;
    disabled: string;
  };
  severityScale: string;
  skinAge: {
    summary(min: number, max: number | null, pct: number): string;
    limitations: string[];
    failed: string;
    disabled: string;
    notConfigured: string;
  };
  skinType: {
    summary(type: 'dry' | 'normal' | 'oily', shineScore: number | null): string;
    notConfigured: string;
    failed: string;
    disabled: string;
    limitations: string[];
  };
  skinToneUniformity: {
    summary(
      score: number | null,
      band: 'high' | 'moderate' | 'variable' | null,
      tone?: import('./types').DetectedSkinTone | null,
    ): string;
    insufficientQuality: string;
    failed: string;
    disabled: string;
    limitations: string[];
  };
}

const en: AnalysisText = {
  regions: {
    forehead: 'forehead',
    nose: 'nose',
    cheeks: 'cheeks',
    chin: 'chin',
    underEyes: 'under-eye area',
    jawline: 'jawline',
  },
  joinList: (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`),
  analysedSkin: 'analysed skin',
  templates: {
    pigmentation: {
      minimal: () => 'Skin tone looked even across the analysed areas, with few darker patches.',
      mild: (w) => `A few small areas were slightly darker than the surrounding skin, mainly on the ${w}.`,
      moderate: (w) => `Several areas were visibly darker than the surrounding skin, most noticeably on the ${w}.`,
      pronounced: (w) => `Darker patches were clearly visible against the surrounding skin, especially on the ${w}.`,
    },
    redness: {
      minimal: () => 'Little redness stood out from your overall skin tone.',
      mild: (w) => `Some areas looked slightly redder than the rest of your skin, mainly on the ${w}.`,
      moderate: (w) => `Redness was visible compared with the rest of your skin, most noticeably on the ${w}.`,
      pronounced: (w) => `Redness was clearly visible compared with the rest of your skin, especially on the ${w}.`,
    },
    texture: {
      minimal: () => 'The skin surface looked smooth in this photo.',
      mild: (w) => `Some fine surface texture was visible, mainly on the ${w}.`,
      moderate: (w) => `Surface texture (fine unevenness of the skin) was visible, most noticeably on the ${w}.`,
      pronounced: (w) => `Surface texture was clearly visible across the ${w}.`,
    },
    blemishes: {
      minimal: () => 'Few distinct spots or marks stood out from the surrounding skin.',
      mild: (w, t) => `A few distinct spots were visible${t}, mainly on the ${w}.`,
      moderate: (w, t) => `Several distinct spots or marks were visible${t}, most noticeably on the ${w}.`,
      pronounced: (w, t) => `Many distinct spots or marks were visible${t}, especially on the ${w}.`,
    },
    shine: {
      minimal: () => 'Little surface shine was visible in this lighting.',
      mild: (w) => `Some light shine was visible, mainly on the ${w}.`,
      moderate: (w) => `Noticeable shine was visible, mostly on the ${w}.`,
      pronounced: (w) => `Strong shine was visible, especially on the ${w}.`,
    },
    underEye: {
      minimal: () => 'The under-eye area looked similar in tone to the nearby cheek skin.',
      mild: (_, u) => `The under-eye area looked slightly darker${u} than the nearby cheek skin.`,
      moderate: (_, u) => `The under-eye area looked visibly darker${u} than the nearby cheek skin.`,
      pronounced: (_, u) => `The under-eye area looked clearly darker${u} than the nearby cheek skin.`,
    },
  },
  mostlyRed: ', mostly red-toned',
  mostlyDark: ', mostly darker-toned',
  cooler: ' and cooler-toned',
  warmer: ' and warmer-toned',
  shineNote: ' Shine depends strongly on the lighting when the photo was taken.',
  underEyeNote: ' Overhead lighting can make this area look darker.',
  insufficient: {
    low_resolution: 'The photo did not have enough detail to measure this reliably. A closer, sharper photo may allow it.',
    not_enough_skin: 'Not enough clear skin was visible in the relevant areas to measure this reliably.',
    not_visible: 'This area was not clearly visible in the photo.',
    low_confidence:
      'The photo conditions did not allow a reliable measurement. Brighter, even lighting and a sharp photo may help.',
    expression:
      'Smiling creases the cheeks, and those folds look like darker or textured skin. A photo with a relaxed, neutral expression is needed to measure this.',
  },
  quality: {
    no_face: 'We could not find a face in this photo. Please take a photo facing the camera directly.',
    multiple_faces: 'More than one face is visible. Please take a photo with only your face in the frame.',
    face_too_small: 'Your face is too small in the photo. Please move closer so your face fills the oval.',
    face_cropped: 'Part of your face is outside the photo. Please centre your whole face in the frame.',
    face_angle: 'Please look straight at the camera with your head level, not turned or tilted.',
    blurry: 'The photo is too blurry. Please hold the camera steady and make sure it is focused on your face.',
    too_dark: 'The photo is too dark. Please retake it in brighter, even lighting, facing a window or light source.',
    too_bright: 'The photo is overexposed. Please avoid direct flash or harsh light and retake it in soft, even lighting.',
    uneven_lighting: 'One side of your face is much darker than the other. Please face the light so it falls evenly on your face.',
    filter_detected:
      'The photo looks filtered or heavily edited (for example smoothing, sharpening or HDR effects). Please retake it with filters and effects turned off.',
    not_color: 'Please use a colour photo without black-and-white or colour filters.',
    sunglasses: 'Please remove your sunglasses and retake the photo.',
    glasses: 'Please remove your glasses so the skin around your eyes is visible, then retake the photo.',
    face_obstructed: 'Part of your face is covered. Please move hair, hands or face coverings away from your face.',
    insufficient_skin: 'Not enough facial skin is visible to analyse. Please pull hair back and face the camera directly.',
  },
  errors: {
    unauthenticated: 'Please sign in to your Dr. Maher Mahmoud Clinics account to run a skin scan.',
    invalid_request: 'Please choose a photo to scan.',
    unsupported_type: 'This file type is not supported. Please use a JPG, PNG or WebP photo.',
    file_too_large: 'This photo is too large. Please use a photo under the size limit.',
    image_unreadable: 'We could not read this image. Please try another photo.',
    image_quality: 'Please retake the photo in brighter, even lighting with your face looking directly at the camera.',
    rate_limited: 'You have run several scans in a short time. Please wait a few minutes and try again.',
    busy: 'The scanner is busy right now. Please try again in a moment.',
    timeout: 'The analysis took too long. Please try again, ideally with a smaller photo.',
    analysis_failed: 'Something went wrong while analysing the photo. Please try again.',
  },
  notes: {
    uneven_side_light: 'One side of your face was more brightly lit than the other.',
    partly_covered: 'Some areas were covered (for example by hair) and were not analysed.',
    low_resolution: 'Photo resolution limited the measurement of fine detail such as texture.',
    smiling: 'Smiling creates skin folds that can affect some results; a neutral expression gives the most reliable scan.',
  },
  acne: {
    limitations: [
      'Spot candidates are found from colour and contrast. They are not acne-specific and may include freckles, moles or other marks.',
      'Red-toned and dark-toned are visual descriptions only; they do not tell what a spot is. Only a dermatologist can identify lesions.',
      'Counts are approximate and depend on lighting, camera and distance.',
    ],
    jawHidden: 'Part of the jawline was not clearly visible (for example hair, beard or shadow) and was not assessed.',
    none: 'No distinct spot candidates stood out from the surrounding skin.',
    mostRed: 'Most are red-toned',
    mostDark: 'Most are darker-toned',
    mixed: 'They are a mix of red-toned and darker',
    summary: (tones, region) => (region ? `${tones} and most are on the ${region}.` : `${tones}.`),
    failed: 'Spot candidates could not be analysed for this photo.',
    disabled: 'Spot-candidate analysis is switched off.',
  },
  pores: {
    scale:
      'Pore-visibility index 0–100: how visible pores are in this photo (appearance estimate, not a measurement of pore size).',
    limitations: [
      'This is an appearance estimate from one photo. It does not measure pore size, oil production or skin health.',
      'Lighting, camera sharpness, make-up and distance from the camera change how visible pores look.',
    ],
    tooFar: 'Pores are tiny: a closer photo, with your face filling more of the frame, is needed to see them.',
    notSharp: 'The photo is not sharp enough to see pores.',
    grainy: 'The photo is too grainy (often from dim light) to tell pores apart from camera noise.',
    smoothed: 'Smoothing or editing in the photo hides pores.',
    notEnoughArea: 'Not enough clear skin on the nose, forehead and upper cheeks was visible.',
    unreliable: 'Pore visibility could not be estimated reliably from this photo.',
    notEnoughSkin: 'Not enough clear skin was visible to estimate pores.',
    conditions: 'The photo conditions did not allow a reliable pore estimate.',
    conditionsHelp: 'A sharp, close photo in even light is needed to estimate pore visibility.',
    level: (s) =>
      s < 25
        ? 'Few pores were visible'
        : s < 50
          ? 'Some pores were visible'
          : s < 75
            ? 'Pores were noticeably visible'
            : 'Many clearly visible pores were seen',
    where: { nose: 'the nose', forehead: 'the forehead', cheeks: 'the cheeks' },
    summary: (level, where) => `${level} at this photo's level of detail${where ? `, mostly on ${where}` : ''}.`,
    failed: 'Pore visibility could not be analysed for this photo.',
    disabled: 'Pore analysis is switched off.',
  },
  severityScale:
    'Four levels on the Hayashi count bands — level0 none or minimal (≤5 inflammatory-looking spots per half face), level1 mild (6–20), level2 moderate (21–50), level3 severe (>50). An experimental estimate from the photo, not a clinical grade.',
  skinAge: {
    summary: (min, max, pct) =>
      `In this photo, your skin and face look about ${max === null ? `${min} or older` : `${min}–${max}`} years old (the AI model gives this a ${pct}% probability).`,
    limitations: [
      'This is how old the face looks in this photo, estimated by an AI model — not your real age and not a biological or medical measurement.',
      'The model looks at the whole face, so features such as facial hair, hairline, make-up and expression also play a part, as do lighting and camera.',
      'On its published test set (10,000 faces) the model picked the right 10-year range about 6 times in 10; when it is wrong it is usually one range off.',
    ],
    failed: 'Skin age could not be estimated for this photo.',
    disabled: 'Skin age estimation is switched off.',
    notConfigured: 'Skin age estimation is not available at the moment.',
  },
  skinType: {
    summary: (type, shineScore) =>
      `Glamour AI classifies overall facial pattern as ${type} skin type${shineScore !== null ? ` (surface shine reflection measured at ${shineScore}/100)` : ''}.`,
    notConfigured: 'Glamour AI skin-type model weights not configured; visible specular shine is evaluated directly.',
    failed: 'Skin type classification could not be computed for this photo.',
    disabled: 'Skin type classification is disabled.',
    limitations: [
      'The Glamour AI model classifies general facial skin pattern into three classes: dry, normal, and oily.',
      'This output represents photographic appearance classification, not a direct clinical measurement of active sebum excretion.',
      'Surface shine reflects specular lighting highlights and is analyzed distinctly from underlying biological skin type.',
    ],
  },
  skinToneUniformity: {
    summary: (score, band, tone) => {
      if (score === null) {
        return 'Skin-tone uniformity could not be reliably compared across facial zones in this photo.';
      }
      const bandDesc =
        band === 'high'
          ? 'highly uniform and balanced across facial zones'
          : band === 'moderate'
            ? 'moderately uniform with natural subtle transitions between zones'
            : 'exhibiting localized tone variation across facial zones';
      if (tone) {
        return `Detected skin tone: ${tone.toneLabel} (${tone.fitzpatrickLabel}, ${tone.monk.name}, ITA ${tone.ita}°) with a ${tone.undertone} undertone. Skin-tone uniformity scored ${score}/100 (${bandDesc}).`;
      }
      return `Skin-tone uniformity scored ${score}/100 (${band === 'high' ? 'highly even' : band === 'moderate' ? 'moderately even' : 'localized variation'}).`;
    },
    insufficientQuality: 'Uneven side-lighting, harsh shadows, or highlight clipping prevented an accurate regional color comparison.',
    failed: 'Skin-tone uniformity analysis could not be computed.',
    disabled: 'Skin-tone uniformity analysis is switched off.',
    limitations: [
      'Uniformity is calculated by comparing CIELAB color distributions across segmented forehead, cheeks, nose, and chin skin.',
      'Directional illumination and shadows can increase apparent tone disparity independent of intrinsic pigmentation.',
      'This is an image-based appearance estimate and does not constitute a clinical diagnosis of hyperpigmentation or melasma.',
    ],
  },
};

const ar: AnalysisText = {
  regions: {
    forehead: 'الجبهة',
    nose: 'الأنف',
    cheeks: 'الخدين',
    chin: 'الذقن',
    underEyes: 'منطقة تحت العينين',
    jawline: 'خط الفك',
  },
  // Arabic "and" attaches to the next word: "الجبهة والأنف والخدين".
  joinList: (names) => names.join(' و'),
  analysedSkin: 'البشرة التي تم تحليلها',
  templates: {
    pigmentation: {
      minimal: () => 'بدا لون البشرة متجانسًا في المناطق التي تم تحليلها، مع قليل من البقع الأغمق.',
      mild: (w) => `ظهرت بعض المناطق الصغيرة أغمق قليلًا من البشرة المحيطة بها، خاصةً على ${w}.`,
      moderate: (w) => `ظهرت عدة مناطق أغمق بشكل واضح من البشرة المحيطة بها، وأوضحها على ${w}.`,
      pronounced: (w) => `ظهرت بقع أغمق بوضوح مقارنةً بالبشرة المحيطة بها، خاصةً على ${w}.`,
    },
    redness: {
      minimal: () => 'لم يبرز احمرار يُذكر عن لون بشرتك العام.',
      mild: (w) => `بدت بعض المناطق أكثر احمرارًا قليلًا من بقية بشرتك، خاصةً على ${w}.`,
      moderate: (w) => `ظهر احمرار مقارنةً ببقية بشرتك، وأوضحه على ${w}.`,
      pronounced: (w) => `ظهر احمرار واضح مقارنةً ببقية بشرتك، خاصةً على ${w}.`,
    },
    texture: {
      minimal: () => 'بدا سطح البشرة ناعمًا في هذه الصورة.',
      mild: (w) => `ظهر ملمس دقيق على سطح البشرة، خاصةً على ${w}.`,
      moderate: (w) => `ظهر ملمس سطح البشرة (عدم استواء دقيق في الجلد)، وأوضحه على ${w}.`,
      pronounced: (w) => `ظهر ملمس سطح البشرة بوضوح على ${w}.`,
    },
    blemishes: {
      minimal: () => 'لم تبرز بقع أو علامات واضحة عن البشرة المحيطة.',
      mild: (w, t) => `ظهرت بضع بقع واضحة${t}، خاصةً على ${w}.`,
      moderate: (w, t) => `ظهرت عدة بقع أو علامات واضحة${t}، وأوضحها على ${w}.`,
      pronounced: (w, t) => `ظهرت بقع أو علامات واضحة كثيرة${t}، خاصةً على ${w}.`,
    },
    shine: {
      minimal: () => 'ظهر قليل من لمعان سطح البشرة في هذه الإضاءة.',
      mild: (w) => `ظهر لمعان خفيف، خاصةً على ${w}.`,
      moderate: (w) => `ظهر لمعان ملحوظ، معظمه على ${w}.`,
      pronounced: (w) => `ظهر لمعان قوي، خاصةً على ${w}.`,
    },
    underEye: {
      minimal: () => 'بدت منطقة تحت العينين قريبة في لونها من بشرة الخد المجاورة.',
      mild: (_, u) => `بدت منطقة تحت العينين أغمق قليلًا${u} من بشرة الخد المجاورة.`,
      moderate: (_, u) => `بدت منطقة تحت العينين أغمق بشكل واضح${u} من بشرة الخد المجاورة.`,
      pronounced: (_, u) => `بدت منطقة تحت العينين أغمق بوضوح${u} من بشرة الخد المجاورة.`,
    },
  },
  mostlyRed: '، معظمها مائل إلى الاحمرار',
  mostlyDark: '، معظمها أغمق لونًا',
  cooler: ' وأبرد لونًا',
  warmer: ' وأدفأ لونًا',
  shineNote: ' يعتمد اللمعان بدرجة كبيرة على الإضاءة وقت التقاط الصورة.',
  underEyeNote: ' قد تجعل الإضاءة العلوية هذه المنطقة تبدو أغمق.',
  insufficient: {
    low_resolution: 'لم تكن تفاصيل الصورة كافية لقياس ذلك بدقة. قد تسمح صورة أقرب وأوضح بقياسه.',
    not_enough_skin: 'لم يظهر قدر كافٍ من البشرة الواضحة في المناطق المعنية لقياس ذلك بدقة.',
    not_visible: 'لم تكن هذه المنطقة واضحة في الصورة.',
    low_confidence: 'لم تسمح ظروف التصوير بقياس موثوق. قد تساعد إضاءة أقوى ومتساوية وصورة واضحة.',
    expression:
      'الابتسامة تُحدث ثنيات في الخدين تبدو كبشرة أغمق أو ذات ملمس. نحتاج إلى صورة بتعبير وجه هادئ ومحايد لقياس ذلك.',
  },
  quality: {
    no_face: 'لم نتمكن من العثور على وجه في هذه الصورة. يُرجى التقاط صورة وأنت تنظر مباشرةً إلى الكاميرا.',
    multiple_faces: 'يظهر أكثر من وجه في الصورة. يُرجى التقاط صورة يظهر فيها وجهك فقط.',
    face_too_small: 'وجهك صغير جدًا في الصورة. يُرجى الاقتراب حتى يملأ وجهك الإطار البيضاوي.',
    face_cropped: 'جزء من وجهك خارج الصورة. يُرجى وضع وجهك بالكامل في منتصف الإطار.',
    face_angle: 'يُرجى النظر مباشرةً إلى الكاميرا مع إبقاء رأسك مستقيمًا دون التفات أو ميل.',
    blurry: 'الصورة غير واضحة. يُرجى تثبيت الكاميرا والتأكد من تركيزها على وجهك.',
    too_dark: 'الصورة مظلمة جدًا. يُرجى إعادة التصوير في إضاءة أقوى ومتساوية مع مواجهة نافذة أو مصدر ضوء.',
    too_bright: 'الصورة ساطعة أكثر من اللازم. يُرجى تجنّب الفلاش المباشر أو الضوء القوي وإعادة التصوير في إضاءة ناعمة ومتساوية.',
    uneven_lighting: 'أحد جانبي وجهك أغمق بكثير من الآخر. يُرجى مواجهة الضوء حتى يقع بالتساوي على وجهك.',
    filter_detected:
      'تبدو الصورة معدّلة أو عليها فلتر (مثل التنعيم أو زيادة الحدّة أو تأثيرات HDR). يُرجى إعادة التصوير مع إيقاف الفلاتر والتأثيرات.',
    not_color: 'يُرجى استخدام صورة ملوّنة دون فلاتر أبيض وأسود أو فلاتر ألوان.',
    sunglasses: 'يُرجى خلع النظارة الشمسية وإعادة التقاط الصورة.',
    glasses: 'يُرجى خلع النظارة حتى تظهر البشرة حول العينين، ثم إعادة التقاط الصورة.',
    face_obstructed: 'جزء من وجهك مغطّى. يُرجى إبعاد الشعر أو اليدين أو أي غطاء عن وجهك.',
    insufficient_skin: 'لا يظهر قدر كافٍ من بشرة الوجه للتحليل. يُرجى إرجاع الشعر للخلف والنظر مباشرةً إلى الكاميرا.',
  },
  errors: {
    unauthenticated: 'يُرجى تسجيل الدخول إلى حسابك في عيادات د. ماهر محمود لإجراء فحص البشرة.',
    invalid_request: 'يُرجى اختيار صورة للفحص.',
    unsupported_type: 'نوع الملف غير مدعوم. يُرجى استخدام صورة بصيغة JPG أو PNG أو WebP.',
    file_too_large: 'حجم الصورة كبير جدًا. يُرجى استخدام صورة أصغر من الحد المسموح.',
    image_unreadable: 'لم نتمكن من قراءة هذه الصورة. يُرجى تجربة صورة أخرى.',
    image_quality: 'يُرجى إعادة التقاط الصورة في إضاءة أقوى ومتساوية مع النظر مباشرةً إلى الكاميرا.',
    rate_limited: 'لقد أجريت عدة فحوصات في وقت قصير. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.',
    busy: 'الفحص مشغول الآن. يُرجى المحاولة مرة أخرى بعد قليل.',
    timeout: 'استغرق التحليل وقتًا أطول من اللازم. يُرجى المحاولة مرة أخرى، ويُفضَّل بصورة أصغر.',
    analysis_failed: 'حدث خطأ أثناء تحليل الصورة. يُرجى المحاولة مرة أخرى.',
  },
  notes: {
    uneven_side_light: 'كان أحد جانبي وجهك مُضاءً أكثر من الآخر.',
    partly_covered: 'كانت بعض المناطق مغطّاة (بالشعر مثلًا) ولم يتم تحليلها.',
    low_resolution: 'حدّت دقة الصورة من قياس التفاصيل الدقيقة مثل ملمس البشرة.',
    smiling: 'الابتسامة تُحدث ثنيات في الجلد قد تؤثر على بعض النتائج؛ تعبير الوجه المحايد يعطي أدق فحص.',
  },
  acne: {
    limitations: [
      'تُكتشف البقع المرشّحة من اللون والتباين. وهي ليست خاصة بحب الشباب، وقد تشمل النمش أو الشامات أو علامات أخرى.',
      'وصف البقعة بأنها "مائلة إلى الاحمرار" أو "أغمق لونًا" وصف بصري فقط ولا يحدد طبيعتها. طبيب الجلدية وحده يمكنه تحديد نوع الآفات.',
      'الأعداد تقريبية وتعتمد على الإضاءة والكاميرا والمسافة.',
    ],
    jawHidden: 'لم يظهر جزء من خط الفك بوضوح (بسبب الشعر أو اللحية أو الظل مثلًا) ولم يتم تقييمه.',
    none: 'لم تبرز بقع مرشّحة واضحة عن البشرة المحيطة.',
    mostRed: 'معظمها مائل إلى الاحمرار',
    mostDark: 'معظمها أغمق لونًا',
    mixed: 'وهي مزيج من بقع مائلة إلى الاحمرار وأخرى أغمق لونًا',
    summary: (tones, region) => (region ? `${tones}، ومعظمها على ${region}.` : `${tones}.`),
    failed: 'تعذّر تحليل البقع المرشّحة في هذه الصورة.',
    disabled: 'تحليل البقع المرشّحة متوقف.',
  },
  pores: {
    scale: 'مؤشر وضوح المسام من 0 إلى 100: مدى وضوح المسام في هذه الصورة (تقدير للمظهر، وليس قياسًا لحجم المسام).',
    limitations: [
      'هذا تقدير للمظهر من صورة واحدة، ولا يقيس حجم المسام أو إفراز الدهون أو صحة البشرة.',
      'الإضاءة ووضوح الكاميرا والمكياج والمسافة من الكاميرا تغيّر مدى وضوح المسام.',
    ],
    tooFar: 'المسام صغيرة جدًا: نحتاج إلى صورة أقرب يملأ فيها وجهك جزءًا أكبر من الإطار لرؤيتها.',
    notSharp: 'الصورة ليست واضحة بما يكفي لرؤية المسام.',
    grainy: 'في الصورة تشويش كبير (غالبًا بسبب الإضاءة الخافتة) يمنع تمييز المسام عن تشويش الكاميرا.',
    smoothed: 'التنعيم أو التعديل في الصورة يُخفي المسام.',
    notEnoughArea: 'لم يظهر قدر كافٍ من البشرة الواضحة على الأنف والجبهة وأعلى الخدين.',
    unreliable: 'تعذّر تقدير وضوح المسام بشكل موثوق من هذه الصورة.',
    notEnoughSkin: 'لم يظهر قدر كافٍ من البشرة الواضحة لتقدير المسام.',
    conditions: 'لم تسمح ظروف التصوير بتقدير موثوق للمسام.',
    conditionsHelp: 'نحتاج إلى صورة واضحة وقريبة في إضاءة متساوية لتقدير وضوح المسام.',
    level: (s) =>
      s < 25 ? 'ظهرت مسام قليلة' : s < 50 ? 'ظهرت بعض المسام' : s < 75 ? 'ظهرت المسام بشكل ملحوظ' : 'ظهرت مسام كثيرة وواضحة',
    where: { nose: 'الأنف', forehead: 'الجبهة', cheeks: 'الخدين' },
    summary: (level, where) => `${level} بمستوى التفاصيل في هذه الصورة${where ? `، معظمها على ${where}` : ''}.`,
    failed: 'تعذّر تحليل وضوح المسام في هذه الصورة.',
    disabled: 'تحليل المسام متوقف.',
  },
  severityScale:
    'أربعة مستويات حسب فئات العدّ في مقياس هاياشي: المستوى 0 لا يوجد أو بسيط جدًا (5 بقع أو أقل تبدو ملتهبة في نصف الوجه)، المستوى 1 خفيف (6–20)، المستوى 2 متوسط (21–50)، المستوى 3 شديد (أكثر من 50). تقدير تجريبي من الصورة، وليس تقييمًا طبيًا.',
  skinAge: {
    summary: (min, max, pct) =>
      `في هذه الصورة، تبدو بشرتك ووجهك بعمر ${max === null ? `${min} سنة أو أكثر` : `${min}–${max} سنة`} تقريبًا (يعطي نموذج الذكاء الاصطناعي هذا التقدير احتمالًا بنسبة ${pct}٪).`,
    limitations: [
      'هذا هو العمر الذي يبدو عليه الوجه في هذه الصورة كما يقدّره نموذج ذكاء اصطناعي — وليس عمرك الحقيقي ولا قياسًا بيولوجيًا أو طبيًا.',
      'ينظر النموذج إلى الوجه كله، لذلك تؤثر أيضًا ملامح مثل شعر الوجه وخط الشعر والمكياج وتعبير الوجه، وكذلك الإضاءة والكاميرا.',
      'في مجموعة الاختبار المنشورة (10,000 وجه) اختار النموذج الفئة العمرية الصحيحة (10 سنوات) في نحو 6 من كل 10 مرات، وعندما يخطئ يكون الفرق غالبًا فئة واحدة.',
    ],
    failed: 'تعذّر تقدير عمر البشرة في هذه الصورة.',
    disabled: 'تقدير عمر البشرة متوقف.',
    notConfigured: 'تقدير عمر البشرة غير متاح حاليًا.',
  },
  skinType: {
    summary: (type, shineScore) =>
      `يصنّف نموذج Glamour AI النمط العام لبشرة الوجه كبشرة ${type === 'dry' ? 'جافة' : type === 'oily' ? 'دهنية' : 'عادية'}${shineScore !== null ? ` (مع لمعان سطحي مسجل بدرجة ${shineScore}/100)` : ''}.`,
    notConfigured: 'لم يتم تكوين أوزان نموذج Glamour AI؛ يتم تقييم اللمعان السطحي الانعكاسي مباشرة من الصورة.',
    failed: 'تعذّر تصنيف نوع البشرة في هذه الصورة.',
    disabled: 'تصنيف نوع البشرة متوقف.',
    limitations: [
      'يصنّف نموذج Glamour AI المظهر العام للوجه إلى ثلاث فئات: جافة، عادية، ودهنية.',
      'هذه النتيجة هي تصنيف لمظهر الصورة الفوتوغرافية وليست قياسًا طبيًا مباشرًا لمعدل إفراز الدهون الحقيقي.',
      'اللمعان السطحي يعكس انعكاسات الإضاءة الموضعية ويتم تحليله بشكل منفصل عن نوع البشرة البيولوجي.',
    ],
  },
  skinToneUniformity: {
    summary: (score, band, tone) => {
      if (score === null) {
        return 'تعذّرت المقارنة الدقيقة لتجانس لون البشرة عبر مناطق الوجه في هذه الصورة.';
      }
      const bandDesc =
        band === 'high'
          ? 'بشرة موحدة ومتجانسة بدرجة عالية عبر مختلف مناطق الوجه'
          : band === 'moderate'
            ? 'تجانس معتدل مع تباينات لونية طبيعية طفيفة بين الجبهة والوجنتين والذقن'
            : 'تفاوت موضعي ملحوظ في درجات اللون بين مناطق الوجه';
      if (tone) {
        return `درجة البشرة المكتشفة: ${tone.toneLabel} (${tone.fitzpatrickLabel}، ${tone.monk.name}، زاوية ITA: ${tone.ita}°) بمسحة ${tone.undertoneLabel}. سجّل مؤشر التجانس ${score}/100 (${bandDesc}).`;
      }
      return `سجّل مؤشر تجانس لون البشرة ${score}/100 (${band === 'high' ? 'تجانس ممتاز' : band === 'moderate' ? 'تجانس معتدل' : 'تباين موضعي ملحوظ'}).`;
    },
    insufficientQuality: 'حالت الإضاءة الجانبية غير المتساوية أو الظلال الشديدة دون إجراء مقارنة لونية دقيقة وموثوقة.',
    failed: 'تعذّر احتساب تجانس لون البشرة.',
    disabled: 'تحليل تجانس لون البشرة متوقف.',
    limitations: [
      'يُحسب التجانس من خلال مقارنة التوزيع اللوني في فضاء CIELAB عبر مناطق الجبهة والخدين والأنف والذقن المستقطعة.',
      'الإضاءة الجانبية والظلال تزيد من الفروق اللونية الظاهرة دون أن تكون ناتجة عن تصبغات حقيقية في الجلد.',
      'هذا التقييم وصفي لمظهر الصورة ولا يشكل تشخيصًا طبيًا للتصبغات أو الكلف أو الأمراض الجلدية.',
    ],
  },
};

const TEXT: Record<Locale, AnalysisText> = { en, ar };

export function analysisText(locale: Locale = 'en'): AnalysisText {
  return TEXT[locale] ?? en;
}
