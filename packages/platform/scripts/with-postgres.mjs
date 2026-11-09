// Runs a command with DATABASE_URL pointing at a PostgreSQL >= 16 instance.
// Order: existing DATABASE_URL -> docker compose service -> ephemeral local cluster (PG binaries).
// Fails loudly when none is available: database gates are never silently skipped.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, chmodSync, chownSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: with-postgres.mjs <command> [args...]');
  process.exit(2);
}

const run = (command, argv, opts = {}) => spawnSync(command, argv, { encoding: 'utf8', ...opts });

function exec(url) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function pgBinDir() {
  if (process.env['PG_BIN_DIR']) return process.env['PG_BIN_DIR'];
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return null;
  const versions = readdirSync(base)
    .filter((v) => Number(v) >= 16)
    .sort((a, b) => Number(b) - Number(a));
  return versions[0] ? join(base, versions[0], 'bin') : null;
}

if (process.env['DATABASE_URL']) {
  process.exit(await exec(process.env['DATABASE_URL']));
}

if (run('docker', ['info']).status === 0) {
  const up = run('docker', ['compose', 'up', '-d', '--wait', 'postgres'], { stdio: 'inherit' });
  if (up.status !== 0) process.exit(up.status ?? 1);
  process.exit(await exec('postgresql://cc:cc_dev_only@localhost:5432/cc'));
}

const bin = pgBinDir();
if (!bin) {
  console.error(
    'No PostgreSQL available: set DATABASE_URL, start Docker (pnpm db:up), or install PostgreSQL >= 16.',
  );
  process.exit(1);
}

// Ephemeral local cluster (only used when Docker is unavailable).
const asRoot = process.getuid?.() === 0;
const dir = mkdtempSync(join(tmpdir(), 'cc-pg-'));
if (asRoot) {
  chownSync(dir, 102, 104);
}
chmodSync(dir, 0o700);
const as = (command, argv) =>
  asRoot ? run('runuser', ['-u', 'postgres', '--', command, ...argv]) : run(command, argv);
const port = await freePort();
const data = join(dir, 'data');
let code = 1;
try {
  const init = as(join(bin, 'initdb'), ['-D', data, '-U', 'cc', '--auth=trust', '-E', 'UTF8']);
  if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
  const start = as(join(bin, 'pg_ctl'), [
    '-D',
    data,
    '-w',
    '-l',
    join(dir, 'pg.log'),
    '-o',
    `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${dir}`,
    'start',
  ]);
  if (start.status !== 0) throw new Error(`pg_ctl start failed: ${start.stdout}${start.stderr}`);
  const mk = as(join(bin, 'createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'cc', 'cc']);
  if (mk.status !== 0) throw new Error(`createdb failed: ${mk.stderr}`);
  code = await exec(`postgresql://cc@127.0.0.1:${port}/cc`);
} catch (e) {
  console.error(String(e));
} finally {
  as(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop']);
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
