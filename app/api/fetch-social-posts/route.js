import { NextResponse } from 'next/server';
import { fetchSocialPosts } from '../_lib/live-fetch.js';

function requestedPlatform(request) {
  return new URL(request.url).searchParams.get('platform') || 'Instagram';
}

export async function POST(request) {
  try {
    const response = NextResponse.json(await fetchSocialPosts(requestedPlatform(request)));
    response.headers.set('cache-control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const response = NextResponse.json(await fetchSocialPosts(requestedPlatform(request)));
    response.headers.set('cache-control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
