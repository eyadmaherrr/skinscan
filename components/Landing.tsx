'use client';

import { ArrowRight, Clock, ShieldCheck, UserRound } from 'lucide-react';
import FaceScanIllustration from './FaceScanIllustration';
import { useI18n } from './LocaleProvider';

export default function Landing({ onStart, signInNeeded }: { onStart: () => void; signInNeeded: boolean }) {
  const { t } = useI18n();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="heroText">
        <span className="eyebrow">{t.clinicName}</span>
        <h1 id="hero-title">
          {t.landing.titleA}
          <span>{t.landing.titleB}</span>
          <span className="heroByline">{t.landing.byline}</span>
        </h1>
        <p className="lead">{t.landing.lead}</p>
        <div className="actions">
          <button type="button" className="btn primary lg" onClick={onStart}>
            {t.landing.start} <ArrowRight className="flipRtl" size={18} aria-hidden />
          </button>
        </div>
        <p className="finePrint">{t.landing.finePrint}</p>
        <ul className="trustRow" aria-label={t.landing.about}>
          <li>
            <ShieldCheck size={15} aria-hidden /> {t.landing.notStored}
          </li>
          <li>
            <UserRound size={15} aria-hidden /> {signInNeeded ? t.landing.signInToStart : t.landing.noAccount}
          </li>
          <li>
            <Clock size={15} aria-hidden /> {t.landing.minute}
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
