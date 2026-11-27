// Сравнивает планы двух запросов к временной таблице. EXPLAIN не исполняет запросы.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';

const target = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/agromarket_test') {
  throw new Error('Требуется локальная agromarket_test');
}
const client = new pg.Client({ connectionString: target.href });
const nodes = (plan) => [plan['Node Type'], ...(plan.Plans || []).flatMap(nodes)];
await client.connect();
try {
  await client.query('CREATE TEMP TABLE lab13_lock_fixture(id integer PRIMARY KEY, stock integer)');
  for (const [label, clause] of [['Защищённое чтение', 'FOR UPDATE'], ['Контрольная фикстура', '']]) {
    const { rows } = await client.query(
      `EXPLAIN (FORMAT JSON) SELECT id, stock FROM lab13_lock_fixture WHERE id = 1 ORDER BY id ${clause}`,
    );
    const plan = nodes(rows[0]['QUERY PLAN'][0].Plan);
    const rowLock = plan.includes('LockRows');
    console.log(`${label}: ${plan.join(' → ')}; проверка наличия LockRows: ${rowLock ? 'PASS' : 'FAIL'}`);
    assert.equal(rowLock, Boolean(clause));
  }
} finally {
  await client.end();
}
