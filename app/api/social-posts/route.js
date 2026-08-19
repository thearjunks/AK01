import { NextResponse } from 'next/server';
import { readSocialData } from '../_lib/live-fetch.js';

export async function GET() {
  try {
    const response = NextResponse.json(await readSocialData());
    response.headers.set('cache-control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
