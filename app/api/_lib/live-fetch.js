import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const dataPath = join(root, 'public', 'data', 'ads.json');
const socialDataPath = join(root, 'public', 'data', 'social-posts.json');
const plansDataPath = join(root, 'public', 'data', 'plans.json');
const devicesDataPath = join(root, 'public', 'data', 'devices.json');
const repositoryDataUrl = process.env.REPOSITORY_DATA_URL
  || 'https://raw.githubusercontent.com/thearjunks/AK01/main/public/data';
const rollingMonthMs = 30 * 24 * 60 * 60 * 1000;

let socialFetchPromise = null;
let adsFetchPromise = null;
let plansFetchPromise = null;
let devicesFetchPromise = null;
let adsFetchJob = {
  state: 'idle',
  message: 'No live ad refresh is currently running.',
  started_at: '',
  finished_at: '',
  count: 0,
};
const emptyComparisonJob = (message) => ({ state: 'idle', message, started_at: '', finished_at: '', count: 0 });
let plansFetchJob = emptyComparisonJob('No plan or banner refresh is currently running.');
let devicesFetchJob = emptyComparisonJob('No device refresh is currently running.');

function isInRollingMonth(value, now = Date.now()) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= now - rollingMonthMs && time <= now + 24 * 60 * 60 * 1000;
}

function recentSocialPosts(records, now = Date.now()) {
  return records.filter((record) => isInRollingMonth(record.published_at || record.publishedAt || record.created_time || record.timestamp, now));
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

function normalizeSocialPayload(payload) {
  const records = Array.isArray(payload) ? payload : payload.data || payload.posts || [];
  if (!Array.isArray(records)) throw new Error('Social provider must return an array or { data: [...] }.');
  return {
    ...payload,
    generated_at: new Date().toISOString(),
    source: payload.source || 'Live social provider',
    data: recentSocialPosts(records),
  };
}

function runScript(scriptName, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'scripts', scriptName)], {
      cwd: root,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0', ...extraEnv },
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
  const payload = JSON.parse(await readFile(dataPath, 'utf8'));
  if (Array.isArray(payload)) return payload;
  return { ...payload, data: payload.data || payload.ads || [] };
}

export async function readSocialData() {
  const payload = JSON.parse(await readFile(socialDataPath, 'utf8'));
  if (Array.isArray(payload)) return recentSocialPosts(payload);
  return { ...payload, data: recentSocialPosts(payload.data || payload.posts || []) };
}

export async function readPlansData() {
  return JSON.parse(await readFile(plansDataPath, 'utf8'));
}

export async function readDevicesData() {
  return JSON.parse(await readFile(devicesDataPath, 'utf8'));
}

async function fetchFromMetaPages() {
  let scrape;
  try {
    scrape = await runScript('scrape-meta-ads.mjs');
  } catch (error) {
    console.error(`[fetch-live] scrape-meta-ads.mjs failed: ${error.message}`);
    throw error;
  }
  if (scrape.stderr) console.error(`[fetch-live] scrape-meta-ads.mjs stderr:\n${scrape.stderr}`);
  const payload = normalizePayload(await readCurrentData());
  await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');
  return {
    ok: true,
    message: `Fetched ${payload.data.length} ads across all available dates and statuses.`,
    payload,
    log: scrape.stdout,
  };
}

export async function fetchFromProvider() {
  const providerUrl = process.env.LIVE_ADS_JSON_URL
    || (process.env.NODE_ENV === 'production' ? `${repositoryDataUrl}/ads.json` : '');
  if (!providerUrl) return fetchFromMetaPages();

  const response = await fetch(providerUrl, {
    headers: { accept: 'application/json', 'user-agent': 'meta-ads-dashboard-live-fetch/1.0' },
  });
  if (!response.ok) return { ok: false, error: `Live provider returned HTTP ${response.status}.` };

  const payload = normalizePayload(await response.json());
  await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, message: `Fetched ${payload.data.length} live records.`, payload };
}

export function getAdsFetchJob() {
  return { ...adsFetchJob };
}

export function startAdsFetchJob() {
  if (adsFetchPromise) {
    return { accepted: false, job: getAdsFetchJob() };
  }

  adsFetchJob = {
    state: 'running',
    message: 'Loading the complete saved Meta Ads Library history across active and inactive ads.',
    started_at: new Date().toISOString(),
    finished_at: '',
    count: 0,
  };

  adsFetchPromise = fetchFromProvider()
    .then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Live ad refresh failed.');
      const count = result.payload?.data?.length || 0;
      adsFetchJob = {
        state: 'complete',
        message: result.message || `Live refresh completed with ${count} ads.`,
        started_at: adsFetchJob.started_at,
        finished_at: new Date().toISOString(),
        count,
      };
    })
    .catch((error) => {
      console.error(`[fetch-live] background refresh failed: ${error.message}`);
      adsFetchJob = {
        state: 'error',
        message: error.message,
        started_at: adsFetchJob.started_at,
        finished_at: new Date().toISOString(),
        count: 0,
      };
    })
    .finally(() => {
      adsFetchPromise = null;
    });

  return { accepted: true, job: getAdsFetchJob() };
}

