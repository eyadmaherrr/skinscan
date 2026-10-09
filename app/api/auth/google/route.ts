import { NextRequest, NextResponse } from 'next/server';
import { serverConfig } from '@/lib/config';
import { publicConfig } from '@/lib/public-config';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next =
    searchParams.get('next') ||
    origin ||
    publicConfig.appUrl ||
    'https://skinscan.drmahermahmoud.com';
  const clinicUrl = serverConfig.clinicUrl.replace(/\/$/, '');

  const target = new URL('/api/auth/google', clinicUrl);
  target.searchParams.set('next', next);

  return NextResponse.redirect(target.toString());
}

