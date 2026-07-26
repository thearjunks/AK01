import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'social-posts.json');
const maxScrolls = Math.max(3, Number(process.env.ORGANIC_MAX_SCROLLS || 20));
const email = process.env.SOCIAL_FACEBOOK_EMAIL || '';
const password = process.env.SOCIAL_FACEBOOK_PASSWORD || '';
const instagramEmail = process.env.SOCIAL_INSTAGRAM_EMAIL || email;
const instagramPassword = process.env.SOCIAL_INSTAGRAM_PASSWORD || password;
const xEmail = process.env.SOCIAL_X_EMAIL || '';
const xPassword = process.env.SOCIAL_X_PASSWORD || '';
const tiktokEmail = process.env.SOCIAL_TIKTOK_EMAIL || '';
const tiktokPassword = process.env.SOCIAL_TIKTOK_PASSWORD || '';
const authProfileDir = process.env.SOCIAL_BROWSER_PROFILE_DIR || path.join(root, '.auth', 'social-browser');
const instagramDetailLimit = Math.max(0, Number(process.env.INSTAGRAM_DETAIL_LIMIT || 18));
const browserOptions = {
  headless: process.env.SOCIAL_BROWSER_VISIBLE === '1' ? false : true,
  viewport: { width: 1440, height: 1100 },
  locale: 'en-US',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
};

