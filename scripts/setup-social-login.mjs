import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const authProfileDir = process.env.SOCIAL_BROWSER_PROFILE_DIR || path.join(root, '.auth', 'social-browser');

await mkdir(authProfileDir, { recursive: true });

let context;
try {
  context = await chromium.launchPersistentContext(authProfileDir, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
  });
} catch {
  context = await chromium.launchPersistentContext(authProfileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
  });
}

const pages = context.pages();
const instagramPage = pages[0] || await context.newPage();
await instagramPage.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });

const facebookPage = await context.newPage();
await facebookPage.goto('https://www.facebook.com/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });

console.log('');
console.log('A browser window is open.');
console.log('1. Log in to Instagram in one tab.');
console.log('2. Log in to Facebook in the other tab.');
console.log('3. Complete any security checks.');
console.log('4. Come back to this window and press Enter.');
console.log('');

const rl = createInterface({ input, output });
await rl.question('Press Enter after both accounts are logged in...');
rl.close();

await context.close();
console.log('Social login session saved. You can now use Fetch live organic posts in the dashboard.');
