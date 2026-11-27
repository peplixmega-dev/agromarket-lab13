import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../app.js';
import { pool } from '../db/pool.js';

let seller, otherSeller, buyer, otherBuyer, honey, potato;
const address = 'Астана, ул. Женис, 62';
const bearer = (call, user) => call.auth(user.token, { type: 'bearer' });
const checkout = (user, items, extra = {}) => bearer(request(app).post('/api/orders'), user)
  .send({ items, address, ...extra });
const item = (productId, quantity) => ({ productId, quantity });
const cancel = (id, user) => bearer(request(app).post(`/api/orders/${id}/cancel`), user);
async function user(name, role) {
  const { rows: [u] } = await pool.query(
    "INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,'unused',$3) RETURNING id",
    [name, `${randomUUID()}@example.test`, role],
  );
  return { ...u, token: jwt.sign({ sub: String(u.id), role }, process.env.JWT_SECRET) };
}
async function product(owner, name, price, stock) {
  const { rows } = await pool.query(
    'INSERT INTO products(farmer_id,name,price,stock) VALUES ($1,$2,$3,$4) RETURNING id',
    [owner.id, name, price, stock],
  );
  return rows[0].id;
}
const stockOf = async (id) => (await pool.query('SELECT stock FROM products WHERE id=$1', [id])).rows[0].stock;
const ordersOf = async (id) => (await pool.query(
  'SELECT count(*)::int AS n FROM purchase_orders WHERE buyer_id = $1', [id],
)).rows[0].n;

beforeEach(async () => {
  seller = await user('Ержан', 'admin');
  otherSeller = await user('Дана', 'admin');
  buyer = await user('Айгерим', 'user');
  otherBuyer = await user('Данияр', 'user');
  honey = await product(seller, 'Мёд', 3500, 10);
  potato = await product(otherSeller, 'Картофель', 250, 1);
});

test('заказ сохраняет цену, адрес, количество и списывает остатки', async () => {
  const res = await checkout(buyer, [item(honey, 2)]);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ status: 'new', total: 7000, address, items: [{ productId: honey, price: 3500, quantity: 2 }] });
  expect(await stockOf(honey)).toBe(8);
  await pool.query('UPDATE products SET price=1 WHERE id=$1', [honey]);
  const mine = await bearer(request(app).get('/api/orders/my'), buyer);
  expect(mine.body[0]).toMatchObject({ total: 7000, items: [{ price: 3500 }] });
});

test('сервер игнорирует цену и сумму из формы', async () => {
  const res = await checkout(buyer, [{ ...item(honey, 1), price: 1 }], { total: 1 });
  expect(res.status).toBe(201);
  expect(res.body.total).toBe(3500);
});

test('объединяет повторяющиеся позиции, сохраняет ограничение 100 штук на товар', async () => {
  const res = await checkout(buyer, [item(honey, 2), item(honey, 3)]);
  expect(res.status).toBe(201);
  expect(res.body.items).toEqual([{ productId: honey, name: 'Мёд', quantity: 5, price: 3500 }]);
  expect((await checkout(buyer, [item(honey, 100), item(honey, 1)])).status).toBe(400);
});

test('при нехватке возвращает доступное количество, запас других товаров и база заказов не меняются', async () => {
  const res = await checkout(buyer, [item(honey, 2), item(potato, 5)]);
  expect(res.status).toBe(409);
  expect(res.body.details).toEqual([{ productId: potato, name: 'Картофель', available: 1 }]);
  expect(await stockOf(honey)).toBe(10);
  expect(await stockOf(potato)).toBe(1);
  expect(await ordersOf(buyer.id)).toBe(0);
});

test('отклоняет пустую корзину, нулевое количество и короткий адрес', async () => {
  const res = await checkout(buyer, []);
  expect(res.status).toBe(400);
  expect(res.body.details).toContainEqual({ field: 'items', message: 'Корзина пуста' });
  expect((await checkout(buyer, [item(honey, 0)])).status).toBe(400);
  expect((await checkout(buyer, [item(honey, 1)], { address: '  а  ' })).status).toBe(400);
});

