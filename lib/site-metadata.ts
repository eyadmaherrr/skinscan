import type { Metadata, Viewport } from 'next';
import { PRODUCTION_URL, SITE_NAME, CLINIC_NAME, ENGINE_NAME } from './brand';
import { localePath, type Locale } from './i18n';
import { messages } from './messages';
import { publicConfig } from './public-config';

/** Default descriptions by language. */
const DEFAULT_DESCRIPTION: Record<Locale, string> = {
  en: 'Analyze visible skin characteristics from a facial photo using Dr Maher Vision AI v3.5 computer vision. Informational only — not a medical diagnosis.',
  ar: 'حلّل الخصائص الظاهرة لبشرتك من صورة للوجه باستخدام الرؤية الحاسوبية Dr Maher Vision AI v3.5. لأغراض المعلومات فقط، وليس تشخيصًا طبيًا.',
};

export interface PageMetaInfo {
  title: string;
  description: string;
  keywords?: string[];
}

/** Predefined metadata for all multi-page website routes in English and Arabic. */
export const ROUTE_METADATA: Record<string, Record<Locale, PageMetaInfo>> = {
  '/': {
    en: {
      title: `${SITE_NAME} | AI Facial Skin Analysis by Dr Maher Mahmoud`,
      description: 'Free, private AI-powered facial skin analysis from Dr. Maher Mahmoud Clinics. Evaluates 24 anatomical facial regions across 6 skin characteristics with instant local processing.',
      keywords: ['skin analysis', 'AI dermatology', 'facial scan', 'Dr Maher Mahmoud', 'skin care AI', 'facial regions'],
    },
    ar: {
      title: `SkinScan من د. ماهر | فحص وتحليل بشرة الوجه بالذكاء الاصطناعي`,
      description: 'فحص فوري وخاص لبشرة الوجه بالذكاء الاصطناعي من عيادات د. ماهر محمود. يحلل 24 منطقة تشريحية في الوجه عبر 6 خصائص للبشرة مع معالجة محلية بالكامل.',
      keywords: ['تحليل البشرة', 'فحص الوجه بالذكاء الاصطناعي', 'عيادات دكتور ماهر محمود', 'العناية بالبشرة', 'جلدية وتجميل'],
    },
  },
  '/scan': {
    en: {
      title: `Start Skin Scan | ${SITE_NAME}`,
      description: 'Launch the interactive camera or upload a photo for confidential in-browser facial skin analysis using Dr Maher Vision AI v3.5.',
      keywords: ['skin scan online', 'take face photo', 'skin analysis camera', 'confidential skin test'],
    },
    ar: {
      title: `بدء فحص البشرة | ${SITE_NAME}`,
      description: 'شغّل كاميرا الفحص التفاعلية أو ارفع صورة لتحليل فوري وخاص لملامح وبشرة الوجه عبر Dr Maher Vision AI v3.5.',
      keywords: ['بدء فحص البشرة', 'كاميرا فحص الوجه', 'تحليل مباشر للبشرة', 'فحص خصوصي'],
    },
  },
  '/about': {
    en: {
      title: `About Dr. Maher Mahmoud Clinics & Vision AI | ${SITE_NAME}`,
      description: 'Learn about Dr. Maher Mahmoud Clinics, our clinical dermatology team, patient privacy pledges, and the principles behind Dr Maher Vision AI v3.5.',
      keywords: ['about Dr Maher Mahmoud', 'dermatology clinics Cairo', 'skin doctor Egypt', 'AI ethics dermatology'],
    },
    ar: {
      title: `عن عيادات د. ماهر محمود وتقنية الذكاء الاصطناعي | ${SITE_NAME}`,
      description: 'تعرف على عيادات د. ماهر محمود وفريق أطباء الجلدية، وتعهدات حماية خصوصية المرضى، والأسس العلمية لمحرك Dr Maher Vision AI v3.5.',
      keywords: ['عن دكتور ماهر محمود', 'عيادات جلدية في مصر', 'استشاري جلدية وتجميل', 'أخلاقيات الذكاء الاصطناعي'],
    },
  },
  '/how-it-works': {
    en: {
      title: `How It Works — 13-Stage Vision AI Pipeline | ${SITE_NAME}`,
      description: 'Explore the 13-stage computer vision architecture of Dr Maher Vision AI v3.5: BlazeFace detection, 478 MediaPipe landmarks, zero-overlap 24-region segmentation, and deterministic scoring.',
      keywords: ['how skin scan works', 'facial landmarks 478', 'skin segmentation', 'computer vision pipeline', 'difference of gaussians skin'],
    },
    ar: {
      title: `كيف يعمل الفحص — مسار الذكاء الاصطناعي ذو 13 مرحلة | ${SITE_NAME}`,
      description: 'تعرف على معمارية الرؤية الحاسوبية في Dr Maher Vision AI v3.5: كشف الوجه BlazeFace، 478 نقطة تشريحية، تقسيم 24 منطقة دون تداخل، وحسابات دقيقة غير عشوائية.',
      keywords: ['كيف يعمل فحص البشرة', 'معمارية الرؤية الحاسوبية', 'نقاط الوجه 478', 'تقسيم مناطق الوجه', 'خوارزميات تحليل البشرة'],
    },
  },
  '/features': {
    en: {
      title: `Features: 24 Anatomical Regions & 6 Skin Metrics | ${SITE_NAME}`,
      description: 'Detailed overview of the 24 canonical facial regions analyzed by Dr Maher Vision AI v3.5 and the 6 evaluated skin characteristics: spots, redness, pigmentation, texture, shine and dark circles.',
      keywords: ['facial skin regions', 'forehead skin', 'cheek analysis', 'periorbital darkness', 'facial sebum analysis'],
    },
    ar: {
      title: `المميزات: 24 منطقة تشريحية و6 مقاييس للبشرة | ${SITE_NAME}`,
      description: 'نظرة شاملة على الـ 24 منطقة تشريحية في الوجه التي يحللها محرك Dr Maher Vision AI v3.5 وخصائص البشرة الست: البقع، الاحمرار، التصبغ، الملمس، اللمعان، والهالات.',
      keywords: ['مناطق تشريح الوجه', 'تحليل بشرة الخد والجبهة', 'مقاييس البشرة الست', 'هالات العينين'],
    },
  },
  '/skin-analysis': {
    en: {
      title: `Photographic Facial Skin Analysis Guide | ${SITE_NAME}`,
      description: 'Comprehensive guide to photographic facial skin evaluation, clinical light requirements, digital measurement boundaries, and non-diagnostic computer vision principles.',
      keywords: ['facial skin analysis guide', 'photographic skin assessment', 'Fitzpatrick skin types', 'facial dermatology education'],
    },
    ar: {
      title: `دليل تحليل بشرة الوجه الفوتوغرافي | ${SITE_NAME}`,
      description: 'دليل شامل لتقييم بشرة الوجه بالصور الفوتوغرافية، متطلبات الإضاءة السريرية، حدود القياس الرقمي، ومبادئ الرؤية الحاسوبية غير التشخيصية.',
      keywords: ['دليل تحليل البشرة بالصور', 'تقييم فوتوغرافي للجلد', 'أنواع البشرة فيتزباتريك', 'تثقيف طب الجلد'],
    },
  },
  '/skin-analysis/acne': {
    en: {
      title: `Blemish & Acne Mark Analysis Guide | ${SITE_NAME}`,
      description: 'Digital detection of visible facial blemishes, red spots, and papule-like markings using multi-scale Hessian curvature and Hayashi count scales.',
      keywords: ['acne mark analysis', 'blemish detection', 'facial spot count', 'Hayashi scale', 'red spots skin AI'],
    },
    ar: {
      title: `دليل تحليل البقع وآثار حب الشباب | ${SITE_NAME}`,
      description: 'الكشف الرقمي عن البقع الظاهرة في الوجه، النقط الحمراء، والعلامات الشبيهة بالحبوب باستخدام تدرج كيرفاتشر الهيسي ومقاييس هاياشي المعتمدة.',
      keywords: ['تحليل حب الشباب', 'كشف بقع الوجه', 'عد بقع البشرة', 'مقياس هاياشي', 'احمرار الحبوب'],
    },
  },
  '/skin-analysis/pigmentation': {
    en: {
      title: `Facial Pigmentation & Melanin Guide | ${SITE_NAME}`,
      description: 'How computer vision quantifies melanin contrast, localized dark patches, solar lentigines, and color uniformity in CIE L*a*b* color space.',
      keywords: ['skin pigmentation analysis', 'melanin distribution', 'dark spots face', 'uneven skin tone', 'solar lentigines'],
    },
    ar: {
      title: `دليل تصبغات الوجه وتوزيع الميلانين | ${SITE_NAME}`,
      description: 'كيف تقيس الرؤية الحاسوبية تباين الميلانين، البقع الداكنة الموضعية، التصبغات الشمسية، وتجانس اللون في الفضاء اللوني CIE L*a*b*.',
      keywords: ['تصبغات الوجه', 'توزيع الميلانين', 'البقع الداكنة', 'توحيد لون البشرة', 'التصبغات الشمسية'],
    },
  },
  '/skin-analysis/redness': {
    en: {
      title: `Facial Redness & Erythema Analysis Guide | ${SITE_NAME}`,
      description: 'Measurement of vascular flushing, erythema, and capillary contrast on cheeks and nose with illumination normalization and tone-adaptive thresholds.',
      keywords: ['facial redness', 'erythema measurement', 'capillary flushing', 'sensitive skin', 'a-star color redness'],
    },
    ar: {
      title: `دليل احمرار الوجه والحمامى الجلدية | ${SITE_NAME}`,
      description: 'قياس التورد الوعائي، الحمامى، وتباين الشعيرات الدموية في الخدين والأنف مع معادلة الإضاءة وتدرجات متوافقة مع لون البشرة الطبيعي.',
      keywords: ['احمرار الوجه', 'قياس الحمامى الجلدية', 'تورد الأوعية', 'البشرة الحساسة', 'احمرار الخدين'],
    },
  },
  '/skin-analysis/skin-texture': {
    en: {
      title: `Skin Texture & Surface Roughness Guide | ${SITE_NAME}`,
      description: 'High-frequency gradient analysis of facial microrelief, roughness, surface uniformity, and barrier hydration cues across anatomical regions.',
      keywords: ['skin texture analysis', 'facial roughness', 'skin microrelief', 'fine lines analysis', 'epidermal barrier texture'],
    },
    ar: {
      title: `دليل ملمس البشرة والخشونة السطحية | ${SITE_NAME}`,
      description: 'تحليل التدرجات عالية التردد لتضاريس البشرة الدقيقة، الخشونة السطحية، تجانس الملمس، وعلامات ترطيب الحاجز الجلدي عبر المناطق التشريحية.',
      keywords: ['ملمس البشرة', 'خشونة الوجه', 'تضاريس الجلد الدقيقة', 'الخطوط الدقيقة', 'تجانس سطح البشرة'],
    },
  },
  '/skin-analysis/skin-shine': {
    en: {
      title: `Skin Shine & Sebum Reflection Guide | ${SITE_NAME}`,
      description: 'Detecting specular highlights, T-zone oiliness, and diffuse luminous radiance while distinguishing healthy skin glow from excessive sebum reflection.',
      keywords: ['skin shine analysis', 'T-zone oiliness', 'specular highlight detection', 'facial sebum', 'skin glow vs oil'],
    },
    ar: {
      title: `دليل لمعان البشرة وانعكاس الدهون | ${SITE_NAME}`,
      description: 'رصد الانعكاسات البصرية اللامعة، دهنية منطقة الـ T-Zone، والوهج المتجانس مع التمييز الدقيق بين نضارة البشرة الصحية وزيادة الإفراز الزهمي.',
      keywords: ['لمعان البشرة', 'دهون منطقة T-Zone', 'انعكاس الضوء على الوجه', 'الإفراز الدهني', 'نضارة الوجه'],
    },
  },
  '/skin-analysis/under-eye-darkness': {
    en: {
      title: `Periorbital Under-Eye Darkness Guide | ${SITE_NAME}`,
      description: 'Photographic evaluation of infraorbital skin darkness, vascular shadows, structural hollow contrast, and periorbital hyperpigmentation.',
      keywords: ['under eye darkness', 'dark circles analysis', 'periorbital hyperpigmentation', 'tear trough shadows', 'infraorbital skin'],
    },
    ar: {
      title: `دليل الهالات السوداء ومحيط العينين | ${SITE_NAME}`,
      description: 'التقييم الفوتوغرافي لغمقان الجلد تحت العينين، الظلال الوعائية، تباين التجويف العظمي، وفرط التصبغ المحيط بالحجاج.',
      keywords: ['الهالات السوداء', 'غمقان تحت العين', 'تصبغات حول العين', 'ظلال تجويف العين', 'العناية بمحيط العين'],
    },
  },
  '/contact': {
    en: {
      title: `Contact Dr. Maher Mahmoud Clinics | ${SITE_NAME}`,
      description: 'Get in touch with Dr. Maher Mahmoud Clinics. View branch addresses in Cairo and Alexandria, phone and WhatsApp contacts, and clinic hours.',
      keywords: ['contact Dr Maher Mahmoud', 'dermatology clinic Cairo address', 'Alexandria dermatology branch', 'book clinic appointment'],
    },
    ar: {
      title: `اتصل بعيادات د. ماهر محمود | ${SITE_NAME}`,
      description: 'تواصل مع عيادات د. ماهر محمود. تعرف على عناوين الفروع في القاهرة والإسكندرية، أرقام الهاتف والواتساب، ومواعيد العمل بالعيادات.',
      keywords: ['اتصل بدكتور ماهر محمود', 'عنوان عيادة الجلدية القاهرة', 'فرع الإسكندرية جلدية', 'حجز كشف العيادة'],
    },
  },
  '/privacy': {
    en: {
      title: `Privacy Policy | ${SITE_NAME}`,
      description: 'SkinScan privacy pledge: photos are processed strictly in volatile memory and never stored, indexed, or shared with third parties.',
      keywords: ['privacy policy', 'photo data privacy', 'ephemeral image processing', 'dermatology AI privacy'],
    },
    ar: {
      title: `سياسة الخصوصية | ${SITE_NAME}`,
      description: 'تعهد خصوصية SkinScan: تُعالج الصور فقط في الذاكرة المؤقتة ولا تُحفظ أو تُفهرس أو تُشارك مع أي أطراف ثالثة على الإطلاق.',
      keywords: ['سياسة الخصوصية', 'خصوصية صور المرضى', 'معالجة مؤقتة للصور', 'أمان البيانات الطبية'],
    },
  },
  '/terms': {
    en: {
      title: `Terms of Use | ${SITE_NAME}`,
      description: 'Terms of Use for SkinScan by Dr Maher Mahmoud Clinics: informational non-diagnostic computer vision tool conditions.',
      keywords: ['terms of use', 'medical scan terms', 'informational disclaimer', 'clinic service terms'],
    },
    ar: {
      title: `شروط الاستخدام | ${SITE_NAME}`,
      description: 'شروط استخدام SkinScan من عيادات د. ماهر محمود: شروط وأحكام أداة الرؤية الحاسوبية التثقيفية غير التشخيصية.',
      keywords: ['شروط الاستخدام', 'إخلاء مسؤولية طبي', 'أحكام الخدمة', 'عيادات دكتور ماهر'],
    },
  },
};

