// Web smoke test: serve the production build and fetch the home page and PWA manifest.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const port = await new Promise((resolve) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => {
    const { port: p } = s.address();
    s.close(() => resolve(p));
  });
});
const server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
  stdio: 'inherit',
});
let failed = false;
try {
  const base = `http://127.0.0.1:${port}`;
  let home;
  for (let i = 0; i < 60; i++) {
    try {
      home = await fetch(base);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (home?.status !== 200 || !(await home.text()).includes('Compile Companion'))
    throw new Error('home page smoke failed');
  const manifest = await fetch(`${base}/manifest.webmanifest`);
  if (manifest.status !== 200 || (await manifest.json()).display !== 'standalone')
    throw new Error('manifest smoke failed');
  console.log('web smoke ok');
} catch (e) {
  console.error(String(e));
  failed = true;
} finally {
  server.kill('SIGTERM');
}
process.exit(failed ? 1 : 0);
