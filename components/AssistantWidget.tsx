'use client';

import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  MessageCircle,
  RotateCcw,
  ScanFace,
  Send,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useI18n } from './LocaleProvider';
import { assistantText } from '@/lib/assistant/messages';
import { linkLabel, resolveLink, type AssistantLanguage } from '@/lib/assistant/links';
import {
  MAX_MESSAGE_LENGTH,
  type AssistantReply,
  type EntryRef,
  type Localized,
} from '@/lib/assistant/shared';
import { clinicLink } from '@/lib/client/use-auth';
import { localePath, stripLocale } from '@/lib/i18n';
import { publicConfig } from '@/lib/public-config';

// ======================================================
// FLOATING CLINIC AI ASSISTANT (same as drmahermahmoud.com's)
// ======================================================
//
// One launcher (bottom right) opens a panel with three states:
//   choice   — 'How can we help you?': SkinScan AI or Chat with AI;
//   chat     — questions answered from the clinic's published FAQ, by the
//              clinic website's /api/assistant (it allows calls from
//              *.drmahermahmoud.com), so the FAQ stays in one place;
//   SkinScan — the SkinScan AI option goes to the start of the scan.
//
// The assistant has its own language (English/Arabic, starting from the
// site's); switching it changes only the panel, keeps the conversation and
// shows earlier answers in the new language. The conversation lives in
// memory for this page session: minimizing or going back to the choice
// screen keeps it, 'New conversation' clears it, and nothing is stored in
// the browser except the chosen assistant language (sessionStorage).

type Screen = 'choice' | 'chat';

type Ask = { message: string } | { entryId: string };

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'user'; question: Localized }
  | { id: number; role: 'assistant'; reply: AssistantReply }
  | { id: number; role: 'error'; error: 'network' | 'server' | 'rate_limited'; ask: Ask };

/** A message before it gets its id. */
type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, 'id'> : never) : never;

/** The maintenance page keeps visitors on it. */
const HIDDEN_ROUTES = ['/503'];

const API_URL = `${publicConfig.clinicUrl}/api/assistant`;

const LANGUAGE_KEY = 'dr_maher_assistant_language';
const REQUEST_TIMEOUT_MS = 15_000;

function readStoredLanguage(): AssistantLanguage | null {
  try {
    const value = sessionStorage.getItem(LANGUAGE_KEY);
    return value === 'en' || value === 'ar' ? value : null;
  } catch {
    return null;
  }
}

