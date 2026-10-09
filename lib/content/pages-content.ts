import type { Locale } from '@/lib/i18n';

export interface PageBreadcrumb {
  name: string;
  path: string;
}

export interface ContentSection {
  title: string;
  lead?: string;
  paragraphs: string[];
  bulletPoints?: string[];
  callout?: {
    type: 'info' | 'tip' | 'clinical' | 'privacy';
    title: string;
    text: string;
  };
}

export interface ContentFaq {
  question: string;
  answer: string;
}

export interface EducationalPageData {
  slug: string;
  badge: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  reviewer: string;
  breadcrumbs: PageBreadcrumb[];
  sections: ContentSection[];
  faqs?: ContentFaq[];
  relatedTopics?: Array<{ title: string; path: string; description: string }>;
}

export const ABOUT_CONTENT: Record<Locale, EducationalPageData> = {
  en: {
    slug: '/about',
    badge: 'Clinic & Medical AI',
    title: 'About Dr. Maher Mahmoud Clinics & Vision AI',
    subtitle: 'Combining 15+ years of clinical dermatology excellence with ethical, privacy-first computer vision technology.',
    lastUpdated: 'October 2026',
    reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
    ],
    sections: [
      {
        title: 'The Dr Maher Vision AI Initiative',
        paragraphs: [
          'In modern digital dermatology, commercial applications often rely on synthetic filters or black-box neural networks that hallucinate exaggerated skin flaws to sell cosmetics. Dr Maher Mahmoud initiated this project with a radically different mandate: uncompromising scientific honesty, local data privacy, and mathematical transparency.',
          'Dr Maher Vision AI v3.5 operates entirely on validated computer vision methods. It distinguishes visible skin characteristics from clinical medical diagnoses, clearly delineates 24 anatomical facial regions, and evaluates image quality before calculating any score.',
        ],
        callout: {
          type: 'privacy',
          title: 'The Zero-Storage Privacy Pledge',
          text: 'Your facial photos are never saved to disk, never stored in databases, and never transmitted to third-party cloud vision APIs. Every photo is decoded in volatile server RAM, measured locally using on-premise ONNX Runtime, and instantly discarded.',
        },
      },
      {
        title: 'Ethical & Non-Diagnostic Principles',
        paragraphs: [
          'SkinScan is designed as an educational and informational tool, not a medical diagnostic device. It does not diagnose cutaneous diseases, skin cancers, melasma, or systemic disorders.',
          'When image conditions are sub-optimal — such as inadequate lighting, heavy motion blur, or insufficient camera resolution — the engine refuses to guess. Instead, it provides actionable guidance on how to take a proper clinical-grade photograph.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Who developed Dr Maher Vision AI?',
        answer: 'The system was conceptualized and medically guided by Dr. Maher Mahmoud, Consultant Dermatologist, and engineered by a dedicated computer vision and machine learning engineering team.',
      },
      {
        question: 'Does SkinScan replace a consultation with Dr. Maher?',
        answer: 'No. SkinScan is an educational tool that highlights visible surface characteristics. For an accurate medical diagnosis, personalized treatment plan, or prescription therapies, an in-person clinical consultation is essential.',
      },
      {
        question: 'How do you ensure fairness across diverse skin tones?',
        answer: 'Dr Maher Vision AI v3.5 was rigorously calibrated and benchmarked across all Fitzpatrick phototypes (I through VI) and Monk Skin Tone categories, utilizing tone-adaptive delta thresholds and illuminance-invariant color representations.',
      },
    ],
  },
  ar: {
    slug: '/about',
    badge: 'العيادة والذكاء الاصطناعي الطبي',
    title: 'عن عيادات د. ماهر محمود وتقنية الذكاء الاصطناعي',
    subtitle: 'نجمع بين أكثر من 15 عامًا من الخبرة الإكلينيكية في طب الجلدية وتكنولوجيا الرؤية الحاسوبية الأخلاقية المرتكزة على الخصوصية.',
    lastUpdated: 'أكتوبر 2026',
    reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
    breadcrumbs: [
      { name: 'الرئيسية', path: '/' },
      { name: 'عن العيادة', path: '/about' },
    ],
    sections: [
      {
        title: 'مبادرة Dr Maher Vision AI',
        paragraphs: [
          'في عالم تطبيقات العناية بالبشرة الحديثة، تعتمد الكثير من البرامج التجارية على فلاتر تجميلية أو شبكات عصبية غامضة تبالغ في إظهار عيوب البشرة لترويج المستحضرات. وجّه الدكتور ماهر محمود بتطوير هذا النظام وفق معايير مغايرة تمامًا: الأمانة العلمية المطلقة، حماية الخصوصية التامة، والشفافية الحسابية.',
          'يعمل محرك Dr Maher Vision AI v3.5 بنماذج رؤية حاسوبية محلية وموثوقة تفصل بدقة بين الخصائص الظاهرية للبشرة والتشخيص الطبي، وتقسم الوجه تشريحيًا إلى 24 منطقة مستقلة.',
        ],
        callout: {
          type: 'privacy',
          title: 'تعهد الخصوصية: صفر تخزين للصور',
          text: 'صور وجهك لا تُحفظ أبدًا على أي وسائط تخزين، ولا تُخزن في قواعد بيانات، ولا تُرسل لأي واجهات سحابية خارجية. تُعالج الصورة بالكامل في الذاكرة المؤقتة لخوادمنا وتُمسح فور الانتهاء من استخراج المقاييس.',
        },
      },
      {
        title: 'مبادئ الشفافية والمسؤولية الطبية',
        paragraphs: [
          'صُمم SkinScan كأداة استرشادية وتثقيفية، وليس كبديل عن الفحص الطبي المتخصص. النظام لا يشخص الأمراض الجلدية السريرية مثل الأكزيما، أو أورام الجلد، أو الأمراض المناعية.',
          'عندما تكون ظروف الصورة غير مثالية — كالإضاءة الضعيفة أو الاهتزاز أو نقص الدقة — يمتنع المحرك عن التخمين العشوائي، ويرشدك بلطف إلى كيفية التقاط صورة فوتوغرافية متوافقة مع متطلبات التحليل.',
        ],
      },
    ],
    faqs: [
      {
        question: 'من قام بتطوير نظام Dr Maher Vision AI؟',
        answer: 'تم ابتكار النظام وتحديده طبيًا بإشراف الدكتور ماهر محمود، استشاري الأمراض الجلدية، بالتعاون مع فريق هندسي متخصص في الرؤية الحاسوبية والذكاء الاصطناعي.',
      },
      {
        question: 'هل يغني الفحص عن زيارة عيادة د. ماهر محمود؟',
        answer: 'كلا. الفحص أداة توجيهية ترصد الخصائص السطحية للوجه. للتشخيص الطبي الدقيق ووصف العلاجات الدوائية أو الإجراءات الإكلينيكية، ينبغي استشارة الطبيب شخصيًا.',
      },
      {
        question: 'كيف يضمن النظام العدالة وملاءمة درجات البشرة المختلفة؟',
        answer: 'تمت معايرة واختبار محرك Dr Maher Vision AI v3.5 على كافة أنواع البشرة بمقياس فيتزباتريك (من النوع الأول حتى السادس) وفئات مونك، مع استخدام عتبات متكيفة مع لون البشرة الطبيعي لضمان نتائج متسقة وعادلة.',
      },
    ],
  },
};

