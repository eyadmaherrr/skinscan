'use client';

import { CalendarCheck, ChevronDown, Download, Info, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { AcneSection, SkinAgeCard, SkinToneUniformitySection } from './ExtensionSections';
import { useI18n } from './LocaleProvider';
import MetricInfoModal, { ScoreInfoButton } from './MetricInfoModal';
import type { ExplainingMetricKey } from '@/lib/metric-explanations';
import PhotoOverlay from './PhotoOverlay';
import { ENGINE_NAME } from '@/lib/brand';
import type { PreparedImage } from '@/lib/client/prepare-image';
import { bookingLink } from '@/lib/client/use-auth';
import { format } from '@/lib/messages';
import { METRIC_KEYS, type MetricKey, type ScanSuccess } from '@/lib/skin-analysis/types';

interface Props {
  result: ScanSuccess;
  photo: PreparedImage;
  onScanAgain: () => void;
}

function ConfidenceRing({ value }: { value: number }) {
  const { t } = useI18n();
  const pct = Math.round(value * 100);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={format(t.results.overallAria, { pct })}>
      <svg viewBox="0 0 84 84" aria-hidden>
        <circle cx="42" cy="42" r={r} className="ringTrack" />
        <circle cx="42" cy="42" r={r} className="ringValue" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span>{pct}%</span>
    </div>
  );
}

function MetricRow({
  k,
  result,
  onOpenInfo,
}: {
  k: MetricKey;
  result: ScanSuccess;
  onOpenInfo: (key: ExplainingMetricKey, score?: number | null, band?: string | null) => void;
}) {
  const { t } = useI18n();
  const m = result.analysis[k];
  const reported = m.score !== null;
  return (
    <li className={`metric${reported ? '' : ' metricInsufficient'}`}>
      <div className="metricHead">
        <h3>{t.metrics[k]}</h3>
        <div className="scoreWithInfo">
          {reported ? (
            <span className="metricScore">
              {m.score}
              <small>/100</small>
            </span>
          ) : (
            <span className="metricScore none">—</span>
          )}
          <ScoreInfoButton onClick={() => onOpenInfo(k, m.score, m.band ? t.bands[m.band] : null)} />
        </div>
      </div>
      {reported ? (
        <div className="meter" aria-hidden>
          <span style={{ width: `${Math.max(2, m.score as number)}%` }} />
        </div>
      ) : null}
      <div className="metricTags">
        {m.band ? <span className={`tag band-${m.band}`}>{t.bands[m.band]}</span> : null}
        <span className={`tag conf-${m.confidenceLabel}`}>
          <span className="dot" aria-hidden />
          {t.confidence[m.confidenceLabel]}
        </span>
      </div>
      <p>{m.explanation}</p>
    </li>
  );
}

