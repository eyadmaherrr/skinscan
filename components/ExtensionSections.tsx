'use client';

import { FlaskConical, Info, Sparkles } from 'lucide-react';
import { fill, useI18n } from './LocaleProvider';
import { format } from '@/lib/messages';
import type { AcneReport, AcneSeverity, PoreReport, RegionKey, SkinAgeReport } from '@/lib/skin-analysis/types';

function Limitations({ items }: { items: string[] }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <details className="limitations">
      <summary>{t.acne.limitations}</summary>
      <ul>
        {items.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

function ProbabilityBars({ probabilities }: { probabilities: Record<string, number> }) {
  const { t } = useI18n();
  return (
    <ul className="probBars">
      {Object.entries(probabilities).map(([label, p]) => (
        <li key={label}>
          <span>{t.acne.levels[label] ?? label}</span>
          <span className="meter" aria-hidden>
            <span style={{ width: `${Math.max(1, p * 100)}%` }} />
          </span>
          <span className="pct">{Math.round(p * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

function SeverityEstimate({ severity }: { severity: AcneSeverity }) {
  const { t } = useI18n();
  if (severity.status !== 'ok' || !severity.label || !severity.probabilities) {
    return <p className="extText muted">{t.acne.failed}</p>;
  }
  const grader = severity.components?.countGrader;
  const classifier = severity.components?.imageClassifier;
  const combined = severity.method === 'combined';
  return (
    <>
      <div className="severityLead">
        <b>{t.acne.levels[severity.label] ?? severity.label}</b>
        {severity.confidenceLabel ? (
          <span className={`tag conf-${severity.confidenceLabel}`}>
            <span className="dot" aria-hidden />
            {t.confidence[severity.confidenceLabel]}
          </span>
        ) : null}
      </div>
      <ProbabilityBars probabilities={severity.probabilities} />
      <p className="extText small">
        {combined
          ? t.acne.methodCombined
          : format(t.acne.methodGrader, { n: grader?.inflammatoryLookingSpots ?? 0 })}
      </p>
      {combined && grader?.label && classifier?.label ? (
        <ul className="regionChips">
          <li>
            {t.acne.grader} <b>{t.acne.levels[grader.label] ?? grader.label}</b>
          </li>
          <li>
            {t.acne.classifier} <b>{t.acne.levels[classifier.label] ?? classifier.label}</b>
          </li>
        </ul>
      ) : null}
      {combined ? <p className="extText small">{severity.modelsAgree ? t.acne.agree : t.acne.disagree}</p> : null}
      <p className="notice">
        <Info size={14} aria-hidden /> {t.acne.notice}
      </p>
    </>
  );
}

export function AcneSection({ acne }: { acne: AcneReport }) {
  const { t } = useI18n();
  const regions = Object.entries(acne.regionalSummary) as [RegionKey, { count: number; visible: boolean }][];
  const count = acne.lesionCandidateCount ?? 0;
  return (
    <section className="glass extSection" aria-labelledby="acne-title">
      <div className="extHead">
        <h3 id="acne-title">{t.acne.title}</h3>
        <span className="tag experimental">
          <FlaskConical size={13} aria-hidden /> {t.acne.experimental}
        </span>
      </div>

      {acne.status === 'ok' ? (
        <>
          <p className="extLead">
            {fill(count === 1 ? t.acne.candidate : t.acne.candidates, { n: <strong>{count}</strong> })}
            <span className="muted"> · {format(t.acne.tones, { red: acne.redToneCount ?? 0, dark: acne.darkToneCount ?? 0 })}</span>
          </p>
          <p className="extText">{acne.explanation}</p>
          <ul className="regionChips" aria-label={t.acne.byRegion}>
            {regions.map(([k, r]) => (
              <li key={k} className={r.visible ? undefined : 'hiddenRegion'}>
                {t.regions[k]} <b>{r.visible ? r.count : t.acne.notVisible}</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="extText">{acne.explanation}</p>
      )}

      <div className="severityBox">
        <strong>{t.acne.severity}</strong>
        <SeverityEstimate severity={acne.severity} />
      </div>
      <Limitations items={acne.limitations} />
    </section>
  );
}

export function PoresSection({ pores }: { pores: PoreReport }) {
  const { t } = useI18n();
  const regions = Object.entries(pores.regionalSummary) as [RegionKey, number][];
  const ok = pores.status === 'ok' && pores.visibilityScore !== null;
  return (
    <section className="glass extSection" aria-labelledby="pores-title">
      <div className="extHead">
        <h3 id="pores-title">{t.pores.title}</h3>
        <span className="tag experimental">
          <FlaskConical size={13} aria-hidden /> {t.acne.experimental}
        </span>
      </div>
      {ok ? (
        <>
          <div className="metricHead">
            <span className="muted small">{t.pores.index}</span>
            <span className="metricScore">
              {pores.visibilityScore}
              <small>/100</small>
            </span>
          </div>
          <div className="meter" aria-hidden>
            <span style={{ width: `${Math.max(2, pores.visibilityScore as number)}%` }} />
          </div>
          {pores.confidenceLabel ? (
            <div className="metricTags">
              <span className={`tag conf-${pores.confidenceLabel}`}>
                <span className="dot" aria-hidden />
                {t.confidence[pores.confidenceLabel]}
              </span>
            </div>
          ) : null}
          <p className="extText">{pores.explanation}</p>
          {regions.length ? (
            <ul className="regionChips" aria-label={t.pores.byRegion}>
              {regions.map(([k, v]) => (
                <li key={k}>
                  {t.regions[k]} <b>{v}</b>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <p className="extText">{pores.explanation}</p>
          {pores.status === 'insufficient_quality' ? (
            <ul className="reasonList">
              {pores.limitations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <p className="notice">
        <Info size={14} aria-hidden /> {t.pores.notice}
      </p>
      {ok ? <Limitations items={pores.limitations} /> : null}
    </section>
  );
}

/** Skin age (apparent age) estimate, shown next to the photo. */
export function SkinAgeCard({ skinAge }: { skinAge: SkinAgeReport }) {
  const { t } = useI18n();
  if (skinAge.status === 'disabled' || skinAge.status === 'not_configured') return null;
  const ok = skinAge.status === 'ok' && skinAge.minYears !== null && skinAge.probabilities;
  return (
    <section className="skinAge" aria-labelledby="skin-age-title">
      <div className="extHead">
        <h3 id="skin-age-title">{t.skinAge.title}</h3>
        <span className="tag experimental">
          <Sparkles size={13} aria-hidden /> {t.skinAge.tag}
        </span>
      </div>
      {ok ? (
        <>
          <p className="muted small">{t.skinAge.lead}</p>
          <p className="skinAgeValue">
            {skinAge.maxYears === null
              ? format(t.skinAge.yearsPlus, { min: skinAge.minYears as number })
              : format(t.skinAge.years, { min: skinAge.minYears as number, max: skinAge.maxYears })}
          </p>
          <p className="muted small">{format(t.skinAge.probability, { pct: Math.round((skinAge.probability ?? 0) * 100) })}</p>
          <details className="limitations">
            <summary>{t.skinAge.ranges}</summary>
            <ul className="probBars">
              {Object.entries(skinAge.probabilities as Record<string, number>).map(([range, p]) => (
                <li key={range}>
                  <span dir="ltr">{range}</span>
                  <span className="meter" aria-hidden>
                    <span style={{ width: `${Math.max(1, p * 100)}%` }} />
                  </span>
                  <span className="pct">{Math.round(p * 100)}%</span>
                </li>
              ))}
            </ul>
          </details>
          <p className="notice">
            <Info size={14} aria-hidden /> {t.skinAge.notice}
          </p>
          <Limitations items={skinAge.limitations} />
        </>
      ) : (
        <p className="extText muted">{skinAge.explanation}</p>
      )}
    </section>
  );
}
