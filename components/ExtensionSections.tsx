import { FlaskConical, Info } from 'lucide-react';
import { CONFIDENCE_LABELS } from '@/lib/skin-analysis/labels';
import type { AcneReport, PoreReport, RegionKey } from '@/lib/skin-analysis/types';

const REGION_NAMES: Record<RegionKey, string> = {
  forehead: 'Forehead',
  nose: 'Nose',
  cheekL: 'Cheek (photo left)',
  cheekR: 'Cheek (photo right)',
  chin: 'Chin',
  underEyeL: 'Under-eye (photo left)',
  underEyeR: 'Under-eye (photo right)',
  jawL: 'Jawline (photo left)',
  jawR: 'Jawline (photo right)',
};

const SEVERITY_NAMES: Record<string, string> = {
  level0: 'No or minimal acne',
  level1: 'Mild',
  level2: 'Moderate',
  level3: 'Severe',
};

function Limitations({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <details className="limitations">
      <summary>Limitations</summary>
      <ul>
        {items.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

export function AcneSection({ acne }: { acne: AcneReport }) {
  const sev = acne.severity;
  const regions = Object.entries(acne.regionalSummary) as [RegionKey, { count: number; visible: boolean }][];
  return (
    <section className="glass extSection" aria-labelledby="acne-title">
      <div className="extHead">
        <h3 id="acne-title">Spots & acne-like marks</h3>
        <span className="tag experimental">
          <FlaskConical size={13} aria-hidden /> Experimental
        </span>
      </div>

      {acne.status === 'ok' ? (
        <>
          <p className="extLead">
            <strong>{acne.lesionCandidateCount}</strong> spot candidate{acne.lesionCandidateCount === 1 ? '' : 's'}
            <span className="muted"> · {acne.redToneCount} red-toned · {acne.darkToneCount} darker</span>
          </p>
          <p className="extText">{acne.explanation}</p>
          <ul className="regionChips" aria-label="Spot candidates by region">
            {regions.map(([k, r]) => (
              <li key={k} className={r.visible ? undefined : 'hiddenRegion'}>
                {REGION_NAMES[k]} <b>{r.visible ? r.count : 'not visible'}</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="extText">{acne.explanation}</p>
      )}

      <div className="severityBox">
        <strong>Acne severity grade</strong>
        {sev.status === 'ok' && sev.label && sev.probabilities ? (
          <>
            <p className="extText">
              Experimental classifier result: <b>{SEVERITY_NAMES[sev.label] ?? sev.label}</b>
            </p>
            <ul className="probBars">
              {Object.entries(sev.probabilities).map(([label, p]) => (
                <li key={label}>
                  <span>{SEVERITY_NAMES[label] ?? label}</span>
                  <span className="meter" aria-hidden>
                    <span style={{ width: `${Math.max(1, p * 100)}%` }} />
                  </span>
                  <span className="pct">{Math.round(p * 100)}%</span>
                </li>
              ))}
            </ul>
            <p className="notice">
              <Info size={14} aria-hidden /> This grade comes from an experimental model that has not been validated on
              SkinScan photos. Model probabilities are not a guarantee of correctness and this is not a clinical grade.
            </p>
          </>
        ) : (
          <p className="extText muted">
            {sev.status === 'failed'
              ? 'The severity grade could not be computed for this photo.'
              : 'Not available: SkinScan does not yet include a validated, commercially licensed acne-grading model. The spot candidates above are not a severity grade.'}
          </p>
        )}
      </div>
      <Limitations items={acne.limitations} />
    </section>
  );
}

export function PoresSection({ pores }: { pores: PoreReport }) {
  const regions = Object.entries(pores.regionalSummary) as [RegionKey, number][];
  const ok = pores.status === 'ok' && pores.visibilityScore !== null;
  return (
    <section className="glass extSection" aria-labelledby="pores-title">
      <div className="extHead">
        <h3 id="pores-title">Pore visibility</h3>
        <span className="tag experimental">
          <FlaskConical size={13} aria-hidden /> Experimental
        </span>
      </div>
      {ok ? (
        <>
          <div className="metricHead">
            <span className="muted small">Appearance index</span>
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
                {CONFIDENCE_LABELS[pores.confidenceLabel]}
              </span>
            </div>
          ) : null}
          <p className="extText">{pores.explanation}</p>
          {regions.length ? (
            <ul className="regionChips" aria-label="Pore visibility by region">
              {regions.map(([k, v]) => (
                <li key={k}>
                  {REGION_NAMES[k]} <b>{v}</b>
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
        <Info size={14} aria-hidden /> An appearance estimate from this photo — not a measurement of pore size, oil
        production or skin health.
      </p>
      {ok ? <Limitations items={pores.limitations} /> : null}
    </section>
  );
}
