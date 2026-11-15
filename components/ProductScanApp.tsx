'use client';

import { CalendarDays, ChevronRight, Loader2, PackageSearch, ScanBarcode, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import BarcodeScanner from './BarcodeScanner';
import BrandHeader from './BrandHeader';
import { fill, useI18n } from './LocaleProvider';
import ProductResult, { EdaLink } from './ProductResult';
import SiteFooter from './SiteFooter';
import { requestProduct, searchProducts, type ProductQuery } from '@/lib/client/product-api';
import { useAuth } from '@/lib/client/use-auth';
import { normalizeBarcode } from '@/lib/products/barcode';
import type { ProductInfo, ProductSearchHit, ProductSource } from '@/lib/products/types';
import { bookingLink } from '@/lib/public-config';
import { format } from '@/lib/messages';

const CONTRIBUTE_URL = 'https://world.openbeautyfacts.org/contribute';

interface SearchState {
  q: string;
  results: ProductSearchHit[];
  more: boolean;
}

type Step =
  | { name: 'start'; camera: boolean; busy: boolean; error?: string; search?: SearchState }
  | { name: 'found'; product: ProductInfo; sources: ProductSource[] }
  | { name: 'notFound'; code: string };

/** What to do after signing in: open the camera, look something up, or run the search typed before. */
type Pending = { kind: 'camera' } | { kind: 'lookup'; query: ProductQuery } | { kind: 'search'; q: string };

const START: Extract<Step, { name: 'start' }> = { name: 'start', camera: false, busy: false };

/** Digits with optional spaces or dashes: a barcode, not a name. */
const looksLikeBarcode = (value: string) => /^[\d\s-]+$/.test(value) && /\d/.test(value);

/**
 * The product check (/products): scan a skincare product's barcode with the
 * camera, type its number, or type its name (English or Arabic, searched in
 * the list of products sold in Egyptian pharmacies), and see what its
 * well-established ingredients are commonly used for (docs/PRODUCT_SCAN.md).
 * No photo leaves the device: the barcode is read in the browser and only its
 * number, or the typed name, is sent.
 */
export default function ProductScanApp() {
  const { t: messages, locale } = useI18n();
  const t = messages.product;
  const { authenticated, required, loading, openSignIn, whenReady, onResume } = useAuth();
  const [step, setStep] = useState<Step>(START);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const pending = useRef<Pending | null>(null);
  /** The next step change puts focus in the field instead of on the heading ("type instead"). */
  const focusField = useRef(false);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const allowed = authenticated || !required;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (focusField.current) {
      focusField.current = false;
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    (heading ?? mainRef.current)?.focus({ preventScroll: true });
  }, [step.name]);

  /** Signed-out patients are asked to sign in first; the action continues afterwards. */
  const needsSignIn = useCallback(
    (action: Pending) => {
      if (allowed) return false;
      pending.current = action;
      openSignIn(true);
      return true;
    },
    [allowed, openSignIn],
  );

  /** A failed request: sign in again when the session ended, otherwise say what went wrong under the field. */
  const handleFailure = useCallback(
    (code: string, message: string, retry: Pending) => {
      if (code === 'unauthenticated') {
        setStep(START);
        pending.current = retry;
        openSignIn(true);
        return;
      }
      setStep({ ...START, error: message });
    },
    [openSignIn],
  );

  const lookUp = useCallback(
    async (query: ProductQuery) => {
      if ('code' in query && !normalizeBarcode(query.code, query.format)) {
        setStep({ ...START, error: t.invalid });
        return;
      }
      if (needsSignIn({ kind: 'lookup', query })) return;
      setStep((current) => ({ ...START, busy: true, search: current.name === 'start' ? current.search : undefined }));
      const response = await requestProduct(query, locale);
      if (!response.success) return handleFailure(response.error.code, response.error.message, { kind: 'lookup', query });
      if (response.found) setStep({ name: 'found', product: response.product, sources: response.sources });
      else setStep({ name: 'notFound', code: response.code });
    },
    [needsSignIn, handleFailure, locale, t],
  );

  const search = useCallback(
    async (q: string) => {
      if (needsSignIn({ kind: 'search', q })) return;
      setStep({ ...START, busy: true });
      const response = await searchProducts(q, locale);
      if (!response.success) return handleFailure(response.error.code, response.error.message, { kind: 'search', q });
      setStep({ ...START, search: { q, results: response.results, more: response.more } });
      window.setTimeout(() => resultsRef.current?.focus(), 0);
    },
    [needsSignIn, handleFailure, locale],
  );

  const openCamera = useCallback(() => {
    if (loading || needsSignIn({ kind: 'camera' })) return;
    setStep({ ...START, camera: true });
  }, [loading, needsSignIn]);

  const continuePending = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    if (action?.kind === 'camera') setStep({ ...START, camera: true });
    else if (action?.kind === 'lookup') lookUp(action.query);
    else if (action?.kind === 'search') search(action.q);
  }, [lookUp, search]);

  // Back from signing in on the clinic website (phones: ?scan=1): clear the flag, then wait for the patient.
  useEffect(
    () =>
      whenReady(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('scan') !== '1') return;
        params.delete('scan');
        const query = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      }),
    [whenReady],
  );

  // Signed in through the pop-up window: carry on with what was pressed.
  useEffect(() => onResume(continuePending), [onResume, continuePending]);

  const startAgain = useCallback(() => {
    setText('');
    setStep(START);
  }, []);

  const typeInstead = useCallback(() => {
    if (step.name === 'start') {
      setStep(START);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      // From "not found": a fresh field for the name or another barcode.
      setText('');
      focusField.current = true;
      setStep(START);
    }
  }, [step.name]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step.name === 'start' && step.busy) return;
    const value = text.trim();
    if (looksLikeBarcode(value)) lookUp({ code: value });
    else if (value.length < 2) setStep({ ...START, error: t.tooShort });
    else search(value);
  };

  const onDetected = useCallback(
    (value: string, format: string) => {
      setText(value);
      lookUp({ code: value, format });
    },
    [lookUp],
  );

  const busy = step.name === 'start' && step.busy;
  const error = step.name === 'start' ? step.error : undefined;
  const results = step.name === 'start' ? step.search : undefined;

  return (
    <>
      <BrandHeader scanActive={false} productsActive />
      <main ref={mainRef} tabIndex={-1} className="page page-product">
        {step.name === 'start' ? (
          <section className="stepCard glass productStart" aria-labelledby="product-start-title">
            <span className="eyebrow">{t.eyebrow}</span>
            <h1 id="product-start-title" tabIndex={-1}>
              {t.title}
            </h1>
            <p className="muted">{t.lead}</p>

            {step.camera ? (
              <BarcodeScanner onDetected={onDetected} onClose={startAgain} onTypeInstead={typeInstead} />
            ) : (
              <div className="actions">
                <button type="button" className="btn btn-primary btn-block" onClick={openCamera} disabled={busy}>
                  <ScanBarcode size={18} aria-hidden /> {t.scan}
                </button>
              </div>
            )}

            <p className="productOr" aria-hidden>
              <span>{t.or}</span>
            </p>

            <form className="barcodeForm" onSubmit={onSubmit} noValidate role="search">
              <label htmlFor={inputId}>{t.manualLabel}</label>
              <div className="barcodeField">
                <input
                  ref={inputRef}
                  id={inputId}
                  type="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  dir="auto"
                  maxLength={60}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
                  aria-invalid={error ? true : undefined}
                />
                <button type="submit" className="btn btn-ghost" disabled={busy || !text.trim()}>
                  {busy ? <Loader2 className="spin" size={18} aria-hidden /> : <Search size={18} aria-hidden />}
                  {busy ? t.lookingUp : t.lookUp}
                </button>
              </div>
              <p id={hintId} className="fine">
                {t.manualHint}
              </p>
              {error ? (
                <p id={errorId} className="inlineError" role="alert">
                  {error}
                </p>
              ) : null}
            </form>

            {results ? (
              <div className="productSearch">
                <h2 ref={resultsRef} tabIndex={-1} className="productSection">
                  {t.search.title}
                </h2>
                {results.results.length ? (
                  <>
                    <p className="muted small">{t.search.hint}</p>
                    <ul className="searchList">
                      {results.results.map((hit) => (
                        <li key={hit.id}>
                          <button type="button" onClick={() => lookUp({ id: hit.id })} disabled={busy}>
                            <span>
                              <b dir="auto">{hit.name}</b>
                              <small>
                                {[hit.brand, hit.hasBarcode ? null : t.search.noBarcode].filter(Boolean).join(' · ')}
                              </small>
                            </span>
                            <ChevronRight size={18} className="flip-rtl" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {results.more ? <p className="fine">{t.search.more}</p> : null}
                  </>
                ) : (
                  <p className="muted" role="status">
                    {format(t.search.none, { q: results.q })}
                  </p>
                )}
              </div>
            ) : null}

            <p className="notice">
              <ShieldCheck size={15} aria-hidden /> {t.privacy}
            </p>
          </section>
        ) : null}

        {step.name === 'found' ? (
          <ProductResult product={step.product} sources={step.sources} onAnother={startAgain} />
        ) : null}

        {step.name === 'notFound' ? (
          <section className="stepCard glass productStart" aria-labelledby="product-missing-title">
            <span className="retakeIcon">
              <PackageSearch size={26} aria-hidden />
            </span>
            <h1 id="product-missing-title" tabIndex={-1}>
              {t.notFound.title}
            </h1>
            <p className="muted">{fill(t.notFound.body, { code: <span dir="ltr">{step.code}</span> })}</p>
            {step.code.startsWith('622') ? <p className="muted">{t.notFound.egyptian}</p> : null}
            <p className="muted">{t.notFound.tryName}</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={typeInstead}>
                <Search size={18} aria-hidden /> {t.notFound.another}
              </button>
              <a className="btn btn-ghost" href={bookingLink(locale)}>
                <CalendarDays size={18} aria-hidden /> {t.notFound.book}
              </a>
            </div>
            <p className="fine">
              <EdaLink />
            </p>
            <p className="fine">
              <a href={CONTRIBUTE_URL} target="_blank" rel="noopener noreferrer" className="inlineLink">
                {t.notFound.add}
              </a>
            </p>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
