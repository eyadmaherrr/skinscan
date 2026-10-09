'use client';

import { Camera, Crosshair, Glasses, ImageUp, Smile, Sparkles, Sun, SunDim, UserRound } from 'lucide-react';
import { useId, useState } from 'react';
import { fill, useI18n } from './LocaleProvider';

const TIP_ICONS = [UserRound, Sun, Glasses, SunDim, Sparkles, Crosshair, Smile];

interface Props {
  onTakePhoto: () => void;
  onUpload: () => void;
  error?: string | null;
}

export default function PhotoStep({ onTakePhoto, onUpload, error }: Props) {
  const { t, href } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const consentId = useId();

  return (
    <section className="stepCard glass" aria-labelledby="photo-title">
      <span className="eyebrow">{t.photo.step}</span>
      <h2 id="photo-title">{t.photo.title}</h2>
      <p className="muted">{t.photo.sub}</p>

      <ul className="tips">
        {t.photo.tips.map((text, i) => {
          const Icon = TIP_ICONS[i];
          return (
            <li key={text}>
              <span className="tipIcon">
                <Icon size={18} aria-hidden />
              </span>
              {text}
            </li>
          );
        })}
      </ul>

      <label className="consent" htmlFor={consentId}>
        <input id={consentId} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          {fill(t.photo.consent, {
            terms: (
              <a href={href('/terms')} target="_blank" rel="noopener noreferrer" className="inlineLink">
                {t.legal.terms}
              </a>
            ),
            privacy: (
              <a href={href('/privacy')} target="_blank" rel="noopener noreferrer" className="inlineLink">
                {t.legal.privacy}
              </a>
            ),
          })}
        </span>
      </label>

      {error ? (
        <p className="inlineError" role="alert">
          {error}
        </p>
      ) : null}

      <div className="actions">
        <button type="button" className="btn primary" onClick={onTakePhoto} disabled={!agreed}>
          <Camera size={18} aria-hidden /> {t.photo.take}
        </button>
        <button type="button" className="btn secondary" onClick={onUpload} disabled={!agreed}>
          <ImageUp size={18} aria-hidden /> {t.photo.upload}
        </button>
      </div>
    </section>
  );
}
