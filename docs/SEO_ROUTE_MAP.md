# Dr Maher Vision AI v3.0 & SkinScan — Multi-Page SEO Route Map

**Product:** SkinScan by Dr. Maher Mahmoud Clinics  
**Engine:** Dr Maher Vision AI v3.0  
**Updated:** October 2026  
**Architecture:** Next.js App Router bilingual routing (`app/(en)/` for English and `app/ar/` for Arabic).

---

## 1. Overview & SEO Philosophy

SkinScan is engineered with a strict multi-page architecture ensuring that every core functional page, clinical topic, and educational guide has its own distinct, crawlable, and indexable canonical URL in both English and Arabic.

- **Zero Cloaking / True Parity:** Every page exists identically in English (`/path`) and Arabic (`/ar/path`), featuring full bi-directional `hreflang` alternate links and localized Schema.org JSON-LD structured data.
- **Privacy Gating:** Educational and clinic information pages are indexed (`index: true, follow: true`). Transient scan results and backend API endpoints (`/api/*`) are strictly excluded from indexing (`noindex, nofollow` / `robots.txt` disallow).
- **Medical Schema Integrity:** Core clinic and educational pages feature Schema.org `MedicalClinic`, `MedicalWebPage`, and `BreadcrumbList` microdata.

---

## 2. Complete URL Hierarchy & Metadata Dictionary

