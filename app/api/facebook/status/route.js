import { NextResponse } from 'next/server';
import { facebookConnectionStatus } from '../_lib/oauth.js';

export async function GET(request) {
  const response = NextResponse.json({ ok: true, ...(await facebookConnectionStatus(new URL(request.url).origin)) });
  response.headers.set('cache-control', 'no-store, max-age=0');
  return response;
}

