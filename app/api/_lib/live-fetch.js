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
const primaryAdPageIds = ['85631962851', '181832232881', '114476661945257'];

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
    generated_at: payload.generated_at || new Date().toISOString(),
    source: payload.source || 'Live fetch provider',
    data: records,
  };
}

function validateActiveAdsPayload(payload) {
  const validation = payload.validation;
  if (!validation?.complete || !validation.active_only || !Array.isArray(validation.pages) || validation.pages.length < 3) {
    throw new Error('The live collector did not provide complete active-ad validation for every tracked page. The previous snapshot was preserved.');
  }

  const validatedPageIds = new Set(validation.pages.map((page) => String(page.page_id)));
  if (primaryAdPageIds.some((pageId) => !validatedPageIds.has(pageId))) {
    throw new Error('The live collector did not validate stc, Ooredoo, and Zain together. The previous snapshot was preserved.');
  }
  const seen = new Set();
  for (const ad of payload.data) {
    const key = `${ad.page_id}:${ad.ad_archive_id}`;
    if (!ad.page_id || !ad.ad_archive_id || seen.has(key)) {
      throw new Error('The live collector returned missing or duplicate ad identifiers. The previous snapshot was preserved.');
    }
    if (validatedPageIds.has(String(ad.page_id)) && (ad.ad_status === 'inactive' || ad.ad_delivery_stop_time)) {
      throw new Error('The active-only collector returned an inactive ad. The previous snapshot was preserved.');
    }
    seen.add(key);
  }

  for (const page of validation.pages) {
    const captured = payload.data.filter((ad) => String(ad.page_id) === String(page.page_id)).length;
    const sourceCount = Number(page.source_count);
    const tolerance = page.approximate ? Math.max(3, Math.ceil(sourceCount * 0.05)) : 0;
    const minimum = sourceCount - tolerance;
    if (!page.complete || !page.pagination_exhausted || captured !== Number(page.captured) || captured < minimum) {
      throw new Error(`${page.page_name || page.page_id} failed source reconciliation (${captured}/${page.source_count}). The previous snapshot was preserved.`);
    }
  }

  return payload;
}

function activeAdsValidationSummary(payload) {
  const pages = payload.validation.pages;
  return pages.map((page) => `${page.page_name}: ${page.captured}/${page.approximate ? '~' : ''}${page.source_count}`).join(' · ');
}

function normalizeSocialPayload(payload) {
  const records = Array.isArray(payload) ? payload : payload.data || payload.posts || [];
  if (!Array.isArray(records)) throw new Error('Social provider must return an array or { data: [...] }.');
  return {
    ...payload,
    generated_at: payload.generated_at || new Date().toISOString(),
    source: payload.source || 'Live social provider',
    data: recentSocialPosts(records),
  };
}

function validateInstagramPayload(payload) {
  const validation = payload.instagram_validation;
  const expectedCompanies = ['stc Kuwait', 'Ooredoo Kuwait', 'Zain Kuwait'];
  const minimumRequired = Math.max(15, Number(validation?.minimum_required_per_account || 15));
  if (!validation?.complete || !Array.isArray(validation.accounts)) {
    throw new Error('Instagram refresh was not validated for all three accounts. The previous snapshot was preserved.');
  }
  for (const company of expectedCompanies) {
    const account = validation.accounts.find((item) => item.company === company);
    const posts = payload.data.filter((post) => post.platform === 'Instagram' && post.company === company);
    if (!account?.complete || !account.newest_post_at || Number(account.count || 0) < minimumRequired || posts.length < minimumRequired) {
      throw new Error(`${company} Instagram refresh has fewer than ${minimumRequired} verified posts. The previous snapshot was preserved.`);
    }
  }
  return payload;
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
  const previousSnapshot = await readFile(dataPath, 'utf8');
  try {
    const scrape = await runScript('scrape-meta-ads.mjs', {
      META_ADS_ACTIVE_STATUS: 'active',
      META_ADS_PAGE_IDS: primaryAdPageIds.join(','),
    });
    if (scrape.stderr) console.error(`[fetch-live] scrape-meta-ads.mjs stderr:\n${scrape.stderr}`);
    const artwork = await runScript('cache-artwork.mjs');
    if (artwork.stderr) console.error(`[fetch-live] cache-artwork.mjs stderr:\n${artwork.stderr}`);
    const payload = validateActiveAdsPayload(normalizePayload(await readCurrentData()));
    const artworkRows = payload.data.filter((ad) => String(ad.artwork_url || '').trim());
    const cachedArtworkCount = artworkRows.filter((ad) => String(ad.local_artwork_url || '').trim()).length;
    if (cachedArtworkCount !== artworkRows.length) {
      throw new Error(`Creative caching incomplete (${cachedArtworkCount}/${artworkRows.length}). The previous validated snapshot was restored.`);
    }
    await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');
    return {
      ok: true,
      message: `Live active-ad validation passed. ${activeAdsValidationSummary(payload)}. Cached ${cachedArtworkCount}/${artworkRows.length} creatives.`,
      validated_count: payload.validation.pages.reduce((total, page) => total + Number(page.captured || 0), 0),
      payload,
      log: `${scrape.stdout}${artwork.stdout ? `\n${artwork.stdout}` : ''}`,
    };
  } catch (error) {
    await writeFile(dataPath, previousSnapshot, 'utf8');
    console.error(`[fetch-live] paid-ad refresh failed: ${error.message}`);
    throw error;
  }
}

