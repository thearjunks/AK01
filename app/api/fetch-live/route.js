import { NextResponse } from 'next/server';
import { fetchFromProvider } from '../_lib/live-fetch.js';

export async function GET() {
  try {
    return NextResponse.json(await fetchFromProvider());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
