'use client';

import { Camera, ImageUp, RotateCcw } from 'lucide-react';
import { useI18n } from './LocaleProvider';
import type { ScanFailure } from '@/lib/skin-analysis/types';

interface Props {
  failure: ScanFailure;
  onRetake: () => void;
  onUpload: () => void;
}

export default function RetakeNotice({ failure, onRetake, onUpload }: Props) {
  const { t } = useI18n();
  const quality = failure.error.code === 'image_quality';
  const issues = failure.imageQuality?.issues ?? [];
  return (
    <section className="stepCard glass retake" role="alert" aria-labelledby="retake-title">
      <span className="retakeIcon">
        <RotateCcw size={26} aria-hidden />
      </span>
      <h2 id="retake-title">{quality ? t.retake.quality : t.retake.error}</h2>
      {issues.length > 1 ? (
        <ul className="issueList">
          {issues.map((i) => (
            <li key={i.code}>{i.message}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{failure.error.message}</p>
      )}
      {quality ? (
        <p className="muted small">{t.retake.why}</p>
      ) : null}
      <div className="actions center">
        <button type="button" className="btn primary" onClick={onRetake}>
          <Camera size={18} aria-hidden /> {t.retake.retake}
        </button>
        <button type="button" className="btn secondary" onClick={onUpload}>
          <ImageUp size={18} aria-hidden /> {t.retake.upload}
        </button>
      </div>
    </section>
  );
}
