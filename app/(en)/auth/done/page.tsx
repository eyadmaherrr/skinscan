import type { Metadata } from 'next';
import SignInDone from '@/components/SignInDone';

export const metadata: Metadata = {
  title: 'Signing you in',
  robots: { index: false, follow: false },
};

/** Where the clinic's sign-in pop-up window lands (see lib/client/use-auth.tsx). */
export default function Page() {
  return <SignInDone />;
}
