import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'plans.json');
const bannerDir = path.join(root, 'public', 'plan-banners');
const maxCardsPerPage = Number(process.env.PLAN_MAX_CARDS_PER_PAGE || 36);
const maxBannersPerPage = Number(process.env.PLAN_MAX_BANNERS_PER_PAGE || 8);
const headless = process.env.PLAN_HEADLESS !== '0';

const brands = {
  stc: { name: 'stc Kuwait', color: '#4f008c', logo: 'https://www.stc.com.kw/cdn/images/stc_logo_5776f67ce8.webp' },
  ooredoo: { name: 'Ooredoo Kuwait', color: '#ed1c24', logo: 'https://ooredoo.com.kw/documents/d/guest/ooredoo-logo' },
  zain: { name: 'Zain Kuwait', color: '#00a651', logo: 'https://www.kw.zain.com/o/zain-theme/images/zain_logo.svg' },
};

const sources = [
  { provider: 'stc', category: 'Prepaid', url: 'https://www.stc.com.kw/en/prepaid-plans' },
  { provider: 'ooredoo', category: 'Prepaid', url: 'https://www.ooredoo.com.kw/en/prepaid-mobile' },
  { provider: 'zain', category: 'Prepaid', url: 'https://www.kw.zain.com/en/shop/eezee-plans' },
  { provider: 'stc', category: 'Postpaid', url: 'https://www.stc.com.kw/en/postpaid-plans' },
  { provider: 'ooredoo', category: 'Postpaid', url: 'https://www.ooredoo.com.kw/en/postpaid-mobile' },
  { provider: 'zain', category: 'Postpaid', url: 'https://www.kw.zain.com/en/shop/wiyana' },
  { provider: 'stc', category: 'Postpaid Internet', url: 'https://www.stc.com.kw/en/postpaid-internet-plans' },
  { provider: 'ooredoo', category: 'Postpaid Internet', url: 'https://ooredoo.com.kw/en/postpaid-internet' },
  { provider: 'zain', category: 'Postpaid Internet', url: 'https://www.kw.zain.com/en/shop/5g-internet-plans' },
  { provider: 'zain', category: 'Roaming', url: 'https://www.kw.zain.com/en/shop/roaming' },
  { provider: 'ooredoo', category: 'Roaming', url: 'https://ooredoo.com.kw/en/roaming' },
  { provider: 'stc', category: 'Roaming', subCategory: 'Roaming plans', url: 'https://www.stc.com.kw/en/roaming-bundles' },
  { provider: 'stc', category: 'Roaming', subCategory: 'Europe plans', url: 'https://www.stc.com.kw/en/roaming-bundles-europe' },
  { provider: 'stc', category: 'Roaming', subCategory: 'Global plans', url: 'https://www.stc.com.kw/en/roaming-bundles-global' },
  { provider: 'stc', category: 'Roaming', subCategory: 'Turkey plans', url: 'https://www.stc.com.kw/en/roaming-bundles-turkey' },
];

const bannerSources = [
  { provider: 'stc', category: 'Homepage Offers', url: 'https://www.stc.com.kw/en', method: 'Rendered STC homepage DOM/CDN assets' },
  { provider: 'ooredoo', category: 'Homepage Carousel', url: 'https://ooredoo.com.kw/en/', method: 'Rendered Ooredoo carousel DOM' },
  { provider: 'ooredoo', category: 'Offer Banners', url: 'https://ooredoo.com.kw/o/headless-delivery/v1.0/sites/20117/structured-contents/by-key/105294', method: 'Liferay Headless Delivery API' },
  { provider: 'zain', category: 'Homepage Hero', url: 'https://www.kw.zain.com/en/shop', method: 'Rendered Zain hero carousel DOM' },
  { provider: 'zain', category: 'Offers News More', url: 'https://www.kw.zain.com/en/shop', method: 'Rendered Zain offers/news DOM' },
];

