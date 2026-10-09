'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { prepareImage, type PreparedImage } from '@/lib/client/prepare-image';
import { requestScan } from '@/lib/client/scan-api';
import { useAuth } from '@/lib/client/use-auth';
import { SITE_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';
import type { ScanFailure, ScanSuccess } from '@/lib/skin-analysis/types';
import Analyzing from './Analyzing';
import AuthModal from './AuthModal';
import BrandHeader from './BrandHeader';
import CameraCapture from './CameraCapture';
import Landing from './Landing';
import PhotoPreview from './PhotoPreview';
import PhotoStep from './PhotoStep';
import Results from './Results';
import RetakeNotice from './RetakeNotice';

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
  const { authenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const [step, setStep] = useState<Step>({ name: 'landing' });
  const uploadRef = useRef<HTMLInputElement>(null);
  const deviceCameraRef = useRef<HTMLInputElement>(null);
  const photoUrlRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

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

  const handleStartScan = useCallback(() => {
    if (!authenticated) {
      setPendingStart(true);
      setAuthModalOpen(true);
      return;
    }
    goToPhotoStep();
  }, [authenticated, goToPhotoStep]);

  const handleAuthSuccess = useCallback(() => {
    if (pendingStart) {
      setPendingStart(false);
      goToPhotoStep();
    }
  }, [pendingStart, goToPhotoStep]);

  const handleFile = useCallback(
    async (file: Blob | undefined | null) => {
      if (!file) return;
      if (!authenticated) {
        setAuthModalOpen(true);
        return;
      }
      try {
        const photo = await prepareImage(file);
        trackPhoto(photo);
        setStep({ name: 'preview', photo });
      } catch {
        setStep({
          name: 'photo',
          error: 'This photo could not be opened. Please use a JPG, PNG or WebP photo (on iPhone, choose "Most Compatible").',
        });
      }
    },
    [authenticated, trackPhoto],
  );

  const goHome = useCallback(() => {
    if (step.name === 'analyzing') return;
    trackPhoto(null);
    setStep({ name: 'landing' });
  }, [step.name, trackPhoto]);

  const openUpload = useCallback(() => {
    if (!authenticated) {
      setAuthModalOpen(true);
      return;
    }
    uploadRef.current?.click();
  }, [authenticated]);

  const openDeviceCamera = useCallback(() => {
    if (!authenticated) {
      setAuthModalOpen(true);
      return;
    }
    deviceCameraRef.current?.click();
  }, [authenticated]);

  const takePhoto = useCallback(() => {
    if (!authenticated) {
      setAuthModalOpen(true);
      return;
    }
    const liveCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
    if (liveCamera) setStep({ name: 'camera' });
    else openDeviceCamera();
  }, [authenticated, openDeviceCamera]);

  const analyze = useCallback(
    async (photo: PreparedImage) => {
      if (!authenticated) {
        setAuthModalOpen(true);
        return;
      }
      setStep({ name: 'analyzing', photo });
      const [response] = await Promise.all([
        requestScan(photo.blob),
        // Keep the progress view on screen briefly so the transition is not jarring.
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      if (response.success) setStep({ name: 'results', photo, result: response });
      else if (response.error.code === 'unauthenticated') {
        setAuthModalOpen(true);
        setStep({ name: 'landing' });
      } else {
        setStep({ name: 'retake', photo, failure: response });
      }
    },
    [authenticated],
  );

  return (
    <>
      <BrandHeader onHome={goHome} onOpenAuth={() => setAuthModalOpen(true)} />
      <main ref={mainRef} tabIndex={-1} className={`page page-${step.name}`}>
        {step.name === 'landing' ? <Landing onStart={handleStartScan} /> : null}
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
            photoUrl={step.photo.url}
            photoAspect={step.photo.width / step.photo.height}
            onScanAgain={handleStartScan}
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

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingStart(false);
        }}
        onSuccess={handleAuthSuccess}
      />

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

      <footer className="footer">
        <p>
          {SITE_NAME} ·{' '}
          <a href={publicConfig.clinicUrl} target="_blank" rel="noopener noreferrer">
            Dr. Maher Mahmoud Clinics
          </a>
          . Informational only — not a medical diagnosis. Photos are analysed in memory and never stored.
        </p>
        <div className="footerLinks">
          <Link href="/terms">Terms of Use</Link>
          <span className="dot">·</span>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </>
  );
}