export async function fetchFromProvider() {
  const providerUrl = process.env.LIVE_ADS_JSON_URL || '';
  if (!providerUrl) return fetchFromMetaPages();

  const response = await fetch(providerUrl, {
    headers: { accept: 'application/json', 'user-agent': 'meta-ads-dashboard-live-fetch/1.0' },
  });
  if (!response.ok) return { ok: false, error: `Live provider returned HTTP ${response.status}.` };

  const payload = validateActiveAdsPayload(normalizePayload(await response.json()));
  await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');
  return {
    ok: true,
    message: `Live active-ad validation passed. ${activeAdsValidationSummary(payload)}.`,
    validated_count: payload.validation.pages.reduce((total, page) => total + Number(page.captured || 0), 0),
    payload,
  };
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
    message: 'Collecting every active Meta ad and reconciling each page against Meta’s displayed result total.',
    started_at: new Date().toISOString(),
    finished_at: '',
    count: 0,
  };

  adsFetchPromise = fetchFromProvider()
    .then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Live ad refresh failed.');
      const count = result.validated_count || 0;
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
  await runScript('scrape-plans.mjs');
  const payload = await readPlansData();
  return { ok: true, payload, message: `Fetched ${payload.data?.length || 0} telecom plans from ${payload.source_links?.length || 0} configured category links.` };
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
      ? 'Collecting plans from the 18 configured stc, Ooredoo, and Zain category links.'
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
  const providerUrl = process.env.SOCIAL_POSTS_JSON_URL || '';
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
      SOCIAL_PLATFORMS: 'Instagram',
      SOCIAL_REQUIRE_INSTAGRAM_COVERAGE: '1',
      INSTAGRAM_MIN_POSTS: process.env.INSTAGRAM_MIN_POSTS || '15',
      ORGANIC_MAX_SCROLLS: process.env.ORGANIC_MAX_SCROLLS || '8',
      INSTAGRAM_DETAIL_LIMIT: process.env.INSTAGRAM_DETAIL_LIMIT || '12',
    });
    await runScript('cache-social-thumbnails.mjs');
    const payload = validateInstagramPayload(normalizeSocialPayload(await readSocialData()));
    await writeFile(socialDataPath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, payload, message: `Verified ${payload.fetched_count} newest Instagram posts and loaded ${payload.data.length} posts from the last 30 days.` };
  }
  const liveProviderUrl = `${providerUrl}${providerUrl.includes('?') ? '&' : '?'}refresh=${Date.now()}`;
  const response = await fetch(liveProviderUrl, { cache: 'no-store', headers: { accept: 'application/json', 'cache-control': 'no-cache', 'user-agent': 'kuwait-social-monitor/1.0' } });
  if (!response.ok) throw new Error(`Social provider returned HTTP ${response.status}.`);
  const input = await response.json();
  const payload = validateInstagramPayload(normalizeSocialPayload(input));
  if (!payload.data.length) {
    const saved = await readSocialData();
    const savedRecords = Array.isArray(saved) ? saved : saved.data || [];
    if (savedRecords.length) {
      return { ok: true, payload: saved, message: `Live organic provider returned no posts, so ${savedRecords.length} saved posts from the last 30 days were preserved.` };
    }
  }
  await writeFile(socialDataPath, JSON.stringify(payload, null, 2), 'utf8');
  await runScript('cache-social-thumbnails.mjs');
  return { ok: true, payload, message: `Verified ${payload.fetched_count} newest Instagram posts and loaded ${payload.data.length} posts from the last 30 days.` };
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

  let contentType = response.headers.get('content-type') || 'application/octet-stream';
  if (!contentType.toLowerCase().startsWith('image/')) {
    const extension = parsed.pathname.toLowerCase().match(/\.(avif|webp|png|jpe?g|gif|svg)$/)?.[1];
    const inferredTypes = { avif: 'image/avif', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };
    if (!extension) return { error: 'Source URL did not return an image.', status: 415 };
    contentType = inferredTypes[extension];
  }

  return { contentType, buffer: Buffer.from(await response.arrayBuffer()) };
}
