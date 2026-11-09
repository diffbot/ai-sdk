import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.live.test.ts"],
    testTimeout: 60_000,
  },
});
