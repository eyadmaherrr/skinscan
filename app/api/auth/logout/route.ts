import { NextResponse } from 'next/server';
import { getPatientSessionToken, isSameOrigin, PATIENT_COOKIE, revokePatientSession, sharedCookieDomain } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Only SkinScan's own pages may sign the patient out.
  if (!isSameOrigin(request)) return NextResponse.json({ success: false }, { status: 403 });

  const token = getPatientSessionToken(request);
  if (token) await revokePatientSession(token);

  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  const domain = sharedCookieDomain(request);
  const secure = process.env.NODE_ENV === 'production';
  // The clinic website's shared cookie…
  response.cookies.set(PATIENT_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
  // …and a host-only copy left by earlier SkinScan versions. Same name, so a
  // raw header (response.cookies keeps one entry per name); nothing is set after it.
  if (domain) {
    response.headers.append(
      'Set-Cookie',
      `${PATIENT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
    );
  }
  return response;
}
