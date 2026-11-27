// Локальная заглушка облачной инфраструктуры. Не используется в npm start/Render.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import express from "express";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const serverDir = fileURLToPath(new URL("..", import.meta.url));
const clientDir = resolve(serverDir, "../client");
const port = Number(process.env.DEMO_PORT || 3000);
const dbPort = Number(process.env.DEMO_DB_PORT || 55439);
const origin = `http://localhost:${port}`;

// Всегда отдельная база в памяти; DATABASE_URL владельца сюда не попадает.
const env = {
  ...process.env,
  AGRO_EMBEDDED_DB: "1",
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
  JWT_SECRET: randomBytes(48).toString("base64url"),
  CORS_ORIGIN: `${origin},http://localhost:5173`,
  CORS_ORIGINS: `${origin},http://localhost:5173`,
  NODE_ENV: "development",
  ADMIN_EMAIL: process.env.DEMO_ADMIN_EMAIL || "admin@agromarket.kz",
  ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin12345!",
  VITE_API_URL: "/api",
};

function run(script, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolveRun()
      : reject(new Error(`Команда ${script} завершилась с кодом ${code}`)));
  });
}

let db;
let databaseServer;
let httpServer;
let pool;
let closing = false;

async function close() {
  if (closing) return;
  closing = true;
  if (httpServer) await new Promise((done) => httpServer.close(done));
  if (pool) await pool.end();
  if (databaseServer) await databaseServer.stop();
  if (db) await db.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => close().then(() => process.exit(0)));
}

try {
  db = await PGlite.create();
  databaseServer = new PGLiteSocketServer({ db, host: "127.0.0.1", port: dbPort, maxConnections: 10 });
  databaseServer.addEventListener("error", (event) => console.error("Демобаза:", event.detail));
  await databaseServer.start();
  await run(resolve(serverDir, "db/seed.js"), [], serverDir);
  await run(resolve(serverDir, "db/migrate.js"), [], serverDir);
  await run(resolve(clientDir, "node_modules/vite/bin/vite.js"), ["build"], clientDir);

  Object.assign(process.env, env);
  const { default: app } = await import("../app.js");
  ({ pool } = await import("../db/pool.js"));
  const web = express();
  web.disable("x-powered-by");
  web.use(express.static(resolve(clientDir, "dist")));
  web.get(/^\/(?!api(?:\/|$)).*/, (req, res) => res.sendFile(resolve(clientDir, "dist/index.html")));
  web.use(app);
  httpServer = await new Promise((done, reject) => {
    const listener = web.listen(port, "127.0.0.1", () => done(listener));
    listener.once("error", reject);
  });
  console.log(`\nЛОКАЛЬНАЯ ДЕМОВЕРСИЯ: ${origin}`);
  console.log(`API: ${origin}/api/health`);
  if (!process.env.DEMO_QUIET_CREDENTIALS) console.log(`Админ: ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}`);
  console.log("Облако не подключено. Данные демобазы сбросятся после остановки. Ctrl+C — выход.");
} catch (err) {
  console.error("Демозапуск не удался:", err.message);
  await close();
  process.exitCode = 1;
}
