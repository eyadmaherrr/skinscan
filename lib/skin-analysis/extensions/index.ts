import { extensionConfig } from '../../config';
import type { RgbImage } from '../image/decode';
import type { MetricContext } from '../metrics/common';
import type { AcneReport, AcneSeverity, AnalysisQuality, DermFoundationReport, PoreReport, SkinAgeReport } from '../types';
import { analysisText, type AnalysisText } from '../text';
import { buildAcneReport } from './acne';
import { classifyAcneSeverity, disabledSeverity } from './acne-severity';
import { extractDermFoundation } from './derm-foundation';
import { analyzePores } from './pores';
import { renderHeatmap } from './projection';
import { estimateSkinAge } from './skin-age';

/**
 * Runs the extension components after the core metrics. Each component is
 * isolated: if one fails, it reports status "failed" and everything else —
 * including the core analysis — is returned unchanged.
 */

export interface ExtensionResults {
  acne: AcneReport;
  pores: PoreReport;
  skinAge: SkinAgeReport;
  dermFoundation: DermFoundationReport;
  analysisQuality: AnalysisQuality;
  /** Internal values for evaluation (never returned by the API). */
  internal: { poresRaw: number | null; severity: AcneSeverity };
}

function failedAcne(severity: AcneSeverity, text: AnalysisText): AcneReport {
  return {
    status: 'failed',
    method: 'heuristic_spot_detection',
    lesionCandidateCount: null,
    redToneCount: null,
    darkToneCount: null,
    lesions: [],
    regionalSummary: {},
    severity,
    explanation: text.acne.failed,
    limitations: text.acne.limitations,
  };
}

function failedPores(status: PoreReport['status'], explanation: string, text: AnalysisText): PoreReport {
  return {
    status,
    visibilityScore: null,
    scoreScale: text.pores.scale,
    confidence: null,
    confidenceLabel: null,
    regionalSummary: {},
    heatmap: null,
    explanation,
    limitations: [],
  };
}

/** `notes`: the photo's non-blocking quality notes, already in the result's language. */
export async function runExtensions(ctx: MetricContext, image: RgbImage, notes: string[]): Promise<ExtensionResults> {
  const cfg = extensionConfig();
  const text = analysisText(ctx.locale);

  // Optional image classifier; its output is combined with the count grader in buildAcneReport.
  let severity: AcneSeverity = disabledSeverity();
  try {
    severity = await classifyAcneSeverity(ctx.face, cfg.acneSeverityModel);
    if (severity.status === 'ok') severity = { ...severity, method: 'image_classifier' };
  } catch {
    severity = disabledSeverity('failed');
  }

  let acne: AcneReport;
  if (!cfg.acneLesions) {
    acne = { ...failedAcne(severity, text), status: 'disabled', explanation: text.acne.disabled };
  } else {
    try {
      acne = buildAcneReport(ctx, image, severity);
      severity = acne.severity;
    } catch {
      acne = failedAcne(severity, text);
    }
  }

  let pores: PoreReport;
  let poresRaw: number | null = null;
  let poreReasons: string[] = [];
  if (!cfg.pores) {
    pores = failedPores('disabled', text.pores.disabled, text);
  } else {
    try {
      const analysis = analyzePores(ctx);
      pores = analysis.report;
      poresRaw = analysis.raw;
      poreReasons = analysis.reasons;
      if (analysis.heat) {
        try {
          pores.heatmap = await renderHeatmap(ctx.face, image, analysis.heat);
        } catch {
          pores.heatmap = null;
        }
      }
    } catch {
      pores = failedPores('failed', text.pores.failed, text);
    }
  }

  let skinAge: SkinAgeReport;
  try {
    skinAge = await estimateSkinAge(ctx.face, image, { enabled: cfg.skinAge, locale: ctx.locale });
  } catch {
    skinAge = {
      status: 'failed',
      minYears: null,
      maxYears: null,
      probability: null,
      probabilities: null,
      explanation: text.skinAge.failed,
      limitations: [],
    };
  }

  const derm = await extractDermFoundation(ctx.face, {
    enabled: cfg.dermFoundationEnabled,
    url: cfg.dermFoundationUrl,
    token: cfg.dermFoundationToken,
    timeoutMs: cfg.dermFoundationTimeoutMs,
  });

  const limitations = [...notes];
  limitations.push(...poreReasons);

  return {
    acne,
    pores,
    skinAge,
    dermFoundation: derm.report,
    analysisQuality: { imageQuality: 'acceptable', limitations: Array.from(new Set(limitations)) },
    internal: { poresRaw, severity },
  };
}
