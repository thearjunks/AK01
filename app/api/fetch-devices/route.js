import { NextResponse } from 'next/server';
import { getDevicesFetchJob, startDevicesFetchJob } from '../_lib/live-fetch.js';

export async function GET() {
  return NextResponse.json({ ok: true, job: getDevicesFetchJob() });
}

export async function POST() {
  const result = startDevicesFetchJob();
  return NextResponse.json({ ok: true, ...result }, { status: result.accepted ? 202 : 200 });
}
