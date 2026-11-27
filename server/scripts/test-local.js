import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import net from 'node:net';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const password = randomBytes(24).toString('hex');
const args = process.argv.slice(2);
const candidates = [
  process.env.PG_BIN,
  ...process.env.PATH.split(delimiter),
  '/Applications/Postgres.app/Contents/Versions/latest/bin',
].filter(Boolean);
const bin = candidates.find((dir) => ['initdb', 'pg_ctl', 'createdb'].every((name) => existsSync(join(dir, name))));

async function test(databaseURL, pglite = false) {
  const env = { ...process.env,
    AGRO_EMBEDDED_DB: pglite ? '1' : '0',
    LAB_PGLITE: pglite ? '1' : '0', LAB_TEST_ISOLATED: '1', NODE_ENV: 'test',
    DATABASE_URL: databaseURL, JWT_SECRET: randomBytes(48).toString('base64url'),
    CORS_ORIGINS: 'http://localhost:5173,https://frontend.example',
    CORS_ORIGIN: 'http://localhost:5173,https://frontend.example',
    ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: 'TestAdmin12345!',
  };
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...args], {
    cwd, env, stdio: 'inherit',
  });
  const stop = () => child.kill('SIGTERM');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    for (const signal of ['SIGINT', 'SIGTERM']) process.removeListener(signal, stop);
  }
}

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function nativeTest(port) {
  const dir = mkdtempSync(join(tmpdir(), 'agromarket-test-'));
  const data = join(dir, 'data');
  let started = false;
  try {
    const pwfile = join(dir, 'password');
    writeFileSync(pwfile, password, { mode: 0o600 });
    execFileSync(join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--pwfile', pwfile,
      '--auth=scram-sha-256', '--no-locale', '--encoding=UTF8'], { stdio: ['ignore', 'ignore', 'inherit'] });
    // Записываем настройки в конфиг, чтобы пути с пробелами не разбирались оболочкой.
    const configPath = join(data, 'postgresql.auto.conf');
    const socketConfig = process.platform === 'win32' ? '' : "unix_socket_directories = ''\n";
    writeFileSync(configPath, `listen_addresses = '127.0.0.1'\nport = ${port}\n${socketConfig}`);
    execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', join(dir, 'postgres.log'), '-w', 'start']);
    started = true;
    execFileSync(join(bin, 'createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'agromarket_test'],
      { env: { ...process.env, PGPASSWORD: password } });
    console.log('Временный PostgreSQL: включена проверка конкурентных транзакций.');
    return await test(`postgresql://postgres:${password}@127.0.0.1:${port}/agromarket_test`);
  } finally {
    if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-w', '-m', 'fast', 'stop']);
    rmSync(dir, { recursive: true, force: true });
  }
}

async function embeddedTest(port) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const db = await PGlite.create();
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port, maxConnections: 10 });
  try {
    await socket.start();
    console.log('PGlite: тест очереди блокировок требует сервер PostgreSQL и будет пропущен.');
    return await test(`postgresql://postgres:postgres@127.0.0.1:${port}/agromarket_test`, true);
  } finally {
    await socket.stop();
    await db.close();
  }
}

const port = await freePort();
process.exitCode = bin && process.getuid?.() !== 0 ? await nativeTest(port) : await embeddedTest(port);
