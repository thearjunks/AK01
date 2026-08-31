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

console.log('');
console.log('An Instagram browser window is open.');
console.log('1. Log in to Instagram.');
console.log('2. Complete any security checks.');
console.log('3. Come back to this window and press Enter.');
console.log('Facebook uses the dashboard Connect Facebook button and Meta OAuth; this script never collects a Facebook password.');
console.log('');

const rl = createInterface({ input, output });
await rl.question('Press Enter after Instagram is logged in...');
rl.close();

await context.close();
console.log('Instagram login session saved. Use Connect Facebook in the Facebook dashboard for Meta OAuth.');
