import { NextResponse } from 'next/server';
import { getPlansFetchJob, startPlansFetchJob } from '../_lib/live-fetch.js';

export async function GET() {
  return NextResponse.json({ ok: true, job: getPlansFetchJob() });
}

export async function POST() {
  const result = startPlansFetchJob();
  return NextResponse.json({ ok: true, ...result }, { status: result.accepted ? 202 : 200 });
}
