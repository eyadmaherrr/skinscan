'use client';

import { createContext, Fragment, useContext, type ReactNode } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import { messages, type Messages } from '@/lib/messages';

interface LocaleValue {
  locale: Locale;
  t: Messages;
  /** This page's path in the current language ("/terms" -> "/ar/terms"). */
  href: (path: string) => string;
}

const LocaleContext = createContext<LocaleValue>({ locale: 'en', t: messages('en'), href: (p) => p });

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale, t: messages(locale), href: (path) => localePath(path, locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n(): LocaleValue {
  return useContext(LocaleContext);
}

/** "I agree to the {terms}" + { terms: <a/> } -> ["I agree to the ", <a/>]. */
export function fill(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{key && key in nodes ? nodes[key] : part}</Fragment>;
  });
}
