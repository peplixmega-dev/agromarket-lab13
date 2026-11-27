import "dotenv/config";

process.env.CORS_ORIGIN = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
const required = ["JWT_SECRET", "CORS_ORIGIN"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (!process.env.DATABASE_URL && !process.env.PGHOST) missing.unshift("DATABASE_URL (или PGHOST)");
if (missing.length > 0) {
  console.error("Не заданы переменные окружения:", missing.join(", "));
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET слишком короткий для продакшена (нужно от 32 символов)");
  process.exit(1);
}

const { default: app } = await import("./app.js");
const { pool } = await import("./db/pool.js");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`API запущен: порт ${PORT}, режим ${process.env.NODE_ENV || "development"}`);
});

process.once("SIGTERM", () => {
  console.log("SIGTERM: завершаем работу...");
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async () => {
    try {
      await pool.end();
      clearTimeout(timeout);
      process.exit(0);
    } catch (err) {
      console.error("Не удалось закрыть соединения:", err.message);
      process.exit(1);
    }
  });
});
