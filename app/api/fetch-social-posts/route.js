import { NextResponse } from 'next/server';
import { fetchSocialPosts } from '../_lib/live-fetch.js';

export async function POST(request) {
  try {
    const credentials = await request.json().catch(() => ({}));
    return NextResponse.json(await fetchSocialPosts(credentials));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json(await fetchSocialPosts());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