test('отсутствующий товар даёт 404 без частичного списания', async () => {
  expect((await checkout(buyer, [item(honey, 2), item(2147483647, 1)])).status).toBe(404);
  expect(await ordersOf(buyer.id)).toBe(0);
  expect(await stockOf(honey)).toBe(10);
});

test('гость получает 401 при оформлении', async () => {
  const res = await request(app).post('/api/orders').send({ items: [item(honey, 1)], address });
  expect(res.status).toBe(401);
});

test.skipIf(process.env.LAB_PGLITE === '1')('гонка: два соединения ожидают последнюю единицу и только один заказ проходит', async () => {
  const blocker = await pool.connect();
  let pending;
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [potato]);
    pending = Promise.all([checkout(buyer, [item(potato, 1)]), checkout(otherBuyer, [item(potato, 1)])]);

    // Наблюдаем фактическую очередь PostgreSQL, не полагаемся на задержку в 300 мс.
    await expect.poll(async () => {
      const result = await pool.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database()
         AND wait_event_type='Lock' AND query LIKE 'SELECT id, name, price, stock FROM products%'`,
      );
      return result.rows[0].n;
    }, { timeout: 5000 }).toBe(2);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    if (pending) await pending;
  }
  const replies = await pending;
  expect(replies.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(replies.find((r) => r.status === 409).body.details[0]).toMatchObject({ productId: potato, available: 0 });
  expect(await stockOf(potato)).toBe(0);
  expect(await ordersOf(buyer.id) + await ordersOf(otherBuyer.id)).toBe(1);
});

test('покупатель видит только собственные заказы', async () => {
  const own = await checkout(buyer, [item(honey, 1)]);
  await checkout(otherBuyer, [item(honey, 2)]);
  const res = await bearer(request(app).get('/api/orders/my'), buyer);
  expect(res.status).toBe(200);
  expect(res.body.map((o) => o.id)).toEqual([own.body.id]);
});

test('входящие содержат только позиции этого продавца; покупателю доступ запрещён', async () => {
  await checkout(buyer, [item(honey, 1), item(potato, 1)]);
  const res = await bearer(request(app).get('/api/orders/incoming'), seller);
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0]).toMatchObject({ buyerName: 'Айгерим', product: 'Мёд', quantity: 1, price: 3500, address });
  expect((await bearer(request(app).get('/api/orders/incoming'), buyer)).status).toBe(403);
});

test('отмена возвращает остатки сразу для двух товаров', async () => {
  const { body } = await checkout(buyer, [item(honey, 2), item(potato, 1)]);
  const res = await cancel(body.id, buyer);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ id: body.id, status: 'cancelled' });
  expect(await stockOf(honey)).toBe(10);
  expect(await stockOf(potato)).toBe(1);
});

test('чужой и отсутствующий заказ возвращают одинаковый 404', async () => {
  const { body } = await checkout(buyer, [item(potato, 1)]);
  const foreign = await cancel(body.id, otherBuyer);
  expect(foreign.status).toBe(404);
  const missing = await cancel(2147483647, otherBuyer);
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual(foreign.body);
  expect(await stockOf(potato)).toBe(0);
});

test('повторная отмена возвращает 409, запас возвращается один раз', async () => {
  const { body } = await checkout(buyer, [item(potato, 1)]);
  expect((await cancel(body.id, buyer)).status).toBe(200);
  expect((await cancel(body.id, buyer)).status).toBe(409);
  expect(await stockOf(potato)).toBe(1);
});

test('остаток меняет владелец, товар в заказе защищён от удаления', async () => {
  const edit = (who, stock) => bearer(request(app).patch(`/api/products/${honey}`), who).send({ stock });
  expect((await edit(seller, -1)).status).toBe(400);
  expect((await edit(otherSeller, 2)).status).toBe(404);
  expect((await edit(seller, 12)).body.stock).toBe(12);
  await checkout(buyer, [item(honey, 1)]);
  expect((await bearer(request(app).delete(`/api/products/${honey}`), seller)).status).toBe(409);
});