export const HOW_IT_WORKS_CONTENT: Record<Locale, EducationalPageData> = {
  en: {
    slug: '/how-it-works',
    badge: 'Computer Vision Architecture',
    title: 'How It Works — The 13-Stage Vision AI Pipeline',
    subtitle: 'A transparent, step-by-step breakdown of how Dr Maher Vision AI v3.5 processes facial photographs with zero hallucination.',
    lastUpdated: 'October 2026',
    reviewer: 'Dr. Maher Mahmoud Clinics Engineering Team',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'How It Works', path: '/how-it-works' },
    ],
    sections: [
      {
        title: 'Stage 1–3: Image Ingestion, Exposure Gating & Face Localization',
        paragraphs: [
          'When you capture or upload a photograph, the server ingests the raw image into volatile memory via Sharp. Linear sRGB color conversion is performed without compression loss. Before running any facial analysis, Stage 2 conducts pre-flight quality checks: measuring mean illuminance, over-exposure clipping (>250), crushed shadows (<15), and Laplacian gradient sharpness.',
          'Once illumination passes, Stage 3 executes MediaPipe BlazeFace (a single-shot multi-box detector optimized for mobile selfies) to pinpoint the face bounding box and 6 key anchor coordinates. If multiple faces or no face are found, the scan halts immediately.',
        ],
      },
      {
        title: 'Stage 4–6: 478 Landmark Regression, Expression Check & Alignment',
        paragraphs: [
          'Stage 4 feeds the normalized face crop into the MediaPipe Face Mesh V2 model, extracting 478 3D facial landmarks with sub-millimeter precision, including dense eyelid, eyebrow, nasal, lip, and iris boundaries.',
          'Stage 5 evaluates facial expression and facial muscle tension. By computing eye openness ratios, mouth aspect ratio (MAR), and lip corner displacement, the engine verifies whether the subject is holding a neutral expression. Excessive smiling or squinting causes skin folding that mimics premature wrinkles; if detected, the scan instructs the user to relax facial muscles.',
          'Stage 6 applies Procrustes similarity transformation to rotate and scale the face to canonical frontal alignment with standard Interocular Distance (63mm standard human average).',
        ],
      },
      {
        title: 'Stage 7–8: Multi-Class Segmentation Veto & 24 Anatomical Regions',
        paragraphs: [
          'Stage 7 employs MediaPipe Selfie Multiclass Segmentation to distinguish hair, clothing, background, and eyeglasses. Crucially, Dr Maher Vision AI v3.5 implements a "veto architecture": non-skin elements are masked out, while skin boundaries are derived geometrically from landmark contours, preventing false erosion on dark Fitzpatrick skin tones.',
          'Stage 8 constructs 24 canonical, mutually exclusive anatomical facial regions (Forehead, Glabella, Cheeks, Periorbital zones, Nasolabial folds, Chin, etc.). Priority-based polygon clipping guarantees exactly zero pixel overlap between adjacent regions.',
        ],
        callout: {
          type: 'clinical',
          title: 'Zero Overlap Guarantee',
          text: 'Every pixel of facial skin belongs to exactly one anatomical region. A blemish on the upper cheek is never double-counted in the lower cheek or infraorbital zone.',
        },
      },
      {
        title: 'Stage 9–13: Quality Gating, Multi-Scale Feature Extraction & Synthesis',
        paragraphs: [
          'In Stage 9, each individual region undergoes independent quality assessment: local sharpness, exposure clipping, signal-to-noise ratio, and physical resolution in pixels per millimeter (px/mm).',
          'Stages 10 and 11 compute spatial features: single-pass multiscale Difference-of-Gaussians (DoG) bandpass filters detect circular spots, while Hessian eigenvalue curvature matrices verify roundness. Pigmentation is measured via localized CIE L*a*b* delta, erythema via illumination-normalized a* channels, and shine via specular luminance reflection.',
          'Stages 12 and 13 aggregate regional measurements into area-weighted overall scores and generate a deterministic, bilingual clinical report.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Why doesn’t Dr Maher Vision AI use generative AI (LLMs/Diffusion) to guess skin conditions?',
        answer: 'Generative models hallucinate plausible-looking details that do not exist in reality. For a medical clinic, hallucination is dangerous. We rely solely on deterministic, explainable computer vision signal processing.',
      },
      {
        question: 'How fast is the 13-stage pipeline?',
        answer: 'Thanks to single-pass whole-face filtering and cached Gaussian convolutions (getCachedBlur), the entire 13-stage pipeline runs in under 1.8 seconds on standard server CPUs.',
      },
    ],
  },
  ar: {
    slug: '/how-it-works',
    badge: 'معمارية الرؤية الحاسوبية',
    title: 'كيف يعمل الفحص — مسار الذكاء الاصطناعي ذو 13 مرحلة',
    subtitle: 'شرح مفصل وموثق خطوة بخطوة لكيفية معالجة Dr Maher Vision AI v3.5 لصور الوجه دون أي اختلاق أو تزييف.',
    lastUpdated: 'أكتوبر 2026',
    reviewer: 'الفريق الهندسي لعيادات د. ماهر محمود',
    breadcrumbs: [
      { name: 'الرئيسية', path: '/' },
      { name: 'كيف يعمل', path: '/how-it-works' },
    ],
    sections: [
      {
        title: 'المراحل 1–3: استقبال الصورة، فحص الإضاءة وتحديد الوجه',
        paragraphs: [
          'عند التقاط الصورة أو رفعها، يستقبل الخادم بيانات الصورة في الذاكرة المؤقتة عبر محرك Sharp مع تحويل لوني خطي دقيق. قبل أي فحص، تنفذ المرحلة الثانية فحوصات صارمة لجودة الصورة: قياس متوسط الإضاءة، منع احتراق الإضاءة البيضاء (>250) أو تعتيم الظلال (<15)، وقياس حدة التدرجات لمنع الصور المهتزة.',
          'عقب اجتياز شروط الإضاءة، تشغل المرحلة الثالثة نموذج MediaPipe BlazeFace لرصد إطار الوجه و6 نقاط مرجعية رئيسية. في حال وجود وجوه متعددة أو عدم وضوح الوجه، يتوقف الفحص فورًا لحماية دقة النتائج.',
        ],
      },
      {
        title: 'المراحل 4–6: استخراج 478 نقطة تشريحية، ضبط التعبيرات والمحاذاة',
        paragraphs: [
          'تغذي المرحلة الرابعة الوجه المستقطع إلى نموذج MediaPipe Face Mesh V2 لاستخراج 478 نقطة ثلاثية الأبعاد بدقة تحت المليمترية تشمل تفاصيل الجفون، الحواجب، الأنف، الشفاه، ومحيط قزحية العين.',
          'تقيم المرحلة الخامسة انقباض عضلات الوجه؛ فإذا كان الشخص يبتسم بقوة أو يغمض عينيه، يؤدي ذلك إلى طيات جلدية مؤقتة تحاكي التجاعيد المبكرة. عند رصد ذلك، يطلب النظام بلطف استرخاء عضلات الوجه.',
          'تطبق المرحلة السادسة محاذاة هندسية دقيقة لتدوير الوجه إلى الوضعية الأمامية القياسية مع توحيد المسافة بين العينين (63 ملم كمتوسط بشري قياسي).',
        ],
      },
      {
        title: 'المراحل 7–8: عزل الشعر والنظارات وتقسيم 24 منطقة تشريحية',
        paragraphs: [
          'تستخدم المرحلة السابعة نموذج MediaPipe Selfie Multiclass لعزل الشعر والملابس والنظارات والخلفية، مع الحفاظ على حدود البشرة المستخرجة من النقاط التشريحية لحماية أصحاب البشرة الداكنة من التآكل الخاطئ للحواف.',
          'تقسم المرحلة الثامنة الوجه إلى 24 منطقة تشريحية قانونية مستقلة (الجبهة، الخدود، محيط العينين، طيات الأنف والشفاه، الذقن، إلخ)، مع تطبيق أسبقية هندسية تضمن صفر بكسل تداخل بين المناطق المتجاورة.',
        ],
        callout: {
          type: 'clinical',
          title: 'ضمان عدم تداخل المناطق',
          text: 'كل بكسل من بشرة الوجه ينتمي لمنطقة تشريحية واحدة فقط. لا يمكن أن تُحسب بقعة في أعلى الخد مرتين في منطقة الخد السفلي أو تحت العين.',
        },
      },
      {
        title: 'المراحل 9–13: الفحص الموضعي، استخراج الخصائص وإصدار التقرير',
        paragraphs: [
          'في المرحلة التاسعة، تخضع كل منطقة لتقييم جودة مستقل: الحدة الموضعية، نسبة الإشارة إلى التشويش، والدقة البصرية بالبكسل لكل مليمتر.',
          'تستخرج المرحلتان العاشرة والحادية عشرة المقاييس عبر مرشحات الفرق بين غاوسيان (DoG) متعددة النطاقات لرصد البقع، مع مصفوفة هيسي للتأكد من الاستدارة. ويُقاس التصبغ بفروق الفضاء اللوني CIE L*a*b*، والاحمرار عبر قناة a* المعايرة، واللمعان برصد الانعكاسات البصرية.',
          'تجمع المرحلتان الثانية عشرة والثالثة عشرة القياسات وترجحها بالمساحة لإصدار تقرير ثنائي اللغة فوري وموثوق.',
        ],
      },
    ],
    faqs: [
      {
        question: 'لماذا لا يستخدم النظام نماذج توليدية (Generative AI) لتخمين مشاكل البشرة؟',
        answer: 'النماذج التوليدية تختلق تفاصيل غير موجودة بالواقع (Hallucinations). في المجال الطبي لعيادات الجلدية، هذا غير مقبول علميًا. نحن نعتمد حصرًا على معالجة الإشارات والرؤية الحاسوبية القطعية والقابلة للتفسير.',
      },
      {
        question: 'ما هي سرعة إنجاز الفحص ذي الـ 13 مرحلة؟',
        answer: 'بفضل مرشحات الوجه الموحدة والتخزين المؤقت للعمليات الحسابية، يكتمل المسار بالكامل في أقل من 1.8 ثانية على معالجات السيرفر العادية.',
      },
    ],
  },
};

