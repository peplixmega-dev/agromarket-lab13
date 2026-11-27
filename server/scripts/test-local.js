import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const db = await PGlite.create();
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55441, maxConnections: 10 });
try {
  await socket.start();
  const env = { ...process.env,
    LAB_TEST_ISOLATED: '1', NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55441/agromarket_test',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    CORS_ORIGINS: 'http://localhost:5173,https://frontend.example',
    CORS_ORIGIN: 'http://localhost:5173,https://frontend.example',
    ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: 'TestAdmin12345!',
  };
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], { cwd, env, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await socket.stop();
  await db.close();
}
