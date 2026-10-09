/* eslint-disable @next/next/no-img-element -- local object URL of the user's own photo */
'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './LocaleProvider';

export default function Analyzing({ url }: { url: string }) {
  const { t } = useI18n();
  const stages = t.analyzing.stages;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStage((s) => Math.min(stages.length - 1, s + 1)), 1400);
    return () => window.clearInterval(id);
  }, [stages.length]);

  return (
    <section className="stepCard glass analyzing" aria-live="polite" aria-busy="true">
      <div className="photoFrame scanning">
        <img src={url} alt={t.analyzing.alt} />
        <div className="scanGrid" aria-hidden />
        <div className="scanBeam" aria-hidden />
      </div>
      <h2>{t.analyzing.title}</h2>
      <ol className="stageList">
        {stages.map((label, i) => (
          <li key={label} className={i < stage ? 'done' : i === stage ? 'active' : undefined}>
            <span className="stageDot" aria-hidden />
            {label}
          </li>
        ))}
      </ol>
    </section>
  );
}