/** Canonical + hreflang links for a page that exists in both languages. */
export function alternates(path: string, locale: Locale): Metadata['alternates'] {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const enUrl = cleanPath === '/' ? '/' : cleanPath;
  const arUrl = localePath(cleanPath, 'ar');

  return {
    canonical: localePath(cleanPath, locale),
    languages: {
      en: enUrl,
      ar: arUrl,
      'x-default': enUrl,
    },
  };
}

/** Complete page metadata builder with preconfigured defaults and custom overrides. */
export function pageMetadata(
  path: string,
  locale: Locale,
  custom?: Partial<PageMetaInfo> & { noindex?: boolean },
): Metadata {
  const routeInfo = ROUTE_METADATA[path]?.[locale];
  const title = custom?.title || routeInfo?.title || `${SITE_NAME} | ${CLINIC_NAME}`;
  const description = custom?.description || routeInfo?.description || DEFAULT_DESCRIPTION[locale];
  const keywords = custom?.keywords || routeInfo?.keywords || [];
  const noindex = custom?.noindex ?? false;
  const t = messages(locale);

  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  const pageUrl = `${baseUrl}${localePath(path, locale)}`;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    keywords,
    applicationName: t.siteName,
    alternates: alternates(path, locale),
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: t.siteName,
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      type: 'website',
      images: [
        {
          url: `${baseUrl}/brand/logo.webp`,
          width: 512,
          height: 512,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [`${baseUrl}/brand/logo.webp`],
    },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  };
}

