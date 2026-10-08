/* eslint-disable @next/next/no-img-element -- local object URL of the user's own photo */
'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  'Checking photo quality',
  'Locating your face and facial regions',
  'Separating skin from hair, eyes and lips',
  'Measuring colour, texture and spots',
  'Calculating confidence',
];

export default function Analyzing({ url }: { url: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="stepCard glass analyzing" aria-live="polite" aria-busy="true">
      <div className="photoFrame scanning">
        <img src={url} alt="Your photo being analysed" />
        <div className="scanGrid" aria-hidden />
        <div className="scanBeam" aria-hidden />
      </div>
      <h2>Analysing your photo</h2>
      <ol className="stageList">
        {STAGES.map((label, i) => (
          <li key={label} className={i < stage ? 'done' : i === stage ? 'active' : undefined}>
            <span className="stageDot" aria-hidden />
            {label}
          </li>
        ))}
      </ol>
    </section>
  );
}
