import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Unit tests for pure logic only. These modules avoid prisma / next runtime so
// the suite runs anywhere (including CI) without a database or server.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
});
