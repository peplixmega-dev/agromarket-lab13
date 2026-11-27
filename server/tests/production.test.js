import { vi, afterEach } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
import request from "supertest";
import app from "../app.js";
import { getAdminToken, getUserToken } from "./helpers.js";

describe("production access", () => {
  it("protects user details and order management", async () => {
    const user = await getUserToken();
    const admin = await getAdminToken();
    for (const path of ["/api/auth/users", "/api/orders"]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).auth(user, { type: "bearer" })).status).toBe(403);
      expect((await request(app).get(path).auth(admin, { type: "bearer" })).status).toBe(200);
    }
    expect((await request(app).delete("/api/orders/2147483647")).status).toBe(401);
    expect((await request(app).delete("/api/orders/2147483647").auth(user, { type: "bearer" })).status).toBe(403);
  });

  it("limits login attempts by the client IP behind the proxy", async () => {
    vi.stubEnv('NODE_ENV', 'development');
    for (let attempt = 1; attempt <= 21; attempt++) {
      const res = await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", "192.0.2.42")
        .send({ email: "missing@example.test", password: "wrong-password" });
      expect(res.status).toBe(attempt > 10 ? 429 : 401);
      expect(res.headers.ratelimit).toBeDefined();
      if (attempt > 10) {
        expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
        expect(res.body.error).toContain('15 минут');
      }
    }
    const other = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "192.0.2.43")
      .send({ email: "missing@example.test", password: "wrong-password" });
    expect(other.status).toBe(401);
  });
});