export const FEATURES_CONTENT: Record<Locale, EducationalPageData> = {
  en: {
    slug: '/features',
    badge: 'Anatomical Precision',
    title: '24 Anatomical Regions & 7 Skin Characteristics',
    subtitle: 'Every millimeter of facial skin has unique biological properties. Dr Maher Vision AI v3.5 analyzes each region independently.',
    lastUpdated: 'October 2026',
    reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Features', path: '/features' },
    ],
    sections: [
      {
        title: 'The 24 Canonical Facial Regions',
        paragraphs: [
          'Unlike generic beauty apps that apply a broad blur filter over the entire face, Dr Maher Vision AI v3.5 maps facial skin into 24 distinct anatomical zones with strict landmark-governed boundaries:',
        ],
        bulletPoints: [
          'Upper Forehead (Left, Center, Right): Sun-exposed zones prone to actinic changes and dehydration lines.',
          'Glabella: The central frown region between the eyebrows.',
          'Periorbital Skin (Left & Right Upper Eyelids, Under-Eye Infraorbital, Crow’s Feet): Extremely delicate 0.5mm skin vulnerable to dark circles and fine lines.',
          'Cheeks (Upper Malar, Medial, Lower Buccal on Left & Right): High sebaceous gland density, vascular flushing, and blemish localization.',
          'Nasal Complex (Bridge & Tip): Prime focal points for sebaceous filaments, shine, and erythema.',
          'Nasolabial Folds (Left & Right): Dynamic expression lines and localized redness folds.',
          'Perioral & Lower Face (Upper Lip Skin, Lower Lip Skin, Chin Center, Left & Right Jawline, Submental Neck): Hormonal blemish zones and skin laxity indicators.',
        ],
      },
      {
        title: 'The 7 Analyzed Skin Characteristics',
        paragraphs: [
          'Each region is evaluated across seven core visible dermatological dimensions:',
        ],
        bulletPoints: [
          '1. Visual Spot Candidates & Blemishes: Multi-scale Hessian blob detection mapped to Hayashi severity bands.',
          '2. Facial Redness & Erythema: Illumination-normalized a* chrominance measuring capillary perfusion.',
          '3. Pigmentation & Melanin Distribution: Localized L* contrast detecting solar lentigines and uneven tone.',
          '4. Skin Surface Texture: Microrelief gradient sharpness and stratum corneum roughness.',
          '5. Skin Shine & Sebum Reflection: Specular highlight clustering distinguishing healthy glow from excess sebum.',
          '6. Visible Facial Pores: High-frequency ostia bandpass filtering with strict 4.5 px/mm optical resolution gating.',
          '7. Under-Eye Darkness: Infraorbital L* differential measuring periorbital hyperpigmentation and vascular pooling.',
        ],
        callout: {
          type: 'info',
          title: 'Explicit Unavailable Status Codes',
          text: 'If a region is obscured by hair, shadowed by lighting, or below optical resolution, it is transparently reported as unavailable (e.g. low_resolution, insufficient_quality) rather than displaying a fake score of zero.',
        },
      },
    ],
    faqs: [
      {
        question: 'Why is zero overlap between regions important?',
        answer: 'Zero overlap prevents double-counting features and ensures area-weighted aggregation across the face is mathematically sound and reproducible.',
      },
      {
        question: 'Can the 24 regions be customized for different face shapes?',
        answer: 'Yes. The 24 regions are dynamically reconstructed for each individual face from 478 MediaPipe landmark coordinates, adapting perfectly to oval, round, square, or heart-shaped facial anatomies.',
      },
    ],
  },
  ar: {
    slug: '/features',
    badge: 'دقة تشريحية متقدمة',
    title: '24 منطقة تشريحية و7 مقاييس لبشرة الوجه',
    subtitle: 'كل مليمتر في بشرة الوجه يحمل خصائص حيوية فريدة. يحلل محرك Dr Maher Vision AI v3.5 كل منطقة باستقلالية كاملة.',
    lastUpdated: 'أكتوبر 2026',
    reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
    breadcrumbs: [
      { name: 'الرئيسية', path: '/' },
      { name: 'المميزات', path: '/features' },
    ],
    sections: [
      {
        title: 'المناطق التشريحية الـ 24 المعتمدة',
        paragraphs: [
          'على عكس تطبيقات التجميل العامة التي تطبق فلاتر سطحية على كامل الوجه، يقسم نظام Dr Maher Vision AI v3.5 بشرة الوجه إلى 24 منطقة تشريحية محددة بنقاط هندسية دقيقة:',
        ],
        bulletPoints: [
          'الجبهة (أعلى الجبهة يسار، وسط، يمين): مناطق معرضة للشمس ولخطوط الجفاف السطحية.',
          'منطقة ما بين الحاجبين (Glabella): مركز تعبيرات تقطيب الوجه.',
          'محيط العينين (الجفون العلوية، تحت العينين، وزوايا العينين الخارجية): جلد رقيق جدًا (0.5 ملم) سريع التأثر بالهالات والخطوط.',
          'الخدود (أعلى الوجنة، الخد الأوسط، الخد السفلي يمينًا ويسارًا): مناطق غنية بالغدد الدهنية والتورد الوعائي وظهور الحبوب.',
          'منطقة الأنف (جسر الأنف ومقدمة الأنف): بؤرة رئيسية للدهون والمسام والاحمرار الشعيري.',
          'طيات الأنف والشفاه (Nasolabial Folds): ثنايا التعبير الحركي وتراكم الاحمرار الموضعي.',
          'محيط الفم والفك والرقبة (فوق الشفاه، تحت الشفاه، الذقن، خط الفك يسار ويمين، وأعلى الرقبة): مناطق ترتبط بالتغيرات الهرمونية.',
        ],
      },
      {
        title: 'خصائص البشرة السبع التي يتم تحليلها',
        paragraphs: [
          'يتم فحص كل منطقة تشريحية عبر 7 أبعاد مظهرية أساسية:',
        ],
        bulletPoints: [
          '1. بقع الوجه وآثار الحبوب: كشف موضعي للبقع الدائرية وتصنيفها وفق مقياس هاياشي.',
          '2. احمرار الوجه والحمامى: قياس تدفق الدم السطحي عبر قناة a* المعايرة ضوئيًا.',
          '3. التصبغات وتوزيع الميلانين: حساب تباين لون البشرة ورصد البقع الداكنة والتصبغات الشمسية.',
          '4. ملمس البشرة والخشونة: قياس تدرجات سطح الجلد وتجانس الطبقة القرنية الخارجية.',
          '5. لمعان البشرة وانعكاس الدهون: رصد الانعكاسات البصرية اللامعة والتفرقة بين النضارة والدهنية الزائدة.',
          '6. مسام الوجه الظاهرة: فلترة النطاق الترددي العالي بحد دقة بصرية صارم (4.5 بكسل/ملم).',
          '7. الهالات السوداء ومحيط العين: قياس فرق الإضاءة تحت العين ورصد التصبغ والظلال الوعائية.',
        ],
        callout: {
          type: 'info',
          title: 'الشفافية في الحالات غير المتاحة',
          text: 'إذا كانت المنطقة مغطاة بالشعر أو في منطقة ظل، يُسجل النظام بوضوح أن النتيجة غير متاحة لعدم كفاية الجودة (low_resolution أو insufficient_quality) بدلًا من وضع درجة صفر مضللة.',
        },
      },
    ],
    faqs: [
      {
        question: 'لماذا يُعد انعدام تداخل المناطق أمرًا حاسمًا؟',
        answer: 'يمنع عدم التداخل احتساب العيوب مرتين، ويضمن أن الحساب المرجح لمساحة الوجه دقيق رياضيًا وقابل للتكرار في كل فحص.',
      },
      {
        question: 'هل تتكيف المناطق الـ 24 مع اختلاف أشكال الوجوه؟',
        answer: 'نعم. يُعاد بناء المناطق لكل وجه ديناميكيًا بالاعتماد على 478 نقطة تشريحية، مما يضمن توافقها مع الوجوه البيضاوية أو الدائرية أو المربعة.',
      },
    ],
  },
};

