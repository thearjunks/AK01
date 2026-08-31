import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'social-posts.json');
const maxScrolls = Math.max(3, Number(process.env.ORGANIC_MAX_SCROLLS || 20));
const instagramEmail = process.env.SOCIAL_INSTAGRAM_EMAIL || '';
const instagramPassword = process.env.SOCIAL_INSTAGRAM_PASSWORD || '';
const xEmail = process.env.SOCIAL_X_EMAIL || '';
const xPassword = process.env.SOCIAL_X_PASSWORD || '';
const tiktokEmail = process.env.SOCIAL_TIKTOK_EMAIL || '';
const tiktokPassword = process.env.SOCIAL_TIKTOK_PASSWORD || '';
const facebookGraphToken = process.env.FACEBOOK_GRAPH_ACCESS_TOKEN || '';
const facebookGraphVersion = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
const authProfileDir = process.env.SOCIAL_BROWSER_PROFILE_DIR || path.join(root, '.auth', 'social-browser');
const instagramDetailLimit = Math.max(0, Number(process.env.INSTAGRAM_DETAIL_LIMIT || 18));
const selectedPlatforms = new Set(String(process.env.SOCIAL_PLATFORMS || 'Facebook,Instagram,X,TikTok').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
const platformEnabled = (platform) => selectedPlatforms.has(platform.toLowerCase());
const requireInstagramCoverage = process.env.SOCIAL_REQUIRE_INSTAGRAM_COVERAGE === '1';
const requireFacebookCoverage = process.env.SOCIAL_REQUIRE_FACEBOOK_COVERAGE === '1';
const minimumInstagramPosts = Math.max(15, Number(process.env.INSTAGRAM_MIN_POSTS || 15));
const minimumFacebookPosts = Math.max(15, Number(process.env.FACEBOOK_MIN_POSTS || 15));
const browserOptions = {
  headless: process.env.SOCIAL_BROWSER_VISIBLE === '1' ? false : true,
  ignoreHTTPSErrors: process.env.SOCIAL_IGNORE_HTTPS_ERRORS === '1',
  viewport: { width: 1440, height: 1100 },
  locale: 'en-US',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
};

const facebookTargets = [
  { company: 'stc Kuwait', name: 'stc Kuwait', handle: 'stc.kwt', url: 'https://www.facebook.com/stc.kwt/' },
  { company: 'Ooredoo Kuwait', name: 'Ooredoo Kuwait', handle: 'OoredooKuwait', url: 'https://www.facebook.com/OoredooKuwait' },
  { company: 'Zain Kuwait', name: 'Zain Kuwait', handle: 'zainkuwait', url: 'https://www.facebook.com/zainkuwait' },
];
const instagramTargets = [
  { company: 'stc Kuwait', handle: 'stc_kwt', url: 'https://www.instagram.com/stc_kwt/' },
  { company: 'Ooredoo Kuwait', handle: 'ooredookuwait', url: 'https://www.instagram.com/ooredookuwait/' },
  { company: 'Zain Kuwait', handle: 'zainkuwait', url: 'https://www.instagram.com/zainkuwait/' },
];
const xTargets = [
  { company: 'stc Kuwait', handle: 'stc_kwt', url: 'https://x.com/stc_kwt' },
  { company: 'Ooredoo Kuwait', handle: 'OoredooKuwait', url: 'https://x.com/OoredooKuwait' },
  { company: 'Zain Kuwait', handle: 'ZainKuwait', url: 'https://x.com/ZainKuwait' },
];
const tiktokTargets = [
  { company: 'stc Kuwait', handle: 'stc_kwt', url: 'https://www.tiktok.com/@stc_kwt?lang=en' },
  { company: 'Ooredoo Kuwait', handle: 'ooredookuwait', url: 'https://www.tiktok.com/@ooredookuwait?lang=en' },
  { company: 'Zain Kuwait', handle: 'zainkuwait', url: 'https://www.tiktok.com/@zainkuwait?lang=en' },
];
const instagramHandleCompanies = new Map(instagramTargets.map((target) => [target.handle.toLowerCase(), target.company]));
const collectedProfiles = [];
const instagramDirectPostUrls = [
  'https://www.instagram.com/p/Da2suqZlKu2/?img_index=1',
  'https://www.instagram.com/p/Da5DtWpFkjy/',
  'https://www.instagram.com/p/Da8DRdjo0OV/',
  'https://www.instagram.com/p/Da-DUk3Iqzp/',
  'https://www.instagram.com/p/Da-G-8jmikE/',
  'https://www.instagram.com/p/Da-bOyAgA3P/?img_index=1',
  'https://www.instagram.com/p/DbAsTTZNM_j/',
  'https://www.instagram.com/p/DbA_2O6mrXx/?img_index=1',
  'https://www.instagram.com/p/Da2ZH1gImXD/',
  'https://www.instagram.com/p/Da2f5weIul6/',
  'https://www.instagram.com/p/Da2-xh1oV0q/',
  'https://www.instagram.com/p/Da54q-1R4OP/',
  'https://www.instagram.com/p/Da5_5ZoR48b/',
  'https://www.instagram.com/p/Da-oz3SIBVc/',
  'https://www.instagram.com/p/DbAoaJDCO45/?img_index=1',
  'https://www.instagram.com/p/DbAvGBUCMus/?img_index=1',
  'https://www.instagram.com/p/DbDGFR5CN1d/?img_index=1',
  'https://www.instagram.com/p/DbDU3PdiAgN/?img_index=1',
  'https://www.instagram.com/p/DbFguA6iALT/?img_index=1',
  ...(process.env.INSTAGRAM_DIRECT_POST_URLS || '').split(',').map((url) => url.trim()).filter(Boolean),
];

function stableId(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 18);
}

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

