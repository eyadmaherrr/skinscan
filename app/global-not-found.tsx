import type { Metadata } from 'next';
import RootDocument from '@/components/RootDocument';
import StatusPage from '@/components/StatusPage';
import { messages } from '@/lib/messages';

// English (app/(en)) and Arabic (app/ar) have their own root layouts and
// catch-all 404s; this is the fallback for anything routed outside them.
export const metadata: Metadata = {
  title: `${messages('en').status.notFound.meta} | ${messages('en').siteName}`,
};

export default function GlobalNotFound() {
  return (
    <RootDocument locale="en">
      <StatusPage kind="notFound" />
    </RootDocument>
  );
}
