import RootDocument from '@/components/RootDocument';
import { rootMetadata } from '@/lib/site-metadata';

export const metadata = rootMetadata('en');
export { viewport } from '@/lib/site-metadata';

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
