import { Camera, ImageUp, RotateCcw } from 'lucide-react';
import type { ScanFailure } from '@/lib/skin-analysis/types';

interface Props {
  failure: ScanFailure;
  onRetake: () => void;
  onUpload: () => void;
}

export default function RetakeNotice({ failure, onRetake, onUpload }: Props) {
  const quality = failure.error.code === 'image_quality';
  const issues = failure.imageQuality?.issues ?? [];
  return (
    <section className="stepCard glass retake" role="alert" aria-labelledby="retake-title">
      <span className="retakeIcon">
        <RotateCcw size={26} aria-hidden />
      </span>
      <h2 id="retake-title">{quality ? 'Let’s retake that photo' : 'We couldn’t complete the scan'}</h2>
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
        <p className="muted small">
          We only show results when the photo is clear enough to measure reliably — this protects you from misleading
          results.
        </p>
      ) : null}
      <div className="actions center">
        <button type="button" className="btn primary" onClick={onRetake}>
          <Camera size={18} aria-hidden /> Retake photo
        </button>
        <button type="button" className="btn secondary" onClick={onUpload}>
          <ImageUp size={18} aria-hidden /> Upload a different photo
        </button>
      </div>
    </section>
  );
}
