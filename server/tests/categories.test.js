import request from "supertest";
import app from "../app.js";

describe("GET /api/categories", () => {
  it("returns categories with numeric counts", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const category of res.body) {
      expect(category.name === null || typeof category.name === "string").toBe(true);
      expect(Number.isInteger(category.count)).toBe(true);
      expect(category.count).toBeGreaterThan(0);
    }
  });

  it("counts all products exactly once", async () => {
    const categories = await request(app).get("/api/categories");
    const products = await request(app).get("/api/products");
    expect(categories.status).toBe(200);
    expect(products.status).toBe(200);
    expect(categories.body.reduce((sum, category) => sum + category.count, 0))
      .toBe(products.body.length);
  });
});
