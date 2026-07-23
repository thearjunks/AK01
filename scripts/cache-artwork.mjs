import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'ads.json');
const artworkDir = path.join(root, 'public', 'artwork');
const timeoutMs = 20000;
const concurrency = 6;

const extensionByType = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

function hashUrl(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 20);
}

function extensionFor(url, contentType = '') {
  const cleanType = contentType.split(';')[0].trim().toLowerCase();
  if (extensionByType.has(cleanType)) return extensionByType.get(cleanType);
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname);
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 Meta Ads Dashboard Artwork Cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`not an image (${contentType || 'unknown content type'})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  } finally {
    clearTimeout(timer);
  }
}

async function worker(urls, results) {
  while (urls.length) {
    const url = urls.shift();
    const baseName = hashUrl(url);
    const knownExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const existing = await Promise.all(knownExtensions.map(async (ext) => {
      const filePath = path.join(artworkDir, `${baseName}${ext}`);
      return (await exists(filePath)) ? { filePath, publicUrl: `/artwork/${baseName}${ext}` } : null;
    }));
    const existingMatch = existing.find(Boolean);

    if (existingMatch) {
      results.set(url, { ok: true, reused: true, publicUrl: existingMatch.publicUrl });
      continue;
    }

    try {
      const image = await fetchImage(url);
      const ext = extensionFor(url, image.contentType);
      const fileName = `${baseName}${ext}`;
      await writeFile(path.join(artworkDir, fileName), image.buffer);
      results.set(url, { ok: true, reused: false, publicUrl: `/artwork/${fileName}` });
    } catch (error) {
      results.set(url, { ok: false, error: error.message });
    }
  }
}

const raw = await readFile(dataPath, 'utf8');
const payload = JSON.parse(raw);
const records = Array.isArray(payload) ? payload : payload.data || [];
const urls = [...new Set(records.map((ad) => String(ad.artwork_url || '').trim()).filter(Boolean))];
const missingArtwork = records.filter((ad) => !String(ad.artwork_url || '').trim()).length;
const queue = [...urls];
const results = new Map();

await mkdir(artworkDir, { recursive: true });
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker(queue, results)));

let rowsUpdated = 0;
records.forEach((ad) => {
  const url = String(ad.artwork_url || '').trim();
  const result = results.get(url);
  if (result?.ok) {
    if (ad.local_artwork_url !== result.publicUrl) rowsUpdated += 1;
    ad.local_artwork_url = result.publicUrl;
  }
});

await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`);

const downloaded = [...results.values()].filter((item) => item.ok && !item.reused).length;
const reused = [...results.values()].filter((item) => item.ok && item.reused).length;
const failed = [...results.values()].filter((item) => !item.ok).length;

console.log(JSON.stringify({
  ads: records.length,
  missingArtwork,
  uniqueArtworkUrls: urls.length,
  downloaded,
  reused,
  failed,
  rowsUpdated,
}, null, 2));

if (failed) {
  console.log('Some Meta CDN URLs could not be downloaded. They may be expired, blocked, or no longer available.');
}
