'use client';

import { AlertCircle, Keyboard, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from './LocaleProvider';
import { normalizeBarcode } from '@/lib/products/barcode';
import type { Messages } from '@/lib/messages';

interface Props {
  /** A valid retail barcode was read; the camera is already off. */
  onDetected: (code: string, format: string) => void;
  onClose: () => void;
  /** Close the camera and move to the number field. */
  onTypeInstead: () => void;
}

interface Detected {
  rawValue: string;
  format: string;
}

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<Detected[]>;
}

interface DetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
}

/** Retail barcodes on cosmetics. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const SCAN_INTERVAL_MS = 180;

/**
 * The browser's own BarcodeDetector (Chrome on Android, Edge, Samsung
 * Internet) when it reads retail barcodes; otherwise ZXing compiled to
 * WebAssembly (barcode-detector ponyfill) — Safari on iPhone has no
 * BarcodeDetector. The .wasm file is served from this site
 * (scripts/copy-barcode-wasm.mjs), never from a CDN. Null when neither works
 * (e.g. a browser that blocks WebAssembly): the number field remains.
 */
async function createDetector(): Promise<Detector | null> {
  const Native = (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new Native({ formats });
    } catch {
      // fall through to the WebAssembly reader
    }
  }
  try {
    const { BarcodeDetector, prepareZXingModule, ZXING_WASM_VERSION } = await import('barcode-detector/ponyfill');
    await prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? `/vendor/zxing_reader.wasm?v=${ZXING_WASM_VERSION}` : prefix + path,
      },
      fireImmediately: true,
    });
    return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
  } catch {
    return null;
  }
}

function cameraError(error: unknown, t: Messages['product']['camera']): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return t.blocked;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t.notFound;
  if (name === 'NotReadableError') return t.inUse;
  return t.failed;
}

async function openBackCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'NotFoundError') throw error;
    // Some laptop cameras refuse a size or facing mode: ask for any camera.
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export default function BarcodeScanner({ onDetected, onClose, onTypeInstead }: Props) {
  const { t: messages } = useI18n();
  const t = messages.product.camera;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Latest callback without restarting the camera when the parent re-renders.
  const detectedRef = useRef(onDetected);
  useEffect(() => {
    detectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const stop = () => {
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setError(t.unsupported);
        return;
      }
      // Ask for the camera and prepare the reader at the same time.
      const detectorPromise = createDetector();
      try {
        stream = await openBackCamera();
      } catch (e) {
        if (!cancelled) setError(cameraError(e, t));
        return;
      }
      if (cancelled) return stop();
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      const detector = await detectorPromise;
      if (cancelled) return stop();
      if (!detector) {
        stop();
        setError(t.unsupported);
        return;
      }
      setReady(true);

      const tick = async () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          try {
            for (const found of await detector.detect(v)) {
              if (cancelled) return;
              if (normalizeBarcode(found.rawValue, found.format)) {
                stop();
                detectedRef.current(found.rawValue, found.format);
                return;
              }
            }
          } catch {
            // A frame that can't be read: try the next one.
          }
        }
        if (!cancelled) timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [t]);

  return (
    <div className="barcodeCamera" role="group" aria-label={t.title}>
      {/* Without a camera the box would stay empty: the message and the number field take its place. */}
      <div className="barcodeViewport" hidden={!!error}>
        <video ref={videoRef} playsInline muted autoPlay aria-hidden />
        <span className="barcodeFrame" aria-hidden />
        {!ready ? (
          <span className="barcodeStatus" role="status">
            <Loader2 className="spin" size={18} aria-hidden /> {t.starting}
          </span>
        ) : null}
        <button type="button" className="barcodeClose" onClick={onClose} aria-label={t.close}>
          <X size={20} aria-hidden />
        </button>
      </div>
      {error ? (
        <div className="inlineError barcodeError" role="alert">
          <AlertCircle size={18} aria-hidden />
          <span>{error}</span>
        </div>
      ) : (
        <p className="muted small barcodeHint">{t.hint}</p>
      )}
      <button type="button" className="btn btn-ghost btn-block" onClick={onTypeInstead}>
        <Keyboard size={18} aria-hidden /> {t.typeInstead}
      </button>
    </div>
  );
}
