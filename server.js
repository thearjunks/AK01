const http = require('node:http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.APP_HOST || '0.0.0.0';
const port = Number(process.env.PORT || process.env.NEXT_PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const adsRefreshIntervalMs = Number(process.env.ADS_REFRESH_INTERVAL_MS || 10 * 60 * 1000);
const comparisonRefreshIntervalMs = Number(process.env.COMPARISON_REFRESH_INTERVAL_MS || 60 * 60 * 1000);

async function startScheduledAdsRefresh() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/fetch-live`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    const result = await response.json();
    console.log(`[scheduled-ads-refresh] ${result.message || `HTTP ${response.status}`}`);
  } catch (error) {
    console.error(`[scheduled-ads-refresh] ${error.message}`);
  }
}

async function startScheduledComparisonRefresh(endpoint, label) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method: 'POST', headers: { accept: 'application/json' } });
    const result = await response.json();
    console.log(`[scheduled-${label}-refresh] ${result.job?.message || `HTTP ${response.status}`}`);
  } catch (error) {
    console.error(`[scheduled-${label}-refresh] ${error.message}`);
  }
}

app.prepare()
  .then(() => {
    const server = http.createServer((request, response) => handle(request, response));
    server.listen(port, hostname, () => {
      console.log(`stc competitor dashboard ready on http://${hostname}:${port}`);
      if (adsRefreshIntervalMs > 0) {
        const timer = setInterval(startScheduledAdsRefresh, adsRefreshIntervalMs);
        timer.unref();
        console.log(`[scheduled-ads-refresh] enabled every ${Math.round(adsRefreshIntervalMs / 60000)} minutes`);
      }
      if (comparisonRefreshIntervalMs > 0) {
        const plansTimer = setInterval(() => startScheduledComparisonRefresh('/api/fetch-plans', 'plans-banners'), comparisonRefreshIntervalMs);
        const devicesTimer = setInterval(() => {
          const delayedDeviceTimer = setTimeout(() => startScheduledComparisonRefresh('/api/fetch-devices', 'devices'), 7 * 60 * 1000);
          delayedDeviceTimer.unref();
        }, comparisonRefreshIntervalMs);
        plansTimer.unref();
        devicesTimer.unref();
        const initialPlansTimer = setTimeout(() => startScheduledComparisonRefresh('/api/fetch-plans', 'plans-banners'), 60 * 1000);
        const initialDevicesTimer = setTimeout(() => startScheduledComparisonRefresh('/api/fetch-devices', 'devices'), 8 * 60 * 1000);
        initialPlansTimer.unref();
        initialDevicesTimer.unref();
        console.log(`[scheduled-comparison-refresh] enabled every ${Math.round(comparisonRefreshIntervalMs / 60000)} minutes`);
      }
    });
  })
  .catch((error) => {
    console.error('Failed to start the stc competitor dashboard:', error);
    process.exit(1);
  });
