import { confidenceLabel } from '../confidence';
import type { Locale } from '../../i18n';
import type { QualityFactors } from '../quality';
import { analysisText } from '../text';
import type { AcneSeverity } from '../types';

/**
 * Combined acne-severity estimate (experimental).
 *
 * Two models on one four-level scale:
 *
 *  1. SkinScan lesion-count grader (ours, transparent): the number of
 *     red-toned (inflammatory-looking) spot candidates, halved to a
 *     half-face equivalent, placed on the count bands of the Hayashi acne
 *     grading criteria (Hayashi et al., J Dermatol 2008): ≤5, 6–20, 21–50,
 *     >50 inflammatory lesions per half face. Counting uncertainty is
 *     modelled as a log-normal (σ = 0.45), giving a probability per level.
 *  2. Optional image classifier (Hugging Face afscomercial/dermatologic,
 *     classes level0–level3). Its four labels match ACNE04, whose levels are
 *     the same Hayashi count bands, so the two outputs are on the same scale.
 *
 * Combination: a weighted average of the probability vectors (grader 0.7,
 * classifier 0.3). The classifier gets the smaller weight because the
 * evaluation found it unstable (up to 31 points change for a mirrored photo)
 * and insensitive to added acne-like spots. When the classifier is not
 * installed, the grader is used alone. Disagreement between the two lowers
 * the confidence, which is capped at "moderate".
 */

export const LEVELS = ['level0', 'level1', 'level2', 'level3'] as const;
export const LEVEL_NAMES: Record<string, string> = {
  level0: 'None or minimal',
  level1: 'Mild',
  level2: 'Moderate',
  level3: 'Severe',
};

const BOUNDS = [5.5, 20.5, 50.5];
const SIGMA = 0.45;
const W_GRADER = 0.7;
const W_CLASSIFIER = 0.3;
const MAX_CONFIDENCE = 0.62;

function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 approximation of erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Probability of each level for an observed full-face count of inflammatory-looking spots. */
export function countGradeProbabilities(redCount: number): number[] {
  const half = Math.max(0.5, redCount / 2); // half-face equivalent; floor avoids log(0)
  const mu = Math.log(half);
  const cdf = BOUNDS.map((b) => normalCdf((Math.log(b) - mu) / SIGMA));
  return [cdf[0], cdf[1] - cdf[0], cdf[2] - cdf[1], 1 - cdf[2]];
}

function argmax(p: number[]): number {
  let best = 0;
  for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
  return best;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const asRecord = (p: number[]) => Object.fromEntries(LEVELS.map((l, i) => [l, round3(p[i])]));

export interface CombinedSeverityInput {
  redCount: number;
  classifier: AcneSeverity;
  factors: QualityFactors;
  locale?: Locale;
}

export function combineSeverity({ redCount, classifier, factors, locale }: CombinedSeverityInput): AcneSeverity {
  const grader = countGradeProbabilities(redCount);
  const graderLabel = LEVELS[argmax(grader)];
  const classifierProbs =
    classifier.status === 'ok' && classifier.probabilities ? LEVELS.map((l) => classifier.probabilities?.[l] ?? 0) : null;

  const combined = classifierProbs ? grader.map((g, i) => W_GRADER * g + W_CLASSIFIER * classifierProbs[i]) : grader;
  const best = argmax(combined);
  const agree = classifierProbs ? argmax(classifierProbs) === argmax(grader) : true;

  // Confidence: how decisive the combined distribution is, whether the models agree,
  // and whether the photo was sharp and well exposed enough to see small spots.
  const quality = (0.5 + 0.5 * factors.sharpness) * (0.6 + 0.4 * factors.exposure) * (0.7 + 0.3 * factors.resolution);
  const confidence = Math.min(MAX_CONFIDENCE, combined[best] * (agree ? 1 : 0.7) * quality);

  return {
    status: 'ok',
    label: LEVELS[best],
    scale: analysisText(locale).severityScale,
    probabilities: asRecord(combined),
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    method: classifierProbs ? 'combined' : 'count_grader',
    components: {
      countGrader: { label: graderLabel, probabilities: asRecord(grader), inflammatoryLookingSpots: redCount },
      imageClassifier: classifierProbs
        ? { status: 'ok', label: classifier.label, probabilities: classifier.probabilities }
        : { status: classifier.status, label: null, probabilities: null },
    },
    modelsAgree: classifierProbs ? agree : null,
  };
}