function stableId(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 18);
}

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function priceFromText(text) {
  const normalized = clean(text);
  const match = normalized.match(/(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/i);
  return match ? match[0].replace(/\s+/g, ' ') : '';
}

function parseLines(text) {
  return String(text || '')
    .split(/\r?\n|(?<=\bKD|\bKWD|د\.ك)\s+/i)
    .map(clean)
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .filter((line) => !/^(buy now|subscribe|learn more|view details|add to cart|shop now|select|order now)$/i.test(line));
}

function titleFromLines(lines, category) {
  return lines.find((line) => !priceFromText(line) && !/^(prepaid|postpaid|internet|roaming|plans?|home)$/i.test(line) && line.length <= 90)
    || lines.find((line) => !priceFromText(line) && line.length <= 120)
    || `${category} plan`;
}

function benefitsFromLines(lines, title, price) {
  return lines
    .filter((line) => line !== title && line !== price)
    .filter((line) => !priceFromText(line) || /GB|minutes|mins|calls|internet|data|roaming|valid|days|5G|unlimited/i.test(line))
    .slice(0, 7);
}

function imageExtension(url, contentType = '') {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname);
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) return ext;
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  return '.jpg';
}

async function saveBannerAsset(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      },
    });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) return '';
    const fileName = `${stableId(url)}${imageExtension(url, contentType)}`;
    await mkdir(bannerDir, { recursive: true });
    await writeFile(path.join(bannerDir, fileName), Buffer.from(await response.arrayBuffer()));
    return `/plan-banners/${fileName}`;
  } catch {
    return '';
  }
}

async function saveBannerScreenshot(locator, key) {
  try {
    const fileName = `${stableId(key)}.png`;
    await mkdir(bannerDir, { recursive: true });
    await locator.screenshot({ path: path.join(bannerDir, fileName), timeout: 15000 });
    return `/plan-banners/${fileName}`;
  } catch {
    return '';
  }
}

function absoluteUrl(base, value) {
  if (!value) return '';
  return new URL(value, base).href;
}

async function bannerFromImage({ provider, category, subCategory = '', title, text = '', imageUrl, mobileImageUrl = '', linkUrl = '', sourceUrl, sourceMethod, apiUrl = '' }) {
  const key = clean(`${provider}|${category}|${imageUrl}|${text}|${linkUrl}`).toLowerCase();
  return {
    id: stableId(key),
    provider,
    provider_name: brands[provider].name,
    logo: brands[provider].logo,
    color: brands[provider].color,
    category,
    sub_category: subCategory,
    title: clean(title) || clean(text).slice(0, 90) || `${category} banner`,
    text: clean(text),
    image_url: imageUrl,
    mobile_image_url: mobileImageUrl,
    local_image_url: await saveBannerAsset(imageUrl),
    link_url: linkUrl,
    source_url: sourceUrl,
    source_method: sourceMethod,
    api_url: apiUrl,
  };
}

async function fetchOoredooOfferApiBanners() {
  const source = bannerSources.find((item) => item.provider === 'ooredoo' && item.method.includes('Headless'));
  const response = await fetch(source.url, { headers: { accept: 'application/json', 'accept-language': 'en-US' } });
  if (!response.ok) throw new Error(`Ooredoo offer API returned HTTP ${response.status}`);
  const data = await response.json();
  const banners = [];
  for (const field of data.contentFields || []) {
    let web = null;
    let mobile = null;
    let linkUrl = '';
    for (const nested of field.nestedContentFields || []) {
      const value = nested.contentFieldValue || {};
      const image = value.image;
      if (image && /web/i.test(nested.label || nested.name || '')) web = image;
      if (image && /responsive|mobile/i.test(nested.label || nested.name || '')) mobile = image;
      if (value.data) linkUrl = value.data;
    }
    if (!web?.contentUrl) continue;
    banners.push(await bannerFromImage({
      provider: source.provider,
      category: source.category,
      title: web.description || web.title || field.name,
      text: web.description || web.title || '',
      imageUrl: absoluteUrl(source.url, web.contentUrl),
      mobileImageUrl: absoluteUrl(source.url, mobile?.contentUrl || ''),
      linkUrl,
      sourceUrl: 'https://ooredoo.com.kw/en/',
      sourceMethod: source.method,
      apiUrl: source.url,
    }));
  }
  return banners;
}