export const CONTACT_CONTENT: Record<Locale, EducationalPageData> = {
  en: {
    slug: '/contact',
    badge: 'Clinic Locations & Inquiries',
    title: 'Contact Dr. Maher Mahmoud Clinics',
    subtitle: 'Consult with our dermatology specialists in Cairo and Alexandria, or book an appointment online.',
    lastUpdated: 'October 2026',
    reviewer: 'Dr. Maher Mahmoud Clinics Administration',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Contact', path: '/contact' },
    ],
    sections: [
      {
        title: 'Clinic Locations & Branches',
        paragraphs: [
          'Dr. Maher Mahmoud Clinics welcomes patients across multiple state-of-the-art facilities in Egypt equipped with the latest diagnostic and laser technologies.',
        ],
        bulletPoints: [
          'Cairo — Mohandessin Branch: Main clinical consultation center, laser suites, and dermatological surgery.',
          'Cairo — Nasr City Branch: Comprehensive dermatology, cosmetic injectables, and skin rejuvenation clinics.',
          'Alexandria Branch: Coastal medical center offering full dermatological consultations and aesthetic treatments.',
        ],
      },
      {
        title: 'Appointments & Digital Support',
        paragraphs: [
          'Appointments can be booked directly through our official booking portal or via WhatsApp. Our clinical coordination team is available Saturday through Thursday from 10:00 AM to 10:00 PM (Cairo Time).',
        ],
        callout: {
          type: 'clinical',
          title: 'Medical Inquiries',
          text: 'SkinScan results can be referenced during your in-person clinic consultation to help Dr. Maher and our dermatology team discuss your concerns.',
        },
      },
    ],
    faqs: [
      {
        question: 'Can I book an appointment directly through SkinScan?',
        answer: 'Yes! Click the "Book" button in the navigation bar to access Dr. Maher Mahmoud’s official appointment scheduling system.',
      },
      {
        question: 'Does the clinic offer virtual consultations?',
        answer: 'Yes, international patients and those residing outside Cairo/Alexandria can schedule remote video consultations through our coordination team.',
      },
    ],
  },
  ar: {
    slug: '/contact',
    badge: 'فروع العيادة والتواصل',
    title: 'اتصل بعيادات د. ماهر محمود',
    subtitle: 'استشر أطباء الجلدية في فروعنا بالقاهرة والإسكندرية، أو احجز موعد كشفك مباشرة عبر الإنترنت.',
    lastUpdated: 'أكتوبر 2026',
    reviewer: 'إدارة عيادات د. ماهر محمود',
    breadcrumbs: [
      { name: 'الرئيسية', path: '/' },
      { name: 'اتصل بنا', path: '/contact' },
    ],
    sections: [
      {
        title: 'فروع العيادات والمواقع',
        paragraphs: [
          'تستقبل عيادات د. ماهر محمود المراجعين في فروعها المجهزة بأحدث أجهزة الليزر والتشخيص الجلدي في جمهورية مصر العربية:',
        ],
        bulletPoints: [
          'فرع القاهرة — المهندسين: المركز الرئيسي للكشوفات الطبية، غرف الليزر المتطورة، وجراحات الجلد التجميلية.',
          'فرع القاهرة — مدينة نصر: عيادات متكاملة للأمراض الجلدية، حقن التجميل، وبرامج نضارة البشرة.',
          'فرع الإسكندرية: مركز طبي متكامل يقدم استشارات الجلدية المتقدمة وجلسات الليزر التخصصية.',
        ],
      },
      {
        title: 'حجز المواعيد والاستفسارات',
        paragraphs: [
          'يمكنك حجز موعد كشفك مباشرة عبر بوابة الحجز الإلكترونية أو بالتواصل المباشر مع خدمة العملاء عبر الواتساب. مواعيد العمل من السبت إلى الخميس من الساعة 10:00 صباحًا حتى 10:00 مساءً بتوقيت القاهرة.',
        ],
        callout: {
          type: 'clinical',
          title: 'الاستشارات الطبية',
          text: 'يمكنك عرض نتائج فحص SkinScan أثناء كشفك في العيادة لمناقشة الخصائص المرصودة مع الدكتور ماهر محمود وفريق الأطباء المتخصصين.',
        },
      },
    ],
    faqs: [
      {
        question: 'كيف يمكنني حجز موعد كشف في العيادة؟',
        answer: 'يمكنك الضغط على زر "احجز" في شريط التنقل العلوي للوصول المباشر إلى نظام حجز المواعيد لعيادات د. ماهر محمود.',
      },
      {
        question: 'هل تتوفر استشارات للمرضى خارج مصر؟',
        answer: 'نعم، يمكن للمرضى الدوليين والمقيمين خارج مصر تنسيق استشارات مرئية عن بُعد عبر فريق التنسيق الطبي بالعيادة.',
      },
    ],
  },
};

