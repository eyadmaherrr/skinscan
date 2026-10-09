import type { Metadata } from 'next';
import StatusPage from '@/components/StatusPage';
import { messages } from '@/lib/messages';

/** Maintenance page: the proxy sends visitors here while the clinic's site lock is on. */
export const metadata: Metadata = {
  title: `${messages('en').status.unavailable.meta} | ${messages('en').siteName}`,
  robots: { index: false, follow: false },
};

export default function ServiceUnavailable() {
  return <StatusPage kind="unavailable" />;
}
