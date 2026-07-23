import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { socialCredentials } from '../../../scripts/social-credentials.mjs';

const root = process.cwd();
const dataPath = join(root, 'public', 'data', 'ads.json');
const socialDataPath = join(root, 'public', 'data', 'social-posts.json');
const plansDataPath = join(root, 'public', 'data', 'plans.json');
const devicesDataPath = join(root, 'public', 'data', 'devices.json');

let socialFetchPromise = null;

function normalizePayload(payload) {
  const records = Array.isArray(payload) ? payload : payload.data || payload.ads || [];
  if (!Array.isArray(records)) {
    throw new Error('Live provider did not return a JSON array or { data: [...] }.');
  }
  return {
    ...payload,
    generated_at: new Date().toISOString(),
    source: payload.source || 'Live fetch provider',
    data: records,
  };
}

function runScript(scriptName, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'scripts', scriptName)], {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${scriptName} failed with exit code ${code}.${stderr ? ` ${stderr}` : ''}`));
    });
  });
}

export async function readCurrentData() {
  return JSON.parse(await readFile(dataPath, 'utf8'));
}

export async function readSocialData() {
  return JSON.parse(await readFile(socialDataPath, 'utf8'));
}

export async function readPlansData() {
  return JSON.parse(await readFile(plansDataPath, 'utf8'));
}

export async function readDevicesData() {
  return JSON.parse(await readFile(devicesDataPath, 'utf8'));
}

async function fetchFromMetaPages() {
  const scrape = await runScript('scrape-meta-ads.mjs');
  const payload = normalizePayload(await readCurrentData());
  return {
    ok: true,
    message: `Fetched ${payload.data.length} ads from the configured Meta Ads Library pages.`,
    payload,
    log: scrape.stdout,
  };
}

export async function fetchFromProvider() {
  const providerUrl = process.env.LIVE_ADS_JSON_URL;
  if (!providerUrl) return fetchFromMetaPages();

  const response = await fetch(providerUrl, {
    headers: { accept: 'application/json', 'user-agent': 'meta-ads-dashboard-live-fetch/1.0' },
  });
  if (!response.ok) return { ok: false, error: `Live provider returned HTTP ${response.status}.` };

  const payload = normalizePayload(await response.json());
  await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, message: `Fetched ${payload.data.length} live records.`, payload };
}

export async function fetchPlans() {
  await runScript('scrape-plans.mjs');
  const payload = await readPlansData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} telecom plans from the configured pages.` };
}

export async function fetchDevices() {
  await runScript('scrape-devices.mjs');
  const payload = await readDevicesData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} devices from the configured e-store pages.` };
}

async function fetchSocialPostsNow(credentials = {}) {
  const providerUrl = process.env.SOCIAL_POSTS_JSON_URL;
  if (!providerUrl) {
    await runScript('scrape-organic-posts.mjs', {
      SOCIAL_FACEBOOK_EMAIL: credentials.facebook?.email || socialCredentials.facebook.email,
      SOCIAL_FACEBOOK_PASSWORD: credentials.facebook?.password || socialCredentials.facebook.password,
      SOCIAL_INSTAGRAM_EMAIL: credentials.instagram?.email || credentials.facebook?.email || socialCredentials.instagram.email,
      SOCIAL_INSTAGRAM_PASSWORD: credentials.instagram?.password || credentials.facebook?.password || socialCredentials.instagram.password,
    });
    await runScript('cache-social-thumbnails.mjs');
    const payload = await readSocialData();
    return { ok: true, payload, message: `Fetched ${payload.fetched_count || 0} live organic posts; ${payload.data?.length || 0} total saved posts.` };
  }
  const response = await fetch(providerUrl, { headers: { accept: 'application/json', 'user-agent': 'kuwait-social-monitor/1.0' } });
  if (!response.ok) throw new Error(`Social provider returned HTTP ${response.status}.`);
  const input = await response.json();
  const records = Array.isArray(input) ? input : input.data || input.posts || [];
  if (!Array.isArray(records)) throw new Error('Social provider must return an array or { data: [...] }.');
  const payload = { generated_at: new Date().toISOString(), source: input.source || 'Live social provider', data: records };
  await writeFile(socialDataPath, JSON.stringify(payload, null, 2), 'utf8');
  await runScript('cache-social-thumbnails.mjs');
  return { ok: true, payload, message: `Fetched ${records.length} social posts.` };
}

export function fetchSocialPosts(credentials = {}) {
  if (socialFetchPromise) return socialFetchPromise;
  socialFetchPromise = fetchSocialPostsNow(credentials).finally(() => { socialFetchPromise = null; });
  return socialFetchPromise;
}

export async function proxyImage(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { error: 'Invalid image URL.', status: 400 };
  }
  if (!/^https?:$/.test(parsed.protocol)) return { error: 'Only http and https images are supported.', status: 400 };

  const response = await fetch(parsed.href, {
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      referer: `${parsed.origin}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
  });
  if (!response.ok) return { error: `Image source returned HTTP ${response.status}.`, status: response.status };

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  if (!contentType.toLowerCase().startsWith('image/')) return { error: 'Source URL did not return an image.', status: 415 };

  return { contentType, buffer: Buffer.from(await response.arrayBuffer()) };
}
