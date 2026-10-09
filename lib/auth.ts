import { serverConfig } from './config';

/**
 * Sign-in is shared with the clinic's website. Patients sign in on
 * drmahermahmoud.com (email + password or Google), which sets its session
 * cookie for the whole drmahermahmoud.com domain; SkinScan only checks that
 * session with the website's /api/auth/me. SkinScan never sees a password.
 */

export const PATIENT_COOKIE = 'patient_session';
export const PATIENT_HEADER = 'x-patient-session';

const CLINIC_DOMAIN = 'drmahermahmoud.com';

/** The only patient details SkinScan uses (to greet the patient in the header). */
export interface PatientInfo {
  name: string;
  email: string;
}

export interface AuthVerificationResult {
  authenticated: boolean;
  patient?: PatientInfo;
  /** The clinic's auth service could not be reached. */
  unavailable?: boolean;
}

/** Session tokens are opaque; anything outside this shape is not sent to the clinic. */
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{16,256}$/;

/**
 * The patient's session token: the x-patient-session header (API clients),
 * otherwise the session cookie. When the browser holds two cookies with
 * that name (an older host-only one and the shared one), the last is used —
 * the newest, as Next.js and the clinic's website do.
 */
export function getPatientSessionToken(request: Request): string | null {
  const fromHeader = request.headers.get(PATIENT_HEADER)?.trim();
  if (fromHeader) return fromHeader;

  let token: string | null = null;
  for (const pair of (request.headers.get('cookie') ?? '').split(/;\s*/)) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator) === PATIENT_COOKIE) {
      try {
        token = decodeURIComponent(pair.slice(separator + 1)) || token;
      } catch {
        // Malformed value: ignore it.
      }
    }
  }
  return token;
}

/** Checks a session token with the clinic website. */
export async function verifyPatientSession(token: string | null): Promise<AuthVerificationResult> {
  if (!token || !TOKEN_PATTERN.test(token)) return { authenticated: false };

  try {
    const response = await fetch(`${serverConfig.clinicUrl}/api/auth/me`, {
      headers: { [PATIENT_HEADER]: token, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!response.ok) return { authenticated: false, unavailable: response.status >= 500 };

    const data = (await response.json()) as { authenticated?: boolean; patient?: Partial<PatientInfo> };
    if (data.authenticated && data.patient) {
      return {
        authenticated: true,
        patient: { name: String(data.patient.name ?? ''), email: String(data.patient.email ?? '') },
      };
    }
    return { authenticated: false };
  } catch (error) {
    console.error(
      JSON.stringify({ event: 'auth', outcome: 'clinic_unreachable', message: error instanceof Error ? error.message : 'unknown' }),
    );
    return { authenticated: false, unavailable: true };
  }
}

/** Ends the session on the clinic website too, so signing out of SkinScan signs out everywhere. */
export async function revokePatientSession(token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  try {
    await fetch(`${serverConfig.clinicUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { [PATIENT_HEADER]: token },
      // The website answers with a redirect to its sign-in page; there is nothing to follow.
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    // The cookie is still removed below; the session expires on its own.
  }
}

/** ".drmahermahmoud.com" when SkinScan runs on the clinic's domain (where the session cookie is shared). */
export function sharedCookieDomain(request: Request): string | undefined {
  const host = new URL(request.url).hostname;
  return host === CLINIC_DOMAIN || host.endsWith(`.${CLINIC_DOMAIN}`) ? `.${CLINIC_DOMAIN}` : undefined;
}

/** True for same-origin browser requests (or non-browser clients, which send no Origin header). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
