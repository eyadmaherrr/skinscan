import { NextResponse } from 'next/server';
import { getPatientSessionToken, verifyPatientSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const token = getPatientSessionToken(request);
    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const result = await verifyPatientSession(token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/auth/me error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

