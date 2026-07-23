import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'devices.json');
const imageDir = path.join(root, 'public', 'device-images');
const headless = process.env.DEVICE_HEADLESS !== '0';
const maxCardsPerSource = Math.max(20, Number(process.env.DEVICE_MAX_CARDS_PER_SOURCE || 260));

const brands = {
  stc: { name: 'stc Kuwait', color: '#4f008c', logo: 'https://www.stc.com.kw/cdn/images/stc_logo_5776f67ce8.webp' },
  ooredoo: { name: 'Ooredoo Kuwait', color: '#ed1c24', logo: 'https://ooredoo.com.kw/documents/d/guest/ooredoo-logo' },
  zain: { name: 'Zain Kuwait', color: '#00a651', logo: 'https://www.kw.zain.com/o/zain-theme/images/zain_logo.svg' },
};

const sources = [
  { provider: 'zain', category: 'Devices', url: 'https://www.kw.zain.com/en/shop/devices' },
  { provider: 'stc', category: 'Devices', url: 'https://www.stc.com.kw/en/e-store/grid/all' },
  { provider: 'ooredoo', category: 'Internet Devices', url: 'https://store.ooredoo.com.kw/gadgets/internet-devices.html' },
  { provider: 'ooredoo', category: 'Tablets', url: 'https://store.ooredoo.com.kw/gadgets/tablets-laptops.html' },
  { provider: 'ooredoo', category: 'Gaming', url: 'https://store.ooredoo.com.kw/gadgets/gaming.html' },
  { provider: 'ooredoo', category: 'Accessories', url: 'https://store.ooredoo.com.kw/gadgets/accessories.html' },
  { provider: 'ooredoo', category: 'Smartwatches', url: 'https://store.ooredoo.com.kw/gadgets/accessories/smartwatches.html' },
  { provider: 'ooredoo', category: 'TV', url: 'https://store.ooredoo.com.kw/getooredooadd/tv.html' },
  { provider: 'ooredoo', category: 'All Products', url: 'https://store.ooredoo.com.kw/cash.html' },
  { provider: 'ooredoo', category: 'Tablet Search', url: 'https://store.ooredoo.com.kw/catalogsearch/result/?q=tablet' },
];

function stableId(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 18);
}

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(base, value) {
  if (!value) return '';
  try { return new URL(value, base).href; } catch { return ''; }
}

function priceFromText(text) {
  const normalized = clean(text);
  const match = normalized.match(/(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/i);
  return match ? match[0].replace(/\s+/g, ' ') : '';
}

function installmentFromText(text) {
  const normalized = clean(text);
  const match = normalized.match(/(?:KD|KWD|د\.ك)\s*[\d.,]+\s*(?:\/|per|monthly|month|mo)|[\d.,]+\s*(?:KD|KWD|د\.ك)\s*(?:\/|per|monthly|month|mo)/i);
  return match ? match[0].replace(/\s+/g, ' ') : '';
}

function guessBrand(title) {
  const brandsList = ['Apple', 'Samsung', 'Huawei', 'Honor', 'Xiaomi', 'Lenovo', 'Microsoft', 'Sony', 'Nintendo', 'Anker', 'TP-Link', 'Nokia', 'Oppo', 'Vivo', 'Google', 'eero', 'Asus', 'Acer', 'Dell', 'HP'];
  const found = brandsList.find((brand) => new RegExp(`\\b${brand}\\b`, 'i').test(title));
  return found || clean(title).split(' ')[0] || '';
}

function guessCategory(title, fallback) {
  const text = `${title} ${fallback}`.toLowerCase();
  if (/watch|band/.test(text)) return 'Smartwatches';
  if (/ipad|tablet|tab/.test(text)) return 'Tablets';
  if (/laptop|macbook|surface/.test(text)) return 'Laptops';
  if (/router|cpe|wifi|5g|internet|eero|mesh/.test(text)) return 'Internet Devices';
  if (/playstation|ps5|xbox|gaming|nintendo/.test(text)) return 'Gaming';
  if (/tv|television/.test(text)) return 'TV';
  if (/case|charger|adapter|cable|airpods|buds|speaker|accessor/.test(text)) return 'Accessories';
  if (/iphone|galaxy|phone|mobile|smartphone/.test(text)) return 'Smartphones';
  return fallback || 'Devices';
}

function storageFromText(text) {
  return [...new Set((clean(text).match(/\b\d+\s*(?:GB|TB)\b/gi) || []).map((item) => item.toUpperCase().replace(/\s+/g, '')))].join(', ');
}

function stockFromText(text) {
  if (/out of stock|sold out|unavailable|notify me/i.test(text)) return 'Out of stock';
  if (/in stock|available|add to cart|buy now|order now|shop now/i.test(text)) return 'In stock';
  return 'Unknown';
}

function isRealDeviceCandidate(device) {
  const name = clean(device.name);
  const image = String(device.image_url || '');
  if (!name || name.length < 3 || name.length > 140) return false;
  if (/^data:/i.test(image)) return false;
  if (/kuwait\.svg|\/icons?\/|logo|sprite|placeholder|blank|loading/i.test(image)) return false;
  if (/^(apple|samsung|huawei|honor|xiaomi|zain basics|kuwait|العربية|english|arabic|filter by|switch to business|portable|fixed|home internet)$/i.test(name)) return false;
  if (/^(devices|internet devices|accessories|smartwatches|tablets|laptops|gaming|tv|all products)$/i.test(name)) return false;
  if (/planspostpaid|postpaidmobile|redbullmobilebyzain/i.test(name.replace(/\s+/g, ''))) return false;
  if (!device.product_url || /login|cart|checkout|wishlist|compare|customer/i.test(device.product_url)) return false;
  return true;
}

function imageExtension(url, contentType = '') {
  const ext = path.extname(new URL(url).pathname.toLowerCase());
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'].includes(ext)) return ext;
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('avif')) return '.avif';
  return '.jpg';
}