const rollingMonthMs = 30 * 24 * 60 * 60 * 1000;

function metricNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = clean(value).toLowerCase().replace(/,/g, '');
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*([kmb])?/i);
  if (!match) return null;
  const multiplier = match[2] === 'k' ? 1e3 : match[2] === 'm' ? 1e6 : match[2] === 'b' ? 1e9 : 1;
  return Math.round(Number(match[1]) * multiplier);
}

function relativeDate(label, now = Date.now()) {
  const value = clean(label).toLowerCase();
  if (!value) return '';
  if (/just now/.test(value)) return new Date(now).toISOString();
  if (/yesterday/.test(value)) return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (/\ba day ago\b/.test(value)) return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekdayMatch = value.match(/(?:last|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (weekdayMatch) {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const current = new Date(now);
    let daysBack = (current.getDay() - weekdays.indexOf(weekdayMatch[1].toLowerCase()) + 7) % 7;
    if (!daysBack || value.startsWith('last ')) daysBack = daysBack || 7;
    return new Date(now - daysBack * 86400000).toISOString();
  }
  const absoluteMatch = value.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?(?:\s+at\s+(\d{1,2}):(\d{2}))?/i);
  if (absoluteMatch) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const current = new Date(now);
    const year = Number(absoluteMatch[3] || current.getFullYear());
    const parsed = new Date(year, months.indexOf(absoluteMatch[2].toLowerCase()), Number(absoluteMatch[1]), Number(absoluteMatch[4] || 12), Number(absoluteMatch[5] || 0));
    if (!absoluteMatch[3] && parsed.getTime() > now + 86400000) parsed.setFullYear(parsed.getFullYear() - 1);
    return parsed.toISOString();
  }
  const match = value.match(/(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|month|months|y|year|years)\b/);
  if (!match) return '';
  const amount = Number(match[1]);
  const unit = match[2];
  const ms = unit.startsWith('m') && !unit.startsWith('mo') ? 60000
    : unit.startsWith('h') ? 3600000
      : unit === 'd' || unit.startsWith('day') ? 86400000
        : unit === 'w' || unit.startsWith('week') ? 7 * 86400000
          : unit.startsWith('mo') ? 30 * 86400000
            : 365 * 86400000;
  return new Date(now - amount * ms).toISOString();
}

function isRecent(post) {
  const now = Date.now();
  const time = new Date(post.published_at || '').getTime();
  return Number.isFinite(time) && time >= now - rollingMonthMs && time <= now + 86400000;
}

async function startBrowserSession() {
  await mkdir(authProfileDir, { recursive: true });
  try {
    const context = await chromium.launchPersistentContext(authProfileDir, { channel: 'chrome', ...browserOptions });
    return { context, page: context.pages()[0] || await context.newPage() };
  } catch {
    const context = await chromium.launchPersistentContext(authProfileDir, browserOptions);
    return { context, page: context.pages()[0] || await context.newPage() };
  }
}

async function launchDirectBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function loginInstagram(page) {
  if (!instagramEmail || !instagramPassword) throw new Error('Instagram email and password are required.');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);

  const usernameField = page.locator('input[name="username"], input[name="email"]').first();
  const passwordField = page.locator('input[name="password"], input[name="pass"]').first();
  if (!(await usernameField.count()) || !(await passwordField.count())) {
    if (/instagram\.com\/?$/.test(page.url()) || /instagram\.com\/accounts\/onetap/.test(page.url())) return;
    throw new Error(`Instagram login form was unavailable at ${page.url()}.`);
  }

  await usernameField.fill(instagramEmail);
  await passwordField.fill(instagramPassword);
  await passwordField.press('Enter');
  await page.waitForTimeout(7000);

  if (/challenge|login|two_factor|checkpoint/i.test(page.url())) {
    throw new Error('Instagram login requires correction or an interactive security check. Run LOGIN SOCIAL ACCOUNTS.cmd once, complete the browser login, then fetch again.');
  }

  for (const selector of [
    'text=Not now',
    'text=Not Now',
    'text=Save info',
    'text=Turn on Notifications',
  ]) {
    try {
      const button = page.locator(selector).first();
      if (await button.count()) await button.click({ timeout: 1500 });
    } catch {}
  }
}

async function loginX(page) {
  if (!xEmail || !xPassword) throw new Error('X email and password are required.');
  await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  if (!/login|flow/i.test(page.url())) return;
  const user = page.locator('input[autocomplete="username"], input[name="text"]').first();
  if (!(await user.count())) throw new Error('X login form was unavailable.');
  await user.fill(xEmail);
  await user.press('Enter');
  await page.waitForTimeout(1800);
  const passwordField = page.locator('input[name="password"], input[type="password"]').first();
  if (!(await passwordField.count())) throw new Error('X login requires an interactive username or security check.');
  await passwordField.fill(xPassword);
  await passwordField.press('Enter');
  await page.waitForTimeout(5500);
  if (/login|challenge|account\/access/i.test(page.url())) throw new Error('X login requires an interactive security check.');
}