async function scrapeHomepageBanners(browser, source) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6500);
  const denied = await page.locator('body').innerText().then((text) => /Access Denied/i.test(text)).catch(() => false);
  if (denied) {
    await context.close();
    throw new Error(`${source.provider} homepage returned Access Denied`);
  }
  await page.mouse.wheel(0, 1200).catch(() => {});
  await page.waitForTimeout(1200);
  const rows = await page.evaluate((sourceInfo) => {
    const cleanText = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const bestImage = (node) => {
      const sources = [...node.querySelectorAll('source')].map((item) => item.srcset || item.getAttribute('srcset')).filter(Boolean);
      const imgs = [...node.querySelectorAll('img')].map((item) => item.currentSrc || item.src).filter(Boolean);
      return [...sources, ...imgs].find((src) => src && !/logo|icon|sprite|favicon/i.test(src)) || '';
    };
    const mobileImage = (node) => [...node.querySelectorAll('img')].map((item) => item.currentSrc || item.src).find(Boolean) || '';
    const link = (node) => node.closest('a[href]')?.href || node.querySelector('a[href]')?.href || '';
    const out = [];
    if (sourceInfo.provider === 'stc') {
      const selectors = [
        '[class*="StcCarouselHero"]',
        '[class*="StcOfferCarousal"] [class*="carouselItem"]',
        '[class*="StcCardImage"]',
      ];
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          const image = bestImage(node);
          if (!image) continue;
          const text = cleanText(node.innerText);
          out.push({ image, mobileImage: mobileImage(node), text, title: text.split(' ').slice(0, 12).join(' '), link: link(node) });
        }
      }
    }
    if (sourceInfo.provider === 'ooredoo') {
      for (const node of document.querySelectorAll('#banner .carousel-item, .carousel-item')) {
        const image = bestImage(node);
        if (!image) continue;
        const text = cleanText(node.innerText || node.querySelector('img')?.alt || '');
        out.push({ image, mobileImage: mobileImage(node), text, title: node.querySelector('img')?.alt || text || 'Ooredoo carousel banner', link: link(node) });
      }
    }
    if (sourceInfo.provider === 'zain') {
      const selector = sourceInfo.category.includes('Hero') ? '.slide.slick-slide' : '.z-card.z-card-whats-new';
      for (const node of document.querySelectorAll(selector)) {
        const image = bestImage(node);
        if (!image) continue;
        const text = cleanText(node.innerText || node.querySelector('img')?.alt || '');
        out.push({ image, mobileImage: mobileImage(node), text, title: node.querySelector('img')?.alt || text || 'Zain banner', link: link(node) });
      }
    }
    const seen = new Set();
    return out.filter((item) => {
      const key = `${item.image}|${item.text}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 18);
  }, source);
  await context.close();
  const banners = [];
  for (const row of rows) {
    banners.push(await bannerFromImage({
      provider: source.provider,
      category: source.category,
      title: row.title,
      text: row.text,
      imageUrl: absoluteUrl(source.url, row.image),
      mobileImageUrl: absoluteUrl(source.url, row.mobileImage),
      linkUrl: absoluteUrl(source.url, row.link),
      sourceUrl: source.url,
      sourceMethod: source.method,
      apiUrl: '',
    }));
  }
  return banners;
}

async function collectTargetedBanners(browser) {
  const banners = [];
  const coverage = [];
  for (const source of bannerSources) {
    try {
      console.log(`Fetching banners: ${brands[source.provider].name} ${source.category}...`);
      const rows = source.method.includes('Headless')
        ? await fetchOoredooOfferApiBanners()
        : await scrapeHomepageBanners(browser, source);
      banners.push(...rows);
      coverage.push({ provider: source.provider, category: source.category, count: rows.length, status: rows.length ? 'ok' : 'No banners found.', source: source.method, api_url: source.method.includes('Headless') ? source.url : '' });
    } catch (error) {
      coverage.push({ provider: source.provider, category: source.category, count: 0, status: error.message, source: source.method, api_url: source.method.includes('Headless') ? source.url : '' });
    }
  }
  const deduped = new Map();
  for (const banner of banners) deduped.set(banner.id, banner);
  return { banners: [...deduped.values()], coverage };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless });
  } catch {
    return chromium.launch({ headless });
  }
}

async function scrapeSource(browser, source) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  for (let scroll = 0; scroll < 8; scroll += 1) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(800);
  }

  const rawCards = await page.evaluate(() => {
    const cleanText = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
    const nodes = [...document.querySelectorAll('article, section, li, div, tr')]
      .filter((node) => /(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/i.test(node.innerText || ''))
      .map((node) => {
        let card = node;
        for (let depth = 0; depth < 3 && card.parentElement; depth += 1) {
          const currentText = cleanText(card.innerText);
          const parentText = cleanText(card.parentElement.innerText);
          if (parentText.length > 1300 || (parentText.match(/(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/gi) || []).length > 3) break;
          if (parentText.length > currentText.length) card = card.parentElement;
        }
        const text = cleanText(card.innerText);
        const href = [...card.querySelectorAll('a[href]')].map((anchor) => anchor.href).find((hrefValue) => !hrefValue.startsWith('javascript:')) || location.href;
        return { text, href };
      })
      .filter((item) => item.text.length >= 15 && item.text.length <= 1300);
    const seen = new Set();
    return nodes.filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80);
  });

  const plans = [];
  const seen = new Set();
  for (const raw of rawCards) {
    const price = priceFromText(raw.text);
    if (!price) continue;
    const lines = parseLines(raw.text);
    const title = titleFromLines(lines, source.category);
    const benefits = benefitsFromLines(lines, title, price);
    const key = clean(`${source.provider}|${source.category}|${title}|${price}|${benefits.join('|')}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    plans.push({
      id: stableId(key),
      provider: source.provider,
      provider_name: brands[source.provider].name,
      logo: brands[source.provider].logo,
      color: brands[source.provider].color,
      category: source.category,
      sub_category: source.subCategory || '',
      title,
      price,
      benefits,
      source_url: source.url,
      detail_url: raw.href,
      captured_text: raw.text.slice(0, 1200),
    });
  }
  await context.close();
  return { plans: plans.slice(0, maxCardsPerPage) };
}