async function saveDeviceImage(url) {
  if (!/^https?:\/\//i.test(url || '')) return '';
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
    await mkdir(imageDir, { recursive: true });
    await writeFile(path.join(imageDir, fileName), Buffer.from(await response.arrayBuffer()));
    return `/device-images/${fileName}`;
  } catch {
    return '';
  }
}

async function clickLoadMore(page) {
  for (let index = 0; index < 8; index += 1) {
    const clicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button,a')];
      const button = buttons.find((item) => /load more|show more|view more|more products|next/i.test(item.innerText || item.getAttribute('aria-label') || ''));
      if (!button) return false;
      button.click();
      return true;
    }).catch(() => false);
    if (!clicked) break;
    await page.waitForTimeout(1800);
  }
}

async function scrapeSource(browser, source) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5500);
  for (let index = 0; index < 10; index += 1) {
    await page.mouse.wheel(0, 2600).catch(() => {});
    await page.waitForTimeout(900);
  }
  await clickLoadMore(page);
  const rows = await page.evaluate((sourceInfo) => {
    const cleanText = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const priceRx = /(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/i;
    const badTitle = /^(shop|devices|products|add to cart|buy now|learn more|quick view|wishlist|compare|new|sale|details)$/i;
    const productHref = (href) => {
      if (!href) return false;
      return /\/(?:p|product|products|shop|devices|catalog|gadgets|cash|e-store)\b|\.html\b/i.test(href)
        && !/login|cart|checkout|wishlist|compare|customer|facebook|instagram|whatsapp|mailto|tel:|\/plans?\b|\/prepaid\b|\/postpaid\b/i.test(href);
    };
    const bestImage = (node) => {
      const images = [...node.querySelectorAll('img')].map((img) => ({
        src: img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '',
        alt: cleanText(img.alt || img.title || ''),
        width: img.naturalWidth || Number(img.getAttribute('width')) || 0,
        height: img.naturalHeight || Number(img.getAttribute('height')) || 0,
      })).filter((img) => img.src && !/^data:/i.test(img.src) && !/logo|icon|sprite|placeholder|loading|blank|flag|kuwait\.svg/i.test(img.src));
      return images.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || {};
    };
    const cardFor = (anchor) => {
      let current = anchor;
      for (let depth = 0; depth < 7 && current; depth += 1) {
        const text = cleanText(current.innerText);
        const image = current.querySelector('img');
        if (image && (priceRx.test(text) || current.querySelector('button') || current.querySelector('[class*="price" i]'))) return current;
        current = current.parentElement;
      }
      return anchor;
    };
    const anchors = [...document.querySelectorAll('a[href]')].filter((anchor) => productHref(anchor.href));
    const rows = [];
    const seen = new Set();
    for (const anchor of anchors) {
      const card = cardFor(anchor);
      const image = bestImage(card);
      const text = cleanText(card.innerText);
      const heading = cleanText(card.querySelector('h1,h2,h3,h4,.product-name,.product-item-name,[class*="name" i],[class*="title" i]')?.innerText || '');
      const anchorText = cleanText(anchor.innerText);
      const title = [heading, anchorText, image.alt].find((value) => value && value.length > 2 && value.length < 130 && !badTitle.test(value) && !/^(apple|samsung|huawei|honor|kuwait|العربية)$/i.test(value)) || '';
      if (!title || (!image.src && !priceRx.test(text))) continue;
      const url = anchor.href.split('#')[0];
      const key = `${url}|${title}|${image.src}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        title,
        text,
        image: image.src,
        imageAlt: image.alt,
        url,
        rawCategory: sourceInfo.category,
      });
      if (rows.length >= sourceInfo.maxCards) break;
    }
    return rows;
  }, { ...source, maxCards: maxCardsPerSource });
  await context.close();
  return rows;
}

function normalizeDevice(row, source) {
  const text = clean(`${row.title} ${row.text}`);
  const provider = brands[source.provider];
  const title = clean(row.title);
  const price = priceFromText(text);
  const key = clean(`${source.provider}|${title}|${storageFromText(text)}|${row.url}`).toLowerCase();
  return {
    id: stableId(key),
    provider: source.provider,
    provider_name: provider.name,
    logo: provider.logo,
    color: provider.color,
    name: title,
    brand: guessBrand(title),
    category: guessCategory(title, source.category),
    description: clean(row.text).slice(0, 420),
    storage: storageFromText(text),
    colors: '',
    price,
    monthly_installment: installmentFromText(text),
    contract_duration: clean((text.match(/\b(?:12|18|24|36)\s*(?:months?|mo)\b/i) || [])[0] || ''),
    associated_plan: clean((text.match(/\b(?:postpaid|prepaid|wiyana|eezee|5g|internet|plan)\b.{0,70}/i) || [])[0] || ''),
    offer: clean((text.match(/\b(?:free|discount|offer|save|gift|bundle|installment)\b.{0,100}/i) || [])[0] || ''),
    stock_status: stockFromText(text),
    image_url: row.image,
    local_image_url: '',
    product_url: row.url,
    source_url: source.url,
    first_identified_at: new Date().toISOString(),
    last_checked: new Date().toISOString().slice(0, 10),
    status: 'Current',
    source_categories: [source.category],
    source_urls: [source.url],
  };
}

function dedupeDevices(devices) {
  const merged = new Map();
  for (const device of devices) {
    const key = clean(`${device.provider}|${device.brand}|${device.name}|${device.storage}|${device.product_url}`).toLowerCase();
    const fallback = clean(`${device.provider}|${device.brand}|${device.name}|${device.storage}`).toLowerCase();
    const id = key || fallback || device.id;
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, device);
      continue;
    }
    existing.source_categories = [...new Set([...(existing.source_categories || []), ...(device.source_categories || [])])];
    existing.source_urls = [...new Set([...(existing.source_urls || []), ...(device.source_urls || [])])];
    existing.description = existing.description.length >= device.description.length ? existing.description : device.description;
    existing.price ||= device.price;
    existing.monthly_installment ||= device.monthly_installment;
    existing.image_url ||= device.image_url;
    existing.product_url ||= device.product_url;
  }
  return [...merged.values()];
}

function addGapSignals(devices) {
  const stcKeys = new Set(devices.filter((device) => device.provider === 'stc').map((device) => clean(`${device.brand}|${device.name}|${device.storage}`).toLowerCase()));
  return devices.map((device) => ({
    ...device,
    missing_from_stc: device.provider !== 'stc' && !stcKeys.has(clean(`${device.brand}|${device.name}|${device.storage}`).toLowerCase()),
  }));
}

const browser = await chromium.launch({ headless });
const discovered = [];
const coverage = [];
try {
  for (const source of sources) {
    try {
      const rows = await scrapeSource(browser, source);
      const normalized = rows.map((row) => normalizeDevice(row, source));
      discovered.push(...normalized);
      coverage.push({ provider: source.provider, category: source.category, source_url: source.url, status: 'ok', count: normalized.length });
    } catch (error) {
      coverage.push({ provider: source.provider, category: source.category, source_url: source.url, status: error.message, count: 0 });
    }
  }
} finally {
  await browser.close();
}

const deduped = addGapSignals(dedupeDevices(discovered.filter(isRealDeviceCandidate)));
for (const device of deduped) {
  device.local_image_url = await saveDeviceImage(device.image_url);
}

const payload = {
  generated_at: new Date().toISOString(),
  source: 'Live device collector: public stc, Ooredoo, and Zain Kuwait e-store pages',
  coverage,
  fetched_count: discovered.length,
  deduped_count: deduped.length,
  data: deduped,
};
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ fetched: discovered.length, deduped: deduped.length, coverage }, null, 2));