async function loginTikTok(page) {
  if (!tiktokEmail || !tiktokPassword) throw new Error('TikTok email and password are required.');
  await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  if (!/\/login/i.test(page.url())) return;
  const user = page.locator('input[name="username"], input[type="text"]').first();
  const passwordField = page.locator('input[type="password"]').first();
  if (!(await user.count()) || !(await passwordField.count())) throw new Error('TikTok login form was unavailable or requires an interactive check.');
  await user.fill(tiktokEmail);
  await passwordField.fill(tiktokPassword);
  await passwordField.press('Enter');
  await page.waitForTimeout(6000);
  if (/\/login|captcha|verify/i.test(page.url())) throw new Error('TikTok login requires an interactive security check.');
}

async function facebookGraphRequest(pathname, parameters = {}) {
  const url = new URL(`https://graph.facebook.com/${facebookGraphVersion}/${pathname.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries({ ...parameters, access_token: facebookGraphToken })) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(`Meta Graph API request failed: ${payload.error?.message || `HTTP ${response.status}`}`);
  return payload;
}

async function scrapeFacebookGraph(target) {
  const profile = await facebookGraphRequest(target.handle, { fields: 'id,name,picture.type(large),followers_count,fan_count' });
  collectedProfiles.push({ company: target.company, platform: 'Facebook', username: target.handle, display_name: profile.name || target.name, profile_picture_url: profile.picture?.data?.url || '', followers: profile.followers_count ?? profile.fan_count ?? null });
  const fields = 'id,message,created_time,permalink_url,full_picture,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true),attachments.limit(1){media_type,media,image,subattachments.limit(1){media_type,media}}';
  const payload = await facebookGraphRequest(`${profile.id}/posts`, { fields, limit: 100, since: Math.floor((Date.now() - rollingMonthMs) / 1000) });
  return (payload.data || []).map((post) => {
    const attachment = post.attachments?.data?.[0] || {};
    const thumbnail = post.full_picture || attachment.media?.image?.src || attachment.image?.src || attachment.subattachments?.data?.[0]?.media?.image?.src || '';
    const mediaType = String(attachment.media_type || '').toLowerCase();
    const permalink = post.permalink_url || target.url;
    const postType = /\/reel\//i.test(permalink) ? 'Reel' : mediaType.includes('video') ? 'Video' : mediaType.includes('album') ? 'Carousel' : thumbnail ? 'Image' : 'Post';
    return { id: `facebook-${post.id}`, company: target.company, platform: 'Facebook', published_at: post.created_time || '', caption: clean(post.message), thumbnail, post_type: postType, url: permalink, likes: post.reactions?.summary?.total_count ?? null, comments: post.comments?.summary?.total_count ?? null, shares: post.shares?.count ?? null, views: null, status: 'New' };
  });
}

async function visibleInstagramPosts(page, target) {
  return page.evaluate((arg) => [...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"],a[href*="/tv/"]')].map((anchor) => {
    const image = anchor.querySelector('img') || anchor.closest('div')?.querySelector('img');
    const caption = (image?.alt || anchor.getAttribute('aria-label') || '').replace(/^[-\s⁣‏]+/u, '').trim();
    const url = new URL(anchor.href, location.origin);
    url.search = '';
    url.hash = '';
    const match = url.pathname.match(/\/(p|reel|tv)\/([^/]+)/);
    const id = match?.[2] || url.pathname.split('/').filter(Boolean).pop();
    return {
      id: `instagram-${id}`,
      company: arg.company,
      platform: 'Instagram',
      published_at: '',
      thumbnail: image?.currentSrc || image?.src || '',
      caption,
      post_type: url.pathname.includes('/reel/') ? 'Reel' : caption.includes('Carousel') ? 'Carousel' : 'Image',
      url: url.href,
      status: 'New',
    };
  }).filter((post) => post.id !== 'instagram-undefined' && post.url && post.thumbnail), target);
}

async function enrichInstagramPost(page, post) {
  const detailPage = await page.context().newPage();
  try {
    await detailPage.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await detailPage.waitForTimeout(2500);
    const enriched = await detailPage.evaluate((input) => {
      const clean = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const timeElement = document.querySelector('time[datetime]');
      const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const captionCandidates = [
        clean(document.querySelector('h1')?.innerText || ''),
        clean(document.querySelector('article h2')?.innerText || ''),
        clean(ogDescription.replace(/^\d[\d,.\s]*(likes|views).*?-\s*/i, '')),
        input.caption,
      ].filter(Boolean);
      const relativeLabel = [...document.querySelectorAll('time')].map((node) => clean(node.innerText)).find(Boolean) || '';
      return {
        ...input,
        caption: captionCandidates.sort((a, b) => b.length - a.length)[0] || input.caption,
        thumbnail: input.thumbnail || ogImage,
        published_at: timeElement?.getAttribute('datetime') || input.published_at || '',
        published_label: relativeLabel,
        likes_label: (ogDescription.match(/([\d,.]+\s*[KMB]?)\s+likes?/i) || [])[1] || '',
        comments_label: (ogDescription.match(/([\d,.]+\s*[KMB]?)\s+comments?/i) || [])[1] || '',
        views_label: (ogDescription.match(/([\d,.]+\s*[KMB]?)\s+views?/i) || [])[1] || '',
      };
    }, post);
    return { ...enriched, likes: metricNumber(enriched.likes_label), comments: metricNumber(enriched.comments_label), views: metricNumber(enriched.views_label) };
  } catch {
    return post;
  } finally {
    await detailPage.close();
  }
}

function companyFromInstagramHandle(handle) {
  const value = String(handle || '').toLowerCase();
  return instagramHandleCompanies.get(value) || (value.includes('ooredoo') ? 'Ooredoo Kuwait' : value.includes('zain') ? 'Zain Kuwait' : 'stc Kuwait');
}

function captionFromOgDescription(value) {
  const text = clean(value);
  const quoted = text.match(/:\s*"([\s\S]*?)"\.?\s*[\u200e\u200f\s]*$/);
  return clean(quoted?.[1] || text.replace(/^\d[\d,.\s]*(likes|views).*?-\s*/i, ''));
}

async function scrapeInstagramDirectPost(context, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    return await page.evaluate((inputUrl) => {
      const cleanText = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || location.href || inputUrl;
      const code = canonicalUrl.match(/\/p\/([^/?#]+)/)?.[1] || inputUrl.match(/\/p\/([^/?#]+)/)?.[1] || '';
      const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const handle = (ogDescription.match(/-\s*([A-Za-z0-9_.]+)\s+on\s+/) || document.body.innerText.match(/\n([A-Za-z0-9_.]+)\n\s*•\n\s*Follow/) || [])[1] || '';
      const timeElement = document.querySelector('time[datetime]');
      const relativeLabel = [...document.querySelectorAll('time')].map((node) => cleanText(node.innerText)).find(Boolean) || '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const image = ogImage || [...document.querySelectorAll('img')].map((img) => img.currentSrc || img.src).find((src) => src && !src.includes('2885-19')) || '';
      return { code, handle, ogDescription, published_at: timeElement?.getAttribute('datetime') || '', published_label: relativeLabel, thumbnail: image, url: canonicalUrl };
    }, url);
  } finally {
    await page.close();
  }
}

async function scrapeInstagramDirectPosts() {
  const browser = await launchDirectBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  });
  const found = [];
  const seen = new Set();
  try {
    for (const url of instagramDirectPostUrls) {
      const normalizedUrl = url.split('?')[0];
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      try {
        const raw = await scrapeInstagramDirectPost(context, url);
        if (!raw.code || !raw.thumbnail) continue;
        found.push({
          id: `instagram-${raw.code}`,
          company: companyFromInstagramHandle(raw.handle),
          platform: 'Instagram',
          published_at: raw.published_at,
          published_label: raw.published_label,
          thumbnail: raw.thumbnail,
          caption: captionFromOgDescription(raw.ogDescription),
          post_type: 'Image',
          url: raw.url || normalizedUrl,
          status: 'New',
        });
      } catch (error) {
        console.error(`Seeded Instagram URL failed: ${url} - ${error.message}`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return found;
}

async function instagramApiPosts(page, target) {
  const result = await page.evaluate(async (handle) => {
    const response = await fetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`, {
      credentials: 'include',
      headers: { 'x-ig-app-id': '936619743392459' },
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, target.handle);
  if (!result.ok) throw new Error(`Instagram profile API returned HTTP ${result.status} for ${target.handle}.`);
  let payload;
  try { payload = JSON.parse(result.text); } catch { throw new Error(`Instagram profile API returned invalid JSON for ${target.handle}.`); }
  const user = payload?.data?.user;
  const edges = user?.edge_owner_to_timeline_media?.edges || [];
  if (user) collectedProfiles.push({
    company: target.company,
    platform: 'Instagram',
    username: user.username || target.handle,
    display_name: user.full_name || target.company,
    profile_picture_url: user.profile_pic_url_hd || user.profile_pic_url || '',
    followers: Number.isFinite(user.edge_followed_by?.count) ? user.edge_followed_by.count : null,
    total_posts: Number.isFinite(user.edge_owner_to_timeline_media?.count) ? user.edge_owner_to_timeline_media.count : null,
    verified: Boolean(user.is_verified),
    profile_url: target.url,
    captured_at: new Date().toISOString(),
  });
  return edges.map(({ node }) => ({
    id: `instagram-${node.shortcode}`,
    company: target.company,
    platform: 'Instagram',
    published_at: node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000).toISOString() : '',
    thumbnail: node.thumbnail_src || node.display_url || '',
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
    post_type: node.is_video ? 'Reel' : node.__typename === 'GraphSidecar' ? 'Carousel' : 'Image',
    url: `https://www.instagram.com/${node.is_video ? 'reel' : 'p'}/${node.shortcode}/`,
    status: 'New',
    likes: Number.isFinite(node.edge_liked_by?.count) ? node.edge_liked_by.count : Number.isFinite(node.edge_media_preview_like?.count) ? node.edge_media_preview_like.count : null,
    comments: Number.isFinite(node.edge_media_to_comment?.count) ? node.edge_media_to_comment.count : null,
    views: Number.isFinite(node.video_view_count) ? node.video_view_count : Number.isFinite(node.video_play_count) ? node.video_play_count : null,
  })).filter((post) => post.id !== 'instagram-undefined' && post.thumbnail && post.url);
}

