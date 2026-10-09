import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { TERMS } from '@/components/legal/terms';
import { messages } from '@/lib/messages';
import { alternates } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: `شروط الاستخدام | ${messages('ar').siteName}`,
  description: 'شروط استخدام SkinScan من د. ماهر: الاستخدام لأغراض المعلومات والتنبيه الطبي والشروط.',
  alternates: alternates('/terms', 'ar'),
};

export default function Page() {
  return <LegalPage locale="ar" content={TERMS.ar} other="privacy" />;
}
