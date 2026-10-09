import { NextResponse } from 'next/server';
import { getPatientSessionToken, verifyPatientSession } from '@/lib/auth';
import { serverConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Who is signed in, and whether scanning requires it (SKINSCAN_REQUIRE_AUTH). */
export async function GET(request: Request) {
  const result = await verifyPatientSession(getPatientSessionToken(request));
  return NextResponse.json(
    {
      authenticated: result.authenticated,
      required: serverConfig.requireAuth,
      ...(result.patient ? { patient: result.patient } : {}),
      ...(result.unavailable ? { unavailable: true } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
