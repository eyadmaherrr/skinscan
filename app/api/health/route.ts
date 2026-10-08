import { NextResponse } from 'next/server';
import { warmUp } from '@/lib/skin-analysis/models/runtime';

export const runtime = 'nodejs';

/** Readiness check for deployments: loads and verifies the models. */
export async function GET() {
  try {
    await warmUp();
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
