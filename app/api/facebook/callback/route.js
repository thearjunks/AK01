import { NextResponse } from 'next/server';
import { connectFacebook } from '../_lib/oauth.js';

function dashboardRedirect(origin, status, detail = '') {
  const url = new URL('/organic-facebook', origin);
  url.searchParams.set('facebook', status);
  if (detail) url.searchParams.set('detail', detail.slice(0, 160));
  return url;
}

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = url.searchParams.get('state') || '';
  const expectedState = request.cookies.get('facebook_oauth_state')?.value || '';
  if (!state || !expectedState || state !== expectedState) return NextResponse.redirect(dashboardRedirect(origin, 'error', 'Facebook Login state validation failed.'));
  if (url.searchParams.get('error')) return NextResponse.redirect(dashboardRedirect(origin, 'error', url.searchParams.get('error_description') || 'Facebook Login was cancelled.'));
  try {
    await connectFacebook(url.searchParams.get('code') || '', origin);
    const response = NextResponse.redirect(dashboardRedirect(origin, 'connected'));
    response.cookies.delete('facebook_oauth_state');
    return response;
  } catch (error) {
    const response = NextResponse.redirect(dashboardRedirect(origin, 'error', error.message));
    response.cookies.delete('facebook_oauth_state');
    return response;
  }
}

