import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.live.test.ts", "**/node_modules/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
