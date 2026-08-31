import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const connectionPath = join(root, '.auth', 'facebook-oauth.json');

export function facebookOAuthConfig(origin = '') {
  const appId = process.env.FACEBOOK_APP_ID || '';
  const appSecret = process.env.FACEBOOK_APP_SECRET || '';
  const encryptionSecret = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY || appSecret;
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${origin}/api/facebook/callback`;
  return { appId, appSecret, encryptionSecret, graphVersion, redirectUri, configured: Boolean(appId && appSecret && encryptionSecret && redirectUri) };
}

function encryptionKey(secret) {
  if (!secret) throw new Error('FACEBOOK_TOKEN_ENCRYPTION_KEY is not configured.');
  return createHash('sha256').update(secret).digest();
}

function encryptToken(token, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
}

function decryptToken(payload, secret) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function graphJson(url) {
  const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message || `Meta returned HTTP ${response.status}.`);
  return payload;
}

export function facebookLoginUrl(origin, state) {
  const config = facebookOAuthConfig(origin);
  if (!config.configured) throw new Error('Facebook Login is not configured on this server.');
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'public_profile');
  url.searchParams.set('response_type', 'code');
  return url;
}

export async function connectFacebook(code, origin) {
  const config = facebookOAuthConfig(origin);
  if (!config.configured) throw new Error('Facebook Login is not configured on this server.');
  const exchangeUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
  exchangeUrl.searchParams.set('client_id', config.appId);
  exchangeUrl.searchParams.set('client_secret', config.appSecret);
  exchangeUrl.searchParams.set('redirect_uri', config.redirectUri);
  exchangeUrl.searchParams.set('code', code);
  const shortLived = await graphJson(exchangeUrl);

  const longLivedUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longLivedUrl.searchParams.set('client_id', config.appId);
  longLivedUrl.searchParams.set('client_secret', config.appSecret);
  longLivedUrl.searchParams.set('fb_exchange_token', shortLived.access_token);
  let tokenResult = shortLived;
  try { tokenResult = await graphJson(longLivedUrl); } catch {}

  const meUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/me`);
  meUrl.searchParams.set('fields', 'id,name');
  meUrl.searchParams.set('access_token', tokenResult.access_token);
  const profile = await graphJson(meUrl);
  const connectedAt = new Date().toISOString();
  const expiresAt = tokenResult.expires_in ? new Date(Date.now() + Number(tokenResult.expires_in) * 1000).toISOString() : '';
  await mkdir(join(root, '.auth'), { recursive: true });
  await writeFile(connectionPath, `${JSON.stringify({ profile, connected_at: connectedAt, expires_at: expiresAt, token: encryptToken(tokenResult.access_token, config.encryptionSecret) }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { profile, connected_at: connectedAt, expires_at: expiresAt };
}

export async function readFacebookConnection(origin = '') {
  const config = facebookOAuthConfig(origin);
  if (!config.configured) return null;
  try {
    const saved = JSON.parse(await readFile(connectionPath, 'utf8'));
    if (saved.expires_at && new Date(saved.expires_at).getTime() <= Date.now()) return null;
    return { ...saved, access_token: decryptToken(saved.token, config.encryptionSecret) };
  } catch {
    return null;
  }
}

export async function facebookConnectionStatus(origin = '') {
  const config = facebookOAuthConfig(origin);
  const connection = await readFacebookConnection(origin);
  return {
    configured: config.configured,
    connected: Boolean(connection?.access_token),
    profile: connection?.profile || null,
    connected_at: connection?.connected_at || '',
    expires_at: connection?.expires_at || '',
    public_content_access_required: true,
  };
}

