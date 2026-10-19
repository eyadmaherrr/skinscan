'use client';

import { Loader2, LogIn, UserPlus, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { fill, useI18n } from './LocaleProvider';
import { useAuth } from '@/lib/client/use-auth';

/**
 * Sign-in dialog, the Dr. Maher network sign-in: one account for
 * drmahermahmoud.com, BossMen Clinics and SkinScan. "Sign in" opens the
 * clinic website in a pop-up window (the whole page on phones), which signs
 * the patient in and comes back; SkinScan never handles a password.
 */
export default function AuthModal() {
  const { t, locale, href } = useI18n();
  const { prompt, closeSignIn, signIn, waiting, unavailable } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!prompt.open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSignIn();
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('modal-open');
    };
  }, [prompt.open, closeSignIn]);

  if (!prompt.open) return null;

  return (
    <div className="modal-backdrop" onClick={closeSignIn} role="presentation">
      <div
        className="modal signin-modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="icon-btn modal-close" onClick={closeSignIn} aria-label={t.auth.close}>
          <X size={18} aria-hidden />
        </button>

        <span className="signin-logo" aria-hidden>
          <Image src="/brand/logo.webp" alt="" width={112} height={112} />
        </span>

        <span className="eyebrow">{t.auth.eyebrow}</span>
        <h2 id="auth-modal-title">{t.auth.title}</h2>
        <p className="signin-lede">{t.auth.message}</p>

        <p className="signin-network">
          <span>{t.auth.network}</span>
          <b>drmahermahmoud.com</b>
          <b>BossMen Clinics</b>
          <b>SkinScan</b>
        </p>

        {unavailable ? (
          <p className="signin-error" role="alert">
            {t.auth.unavailable}
          </p>
        ) : null}

        {waiting ? (
          <div className="signin-wait" role="status">
            <Loader2 className="spin" size={18} aria-hidden />
            <span>{t.auth.waiting}</span>
            <button type="button" className="link-btn" onClick={() => signIn('login', locale)}>
              {t.auth.reopen}
            </button>
          </div>
        ) : (
          <div className="signin-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={() => signIn('login', locale)}>
              <LogIn size={17} className="flip-rtl" aria-hidden /> {t.auth.signIn}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => signIn('register', locale)}>
              <UserPlus size={17} aria-hidden /> {t.auth.create}
            </button>
          </div>
        )}

        <p className="signin-foot">
          {fill(t.auth.legal, {
            terms: (
              <Link href={href('/terms')} target="_blank" className="link-btn">
                {t.legal.terms}
              </Link>
            ),
            privacy: (
              <Link href={href('/privacy')} target="_blank" className="link-btn">
                {t.legal.privacy}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
