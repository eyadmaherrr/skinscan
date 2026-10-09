import { NextResponse } from 'next/server';
import { PATIENT_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(PATIENT_COOKIE);
  return response;
}