function findEmbeddedInstagramPayload(value) {
  if (typeof value === 'string') {
    if (!value.includes('shortcode_media')) return null;
    try { return JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  for (const child of Object.values(value)) {
    const found = findEmbeddedInstagramPayload(child);
    if (found) return found;
  }
  return null;
}

function collectShortcodeMedia(value, found = new Map()) {
  if (!value || typeof value !== 'object') return found;
  if (value.shortcode_media?.shortcode) found.set(value.shortcode_media.shortcode, value.shortcode_media);
  for (const child of Object.values(value)) collectShortcodeMedia(child, found);
  return found;
}

async function instagramEmbedData(target) {
  const response = await fetch(`${target.url.replace(/\/$/, '')}/embed/`, {
    headers: { referer: target.url, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  });
  if (!response.ok) throw new Error(`Instagram embed returned HTTP ${response.status} for ${target.handle}.`);
  const html = await response.text();
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const serverScript = scripts.find((body) => body.includes('s.handle(') && body.includes('shortcode_media'));
  if (!serverScript) throw new Error(`Instagram live profile payload was unavailable for ${target.handle}.`);
  const start = serverScript.indexOf('s.handle(') + 's.handle('.length;
  const end = serverScript.indexOf(');requireLazy', start);
  if (end < 0) throw new Error(`Instagram live profile payload was incomplete for ${target.handle}.`);
  let serverPayload;
  try { serverPayload = JSON.parse(serverScript.slice(start, end)); } catch { throw new Error(`Instagram live profile payload was invalid for ${target.handle}.`); }
  const payload = findEmbeddedInstagramPayload(serverPayload);
  if (!payload) throw new Error(`Instagram live posts were unavailable for ${target.handle}.`);
  const context = payload.context || {};
  const media = [...collectShortcodeMedia(payload).values()];
  const posts = media.map((node) => ({
    id: `instagram-${node.shortcode}`,
    company: target.company,
    platform: 'Instagram',
    published_at: node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000).toISOString() : '',
    thumbnail: node.display_url || node.thumbnail_src || '',
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
    post_type: node.is_video ? 'Reel' : node.__typename === 'GraphSidecar' ? 'Carousel' : 'Image',
    url: `https://www.instagram.com/${node.is_video ? 'reel' : 'p'}/${node.shortcode}/`,
    status: 'New',
    likes: Number.isFinite(node.edge_liked_by?.count) ? node.edge_liked_by.count : Number.isFinite(node.edge_media_preview_like?.count) ? node.edge_media_preview_like.count : null,
    comments: Number.isFinite(node.edge_media_to_comment?.count) ? node.edge_media_to_comment.count : null,
    views: Number.isFinite(node.video_view_count) ? node.video_view_count : Number.isFinite(node.video_play_count) ? node.video_play_count : null,
    source_verified_at: new Date().toISOString(),
  })).filter((post) => post.published_at && post.thumbnail && post.url);
  if (!posts.length) throw new Error(`Instagram returned no dated live posts for ${target.handle}.`);
  const owner = media[0]?.owner || {};
  const profile = {
    company: target.company,
    platform: 'Instagram',
    username: context.username || owner.username || target.handle,
    display_name: context.full_name || target.company,
    profile_picture_url: context.profile_pic_url || owner.profile_pic_url || '',
    followers: Number.isFinite(context.followers_count) ? context.followers_count : Number.isFinite(owner.edge_followed_by?.count) ? owner.edge_followed_by.count : null,
    total_posts: Number.isFinite(context.posts_count) ? context.posts_count : Number.isFinite(owner.edge_owner_to_timeline_media?.count) ? owner.edge_owner_to_timeline_media.count : null,
    verified: Boolean(context.verified || context.is_verified || owner.is_verified),
    profile_url: target.url,
    captured_at: new Date().toISOString(),
  };
  return { profile, posts };
}

function instagramFeedPost(target, item) {
  const code = item?.code || '';
  const image = item?.image_versions2?.candidates?.[0]?.url
    || item?.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url
    || item?.display_uri
    || '';
  const isVideo = item?.media_type === 2 || item?.product_type === 'clips';
  return {
    id: `instagram-${code}`,
    company: target.company,
    platform: 'Instagram',
    published_at: item?.taken_at ? new Date(item.taken_at * 1000).toISOString() : '',
    thumbnail: image,
    caption: item?.caption?.text || '',
    post_type: isVideo ? 'Reel' : item?.media_type === 8 ? 'Carousel' : 'Image',
    url: `https://www.instagram.com/${isVideo ? 'reel' : 'p'}/${code}/`,
    status: 'New',
    likes: Number.isFinite(item?.like_count) ? item.like_count : null,
    comments: Number.isFinite(item?.comment_count) ? item.comment_count : null,
    shares: Number.isFinite(item?.reshare_count) ? item.reshare_count : null,
    views: Number.isFinite(item?.play_count) ? item.play_count
      : Number.isFinite(item?.view_count) ? item.view_count
        : Number.isFinite(item?.video_view_count) ? item.video_view_count : null,
    source_verified_at: new Date().toISOString(),
  };
}

async function instagramFeedData(target) {
  const found = new Map();
  let nextMaxId = '';
  let user = null;
  for (let pageNumber = 0; pageNumber < 6; pageNumber += 1) {
    const endpoint = new URL(`https://www.instagram.com/api/v1/feed/user/${target.handle}/username/`);
    endpoint.searchParams.set('count', '18');
    if (nextMaxId) endpoint.searchParams.set('max_id', nextMaxId);
    const response = await fetch(endpoint, {
      headers: {
        'x-ig-app-id': '936619743392459',
        referer: target.url,
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Instagram 300.0.0.0.0',
      },
    });
    if (!response.ok) throw new Error(`Instagram feed returned HTTP ${response.status} for ${target.handle}.`);
    const payload = await response.json();
    if (payload?.status !== 'ok' || !Array.isArray(payload.items)) {
      throw new Error(`Instagram feed returned an invalid payload for ${target.handle}.`);
    }
    user ||= payload.user || null;
    for (const item of payload.items) {
      const post = instagramFeedPost(target, item);
      if (post.id !== 'instagram-' && post.published_at && post.thumbnail) found.set(post.id, post);
    }
    const recentCount = [...found.values()].filter(isRecent).length;
    nextMaxId = payload.more_available ? payload.next_max_id || '' : '';
    if (recentCount >= minimumInstagramPosts || !nextMaxId || !payload.items.length) break;
  }
  const posts = [...found.values()];
  if (posts.filter(isRecent).length < minimumInstagramPosts) {
    throw new Error(`Instagram returned only ${posts.filter(isRecent).length} posts from the last 30 days for ${target.handle}; ${minimumInstagramPosts} are required.`);
  }
  const profile = user ? {
    company: target.company,
    platform: 'Instagram',
    username: user.username || target.handle,
    display_name: user.full_name || target.company,
    profile_picture_url: user.profile_pic_url || '',
    followers: Number.isFinite(user.follower_count) ? user.follower_count : null,
    total_posts: Number.isFinite(user.media_count) ? user.media_count : null,
    verified: Boolean(user.is_verified),
    profile_url: target.url,
    captured_at: new Date().toISOString(),
  } : null;
  return { profile, posts };
}

async function scrapeInstagram(target) {
  const [embed, feed] = await Promise.all([
    instagramEmbedData(target),
    instagramFeedData(target),
  ]);
  collectedProfiles.push({ ...feed.profile, ...embed.profile });
  const posts = new Map(embed.posts.map((post) => [post.id, post]));
  for (const post of feed.posts) posts.set(post.id, { ...posts.get(post.id), ...post });
  return [...posts.values()];
}

async function scrapeX(page, target) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const found = new Map();
  for (let scroll = 0; scroll <= maxScrolls; scroll += 1) {
    const rows = await page.evaluate((arg) => [...document.querySelectorAll('article[data-testid="tweet"]')].map((article) => {
      const cleanText = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const time = article.querySelector('time[datetime]');
      const anchor = time?.closest('a[href*="/status/"]') || article.querySelector('a[href*="/status/"]');
      const href = anchor?.href || '';
      const id = (href.match(/\/status\/(\d+)/) || [])[1] || '';
      const caption = cleanText(article.querySelector('[data-testid="tweetText"]')?.innerText || '');
      const image = [...article.querySelectorAll('img')].find((node) => /pbs\.twimg\.com\/media/.test(node.currentSrc || node.src));
      const metricLabel = (testId) => cleanText(article.querySelector(`[data-testid="${testId}"]`)?.getAttribute('aria-label') || article.querySelector(`[data-testid="${testId}"]`)?.innerText || '');
      const viewsLabel = cleanText([...article.querySelectorAll('a[href*="/analytics"], [aria-label*="views" i]')][0]?.getAttribute('aria-label') || [...article.querySelectorAll('a[href*="/analytics"]')][0]?.innerText || '');
      return { id: `x-${id}`, company: arg.company, platform: 'X', published_at: time?.getAttribute('datetime') || '', thumbnail: image?.currentSrc || image?.src || '', caption, post_type: image ? 'Image' : 'Post', url: href, likes_label: metricLabel('like'), comments_label: metricLabel('reply'), shares_label: metricLabel('retweet'), views_label: viewsLabel, status: 'New' };
    }).filter((post) => post.id !== 'x-' && post.url), target);
    for (const post of rows) found.set(post.id, { ...post, likes: metricNumber(post.likes_label), comments: metricNumber(post.comments_label), shares: metricNumber(post.shares_label), views: metricNumber(post.views_label) });
    if (scroll < maxScrolls) { await page.mouse.wheel(0, 2200); await page.waitForTimeout(1200); }
  }
  return [...found.values()];
}

function tiktokDateFromId(id) {
  try {
    const seconds = Number(BigInt(id) >> 32n);
    const time = seconds * 1000;
    return Number.isFinite(time) && time > 1262304000000 ? new Date(time).toISOString() : '';
  } catch { return ''; }
}

async function enrichTikTokPost(page, post) {
  const detail = await page.context().newPage();
  try {
    await detail.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await detail.waitForTimeout(1800);
    const raw = await detail.evaluate(() => {
      const cleanText = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const body = cleanText(document.body.innerText);
      const meta = document.querySelector('meta[name="description"]')?.content || document.querySelector('meta[property="og:description"]')?.content || '';
      const matchMetric = (name) => (body.match(new RegExp(`([\\d,.]+\\s*[KMB]?)\\s+${name}`, 'i')) || [])[1] || '';
      return { caption: document.querySelector('meta[property="og:description"]')?.content || '', thumbnail: document.querySelector('meta[property="og:image"]')?.content || '', likes_label: matchMetric('likes?'), comments_label: matchMetric('comments?'), views_label: matchMetric('views?'), meta };
    });
    return { ...post, caption: raw.caption || post.caption, thumbnail: raw.thumbnail || post.thumbnail, likes: metricNumber(raw.likes_label), comments: metricNumber(raw.comments_label), views: metricNumber(raw.views_label) ?? post.views };
  } catch { return post; } finally { await detail.close(); }
}

async function scrapeTikTok(page, target) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  const found = new Map();
  for (let scroll = 0; scroll <= maxScrolls; scroll += 1) {
    const rows = await page.evaluate((arg) => [...document.querySelectorAll('a[href*="/video/"]')].map((anchor) => {
      const href = anchor.href || '';
      const id = (href.match(/\/video\/(\d+)/) || [])[1] || '';
      const image = anchor.querySelector('img') || anchor.closest('div')?.querySelector('img');
      const caption = image?.alt || anchor.getAttribute('aria-label') || '';
      const viewsLabel = anchor.querySelector('strong')?.innerText || anchor.closest('[data-e2e]')?.querySelector('strong')?.innerText || '';
      return { id: `tiktok-${id}`, company: arg.company, platform: 'TikTok', thumbnail: image?.currentSrc || image?.src || '', caption, post_type: 'Video', url: href, views_label: viewsLabel, status: 'New' };
    }).filter((post) => post.id !== 'tiktok-' && post.url), target);
    for (const post of rows) found.set(post.id, { ...post, published_at: tiktokDateFromId(post.id.replace('tiktok-', '')), likes: null, comments: null, views: metricNumber(post.views_label) });
    if (scroll < maxScrolls) { await page.mouse.wheel(0, 2400); await page.waitForTimeout(1200); }
  }
  const recent = [...found.values()].filter(isRecent).slice(0, 24);
  const enriched = [];
  for (const post of recent) enriched.push(await enrichTikTokPost(page, post));
  return enriched;
}

