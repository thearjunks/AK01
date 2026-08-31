import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { facebookLoginUrl, facebookOAuthConfig } from '../_lib/oauth.js';

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const config = facebookOAuthConfig(origin);
  if (!config.configured) return NextResponse.json({ ok: false, error: 'Facebook Login requires FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, and FACEBOOK_TOKEN_ENCRYPTION_KEY on the server.' }, { status: 503 });
  const state = randomBytes(24).toString('hex');
  const response = NextResponse.redirect(facebookLoginUrl(origin, state));
  response.cookies.set('facebook_oauth_state', state, { httpOnly: true, secure: origin.startsWith('https://'), sameSite: 'lax', path: '/', maxAge: 600 });
  return response;
}

