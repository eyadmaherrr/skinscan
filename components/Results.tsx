'use client';

import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Contrast,
  Crosshair,
  Download,
  Droplet,
  Eye,
  Hash,
  Info,
  Loader2,
  Palette,
  RotateCcw,
  ScanFace,
  Waves,
  type LucideIcon,
} from 'lucide-react';
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
import { METRIC_KEYS, type MetricKey, type ScanSuccess, type ScoreBand } from '@/lib/skin-analysis/types';

interface Props {
  result: ScanSuccess;
  photo: PreparedImage;
  onScanAgain: () => void;
}

type OpenInfo = (key: ExplainingMetricKey, score?: number | null, band?: string | null) => void;
type Tab = 'overview' | 'details';

const METRIC_ICONS: Record<MetricKey, LucideIcon> = {
  pigmentation: Palette,
  redness: CircleDot,
  texture: Waves,
  blemishes: Crosshair,
  shine: Droplet,
  underEye: Eye,
};

/** Uniformity bands mapped onto the colour of the visibility bands (higher uniformity = calmer colour). */
const UNIFORMITY_TONE: Record<'high' | 'moderate' | 'variable', ScoreBand> = {
  high: 'minimal',
  moderate: 'mild',
  variable: 'moderate',
};

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

/** One line of "Key findings": the characteristic and how visible it was; it jumps to its measurement card. */
function Finding({ k, result }: { k: MetricKey; result: ScanSuccess }) {
  const { t } = useI18n();
  const m = result.analysis[k];
  const Icon = METRIC_ICONS[k];
  function jump() {
    const card = document.getElementById(`measure-${k}`);
    if (!card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
  }
  return (
    <li>
      <button type="button" className="finding" onClick={jump}>
        <span className="findingIcon" aria-hidden>
          <Icon size={18} />
        </span>
        <span className="findingName">{t.metrics[k]}</span>
        {m.band ? (
          <span className={`bandChip tone-${m.band}`}>{t.bands[m.band]}</span>
        ) : (
          <span className="bandChip tone-none">{t.results.notAssessed}</span>
        )}
      </button>
    </li>
  );
}

/** A measurement card in the "Skin measurements" grid. */
function MeasureCard({
  id,
  icon: Icon,
  title,
  score,
  tone,
  label,
  onInfo,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  score: number | null;
  tone: ScoreBand | 'none';
  label: string;
  onInfo: () => void;
}) {
  const { t } = useI18n();
  return (
    <li>
      <button
        type="button"
        id={id}
        className={`measureCard tone-${tone}`}
        onClick={onInfo}
        aria-label={`${title}: ${score === null ? label : `${score}/100, ${label}`}. ${format(t.results.openInfo, { name: title })}`}
      >
        <span className="measureHead">
          <span className="measureIcon" aria-hidden>
            <Icon size={20} />
          </span>
          <span className="measureTitle">{title}</span>
          <ChevronRight className="measureChevron flipRtl" size={18} aria-hidden />
        </span>
        {score === null ? (
          <span className="measureScore none" aria-hidden>
            —
          </span>
        ) : (
          <span className="measureScore" aria-hidden>
            {score}
            <small>/100</small>
          </span>
        )}
        <span className="measureMeter" aria-hidden>
          <span style={{ width: `${score === null ? 0 : Math.max(2, score)}%` }} />
        </span>
        <span className="measureBand" aria-hidden>
          <span className="dot" />
          {label}
        </span>
      </button>
    </li>
  );
}

/** Full explanation of one measurement (Detailed analysis tab). */
function MetricRow({ k, result, onOpenInfo }: { k: MetricKey; result: ScanSuccess; onOpenInfo: OpenInfo }) {
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
        {m.band ? <span className={`bandChip tone-${m.band}`}>{t.bands[m.band]}</span> : null}
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
  const [tab, setTab] = useState<Tab>('overview');
  const [report, setReport] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [infoModal, setInfoModal] = useState<{ key: ExplainingMetricKey; score?: number | null; band?: string | null } | null>(null);
  const date = new Date(result.createdAt);
  const dateLocale = locale === 'ar' ? 'ar-EG' : undefined;
  const uniformity = result.skinToneUniformity;
  const uniformityOk = uniformity?.status === 'ok' && uniformity.uniformityScore !== null;

  const openInfo: OpenInfo = (key, score, band) => setInfoModal({ key, score, band });

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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t.results.tabOverview },
    { id: 'details', label: t.results.tabDetails },
  ];

  return (
    <section className="results" aria-labelledby="results-title">
      <header className="resultsTop">
        <div className="resultsBrand">
          <span className="resultsBrandMark" aria-hidden>
            <ScanFace size={26} />
          </span>
          <div>
            <h2 id="results-title">{t.results.title}</h2>
            <p className="muted small">{t.results.byline}</p>
          </div>
        </div>
        <div className="resultsMetaRow">
          <div className="metaChip">
            <span>
              <CalendarDays size={13} aria-hidden /> {t.results.date}
            </span>
            <b>
              {date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
              {date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
            </b>
          </div>
          <div className="metaChip">
            <span>
              <Hash size={13} aria-hidden /> {t.results.reportId}
            </span>
            <b dir="ltr">#{result.scanId.slice(0, 8).toUpperCase()}</b>
          </div>
          <button type="button" className="btn secondary" onClick={download} disabled={report === 'busy'}>
            {report === 'busy' ? <Loader2 className="spin" size={17} aria-hidden /> : <Download size={17} aria-hidden />}
            {report === 'busy' ? t.results.preparing : t.results.download}
          </button>
        </div>
      </header>
      {report === 'failed' ? (
        <p className="inlineError center" role="alert">
          {t.results.downloadFailed}
        </p>
      ) : null}

      <div className="resultsTabs" role="tablist" aria-label={t.results.tabsAria}>
        {tabs.map((x) => (
          <button
            key={x.id}
            id={`tab-${x.id}`}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            aria-controls={`panel-${x.id}`}
            className={tab === x.id ? 'active' : undefined}
            tabIndex={tab === x.id ? 0 : -1}
            onClick={() => setTab(x.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              const next = tabs[(tabs.findIndex((y) => y.id === x.id) + 1) % tabs.length].id;
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="resultsPanel">
          <div className="overviewGrid">
            <div className="glass panel photoCard">
              <PhotoOverlay result={result} photoUrl={photo.url} photoAspect={photo.width / photo.height} />
            </div>

            <div className="glass panel summaryCard">
              <h3 className="cardTitle">{t.results.overallTitle}</h3>
              <div className="overallRow">
                <ConfidenceRing value={result.overallConfidence} />
                <div>
                  <div className="titleWithInfo">
                    <strong>{t.results.overall}</strong>
                    <ScoreInfoButton onClick={() => openInfo('overallConfidence', Math.round(result.overallConfidence * 100))} />
                  </div>
                  <p className="muted small">{t.results.overallSub}</p>
                </div>
              </div>
              <div className="photoNote">
                <Info size={15} aria-hidden />
                <div>
                  <p>{result.imageQuality.notes.length ? t.results.photoNotes : t.results.photoGood}</p>
                  {result.imageQuality.notes.length ? (
                    <ul>
                      {result.imageQuality.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              {result.skinAge ? <SkinAgeCard skinAge={result.skinAge} onOpenInfo={openInfo} /> : null}
            </div>

            <div className="glass panel findingsCard">
              <h3 className="cardTitle">{t.results.keyFindings}</h3>
              <ul className="findings">
                {METRIC_KEYS.map((k) => (
                  <Finding key={k} k={k} result={result} />
                ))}
              </ul>
              <button type="button" className="linkButton" onClick={() => setTab('details')}>
                {t.results.seeDetails} <ChevronRight className="flipRtl" size={15} aria-hidden />
              </button>
            </div>
          </div>

          <section className="glass panel" aria-labelledby="measurements-title">
            <div className="sectionHead">
              <h3 id="measurements-title" className="cardTitle">
                {t.results.measurements}
              </h3>
              <p className="muted small">{t.results.scaleNote}</p>
            </div>
            <ul className="measureGrid">
              {METRIC_KEYS.map((k) => {
                const m = result.analysis[k];
                return (
                  <MeasureCard
                    key={k}
                    id={`measure-${k}`}
                    icon={METRIC_ICONS[k]}
                    title={t.metrics[k]}
                    score={m.score}
                    tone={m.band ?? 'none'}
                    label={m.band ? t.bands[m.band] : t.results.notAssessed}
                    onInfo={() => openInfo(k, m.score, m.band ? t.bands[m.band] : null)}
                  />
                );
              })}
              {uniformity && uniformityOk ? (
                <MeasureCard
                  id="measure-skinToneUniformity"
                  icon={Contrast}
                  title={t.skinToneUniformity.title}
                  score={uniformity.uniformityScore}
                  tone={uniformity.band ? UNIFORMITY_TONE[uniformity.band] : 'none'}
                  label={uniformity.band ? t.skinToneUniformity[uniformity.band] : t.results.notAssessed}
                  onInfo={() =>
                    openInfo(
                      'skinToneUniformity',
                      uniformity.uniformityScore,
                      uniformity.band ? t.skinToneUniformity[uniformity.band] : null,
                    )
                  }
                />
              ) : null}
            </ul>
          </section>

          {uniformity || result.acne ? (
            <div className="extGrid">
              {uniformity ? <SkinToneUniformitySection uniformity={uniformity} onOpenInfo={openInfo} /> : null}
              {result.acne ? <AcneSection acne={result.acne} onOpenInfo={openInfo} /> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div id="panel-details" role="tabpanel" aria-labelledby="tab-details" className="resultsPanel">
          <div className="glass panel resultsMain">
            <p className="scaleNote">{t.results.scaleNote}</p>
            <ul className="metrics">
              {METRIC_KEYS.map((k) => (
                <MetricRow key={k} k={k} result={result} onOpenInfo={openInfo} />
              ))}
            </ul>
          </div>

          <details className="glass howItWorks" open>
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
        </div>
      )}

      <div className="glass disclaimer">
        <Info size={18} aria-hidden />
        <p>{t.results.disclaimer}</p>
      </div>

      <p className="engineNote">{format(t.results.engine, { engine: ENGINE_NAME })}</p>

      <div className="actions center resultsActions">
        <a className="btn primary lg" href={bookingLink(locale)} target="_blank" rel="noopener noreferrer">
          <CalendarCheck size={18} aria-hidden /> {t.results.book}
        </a>
        <button type="button" className="btn secondary lg" onClick={onScanAgain}>
          <RotateCcw size={17} aria-hidden /> {t.results.again}
        </button>
      </div>

      <MetricInfoModal
        metricKey={infoModal?.key ?? null}
        currentScore={infoModal?.score}
        currentBand={infoModal?.band}
        onClose={() => setInfoModal(null)}
      />
    </section>
  );
}
