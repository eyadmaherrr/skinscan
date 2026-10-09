// ======================================================
// WHERE AN ANSWER POINTS (same as drmahermahmoud.com's lib/assistant/links.ts)
// ======================================================
//
// Each FAQ section has a default page on the website (an item can
// override it with 'link' in data/faq.json). 'skinscan:<path>' points to
// SkinScan AI (NEXT_PUBLIC_SKINSCAN_URL), which has an Arabic version at
// /ar like this site.
//
// No imports, so it can be unit-tested with plain Node.

export type AssistantLanguage = 'en' | 'ar';

const SECTION_LINKS: Record<string, string> = {
  general: '/faq',
  booking: '/book',
  online: '/online-appointment',
  appointments: '/account',
  services: '/#services',
  skinscan: 'skinscan:/',
  locations: '/#branches',
  account: '/account',
  login: '/login',
  verification: '/account',
  chat: '/chat',
  payments: '/book',
  privacy: '/privacy',
  technical: '/support',
  contact: '/support',
};

/** Keys of the button labels in the assistant translations. */
export type LinkLabel =
  | 'book'
  | 'onlineAppointment'
  | 'account'
  | 'services'
  | 'branches'
  | 'login'
  | 'chat'
  | 'privacy'
  | 'support'
  | 'faq'
  | 'doctor'
  | 'skinscan'
  | 'skinscanPrivacy';

const LABELS: Record<string, LinkLabel> = {
  '/book': 'book',
  '/online-appointment': 'onlineAppointment',
  '/account': 'account',
  '/#services': 'services',
  '/#branches': 'branches',
  '/login': 'login',
  '/chat': 'chat',
  '/privacy': 'privacy',
  '/support': 'support',
  '/faq': 'faq',
  '/doctor': 'doctor',
  'skinscan:/': 'skinscan',
  'skinscan:/privacy': 'skinscanPrivacy',
};

/** The link for an entry: its own, else its section's. */
export function entryLink(entry: { sectionId: string; link: string | null }): string | null {
  return entry.link ?? SECTION_LINKS[entry.sectionId] ?? null;
}

export function linkLabel(link: string): LinkLabel | null {
  return LABELS[link] ?? null;
}

/** Every page the assistant can link to on this site (for tests). */
export function sitePaths(): string[] {
  return [...new Set([...Object.values(SECTION_LINKS), ...Object.keys(LABELS)])]
    .filter((link) => !link.startsWith('skinscan:'))
    .map((link) => link.split('#')[0]);
}

export type LinkOptions = {
  /** SkinScan AI's address, without a trailing slash. */
  skinscanUrl: string;
  /** This site's page in a language ('/book' -> '/ar/book'); private pages stay as they are. */
  localize: (path: string, language: AssistantLanguage) => string;
};

/** The href for a link in the visitor's language. */
export function resolveLink(link: string, language: AssistantLanguage, options: LinkOptions): string {
  if (link.startsWith('skinscan:')) {
    const path = link.slice('skinscan:'.length) || '/';
    const prefix = language === 'ar' ? '/ar' : '';
    return `${options.skinscanUrl}${prefix}${path === '/' ? '' : path}` || options.skinscanUrl;
  }
  const [path, hash] = link.split('#');
  return `${options.localize(path || '/', language)}${hash ? `#${hash}` : ''}`;
}