const needsBrowser = [...selectedPlatforms].some((platform) => platform !== 'instagram' && platform !== 'facebook');
const browserSession = needsBrowser ? await startBrowserSession() : { context: null, page: null };
const { context, page } = browserSession;
const discovered = [];
const coverage = [];

try {
  if (platformEnabled('Facebook')) {
    if (facebookGraphToken) {
      for (const target of facebookTargets) {
        try {
          const posts = (await scrapeFacebookGraph(target)).filter(isRecent);
          discovered.push(...posts);
          coverage.push({ company: target.company, platform: 'Facebook', count: posts.length, status: posts.length >= minimumFacebookPosts ? 'ok' : `Meta Graph API returned fewer than ${minimumFacebookPosts} posts in the last 30 days.`, source: 'Official Meta Graph API', checked_at: new Date().toISOString() });
        } catch (error) {
          coverage.push({ company: target.company, platform: 'Facebook', count: 0, status: error.message, source: 'Official Meta Graph API', checked_at: new Date().toISOString() });
        }
      }
    } else {
      for (const target of facebookTargets) coverage.push({ company: target.company, platform: 'Facebook', count: 0, status: 'Official Meta Graph API access through Facebook Login is required.', source: 'Official Meta Graph API required', checked_at: new Date().toISOString() });
    }
  }
  if (platformEnabled('Instagram')) {
    for (const target of instagramTargets) {
    try {
      const sourcePosts = await scrapeInstagram(target);
      const posts = sourcePosts.filter(isRecent);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'Instagram', count: posts.length, source_count: sourcePosts.length, newest_source_post_at: sourcePosts.map((post) => post.published_at).filter(Boolean).sort().at(-1) || '', status: posts.length >= minimumInstagramPosts ? 'ok' : `Instagram returned fewer than ${minimumInstagramPosts} posts in the last 30 days.`, source: 'Official Instagram paginated profile feed', checked_at: new Date().toISOString() });
    }
    catch (error) { coverage.push({ company: target.company, platform: 'Instagram', count: 0, status: error.message, source: 'Official Instagram profile embed', checked_at: new Date().toISOString() }); }
    }
  }
  if (platformEnabled('X')) {
    let xLoginStatus = 'ok';
  try { await loginX(page); } catch (error) { xLoginStatus = error.message; }
    for (const target of xTargets) {
    try {
      const posts = (await scrapeX(page, target)).filter(isRecent);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'X', count: posts.length, status: posts.length ? xLoginStatus === 'ok' ? 'ok' : `public profile fallback; authenticated login blocked: ${xLoginStatus}` : xLoginStatus });
    } catch (error) { coverage.push({ company: target.company, platform: 'X', count: 0, status: `${xLoginStatus} ${error.message}` }); }
    }
  }
  if (platformEnabled('TikTok')) {
    let tiktokLoginStatus = 'ok';
  try { await loginTikTok(page); } catch (error) { tiktokLoginStatus = error.message; }
    for (const target of tiktokTargets) {
    try {
      const posts = await scrapeTikTok(page, target);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'TikTok', count: posts.length, status: posts.length ? tiktokLoginStatus === 'ok' ? 'ok' : `public profile fallback; authenticated login blocked: ${tiktokLoginStatus}` : tiktokLoginStatus });
    } catch (error) { coverage.push({ company: target.company, platform: 'TikTok', count: 0, status: `${tiktokLoginStatus} ${error.message}` }); }
    }
  }
} finally {
  if (context) await context.close();
}

