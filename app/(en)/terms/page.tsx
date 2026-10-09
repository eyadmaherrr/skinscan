import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { TERMS } from '@/components/legal/terms';
import { messages } from '@/lib/messages';
import { alternates } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: `Terms of Use | ${messages('en').siteName}`,
  description: 'Terms of Use for SkinScan by Dr Maher: informational use, medical notice and conditions.',
  alternates: alternates('/terms', 'en'),
};

export default function Page() {
  return <LegalPage locale="en" content={TERMS.en} other="privacy" />;
}
