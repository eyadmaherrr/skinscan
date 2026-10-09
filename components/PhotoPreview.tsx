/* eslint-disable @next/next/no-img-element -- local object URLs of the user's own photo; never uploaded to an image CDN */
'use client';

import { RefreshCw, ScanFace } from 'lucide-react';
import { useI18n } from './LocaleProvider';

interface Props {
  url: string;
  onAnalyze: () => void;
  onRetake: () => void;
}

export default function PhotoPreview({ url, onAnalyze, onRetake }: Props) {
  const { t } = useI18n();
  return (
    <section className="stepCard glass" aria-labelledby="preview-title">
      <span className="eyebrow">{t.preview.step}</span>
      <h2 id="preview-title">{t.preview.title}</h2>
      <p className="muted">{t.preview.sub}</p>
      <div className="photoFrame">
        <img src={url} alt={t.preview.alt} />
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onAnalyze}>
          <ScanFace size={18} aria-hidden /> {t.preview.analyze}
        </button>
        <button type="button" className="btn secondary" onClick={onRetake}>
          <RefreshCw size={17} aria-hidden /> {t.preview.another}
        </button>
      </div>
    </section>
  );
}
