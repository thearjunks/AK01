import { chromium } from 'playwright';
import { chmod, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'ads.json');
const pagesModule = await import(pathToFileURL(path.join(root, 'src', 'data', 'pages.js')).href);
const pageIdFilter = String(process.env.META_ADS_PAGE_IDS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const trackedPageIds = new Set(pageIdFilter);
const trackedPages = pageIdFilter.length
  ? pagesModule.pages.filter((page) => trackedPageIds.has(page.pageId))
  : pagesModule.pages;
const activeStatus = process.env.META_ADS_ACTIVE_STATUS || 'active';
const maxAttempts = Number(process.env.META_ADS_MAX_ATTEMPTS || 3);

const maxScrolls = Number(process.env.META_ADS_MAX_SCROLLS || 120);
const headless = process.env.META_ADS_HEADLESS !== '0';
const savedArtworkByAd = new Map();
try {
  const savedPayload = JSON.parse(await readFile(dataPath, 'utf8'));
  const savedAds = Array.isArray(savedPayload) ? savedPayload : savedPayload.data || savedPayload.ads || [];
  for (const ad of savedAds) {
    const localArtworkUrl = String(ad.local_artwork_url || '').trim();
    if (localArtworkUrl) savedArtworkByAd.set(`${ad.page_id}:${ad.ad_archive_id}`, localArtworkUrl);
  }
} catch {
  // A first run has no prior snapshot to preserve.
}
const browserArgs = process.platform === 'linux'
  ? [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-zygote',
      '--single-process',
      '--renderer-process-limit=1',
    ]
  : [];

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

function sourceResultCountFromText(text) {
  if (/no ads match your search criteria/i.test(text)) return { count: 0, approximate: false };
  const matches = [...text.matchAll(/(^|\n)\s*(~)?\s*([\d,.]+)\s+results?\s*(?=\n|$)/gi)]
    .map((match) => ({ count: Number(match[3].replace(/,/g, '')), approximate: Boolean(match[2]) }))
    .filter((item) => Number.isFinite(item.count));
  return matches.sort((a, b) => b.count - a.count)[0] || null;
}

function collectionIsComplete(found, sourceResult, exhausted) {
  if (!sourceResult || !exhausted) return false;
  if (!sourceResult.approximate) return found >= sourceResult.count;
  // Meta labels this value with "~", so it is an estimate rather than a
  // pageable record total.  A completed traversal is authoritative; this
  // guard only catches large collection shortfalls.
  const tolerance = Math.max(3, Math.ceil(sourceResult.count * 0.05));
  return found >= sourceResult.count - tolerance;
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
  return ['Facebook', 'Instagram', 'Messenger', 'Threads', 'Audience Network']
    .filter((platform) => new RegExp(platform, 'i').test(text));
}

function stopTimeFromText(text) {
  return /\bInactive\b/i.test(text) ? 'Ended' : '';
}

function languageFromText(text) {
  const hasArabic = /[\u0600-\u06ff]/.test(text);
  const hasEnglish = /[A-Za-z]/.test(text);
  if (hasArabic && hasEnglish) return 'mixed';
  if (hasArabic) return 'ar';
  if (hasEnglish) return 'en';
  return 'unknown';
}

function cleanCreativeText(text) {
  return text
    .replace(/\u200B/g, '')
    .replace(/^\s*(Active|Inactive)\s*$/gim, '')
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
  if (/s60x60|s80x80|s148x148|t39\.30808-1/.test(src)) score -= 12;
  return score;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless, args: browserArgs });
  } catch {
    if (process.platform !== 'win32') {
      const localBrowsersDir = path.resolve(chromium.executablePath(), '..', '..', '..');
      const browserFiles = await readdir(localBrowsersDir, { recursive: true });
      const executable = browserFiles.find((file) => path.basename(file) === 'chrome-headless-shell');
      if (!executable) throw new Error(`Playwright headless shell was not found in ${localBrowsersDir}.`);
      await chmod(path.join(localBrowsersDir, executable), 0o755);
    }
    return await chromium.launch({ headless, args: browserArgs });
  }
}

