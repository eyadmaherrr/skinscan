import RootDocument from '@/components/RootDocument';
import { rootMetadata } from '@/lib/site-metadata';

export const metadata = rootMetadata('ar');
export { viewport } from '@/lib/site-metadata';

/** The Arabic site (right-to-left) at /ar. */
export default function ArabicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument locale="ar">{children}</RootDocument>;
}