const facebookTargets = [
  { company: 'stc Kuwait', name: 'stc Kuwait', url: 'https://www.facebook.com/stc.kwt/' },
  { company: 'Ooredoo Kuwait', name: 'Ooredoo Kuwait', url: 'https://www.facebook.com/OoredooKuwait' },
  { company: 'Zain Kuwait', name: 'Zain Kuwait', url: 'https://www.facebook.com/zainkuwait' },
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

function isRecent(post, now = Date.now()) {
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

async function loginFacebook(page) {
  if (!email || !password) throw new Error('Facebook email and password are required.');
  let emailField;
  let passwordField;
  for (const loginUrl of ['https://www.facebook.com/login/', 'https://m.facebook.com/login/']) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1200);
    emailField = page.locator('input[name="email"], input#email').first();
    passwordField = page.locator('input[name="pass"], input#pass').first();
    if (await emailField.count() && await passwordField.count()) break;
  }
  if (!emailField || !(await emailField.count())) {
    if (!/login/i.test(page.url())) return;
    throw new Error(`Facebook login form was unavailable at ${page.url()}.`);
  }
  await emailField.fill(email);
  await passwordField.fill(password);
  await passwordField.press('Enter');
  await page.waitForTimeout(6000);
  if (/login|checkpoint|two_step_verification/i.test(page.url())) {
    throw new Error('Facebook login requires correction or an interactive security check. Run LOGIN SOCIAL ACCOUNTS.cmd once, complete the browser login, then fetch again.');
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

async function visibleFacebookPosts(page, target) {
  return page.evaluate((arg) => {
    const clean = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const headings = [...document.querySelectorAll('h2')].filter((heading) => clean(heading.innerText).toLowerCase().includes(arg.name.toLowerCase()));
    return headings.map((heading, index) => {
      let card = heading;
      for (let depth = 0; depth < 8 && card; depth += 1) card = card.parentElement;
      if (!card) return null;
      const invalid = (text) => !text || text.length < 20 || text.length > 900 || text.includes('Write a comment') || text.includes('Online status') || text.startsWith('Facebook') || text.startsWith('Photos from') || text.startsWith('m.me') || text.includes('Rate this translation') || /^(?:[A-Za-z0-9] ){15}/.test(text) || /^[A-Za-z0-9 ]{45,}$/.test(text);
      const candidates = [...new Set([...card.querySelectorAll('div,span')].map((element) => clean(element.innerText)).filter((text) => !invalid(text)))].map((text) => text.replace(/\s*See translation\s*$/i, '').replace(/\s*See more\s*$/i, '').trim());
      const score = (text) => (/\p{L}/u.test(text) ? 40 : 0) + (/[\u0600-\u06ff]/.test(text) ? 25 : 0) + Math.min(text.length, 450) - (text.includes(arg.name) ? 100 : 0);
      const caption = candidates.sort((a, b) => score(b) - score(a))[0] || '';
      const images = [...new Set([...card.querySelectorAll('img')].filter((image) => (image.currentSrc || image.src) && !(image.currentSrc || image.src).startsWith('data:') && image.naturalWidth >= 180).map((image) => image.currentSrc || image.src))];
      const hrefs = [...new Set([...card.querySelectorAll('a[href]')].map((anchor) => anchor.href))];
      const publishedLabel = [...new Set([...card.querySelectorAll('a,span,abbr')].map((element) => clean(element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '')).filter((text) => /^(Just now|Yesterday|\d+\s*(?:m|h|d|w|mo|y)\b|\d+\s+(?:min|mins|hr|hrs|hour|hours|day|days|week|weeks|month|months|year|years)\b)/i.test(text)))][0] || '';
      const dateNode = card.querySelector('[data-utime], time[datetime], abbr[title]');
      const unixTime = Number(dateNode?.getAttribute('data-utime') || 0);
      const publishedAt = unixTime ? new Date(unixTime * 1000).toISOString() : dateNode?.getAttribute('datetime') || '';
      let url = hrefs.find((href) => /facebook\.com\/photo\/\?fbid=/.test(href)) || hrefs.find((href) => /facebook\.com\/.+\/(?:posts|videos|reel)\//.test(href)) || '';
      if (url.includes('/photo/')) { try { const parsed = new URL(url); url = `${parsed.origin}${parsed.pathname}?fbid=${parsed.searchParams.get('fbid')}${parsed.searchParams.get('set') ? `&set=${parsed.searchParams.get('set')}` : ''}`; } catch {} }
      const id = (url.match(/set=pcb\.(\d+)/) || url.match(/fbid=(\d+)/) || url.match(/\/(\d{8,})\/?/) || [])[1] || '';
      if (!caption || (!url && !images.length)) return null;
      const cardText = clean(card.innerText);
      const metric = (pattern) => clean((cardText.match(pattern) || [])[1] || '');
      return { id, caption, thumbnail: images[0] || '', post_type: images.length > 1 ? 'Carousel' : images.length === 1 ? 'Image' : 'Post', url: url || arg.url, index, published_label: publishedLabel, published_at: publishedAt,
        likes_label: metric(/([\d,.]+\s*[KMB]?)\s+(?:likes?|reactions?)/i), comments_label: metric(/([\d,.]+\s*[KMB]?)\s+comments?/i), shares_label: metric(/([\d,.]+\s*[KMB]?)\s+shares?/i), views_label: metric(/([\d,.]+\s*[KMB]?)\s+views?/i) };
    }).filter(Boolean);
  }, target);
}

async function scrapeFacebook(page, target) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4500);
  const found = new Map();
  for (let scroll = 0; scroll <= maxScrolls; scroll += 1) {
    for (const post of await visibleFacebookPosts(page, target)) {
      const id = post.id || stableId(`${target.company}|${post.url}|${post.caption}`);
      found.set(`facebook-${id}`, { ...post, id: `facebook-${id}`, company: target.company, platform: 'Facebook', published_at: post.published_at || relativeDate(post.published_label), likes: metricNumber(post.likes_label), comments: metricNumber(post.comments_label), shares: metricNumber(post.shares_label), views: metricNumber(post.views_label), status: 'New' });
    }
    if (scroll < maxScrolls) { await page.mouse.wheel(0, 2400); await page.waitForTimeout(1400); }
  }
  return [...found.values()];
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

async function instagramApiPosts(request, target) {
  const response = await request.get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(target.handle)}`, {
    headers: { 'x-ig-app-id': '936619743392459', referer: target.url, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
    timeout: 30000,
  });
  if (!response.ok()) throw new Error(`Instagram public API returned HTTP ${response.status()} for ${target.handle}.`);
  const payload = await response.json();
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

async function instagramEmbedProfile(request, target) {
  const response = await fetch(`${target.url.replace(/\/$/, '')}/embed/`, {
    headers: { referer: target.url, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  });
  if (!response.ok) throw new Error(`Instagram embed returned HTTP ${response.status} for ${target.handle}.`);
  let html = await response.text();
  for (let pass = 0; pass < 3; pass += 1) html = html.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
  const value = (field) => (html.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`)) || [])[1] || '';
  const count = (field) => {
    const parsed = Number((html.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`)) || [])[1]);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    company: target.company,
    platform: 'Instagram',
    username: value('username') || target.handle,
    display_name: value('full_name') || target.company,
    profile_picture_url: value('profile_pic_url'),
    followers: count('followers_count'),
    total_posts: count('posts_count'),
    verified: /"(?:verified|is_verified)"\s*:\s*true/.test(html),
    profile_url: target.url,
    captured_at: new Date().toISOString(),
  };
}

async function scrapeInstagram(page, request, target, { renderProfile = true } = {}) {
  const found = new Map();
  const errors = [];
  try { collectedProfiles.push(await instagramEmbedProfile(request, target)); } catch (error) { errors.push(error.message); }
  try { for (const post of await instagramApiPosts(request, target)) found.set(post.id, post); } catch (error) { errors.push(error.message); }
  if (!renderProfile) {
    if (!found.size && errors.length) throw new Error(errors.join(' '));
    return [...found.values()];
  }
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);
    const blocked = await page.evaluate(() => /Page couldn't load|Something went wrong|issue and the page could not be loaded/i.test(`${document.title}\n${document.body.innerText}`));
    if (blocked) errors.push(`Instagram profile page did not load for ${target.handle}.`);
  } catch (error) {
    errors.push(`Instagram profile page failed for ${target.handle}: ${error.message}`);
  }
  for (let scroll = 0; scroll <= maxScrolls; scroll += 1) {
    for (const post of await visibleInstagramPosts(page, target)) found.set(post.id, post);
    if (scroll < maxScrolls) { await page.mouse.wheel(0, 2200); await page.waitForTimeout(1300); }
  }
  const posts = [...found.values()];
  if (!posts.length && errors.length) throw new Error(errors.join(' '));
  const enriched = [];
  for (const post of posts.slice(0, instagramDetailLimit)) enriched.push(await enrichInstagramPost(page, post));
  return [...enriched, ...posts.slice(instagramDetailLimit)];
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

const { context, page } = await startBrowserSession();
const discovered = [];
const coverage = [];

try {
  let facebookLoginStatus = 'ok';
  try {
    await loginFacebook(page);
  } catch (error) {
    facebookLoginStatus = error.message;
  }
  for (const target of facebookTargets) {
    try {
      const posts = (await scrapeFacebook(page, target)).filter(isRecent);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'Facebook', count: posts.length, status: posts.length ? facebookLoginStatus === 'ok' ? 'ok' : `public profile fallback; authenticated login blocked: ${facebookLoginStatus}` : facebookLoginStatus });
    } catch (error) { coverage.push({ company: target.company, platform: 'Facebook', count: 0, status: `${facebookLoginStatus} ${error.message}` }); }
  }
  let instagramLoginStatus = 'ok';
  try {
    await loginInstagram(page);
  } catch (error) {
    instagramLoginStatus = error.message;
  }
  for (const target of instagramTargets) {
    try {
      const posts = (await scrapeInstagram(page, context.request, target, { renderProfile: instagramLoginStatus === 'ok' })).filter(isRecent);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'Instagram', count: posts.length, status: posts.length ? instagramLoginStatus === 'ok' ? 'ok' : `public API ok; profile page skipped: ${instagramLoginStatus}` : instagramLoginStatus === 'ok' ? 'No Instagram posts were exposed to the collector.' : instagramLoginStatus });
    }
    catch (error) { coverage.push({ company: target.company, platform: 'Instagram', count: 0, status: error.message }); }
  }
  let xLoginStatus = 'ok';
  try { await loginX(page); } catch (error) { xLoginStatus = error.message; }
  for (const target of xTargets) {
    try {
      const posts = (await scrapeX(page, target)).filter(isRecent);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'X', count: posts.length, status: posts.length ? xLoginStatus === 'ok' ? 'ok' : `public profile fallback; authenticated login blocked: ${xLoginStatus}` : xLoginStatus });
    } catch (error) { coverage.push({ company: target.company, platform: 'X', count: 0, status: `${xLoginStatus} ${error.message}` }); }
  }
  let tiktokLoginStatus = 'ok';
  try { await loginTikTok(page); } catch (error) { tiktokLoginStatus = error.message; }
  for (const target of tiktokTargets) {
    try {
      const posts = await scrapeTikTok(page, target);
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'TikTok', count: posts.length, status: posts.length ? tiktokLoginStatus === 'ok' ? 'ok' : `public profile fallback; authenticated login blocked: ${tiktokLoginStatus}` : tiktokLoginStatus });
    } catch (error) { coverage.push({ company: target.company, platform: 'TikTok', count: 0, status: `${tiktokLoginStatus} ${error.message}` }); }
  }
} finally {
  await context.close();
}

const merged = new Map();
let previousData = [];
let previousProfiles = [];
try {
  const previous = JSON.parse(await readFile(dataPath, 'utf8'));
  previousData = Array.isArray(previous.data) ? previous.data : [];
  previousProfiles = Array.isArray(previous.profiles) ? previous.profiles : [];
} catch {}
const recentDiscovered = discovered.filter(isRecent);
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

const payload = {
  generated_at: new Date().toISOString(),
  source: 'Authenticated 30-day organic monitor for Facebook, Instagram, X, and TikTok',
  coverage,
  profiles: [...profileMap.values()],
  fetched_count: recentDiscovered.length,
  mode: emptyFetch && previousData.length ? 'empty_fetch_preserved_previous' : 'live_merged',
  fetch_warning: emptyFetch && previousData.length ? 'Live organic fetch returned no posts, so the previous saved posts were preserved.' : blockedWarning,
  window_days: 30,
  data: [...merged.values()].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()),
};
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ fetched: recentDiscovered.length, total: payload.data.length, coverage }, null, 2));
