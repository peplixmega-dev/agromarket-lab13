import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const url = process.env.BASE_URL || process.env.E2E_BASE_URL || process.env.PRODUCTION_URL;
if (!url || new URL(url).protocol !== 'https:') {
  console.error('Задайте E2E_BASE_URL или PRODUCTION_URL с HTTPS-адресом развёрнутого сайта.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)),
  'test', '--grep', '@smoke', ...process.argv.slice(2),
], { stdio: 'inherit', env: { ...process.env, E2E_BASE_URL: url } });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
