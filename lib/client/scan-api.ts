import type { Locale } from '../i18n';
import { messages } from '../messages';
import { publicConfig } from '../public-config';
import type { ScanFailure, ScanResponse } from '../skin-analysis/types';

function networkFailure(locale: Locale): ScanFailure {
  return { success: false, error: { code: 'analysis_failed', message: messages(locale).retake.network } };
}

/**
 * Upload a prepared photo for analysis; explanations come back in `locale`.
 * Never throws (except when aborted): failures come back as ScanFailure.
 */
export async function requestScan(photo: Blob, locale: Locale = 'en', signal?: AbortSignal): Promise<ScanResponse> {
  const form = new FormData();
  form.append('image', photo, 'photo.jpg');
  form.append('locale', locale);
  try {
    const response = await fetch(`${publicConfig.apiBaseUrl}/api/skin-scan?locale=${locale}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      signal,
    });
    const data = (await response.json().catch(() => null)) as ScanResponse | null;
    if (data && typeof data === 'object' && 'success' in data) return data;
    return networkFailure(locale);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return networkFailure(locale);
  }
}