export const TOPICS_INDEX: Record<Locale, EducationalPageData> = {
  en: {
    slug: '/skin-analysis',
    badge: 'Educational Guide',
    title: 'Photographic Facial Skin Analysis Hub',
    subtitle: 'Evidence-based guides explaining how computer vision evaluates visible skin features, resolution constraints, and dermatological metrics.',
    lastUpdated: 'October 2026',
    reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Skin Analysis', path: '/skin-analysis' },
    ],
    sections: [
      {
        title: 'The Principles of Photographic Skin Analysis',
        paragraphs: [
          'Digital facial photography has revolutionized clinical dermatology and aesthetic consultations. However, capturing skin digitally introduces distinct optical and computational challenges that require disciplined scientific handling.',
          'A digital photograph captures light reflected from the skin surface (diffuse reflection and specular highlights). Unlike high-magnification clinical dermatoscopy, a smartphone photograph cannot visualize deep dermal architecture, histopathology, or cellular atypia. It excels, however, at quantifying macro-level surface characteristics: blemish frequency, localized erythema, pigment uniformity, and surface roughness.',
        ],
      },
      {
        title: 'Deep-Dive Topics',
        paragraphs: [
          'Explore our specialized clinical guides covering each visible skin metric evaluated by Dr Maher Vision AI v3.5:',
        ],
      },
    ],
    relatedTopics: [
      {
        title: 'Facial Pores & Optical Resolution',
        path: '/skin-analysis/pores',
        description: 'Why pore measurement requires 4.5 px/mm resolution and how Dr Maher Vision AI prevents synthetic pore hallucination.',
      },
      {
        title: 'Blemishes & Acne Marks',
        path: '/skin-analysis/acne',
        description: 'Multi-scale Hessian curvature blob detection mapped to Hayashi severity count bands.',
      },
      {
        title: 'Pigmentation & Melanin Contrast',
        path: '/skin-analysis/pigmentation',
        description: 'CIE L*a*b* color space separation for solar lentigines, post-inflammatory marks, and tone uniformity.',
      },
      {
        title: 'Facial Redness & Erythema',
        path: '/skin-analysis/redness',
        description: 'Illumination-normalized a* chrominance measuring microcirculation, capillary flushing, and sensitive skin.',
      },
      {
        title: 'Skin Texture & Surface Roughness',
        path: '/skin-analysis/skin-texture',
        description: 'High-frequency gradient analysis of facial microrelief and epidermal barrier hydration cues.',
      },
      {
        title: 'Skin Shine & Sebum Reflection',
        path: '/skin-analysis/skin-shine',
        description: 'Distinguishing healthy radiant glow from excess specular T-zone oiliness.',
      },
      {
        title: 'Periorbital Under-Eye Darkness',
        path: '/skin-analysis/under-eye-darkness',
        description: 'Evaluating infraorbital darkness, vascular pooling, and orbital shadow contrast.',
      },
    ],
  },
  ar: {
    slug: '/skin-analysis',
    badge: 'دليل تثقيفي شامل',
    title: 'دليل تحليل بشرة الوجه الفوتوغرافي',
    subtitle: 'أدلة علمية مبسطة تشرح كيف تحلل الرؤية الحاسوبية ملامح البشرة، شروط دقة التصوير، والمقاييس الجلدية المعتمدة.',
    lastUpdated: 'أكتوبر 2026',
    reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
    breadcrumbs: [
      { name: 'الرئيسية', path: '/' },
      { name: 'تحليل البشرة', path: '/skin-analysis' },
    ],
    sections: [
      {
        title: 'مبادئ التحليل الفوتوغرافي للبشرة',
        paragraphs: [
          'أحدث التصوير الرقمي نقلة نوعية في استشارات الجلدية والطب التجميلي. ومع ذلك، فإن قياس خصائص الجلد رقميًا يرتبط بضوابط بصرية وحسابية تتطلب دقة علمية متناهية.',
          'تلتقط الصور الفوتوغرافية الضوء المنعكس من سطح الجلد (الانعكاس المشتت والانعكاس اللامع). وعلى عكس مجهر الجلد السريري (Dermatoscope)، لا تستطيع كاميرات الهواتف رؤية الخلايا العميقة للجلد، لكنها ممتازة في قياس الخصائص السطحية المظهرية: عدد البقع، الاحمرار السطحي، تجانس التصبغات، وخشونة الملمس.',
        ],
      },
      {
        title: 'الأدلة التخصصية المفصلة',
        paragraphs: [
          'تصفح أدلتنا التخصصية التي تشرح كل ميزة ومقياس يحلله محرك Dr Maher Vision AI v3.5:',
        ],
      },
    ],
    relatedTopics: [
      {
        title: 'مسام الوجه والدقة البصرية',
        path: '/skin-analysis/pores',
        description: 'لماذا يتطلب قياس المسام دقة 4.5 بكسل/ملم وكيف نمنع اختلاق المسام الوهمية.',
      },
      {
        title: 'البقع وآثار حب الشباب',
        path: '/skin-analysis/acne',
        description: 'رصد البقع بمصفوفة هيسي وتصنيفها وفق مقاييس هاياشي المعتمدة سريريًا.',
      },
      {
        title: 'التصبغات وتوزيع الميلانين',
        path: '/skin-analysis/pigmentation',
        description: 'تحليل فضاء الألوان CIE L*a*b* لرصد التصبغات الشمسية وتفاوت لون البشرة.',
      },
      {
        title: 'احمرار الوجه والحمامى',
        path: '/skin-analysis/redness',
        description: 'قياس تدفق الشعيرات الدموية وحساسية البشرة عبر قناة a* المعايرة ضوئيًا.',
      },
      {
        title: 'ملمس البشرة والخشونة',
        path: '/skin-analysis/skin-texture',
        description: 'تحليل تضاريس الجلد الدقيقة وعلامات ترطيب الحاجز الواقي للبشرة.',
      },
      {
        title: 'لمعان البشرة وانعكاس الدهون',
        path: '/skin-analysis/skin-shine',
        description: 'التفرقة الدقيقة بين النضارة الصحية والدهنية المفرطة في منطقة الـ T-Zone.',
      },
      {
        title: 'الهالات السوداء ومحيط العينين',
        path: '/skin-analysis/under-eye-darkness',
        description: 'تقييم غمقان منطقة تحت العين، الظلال الوعائية، وتجويف مجرى الدموع.',
      },
    ],
  },
};

