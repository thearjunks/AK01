import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'ads.json');
const artworkDir = path.join(root, 'public', 'artwork');
const pagesModule = await import(pathToFileURL(path.join(root, 'src', 'data', 'pages.js')).href);
const pageIdFilter = String(process.env.META_ADS_PAGE_IDS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const trackedPageIds = new Set(pageIdFilter);
const trackedPages = pageIdFilter.length
  ? pagesModule.pages.filter((page) => trackedPageIds.has(page.pageId))
  : pagesModule.pages;
const activeStatus = process.env.META_ADS_ACTIVE_STATUS || 'all';

const maxScrolls = Number(process.env.META_ADS_MAX_SCROLLS || 120);
const headless = process.env.META_ADS_HEADLESS !== '0';

function libraryUrlFor(trackedPage) {
  const url = new URL(trackedPage.libraryUrl);
  url.searchParams.set('active_status', activeStatus);
  url.searchParams.set('ad_type', 'all');
  url.searchParams.set('country', 'KW');
  url.searchParams.set('media_type', 'all');
  url.searchParams.set('search_type', 'page');
  url.searchParams.set('view_all_page_id', trackedPage.pageId);
  return url.toString();
}

function dateFromText(text) {
  const match = text.match(/Started running on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (!match) return '';
  const monthLookup = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const value = match[1].replace(',', '').trim();
  const monthFirst = value.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  const dayFirst = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const parts = monthFirst
    ? { month: monthFirst[1], day: monthFirst[2], year: monthFirst[3] }
    : dayFirst
      ? { day: dayFirst[1], month: dayFirst[2], year: dayFirst[3] }
      : null;
  if (!parts) return '';
  const month = monthLookup[parts.month.slice(0, 3).toLowerCase()];
  if (!month) return '';
  return `${parts.year}-${month}-${String(parts.day).padStart(2, '0')}`;
}

function platformsFromText(text) {
  return ['Facebook', 'Instagram', 'Messenger', 'Threads'].filter((platform) => text.includes(platform));
}

function stopTimeFromText(text) {
  return /\bInactive\b/i.test(text) ? 'Ended' : '';
}

function cleanCreativeText(text) {
  return text
    .replace(/\u200B/g, '')
    .replace(/Active\s*/gi, '')
    .replace(/Library ID:\s*\d+/gi, '')
    .replace(/Started running on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi, '')
    .replace(/Platforms\s*(Facebook|Instagram|Messenger|Threads|\s)+/gi, '')
    .replace(/This ad has multiple versions.*$/gim, '')
    .replace(/See (summary )?ad details/gi, '')
    .replace(/See (summary )?details/gi, '')
    .replace(/Open Drop-down/gi, '')
    .replace(/\d+\s+ads use this creative and text/gi, '')
    .replace(/Sponsored/gi, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .join('\n')
    .trim();
}

function imageScore(src) {
  if (!src) return 0;
  let score = 0;
  if (/scontent\./.test(src)) score += 5;
  if (/t39\.35426|t45|t15|ads/i.test(src)) score += 6;
  if (/s600x600|p600x600|600/.test(src)) score += 3;
  if (/s148x148|t39\.30808-1/.test(src)) score -= 4;
  return score;
}

function hashUrl(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 20);
}

function extensionFor(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname);
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
}

async function saveArtwork(response, src) {
  if (!src || !response?.ok()) return '';
  const contentType = response.headers()['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('image/')) return '';
  const ext = extensionFor(src);
  const fileName = `${hashUrl(src)}${ext}`;
  await mkdir(artworkDir, { recursive: true });
  await writeFile(path.join(artworkDir, fileName), await response.body());
  return `/artwork/${fileName}`;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless });
  } catch {
    return await chromium.launch({ headless });
  }
}

