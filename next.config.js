/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/fetch-live': [
      './scripts/scrape-meta-ads.mjs',
      './scripts/cache-artwork.mjs',
      './src/data/pages.js',
      './node_modules/playwright/**/*',
      './node_modules/playwright-core/**/*',
    ],
    '/api/fetch-social-posts': [
      './scripts/scrape-organic-posts.mjs',
      './scripts/cache-social-thumbnails.mjs',
      './node_modules/playwright/**/*',
      './node_modules/playwright-core/**/*',
    ],
    '/api/social-image': ['./public/social-thumbnails/**/*'],
  },
};

module.exports = nextConfig;
