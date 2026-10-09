import { ArrowRight, Clock, ShieldCheck, UserRound } from 'lucide-react';
import FaceScanIllustration from './FaceScanIllustration';

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="heroText">
        <span className="eyebrow">Dr. Maher Mahmoud Clinics</span>
        <h1 id="hero-title">
          Skin<span>Scan</span>
          <span className="heroByline">by Dr Maher</span>
        </h1>
        <p className="lead">Analyze visible skin characteristics from a facial photo using AI-powered computer vision.</p>
        <div className="actions">
          <button type="button" className="btn primary lg" onClick={onStart}>
            Start Skin Scan <ArrowRight size={18} aria-hidden />
          </button>
        </div>
        <p className="finePrint">
          For informational purposes only. This scan does not replace a dermatologist&apos;s examination.
        </p>
        <ul className="trustRow" aria-label="About this scan">
          <li>
            <ShieldCheck size={15} aria-hidden /> Photo is not stored
          </li>
          <li>
            <UserRound size={15} aria-hidden /> Dr. Maher account required
          </li>
          <li>
            <Clock size={15} aria-hidden /> Takes about a minute
          </li>
        </ul>
      </div>
      <div className="heroVisual" aria-hidden>
        <div className="glass heroCard">
          <FaceScanIllustration />
        </div>
      </div>
    </section>
  );
}
