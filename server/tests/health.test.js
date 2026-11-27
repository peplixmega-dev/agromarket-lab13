import request from "supertest";
import app from "../app.js";
import { pool } from "../db/pool.js";
import { afterEach, vi } from "vitest";

describe("GET /api/health", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns service and database status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok", version: "local" });
  });

  it("returns 503 without leaking database errors", async () => {
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("private connection details"));
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", db: "unavailable", version: "local" });
  });

  it("allows configured CORS origins", async () => {
    for (const origin of ["http://localhost:5173", "https://frontend.example"]) {
      const res = await request(app).get("/api/products").set("Origin", origin);
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
    }
  });

  it("does not allow a foreign CORS origin", async () => {
    const res = await request(app).get("/api/products").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sets security headers and hides Express", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
