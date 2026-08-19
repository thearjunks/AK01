import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'plans.json');
const bannerDir = path.join(root, 'public', 'plan-banners');
const maxCardsPerPage = Number(process.env.PLAN_MAX_CARDS_PER_PAGE || 80);
const maxBannersPerPage = Number(process.env.PLAN_MAX_BANNERS_PER_PAGE || 8);
const headless = process.env.PLAN_HEADLESS !== '0';

const brands = {
  stc: { name: 'stc Kuwait', color: '#4f008c', logo: 'https://www.stc.com.kw/cdn/images/stc_logo_5776f67ce8.webp' },
  ooredoo: { name: 'Ooredoo Kuwait', color: '#ed1c24', logo: 'https://ooredoo.com.kw/documents/d/guest/ooredoo-logo' },
  zain: { name: 'Zain Kuwait', color: '#00a651', logo: 'https://www.kw.zain.com/o/zain-theme/images/zain_logo.svg' },
  friendi: { name: 'FRiENDi Kuwait', color: '#f58220', logo: '' },
};

const sourceMatrix = [
  { category: 'Prepaid Voice Plans', stc: 'https://www.stc.com.kw/en/prepaid-plans', ooredoo: 'https://www.ooredoo.com.kw/en/prepaid-mobile', zain: 'https://zain.com.kw/en/shop/eezee-plans' },
  { category: 'Prepaid Add-ons', stc: 'https://www.stc.com.kw/en/prepaid-plans', ooredoo: 'https://www.ooredoo.com.kw/en/prepaid-mobile', zain: 'https://zain.com.kw/en/shop/eezee-plans' },
  { category: 'Postpaid Voice Plans', stc: 'https://www.stc.com.kw/en/postpaid-plans', ooredoo: 'https://www.ooredoo.com.kw/en/postpaid-mobile', zain: 'https://zain.com.kw/en/shop/wiyana' },
  { category: 'Postpaid Internet Plans', stc: 'https://www.stc.com.kw/en/postpaid-internet-plans', ooredoo: 'https://www.ooredoo.com.kw/en/postpaid-internet', zain: 'https://zain.com.kw/en/shop/5g-internet-plans' },
  { category: 'Youth Plans', stc: 'https://www.stc.com.kw/en/youth-postpaid-plans', ooredoo: 'https://www.ooredoo.com.kw/en/shababi', zain: 'https://www.kw.zain.com/en/shop/alshabab' },
  { category: 'VIP Plans', stc: 'https://www.stc.com.kw/en/vip-postpaid-plans', ooredoo: 'https://store.ooredoo.com.kw/plans/postpaid/mobile/free-premium-number-plans.html', zain: 'https://www.kw.zain.com/en/shop/max' },
  {
    category: 'Roaming Plans',
    stc: [
      'https://www.stc.com.kw/en/roaming-bundles',
      'https://www.stc.com.kw/en/roaming-bundles-europe',
      'https://www.stc.com.kw/en/roaming-bundles-global',
      'https://www.stc.com.kw/en/roaming-bundles-turkey',
    ],
    ooredoo: 'https://ooredoo.com.kw/en/roaming',
    zain: 'https://www.kw.zain.com/en/web/consumer/roaming',
  },
];

