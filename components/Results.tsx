/* eslint-disable @next/next/no-img-element -- local object URL of the user's own photo */
'use client';

import { CalendarCheck, ChevronDown, Info, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { ENGINE_NAME, SITE_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';
import { BAND_LABELS, CONFIDENCE_LABELS, METRIC_LABELS } from '@/lib/skin-analysis/labels';
import { METRIC_KEYS, type MetricKey, type ScanSuccess } from '@/lib/skin-analysis/types';

interface Props {
  result: ScanSuccess;
  photoUrl: string;
  photoAspect: number;
  onScanAgain: () => void;
}

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`Overall analysis confidence ${pct}%`}>
      <svg viewBox="0 0 84 84" aria-hidden>
        <circle cx="42" cy="42" r={r} className="ringTrack" />
        <circle cx="42" cy="42" r={r} className="ringValue" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span>{pct}%</span>
    </div>
  );
}

function MetricRow({ k, result }: { k: MetricKey; result: ScanSuccess }) {
  const m = result.analysis[k];
  const reported = m.score !== null;
  return (
    <li className={`metric${reported ? '' : ' metricInsufficient'}`}>
      <div className="metricHead">
        <h3>{METRIC_LABELS[k]}</h3>
        {reported ? (
          <span className="metricScore">
            {m.score}
            <small>/100</small>
          </span>
        ) : (
          <span className="metricScore none">—</span>
        )}
      </div>
      {reported ? (
        <div className="meter" aria-hidden>
          <span style={{ width: `${Math.max(2, m.score as number)}%` }} />
        </div>
      ) : null}
      <div className="metricTags">
        {m.band ? <span className={`tag band-${m.band}`}>{BAND_LABELS[m.band]}</span> : null}
        <span className={`tag conf-${m.confidenceLabel}`}>
          <span className="dot" aria-hidden />
          {CONFIDENCE_LABELS[m.confidenceLabel]}
        </span>
      </div>
      <p>{m.explanation}</p>
    </li>
  );
}

export default function Results({ result, photoUrl, photoAspect, onScanAgain }: Props) {
  const [showRegions, setShowRegions] = useState(true);
  const date = new Date(result.createdAt);

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="resultsHead">
        <span className="eyebrow">{SITE_NAME}</span>
        <h2 id="results-title">Your visible skin profile</h2>
        <p className="muted small">
          {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="resultsGrid">
        <aside className="glass resultsSide">
          <div className="photoFrame resultPhoto" style={{ aspectRatio: String(photoAspect) }}>
            <img src={photoUrl} alt="Your analysed photo" />
            {showRegions ? (
              <svg className="regionOverlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
                {result.regions.map((r) => (
                  <polygon key={r.region} points={r.points.map(([x, y]) => `${x},${y}`).join(' ')} />
                ))}
              </svg>
            ) : null}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
            <span>Show analysed areas</span>
          </label>

          <div className="overall">
            <ConfidenceRing value={result.overallConfidence} />
            <div>
              <strong>Overall analysis confidence</strong>
              <p className="muted small">How reliable these measurements are for this photo.</p>
            </div>
          </div>

          {result.imageQuality.notes.length ? (
            <ul className="qualityNotes">
              {result.imageQuality.notes.map((n) => (
                <li key={n}>
                  <Info size={14} aria-hidden /> {n}
                </li>
              ))}
            </ul>
          ) : null}
        </aside>

        <div className="glass resultsMain">
          <p className="scaleNote">
            Scores show how visible each characteristic is in this photo, from 0 (not visible) to 100 (very visible).
          </p>
          <ul className="metrics">
            {METRIC_KEYS.map((k) => (
              <MetricRow key={k} k={k} result={result} />
            ))}
          </ul>
        </div>
      </div>

      <div className="glass disclaimer">
        <Info size={18} aria-hidden />
        <p>
          These results describe visible characteristics detected in your image and are not a medical diagnosis. Only a
          dermatologist can examine and diagnose skin conditions.
        </p>
      </div>

      <p className="engineNote">Analysed by {ENGINE_NAME}</p>

      <div className="actions center resultsActions">
        <a className="btn primary lg" href={publicConfig.bookingUrl} target="_blank" rel="noopener noreferrer">
          <CalendarCheck size={18} aria-hidden /> Book a Consultation
        </a>
        <button type="button" className="btn secondary lg" onClick={onScanAgain}>
          <RotateCcw size={17} aria-hidden /> Scan Again
        </button>
      </div>

      <details className="glass howItWorks">
        <summary>
          How this works <ChevronDown size={18} aria-hidden />
        </summary>
        <div className="howBody">
          <ol>
            <li>
              <strong>{ENGINE_NAME}.</strong> SkinScan&apos;s analysis engine combines open-source computer-vision
              models with measurement methods used in skin colorimetry. It runs on the clinic&apos;s own server.
            </li>
            <li>
              <strong>Photo check.</strong> The photo is first checked for focus, exposure, lighting balance, head angle,
              filters and glasses. If it is not clear enough, we ask for a retake instead of guessing.
            </li>
            <li>
              <strong>Face and skin regions.</strong> Open-source computer-vision models locate your face and 478 facial
              landmarks and separate skin from hair and accessories. The forehead, nose, cheeks, chin and under-eye
              areas are analysed separately; eyes, brows and lips are excluded.
            </li>
            <li>
              <strong>Measurements.</strong> Colour is measured in the CIELAB colour space used in skin colorimetry
              (redness and pigmentation are compared with your own surrounding skin, so they do not depend on your skin
              tone). Texture and spots are measured from fine image detail at real-world scale.
            </li>
            <li>
              <strong>Scores and confidence.</strong> Each measurement is converted to a 0–100 visibility score. Its
              confidence reflects photo quality and how much skin could be measured. Low-confidence measurements are
              not scored.
            </li>
          </ol>
          <p className="muted small">
            The same photo always gives the same result. Lighting, camera and make-up can change results between photos.
            Scores have not been clinically validated and are not medical grades. Your photo is processed in memory for
            this scan and is not stored.
          </p>
        </div>
      </details>
    </section>
  );
}
