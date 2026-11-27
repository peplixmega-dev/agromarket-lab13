import { readFile } from 'node:fs/promises';
import { pool } from '../db/pool.js';

test('013 дважды обновляет схему ЛР12 с заявкой, сохраняя товар и запись заявки', async () => {
  const migration = await readFile(new URL('../db/migrations/013_orders.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  // Обособленная схема нужна, поскольку SQL миграции сам открывает и завершает транзакцию.
  const schema = 'test_migrate_013';
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE users (id integer PRIMARY KEY);
      CREATE TABLE products (id integer PRIMARY KEY, name text, price integer);
      CREATE TABLE orders (id integer PRIMARY KEY, product_id integer REFERENCES products(id), email text);
      INSERT INTO users VALUES (1);
      INSERT INTO products VALUES (1,'Яблоки',300);
      INSERT INTO orders VALUES (1,1,'example@example.test');
    `);
    for (let i = 0; i < 2; i++) await client.query(migration);
    expect((await client.query('SELECT * FROM products')).rows).toEqual([
      { id: 1, name: 'Яблоки', price: 300, stock: 0, farmer_id: null },
    ]);
    expect((await client.query('SELECT * FROM orders')).rows).toEqual([
      { id: 1, product_id: 1, email: 'example@example.test' },
    ]);
    expect((await client.query('SELECT * FROM purchase_orders')).rows).toEqual([]);
  } finally {
    await client.query('ROLLBACK');
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  }
});
