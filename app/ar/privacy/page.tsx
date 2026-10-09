import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY } from '@/components/legal/privacy';
import { messages } from '@/lib/messages';
import { alternates } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: `سياسة الخصوصية | ${messages('ar').siteName}`,
  description: 'سياسة خصوصية SkinScan من د. ماهر: تُحلَّل الصور في الذاكرة ولا تُحفظ أبدًا.',
  alternates: alternates('/privacy', 'ar'),
};

export default function Page() {
  return <LegalPage locale="ar" content={PRIVACY.ar} other="terms" />;
}
