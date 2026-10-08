'use client';

import { AlertCircle, ImageUp, Loader2, SwitchCamera, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
  onUseDeviceCamera: () => void;
  onUpload: () => void;
}

type Facing = 'user' | 'environment';

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. You can allow camera access in your browser settings, or use your device camera or a photo instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Please close it and try again.';
  return 'The camera could not be started on this device.';
}

export default function CameraCapture({ onCapture, onCancel, onUseDeviceCamera, onUpload }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('user');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);
  const [flash, setFlash] = useState(false);

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
        setError('Live camera is not available in this browser.');
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
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    }
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facing === 'user') {
      // Keep the photo the same way round as the mirrored preview the user saw.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
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
    <div className="cameraOverlay" role="dialog" aria-modal="true" aria-label="Take a photo">
      <div className="cameraFrame">
        <button type="button" className="iconBtn cameraClose" onClick={onCancel} aria-label="Close camera">
          <X size={20} aria-hidden />
        </button>

        {error ? (
          <div className="cameraError">
            <AlertCircle size={36} aria-hidden />
            <p>{error}</p>
            <div className="actions center">
              <button type="button" className="btn primary" onClick={onUseDeviceCamera}>
                Use device camera
              </button>
              <button type="button" className="btn secondary" onClick={onUpload}>
                <ImageUp size={18} aria-hidden /> Upload a photo
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
            <p className="cameraHint">Fit your face inside the oval · even light · no glasses</p>
            {!ready ? (
              <div className="cameraLoading">
                <Loader2 className="spin" size={28} aria-hidden />
                <span>Starting camera…</span>
              </div>
            ) : null}
            {flash ? <div className="cameraFlash" /> : null}
            <div className="cameraControls">
              <span className="controlSpacer" />
              <button type="button" className="shutter" onClick={capture} disabled={!ready} aria-label="Take photo">
                <span />
              </button>
              {canSwitch ? (
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                  aria-label="Switch camera"
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
    </div>
  );
}
