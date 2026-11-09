import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "neutral",
  external: [
    "ai",
    "zod",
    "@ai-sdk/openai-compatible",
    "@ai-sdk/provider-utils",
    "@diffbot/typescript",
  ],
});