async function scrapePage(browser, trackedPage) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    const libraryUrl = libraryUrlFor(trackedPage);
    await page.goto(libraryUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(7000);

    const extractVisibleRawAds = () => page.evaluate(() => {
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
          if (libraryIds.length !== 1 || !parentText.includes(id)) break;
          card = card.parentElement;
        }
        const text = card.innerText || '';
        const previous = candidates.get(id);
        const score = (text.length || 0) + ((text.match(/Library ID:\s*\d+/g) || []).length > 1 ? 1000000 : 0);
        if (!previous || score < previous.score) candidates.set(id, { card, score });
      }

      return [...candidates].map(([id, { card }]) => {
        const text = card.innerText || '';
        return {
          id,
          text,
          labels: [
            ...[...card.querySelectorAll('[aria-label]')].map((item) => item.getAttribute('aria-label')),
            ...[...card.querySelectorAll('img[alt]')].map((item) => item.getAttribute('alt')),
            ...[...card.querySelectorAll('title')].map((item) => item.textContent),
          ].filter(Boolean),
          images: [...card.querySelectorAll('img')]
            .map((img) => img.currentSrc || img.src)
            .filter(Boolean),
          hasVideo: Boolean(card.querySelector('video')) || /\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2}/.test(text),
        };
      });
    });

    const rawAdsById = new Map();
    const captureVisibleAds = async () => {
      for (const rawAd of await extractVisibleRawAds()) {
        if (/Ad Library report/i.test(rawAd.text)) continue;
        const previous = rawAdsById.get(rawAd.id);
        if (!previous) {
          rawAdsById.set(rawAd.id, rawAd);
          continue;
        }
        rawAdsById.set(rawAd.id, {
          ...previous,
          text: rawAd.text.length > previous.text.length ? rawAd.text : previous.text,
          labels: [...new Set([...previous.labels, ...rawAd.labels])],
          images: [...new Set([...previous.images, ...rawAd.images])],
          hasVideo: previous.hasVideo || rawAd.hasVideo,
        });
      }
    };

    await captureVisibleAds();
    let lastHeight = 0;
    let lastUniqueCount = rawAdsById.size;
    let stableScrolls = 0;
    for (let index = 0; index < maxScrolls; index += 1) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(2000);
      await captureVisibleAds();
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      stableScrolls = currentHeight === lastHeight && rawAdsById.size === lastUniqueCount
        ? stableScrolls + 1
        : 0;
      if (stableScrolls >= 12) break;
      lastUniqueCount = rawAdsById.size;
      lastHeight = currentHeight;
    }

    // Meta collapses distinct Library IDs that share creative/text into a
    // "See summary details" group.  The headline estimate counts the ads,
    // while the result grid counts the collapsed cards.  Open every group and
    // collect the individual IDs so the dashboard represents active ads, not
    // only visible summary cards.
    const summaryButtons = page.getByText('See summary details', { exact: true });
    const summaryCount = await summaryButtons.count();
    for (let index = 0; index < summaryCount; index += 1) {
      try {
        await summaryButtons.nth(index).click({ timeout: 15000 });
        await page.waitForTimeout(700);
        await captureVisibleAds();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
      } catch (error) {
        console.warn(`  could not expand grouped result ${index + 1}/${summaryCount}: ${error.message}`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }

    const rawAds = [...rawAdsById.values()];

    const ads = [];
    for (const [sourceIndex, rawAd] of rawAds.entries()) {
    const artworkUrl = rawAd.images.sort((a, b) => imageScore(b) - imageScore(a))[0] || '';
    const searchableMeta = `${rawAd.text}\n${rawAd.labels.join('\n')}`;
    const creativeText = cleanCreativeText(rawAd.text);
      ads.push({
      page_id: trackedPage.pageId,
      page_name: trackedPage.name,
      ad_archive_id: rawAd.id,
      ad_creative_body: creativeText,
      ad_delivery_start_time: dateFromText(searchableMeta),
      ad_delivery_stop_time: stopTimeFromText(searchableMeta),
      publisher_platforms: platformsFromText(searchableMeta),
      language: languageFromText(creativeText),
      media_type: rawAd.hasVideo ? 'video' : artworkUrl ? 'image' : 'unknown',
      ad_status: stopTimeFromText(searchableMeta) ? 'inactive' : 'active',
      ad_snapshot_url: `https://www.facebook.com/ads/library/?id=${rawAd.id}`,
      artwork_url: artworkUrl,
      local_artwork_url: savedArtworkByAd.get(`${trackedPage.pageId}:${rawAd.id}`) || '',
      _source_index: sourceIndex,
      });
    }

    const sourceResult = sourceResultCountFromText(await page.locator('body').innerText());
    return { ads, sourceResult, exhausted: stableScrolls >= 12 };
  } finally {
    await context.close();
  }
}

