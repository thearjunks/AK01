import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const thumbnailDirectory = path.join(process.cwd(), 'public', 'social-thumbnails');
const contentTypes = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(request) {
  const requestedPath = request.nextUrl.searchParams.get('path') || '';
  const fileName = path.basename(requestedPath);
  const extension = path.extname(fileName).toLowerCase();
  if (!/^[a-f0-9]{20}\.(gif|jpe?g|png|webp)$/i.test(fileName) || !contentTypes[extension]) {
    return NextResponse.json({ ok: false, error: 'Invalid social image path.' }, { status: 400 });
  }

  try {
    const image = await readFile(path.join(thumbnailDirectory, fileName));
    return new NextResponse(image, {
      headers: {
        'content-type': contentTypes[extension],
        'cache-control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Social image was not found.' }, { status: 404 });
  }
}
