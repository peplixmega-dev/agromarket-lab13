import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

import { validate, idParam } from '../middleware/validate.js';
import { productSchema, productUpdateSchema } from '../validation/schemas.js';
const router = Router();
// GET /api/products?search=мол
router.get("/", async (req, res) => {
  const search = req.query.search || "";
  const { rows } = await pool.query(
    "SELECT * FROM products WHERE name ILIKE $1 ORDER BY id",
    [`%${search}%`],
  );
  res.json(rows);
});

// GET /api/products/2
router.get("/:id", idParam, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [
    req.params.id,
  ]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Товар не найден" });
  }
  res.json(rows[0]);
});
// POST /api/products — новый товар
router.post("/", requireAuth, requireRole("admin"), validate(productSchema), async (req, res) => {
  const body = req.body || {};

  const { name, category, price, unit, image } = body;
  const { rows } = await pool.query(
    `INSERT INTO products (name, category, price, unit, image)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, category ?? null, Number(price), unit ?? "кг", image ?? null],
  );
  res.status(201).json(rows[0]); // вернули созданный товар вместе с новым id
});

// PUT /api/products/5 — заменить товар целиком
router.put("/:id", requireAuth, requireRole("admin"), idParam, validate(productSchema), async (req, res) => {
  const body = req.body || {};

  const { name, category, price, unit, image } = body;
  const { rows } = await pool.query(
    `UPDATE products
     SET name = $1, category = $2, price = $3, unit = $4, image = $5
     WHERE id = $6
     RETURNING *`,
    [
      name,
      category ?? null,
      Number(price),
      unit ?? "кг",
      image ?? null,
      req.params.id,
    ],
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Товар не найден" });
  }
  res.json(rows[0]);
});

router.delete("/:id", requireAuth, requireRole("admin"), idParam, async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [
    req.params.id,
  ]);
  if (rowCount === 0) {
    return res.status(404).json({ error: "Товар не найден" });
  }
  res.status(204).send();
});

router.patch('/:id', requireAuth, requireRole('admin'), idParam, validate(productUpdateSchema), async (req, res) => {
  const fields = ['name', 'category', 'price', 'unit', 'image'].filter((field) => Object.hasOwn(req.body, field));
  const values = fields.map((field) => req.body[field]);
  const assignments = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE products SET ${assignments} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Товар не найден' });
  res.json(rows[0]);
});

export default router;
