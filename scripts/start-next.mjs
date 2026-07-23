import { spawn } from 'node:child_process';

const host = process.env.APP_HOST || '0.0.0.0';
const port = process.env.PORT || process.env.NEXT_PORT || '5173';
const command = process.execPath;

const child = spawn(command, ['./node_modules/next/dist/bin/next', 'start', '--hostname', host, '--port', port], {
  stdio: 'inherit',
  windowsHide: true,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code || 0);
});
