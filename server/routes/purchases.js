import { Router } from 'express';
import { pool } from '../db/pool.js';
import { transaction } from '../db/transaction.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, idParam } from '../middleware/validate.js';
import { checkoutSchema } from '../validation/schemas.js';

const router = Router();
const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });

// В ЛР7 POST на этот же URL принимал оптовую заявку. У неё отдельные поля и таблица.
router.post('/', (req, res, next) => {
  const body = req.body ?? {};
  const wholesale = !Object.hasOwn(body, 'items') && !Object.hasOwn(body, 'address')
    && ['email', 'name', 'quantity', 'product_id'].some((field) => Object.hasOwn(body, field));
  next(wholesale ? 'route' : undefined);
}, requireAuth, validate(checkoutSchema), async (req, res) => {
  const wanted = new Map();
  for (const { productId, quantity } of req.body.items) {
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }

  const order = await transaction(async (client) => {
    const { rows: products } = await client.query(
      'SELECT id, name, price, stock FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [[...wanted.keys()]],
    );
    if (products.length !== wanted.size) throw httpError(404, 'Товар не найден');
    const shortage = products.filter((p) => p.stock < wanted.get(p.id))
      .map((p) => ({ productId: p.id, name: p.name, available: p.stock }));
    if (shortage.length) throw httpError(409, 'Недостаточно товара', shortage);

    if (products.some((p) => p.price <= 0)) throw httpError(409, 'Продавец ещё не указал цену товара');

    const total = products.reduce((sum, p) => sum + p.price * wanted.get(p.id), 0);
    const { rows: [header] } = await client.query(
      `INSERT INTO purchase_orders (buyer_id, total, address) VALUES ($1, $2, $3)
       RETURNING id, status, created_at`, [req.user.id, total, req.body.address],
    );
    const items = [];
    for (const p of products) {
      const quantity = wanted.get(p.id);
      await client.query(
        'INSERT INTO order_items(order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [header.id, p.id, quantity, p.price],
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [quantity, p.id]);
      items.push({ productId: p.id, name: p.name, quantity, price: p.price });
    }
    return { ...header, total, address: req.body.address, items };
  });
  res.status(201).json(order);
});

router.get('/my', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.created_at, o.address, o.total,
            json_agg(json_build_object('productId', i.product_id, 'name', p.name,
                     'price', i.price, 'quantity', i.quantity) ORDER BY p.id) AS items
       FROM purchase_orders o
       JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
      WHERE o.buyer_id = $1 GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC`, [req.user.id],
  );
  res.json(rows.map((row) => ({ ...row, total: Number(row.total) })));
});

router.get('/incoming', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id AS "orderId", o.status, o.created_at, o.address, u.name AS "buyerName",
            p.name AS product, i.quantity, i.price
       FROM order_items i JOIN products p ON p.id = i.product_id
       JOIN purchase_orders o ON o.id = i.order_id JOIN users u ON u.id = o.buyer_id
      WHERE p.farmer_id = $1 ORDER BY o.created_at DESC, o.id DESC, p.id`, [req.user.id],
  );
  res.json(rows);
});

router.post('/:id/cancel', requireAuth, idParam, async (req, res) => {
  const id = req.params.id;
  const order = await transaction(async (client) => {
    const { rows: [current] } = await client.query(
      'SELECT status FROM purchase_orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE', [id, req.user.id],
    );
    if (!current) throw httpError(404, 'Заказ не найден');
    if (current.status !== 'new') throw httpError(409, 'Заказ уже нельзя отменить');

    // Такой же порядок блокировок товаров, как при создании соседнего заказа.
    await client.query(
      `SELECT p.id FROM products p JOIN order_items i ON i.product_id = p.id
        WHERE i.order_id = $1 ORDER BY p.id FOR UPDATE OF p`, [id],
    );
    await client.query(
      `UPDATE products p SET stock = p.stock + i.quantity FROM order_items i
        WHERE i.order_id = $1 AND p.id = i.product_id`, [id],
    );
    const { rows } = await client.query(
      "UPDATE purchase_orders SET status = 'cancelled' WHERE id = $1 RETURNING id, status", [id],
    );
    return rows[0];
  });
  res.json(order);
});

export default router;
