'use client';

import { AlertCircle, ImageUp, Loader2, SwitchCamera, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from './LocaleProvider';
import type { Messages } from '@/lib/messages';

interface Props {
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
  onUseDeviceCamera: () => void;
  onUpload: () => void;
}

type Facing = 'user' | 'environment';

/**
 * Lighting for the photo:
 * - front camera (phones and laptops): the screen turns white for a moment
 *   and lights the face, like a phone's selfie flash;
 * - back camera: the phone's flash (torch), where the browser allows it
 *   (Chrome on Android; not Safari on iPhone).
 * The camera needs a moment to adjust its exposure to the light first.
 */
const SCREEN_FLASH_MS = 450;
const TORCH_MS = 650;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** The back camera's video track if it has a controllable torch. */
function torchTrack(stream: MediaStream | null): MediaStreamTrack | null {
  const track = stream?.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
  return track && capabilities?.torch ? track : null;
}

function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  return track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}

function cameraErrorMessage(error: unknown, t: Messages['camera']): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return t.blocked;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t.notFound;
  if (name === 'NotReadableError') return t.inUse;
  return t.failed;
}

export default function CameraCapture({ onCapture, onCancel, onUseDeviceCamera, onUpload }: Props) {
  const { t: messages } = useI18n();
  const t = messages.camera;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('user');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);
  const [flash, setFlash] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t.unavailable);
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stop();
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) {
          setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e, t));
      }
    }
    start();
    return () => {
      cancelled = true;
      stop();
    };
    // The camera restarts only when the facing changes, not when the language object is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  /** The current frame; front-camera photos the same way round as the mirrored preview. */
  function drawFrame(): HTMLCanvasElement | null {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    return canvas;
  }

  async function capture() {
    if (capturing) return;
    setCapturing(true);
    const torch = facing === 'environment' ? torchTrack(streamRef.current) : null;
    let canvas: HTMLCanvasElement | null = null;
    try {
      if (facing === 'user') {
        setScreenFlash(true);
        await wait(SCREEN_FLASH_MS);
      } else if (torch) {
        await setTorch(torch, true).catch(() => undefined);
        await wait(TORCH_MS);
      }
      canvas = drawFrame();
    } finally {
      setScreenFlash(false);
      if (torch) await setTorch(torch, false).catch(() => undefined);
      setCapturing(false);
    }
    if (!canvas) return;
    // Shutter feedback where the screen didn't already light up.
    if (facing !== 'user') {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onCapture(blob);
      },
      'image/jpeg',
      0.95,
    );
  }

  return (
    <div className="cameraOverlay" role="dialog" aria-modal="true" aria-label={t.dialog}>
      <div className="cameraFrame">
        <button type="button" className="iconBtn cameraClose" onClick={onCancel} aria-label={t.close}>
          <X size={20} aria-hidden />
        </button>

        {error ? (
          <div className="cameraError">
            <AlertCircle size={36} aria-hidden />
            <p>{error}</p>
            <div className="actions center">
              <button type="button" className="btn primary" onClick={onUseDeviceCamera}>
                {t.deviceCamera}
              </button>
              <button type="button" className="btn secondary" onClick={onUpload}>
                <ImageUp size={18} aria-hidden /> {t.upload}
              </button>
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} className={facing === 'user' ? 'mirrored' : undefined} playsInline muted autoPlay />
            <svg className="ovalGuide" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
              <defs>
                <mask id="ovalMask">
                  <rect width="100" height="100" fill="white" />
                  <ellipse cx="50" cy="47" rx="23" ry="31" fill="black" />
                </mask>
              </defs>
              <rect width="100" height="100" fill="rgba(7,28,49,0.45)" mask="url(#ovalMask)" />
              <ellipse cx="50" cy="47" rx="23" ry="31" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="1.4 1.2" />
            </svg>
            <p className="cameraHint">{t.hint}</p>
            {!ready ? (
              <div className="cameraLoading">
                <Loader2 className="spin" size={28} aria-hidden />
                <span>{t.starting}</span>
              </div>
            ) : null}
            {flash ? <div className="cameraFlash" /> : null}
            <div className="cameraControls">
              <span className="controlSpacer" />
              <button
                type="button"
                className="shutter"
                onClick={capture}
                disabled={!ready || capturing}
                aria-label={t.shutter}
              >
                <span />
              </button>
              {canSwitch ? (
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                  aria-label={t.switch}
                >
                  <SwitchCamera size={20} aria-hidden />
                </button>
              ) : (
                <span className="controlSpacer" />
              )}
            </div>
          </>
        )}
      </div>
      {/* Front-camera flash: the whole screen white while the photo is taken. */}
      {screenFlash ? <div className="cameraScreenFlash" aria-hidden /> : null}
    </div>
  );
}
