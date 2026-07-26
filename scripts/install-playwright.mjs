import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const playwrightCli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
const result = spawnSync(
  process.execPath,
  [playwrightCli, 'install', '--only-shell', 'chromium'],
  {
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
    stdio: 'inherit',
    windowsHide: true,
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
