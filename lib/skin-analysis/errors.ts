import type { Locale } from '../i18n';
import { analysisText } from './text';
import type { QualityIssue, QualityIssueCode, ScanErrorCode } from './types';

/** Friendly, non-technical retake guidance for each quality problem (English; see text.ts for Arabic). */
export const QUALITY_MESSAGES: Record<QualityIssueCode, string> = analysisText('en').quality;

export function qualityIssue(code: QualityIssueCode, locale: Locale = 'en'): QualityIssue {
  return { code, message: analysisText(locale).quality[code] };
}

export const ERROR_MESSAGES: Record<ScanErrorCode, string> = analysisText('en').errors;

export function errorMessage(code: ScanErrorCode, locale: Locale = 'en'): string {
  return analysisText(locale).errors[code];
}

/** Error carrying a stable code that the API maps to a friendly message. */
export class ScanError extends Error {
  readonly code: ScanErrorCode;
  readonly issues: QualityIssue[];
  /** Internal measurements behind a quality rejection (evaluation only; never sent to clients). */
  diagnostics?: Record<string, number>;

  constructor(code: ScanErrorCode, issues: QualityIssue[] = [], detail?: string) {
    super(detail ?? code);
    this.name = 'ScanError';
    this.code = code;
    this.issues = issues;
  }
}

export function qualityFailure(...codes: QualityIssueCode[]): ScanError {
  return new ScanError('image_quality', codes.map((code) => qualityIssue(code)));
}