export async function fetchPlans() {
  if (process.env.NODE_ENV === 'production') {
    const response = await fetch(`${repositoryDataUrl}/plans.json?refresh=${Date.now()}`, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-cache' } });
    if (!response.ok) throw new Error(`Automated plan snapshot returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !Array.isArray(payload.banners)) throw new Error('Automated plan snapshot has an invalid format.');
    await writeFile(plansDataPath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, payload, message: `Loaded ${payload.data.length} active plans and ${payload.banners.length} homepage banners from the hourly live collector.` };
  }
  await runScript('scrape-plans.mjs');
  const payload = await readPlansData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} telecom plans from the configured pages.` };
}

export async function fetchDevices() {
  if (process.env.NODE_ENV === 'production') {
    const response = await fetch(`${repositoryDataUrl}/devices.json?refresh=${Date.now()}`, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-cache' } });
    if (!response.ok) throw new Error(`Automated device snapshot returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error('Automated device snapshot has an invalid format.');
    await writeFile(devicesDataPath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, payload, message: `Loaded ${payload.data.length} devices from the hourly live collector.` };
  }
  await runScript('scrape-devices.mjs');
  const payload = await readDevicesData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} devices from the configured e-store pages.` };
}

function startComparisonJob(kind) {
  const isPlans = kind === 'plans';
  const running = isPlans ? plansFetchPromise : devicesFetchPromise;
  if (running) return { accepted: false, job: { ...(isPlans ? plansFetchJob : devicesFetchJob) } };

  const startedAt = new Date().toISOString();
  const runningJob = {
    state: 'running',
    message: isPlans
      ? 'Collecting active plans and homepage banners from all three competitors.'
      : 'Collecting the complete current e-store device catalog from all three competitors.',
    started_at: startedAt,
    finished_at: '',
    count: 0,
  };
  if (isPlans) plansFetchJob = runningJob;
  else devicesFetchJob = runningJob;

  const task = (isPlans ? fetchPlans() : fetchDevices())
    .then((result) => {
      const count = result.payload?.data?.length || 0;
      const extra = isPlans ? ` and ${result.payload?.banners?.length || 0} homepage banners` : '';
      const job = {
        state: 'complete',
        message: `Live refresh completed with ${count} ${isPlans ? 'active plans' : 'current devices'}${extra}.`,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        count,
      };
      if (isPlans) plansFetchJob = job;
      else devicesFetchJob = job;
    })
    .catch((error) => {
      const job = { state: 'error', message: error.message, started_at: startedAt, finished_at: new Date().toISOString(), count: 0 };
      if (isPlans) plansFetchJob = job;
      else devicesFetchJob = job;
    })
    .finally(() => {
      if (isPlans) plansFetchPromise = null;
      else devicesFetchPromise = null;
    });

  if (isPlans) plansFetchPromise = task;
  else devicesFetchPromise = task;
  return { accepted: true, job: { ...runningJob } };
}

export function startPlansFetchJob() { return startComparisonJob('plans'); }
export function startDevicesFetchJob() { return startComparisonJob('devices'); }
export function getPlansFetchJob() { return { ...plansFetchJob }; }
export function getDevicesFetchJob() { return { ...devicesFetchJob }; }

async function fetchSocialPostsNow() {
  const providerUrl = process.env.SOCIAL_POSTS_JSON_URL
    || (process.env.NODE_ENV === 'production' ? `${repositoryDataUrl}/social-posts.json` : '');
  if (!providerUrl) {
    await runScript('scrape-organic-posts.mjs', {
      SOCIAL_FACEBOOK_EMAIL: process.env.SOCIAL_FACEBOOK_EMAIL || '',
      SOCIAL_FACEBOOK_PASSWORD: process.env.SOCIAL_FACEBOOK_PASSWORD || '',
      SOCIAL_INSTAGRAM_EMAIL: process.env.SOCIAL_INSTAGRAM_EMAIL || '',
      SOCIAL_INSTAGRAM_PASSWORD: process.env.SOCIAL_INSTAGRAM_PASSWORD || '',
      SOCIAL_X_EMAIL: process.env.SOCIAL_X_EMAIL || '',
      SOCIAL_X_PASSWORD: process.env.SOCIAL_X_PASSWORD || '',
      SOCIAL_TIKTOK_EMAIL: process.env.SOCIAL_TIKTOK_EMAIL || '',
      SOCIAL_TIKTOK_PASSWORD: process.env.SOCIAL_TIKTOK_PASSWORD || '',
    });
    await runScript('cache-social-thumbnails.mjs');
    const payload = normalizeSocialPayload(await readSocialData());
    await writeFile(socialDataPath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, payload, message: `Fetched ${payload.data.length} organic posts from the last 30 days.` };
  }
  const liveProviderUrl = `${providerUrl}${providerUrl.includes('?') ? '&' : '?'}refresh=${Date.now()}`;
  const response = await fetch(liveProviderUrl, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-cache', 'user-agent': 'kuwait-social-monitor/1.0' } });
  if (!response.ok) throw new Error(`Social provider returned HTTP ${response.status}.`);
  const input = await response.json();
  const payload = normalizeSocialPayload(input);
  if (!payload.data.length) {
    const saved = await readSocialData();
    const savedRecords = Array.isArray(saved) ? saved : saved.data || [];
    if (savedRecords.length) {
      return { ok: true, payload: saved, message: `Live organic provider returned no posts, so ${savedRecords.length} saved posts from the last 30 days were preserved.` };
    }
  }
  await writeFile(socialDataPath, JSON.stringify(payload, null, 2), 'utf8');
  await runScript('cache-social-thumbnails.mjs');
  return { ok: true, payload, message: `Fetched ${payload.data.length} organic posts from the last 30 days.` };
}

export function fetchSocialPosts() {
  if (socialFetchPromise) return socialFetchPromise;
  socialFetchPromise = fetchSocialPostsNow().finally(() => { socialFetchPromise = null; });
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