export function rootMetadata(locale: Locale): Metadata {
  return pageMetadata('/', locale);
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2d4d',
};

/** Schema.org structured data generators for SEO. */

export function buildMedicalOrganizationSchema(locale: Locale) {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: locale === 'ar' ? 'عيادات د. ماهر محمود' : 'Dr. Maher Mahmoud Clinics',
    alternateName: 'SkinScan by Dr Maher',
    url: publicConfig.clinicUrl,
    logo: `${baseUrl}/brand/logo.webp`,
    image: `${baseUrl}/brand/logo.webp`,
    description:
      locale === 'ar'
        ? 'عيادات تخصصية في الأمراض الجلدية والعلاج بالليزر والتجميل الطبي في مصر.'
        : 'Specialized clinic in clinical dermatology, laser therapy, and aesthetic medicine in Egypt.',
    medicalSpecialty: ['Dermatology', 'PlasticSurgery'],
    telephone: '+201000000000',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Cairo',
      addressCountry: 'EG',
    },
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>, locale: Locale) {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${localePath(item.path, locale)}`,
    })),
  };
}

export function buildMedicalWebPageSchema(title: string, description: string, path: string, locale: Locale) {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: title,
    description,
    url: `${baseUrl}${localePath(path, locale)}`,
    inLanguage: locale === 'ar' ? 'ar' : 'en',
    aspect: ['Overview', 'Digital Analysis', 'Skin Health Education'],
    medicalAudience: 'Patients and Public',
    author: {
      '@type': 'MedicalOrganization',
      name: locale === 'ar' ? 'عيادات د. ماهر محمود' : 'Dr. Maher Mahmoud Clinics',
      url: publicConfig.clinicUrl,
    },
  };
}
