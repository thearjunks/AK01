import { NextResponse } from 'next/server';
import { getAdsFetchJob, startAdsFetchJob } from '../_lib/live-fetch.js';

function noStoreJson(body, init = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set('cache-control', 'no-store, max-age=0');
  return response;
}

export async function POST() {
  try {
    const result = startAdsFetchJob();
    return noStoreJson({
      ok: true,
      accepted: result.accepted,
      message: result.accepted ? 'Live ad refresh started.' : 'A live ad refresh is already running.',
      job: result.job,
    }, { status: result.accepted ? 202 : 200 });
  } catch (error) {
    return noStoreJson({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('status') === '1') {
    return noStoreJson({ ok: true, job: getAdsFetchJob() });
  }
  return POST();
}
