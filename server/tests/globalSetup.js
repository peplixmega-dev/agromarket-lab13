import pg from "pg";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

export async function setup() {
  if (!process.env.LAB_TEST_ISOLATED) dotenv.config({ path: resolve(process.cwd(), ".env.test"), override: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL обязателен для тестов");

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("Тесты остановлены: разрешена только локальная база");
  }
  if (databaseName !== "agromarket_test") {
    throw new Error(
      `Тесты остановлены: разрешена только база agromarket_test, получено ${databaseName}`,
    );
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } finally {
    await client.end();
  }

  execFileSync(process.execPath, ["db/seed.js"], { stdio: "inherit" });
  // Миграция поверх seed должна сохранить все данные; повторяем для идемпотентности.
  const snapshot = async () => {
    const db = new pg.Client({ connectionString: databaseUrl });
    try {
      await db.connect();
      const result = {};
      for (const table of ["users", "products", "orders"]) {
        result[table] = (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
      }
      return JSON.stringify(result);
    } finally {
      await db.end();
    }
  };
  const before = await snapshot();
  execFileSync(process.execPath, ["db/migrate.js"], { stdio: "inherit" });
  execFileSync(process.execPath, ["db/migrate.js"], { stdio: "inherit" });
  if (await snapshot() !== before) throw new Error("Миграция изменила существующие данные");
}
