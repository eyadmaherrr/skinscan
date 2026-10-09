'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareImage, type PreparedImage } from '@/lib/client/prepare-image';
import { requestScan } from '@/lib/client/scan-api';
import { useAuth } from '@/lib/client/use-auth';
import type { ScanFailure, ScanSuccess } from '@/lib/skin-analysis/types';
import Analyzing from './Analyzing';
import BrandHeader from './BrandHeader';
import CameraCapture from './CameraCapture';
import Landing from './Landing';
import { useI18n } from './LocaleProvider';
import PhotoPreview from './PhotoPreview';
import PhotoStep from './PhotoStep';
import Results from './Results';
import RetakeNotice from './RetakeNotice';
import SiteFooter from './SiteFooter';

type Step =
  | { name: 'landing' }
  | { name: 'photo'; error?: string }
  | { name: 'camera' }
  | { name: 'preview'; photo: PreparedImage }
  | { name: 'analyzing'; photo: PreparedImage }
  | { name: 'retake'; photo: PreparedImage; failure: ScanFailure }
  | { name: 'results'; photo: PreparedImage; result: ScanSuccess };

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export default function ScanApp() {
  const { t, locale } = useI18n();
  const { authenticated, required, loading, openSignIn, whenReady } = useAuth();
  const [step, setStep] = useState<Step>({ name: 'landing' });
  const uploadRef = useRef<HTMLInputElement>(null);
  const deviceCameraRef = useRef<HTMLInputElement>(null);
  const photoUrlRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  /** "Start" was pressed before the sign-in check finished. */
  const startWhenReady = useRef(false);

  const allowed = authenticated || !required;

  // Free the previous photo's memory whenever it is replaced, and on unmount.
  const trackPhoto = useCallback((photo: PreparedImage | null) => {
    if (photoUrlRef.current && photoUrlRef.current !== photo?.url) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = photo?.url ?? null;
  }, []);
  useEffect(() => () => trackPhoto(null), [trackPhoto]);

  useEffect(() => {
    if (step.name !== 'camera') {
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [step.name]);

  const goToPhotoStep = useCallback(() => {
    trackPhoto(null);
    setStep({ name: 'photo' });
  }, [trackPhoto]);

  /** Every way into the scan goes through here: signed-out patients are asked to sign in first. */
  const requireSignIn = useCallback(() => {
    if (allowed) return false;
    openSignIn(true);
    return true;
  }, [allowed, openSignIn]);

  const handleStartScan = useCallback(() => {
    if (loading) {
      startWhenReady.current = true;
      return;
    }
    if (!requireSignIn()) goToPhotoStep();
  }, [loading, requireSignIn, goToPhotoStep]);

  // After the sign-in check: continue a start that was pressed early, or a scan
  // started before signing in on the clinic website (it returns with ?scan=1).
  useEffect(
    () =>
      whenReady(({ allowed: ok }) => {
        const params = new URLSearchParams(window.location.search);
        const resume = params.get('scan') === '1';
        if (resume) {
          params.delete('scan');
          const query = params.toString();
          window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
        }
        if (!resume && !startWhenReady.current) return;
        startWhenReady.current = false;
        if (ok) goToPhotoStep();
        else openSignIn(true);
      }),
    [whenReady, goToPhotoStep, openSignIn],
  );

  const handleFile = useCallback(
    async (file: Blob | undefined | null) => {
      if (!file || requireSignIn()) return;
      try {
        const photo = await prepareImage(file);
        trackPhoto(photo);
        setStep({ name: 'preview', photo });
      } catch {
        setStep({ name: 'photo', error: t.photo.unreadable });
      }
    },
    [requireSignIn, trackPhoto, t],
  );

  const goHome = useCallback(() => {
    if (step.name === 'analyzing') return;
    trackPhoto(null);
    setStep({ name: 'landing' });
  }, [step.name, trackPhoto]);

  const openUpload = useCallback(() => {
    if (!requireSignIn()) uploadRef.current?.click();
  }, [requireSignIn]);

  const openDeviceCamera = useCallback(() => {
    if (!requireSignIn()) deviceCameraRef.current?.click();
  }, [requireSignIn]);

  const takePhoto = useCallback(() => {
    if (requireSignIn()) return;
    const liveCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
    if (liveCamera) setStep({ name: 'camera' });
    else openDeviceCamera();
  }, [requireSignIn, openDeviceCamera]);

  const analyze = useCallback(
    async (photo: PreparedImage) => {
      if (requireSignIn()) return;
      setStep({ name: 'analyzing', photo });
      const [response] = await Promise.all([
        requestScan(photo.blob, locale),
        // Keep the progress view on screen briefly so the transition is not jarring.
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      if (response.success) setStep({ name: 'results', photo, result: response });
      else if (response.error.code === 'unauthenticated') {
        // The session ended meanwhile: sign in again, then the photo step opens.
        setStep({ name: 'landing' });
        openSignIn(true);
      } else setStep({ name: 'retake', photo, failure: response });
    },
    [requireSignIn, openSignIn, locale],
  );

  return (
    <>
      <BrandHeader onHome={goHome} />
      <main ref={mainRef} tabIndex={-1} className={`page page-${step.name}`}>
        {step.name === 'landing' ? <Landing onStart={handleStartScan} signInNeeded={required} /> : null}
        {step.name === 'photo' ? <PhotoStep onTakePhoto={takePhoto} onUpload={openUpload} error={step.error} /> : null}
        {step.name === 'preview' ? (
          <PhotoPreview url={step.photo.url} onAnalyze={() => analyze(step.photo)} onRetake={goToPhotoStep} />
        ) : null}
        {step.name === 'analyzing' ? <Analyzing url={step.photo.url} /> : null}
        {step.name === 'retake' ? (
          <RetakeNotice failure={step.failure} onRetake={takePhoto} onUpload={openUpload} />
        ) : null}
        {step.name === 'results' ? (
          <Results
            result={step.result}
            photo={step.photo}
            onScanAgain={() => {
              if (!requireSignIn()) goToPhotoStep();
            }}
          />
        ) : null}
      </main>

      {step.name === 'camera' ? (
        <CameraCapture
          onCapture={handleFile}
          onCancel={goToPhotoStep}
          onUseDeviceCamera={openDeviceCamera}
          onUpload={openUpload}
        />
      ) : null}

      <input
        ref={uploadRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={deviceCameraRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <SiteFooter />
    </>
  );
}
