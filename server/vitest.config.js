import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
const { parsed } = process.env.LAB_TEST_ISOLATED ? {} : dotenv.config({ path: ".env.test", override: true });

export default defineConfig(() => ({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    env: parsed,
    globalSetup: "./tests/globalSetup.js",
    setupFiles: ["./tests/setup.js"],
    testTimeout: 10_000,
    hookTimeout: 20_000,
  },
}));