export const TOPIC_PAGES_CONTENT: Record<string, Record<Locale, EducationalPageData>> = {
  pores: {
    en: {
      slug: '/skin-analysis/pores',
      badge: 'Skin Topic Guide',
      title: 'Facial Pores & Optical Resolution Guide',
      subtitle: 'The biology of facial pores, sebaceous infundibula, and why Dr Maher Vision AI enforces a strict 4.5 px/mm Nyquist resolution gate.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Pores', path: '/skin-analysis/pores' },
      ],
      sections: [
        {
          title: 'Anatomy of Facial Pores',
          paragraphs: [
            'In dermatology, what the public refers to as "pores" are the external apertures of pilosebaceous follicles (follicular ostia). These structures channel sebum produced by sebaceous glands to the epidermal surface, maintaining the skin’s lipid barrier.',
            'A human facial pore typically measures between 0.10 mm and 0.40 mm in diameter. Pore visibility varies dramatically based on anatomical location, genetics, age, and sebaceous activity. The nose and medial cheeks feature the highest density of visible ostia.',
          ],
        },
        {
          title: 'The Optical Resolution Barrier: The 4.5 px/mm Rule',
          paragraphs: [
            'A central controversy in commercial AI skin analysis is pore hallucination. In standard smartphone selfies taken at arm’s length (40–60 cm), the interocular distance (IOD) is often around 150 pixels, yielding an optical resolution of ~2.4 px/mm.',
            'By the Nyquist-Shannon sampling theorem, resolving a 0.2 mm pore requires at least 2 samples across its diameter, and in practice $\ge 4.5$ px/mm to distinguish pore contrast from Bayer demosaicing artifacts and image compression.',
          ],
          callout: {
            type: 'clinical',
            title: 'Dr Maher Vision AI v3.5 Policy',
            text: 'If a photograph is taken below 4.5 px/mm, the engine refuses to fabricate a pore count. It returns status: "low_resolution", explaining that physical optics prevent reliable measurement.',
          },
        },
        {
          title: 'Clinical Recommendations',
          paragraphs: [
            'Pores cannot be physically "opened" or "closed" because they lack muscular sphincters. However, their visible appearance can be minimized through regular topical salicylic acid (BHA) exfoliation, retinoids to stimulate perifollicular collagen support, and non-comedogenic sunscreens.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Can skincare products permanently eliminate pores?',
          answer: 'No. Pores are essential anatomical structures for skin homeostasis. Medical dermatology aims to prevent follicular dilation and unclog keratin debris rather than eliminate them.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/pores',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل مسام الوجه والدقة البصرية',
      subtitle: 'بيولوجيا مسام الوجه، القنوات الدهنية، ولماذا يلتزم ذكاء د. ماهر الاصطناعي بحد نايكويست الصارم (4.5 بكسل/ملم).',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'المسام', path: '/skin-analysis/pores' },
      ],
      sections: [
        {
          title: 'تشريح وبيولوجيا مسام الوجه',
          paragraphs: [
            'ما يُعرف شعبيًا بمسام الوجه هو الفوهات الخارجية للجريبات الشعرية الدهنية (Follicular Ostia). وظيفة هذه الفتحات إفراز الزهم والدهون الطبيعية التي تحمي الحاجز الواقي للجلد وتمنع الجفاف.',
            'يتراوح قطر المسام الطبيعي في الوجه بين 0.10 ملم و0.40 ملم. وتختلف درجة وضوحها وفق العوامل الوراثية، العمر، ونشاط الغدد الدهنية، وتتركز بأعلى كثافة في الأنف وأعلى الخدين.',
          ],
        },
        {
          title: 'حاجز الدقة البصرية: قاعدة 4.5 بكسل/ملم',
          paragraphs: [
            'من أكبر المشاكل في تطبيقات الذكاء الاصطناعي التجارية اختلاق مسام وهمية من تشويش الكاميرا. في صور السيلفي العادية على بعد 50 سم، تكون الدقة البصرية للوجه حوالي 2.4 بكسل/ملم فقط.',
            'وفق نظرية نايكويست لأخذ العينات، يتطلب رصد مسام بقطر 0.2 ملم دقة بصرية لا تقل عن 4.5 بكسل/ملم للتفرقة بين حواف المسام الحقيقية وتأثيرات ضغط JPEG وضوضاء المستشعر.',
          ],
          callout: {
            type: 'clinical',
            title: 'سياسة محرك Dr Maher Vision AI v3.5',
            text: 'إذا التُقطت الصورة بدقة أقل من 4.5 بكسل/ملم، يرفض النظام اختلاق أي رقم. يُسجل أن نتيجة المسام: "low_resolution" بشفافية كاملة.',
          },
        },
        {
          title: 'نصائح طبية للتعامل مع المسام الواسعة',
          paragraphs: [
            'المسام لا تملك عضلات لتفتح أو تغلق كما يُشاع، لكن يمكن تقليل وضوحها بتنظيف الإفرازات عبر حمض الساليسيليك، واستخدام مشتقات فيتامين أ (الريتينويد) لتعزيز الكولاجين المحيط بها، والحماية اليومية من الشمس.',
          ],
        },
      ],
      faqs: [
        {
          question: 'هل يمكن إغلاق المسام نهائيًا بالمستحضرات؟',
          answer: 'كلا. المسام قنوات حيوية لا يمكن إغلاقها أو إزالتها. العلاج الطبي يهدف إلى تنظيفها وتحسين مرونة الجلد المحيط بها لتبدو بمظهر أصغر.',
        },
      ],
    },
  },
  acne: {
    en: {
      slug: '/skin-analysis/acne',
      badge: 'Skin Topic Guide',
      title: 'Blemish & Acne Mark Analysis Guide',
      subtitle: 'How computer vision detects visible red spots, inflammatory papules, and marks using Hessian eigenvalue curvature.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Blemishes & Acne', path: '/skin-analysis/acne' },
      ],
      sections: [
        {
          title: 'Visual Detection of Facial Spots',
          paragraphs: [
            'Facial blemishes present distinct photometric signatures: localized circular depressions or elevations characterized by increased a* redness (erythema) or decreased L* luminance.',
            'Dr Maher Vision AI v3.5 employs multi-scale Difference-of-Gaussians (DoG) filtering combined with Hessian matrix curvature checks. A valid spot candidate must exhibit balanced eigenvalues ($\lambda_1 / \lambda_2 \approx 1$), preventing linear wrinkles or shadow folds from being misclassified as blemishes.',
          ],
        },
        {
          title: 'The Hayashi Severity Scale',
          paragraphs: [
            'In clinical dermatology literature (Hayashi et al.), facial inflammatory lesions are categorized into standardized count brackets (0: none, 1–5: mild, 6–20: moderate, 21–50: severe, >50: very severe). Our vision engine reports visual candidate counts mapped to these established bands for reproducible interpretation.',
          ],
          callout: {
            type: 'clinical',
            title: 'Diagnostic Distinction',
            text: 'Visual spot detection identifies visible candidate markings; it does not diagnose clinical acne vulgaris, rosacea papules, or folliculitis. Definitive diagnosis requires physical dermatological palpation.',
          },
        },
      ],
      faqs: [
        {
          question: 'Can the scan distinguish acne from freckles or moles?',
          answer: 'The engine uses chromatic thresholds (a* redness vs melanin absorption) to differentiate reddish inflammatory marks from brown pigmented lentigines, but dermatoscopic evaluation is necessary for precise lesion classification.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/acne',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل تحليل البقع وآثار حب الشباب',
      subtitle: 'كيف ترصد الرؤية الحاسوبية البقع الحمراء والحبوب الظاهرة باستخدام تدرجات مصفوفة هيسي ومقاييس هاياشي.',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'حب الشباب والبقع', path: '/skin-analysis/acne' },
      ],
      sections: [
        {
          title: 'الرصد البصري لبقع الوجه',
          paragraphs: [
            'تتميز بقع الوجه بخصائص ضوئية واضحة: مناطق موضعية دائرية تتسم بارتفاع قناة الاحمرار a* (الحمامى) أو انخفاض الإضاءة L*.',
            'يستخدم محرك Dr Maher Vision AI v3.5 مرشحات الفرق بين غاوسيان (DoG) مقرونة بمصفوفة انحناء هيسي (Hessian Matrix). ويشترط لتأكيد البقعة أن تكون متناظرة الأبعاد دائريًا، لمنع اعتبار الخطوط التعبيرية أو ثنايا التجاعيد كحبوب.',
          ],
        },
        {
          title: 'مقياس هاياشي لشدة البقع',
          paragraphs: [
            'في مراجع طب الجلدية المعتمدة (مقياس هاياشي)، تُصنف الحبوب والبقع وفق نطاقات عددية محددة (0: لا يوجد، 1–5: خفيف، 6–20: متوسط، 21–50: شديد، >50: شديد جدًا). يعتمد نظامنا هذه الفئات المعتمدة لتقديم تقرير موضوعي.',
          ],
          callout: {
            type: 'clinical',
            title: 'التفرقة التشخيصية',
            text: 'رصد البقع رقميًا يحدد العلامات الظاهرة فقط، ولا يعد تشخيصًا لحب الشباب الشائع أو الوردية. التشخيص الدقيق يتطلب فحص الطبيب الإكلينيكي.',
          },
        },
      ],
      faqs: [
        {
          question: 'هل يفرق الفحص بين آثار الحبوب والنمش والشامات؟',
          answer: 'يميز النظام لونيًا بين العلامات الحمراء (الالتهابية) والتصبغات البنية (الميلانين)، لكن تصنيف الشامات بدقة يستلزم فحصًا طبيًا متخصصًا.',
        },
      ],
    },
  },
  pigmentation: {
    en: {
      slug: '/skin-analysis/pigmentation',
      badge: 'Skin Topic Guide',
      title: 'Facial Pigmentation & Melanin Guide',
      subtitle: 'Quantifying melanin contrast, solar lentigines, and color uniformity in CIE L*a*b* color space.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Pigmentation', path: '/skin-analysis/pigmentation' },
      ],
      sections: [
        {
          title: 'Understanding Facial Hyperpigmentation',
          paragraphs: [
            'Melanin is the primary pigment responsible for human skin coloration, synthesized by melanocytes in the basal layer of the epidermis. Under ultraviolet (UV) radiation or hormonal stimuli, localized clusters of hyperactive melanocytes produce excess melanin, manifesting as solar lentigines (sun spots), post-inflammatory hyperpigmentation (PIH), or melasma.',
          ],
        },
        {
          title: 'CIE L*a*b* Chrominance Separation',
          paragraphs: [
            'Dr Maher Vision AI v3.5 analyzes skin color in the perceptually uniform CIE L*a*b* color space. The L* channel measures perceptual lightness, while a* and b* measure red-green and yellow-blue chroma. By evaluating local deviations ($\Delta L^*$) relative to the regional background baseline, the engine measures localized pigment deposits without distortion from ambient lighting.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Can the scan determine whether pigmentation is epidermal or dermal?',
          answer: 'No. Differentiating epidermal from deeper dermal pigmentation requires clinical Wood’s lamp examination or dermatoscopy.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/pigmentation',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل تصبغات الوجه وتوزيع الميلانين',
      subtitle: 'قياس تباين الميلانين، التصبغات الشمسية، وتجانس اللون في الفضاء اللوني CIE L*a*b*.',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'التصبغات', path: '/skin-analysis/pigmentation' },
      ],
      sections: [
        {
          title: 'فهم تصبغات الوجه وفرط الميلانين',
          paragraphs: [
            'الميلانين هو الصبغة الطبيعية المسؤولة عن لون الجلد، وتنتجه الخلايا الصبغية في الطبقة القاعدية من البشرة. عند التعرض للشمس أو التغيرات الهرمونية، يفرز الميلانين بكثافة موضعيًا مسببًا البقع الشمسية، آثار الحبوب الداكنة، أو الكلف.',
          ],
        },
        {
          title: 'القياس في الفضاء اللوني CIE L*a*b*',
          paragraphs: [
            'يحلل محرك Dr Maher Vision AI v3.5 درجات اللون في فضاء CIE L*a*b* الدقيق. تقيس القناة L* درجة السطوع والإضاءة، بينما تقيس القناتان a* وb* التدرجات اللونية. ومن خلال حساب فروق الإضاءة النسبية، يتم رصد البقع الداكنة بدقة بعيدًا عن تأثيرات الإضاءة المحيطة.',
          ],
        },
      ],
      faqs: [
        {
          question: 'هل يحدد الفحص عمق التصبغ (سطحي أم عميق)؟',
          answer: 'كلا. تحديد عمق التصبغ يتطلب فحصًا إكلينيكيًا في العيادة باستخدام مصباح وود (Wood’s Lamp) أو جهاز الديرموسكوب.',
        },
      ],
    },
  },
  redness: {
    en: {
      slug: '/skin-analysis/redness',
      badge: 'Skin Topic Guide',
      title: 'Facial Redness & Erythema Analysis Guide',
      subtitle: 'Evaluating facial microcirculation, vascular flushing, and sensitive skin reactions with tone-adaptive calibrations.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Redness', path: '/skin-analysis/redness' },
      ],
      sections: [
        {
          title: 'Physiology of Cutaneous Erythema',
          paragraphs: [
            'Facial redness is primarily driven by blood flow through the superficial cutaneous microvasculature. Capillary dilation in response to temperature, barrier impairment, or inflammatory cascades produces visible erythema, especially across the cheeks and nasal ala.',
          ],
        },
        {
          title: 'Skin Tone Adaptive Calibration',
          paragraphs: [
            'Erythema presents differently across skin phototypes. In very light skin (Fitzpatrick I–II), redness appears as vibrant pink; in deep skin (Fitzpatrick V–VI), increased melanin masks superficial erythema, shifting its visual appearance toward purplish or dark tones.',
            'Dr Maher Vision AI v3.5 adapts its redness extraction thresholds according to Individual Typology Angle (ITA°), ensuring fair, balanced evaluation across all complexions.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Does facial redness always mean rosacea?',
          answer: 'No. Transient redness can be triggered by exercise, spicy food, weather, or temporary barrier irritation. A medical examination is required to diagnose rosacea.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/redness',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل احمرار الوجه والحمامى الجلدية',
      subtitle: 'تقييم الدورة الدموية الدقيقة بالبشرة، التورد الوعائي، وحساسية الجلد مع معايرة متوافقة مع لون البشرة.',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'الاحمرار', path: '/skin-analysis/redness' },
      ],
      sections: [
        {
          title: 'فسيولوجيا احمرار الجلد (الحمامى)',
          paragraphs: [
            'ينشأ احمرار الوجه بشكل رئيسي من تدفق الدم في الشعيرات الدموية الدقيقة القريبة من سطح الجلد. يؤدي توسع هذه الشعيرات بفعل الحرارة أو ضعف حاجز البشرة أو الالتهاب إلى احمرار ملحوظ، خاصة في الخدين وجوانب الأنف.',
          ],
        },
        {
          title: 'المعايرة المتكيفة مع لون البشرة',
          paragraphs: [
            'يختلف مظهر الاحمرار بين درجات البشرة المختلفة؛ ففي البشرة الفاتحة يظهر كدرجات وردية فاقعة، بينما في البشرة الداكنة تحجب صبغة الميلانين الاحمرار السطحي جزئيًا ليظهر بلون مائل للأرجواني أو البني الداكن.',
            'يكيف نظام Dr Maher Vision AI v3.5 عتبات قياس الاحمرار وفق زاوية تصنيف البشرة (ITA°) لضمان دقة متكافئة وعادلة لكل ألوان البشرة.',
          ],
        },
      ],
      faqs: [
        {
          question: 'هل يعني احمرار الوجه دائمًا الإصابة بمرض الوردية؟',
          answer: 'كلا. قد ينتج الاحمرار المؤقت عن المجهود البدني، الأطعمة الحارة، الطقس، أو تحسس مؤقت في حاجز البشرة. تشخيص الوردية يتطلب تقييمًا طبيًا.',
        },
      ],
    },
  },
  'skin-texture': {
    en: {
      slug: '/skin-analysis/skin-texture',
      badge: 'Skin Topic Guide',
      title: 'Skin Texture & Surface Roughness Guide',
      subtitle: 'Analyzing facial microrelief, epidermal uniformity, fine lines, and stratum corneum hydration cues.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Texture', path: '/skin-analysis/skin-texture' },
      ],
      sections: [
        {
          title: 'Microrelief and Epidermal Geometry',
          paragraphs: [
            'Healthy human skin features an intricate geometric surface microrelief composed of fine triangular and polygonal plateaus separated by delicate furrows (sulci cutis).',
            'When the stratum corneum suffers from dehydration or impaired desquamation, surface microrelief becomes irregular, rough, and light-scattering, perceived visually as dull or uneven texture.',
          ],
        },
        {
          title: 'High-Frequency Gradient Analysis',
          paragraphs: [
            'Dr Maher Vision AI v3.5 isolates high-frequency spatial gradients in the luminance channel. By evaluating gradient magnitude distributions within each anatomical region, the engine objectively quantifies surface micro-roughness.',
          ],
        },
      ],
      faqs: [
        {
          question: 'How can skin texture be improved?',
          answer: 'Topical hydrators (hyaluronic acid, ceramides), gentle chemical exfoliants (AHA/PHA), and clinical procedures such as microneedling or gentle laser resurfacing can significantly refine skin texture.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/skin-texture',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل ملمس البشرة والخشونة السطحية',
      subtitle: 'تحليل تضاريس الجلد الدقيقة، تجانس الطبقة السطحية، والخطوط الدقيقة الناتجة عن جفاف البشرة.',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'الملمس والخشونة', path: '/skin-analysis/skin-texture' },
      ],
      sections: [
        {
          title: 'تضاريس الجلد الدقيقة وهندسة البشرة',
          paragraphs: [
            'تتميز البشرة الصحية بشبكة هندسية دقيقة من الخطوط السطحية والتضاريس المجهرية تفصل بينها أخاديد رقيقة ومرنة.',
            'عندما تعاني الطبقة القرنية الخارجية من الجفاف أو بطء تجدد الخلايا، تصبح هذه التضاريس غير منتظمة وخشنة، مما يشتت انعكاس الضوء ويمنح البشرة مظهرًا باهتًا وغير متجانس.',
          ],
        },
        {
          title: 'تحليل التدرجات عالية التردد',
          paragraphs: [
            'يعزل نظام Dr Maher Vision AI v3.5 الترددات المكانية العالية في قنوات الإضاءة لقياس تفاوت وتشتت التضاريس السطحية بموضوعية رياضية دقيقة في كل منطقة.',
          ],
        },
      ],
      faqs: [
        {
          question: 'كيف يمكن تحسين ملمس البشرة الخشنة؟',
          answer: 'بالمرطبات الحاوية على السيراميد وحمض الهيالورونيك، المقشرات اللطيفة (AHA)، والإجراءات الطبية بالعيادة مثل الديرمابن أو فراكشنال ليزر.',
        },
      ],
    },
  },
  'skin-shine': {
    en: {
      slug: '/skin-analysis/skin-shine',
      badge: 'Skin Topic Guide',
      title: 'Skin Shine & Sebum Reflection Guide',
      subtitle: 'Distinguishing healthy radiant glow from excess specular T-zone oiliness using polarization and reflection models.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Skin Shine', path: '/skin-analysis/skin-shine' },
      ],
      sections: [
        {
          title: 'Specular Reflection vs. Radiant Glow',
          paragraphs: [
            'Light reflected from human facial skin consists of two components: diffuse subsurface scattering (producing healthy color and soft radiance) and specular Fresnel reflection from surface lipids (producing bright highlights).',
            'Excessive sebum secretion in the T-zone (forehead, nose, chin) creates a continuous lipid film that intensifies localized specular highlights, resulting in an oily sheen.',
          ],
        },
        {
          title: 'Detection Algorithms in Vision AI',
          paragraphs: [
            'Dr Maher Vision AI v3.5 evaluates localized luminance peaks and highlight cluster density, distinguishing broad diffuse glow from concentrated specular oil glares.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Why does my skin look shiny in photos but dry in person?',
          answer: 'Camera flashes and directional smartphone lighting create harsh specular reflections on any natural skin oils, exaggerating the appearance of shine.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/skin-shine',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل لمعان البشرة وانعكاس الدهون',
      subtitle: 'التفرقة الدقيقة بين النضارة المتوهجة الصحية وزيادة الإفراز الدهني اللامع في منطقة الـ T-Zone.',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'لمعان البشرة', path: '/skin-analysis/skin-shine' },
      ],
      sections: [
        {
          title: 'الانعكاس البصري اللامع مقابل النضارة الصحية',
          paragraphs: [
            'ينقسم الضوء المنعكس من بشرة الوجه إلى نوعين: انعكاس مشتت داخلي يعطي لون البشرة ونضارتها الطبيعية، وانعكاس سطحي حاد ناتج عن طبقة الزيوت الطبيعية.',
            'يؤدي فرط إفراز الغدد الدهنية في منطقة الجبهة والأنف والذقن (T-Zone) إلى تكوين طبقة زيتية عاكسة تعطي مظهر اللمعان الدهني المفرط.',
          ],
        },
        {
          title: 'خوارزميات رصد اللمعان في Dr Maher Vision AI',
          paragraphs: [
            'يحلل النظام توزيع قمم السطوع وبؤر الانعكاس المركز في كل منطقة ليميز بوضوح بين النضارة الصحية المتجانسة والتكتلات الدهنية اللامعة.',
          ],
        },
      ],
      faqs: [
        {
          question: 'لماذا تبدو بشرتي لامعة في الصور بينما أشعر بجفافها؟',
          answer: 'فلاش الكاميرا والإضاءة المباشرة يعكسان الضوء بقوة حتى على أقل طبقة زيتية سطحية، مما يظهر لمعانًا مبالغًا فيه في الصور.',
        },
      ],
    },
  },
  'under-eye-darkness': {
    en: {
      slug: '/skin-analysis/under-eye-darkness',
      badge: 'Skin Topic Guide',
      title: 'Periorbital Under-Eye Darkness Guide',
      subtitle: 'Photographic evaluation of infraorbital skin darkness, vascular pooling, structural shadows, and periorbital hyperpigmentation.',
      lastUpdated: 'October 2026',
      reviewer: 'Dr. Maher Mahmoud, Consultant Dermatologist',
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Skin Analysis', path: '/skin-analysis' },
        { name: 'Under-Eye Darkness', path: '/skin-analysis/under-eye-darkness' },
      ],
      sections: [
        {
          title: 'Anatomy of the Infraorbital Zone',
          paragraphs: [
            'The skin surrounding the eyes is the thinnest on the human body (approximately 0.5 mm thick, compared to 2.0 mm on the cheeks). Because of this exceptional delicacy, underlying venous capillary plexuses and orbital fat pads directly influence surface appearance.',
            'Periorbital darkness typically stems from three distinct etiologies: true melanin hyperpigmentation, vascular pooling (stagnant microcirculation visible through translucent skin), and structural hollow shadows along the tear trough.',
          ],
        },
        {
          title: 'Digital Measurement Principles',
          paragraphs: [
            'Dr Maher Vision AI v3.5 computes the infraorbital lightness differential ($\Delta L^*$) by comparing under-eye skin to adjacent malar cheek skin under calibrated lighting. Downward-angled lighting is flagged to prevent overhead room lights from casting false structural shadows.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Can eye creams completely cure under-eye dark circles?',
          answer: 'If the darkness is caused by structural orbital hollows or genetic thin skin, topical creams offer modest benefits; clinical dermal filler or laser treatments are often more effective.',
        },
      ],
    },
    ar: {
      slug: '/skin-analysis/under-eye-darkness',
      badge: 'دليل موضوعات البشرة',
      title: 'دليل الهالات السوداء ومحيط العينين',
      subtitle: 'التقييم الفوتوغرافي لغمقان أسفل العينين، الركود الوعائي، الظلال الهيكلية، والتصبغات المحيطة بالحجاج.',
      lastUpdated: 'أكتوبر 2026',
      reviewer: 'د. ماهر محمود، استشاري الأمراض الجلدية',
      breadcrumbs: [
        { name: 'الرئيسية', path: '/' },
        { name: 'تحليل البشرة', path: '/skin-analysis' },
        { name: 'الهالات السوداء', path: '/skin-analysis/under-eye-darkness' },
      ],
      sections: [
        {
          title: 'تشريح منطقة تحت العينين',
          paragraphs: [
            'جلد محيط العينين هو الأرق في جسم الإنسان على الإطلاق (سمكه حوالي 0.5 ملم فقط مقارنة بـ 2 ملم في الخد). بسبب هذه الرقة، تظهر الأوعية الدموية الدقيقة وتجاويف عظام الحجاج بوضوح على مظهر الجلد الخارجي.',
            'تنقسم الهالات السوداء إلى 3 أسباب رئيسية: تصبغ صبغي حقيقي (ميلانين)، ركود دموي وعائي شفاف، أو ظلال ناتجة عن تجويف مجرى الدموع (Tear Trough).',
          ],
        },
        {
          title: 'مبادئ القياس الرقمي في النظام',
          paragraphs: [
            'يقيس محرك Dr Maher Vision AI v3.5 فرق الإضاءة النسبي ($\Delta L^*$) بين جلد تحت العين وأعلى الخد المجاور مع التحقق من زاوية الإضاءة لمنع الظلال السقفية من تضخيم النتيجة.',
          ],
        },
      ],
      faqs: [
        {
          question: 'هل تعالج كريمات العين الهالات السوداء نهائيًا؟',
          answer: 'إذا كانت الهالات ناتجة عن تجويف عظمي أو رقة وراثية في الجلد، فإن الكريمات تقدم تحسنًا محدودًا، ويكون العلاج الإكلينيكي بحقن الفيلر أو جلسات الليزر أكثر فعالية.',
        },
      ],
    },
  },
};

