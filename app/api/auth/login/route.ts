import { NextResponse } from 'next/server';
import { loginWithClinic, PATIENT_COOKIE } from '@/lib/auth';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter your email and password.' }, { status: 400 });
    }

    const result = await loginWithClinic(email, password);

    if (!result.success || !result.sessionToken) {
      return NextResponse.json(
        { error: result.error || 'Incorrect email or password.', code: result.code || 'INVALID_CREDENTIALS' },
        { status: result.code === 'ACCOUNT_NOT_VERIFIED' ? 403 : 401 },
      );
    }

    const response = NextResponse.json({
      success: true,
      patient: result.patient,
    });

    response.cookies.set(PATIENT_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('API /api/auth/login error:', error);
    return NextResponse.json({ error: 'Failed to process sign in. Please try again.' }, { status: 500 });
  }
}
