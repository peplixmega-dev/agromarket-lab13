import pg from "pg";

pg.types.setTypeParser(1082, (val) => val);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // PGlite исполняет все запросы в одной сессии. Не перемешиваем транзакции демо.
  max: process.env.AGRO_EMBEDDED_DB === "1" ? 1 : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  console.error("PostgreSQL: соединение потеряно —", err.message);
});
