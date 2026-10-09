import type { Locale } from '@/lib/i18n';
import { ENGINE_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';
import type { LegalContent } from './LegalPage';

const site = publicConfig.clinicUrl;
const siteLink = (
  <a href={site} target="_blank" rel="noopener noreferrer" className="inlineLink">
    {site.replace(/^https?:\/\//, '')}
  </a>
);

const en: LegalContent = {
  badge: 'Privacy Policy',
  title: 'Privacy & Data Protection',
  subtitle: 'How Dr. Maher Mahmoud Clinics handles your photo and your personal information when you use SkinScan.',
  updated: 'Last updated: October 2026',
  sections: [
    {
      title: 'Your photo is not kept',
      intro: 'A facial photo is sensitive personal data, so SkinScan is built not to keep it:',
      items: [
        <>
          <strong>Not stored:</strong> your photo is never written to disk, a database or cloud storage, and it is not
          logged.
        </>,
        <>
          <strong>In memory only:</strong> it is analysed in the server’s memory and released as soon as your result is
          ready.
        </>,
        <>
          <strong>No outside AI services:</strong> the analysis ({ENGINE_NAME}) runs on the clinic’s own server with
          open-source models. Your photo is not sent to third-party AI services.
        </>,
        <>
          <strong>Not seen by staff:</strong> clinic staff and doctors cannot view your scan photos, because they are not
          kept.
        </>,
      ],
    },
    {
      title: '1. Who we are',
      intro: (
        <>
          Dr. Maher Mahmoud Clinics (“we”, “the Clinic”) operates SkinScan by Dr Maher. We handle personal data in line
          with Egypt’s Personal Data Protection Law (Law No. 151 of 2020).
        </>
      ),
    },
    {
      title: '2. What happens during a scan',
      items: [
        <>
          <strong>In your browser:</strong> your photo is resized and re-saved, which removes hidden metadata such as GPS
          location.
        </>,
        <>
          <strong>In transit:</strong> it is sent over an encrypted HTTPS connection to SkinScan’s server.
        </>,
        <>
          <strong>Analysis:</strong> face and skin measurements run in memory; only the result (scores and explanations)
          is sent back.
        </>,
        <>
          <strong>On your device:</strong> the photo on the results page and the downloadable report are created in your
          browser. Closing the page discards them.
        </>,
      ],
    },
    {
      title: '3. Your clinic account',
      items: [
        <>
          SkinScan uses your Dr. Maher Mahmoud Clinics patient account. You sign in on the clinic website ({siteLink}),
          with email and password or with Google; SkinScan never sees your password.
        </>,
        <>
          To confirm you are signed in, SkinScan checks your session with the clinic website and receives your name and
          email address. They are used only to show who is signed in.
        </>,
        <>Scan results are not saved to your account or anywhere else.</>,
      ],
    },
    {
      title: '4. Cookies and browser storage',
      items: [
        <>
          <strong>Sign-in cookie:</strong> the <code>patient_session</code> cookie keeps you signed in. It is set by the
          clinic website and shared with skinscan.drmahermahmoud.com.
        </>,
        <>
          <strong>No tracking:</strong> SkinScan uses no advertising, analytics or tracking cookies.
        </>,
        <>
          <strong>Browser storage:</strong> your browser remembers that you have seen the cookie notice. Photos are never
          saved in your browser’s storage.
        </>,
      ],
    },
    {
      title: '5. Your rights',
      intro: 'You can ask the Clinic to:',
      items: [
        'give you a copy of the personal information in your patient account;',
        'correct your contact details;',
        'delete your account (you can also do this from your account on the clinic website).',
      ],
      outro: 'Because scan photos are not kept, there is no photo to delete.',
    },
    {
      title: '6. Contact',
      items: [
        <>
          <strong>Clinic:</strong> Dr. Maher Mahmoud Clinics
        </>,
        <>
          <strong>Website:</strong> {siteLink}
        </>,
        <>
          <strong>Branches:</strong> New Cairo, Mohandessin and Sheikh Zayed
        </>,
      ],
    },
  ],
};

const ar: LegalContent = {
  badge: 'سياسة الخصوصية',
  title: 'الخصوصية وحماية البيانات',
  subtitle: 'كيف تتعامل عيادات د. ماهر محمود مع صورتك وبياناتك الشخصية عند استخدام SkinScan.',
  updated: 'آخر تحديث: أكتوبر 2026',
  sections: [
    {
      title: 'لا نحتفظ بصورتك',
      intro: 'صورة الوجه من البيانات الشخصية الحساسة، لذلك صُمم SkinScan بحيث لا يحتفظ بها:',
      items: [
        <>
          <strong>لا يتم حفظها:</strong> لا تُكتب صورتك أبدًا على قرص أو قاعدة بيانات أو تخزين سحابي، ولا تُسجَّل في
          السجلات.
        </>,
        <>
          <strong>في الذاكرة فقط:</strong> تُحلَّل في ذاكرة الخادم ويتم التخلص منها بمجرد جاهزية النتيجة.
        </>,
        <>
          <strong>بدون خدمات ذكاء اصطناعي خارجية:</strong> يعمل التحليل ({ENGINE_NAME}) على خادم العيادة نفسها باستخدام
          نماذج مفتوحة المصدر، ولا تُرسَل صورتك إلى خدمات ذكاء اصطناعي تابعة لجهات أخرى.
        </>,
        <>
          <strong>لا يطّلع عليها الفريق الطبي:</strong> لا يمكن لفريق العيادة أو الأطباء رؤية صور الفحص لأنها لا تُحفظ.
        </>,
      ],
    },
    {
      title: '1. من نحن',
      intro: (
        <>
          تُشغِّل عيادات د. ماهر محمود («نحن»، «العيادة») خدمة SkinScan من د. ماهر. ونتعامل مع البيانات الشخصية وفقًا
          لقانون حماية البيانات الشخصية المصري (القانون رقم 151 لسنة 2020).
        </>
      ),
    },
    {
      title: '2. ماذا يحدث أثناء الفحص',
      items: [
        <>
          <strong>في متصفحك:</strong> يتم تصغير صورتك وإعادة حفظها، مما يزيل البيانات الوصفية المخفية مثل الموقع
          الجغرافي.
        </>,
        <>
          <strong>أثناء الإرسال:</strong> تُرسَل عبر اتصال HTTPS مشفّر إلى خادم SkinScan.
        </>,
        <>
          <strong>التحليل:</strong> تتم قياسات الوجه والبشرة في الذاكرة، ولا يُعاد إلا النتيجة (الدرجات والشروح).
        </>,
        <>
          <strong>على جهازك:</strong> الصورة في صفحة النتائج والتقرير القابل للتنزيل يُنشآن في متصفحك، ويتم التخلص منهما
          عند إغلاق الصفحة.
        </>,
      ],
    },
    {
      title: '3. حسابك في العيادة',
      items: [
        <>
          يستخدم SkinScan حسابك كمريض في عيادات د. ماهر محمود. تسجّل الدخول على موقع العيادة ({siteLink}) بالبريد
          الإلكتروني وكلمة المرور أو باستخدام Google، ولا يطّلع SkinScan على كلمة المرور أبدًا.
        </>,
        <>
          للتأكد من تسجيل دخولك، يتحقق SkinScan من جلستك لدى موقع العيادة ويستلم اسمك وبريدك الإلكتروني، ويُستخدمان فقط
          لإظهار الحساب المسجَّل.
        </>,
        <>لا تُحفظ نتائج الفحص في حسابك ولا في أي مكان آخر.</>,
      ],
    },
    {
      title: '4. ملفات تعريف الارتباط وتخزين المتصفح',
      items: [
        <>
          <strong>ملف تسجيل الدخول:</strong> يُبقيك ملف <code>patient_session</code> مسجَّل الدخول. يضعه موقع العيادة
          ويُشارَك مع skinscan.drmahermahmoud.com.
        </>,
        <>
          <strong>بدون تتبّع:</strong> لا يستخدم SkinScan ملفات تعريف ارتباط للإعلانات أو التحليلات أو التتبّع.
        </>,
        <>
          <strong>تخزين المتصفح:</strong> يتذكر متصفحك أنك اطّلعت على إشعار ملفات تعريف الارتباط. ولا تُحفظ الصور أبدًا
          في تخزين المتصفح.
        </>,
      ],
    },
    {
      title: '5. حقوقك',
      intro: 'يمكنك أن تطلب من العيادة:',
      items: [
        'نسخة من البيانات الشخصية الموجودة في حسابك؛',
        'تصحيح بيانات التواصل الخاصة بك؛',
        'حذف حسابك (ويمكنك ذلك أيضًا من حسابك على موقع العيادة).',
      ],
      outro: 'بما أن صور الفحص لا تُحفظ، فلا توجد صورة لحذفها.',
    },
    {
      title: '6. التواصل',
      items: [
        <>
          <strong>العيادة:</strong> عيادات د. ماهر محمود
        </>,
        <>
          <strong>الموقع الإلكتروني:</strong> {siteLink}
        </>,
        <>
          <strong>الفروع:</strong> القاهرة الجديدة والمهندسين والشيخ زايد
        </>,
      ],
    },
  ],
};

export const PRIVACY: Record<Locale, LegalContent> = { en, ar };
