import { NextResponse } from 'next/server';
import { fetchSocialPosts } from '../_lib/live-fetch.js';

export async function POST() {
  try {
    const response = NextResponse.json(await fetchSocialPosts());
    response.headers.set('cache-control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = NextResponse.json(await fetchSocialPosts());
    response.headers.set('cache-control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
