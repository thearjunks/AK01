import { NextResponse } from 'next/server';
import { readSocialData } from '../_lib/live-fetch.js';

export async function GET() {
  try {
    return NextResponse.json(await readSocialData());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
