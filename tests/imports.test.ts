import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as mod from "../src/index.js";

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

describe("barrel exports", () => {
  it("runtime value exports match the Phase 2 list", () => {
    expect(Object.keys(mod).sort()).toEqual(EXPECTED_VALUES);
  });

  it("main barrel does not import @ai-sdk/openai-compatible", () => {
    const main = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(main).not.toMatch(/@ai-sdk\/openai-compatible/);
    const toolsIndex = readFileSync(new URL("../src/tools/index.ts", import.meta.url), "utf8");
    expect(toolsIndex).not.toMatch(/@ai-sdk\/openai-compatible/);
  });
});
