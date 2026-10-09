import type { QualityIssue, QualityIssueCode, ScanErrorCode } from './types';

/** Friendly, non-technical retake guidance for each quality problem. */
export const QUALITY_MESSAGES: Record<QualityIssueCode, string> = {
  no_face: 'We could not find a face in this photo. Please take a photo facing the camera directly.',
  multiple_faces: 'More than one face is visible. Please take a photo with only your face in the frame.',
  face_too_small: 'Your face is too small in the photo. Please move closer so your face fills the oval.',
  face_cropped: 'Part of your face is outside the photo. Please centre your whole face in the frame.',
  face_angle: 'Please look straight at the camera with your head level, not turned or tilted.',
  blurry: 'The photo is too blurry. Please hold the camera steady and make sure it is focused on your face.',
  too_dark: 'The photo is too dark. Please retake it in brighter, even lighting, facing a window or light source.',
  too_bright: 'The photo is overexposed. Please avoid direct flash or harsh light and retake it in soft, even lighting.',
  uneven_lighting: 'One side of your face is much darker than the other. Please face the light so it falls evenly on your face.',
  filter_detected: 'The photo looks filtered or heavily edited (for example smoothing, sharpening or HDR effects). Please retake it with filters and effects turned off.',
  not_color: 'Please use a colour photo without black-and-white or colour filters.',
  sunglasses: 'Please remove your sunglasses and retake the photo.',
  glasses: 'Please remove your glasses so the skin around your eyes is visible, then retake the photo.',
  face_obstructed: 'Part of your face is covered. Please move hair, hands or face coverings away from your face.',
  insufficient_skin: 'Not enough facial skin is visible to analyse. Please pull hair back and face the camera directly.',
};

export function qualityIssue(code: QualityIssueCode): QualityIssue {
  return { code, message: QUALITY_MESSAGES[code] };
}

export const ERROR_MESSAGES: Record<ScanErrorCode, string> = {
  unauthenticated: 'Please sign in to your Dr. Maher account to run a skin scan.',
  invalid_request: 'Please choose a photo to scan.',
  unsupported_type: 'This file type is not supported. Please use a JPG, PNG or WebP photo.',
  file_too_large: 'This photo is too large. Please use a photo under the size limit.',
  image_unreadable: 'We could not read this image. Please try another photo.',
  image_quality: 'Please retake the photo in brighter, even lighting with your face looking directly at the camera.',
  rate_limited: 'You have run several scans in a short time. Please wait a few minutes and try again.',
  busy: 'The scanner is busy right now. Please try again in a moment.',
  timeout: 'The analysis took too long. Please try again, ideally with a smaller photo.',
  analysis_failed: 'Something went wrong while analysing the photo. Please try again.',
};

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
  return new ScanError('image_quality', codes.map(qualityIssue));
}