export default function Results({ result, photo, onScanAgain }: Props) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [infoModal, setInfoModal] = useState<{
    key: ExplainingMetricKey;
    score?: number | null;
    band?: string | null;
  } | null>(null);
  const date = new Date(result.createdAt);

  const handleOpenInfo = (key: ExplainingMetricKey, score?: number | null, band?: string | null) => {
    setInfoModal({ key, score, band });
  };

  async function download() {
    setReport('busy');
    try {
      // Loaded on demand: the report code is only needed when someone asks for it.
      const { downloadReport } = await import('@/lib/client/report');
      await downloadReport(result, photo, locale);
      setReport('idle');
    } catch {
      setReport('failed');
    }
  }

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="resultsHead">
        <span className="eyebrow">{t.siteName}</span>
        <h2 id="results-title">{t.results.title}</h2>
        <p className="muted small">
          {date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="resultsGrid">
        <aside className="glass resultsSide">
          <PhotoOverlay result={result} photoUrl={photo.url} photoAspect={photo.width / photo.height} />

          <div className="overall">
            <ConfidenceRing value={result.overallConfidence} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{t.results.overall}</strong>
                <ScoreInfoButton
                  onClick={() => handleOpenInfo('overallConfidence', Math.round(result.overallConfidence * 100))}
                />
              </div>
              <p className="muted small">{t.results.overallSub}</p>
            </div>
          </div>

          {result.skinAge ? <SkinAgeCard skinAge={result.skinAge} onOpenInfo={handleOpenInfo} /> : null}

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
          <p className="scaleNote">{t.results.scaleNote}</p>
          <ul className="metrics">
            {METRIC_KEYS.map((k) => (
              <MetricRow key={k} k={k} result={result} onOpenInfo={handleOpenInfo} />
            ))}
            {result.skinToneUniformity && result.skinToneUniformity.status === 'ok' && result.skinToneUniformity.uniformityScore !== null ? (
              <li className="metric">
                <div className="metricHead">
                  <h3>{t.skinToneUniformity.title}</h3>
                  <div className="scoreWithInfo">
                    <span className="metricScore">
                      {result.skinToneUniformity.uniformityScore}
                      <small>/100</small>
                    </span>
                    <ScoreInfoButton
                      onClick={() =>
                        handleOpenInfo(
                          'skinToneUniformity',
                          result.skinToneUniformity?.uniformityScore,
                          result.skinToneUniformity?.band ? t.skinToneUniformity[result.skinToneUniformity.band] : null,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="meter" aria-hidden>
                  <span style={{ width: `${Math.max(2, result.skinToneUniformity.uniformityScore)}%` }} />
                </div>
                <div className="metricTags">
                  {result.skinToneUniformity.band ? (
                    <span className="tag band-moderate">{t.skinToneUniformity[result.skinToneUniformity.band]}</span>
                  ) : null}
                  <span className="tag conf-high">
                    <span className="dot" aria-hidden />
                    {t.confidence.high}
                  </span>
                </div>
                <p>{result.skinToneUniformity.explanation}</p>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {result.skinToneUniformity || result.acne ? (
        <div className="extGrid">
          {result.skinToneUniformity ? (
            <SkinToneUniformitySection uniformity={result.skinToneUniformity} onOpenInfo={handleOpenInfo} />
          ) : null}
          {result.acne ? <AcneSection acne={result.acne} onOpenInfo={handleOpenInfo} /> : null}
        </div>
      ) : null}

      <div className="glass disclaimer">
        <Info size={18} aria-hidden />
        <p>{t.results.disclaimer}</p>
      </div>

      <p className="engineNote">{format(t.results.engine, { engine: ENGINE_NAME })}</p>

      <div className="actions center resultsActions">
        <a className="btn primary lg" href={bookingLink(locale)} target="_blank" rel="noopener noreferrer">
          <CalendarCheck size={18} aria-hidden /> {t.results.book}
        </a>
        <button type="button" className="btn secondary lg" onClick={download} disabled={report === 'busy'}>
          {report === 'busy' ? <Loader2 className="spin" size={18} aria-hidden /> : <Download size={18} aria-hidden />}
          {report === 'busy' ? t.results.preparing : t.results.download}
        </button>
        <button type="button" className="btn secondary lg" onClick={onScanAgain}>
          <RotateCcw size={17} aria-hidden /> {t.results.again}
        </button>
      </div>
      {report === 'failed' ? (
        <p className="inlineError center" role="alert">
          {t.results.downloadFailed}
        </p>
      ) : null}

      <details className="glass howItWorks">
        <summary>
          {t.results.how} <ChevronDown size={18} aria-hidden />
        </summary>
        <div className="howBody">
          <ol>
            {t.results.howItems.map(([title, text]) => (
              <li key={title}>
                <strong>{format(title, { engine: ENGINE_NAME })}</strong> {text}
              </li>
            ))}
          </ol>
          <p className="muted small">{t.results.howFoot}</p>
        </div>
      </details>

      <MetricInfoModal
        metricKey={infoModal?.key ?? null}
        currentScore={infoModal?.score}
        currentBand={infoModal?.band}
        onClose={() => setInfoModal(null)}
      />
    </section>
  );
}
