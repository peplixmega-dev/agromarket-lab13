import "dotenv/config";
import { readFileSync } from "node:fs";
import { pool } from "./pool.js";
import bcrypt from "bcryptjs";

// db:init удаляет таблицы. Для облачной базы нужен явный --force.
const target = process.env.DATABASE_URL;
let hostname = process.env.PGHOST || "";
if (target) {
  try {
    hostname = new URL(target).hostname;
  } catch {
    console.error("Некорректный DATABASE_URL");
    process.exit(1);
  }
}
const isLocal = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
if (!isLocal && !process.argv.includes("--force")) {
  console.error("Отказ: db:init запущен НЕ на локальной базе — все данные будут удалены.");
  console.error("Если база пустая и вы уверены: node db/seed.js --force");
  process.exit(1);
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("Для db:init задайте ADMIN_EMAIL и ADMIN_PASSWORD");
  process.exit(1);
}

async function seed() {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf-8");
  const { products } = JSON.parse(readFileSync(new URL("../data/db.json", import.meta.url), "utf-8"));

  await pool.query(schema); // 1. создаём таблицы

  for (const p of products) {
    // 2. переносим товары из db.json
    await pool.query(
      `INSERT INTO products (name, category, price, unit, image)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        p.name,
        p.category ?? null,
        Math.round(Number(p.price)),
        p.unit ?? "кг",
        p.image ?? null,
      ],
    );
  }

  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')`,
    ["Администратор", process.env.ADMIN_EMAIL.trim().toLowerCase(), hash],
  );

  await pool.query(readFileSync(new URL('./migrations/013_orders.sql', import.meta.url), 'utf8'));
  await pool.query('UPDATE products SET farmer_id = (SELECT id FROM users WHERE email = $1)', [
    process.env.ADMIN_EMAIL.trim().toLowerCase(),
  ]);
  if (isLocal) await pool.query(readFileSync(new URL('./seed_stock.sql', import.meta.url), 'utf8'));

  console.log(
    `Готово: таблицы созданы, товаров добавлено — ${products.length}, админ — ${process.env.ADMIN_EMAIL}`,
  );
}

seed()
  .catch((err) => {
    console.error("Инициализация не удалась:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