const sources = sourceMatrix.flatMap(({ category, ...links }) => Object.entries(links)
  .flatMap(([provider, value]) => (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((url) => ({ provider, category, url }))));

const crawlSources = [...new Map(sources.map((source) => [`${source.provider}|${source.url}`, source])).values()]
  .map((source) => ({
    ...source,
    fetch_url: source.provider === 'zain' && source.category === 'Roaming Plans'
      ? 'https://www.kw.zain.com/en/shop/roaming'
      : source.provider === 'zain' && source.url.startsWith('https://zain.com.kw/')
        ? source.url.replace('https://zain.com.kw/', 'https://www.kw.zain.com/')
        : source.url,
    categories: sources.filter((item) => item.provider === source.provider && item.url === source.url).map((item) => item.category),
  }));
const sourceFilter = cleanEnv(process.env.PLAN_SOURCE_FILTER);
const activeCrawlSources = sourceFilter
  ? crawlSources.filter((source) => `${source.provider}|${source.categories.join('|')}`.toLowerCase().includes(sourceFilter.toLowerCase()))
  : crawlSources;
const skipBanners = process.env.PLAN_SKIP_BANNERS === '1';

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
  const priceOnly = (line) => /^(?:KD|KWD|د\.ك)$/i.test(clean(line)) || /^(?:(?:KD|KWD|د\.ك)\s*)?[\d.,]+\s*(?:KD|KWD|د\.ك)?(?:\s*\/(?:month|week|day|year|\d+\s*months?))?$/i.test(clean(line));
  return lines.find((line) => !priceOnly(line) && !/^(prepaid|postpaid|roaming|plans?|home|choose a .* plan|\d+ months?)$/i.test(line) && line.length <= 90)
    || lines.find((line) => !priceOnly(line) && line.length <= 120)
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
    freshness: 'live',
    last_checked: new Date().toISOString(),
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(source.fetch_url || source.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
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

function cleanEnv(value) {
  return String(value || '').trim();
}

function categoryForSharedPrepaidSource(source, text, hint = '') {
  if (hint) return hint;
  if (!source.categories.includes('Prepaid Voice Plans') || !source.categories.includes('Prepaid Add-ons')) {
    return source.category;
  }
  return /activate now|activation code|to activate|(?:^|\n)get\s+.+?(?:for|at)\s+.+?\bKD\b|extra validity|additional validity/i.test(text || '')
    ? 'Prepaid Add-ons'
    : 'Prepaid Voice Plans';
}

async function extractOoredooPrepaidAddOns(page, source) {
  if (source.provider !== 'ooredoo' || !source.categories.includes('Prepaid Add-ons')) return [];
  const text = (await page.locator('body').innerText()).replace(/\r/g, '');
  const marker = 'Add-ons\nAll\nVoice\nInternet\nAdditional Validity\nInternational\n';
  const start = text.indexOf(marker);
  if (start < 0) return [];
  const section = text.slice(start + marker.length).split(/\nFUP\b/i)[0];
  return section.split(/\nBuy Now\b/i).map((block) => {
    const lines = block.split('\n').map(clean).filter(Boolean);
    const priceIndex = lines.findIndex((line) => /(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/i.test(line));
    if (priceIndex < 1) return null;
    return {
      text: lines.slice(priceIndex - 1).join('\n'),
      href: source.url,
      category_hint: 'Prepaid Add-ons',
    };
  }).filter(Boolean);
}

const gccCountries = ['Bahrain', 'Oman', 'Qatar', 'Saudi Arabia', 'United Arab Emirates'];
const stcEuropeCountries = ['Albania', 'Austria', 'Belgium', 'Czech Republic', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Netherlands', 'Portugal', 'Romania', 'Spain', 'Switzerland', 'United Kingdom'];
const stcGlobalCountries = `Bahrain
Oman
Qatar
Saudi Arabia
UAE
Albania
Armenia
Austria
Azerbaijan
Belarus
Belgium
Bosnia Herzegowina
Bulgaria
Croatia
Cyprus
Czech Republic
Denmark
Estonia
Faroe Islands
Finland
France
Georgia
Germany
Gibraltar
Greece
Guernsey
Hungary
Iceland
Ireland
Isle Of Man
Italy
Jersey
Latvia
Liechtenstein
Lithuania
Luxembourg
Malta
Moldova, Republic of
Monaco
Montenegro
Netherlands
Norway
Poland
Portugal
Romania
Russia
Serbia
Slovakia
Slovenia
Spain
Sweden
Switzerland
Turkey
Ukraine
United Kingdom
Afghanistan
Bangladesh
Brunei Darussalam
Cambodia
China
Hong Kong
India
Indonesia
Iran
Japan
Kazakhstan
Korea, Republic of
Kyrgyzstan
Laos
Macau
Malaysia
Maldives
Mongolia
Myanmar
Nepal
Pakistan
Philippines
Singapore
Sri Lanka
Taiwan
Tajikistan
Thailand
Uzbekistan
Vietnam
Yemen
Anguilla
Antigua and Barbuda
Argentina
Aruba
Bahamas
Barbados
Belize
Bolivia
Brazil
British Virgin Islands
Canada
Cayman Islands
Chile
Colombia
Dominica
Dominican Republic
Ecuador
El Salvador
Grenada
Guatemala
Guyana
Haiti
Honduras
Mexico
Montserrat
Panama
Paraguay
Peru
Puerto Rico
Saint Kitts and Nevis
Saint Lucia
Saint Vincent and the Grenadines
Suriname
Turks and Caicos Islands
Uruguay
USA
Vanuatu
Australia
Benin
Bermuda
Botswana
Cameroon
Cape Verde
Chad
Democratic Republic Of The Congo
Fiji
French Polynesia
Gabon
Gambia
Ghana
Jamaica
Kenya
Kingdom of Eswatini
Liberia
Madagascar
Malawi
Mauritius
Mozambique
New Zealand
Nigeria
Rwanda
Seychelles
South Africa
South Sudan
Sudan
Tanzania, United Republic of
Uganda
Zambia
Algeria
Egypt
Iraq
Jordan
Lebanon
Morocco
Palestinian Territory
Syria
Tunisia`.split('\n');

function normalizeCountryName(value) {
  const country = clean(value);
  const aliases = {
    UAE: 'United Arab Emirates',
    KSA: 'Saudi Arabia',
    USA: 'United States',
    UK: 'United Kingdom',
    Tunis: 'Tunisia',
    'Korea, Republic of': 'South Korea',
    Korea: 'South Korea',
    'New Zeland': 'New Zealand',
    'Palestinian Territory': 'Palestine',
    'Virgin Islands - US': 'US Virgin Islands',
    'United States of America': 'United States',
  };
  return aliases[country] || country;
}

function uniqueCountries(values) {
  return [...new Set((values || []).map(normalizeCountryName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function roamingPlan(source, { title, price, benefits, countries, region = '', customerType = '', capturedText = '' }) {
  const normalizedCountries = uniqueCountries(countries);
  const key = clean(`${source.provider}|Roaming Plans|${customerType}|${title}|${price}|${normalizedCountries.join('|')}`).toLowerCase();
  return {
    id: stableId(key),
    provider: source.provider,
    provider_name: brands[source.provider].name,
    logo: brands[source.provider].logo,
    color: brands[source.provider].color,
    category: 'Roaming Plans',
    sub_category: [region, customerType].filter(Boolean).join(' · '),
    title: clean(title),
    price: clean(price),
    benefits: (benefits || []).map(clean).filter(Boolean).slice(0, 10),
    countries: normalizedCountries,
    roaming_region: region,
    customer_type: customerType,
    source_url: source.url,
    detail_url: source.url,
    captured_text: clean(capturedText).slice(0, 2400),
    status: 'Active',
    freshness: 'live',
    last_checked: new Date().toISOString(),
  };
}

async function scrapeStcRoaming(page, source) {
  const body = await page.locator('body').innerText();
  const lines = body.split('\n').map(clean).filter(Boolean);
  const region = source.url.includes('europe') ? 'Europe' : source.url.includes('global') ? 'Global' : source.url.includes('turkey') ? 'Turkey' : 'GCC';
  let countries = region === 'Europe' ? stcEuropeCountries : region === 'Turkey' ? ['Turkey'] : region === 'GCC' ? gccCountries : stcGlobalCountries;
  if (region === 'Global') {
    try {
      const buttons = page.getByText('Available Countries', { exact: true });
      if (await buttons.count()) {
        await buttons.first().click({ timeout: 5000 });
        await page.waitForTimeout(300);
        const modalText = await page.locator('body').innerText();
        const modalLines = modalText.slice(modalText.lastIndexOf('Choose a Country')).split('\n').map(clean).filter(Boolean);
        const regionHeaders = new Set(['Choose a Country', 'GCC', 'EUROPE', 'ASIA', 'AMERICA', 'REST OF THE WORLD', 'MENA']);
        const liveCountries = modalLines.filter((line) => !regionHeaders.has(line) && line.length < 70);
        if (liveCountries.length > 50) countries = liveCountries;
      }
    } catch {}
  }
  const plans = [];
  let customerType = '';
  for (let index = 0; index < lines.length - 2; index += 1) {
    if (/^(Postpaid|Prepaid)$/i.test(lines[index])) customerType = lines[index];
    if (lines[index + 1] !== 'Price' || !priceFromText(lines[index + 2])) continue;
    const title = lines[index];
    const price = priceFromText(lines[index + 2]);
    const end = lines.slice(index + 3).findIndex((line) => line === 'Available Countries');
    const detailLines = lines.slice(index + 3, end < 0 ? index + 13 : index + 3 + end);
    const benefits = [];
    for (let detailIndex = 0; detailIndex < detailLines.length; detailIndex += 2) {
      const label = detailLines[detailIndex];
      const value = detailLines[detailIndex + 1];
      if (value && !/^(View More|Subscribe)$/i.test(label)) benefits.push(`${label}: ${value}`);
    }
    plans.push(roamingPlan(source, { title, price, benefits, countries, region, customerType, capturedText: [title, price, ...detailLines].join(' | ') }));
  }
  return { plans };
}

const ooredooRoamingApi = 'https://ooredoo.com.kw/o/c/packitems?sort=index&nestedFields=packItemFeatures,packItemServices,r_packPeriodItem_c_pack,countryPacks,countryOperators&filter=active%20eq%20true&pageSize=10000';
const ooredooRoamingCountriesApi = 'https://ooredoo.com.kw/o/c/countrieses/?nestedFields=countryOperators&pageSize=300&sort=countryName';

function uniqueText(values) {
  const found = new Map();
  for (const value of values || []) {
    const text = clean(value);
    if (text && !found.has(text.toLowerCase())) found.set(text.toLowerCase(), text);
  }
  return [...found.values()];
}

async function scrapeOoredooRoaming(source) {
  const requestOptions = {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(90000),
  };
  const [response, countriesResponse] = await Promise.all([
    fetch(ooredooRoamingApi, requestOptions),
    fetch(ooredooRoamingCountriesApi, requestOptions),
  ]);
  if (!response.ok) throw new Error(`Ooredoo roaming API returned HTTP ${response.status}`);
  if (!countriesResponse.ok) throw new Error(`Ooredoo roaming countries API returned HTTP ${countriesResponse.status}`);
  const [payload, countriesPayload] = await Promise.all([response.json(), countriesResponse.json()]);
  const items = (payload.items || []).filter((item) => item.active === true && item.status?.label === 'approved');
  if (items.length !== Number(payload.totalCount || items.length)) {
    throw new Error(`Ooredoo roaming API returned ${items.length} of ${payload.totalCount} active records`);
  }

  const supportedCountries = (countriesPayload.items || []).filter((country) => (
    country.countryName !== 'All'
    && country.noService !== true
    && (country.countryOperators || []).some((operator) => operator.passportSupported === true)
  ));
  const allPassportCountries = uniqueCountries(supportedCountries.map((country) => country.countryName));
  const countriesByZone = new Map();
  for (const country of supportedCountries) {
    const zoneId = String(country.r_zoneCountries_c_zoneId || '');
    const values = countriesByZone.get(zoneId) || [];
    values.push(country.countryName);
    countriesByZone.set(zoneId, values);
  }

  const categoryCounts = {};
  const plans = items.map((item) => {
    const sourceCategory = clean(item.r_packPeriodItem_c_pack?.name) || 'Other';
    categoryCounts[sourceCategory] = (categoryCounts[sourceCategory] || 0) + 1;
    const country = clean(item.countryPacks?.countryName);
    const zoneId = String(item.countryPacks?.r_zoneCountries_c_zoneId || '');
    const countries = sourceCategory === 'Global'
      ? allPassportCountries
      : sourceCategory === 'Regional'
        ? uniqueCountries(countriesByZone.get(zoneId) || [])
        : country && country !== 'All'
          ? [country]
          : [];
    const features = (item.packItemFeatures || [])
      .filter((feature) => feature.active !== false)
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
      .map((feature) => feature.name);
    const services = (item.packItemServices || [])
      .filter((service) => service.active !== false)
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
      .map((service) => service.name);
    const benefits = uniqueText([item.description, ...features, ...services]);
    const price = `KD ${item.price}${clean(item.paymentFrequency) ? ` / ${clean(item.paymentFrequency)}` : ''}`;
    const plan = roamingPlan(source, {
      title: item.name,
      price,
      benefits,
      countries,
      region: sourceCategory,
      capturedText: [item.name, price, sourceCategory, country, ...benefits].join(' | '),
    });
    return {
      ...plan,
      sub_category: [sourceCategory, item.roamingRecommended === true ? 'Recommended' : ''].filter(Boolean).join(' · '),
      id: stableId(`ooredoo|roaming|${item.id}`),
      source_id: String(item.id),
      source_category: sourceCategory,
      source_api_url: ooredooRoamingApi,
      source_country_api_url: ooredooRoamingCountriesApi,
      detail_url: clean(item.packURL) || source.url,
      roaming_recommended: item.roamingRecommended === true,
      available_as_esim: item.isESim === true || Boolean(clean(item.eSimLink)),
      date_modified: clean(item.dateModified),
    };
  });

  return {
    plans,
    api_url: ooredooRoamingApi,
    country_api_url: ooredooRoamingCountriesApi,
    source_method: 'Ooredoo Liferay Objects REST API',
    source_total: Number(payload.totalCount || plans.length),
    category_counts: categoryCounts,
    tab_counts: { All: plans.length, Recommended: plans.filter((plan) => plan.roaming_recommended).length, ...categoryCounts },
  };
}

async function downloadJson(context, url) {
  const downloadPage = await context.newPage();
  try {
    const downloadPromise = downloadPage.waitForEvent('download', { timeout: 90000 });
    await downloadPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((error) => {
      if (!/Download is starting/i.test(error.message)) throw error;
    });
    const download = await downloadPromise;
    return JSON.parse(await readFile(await download.path(), 'utf8'));
  } finally {
    await downloadPage.close();
  }
}

async function scrapeZainRoaming(page, source) {
  const scripts = await page.locator('script').allTextContents();
  const scriptText = scripts.join('\n');
  const dataOffersUrl = scriptText.match(/loadJSON\('([^']*dataoffers[^']*)'/i)?.[1]
    || 'https://www.kw.zain.com/documents/28671923/78052898/dataoffers+1025.json/1a47dd3e-8f95-a645-f46f-a88c0d97997a?t=1764048540614';
  const countriesUrl = scriptText.match(/loadJSON\('([^']*countries\.json[^']*)'/i)?.[1]
    || 'https://www.kw.zain.com/documents/28671923/78052898/countries.json/505cc955-8b58-1df7-f485-9fe4faf45f8b?t=1762975077977';
  const [offers, countries] = await Promise.all([
    downloadJson(page.context(), dataOffersUrl),
    downloadJson(page.context(), countriesUrl),
  ]);
  const supportedByIso = new Map();
  for (const offer of offers) {
    if (!offer.ISO || offer.RetailOffer !== '7KD Local') continue;
    const operators = supportedByIso.get(offer.ISO) || new Set();
    operators.add(clean(offer.HandsetDisplayName || offer.Operator));
    supportedByIso.set(offer.ISO, operators);
  }
  const definitions = [
    { title: 'ROAMING KD9.9', price: 'KD 9.9 / week', data: '1.5 GB daily', calls: '60 local minutes', sms: 'Send R9 to 99990' },
    { title: 'ROAMING KD13.9', price: 'KD 13.9 / week', data: '3 GB daily', calls: '120 local minutes', sms: 'Send R13 to 99990' },
    { title: 'ROAMING KD16.9', price: 'KD 16.9 / week', data: '4 GB daily', calls: '180 local minutes', sms: 'Send R16 to 99990', kuwait: '15 minutes to Kuwait' },
  ];
  const plans = [];
  for (const country of countries) {
    const operators = [...(supportedByIso.get(country.ISO) || [])].filter(Boolean);
    if (!operators.length) continue;
    const countryName = normalizeCountryName(country.CountryNameEN);
    for (const definition of definitions) {
      const benefits = [definition.data, definition.calls, definition.kuwait, definition.sms, `Partner networks: ${operators.join(', ')}`].filter(Boolean);
      plans.push(roamingPlan(source, { ...definition, benefits, countries: [countryName], region: 'Country-specific', capturedText: `${countryName} | ${benefits.join(' | ')}` }));
    }
  }
  return { plans };
}

async function scrapeRoamingSource(page, source) {
  if (source.provider === 'stc') {
    await page.waitForFunction(() => document.body.innerText.includes('Price'), { timeout: 30000 });
    return scrapeStcRoaming(page, source);
  }
  if (source.provider === 'ooredoo') {
    return scrapeOoredooRoaming(source);
  }
  return scrapeZainRoaming(page, source);
}

async function scrapeSource(browser, source) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(source.fetch_url || source.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  if (source.categories.includes('Roaming Plans')) {
    const result = await scrapeRoamingSource(page, source);
    await context.close();
    return result;
  }

  for (let scroll = 0; scroll < 8; scroll += 1) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(800);
  }

  const genericRawCards = await page.evaluate(() => {
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
      .filter((item) => {
        const prices = item.text.match(/(?:KD|KWD|د\.ك)\s*[\d.,]+|[\d.,]+\s*(?:KD|KWD|د\.ك)/gi) || [];
        return item.text.length >= 15 && item.text.length <= 700 && prices.length <= 3;
      });
    const seen = new Set();
    return nodes.filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80);
  });
  const targetedRawCards = await extractOoredooPrepaidAddOns(page, source);
  const rawCards = [...targetedRawCards, ...genericRawCards];

  const plans = [];
  const seen = new Set();
  for (const raw of rawCards) {
    const price = priceFromText(raw.text);
    if (!price) continue;
    const lines = parseLines(raw.text);
    const title = titleFromLines(lines, source.category);
    const benefits = benefitsFromLines(lines, title, price);
    const category = categoryForSharedPrepaidSource(source, raw.text, raw.category_hint);
    const key = clean(`${source.provider}|${category}|${title}|${price}|${benefits.join('|')}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    plans.push({
      id: stableId(key),
      provider: source.provider,
      provider_name: brands[source.provider].name,
      logo: brands[source.provider].logo,
      color: brands[source.provider].color,
      category,
      sub_category: source.subCategory || '',
      title,
      price,
      benefits,
      source_url: source.url,
      detail_url: raw.href,
      captured_text: raw.text.slice(0, 1200),
      status: 'Active',
      freshness: 'live',
      last_checked: new Date().toISOString(),
    });
  }
  await context.close();
  return { plans: plans.slice(0, maxCardsPerPage) };
}

let previousData = [];
let previousBanners = [];
let previousCoverage = [];
let previousBannerCoverage = [];
try {
  const previousPayload = JSON.parse(await readFile(dataPath, 'utf8'));
  previousData = (previousPayload.data || []).filter((item) => item.category !== 'Home');
  previousBanners = (previousPayload.banners || []).filter((item) => item.category !== 'Home');
  previousCoverage = previousPayload.coverage || [];
  previousBannerCoverage = previousPayload.banner_coverage || [];
} catch {}

const browser = await launchBrowser();
const data = [];
const coverage = [];
let bannerResult = { banners: [], coverage: [] };
try {
  for (const source of activeCrawlSources) {
    try {
      console.log(`Scraping ${brands[source.provider].name}: ${source.categories.join(', ')}...`);
      const result = await scrapeSource(browser, source);
      const plans = (result.plans || []).map((plan) => {
        if (source.categories.includes('Prepaid Voice Plans') && source.categories.includes('Prepaid Add-ons')) {
          const category = plan.category || categoryForSharedPrepaidSource(source, plan.captured_text || '');
          return { ...plan, category, source_categories: [category] };
        }
        return { ...plan, source_categories: source.categories };
      });
      data.push(...plans);
      coverage.push({
        provider: source.provider,
        categories: source.categories,
        source_url: source.url,
        fetched_url: source.fetch_url || source.url,
        api_url: result.api_url || '',
        country_api_url: result.country_api_url || '',
        source_method: result.source_method || 'Rendered page',
        source_total: result.source_total ?? plans.length,
        category_counts: result.category_counts || undefined,
        tab_counts: result.tab_counts || undefined,
        count: plans.length,
        status: plans.length ? 'ok' : 'No priced plan cards were exposed.',
      });
    } catch (error) {
      coverage.push({ provider: source.provider, categories: source.categories, source_url: source.url, fetched_url: source.fetch_url || source.url, count: 0, status: error.message });
    }
  }
  bannerResult = skipBanners ? { banners: previousBanners, coverage: previousBannerCoverage } : await collectTargetedBanners(browser);
} finally {
  await browser.close();
}

const deduped = new Map();
for (const plan of data) deduped.set(plan.id, plan);
const failedPlanSources = coverage.filter((item) => item.status !== 'ok');
const configuredSourceKeys = new Set(activeCrawlSources.map((source) => `${source.provider}|${source.url}`));
for (const plan of previousData) {
  const configured = configuredSourceKeys.has(`${plan.provider}|${plan.source_url}`);
  const failed = failedPlanSources.some((source) => source.provider === plan.provider && source.source_url === plan.source_url);
  if ((!configured || failed) && !deduped.has(plan.id)) deduped.set(plan.id, configured ? { ...plan, status: 'Active', freshness: 'preserved_source_failure' } : plan);
}
const currentData = [...deduped.values()];
const bannerMap = new Map(bannerResult.banners.map((banner) => [banner.id, banner]));
const failedBannerSources = bannerResult.coverage.filter((item) => item.status !== 'ok');
for (const banner of previousBanners) {
  const failed = failedBannerSources.some((source) => source.provider === banner.provider && source.category === banner.category);
  if (failed && !bannerMap.has(banner.id)) bannerMap.set(banner.id, { ...banner, freshness: 'preserved_source_failure' });
}
const currentBanners = [...bannerMap.values()];
const warnings = [];
if (failedPlanSources.length) warnings.push(`${failedPlanSources.length} plan sources did not expose priced cards or were blocked; matching previous records were preserved when available.`);
if (failedBannerSources.length) warnings.push(`${failedBannerSources.length} banner sources were partial or blocked; their previous images were preserved.`);
const payload = {
  generated_at: new Date().toISOString(),
  source: 'Live public telecom plan pages and targeted homepage banner sources',
  mode: warnings.length ? 'live_partial' : 'live',
  fetch_warning: warnings.join(' '),
  source_matrix: sourceMatrix,
  source_links: sources,
  coverage: sourceFilter ? [...previousCoverage.filter((item) => !configuredSourceKeys.has(`${item.provider}|${item.source_url}`)), ...coverage] : coverage,
  banner_coverage: bannerResult.coverage,
  data: currentData.length ? currentData : previousData,
  banners: currentBanners.length ? currentBanners : previousBanners,
};

await mkdir(path.dirname(dataPath), { recursive: true });
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ plans: payload.data.length, banners: payload.banners.length, fetched: currentData.length, coverage, banner_coverage: payload.banner_coverage }, null, 2));
