import { extensionConfig } from '../../config';
import type { RgbImage } from '../image/decode';
import type { MetricContext } from '../metrics/common';
import type { AcneReport, AcneSeverity, AnalysisQuality, DermFoundationReport, PoreReport } from '../types';
import { ACNE_LIMITATIONS, buildAcneReport } from './acne';
import { classifyAcneSeverity, disabledSeverity } from './acne-severity';
import { extractDermFoundation } from './derm-foundation';
import { analyzePores, PORE_SCALE } from './pores';
import { renderHeatmap } from './projection';

/**
 * Runs the extension components after the core metrics. Each component is
 * isolated: if one fails, it reports status "failed" and everything else —
 * including the core analysis — is returned unchanged.
 */

export interface ExtensionResults {
  acne: AcneReport;
  pores: PoreReport;
  dermFoundation: DermFoundationReport;
  analysisQuality: AnalysisQuality;
  /** Internal values for evaluation (never returned by the API). */
  internal: { poresRaw: number | null; severity: AcneSeverity };
}

function failedAcne(severity: AcneSeverity): AcneReport {
  return {
    status: 'failed',
    method: 'heuristic_spot_detection',
    lesionCandidateCount: null,
    redToneCount: null,
    darkToneCount: null,
    lesions: [],
    regionalSummary: {},
    severity,
    explanation: 'Spot candidates could not be analysed for this photo.',
    limitations: ACNE_LIMITATIONS,
  };
}

function failedPores(status: PoreReport['status'], explanation: string): PoreReport {
  return {
    status,
    visibilityScore: null,
    scoreScale: PORE_SCALE,
    confidence: null,
    confidenceLabel: null,
    regionalSummary: {},
    heatmap: null,
    explanation,
    limitations: [],
  };
}

export async function runExtensions(ctx: MetricContext, image: RgbImage, notes: string[]): Promise<ExtensionResults> {
  const cfg = extensionConfig();

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
    acne = { ...failedAcne(severity), status: 'disabled', explanation: 'Spot-candidate analysis is switched off.' };
  } else {
    try {
      acne = buildAcneReport(ctx, image, severity);
      severity = acne.severity;
    } catch {
      acne = failedAcne(severity);
    }
  }

  let pores: PoreReport;
  let poresRaw: number | null = null;
  let poreReasons: string[] = [];
  if (!cfg.pores) {
    pores = failedPores('disabled', 'Pore analysis is switched off.');
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
      pores = failedPores('failed', 'Pore visibility could not be analysed for this photo.');
    }
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
    dermFoundation: derm.report,
    analysisQuality: { imageQuality: 'acceptable', limitations: Array.from(new Set(limitations)) },
    internal: { poresRaw, severity },
  };
}