const merged = new Map();
let previousData = [];
let previousProfiles = [];
let previousCoverage = [];
let previousInstagramValidation = null;
let previousFacebookValidation = null;
try {
  const previous = JSON.parse(await readFile(dataPath, 'utf8'));
  previousData = Array.isArray(previous.data) ? previous.data : [];
  previousProfiles = Array.isArray(previous.profiles) ? previous.profiles : [];
  previousCoverage = Array.isArray(previous.coverage) ? previous.coverage : [];
  previousInstagramValidation = previous.instagram_validation || null;
  previousFacebookValidation = previous.facebook_validation || null;
} catch {}
const recentDiscovered = discovered.filter(isRecent);
if (requireFacebookCoverage) {
  const missing = facebookTargets.filter((target) => recentDiscovered.filter((post) => post.platform === 'Facebook' && post.company === target.company).length < minimumFacebookPosts);
  if (missing.length) {
    const reasons = coverage.filter((item) => item.platform === 'Facebook' && missing.some((target) => target.company === item.company)).map((item) => `${item.company}: ${item.status} (${item.count || 0} posts)`).join(' | ');
    throw new Error(`Facebook refresh incomplete for ${missing.map((target) => target.company).join(', ')}. ${reasons} The previous snapshot was preserved.`);
  }
}
if (requireInstagramCoverage) {
  const missing = instagramTargets.filter((target) => recentDiscovered.filter((post) => post.platform === 'Instagram' && post.company === target.company).length < minimumInstagramPosts);
  if (missing.length) {
    const reasons = coverage.filter((item) => item.platform === 'Instagram' && missing.some((target) => target.company === item.company)).map((item) => `${item.company}: ${item.status} (source count ${item.source_count || 0}, newest ${item.newest_source_post_at || 'unknown'})`).join(' | ');
    throw new Error(`Instagram refresh incomplete for ${missing.map((target) => target.company).join(', ')}. ${reasons} The previous snapshot was preserved.`);
  }
}
const previousToKeep = recentDiscovered.length ? previousData.filter(isRecent) : previousData;
for (const post of previousToKeep) merged.set(post.id || stableId(`${post.platform}|${post.url}|${post.caption}`), post);
for (const post of recentDiscovered) merged.set(post.id || stableId(`${post.platform}|${post.url}|${post.caption}`), post);
const emptyFetch = !recentDiscovered.length && coverage.length;
const blockedCoverage = coverage.filter((item) => item.status !== 'ok');
const blockedWarning = blockedCoverage.length
  ? `Live organic refresh was partial: ${blockedCoverage.map((item) => `${item.company} ${item.platform}`).join(', ')} need login, are rate-limited, or were blocked by the platform.`
  : '';
