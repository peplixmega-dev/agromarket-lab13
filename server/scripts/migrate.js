import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const path = process.argv[2];
if (!path || !process.env.DATABASE_URL) {
  console.error('Задайте DATABASE_URL и путь к SQL-файлу');
  process.exitCode = 1;
} else {
  const target = new URL(process.env.DATABASE_URL);
  const client = new pg.Client({ connectionString: target.href });
  try {
    console.log('База:', target.hostname, target.pathname);
    await client.connect();
    await client.query(await readFile(path, 'utf8'));
    console.log('Применено:', path);
  } catch (error) {
    console.error('Миграция не удалась:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
