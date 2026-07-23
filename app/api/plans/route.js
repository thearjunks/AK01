import { NextResponse } from 'next/server';
import { readPlansData } from '../_lib/live-fetch.js';

export async function GET() {
  try {
    return NextResponse.json(await readPlansData());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