const profileMap = new Map(previousProfiles.map((profile) => [`${profile.platform}|${profile.company}`, profile]));
for (const profile of collectedProfiles) profileMap.set(`${profile.platform}|${profile.company}`, profile);
const coverageMap = new Map(previousCoverage.map((item) => [`${item.platform}|${item.company}`, item]));
for (const item of coverage) coverageMap.set(`${item.platform}|${item.company}`, item);
const instagramValidation = instagramTargets.map((target) => {
  const posts = recentDiscovered.filter((post) => post.platform === 'Instagram' && post.company === target.company);
  return {
    company: target.company,
    handle: target.handle,
    count: posts.length,
    newest_post_at: posts.map((post) => post.published_at).filter(Boolean).sort().at(-1) || '',
    minimum_required: minimumInstagramPosts,
    complete: posts.length >= minimumInstagramPosts,
  };
});
const facebookValidation = facebookTargets.map((target) => {
  const posts = recentDiscovered.filter((post) => post.platform === 'Facebook' && post.company === target.company);
  return {
    company: target.company,
    count: posts.length,
    newest_post_at: posts.map((post) => post.published_at).filter(Boolean).sort().at(-1) || '',
    minimum_required: minimumFacebookPosts,
    complete: posts.length >= minimumFacebookPosts,
  };
});

