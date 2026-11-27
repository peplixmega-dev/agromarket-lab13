// Проверяем живой API без регистрации, входа и изменения данных.
const API_URL = (process.env.API_URL || "").replace(/\/+$/, "");
const FRONTEND_URL = process.env.FRONTEND_URL;
const EXPECTED = (process.env.EXPECTED_VERSION || "").slice(0, 7);

if (!API_URL || !FRONTEND_URL) {
  console.error("Задайте API_URL (с /api) и FRONTEND_URL (Origin без / в конце)");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const apiFetch = (path, options = {}) => fetch(`${API_URL}${path}`, {
  ...options,
  signal: AbortSignal.timeout(20_000),
});

async function waitForVersion() {
  // Общий предел учитывает и тайм-ауты отдельных запросов.
  const deadline = Date.now() + 10 * 60_000;
  for (let attempt = 1; Date.now() < deadline; attempt++) {
    try {
      const res = await apiFetch("/health");
      const body = await res.json();
      console.log(`#${attempt}: HTTP ${res.status}, версия ${body.version}`);
      if (res.ok && body.status === "ok" && body.db === "ok"
          && (!EXPECTED || body.version === EXPECTED)) return body;
    } catch (err) {
      console.log(`#${attempt}: сервер пока не отвечает (${err.message})`);
    }
    await sleep(15_000);
  }
  throw new Error(`Не дождались версии ${EXPECTED || "(любой)"} за ~10 минут`);
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check("каталог отдаёт непустой список", async () => {
  const res = await apiFetch("/products");
  assert(res.status === 200, `статус ${res.status}`);
  const list = await res.json();
  assert(Array.isArray(list) && list.length > 0, "список пуст");
});

check("без токена товар не создать (401)", async () => {
  // Пустое тело не создаст валидный товар даже при ошибке в авторизации.
  const res = await apiFetch("/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert(res.status === 401, `ожидали 401, получили ${res.status}`);
});

check("CORS: фронтенд допущен", async () => {
  const res = await apiFetch("/products", { headers: { Origin: FRONTEND_URL } });
  assert(res.status === 200, `статус ${res.status}`);
  assert(res.headers.get("access-control-allow-origin") === FRONTEND_URL,
    "Origin фронтенда отсутствует в CORS_ORIGIN");
});

check("несуществующий товар — 404", async () => {
  const res = await apiFetch("/products/2147483647");
  assert(res.status === 404, `ожидали 404, получили ${res.status}`);
});

check("категории возвращают количество товаров", async () => {
  const res = await apiFetch("/categories");
  assert(res.status === 200, `статус ${res.status}`);
  const list = await res.json();
  assert(Array.isArray(list) && list.length > 0, "категории пусты");
  assert(list.every((item) => (item.name === null || typeof item.name === "string")
    && Number.isInteger(item.count) && item.count > 0), "неверный формат категорий");
});

async function main() {
  const health = await waitForVersion();
  console.log(`API работает: версия ${health.version}, база ${health.db}`);
  let failed = 0;
  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${name}: ${err.message}`);
    }
  }
  if (failed) throw new Error(`Провалено проверок: ${failed}`);
  console.log("Smoke-тест пройден");
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
