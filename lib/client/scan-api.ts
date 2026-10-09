import { publicConfig } from '../public-config';
import type { ScanFailure, ScanResponse } from '../skin-analysis/types';

const NETWORK_FAILURE: ScanFailure = {
  success: false,
  error: { code: 'analysis_failed', message: 'We could not reach the scanner. Please check your connection and try again.' },
};

/** Upload a prepared photo for analysis. Never throws: failures come back as ScanFailure. */
export async function requestScan(photo: Blob, signal?: AbortSignal): Promise<ScanResponse> {
  const form = new FormData();
  form.append('image', photo, 'photo.jpg');
  try {
    const response = await fetch(`${publicConfig.apiBaseUrl}/api/skin-scan`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      signal,
    });
    const data = (await response.json().catch(() => null)) as ScanResponse | null;
    if (data && typeof data === 'object' && 'success' in data) return data;
    return NETWORK_FAILURE;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return NETWORK_FAILURE;
  }
}
