import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { socialCredentials } from './social-credentials.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataPath = join(root, 'public', 'data', 'ads.json');
const socialDataPath = join(root, 'public', 'data', 'social-posts.json');
const plansDataPath = join(root, 'public', 'data', 'plans.json');
const devicesDataPath = join(root, 'public', 'data', 'devices.json');
const port = Number(process.env.LIVE_FETCH_PORT || 8787);
const socialPollSeconds = Math.max(30, Number(process.env.SOCIAL_POLL_SECONDS || 60));
let socialFetchPromise = null;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
}

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

async function fetchFromProvider() {
  const providerUrl = process.env.LIVE_ADS_JSON_URL;
  if (!providerUrl) {
    return fetchFromMetaPages();
  }

  const response = await fetch(providerUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'meta-ads-dashboard-live-fetch/1.0',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `Live provider returned HTTP ${response.status}.`,
    };
  }

  const payload = normalizePayload(await response.json());
  await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');
  return {
    ok: true,
    message: `Fetched ${payload.data.length} live records.`,
    payload,
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

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${scriptName} failed with exit code ${code}.${stderr ? ` ${stderr}` : ''}`));
      }
    });
  });
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

async function readCurrentData() {
  const text = await readFile(dataPath, 'utf8');
  return JSON.parse(text);
}

async function readSocialData() {
  const text = await readFile(socialDataPath, 'utf8');
  return JSON.parse(text);
}

async function readPlansData() {
  const text = await readFile(plansDataPath, 'utf8');
  return JSON.parse(text);
}

async function readDevicesData() {
  const text = await readFile(devicesDataPath, 'utf8');
  return JSON.parse(text);
}

async function proxyImage(req, res) {
  const requestUrl = new URL(req.url, `http://127.0.0.1:${port}`);
  const target = requestUrl.searchParams.get('url') || '';
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid image URL.' });
    return;
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    sendJson(res, 400, { ok: false, error: 'Only http and https images are supported.' });
    return;
  }
  const response = await fetch(parsed.href, {
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      referer: `${parsed.origin}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
  });
  if (!response.ok) {
    sendJson(res, response.status, { ok: false, error: `Image source returned HTTP ${response.status}.` });
    return;
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  if (!contentType.toLowerCase().startsWith('image/')) {
    sendJson(res, 415, { ok: false, error: 'Source URL did not return an image.' });
    return;
  }
  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': 'public, max-age=3600',
    'access-control-allow-origin': '*',
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function fetchPlans() {
  await runScript('scrape-plans.mjs');
  const payload = await readPlansData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} telecom plans from the configured pages.` };
}

async function fetchDevices() {
  await runScript('scrape-devices.mjs');
  const payload = await readDevicesData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} devices from the configured e-store pages.` };
}

async function fetchSocialPosts(credentials = {}) {
  if (socialFetchPromise) return socialFetchPromise;
  socialFetchPromise = fetchSocialPostsNow(credentials).finally(() => {
    socialFetchPromise = null;
  });
  return socialFetchPromise;
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) reject(new Error('Request body is too large.'));
    });
    req.on('end', () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Request body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === '/api/current-data') {
    try {
      sendJson(res, 200, { ok: true, payload: await readCurrentData() });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/fetch-live') {
    try {
      sendJson(res, 200, await fetchFromProvider());
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/social-posts') {
    try { sendJson(res, 200, await readSocialData()); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  if (req.url === '/api/plans') {
    try { sendJson(res, 200, await readPlansData()); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  if (req.url === '/api/devices') {
    try { sendJson(res, 200, await readDevicesData()); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  if (req.url.startsWith('/api/device-image?')) {
    try { await proxyImage(req, res); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  if (req.url === '/api/fetch-plans') {
    try { sendJson(res, 200, await fetchPlans()); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  if (req.url === '/api/fetch-devices') {
    try { sendJson(res, 200, await fetchDevices()); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  if (req.url === '/api/fetch-social-posts') {
    try { const credentials = req.method === 'POST' ? await readJsonBody(req) : {}; sendJson(res, 200, await fetchSocialPosts(credentials)); } catch (error) { sendJson(res, 500, { ok: false, error: error.message }); }
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Live fetch service listening on http://127.0.0.1:${port}`);
  console.log('Set LIVE_ADS_JSON_URL to connect a live Meta Ads JSON provider.');
  console.log('Set SOCIAL_POSTS_JSON_URL to an approved normalized social-post feed.');
});

if (process.env.SOCIAL_POSTS_JSON_URL) {
  fetchSocialPosts().catch((error) => console.error(`Initial social poll failed: ${error.message}`));
  setInterval(() => fetchSocialPosts().catch((error) => console.error(`Social poll failed: ${error.message}`)), socialPollSeconds * 1000).unref();
}
