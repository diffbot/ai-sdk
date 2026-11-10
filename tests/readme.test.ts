import { DiffbotClient } from "@diffbot/typescript";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as mod from "../src/index.js";
import { createMockFetch, jsonResponse } from "./helpers/mock-fetch.js";

const README = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../README.md"),
  "utf8",
);

const tableRows = [...README.matchAll(/^\| `(diffbot[A-Z]\w*)`\s*\| `(diffbot_\w+)`/gm)].map(
  ([, factory, key]) => ({ factory: factory!, key: key! }),
);

const tsBlocks = [...README.matchAll(/```ts\n([\s\S]*?)```/g)].map(([, code]) => code!);

describe("README parity", () => {
  it("the tools table lists every tool factory in the barrel, in bundle order", () => {
    const factories = Object.keys(mod).filter(
      (name) => /^diffbot[A-Z]/.test(name) && name !== "diffbotTools",
    );
    const bundleKeys = Object.keys(
      mod.diffbotTools({
        client: new DiffbotClient({ token: "t", fetch: createMockFetch(() => jsonResponse({})) }),
      }),
    );

    expect(tableRows.map((row) => row.factory).sort()).toEqual(factories.sort());
    expect(tableRows.map((row) => row.key)).toEqual(bundleKeys);
  });

  it("each tool factory has its own section", () => {
    for (const { factory } of tableRows) {
      expect(README).toContain(`### \`${factory}\``);
    }
  });

  it("ts examples use stepCountIs, never the ai@7-only isStepCount", () => {
    expect(tsBlocks.length).toBeGreaterThan(0);
    for (const code of tsBlocks) {
      expect(code).not.toMatch(/isStepCount/);
    }
  });
});
