import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./db/pool.js";
import productsRouter from "./routes/products.js";
import purchasesRouter from "./routes/purchases.js";
import ordersRouter from "./routes/orders.js";
import authRouter from "./routes/auth.js";
import categoriesRouter from "./routes/categories.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const VERSION = (process.env.RENDER_GIT_COMMIT || "local").slice(0, 7);
app.set("trust proxy", 1);

function logger(req, res, next) {
  const time = new Date().toISOString();
  console.log(`[${time}] ${req.method} ${req.originalUrl}`);
  next();
}

app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));
app.use(logger);

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "ok", version: VERSION });
  } catch {
    res.status(503).json({ status: "error", db: "unavailable", version: VERSION });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/orders", purchasesRouter, ordersRouter);

app.use((req, res) => {
  res
    .status(404)
    .json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

app.use(errorHandler);

export default app;
