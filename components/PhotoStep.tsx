'use client';

import { Camera, Crosshair, Glasses, ImageUp, Smile, Sparkles, Sun, SunDim, UserRound } from 'lucide-react';
import { useId, useState } from 'react';

const TIPS = [
  { icon: UserRound, text: 'Face the camera' },
  { icon: Sun, text: 'Use natural, even lighting' },
  { icon: Glasses, text: 'Remove glasses' },
  { icon: SunDim, text: 'Remove sunglasses' },
  { icon: Sparkles, text: 'No beauty filters' },
  { icon: Crosshair, text: 'Keep your face centred' },
  { icon: Smile, text: 'Keep a neutral expression' },
];

interface Props {
  onTakePhoto: () => void;
  onUpload: () => void;
  error?: string | null;
}

export default function PhotoStep({ onTakePhoto, onUpload, error }: Props) {
  const [agreed, setAgreed] = useState(false);
  const consentId = useId();

  return (
    <section className="stepCard glass" aria-labelledby="photo-title">
      <span className="eyebrow">Step 1 of 2</span>
      <h2 id="photo-title">Take a clear photo of your face</h2>
      <p className="muted">A clear, well-lit photo gives the most reliable results.</p>

      <ul className="tips">
        {TIPS.map(({ icon: Icon, text }) => (
          <li key={text}>
            <span className="tipIcon">
              <Icon size={18} aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <label className="consent" htmlFor={consentId}>
        <input id={consentId} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I understand this is an informational scan, not a medical diagnosis, and I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="inlineLink">
            Terms of Use
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inlineLink">
            Privacy Policy
          </a>
          . My photo is processed in memory for this scan only and is never stored.
        </span>
      </label>

      {error ? (
        <p className="inlineError" role="alert">
          {error}
        </p>
      ) : null}

      <div className="actions">
        <button type="button" className="btn primary" onClick={onTakePhoto} disabled={!agreed}>
          <Camera size={18} aria-hidden /> Take a photo
        </button>
        <button type="button" className="btn secondary" onClick={onUpload} disabled={!agreed}>
          <ImageUp size={18} aria-hidden /> Upload a photo
        </button>
      </div>
    </section>
  );
}
