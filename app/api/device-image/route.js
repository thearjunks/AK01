import { NextResponse } from 'next/server';
import { proxyImage } from '../_lib/live-fetch.js';

export async function GET(request) {
  const target = request.nextUrl.searchParams.get('url') || '';
  const result = await proxyImage(target);
  if (result.error) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return new NextResponse(result.buffer, {
    headers: { 'content-type': result.contentType, 'cache-control': 'public, max-age=3600' },
  });
}