const browser = await launchBrowser();
const displayedCounts = {};
const sourceCounts = {};
const validationPages = [];
const resultsByPage = new Map();

try {
  for (const trackedPage of trackedPages) {
    console.log(`Scraping ${trackedPage.name} (${trackedPage.pageId})...`);
    let best = { ads: [], sourceResult: null, exhausted: false };
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await scrapePage(browser, trackedPage);
        if (result.ads.length > best.ads.length) best = result;
        const complete = collectionIsComplete(result.ads.length, result.sourceResult, result.exhausted);
        console.log(`  attempt ${attempt}: ${result.ads.length}/${result.sourceResult?.approximate ? '~' : ''}${result.sourceResult?.count ?? '?'} cards`);
        if (complete) break;
      } catch (error) {
        lastError = error;
        console.error(`  attempt ${attempt} failed: ${error.message}`);
      }
    }
    if (!collectionIsComplete(best.ads.length, best.sourceResult, best.exhausted)) {
      const expected = best.sourceResult ? `${best.sourceResult.approximate ? '~' : ''}${best.sourceResult.count}` : 'an unavailable source total';
      throw new Error(`${trackedPage.name} collection incomplete: captured ${best.ads.length} of ${expected} active results after ${maxAttempts} attempts.${lastError ? ` Last error: ${lastError.message}` : ''}`);
    }
    displayedCounts[trackedPage.pageId] = String(best.ads.length);
    sourceCounts[trackedPage.pageId] = best.sourceResult.count;
    validationPages.push({
      page_id: trackedPage.pageId,
      page_name: trackedPage.name,
      captured: best.ads.length,
      source_count: best.sourceResult.count,
      approximate: best.sourceResult.approximate,
      pagination_exhausted: best.exhausted,
      complete: true,
    });
    resultsByPage.set(trackedPage.pageId, best.ads);
  }
} finally {
  await browser.close();
}

const freshAds = trackedPages.flatMap((page) => resultsByPage.get(page.pageId) || []);

// de-dupe by page + library id in case a page was scraped more than once in this run
const dedupedAds = [...new Map(freshAds.map((ad) => [`${ad.page_id}:${ad.ad_archive_id}`, ad])).values()];

const payload = {
  generated_at: new Date().toISOString(),
  source: `Meta Ads Library public pages, active ads, country KW`,
  displayed_counts: displayedCounts,
  source_counts: sourceCounts,
  validation: {
    complete: true,
    active_only: activeStatus === 'active',
    pages: validationPages,
  },
  data: dedupedAds,
};

const temporaryDataPath = `${dataPath}.next`;
await writeFile(temporaryDataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await rename(temporaryDataPath, dataPath);
console.log(JSON.stringify({ ads: dedupedAds.length, pages: trackedPages.length }, null, 2));
