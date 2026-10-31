'use client';

import { CalendarDays, Loader2, PackageSearch, ScanBarcode, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import BarcodeScanner from './BarcodeScanner';
import BrandHeader from './BrandHeader';
import { fill, useI18n } from './LocaleProvider';
import ProductResult from './ProductResult';
import SiteFooter from './SiteFooter';
import { requestProduct } from '@/lib/client/product-api';
import { useAuth } from '@/lib/client/use-auth';
import { normalizeBarcode } from '@/lib/products/barcode';
import type { ProductInfo, ProductSource } from '@/lib/products/types';
import { bookingLink } from '@/lib/public-config';

const CONTRIBUTE_URL = 'https://world.openbeautyfacts.org/contribute';

type Step =
  | { name: 'start'; camera: boolean; looking: boolean; error?: string }
  | { name: 'found'; product: ProductInfo; source: ProductSource }
  | { name: 'notFound'; code: string };

/** What to do after signing in: open the camera, or look up the number already typed. */
type Pending = { kind: 'camera' } | { kind: 'lookup'; code: string; format?: string };

/**
 * The product check (/products): scan a skincare product's barcode with the
 * camera, or type its number, and see what its well-established ingredients
 * are commonly used for (docs/PRODUCT_SCAN.md). No photo leaves the device:
 * the barcode is read in the browser and only its number is sent.
 */
export default function ProductScanApp() {
  const { t: messages, locale } = useI18n();
  const t = messages.product;
  const { authenticated, required, loading, openSignIn, whenReady, onResume } = useAuth();
  const [step, setStep] = useState<Step>({ name: 'start', camera: false, looking: false });
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const pending = useRef<Pending | null>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const allowed = authenticated || !required;

  useEffect(() => {
    window.scrollTo({ top: 0 });
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

  const lookUp = useCallback(
    async (raw: string, format?: string) => {
      if (!normalizeBarcode(raw, format)) {
        setStep({ name: 'start', camera: false, looking: false, error: t.invalid });
        return;
      }
      if (needsSignIn({ kind: 'lookup', code: raw, format })) return;
      setStep({ name: 'start', camera: false, looking: true });
      const response = await requestProduct(raw, locale, format);
      if (!response.success) {
        if (response.error.code === 'unauthenticated') {
          setStep({ name: 'start', camera: false, looking: false });
          pending.current = { kind: 'lookup', code: raw, format };
          openSignIn(true);
          return;
        }
        setStep({ name: 'start', camera: false, looking: false, error: response.error.message });
        return;
      }
      if (response.found) setStep({ name: 'found', product: response.product, source: response.source });
      else setStep({ name: 'notFound', code: response.code });
    },
    [needsSignIn, openSignIn, locale, t],
  );

  const openCamera = useCallback(() => {
    if (loading || needsSignIn({ kind: 'camera' })) return;
    setStep({ name: 'start', camera: true, looking: false });
  }, [loading, needsSignIn]);

  const continuePending = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    if (action?.kind === 'camera') setStep({ name: 'start', camera: true, looking: false });
    else if (action?.kind === 'lookup') lookUp(action.code, action.format);
  }, [lookUp]);

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
    setCode('');
    setStep({ name: 'start', camera: false, looking: false });
  }, []);

  const typeInstead = useCallback(() => {
    setStep({ name: 'start', camera: false, looking: false });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step.name === 'start' && step.looking) return;
    lookUp(code.trim());
  };

  const onDetected = useCallback(
    (value: string, format: string) => {
      setCode(value);
      lookUp(value, format);
    },
    [lookUp],
  );

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
                <button type="button" className="btn btn-primary btn-block" onClick={openCamera} disabled={step.looking}>
                  <ScanBarcode size={18} aria-hidden /> {t.scan}
                </button>
              </div>
            )}

            <p className="productOr" aria-hidden>
              <span>{t.or}</span>
            </p>

            <form className="barcodeForm" onSubmit={onSubmit} noValidate>
              <label htmlFor={inputId}>{t.manualLabel}</label>
              <div className="barcodeField">
                <input
                  ref={inputRef}
                  id={inputId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="search"
                  dir="ltr"
                  maxLength={20}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ''))}
                  aria-describedby={`${hintId}${step.error ? ` ${errorId}` : ''}`}
                  aria-invalid={step.error ? true : undefined}
                />
                <button type="submit" className="btn btn-ghost" disabled={step.looking || !code.trim()}>
                  {step.looking ? <Loader2 className="spin" size={18} aria-hidden /> : <Search size={18} aria-hidden />}
                  {step.looking ? t.lookingUp : t.lookUp}
                </button>
              </div>
              <p id={hintId} className="fine">
                {t.manualHint}
              </p>
              {step.error ? (
                <p id={errorId} className="inlineError" role="alert">
                  {step.error}
                </p>
              ) : null}
            </form>

            <p className="notice">
              <ShieldCheck size={15} aria-hidden /> {t.privacy}
            </p>
          </section>
        ) : null}

        {step.name === 'found' ? (
          <ProductResult product={step.product} source={step.source} onAnother={startAgain} />
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
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={startAgain}>
                <ScanBarcode size={18} aria-hidden /> {t.notFound.another}
              </button>
              <a className="btn btn-ghost" href={bookingLink(locale)}>
                <CalendarDays size={18} aria-hidden /> {t.notFound.book}
              </a>
            </div>
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