let previousData = [];
let previousBanners = [];
try {
  const previousPayload = JSON.parse(await readFile(dataPath, 'utf8'));
  previousData = (previousPayload.data || []).filter((item) => item.category !== 'Home');
  previousBanners = (previousPayload.banners || []).filter((item) => item.category !== 'Home');
} catch {}

const browser = await launchBrowser();
const data = [];
const coverage = [];
let bannerResult = { banners: [], coverage: [] };
try {
  for (const source of sources) {
    try {
      console.log(`Scraping ${brands[source.provider].name} ${source.category}...`);
      const result = await scrapeSource(browser, source);
      const plans = result.plans || [];
      data.push(...plans);
      coverage.push({ provider: source.provider, category: source.category, count: plans.length, status: plans.length ? 'ok' : 'No priced plan cards were exposed.' });
    } catch (error) {
      coverage.push({ provider: source.provider, category: source.category, count: 0, status: error.message });
    }
  }
  bannerResult = await collectTargetedBanners(browser);
} finally {
  await browser.close();
}

const deduped = new Map();
for (const plan of data) deduped.set(plan.id, plan);
const currentData = [...deduped.values()];
const currentBanners = bannerResult.banners;
const payload = {
  generated_at: new Date().toISOString(),
  source: 'Live public telecom plan pages and targeted homepage banner sources',
  mode: currentData.length ? 'live' : previousData.length ? 'empty_fetch_preserved_previous' : 'live_empty',
  fetch_warning: currentData.length ? '' : previousData.length ? 'Live plan fetch returned no plans, so the previous saved plans were preserved.' : 'Live plan fetch returned no plans.',
  coverage,
  banner_coverage: bannerResult.coverage,
  data: currentData.length ? currentData : previousData,
  banners: currentBanners.length ? currentBanners : previousBanners,
};

await mkdir(path.dirname(dataPath), { recursive: true });
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ plans: payload.data.length, banners: payload.banners.length, fetched: currentData.length, coverage, banner_coverage: payload.banner_coverage }, null, 2));
