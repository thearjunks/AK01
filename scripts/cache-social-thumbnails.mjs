import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'data', 'social-posts.json');
const thumbnailDir = path.join(root, 'public', 'social-thumbnails');
const timeoutMs = 20000;
const concurrency = 8;

function thumbnailUrl(post) {
  return String(post.thumbnail_url || post.thumbnail || post.image_url || post.media_url || post.cover_url || '').trim();
}

function hashUrl(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 20);
}

function extensionFor(url, contentType = '') {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext;
  } catch {}
  return '.jpg';
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 Social Thumbnail Cache',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) throw new Error(`not an image (${contentType || 'unknown content type'})`);
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
  } finally {
    clearTimeout(timer);
  }
}

async function worker(queue, results) {
  while (queue.length) {
    const url = queue.shift();
    const baseName = hashUrl(url);
    const knownExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const existing = await Promise.all(knownExtensions.map(async (ext) => {
      const filePath = path.join(thumbnailDir, `${baseName}${ext}`);
      return (await exists(filePath)) ? `/social-thumbnails/${baseName}${ext}` : null;
    }));
    const existingUrl = existing.find(Boolean);
    if (existingUrl) {
      results.set(url, { ok: true, reused: true, publicUrl: existingUrl });
      continue;
    }

    try {
      const image = await downloadImage(url);
      const ext = extensionFor(url, image.contentType);
      const fileName = `${baseName}${ext}`;
      await writeFile(path.join(thumbnailDir, fileName), image.buffer);
      results.set(url, { ok: true, reused: false, publicUrl: `/social-thumbnails/${fileName}` });
    } catch (error) {
      results.set(url, { ok: false, error: error.message });
    }
  }
}

const payload = JSON.parse(await readFile(dataPath, 'utf8'));
const records = Array.isArray(payload) ? payload : payload.data || [];
const urls = [...new Set(records.map(thumbnailUrl).filter(Boolean))];
const queue = [...urls];
const results = new Map();

await mkdir(thumbnailDir, { recursive: true });
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker(queue, results)));

let rowsUpdated = 0;
for (const post of records) {
  const url = thumbnailUrl(post);
  const result = results.get(url);
  if (result?.ok) {
    if (post.local_thumbnail_url !== result.publicUrl) rowsUpdated += 1;
    post.local_thumbnail_url = result.publicUrl;
  }
}

await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const downloaded = [...results.values()].filter((item) => item.ok && !item.reused).length;
const reused = [...results.values()].filter((item) => item.ok && item.reused).length;
const failed = [...results.values()].filter((item) => !item.ok).length;

console.log(JSON.stringify({
  posts: records.length,
  uniqueThumbnailUrls: urls.length,
  downloaded,
  reused,
  failed,
  rowsUpdated,
}, null, 2));
