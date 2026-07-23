import { NextResponse } from 'next/server';
import { readCurrentData } from '../_lib/live-fetch.js';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, payload: await readCurrentData() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
