import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY } from '@/components/legal/privacy';
import { messages } from '@/lib/messages';
import { alternates } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: `Privacy Policy | ${messages('en').siteName}`,
  description: 'Privacy Policy for SkinScan by Dr Maher: photos are analysed in memory and never stored.',
  alternates: alternates('/privacy', 'en'),
};

export default function Page() {
  return <LegalPage locale="en" content={PRIVACY.en} other="terms" />;
}
