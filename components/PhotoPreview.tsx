/* eslint-disable @next/next/no-img-element -- local object URLs of the user's own photo; never uploaded to an image CDN */
import { RefreshCw, ScanFace } from 'lucide-react';

interface Props {
  url: string;
  onAnalyze: () => void;
  onRetake: () => void;
}

export default function PhotoPreview({ url, onAnalyze, onRetake }: Props) {
  return (
    <section className="stepCard glass" aria-labelledby="preview-title">
      <span className="eyebrow">Step 2 of 2</span>
      <h2 id="preview-title">Check your photo</h2>
      <p className="muted">Make sure your whole face is visible, in focus and evenly lit.</p>
      <div className="photoFrame">
        <img src={url} alt="Your photo" />
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onAnalyze}>
          <ScanFace size={18} aria-hidden /> Analyze my skin
        </button>
        <button type="button" className="btn secondary" onClick={onRetake}>
          <RefreshCw size={17} aria-hidden /> Choose another photo
        </button>
      </div>
    </section>
  );
}
