import { NextRequest, NextResponse } from 'next/server';
import { serverConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = searchParams.get('next');
  const clinicUrl = serverConfig.clinicUrl.replace(/\/$/, '');

  const target = new URL('/api/auth/google', clinicUrl);
  if (next) {
    target.searchParams.set('next', next);
  }

  return NextResponse.redirect(target.toString());
}