async function scrapePage(browser, trackedPage) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  });
  const page = await context.newPage();
  const imageResponses = new Map();

  page.on('response', async (response) => {
    const url = response.url();
    if (/scontent\./.test(url) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
      imageResponses.set(url, response);
    }
  });

  const libraryUrl = libraryUrlFor(trackedPage);
  await page.goto(libraryUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(7000);

  let lastHeight = 0;
  let lastCount = 0;
  let stableScrolls = 0;
  for (let index = 0; index < maxScrolls; index += 1) {
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(1800);
    const current = await page.evaluate(() => ({
      height: document.body.scrollHeight,
      ids: [...document.body.innerText.matchAll(/Library ID:\s*(\d+)/g)].length,
    }));
    stableScrolls = current.height === lastHeight && current.ids === lastCount ? stableScrolls + 1 : 0;
    if (stableScrolls >= 8) break;
    lastCount = current.ids;
    lastHeight = current.height;
  }

  const rawAds = await page.evaluate(() => {
    const candidates = new Map();
    const libraryNodes = [...document.querySelectorAll('div')]
      .filter((node) => /Library ID:\s*\d+/.test(node.innerText || ''));

    for (const node of libraryNodes) {
      const idMatch = (node.innerText || '').match(/Library ID:\s*(\d+)/);
      if (!idMatch) continue;
      const id = idMatch[1];

      let card = node;
      for (let depth = 0; depth < 8 && card.parentElement; depth += 1) {
        const parentText = card.parentElement.innerText || '';
        const libraryIds = parentText.match(/Library ID:\s*\d+/g) || [];
        if (libraryIds.length !== 1 || !parentText.includes(idMatch[1])) break;
        card = card.parentElement;
      }
      const text = card.innerText || '';
      const previous = candidates.get(id);
      const score = (text.length || 0) + ((text.match(/Library ID:\s*\d+/g) || []).length > 1 ? 1000000 : 0);
      if (!previous || score < previous.score) {
        candidates.set(id, { card, score });
      }
    }

    const cards = [];
    for (const [id, { card }] of candidates) {
      const text = card.innerText || '';

      const labels = [
        ...[...card.querySelectorAll('[aria-label]')].map((item) => item.getAttribute('aria-label')),
        ...[...card.querySelectorAll('img[alt]')].map((item) => item.getAttribute('alt')),
        ...[...card.querySelectorAll('title')].map((item) => item.textContent),
      ].filter(Boolean);
      const images = [...card.querySelectorAll('img')]
        .map((img) => img.currentSrc || img.src)
        .filter(Boolean);

      cards.push({
        id,
        text,
        labels,
        images,
      });
    }

    return cards;
  });

  const ads = [];
  for (const [sourceIndex, rawAd] of rawAds.filter((ad) => /Started running on/i.test(ad.text) && !/Ad Library report/i.test(ad.text)).entries()) {
    const artworkUrl = rawAd.images.sort((a, b) => imageScore(b) - imageScore(a))[0] || '';
    const localArtworkUrl = artworkUrl ? await saveArtwork(imageResponses.get(artworkUrl), artworkUrl) : '';
    const searchableMeta = `${rawAd.text}\n${rawAd.labels.join('\n')}`;
    ads.push({
      page_id: trackedPage.pageId,
      page_name: trackedPage.name,
      ad_archive_id: rawAd.id,
      ad_creative_body: cleanCreativeText(rawAd.text),
      ad_delivery_start_time: dateFromText(searchableMeta),
      ad_delivery_stop_time: stopTimeFromText(searchableMeta),
      publisher_platforms: platformsFromText(searchableMeta),
      ad_snapshot_url: `${libraryUrl}&q=${rawAd.id}`,
      artwork_url: artworkUrl,
      local_artwork_url: localArtworkUrl,
      _source_index: sourceIndex,
    });
  }

  await context.close();
  return ads;
}

const browser = await launchBrowser();
const allAds = [];
const displayedCounts = {};

try {
  for (const trackedPage of trackedPages) {
    console.log(`Scraping ${trackedPage.name} (${trackedPage.pageId})...`);
    const ads = await scrapePage(browser, trackedPage);
    displayedCounts[trackedPage.pageId] = String(ads.length);
    console.log(`  ${ads.length} ads found`);
    allAds.push(...ads);
  }
} finally {
  await browser.close();
}

const payload = {
  generated_at: new Date().toISOString(),
  source: `Meta Ads Library public pages, ${activeStatus} ads, country KW`,
  displayed_counts: displayedCounts,
  data: allAds,
};

await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ads: allAds.length, pages: trackedPages.length }, null, 2));
