import type { Locale } from '@/lib/i18n';
import { ENGINE_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';
import type { LegalContent } from './LegalPage';

const booking = (path: string) => {
  const url = `${publicConfig.clinicUrl}${path}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inlineLink">
      {url.replace(/^https?:\/\//, '')}
    </a>
  );
};

const en: LegalContent = {
  badge: 'Terms of Use',
  title: 'Terms of Use',
  subtitle: 'The terms for using SkinScan by Dr Maher, provided by Dr. Maher Mahmoud Clinics.',
  updated: 'Last updated: October 2026',
  sections: [
    {
      title: 'Important: not a medical diagnosis',
      intro: (
        <>
          SkinScan by Dr Maher is an informational skin-analysis tool powered by {ENGINE_NAME}. It is{' '}
          <strong>not a medical diagnosis</strong>, a diagnostic test or a treatment plan.
        </>
      ),
      items: [
        <>
          <strong>No doctor–patient relationship:</strong> running a scan does not create a doctor–patient relationship
          with Dr. Maher Mahmoud or any doctor at the Clinic.
        </>,
        <>
          <strong>See a dermatologist:</strong> results describe what was visible in one photo and cannot replace an
          examination by a dermatologist.
        </>,
        <>
          <strong>Don’t wait on a scan:</strong> if a spot or mole changes, grows, bleeds, itches or hurts, see a doctor
          promptly whatever the scan shows.
        </>,
      ],
    },
    {
      title: '1. Agreement',
      intro:
        'By using SkinScan you agree to these Terms of Use and to our Privacy Policy. If you do not agree, please do not use SkinScan.',
    },
    {
      title: '2. Eligibility and your account',
      intro: 'Scans require a Dr. Maher Mahmoud Clinics patient account.',
      items: [
        'You must be at least 18 years old, or have the consent of a parent or legal guardian.',
        'Keep your sign-in details private; you are responsible for activity under your account.',
      ],
    },
    {
      title: '3. Acceptable use',
      items: [
        'Only scan photos of yourself, or of someone who has given you permission.',
        'Use real, unedited photos; filters and heavy make-up make results unreliable.',
        'Do not use SkinScan automatically or in bulk, and do not try to disrupt or misuse the service.',
      ],
    },
    {
      title: '4. Intellectual property',
      intro: (
        <>
          The SkinScan name, design and the Clinic’s measurement methods belong to Dr. Maher Mahmoud Clinics. SkinScan
          also uses open-source models and software under their own licences (for example Google MediaPipe models under
          the Apache License 2.0).
        </>
      ),
    },
    {
      title: '5. Limitation of liability',
      intro:
        'SkinScan is provided “as is” for information. To the extent permitted by Egyptian law, the Clinic gives no warranty that automated results are complete or clinically accurate, and is not liable for decisions made in reliance on them.',
    },
    {
      title: '6. Booking a consultation',
      intro: <>For a diagnosis or treatment, book a consultation with the Clinic’s dermatologists: {booking('/book')}</>,
    },
  ],
};

const ar: LegalContent = {
  badge: 'شروط الاستخدام',
  title: 'شروط الاستخدام',
  subtitle: 'شروط استخدام SkinScan من د. ماهر، المقدَّم من عيادات د. ماهر محمود.',
  updated: 'آخر تحديث: أكتوبر 2026',
  sections: [
    {
      title: 'هام: ليس تشخيصًا طبيًا',
      intro: (
        <>
          SkinScan من د. ماهر أداة لتحليل البشرة لأغراض المعلومات تعمل بتقنية {ENGINE_NAME}. وهي{' '}
          <strong>ليست تشخيصًا طبيًا</strong> ولا اختبارًا تشخيصيًا ولا خطة علاج.
        </>
      ),
      items: [
        <>
          <strong>لا تنشأ علاقة طبيب ومريض:</strong> إجراء الفحص لا يُنشئ علاقة طبيب ومريض مع د. ماهر محمود أو أي طبيب في
          العيادة.
        </>,
        <>
          <strong>استشر طبيب الجلدية:</strong> تصف النتائج ما ظهر في صورة واحدة، ولا تغني عن الكشف لدى طبيب الجلدية.
        </>,
        <>
          <strong>لا تنتظر نتيجة الفحص:</strong> إذا تغيّرت بقعة أو شامة أو كبرت أو نزفت أو سببت حكة أو ألمًا، فاستشر
          الطبيب سريعًا مهما كانت نتيجة الفحص.
        </>,
      ],
    },
    {
      title: '1. الموافقة',
      intro: 'باستخدامك SkinScan فإنك توافق على شروط الاستخدام هذه وعلى سياسة الخصوصية. إذا لم توافق، يُرجى عدم استخدام SkinScan.',
    },
    {
      title: '2. الأهلية وحسابك',
      intro: 'يتطلب الفحص حسابًا كمريض في عيادات د. ماهر محمود.',
      items: [
        'يجب ألا يقل عمرك عن 18 عامًا، أو أن تحصل على موافقة أحد الوالدين أو الولي القانوني.',
        'حافظ على سرية بيانات تسجيل الدخول؛ فأنت مسؤول عن النشاط الذي يتم من خلال حسابك.',
      ],
    },
    {
      title: '3. الاستخدام المقبول',
      items: [
        'افحص صورك أنت فقط، أو صور شخص أذن لك بذلك.',
        'استخدم صورًا حقيقية دون تعديل؛ فالفلاتر والمكياج الكثيف يجعلان النتائج غير موثوقة.',
        'لا تستخدم SkinScan بشكل آلي أو بأعداد كبيرة، ولا تحاول تعطيل الخدمة أو إساءة استخدامها.',
      ],
    },
    {
      title: '4. الملكية الفكرية',
      intro: (
        <>
          اسم SkinScan وتصميمه وطرق القياس الخاصة بالعيادة مملوكة لعيادات د. ماهر محمود. ويستخدم SkinScan أيضًا نماذج
          وبرمجيات مفتوحة المصدر وفق تراخيصها الخاصة (مثل نماذج Google MediaPipe بموجب ترخيص Apache 2.0).
        </>
      ),
    },
    {
      title: '5. حدود المسؤولية',
      intro:
        'يُقدَّم SkinScan «كما هو» لأغراض المعلومات. وفي الحدود التي يسمح بها القانون المصري، لا تضمن العيادة اكتمال النتائج الآلية أو دقتها السريرية، ولا تتحمل المسؤولية عن القرارات المتخذة اعتمادًا عليها.',
    },
    {
      title: '6. حجز استشارة',
      intro: <>للتشخيص أو العلاج، احجز استشارة مع أطباء الجلدية في العيادة: {booking('/ar/book')}</>,
    },
  ],
};

export const TERMS: Record<Locale, LegalContent> = { en, ar };
