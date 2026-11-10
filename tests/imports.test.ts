import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as mod from "../src/index.js";
import * as provider from "../src/provider.js";

const EXPECTED_VALUES = [
  "DEFAULT_KG_CONTENT_FIELDS",
  "DEFAULT_WEB_CONTENT_FIELDS",
  "dictToDocument",
  "diffbotAsk",
  "diffbotDqlProbe",
  "diffbotEntities",
  "diffbotExtract",
  "diffbotKnowledgeGraph",
  "diffbotOntology",
  "diffbotTools",
  "diffbotWebSearch",
  "shapeExtractResponse",
].sort();

const EXPECTED_PROVIDER_VALUES = [
  "DEFAULT_DIFFBOT_BASE_URL",
  "PROVIDER_NO_TOKEN_MESSAGE",
  "createDiffbot",
  "diffbot",
].sort();

/*
  Every source file reachable from an entry by following relative imports.
  Source-relative specifiers are written with a `.js` suffix (NodeNext style),
  so they map back onto the `.ts` file on disk.
*/
function importGraph(entry: string): string[] {
  const seen = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const specifier = match[1]!;
      pending.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
    }
  }

  return [...seen];
}

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

describe("barrel exports", () => {
  it("runtime value exports match the Phase 2 list", () => {
    expect(Object.keys(mod).sort()).toEqual(EXPECTED_VALUES);
  });

  it("the provider subpath exports exactly its documented surface", () => {
    expect(Object.keys(provider).sort()).toEqual(EXPECTED_PROVIDER_VALUES);
  });

  it("nothing reachable from the main entry imports @ai-sdk/openai-compatible", () => {
    const graph = importGraph(resolve(SRC, "index.ts"));

    expect(graph.length).toBeGreaterThan(3);
    expect(graph).not.toContain(resolve(SRC, "provider.ts"));
    for (const file of graph) {
      expect(readFileSync(file, "utf8")).not.toMatch(/@ai-sdk\/openai-compatible/);
    }
  });

  it("the provider entry is the only place that imports @ai-sdk/openai-compatible", () => {
    expect(readFileSync(resolve(SRC, "provider.ts"), "utf8")).toMatch(/@ai-sdk\/openai-compatible/);
  });
});

describe("package exports map", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8")) as {
    exports: Record<string, unknown>;
  };

  /* CJS consumers must get `.d.cts`; a shared `.d.ts` is "masquerading as ESM". */
  it.each([
    [".", "index"],
    ["./provider", "provider"],
  ])("%s pairs each format with its own declarations", (subpath, stem) => {
    expect(pkg.exports[subpath]).toEqual({
      import: { types: `./dist/${stem}.d.ts`, default: `./dist/${stem}.js` },
      require: { types: `./dist/${stem}.d.cts`, default: `./dist/${stem}.cjs` },
    });
  });

  it("builds one tsup entry per subpath", () => {
    const tsup = readFileSync(resolve(SRC, "../tsup.config.ts"), "utf8");
    expect(tsup).toMatch(/entry:\s*\["src\/index\.ts",\s*"src\/provider\.ts"\]/);
  });
});
