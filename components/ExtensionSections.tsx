'use client';

import { FlaskConical, Info, Palette, Sparkles } from 'lucide-react';
import { fill, useI18n } from './LocaleProvider';
import { ScoreInfoButton } from './MetricInfoModal';
import type { ExplainingMetricKey } from '@/lib/metric-explanations';
import { format } from '@/lib/messages';
import type {
  AcneReport,
  AcneSeverity,
  PoreReport,
  RegionKey,
  SkinAgeReport,
  SkinToneUniformityReport,
} from '@/lib/skin-analysis/types';

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

export function AcneSection({
  acne,
  onOpenInfo,
}: {
  acne: AcneReport;
  onOpenInfo?: (key: ExplainingMetricKey, score?: number | null, band?: string | null) => void;
}) {
  const { t } = useI18n();
  const regions = Object.entries(acne.regionalSummary) as [RegionKey, { count: number; visible: boolean }][];
  const count = acne.lesionCandidateCount ?? 0;
  return (
    <section className="glass panel extSection" aria-labelledby="acne-title">
      <div className="extHead">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 id="acne-title">{t.acne.title}</h3>
          {onOpenInfo ? <ScoreInfoButton onClick={() => onOpenInfo('acne')} /> : null}
        </div>
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

export function PoresSection({
  pores,
  onOpenInfo,
}: {
  pores: PoreReport;
  onOpenInfo?: (key: ExplainingMetricKey, score?: number | null, band?: string | null) => void;
}) {
  const { t } = useI18n();
  const regions = Object.entries(pores.regionalSummary) as [RegionKey, number][];
  const ok = pores.status === 'ok' && pores.visibilityScore !== null;
  return (
    <section className="glass panel extSection" aria-labelledby="pores-title">
      <div className="extHead">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 id="pores-title">{t.pores.title}</h3>
          {onOpenInfo ? <ScoreInfoButton onClick={() => onOpenInfo('pores', pores.visibilityScore)} /> : null}
        </div>
        <span className="tag experimental">
          <FlaskConical size={13} aria-hidden /> {t.acne.experimental}
        </span>
      </div>
      {ok ? (
        <>
          <div className="metricHead">
            <span className="muted small">{t.pores.index}</span>
            <div className="scoreWithInfo">
              <span className="metricScore">
                {pores.visibilityScore}
                <small>/100</small>
              </span>
              {onOpenInfo ? <ScoreInfoButton onClick={() => onOpenInfo('pores', pores.visibilityScore)} /> : null}
            </div>
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
export function SkinAgeCard({
  skinAge,
  onOpenInfo,
}: {
  skinAge: SkinAgeReport;
  onOpenInfo?: (key: ExplainingMetricKey, score?: number | null, band?: string | null) => void;
}) {
  const { t } = useI18n();
  if (skinAge.status === 'disabled' || skinAge.status === 'not_configured') return null;
  const ok = skinAge.status === 'ok' && skinAge.minYears !== null && skinAge.probabilities;
  return (
    <section className="skinAge" aria-labelledby="skin-age-title">
      <div className="extHead">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 id="skin-age-title">{t.skinAge.title}</h3>
          {onOpenInfo ? <ScoreInfoButton onClick={() => onOpenInfo('skinAge')} /> : null}
        </div>
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

export function SkinToneUniformitySection({
  uniformity,
  onOpenInfo,
}: {
  uniformity: SkinToneUniformityReport;
  onOpenInfo?: (key: ExplainingMetricKey, score?: number | null, band?: string | null) => void;
}) {
  const { t } = useI18n();
  if (uniformity.status === 'disabled') return null;

  const ok = uniformity.status === 'ok' && uniformity.uniformityScore !== null;
  const tone = uniformity.skinTone;
  const diffs = uniformity.colorDifferences;
  const regions = uniformity.regionalMetrics;

  const regionOrder: Array<{
    key: 'forehead' | 'cheekLeft' | 'cheekRight' | 'nose' | 'chin';
    label: string;
  }> = [
    { key: 'forehead', label: t.regions.forehead },
    { key: 'cheekLeft', label: t.regions.cheekL },
    { key: 'cheekRight', label: t.regions.cheekR },
    { key: 'nose', label: t.regions.nose },
    { key: 'chin', label: t.regions.chin },
  ];

  const bandLabel = uniformity.band ? t.skinToneUniformity[uniformity.band] : null;
  const lightingCompensated = diffs.lightingAsymmetry !== null && diffs.lightingAsymmetry > 14;
  const otherWarnings = uniformity.warnings.filter((w) => !(lightingCompensated && w === 'directional_lighting_detected'));
  const openUniformityInfo = onOpenInfo
    ? () => onOpenInfo('skinToneUniformity', uniformity.uniformityScore, bandLabel)
    : undefined;

  return (
    <section className="glass panel extSection skinToneUniformityCard" aria-labelledby="uniformity-title">
      {/* 1. Title and method */}
      <div className="extHead">
        <div className="titleWithInfo">
          <h3 id="uniformity-title">{t.skinToneUniformity.title}</h3>
          {openUniformityInfo ? <ScoreInfoButton onClick={openUniformityInfo} /> : null}
        </div>
        <span className="tag experimental">
          <Palette size={13} aria-hidden /> {t.skinToneUniformity.tag}
        </span>
      </div>

      {ok ? (
        <div className="panelSections">
          {/* 2. Skin tone measured in this photo */}
          {tone ? (
            <div className="skinToneProfileBox">
              <div className="skinToneHeader">
                <div className="skinToneSwatch" style={{ backgroundColor: tone.hexColor }} aria-hidden>
                  <span className="monkBadge" style={{ backgroundColor: tone.monk.hex }} />
                </div>
                <div className="skinToneMeta">
                  <span className="muted small">{t.skinToneUniformity.toneLabel}</span>
                  <h4 className="skinToneName">{tone.toneLabel}</h4>
                  <div className="skinToneBadges">
                    <span className="toneBadge secondary" title={t.skinToneUniformity.monkHint}>
                      {tone.monk.name}
                    </span>
                    <span className="toneBadge subtle">{tone.undertoneLabel}</span>
                    <span className="toneBadge ita" dir="ltr">
                      ITA {tone.ita}°
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 3-4. Uniformity score and what it means */}
          <div className="uniformityScoreBox">
            <div className="metricHead">
              <span className="muted small">{t.skinToneUniformity.scoreLabel}</span>
              <span className="metricScore">
                {uniformity.uniformityScore}
                <small>/100</small>
              </span>
            </div>
            <div className="meter" aria-hidden>
              <span style={{ width: `${Math.max(2, uniformity.uniformityScore as number)}%` }} />
            </div>
            {bandLabel ? (
              <div className="metricTags">
                <span className={`tag band-${uniformity.band}`}>
                  <span className="dot" aria-hidden />
                  {bandLabel}
                </span>
              </div>
            ) : null}
            <p className="extText">
              {uniformity.band === 'high'
                ? t.skinToneUniformity.explanationHigh
                : uniformity.band === 'moderate'
                  ? t.skinToneUniformity.explanationModerate
                  : t.skinToneUniformity.explanationVariable}
            </p>
          </div>

          {/* 5. Region comparison */}
          <div>
            <h4 className="subTitle">{t.skinToneUniformity.regionalBreakdown}</h4>
            <ul className="regionalToneGrid">
              {regionOrder.map(({ key, label }) => {
                const metric = regions[key];
                if (!metric) return null;
                return (
                  <li key={key} className="regionalToneCard">
                    <span className="regionalToneHead">
                      <span className="toneSwatchMini" style={{ backgroundColor: metric.hexColor ?? '#d7bd96' }} aria-hidden />
                      <span className="regionName">{label}</span>
                    </span>
                    <span className="regionalToneDetails">
                      {metric.ita !== undefined ? (
                        <span className="regionIta" dir="ltr">
                          ITA {metric.ita}°
                        </span>
                      ) : null}
                      {metric.statusLabel ? <span className="regionStatus">{metric.statusLabel}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 6. Lighting compensation */}
          {lightingCompensated ? (
            <div className="lightingCompensatedNotice">
              <Info size={14} aria-hidden />
              <span>{t.skinToneUniformity.lightingCompensated}</span>
            </div>
          ) : null}
          {/* The lighting warning repeats the notice above, so it is shown only once. */}
          {otherWarnings.length ? (
            <ul className="reasonList">
              {otherWarnings.map((w) => (
                <li key={w}>{w === 'directional_lighting_detected' ? t.skinToneUniformity.lightingWarning : w}</li>
              ))}
            </ul>
          ) : null}

          {/* 7. Raw colour measurements and the colour-difference map */}
          <details className="limitations">
            <summary>{t.skinToneUniformity.colourDetails}</summary>
            {tone ? (
              <div className="skinToneLabRow" dir="ltr">
                <span className="labItem">
                  <b>L*</b> {tone.lab.L}
                </span>
                <span className="labItem">
                  <b>a*</b> {tone.lab.a}
                </span>
                <span className="labItem">
                  <b>b*</b> {tone.lab.b}
                </span>
                <span className="labItem hexCode">{tone.hexColor.toUpperCase()}</span>
              </div>
            ) : null}
            {uniformity.heatmap ? (
              <figure className="deviationMap">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated data URI, never sent to an image CDN */}
                <img src={uniformity.heatmap} alt={t.skinToneUniformity.mapAlt} />
                <figcaption>{t.skinToneUniformity.mapCaption}</figcaption>
              </figure>
            ) : null}
          </details>
        </div>
      ) : (
        <p className="extText muted">{uniformity.explanation}</p>
      )}

      {/* 8. Notice and limitations */}
      <p className="notice">
        <Info size={14} aria-hidden /> {t.skinToneUniformity.notice}
      </p>
      <Limitations items={uniformity.limitations} />
    </section>
  );
}
