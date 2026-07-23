import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { socialCredentials } from './social-credentials.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'social-posts.json');
const maxScrolls = Math.max(3, Number(process.env.ORGANIC_MAX_SCROLLS || 20));
const email = process.env.SOCIAL_FACEBOOK_EMAIL || socialCredentials.facebook.email;
const password = process.env.SOCIAL_FACEBOOK_PASSWORD || socialCredentials.facebook.password;
const instagramEmail = process.env.SOCIAL_INSTAGRAM_EMAIL || email;
const instagramPassword = process.env.SOCIAL_INSTAGRAM_PASSWORD || password;
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
const instagramHandleCompanies = new Map(instagramTargets.map((target) => [target.handle.toLowerCase(), target.company]));
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
      let url = hrefs.find((href) => /facebook\.com\/photo\/\?fbid=/.test(href)) || hrefs.find((href) => /facebook\.com\/.+\/(?:posts|videos|reel)\//.test(href)) || '';
      if (url.includes('/photo/')) { try { const parsed = new URL(url); url = `${parsed.origin}${parsed.pathname}?fbid=${parsed.searchParams.get('fbid')}${parsed.searchParams.get('set') ? `&set=${parsed.searchParams.get('set')}` : ''}`; } catch {} }
      const id = (url.match(/set=pcb\.(\d+)/) || url.match(/fbid=(\d+)/) || url.match(/\/(\d{8,})\/?/) || [])[1] || '';
      if (!caption || (!url && !images.length)) return null;
      return { id, caption, thumbnail: images[0] || '', post_type: images.length > 1 ? 'Carousel' : images.length === 1 ? 'Image' : 'Post', url: url || arg.url, index, published_label: publishedLabel };
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
      found.set(`facebook-${id}`, { ...post, id: `facebook-${id}`, company: target.company, platform: 'Facebook', published_at: '', status: 'New' });
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
    return await detailPage.evaluate((input) => {
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
      };
    }, post);
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
  const edges = payload?.data?.user?.edge_owner_to_timeline_media?.edges || [];
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
  })).filter((post) => post.id !== 'instagram-undefined' && post.thumbnail && post.url);
}

async function scrapeInstagram(page, request, target, { renderProfile = true } = {}) {
  const found = new Map();
  const errors = [];
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

const { context, page } = await startBrowserSession();
const discovered = [];
const coverage = [];

try {
  try {
    const posts = await scrapeInstagramDirectPosts();
    discovered.push(...posts);
    coverage.push({ company: 'Seeded Instagram URLs', platform: 'Instagram', count: posts.length, status: posts.length ? 'ok' : 'No seeded Instagram post URLs were exposed.' });
  } catch (error) {
    coverage.push({ company: 'Seeded Instagram URLs', platform: 'Instagram', count: 0, status: error.message });
  }
  try {
    await loginFacebook(page);
    for (const target of facebookTargets) {
      try { const posts = await scrapeFacebook(page, target); discovered.push(...posts); coverage.push({ company: target.company, platform: 'Facebook', count: posts.length, status: 'ok' }); }
      catch (error) { coverage.push({ company: target.company, platform: 'Facebook', count: 0, status: error.message }); }
    }
  } catch (error) {
    facebookTargets.forEach((target) => coverage.push({ company: target.company, platform: 'Facebook', count: 0, status: error.message }));
  }
  let instagramLoginStatus = 'ok';
  try {
    await loginInstagram(page);
  } catch (error) {
    instagramLoginStatus = error.message;
  }
  for (const target of instagramTargets) {
    try {
      const posts = await scrapeInstagram(page, context.request, target, { renderProfile: instagramLoginStatus === 'ok' });
      discovered.push(...posts);
      coverage.push({ company: target.company, platform: 'Instagram', count: posts.length, status: posts.length ? instagramLoginStatus === 'ok' ? 'ok' : `public API ok; profile page skipped: ${instagramLoginStatus}` : instagramLoginStatus === 'ok' ? 'No Instagram posts were exposed to the collector.' : instagramLoginStatus });
    }
    catch (error) { coverage.push({ company: target.company, platform: 'Instagram', count: 0, status: error.message }); }
  }
} finally {
  await context.close();
}

const merged = new Map();
let previousData = [];
try {
  const previous = JSON.parse(await readFile(dataPath, 'utf8'));
  previousData = Array.isArray(previous.data) ? previous.data : [];
} catch {}
for (const post of previousData) merged.set(post.id || stableId(`${post.platform}|${post.url}|${post.caption}`), post);
for (const post of discovered) merged.set(post.id || stableId(`${post.platform}|${post.url}|${post.caption}`), post);
const emptyFetch = !discovered.length && coverage.length;
const blockedCoverage = coverage.filter((item) => item.status !== 'ok' && item.company !== 'Seeded Instagram URLs');
const blockedWarning = blockedCoverage.length
  ? `Live organic refresh was partial: ${blockedCoverage.map((item) => `${item.company} ${item.platform}`).join(', ')} need login, are rate-limited, or were blocked by the platform.`
  : '';

const payload = {
  generated_at: new Date().toISOString(),
  source: 'Live organic collector: authenticated Facebook pages and public Instagram profiles',
  coverage,
  fetched_count: discovered.length,
  mode: emptyFetch && previousData.length ? 'empty_fetch_preserved_previous' : 'live_merged',
  fetch_warning: emptyFetch && previousData.length ? 'Live organic fetch returned no posts, so the previous saved posts were preserved.' : blockedWarning,
  data: [...merged.values()],
};
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ fetched: discovered.length, total: payload.data.length, coverage }, null, 2));