const payload = {
  generated_at: new Date().toISOString(),
  source: `Official ${[...selectedPlatforms].map((platform) => platform === 'x' ? 'Twitter / X' : platform[0].toUpperCase() + platform.slice(1)).join(', ')} live feed with retained 30-day history`,
  coverage: [...coverageMap.values()],
  profiles: [...profileMap.values()],
  fetched_count: recentDiscovered.length,
  mode: emptyFetch && previousData.length ? 'empty_fetch_preserved_previous' : 'live_merged',
  fetch_warning: emptyFetch && previousData.length ? 'Live organic fetch returned no posts, so the previous saved posts were preserved.' : blockedWarning,
  facebook_validation: platformEnabled('Facebook') ? {
    minimum_required_per_account: minimumFacebookPosts,
    complete: facebookValidation.every((item) => item.complete),
    checked_at: new Date().toISOString(),
    accounts: facebookValidation,
  } : previousFacebookValidation || {
    minimum_required_per_account: minimumFacebookPosts,
    complete: false,
    checked_at: '',
    accounts: facebookValidation,
  },
  instagram_validation: platformEnabled('Instagram') ? {
    minimum_required_per_account: minimumInstagramPosts,
    complete: instagramValidation.every((item) => item.complete),
    checked_at: new Date().toISOString(),
    accounts: instagramValidation,
  } : previousInstagramValidation || {
    minimum_required_per_account: minimumInstagramPosts,
    complete: false,
    checked_at: '',
    accounts: instagramValidation,
  },
  window_days: 30,
  data: [...merged.values()].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()),
};
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ fetched: recentDiscovered.length, total: payload.data.length, coverage }, null, 2));