function storeLanguage(language: AssistantLanguage) {
  try {
    sessionStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
}

// Phone numbers, e-mail addresses and web addresses inside FAQ answers:
// shown left-to-right (also in Arabic) and linked. All text is rendered as
// React text, never as HTML.
const TOKEN =
  /(\+?\d[\d\s-]{7,}\d|[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/[^\s]+|(?:[\w-]+\.)+drmahermahmoud\.com(?:\/[^\s]*)?)/g;

function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;

        const trimmed = part.replace(/[.,;:)]+$/, '');
        const rest = part.slice(trimmed.length);
        let href: string;

        if (/^\+?\d/.test(trimmed)) href = `tel:${trimmed.replace(/[\s-]/g, '')}`;
        else if (trimmed.includes('@')) href = `mailto:${trimmed}`;
        else href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

        return (
          <Fragment key={i}>
            <bdi dir="ltr">
              <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                {trimmed}
              </a>
            </bdi>
            {rest}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Keeps the launcher and the panel clear of the cookie banner (which stays
 * on top): each is raised above the banner while the banner reaches it.
 */
function useCookieBannerLift() {
  const [lift, setLift] = useState({ launcher: 0, panel: 0 });

  useEffect(() => {
    let banner: HTMLElement | null = null;
    let resize: ResizeObserver | null = null;

    const measure = () => {
      if (!banner) {
        setLift({ launcher: 0, panel: 0 });
        return;
      }
      // Size and position from layout, not the slide-in transform. The
      // banner is centred horizontally.
      const viewport = window.innerWidth;
      const right = (viewport + banner.offsetWidth) / 2;
      const top = (parseFloat(getComputedStyle(banner).bottom) || 0) + banner.offsetHeight + 12;
      const panelLeft = viewport - 24 - Math.min(390, viewport - 32);
      setLift({
        launcher: right > viewport - 96 ? top : 0,
        panel: right > panelLeft ? top : 0,
      });
    };

    const track = () => {
      const current = document.querySelector<HTMLElement>('.cookie-banner');
      if (current === banner) return;
      resize?.disconnect();
      banner = current;
      resize = banner ? new ResizeObserver(measure) : null;
      if (banner) resize?.observe(banner);
      measure();
    };

    const mutations = new MutationObserver(track);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    track();

    return () => {
      mutations.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return lift;
}

export default function AssistantWidget() {
  const pathname = usePathname() ?? '/';
  const { locale: siteLanguage, href } = useI18n();

  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('choice');
  const [language, setLanguageState] = useState<AssistantLanguage>(siteLanguage);
  const [languageChosen, setLanguageChosen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<EntryRef[]>([]);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const lift = useCookieBannerLift();

  // Each language of SkinScan is its own page load, so the starting
  // language is simply the page's (the panel can switch it).
  const t = assistantText(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const route = stripLocale(pathname);
  const hidden = HIDDEN_ROUTES.some((r) => route === r || route.startsWith(`${r}/`));

  // ==================================================
  // OPEN / MINIMIZE
  // ==================================================

  // Suggested questions come from the clinic website with the answers.
  const loadSuggestions = useCallback(async () => {
    try {
      const response = await fetch(API_URL, { signal: AbortSignal.timeout(8_000) });
      const data = (await response.json()) as { suggestions?: EntryRef[] };
      if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
    } catch {
      // The chat still works without suggestions.
    }
  }, []);

  function openPanel() {
    if (!languageChosen) {
      const stored = readStoredLanguage();
      if (stored) {
        setLanguageState(stored);
        setLanguageChosen(true);
      }
    }
    setOpen(true);
    if (!suggestions.length) void loadSuggestions();
  }

  const minimize = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // Focus: the heading when the panel opens, the input on the chat screen.
  useEffect(() => {
    if (!open) return;
    if (screen === 'chat') inputRef.current?.focus();
    else headingRef.current?.focus();
  }, [open, screen]);

  // Newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, open, screen]);

  function chooseLanguage(next: AssistantLanguage) {
    setLanguageState(next);
    setLanguageChosen(true);
    storeLanguage(next);
  }

  // ==================================================
  // ASKING
  // ==================================================

  const push = (message: NewMessage) =>
    setMessages((list) => [...list, { ...message, id: nextId.current++ } as Message]);

  async function ask(request: Ask) {
    setPending(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 429) {
        push({ role: 'error', error: 'rate_limited', ask: request });
      } else if (!response.ok) {
        push({ role: 'error', error: 'server', ask: request });
      } else {
        const data = (await response.json()) as { reply?: AssistantReply };
        if (data.reply) push({ role: 'assistant', reply: data.reply });
        else push({ role: 'error', error: 'server', ask: request });
      }
    } catch {
      push({ role: 'error', error: 'network', ask: request });
    } finally {
      setPending(false);
    }
  }

  function submit() {
    if (pending) return;
    const text = input.replace(/\s+/g, ' ').trim();
    if (!text) {
      setInputError(t.chat.empty);
      inputRef.current?.focus();
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      setInputError(t.chat.tooLong.replace('{max}', String(MAX_MESSAGE_LENGTH)));
      return;
    }
    setInputError(null);
    setInput('');
    push({ role: 'user', text });
    void ask({ message: text });
  }

  function askEntry(entry: EntryRef) {
    if (pending) return;
    setInputError(null);
    push({ role: 'user', question: entry.question });
    void ask({ entryId: entry.id });
  }

  function retry(message: Extract<Message, { role: 'error' }>) {
    if (pending) return;
    setMessages((list) => list.filter((m) => m.id !== message.id));
    void ask(message.ask);
  }

  function newConversation() {
    setMessages([]);
    setInput('');
    setInputError(null);
    inputRef.current?.focus();
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  // ==================================================
  // RENDERING HELPERS
  // ==================================================

  const answerLink = (link: string | null): ReactNode => {
    if (!link) return null;
    const label = linkLabel(link);
    if (!label) return null;
    // SkinScan's own pages stay here; the clinic's open on its website, in
    // the assistant's language (in a new tab, so the scan isn't lost).
    const external = !link.startsWith('skinscan:');
    const target = external
      ? resolveLink(link, language, { skinscanUrl: '', localize: clinicLink })
      : localePath(link.slice('skinscan:'.length) || '/', language);
    return (
      <a
        className="assistantLink"
        href={target}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {t.links[label]}
        <ArrowUpRight size={15} aria-hidden="true" className="assistantFlip" />
      </a>
    );
  };

  const chips = (entries: EntryRef[], heading?: string) =>
    entries.length ? (
      <div className="assistantChips">
        {heading ? <p className="assistantChipsTitle">{heading}</p> : null}
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="assistantChip" onClick={() => askEntry(entry)} disabled={pending}>
                {entry.question[language]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  function renderReply(reply: AssistantReply): ReactNode {
    switch (reply.kind) {
      case 'answer':
        return (
          <>
            <p className="assistantSource">
              {t.chat.fromFaq}: <span>{reply.entry.question[language]}</span>
            </p>
            <p className="assistantText">
              <RichText text={reply.entry.answer[language]} />
            </p>
            {answerLink(reply.entry.link)}
            {chips(reply.related, t.chat.related)}
          </>
        );
      case 'clarify':
        return (
          <>
            <p className="assistantText">{t.chat.clarify}</p>
            {chips(reply.options)}
          </>
        );
      case 'medical':
        return (
          <>
            <p className="assistantText">{t.chat.medical}</p>
            {answerLink('/book')}
            {chips(reply.related, t.chat.related)}
          </>
        );
      case 'fallback':
        return (
          <>
            <p className="assistantText">{t.chat.fallback}</p>
            <div className="assistantLinks">
              {answerLink('/support')}
              {answerLink('/book')}
            </div>
            {chips(reply.related, t.chat.mightHelp)}
          </>
        );
      case 'greeting':
        return (
          <>
            <p className="assistantText">{t.chat.greeting}</p>
            {chips(suggestions)}
          </>
        );
      case 'thanks':
        return <p className="assistantText">{t.chat.thanks}</p>;
    }
  }

  const languageSwitch = (
    <div className="assistantLanguage" role="group" aria-label={t.language.label}>
      {(['en', 'ar'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          dir={code === 'ar' ? 'rtl' : 'ltr'}
          className={language === code ? 'active' : undefined}
          aria-pressed={language === code}
          onClick={() => chooseLanguage(code)}
        >
          {t.language[code]}
        </button>
      ))}
    </div>
  );

  if (hidden) return null;

  const skinscanHref = href('/');
  const launcherStyle = { '--assistant-lift': `${lift.launcher}px` } as CSSProperties;
  const panelStyle = { '--assistant-panel-lift': `${lift.panel}px` } as CSSProperties;

  // ==================================================
  // MARKUP
  // ==================================================

  return (
    <div className={`assistant${open ? ' assistantIsOpen' : ''}`}>
      {open ? (
        <section
          id="clinic-assistant"
          className={`assistantPanel${screen === 'chat' ? ' isChat' : ''}`}
          style={panelStyle}
          role="dialog"
          aria-modal="false"
          aria-labelledby="clinic-assistant-title"
          lang={language}
          dir={dir}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              minimize();
            }
          }}
        >
          {screen === 'choice' ? (
            <>
              <header className="assistantHeader">
                <div className="assistantHeaderText">
                  <h2 id="clinic-assistant-title" ref={headingRef} tabIndex={-1}>
                    {t.choice.title}
                  </h2>
                  <p>{t.choice.subtitle}</p>
                </div>
                <button type="button" className="assistantIconButton" onClick={minimize} aria-label={t.choice.close}>
                  <X size={18} aria-hidden="true" />
                </button>
              </header>

              <div className="assistantToolbar">{languageSwitch}</div>

              <div className="assistantChoices">
                <a className="assistantOption assistantOptionScan" href={skinscanHref}>
                  <span className="assistantOptionIcon">
                    <ScanFace size={24} aria-hidden="true" />
                  </span>
                  <span className="assistantOptionText">
                    <strong>{t.choice.skinscan.title}</strong>
                    <span>{t.choice.skinscan.description}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="assistantOptionArrow assistantFlip" />
                </a>

                <button
                  type="button"
                  className="assistantOption assistantOptionChat"
                  onClick={() => setScreen('chat')}
                >
                  <span className="assistantOptionIcon">
                    <MessageCircle size={24} aria-hidden="true" />
                  </span>
                  <span className="assistantOptionText">
                    <strong>{t.choice.chat.title}</strong>
                    <span>{t.choice.chat.description}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="assistantOptionArrow assistantFlip" />
                </button>
              </div>
            </>
          ) : (
            <>
              <header className="assistantHeader">
                <button
                  type="button"
                  className="assistantIconButton"
                  onClick={() => {
                    setScreen('choice');
                    setInputError(null);
                  }}
                  aria-label={t.chat.back}
                  title={t.chat.back}
                >
                  <ArrowLeft size={18} aria-hidden="true" className="assistantFlip" />
                </button>
                <div className="assistantHeaderText">
                  <h2 id="clinic-assistant-title">{t.chat.title}</h2>
                  <p>{t.chat.subtitle}</p>
                </div>
                <button type="button" className="assistantIconButton" onClick={minimize} aria-label={t.chat.minimize}>
                  <X size={18} aria-hidden="true" />
                </button>
              </header>

              <div className="assistantToolbar">
                <button
                  type="button"
                  className="assistantTextButton"
                  onClick={newConversation}
                  disabled={!messages.length || pending}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  {t.chat.newConversation}
                </button>
                {languageSwitch}
              </div>

              <div className="assistantLog" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
                <div className="assistantMessage fromAssistant">
                  <span className="srOnly">{t.chat.assistant}: </span>
                  <p className="assistantText">{t.chat.welcome}</p>
                  {messages.length === 0 ? chips(suggestions, t.chat.suggestions) : null}
                </div>

                {messages.map((message) => {
                  if (message.role === 'user') {
                    return (
                      <div key={message.id} className="assistantMessage fromUser" dir="auto">
                        <span className="srOnly">{t.chat.you}: </span>
                        {'text' in message ? message.text : message.question[language]}
                      </div>
                    );
                  }
                  if (message.role === 'error') {
                    const text =
                      message.error === 'rate_limited'
                        ? t.chat.rateLimited
                        : message.error === 'network'
                          ? t.chat.network
                          : t.chat.error;
                    return (
                      <div key={message.id} className="assistantMessage fromAssistant isError" role="alert">
                        <p className="assistantText">{text}</p>
                        <button type="button" className="assistantTextButton" onClick={() => retry(message)} disabled={pending}>
                          <RotateCcw size={14} aria-hidden="true" />
                          {t.chat.retry}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div key={message.id} className="assistantMessage fromAssistant">
                      <span className="srOnly">{t.chat.assistant}: </span>
                      {renderReply(message.reply)}
                    </div>
                  );
                })}

                {pending ? (
                  <div className="assistantMessage fromAssistant isTyping" aria-label={t.chat.thinking}>
                    <span className="assistantDots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="srOnly">{t.chat.thinking}</span>
                  </div>
                ) : null}
              </div>

              <form
                className="assistantComposer"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label htmlFor="clinic-assistant-input" className="srOnly">
                  {t.chat.inputLabel}
                </label>
                <textarea
                  id="clinic-assistant-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_MESSAGE_LENGTH + 50}
                  placeholder={t.chat.placeholder}
                  dir="auto"
                  aria-invalid={inputError ? true : undefined}
                  aria-describedby={inputError ? 'clinic-assistant-input-error' : undefined}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) setInputError(null);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={onInputKeyDown}
                />
                <button type="submit" className="assistantSend" aria-label={t.chat.send} disabled={pending}>
                  {pending ? (
                    <Loader2 size={18} aria-hidden="true" className="assistantSpin" />
                  ) : (
                    <Send size={18} aria-hidden="true" className="assistantFlip" />
                  )}
                </button>
              </form>
              {inputError ? (
                <p id="clinic-assistant-input-error" className="assistantInputError" role="alert">
                  {inputError}
                </p>
              ) : input.length > MAX_MESSAGE_LENGTH - 100 ? (
                <p className="assistantCounter" aria-live="polite">
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </p>
              ) : null}
              <p className="assistantDisclaimer">{t.chat.disclaimer}</p>
            </>
          )}
        </section>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        className="assistantLauncher"
        style={launcherStyle}
        aria-expanded={open}
        aria-controls={open ? 'clinic-assistant' : undefined}
        aria-label={open ? t.launcher.close : t.launcher.open}
        onClick={() => (open ? minimize() : openPanel())}
        dir={dir}
      >
        {open ? <X size={24} aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}
        {!open ? (
          <span className="assistantTooltip" aria-hidden="true">
            {t.launcher.tooltip}
          </span>
        ) : null}
      </button>
    </div>
  );
}
