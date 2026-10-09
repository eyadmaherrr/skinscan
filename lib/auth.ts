import { serverConfig } from './config';

export const PATIENT_COOKIE = 'patient_session';
export const PATIENT_HEADER = 'x-patient-session';

export interface PatientInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  countryCode?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  points?: number;
}

export interface AuthVerificationResult {
  authenticated: boolean;
  patient?: PatientInfo;
  error?: string;
}

/**
 * Extracts the raw patient session token from the request.
 * Checks header first (for API / native calls), then cookie.
 */
export function getPatientSessionToken(request: Request): string | null {
  const fromHeader = request.headers.get(PATIENT_HEADER);
  if (fromHeader?.trim()) return fromHeader.trim();

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${PATIENT_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Verifies a patient session token against the main Dr. Maher Clinics API.
 */
export async function verifyPatientSession(token: string | null): Promise<AuthVerificationResult> {
  if (!token) return { authenticated: false };

  // Allow test session when mock token is provided or auth is disabled
  if (token === 'test-session-token' || !serverConfig.requireAuth) {
    return {
      authenticated: true,
      patient: {
        id: 'test-patient-id',
        name: 'Test Patient',
        email: 'patient@example.com',
      },
    };
  }

  try {
    const clinicUrl = serverConfig.clinicUrl;
    const response = await fetch(`${clinicUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        [PATIENT_HEADER]: token,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    const data = (await response.json()) as { authenticated?: boolean; patient?: PatientInfo };
    if (data.authenticated && data.patient) {
      return { authenticated: true, patient: data.patient };
    }
    return { authenticated: false };
  } catch (error) {
    console.error('Failed to verify patient session with clinic auth server:', error);
    return { authenticated: false, error: 'Auth server unreachable' };
  }
}

/**
 * Signs in using the main Dr. Maher Mahmoud Clinics authentication API.
 */
export async function loginWithClinic(email: string, password: string): Promise<{
  success: boolean;
  sessionToken?: string;
  patient?: PatientInfo;
  error?: string;
  code?: string;
}> {
  try {
    const clinicUrl = serverConfig.clinicUrl;
    const response = await fetch(`${clinicUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect email or password.',
        code: data.code,
      };
    }

    return {
      success: true,
      sessionToken: data.sessionToken,
      patient: data.patient,
    };
  } catch (error) {
    console.error('Clinic login error:', error);
    return {
      success: false,
      error: 'Unable to reach Dr. Maher Clinics authentication server. Please try again.',
      code: 'SERVER_UNREACHABLE',
    };
  }
}
