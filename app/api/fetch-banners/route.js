import { NextResponse } from 'next/server';
import { getBannersFetchJob, startBannersFetchJob } from '../_lib/live-fetch.js';

export async function GET() {
  return NextResponse.json({ ok: true, job: getBannersFetchJob() });
}

export async function POST(request) {
  const provider = new URL(request.url).searchParams.get('provider') || '';
  const result = startBannersFetchJob(provider);
  return NextResponse.json({ ok: true, ...result }, { status: result.accepted ? 202 : 200 });
}
