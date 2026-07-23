const http = require('node:http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.APP_HOST || '0.0.0.0';
const port = Number(process.env.PORT || process.env.NEXT_PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = http.createServer((request, response) => handle(request, response));
    server.listen(port, hostname, () => {
      console.log(`stc competitor dashboard ready on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start the stc competitor dashboard:', error);
    process.exit(1);
  });