| English URL | Arabic URL | Primary Topic / Purpose | Canonical Alternates | Structured Data |
|---|---|---|---|---|
| `/` | `/ar` | Interactive Home & Overview | `en`: `/`, `ar`: `/ar`, `x-default`: `/` | `MedicalClinic`, `WebPage` |
| `/scan` | `/ar/scan` | Dedicated Scanner Route | `en`: `/scan`, `ar`: `/ar/scan` | `MedicalWebPage`, `BreadcrumbList` |
| `/about` | `/ar/about` | Dr. Maher Mahmoud Clinics & Team | `en`: `/about`, `ar`: `/ar/about` | `MedicalClinic`, `BreadcrumbList` |
| `/how-it-works` | `/ar/how-it-works` | 13-Stage Vision AI Pipeline | `en`: `/how-it-works`, `ar`: `/ar/how-it-works` | `MedicalWebPage`, `BreadcrumbList` |
| `/features` | `/ar/features` | 24 Regions & 7 Skin Metrics | `en`: `/features`, `ar`: `/ar/features` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis` | `/ar/skin-analysis` | Photographic Skin Analysis Hub | `en`: `/skin-analysis`, `ar`: `/ar/skin-analysis` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/pores` | `/ar/skin-analysis/pores` | Facial Pores & Nyquist Optical Gate | `en`: `/skin-analysis/pores`, `ar`: `/ar/skin-analysis/pores` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/acne` | `/ar/skin-analysis/acne` | Blemish & Acne-Like Mark Detection | `en`: `/skin-analysis/acne`, `ar`: `/ar/skin-analysis/acne` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/pigmentation` | `/ar/skin-analysis/pigmentation` | Melanin Distribution & Dark Spots | `en`: `/skin-analysis/pigmentation`, `ar`: `/ar/skin-analysis/pigmentation` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/redness` | `/ar/skin-analysis/redness` | Facial Erythema & Microcirculation | `en`: `/skin-analysis/redness`, `ar`: `/ar/skin-analysis/redness` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/skin-texture` | `/ar/skin-analysis/skin-texture` | Microrelief & Surface Roughness | `en`: `/skin-analysis/skin-texture`, `ar`: `/ar/skin-analysis/skin-texture` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/skin-shine` | `/ar/skin-analysis/skin-shine` | Specular Sebum & T-Zone Highlights | `en`: `/skin-analysis/skin-shine`, `ar`: `/ar/skin-analysis/skin-shine` | `MedicalWebPage`, `BreadcrumbList` |
| `/skin-analysis/under-eye-darkness` | `/ar/skin-analysis/under-eye-darkness` | Periorbital Dark Circles & Hollows | `en`: `/skin-analysis/under-eye-darkness`, `ar`: `/ar/skin-analysis/under-eye-darkness` | `MedicalWebPage`, `BreadcrumbList` |
| `/contact` | `/ar/contact` | Clinic Branches (Cairo, Alexandria) | `en`: `/contact`, `ar`: `/ar/contact` | `MedicalClinic`, `BreadcrumbList` |
| `/privacy` | `/ar/privacy` | Ephemeral Photo Privacy Pledge | `en`: `/privacy`, `ar`: `/ar/privacy` | `WebPage`, `BreadcrumbList` |
| `/terms` | `/ar/terms` | Terms of Informational Use | `en`: `/terms`, `ar`: `/ar/terms` | `WebPage`, `BreadcrumbList` |

---

## 3. Per-Page Technical Details

### 3.1. Interactive Scanner (`/scan` & `/ar/scan`)
- **Title (EN):** `Start Skin Scan | SkinScan by Dr Maher`
- **Title (AR):** `بدء فحص البشرة | SkinScan من د. ماهر`
- **Meta Description:** Confidential in-browser facial skin analysis powered by Dr Maher Vision AI v3.0.
- **Robots:** `index: true, follow: true`

### 3.2. About the Clinic & Vision AI (`/about` & `/ar/about`)
- **Title (EN):** `About Dr. Maher Mahmoud Clinics & Vision AI | SkinScan by Dr Maher`
- **Title (AR):** `عن عيادات د. ماهر محمود وتقنية الذكاء الاصطناعي | SkinScan من د. ماهر`
- **Focus:** Clinical credentials of Dr. Maher Mahmoud, 15+ years in dermatology/laser, medical team ethics, and zero-storage privacy mandate.

### 3.3. How It Works (`/how-it-works` & `/ar/how-it-works`)
- **Title (EN):** `How It Works — 13-Stage Vision AI Pipeline | SkinScan by Dr Maher`
- **Title (AR):** `كيف يعمل الفحص — مسار الذكاء الاصطناعي ذو 13 مرحلة | SkinScan من د. ماهر`
- **Focus:** Complete architectural breakdown: BlazeFace SSD, 478 MediaPipe 3D Mesh, Procrustes alignment, Action Unit expression gating, veto segmentation, 24 zero-overlap anatomical regions, and deterministic Hessian scoring.

### 3.4. Features & Regions (`/features` & `/ar/features`)
- **Title (EN):** `Features: 24 Anatomical Regions & 7 Skin Metrics | SkinScan by Dr Maher`
- **Title (AR):** `المميزات: 24 منطقة تشريحية و7 مقاييس للبشرة | SkinScan من د. ماهر`
- **Focus:** The 24 canonical landmark-delineated facial regions, mutual exclusivity, and the 7 skin dimensions (spots, redness, pigmentation, texture, shine, pores, under-eye).

### 3.5. Photographic Skin Analysis Hub (`/skin-analysis` & `/ar/skin-analysis`)
- **Title (EN):** `Photographic Facial Skin Analysis Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل تحليل بشرة الوجه الفوتوغرافي | SkinScan من د. ماهر`
- **Focus:** Comprehensive educational index linking to in-depth guides for every evaluated skin characteristic.

### 3.6. Facial Pores Guide (`/skin-analysis/pores` & `/ar/skin-analysis/pores`)
- **Title (EN):** `Facial Pores & Optical Resolution Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل مسام الوجه والدقة البصرية | SkinScan من د. ماهر`
- **Focus:** Follicular ostia biology, the Nyquist-Shannon optical resolution barrier ($\ge 4.5\text{ px/mm}$), and rejection of synthetic pore hallucination.

### 3.7. Blemishes & Acne Marks (`/skin-analysis/acne` & `/ar/skin-analysis/acne`)
- **Title (EN):** `Blemish & Acne Mark Analysis Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل تحليل البقع وآثار حب الشباب | SkinScan من د. ماهر`
- **Focus:** Multi-scale Difference-of-Gaussians with Hessian curvature checks, mapped to Hayashi clinical count bands.

### 3.8. Pigmentation & Melanin (`/skin-analysis/pigmentation` & `/ar/skin-analysis/pigmentation`)
- **Title (EN):** `Facial Pigmentation & Melanin Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل تصبغات الوجه وتوزيع الميلانين | SkinScan من د. ماهر`
- **Focus:** CIE L*a*b* chrominance separation for solar lentigines, post-inflammatory hyperpigmentation, and tone uniformity.

### 3.9. Redness & Erythema (`/skin-analysis/redness` & `/ar/skin-analysis/redness`)
- **Title (EN):** `Facial Redness & Erythema Analysis Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل احمرار الوجه والحمامى الجلدية | SkinScan من د. ماهر`
- **Focus:** Superficial microvasculature, capillary flushing, illumination-normalized $a^*$ color channel, and tone-adaptive calibration across Fitzpatrick I–VI.

### 3.10. Skin Texture & Roughness (`/skin-analysis/skin-texture` & `/ar/skin-analysis/skin-texture`)
- **Title (EN):** `Skin Texture & Surface Roughness Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل ملمس البشرة والخشونة السطحية | SkinScan من د. ماهر`
- **Focus:** Epidermal microrelief, sulci cutis, high-frequency gradient variance, and stratum corneum hydration cues.

### 3.11. Skin Shine & Sebum (`/skin-analysis/skin-shine` & `/ar/skin-analysis/skin-shine`)
- **Title (EN):** `Skin Shine & Sebum Reflection Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل لمعان البشرة وانعكاس الدهون | SkinScan من د. ماهر`
- **Focus:** Specular Fresnel reflection vs diffuse subsurface radiance, T-zone sebum clustering, and flash reflection discrimination.

### 3.12. Periorbital Under-Eye Darkness (`/skin-analysis/under-eye-darkness` & `/ar/skin-analysis/under-eye-darkness`)
- **Title (EN):** `Periorbital Under-Eye Darkness Guide | SkinScan by Dr Maher`
- **Title (AR):** `دليل الهالات السوداء ومحيط العينين | SkinScan من د. ماهر`
- **Focus:** 0.5 mm eyelid skin delicacy, infraorbital lightness differential ($\Delta L^*$), venous pooling, and tear trough shadow discrimination.

### 3.13. Contact & Clinic Branches (`/contact` & `/ar/contact`)
- **Title (EN):** `Contact Dr. Maher Mahmoud Clinics | SkinScan by Dr Maher`
- **Title (AR):** `اتصل بعيادات د. ماهر محمود | SkinScan من د. ماهر`
- **Focus:** Mohandessin and Nasr City branches in Cairo, Alexandria branch, official telephone and WhatsApp booking contacts.

---

## 4. Technical SEO Specifications

### 4.1. Structured Data Schema Generators
Located in `lib/site-metadata.ts`:
- `buildMedicalOrganizationSchema(locale)`: Generates `MedicalClinic` schema linking Dr. Maher Mahmoud Clinics, address, medical specialties (Dermatology, Laser, Aesthetic), and official URL.
- `buildBreadcrumbSchema(items, locale)`: Generates semantic `BreadcrumbList` linking every parent hierarchy level with canonical locale paths.
- `buildMedicalWebPageSchema(title, description, path, locale)`: Generates `MedicalWebPage` with target audience and medical review credentials.

### 4.2. Sitemap (`app/sitemap.ts`)
- Automatically compiles all 16 routes × 2 locales (32 total URLs).
- Sets appropriate `changeFrequency` (`weekly` for home/scanner, `monthly` for educational and legal guides).
- Provides cross-language `alternates` with reciprocal language URLs in each entry.

### 4.3. Robots Policy (`app/robots.ts`)
- `allow: '/'` allows public indexing across all educational and functional routes.
- `disallow: ['/api/']` prevents web crawlers from invoking inference endpoints or leaking server resources.
- Points directly to the absolute canonical XML sitemap location.

