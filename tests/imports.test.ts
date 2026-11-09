import { describe, expect, it } from "vitest";
import * as mod from "../src/index.js";

const EXPECTED_VALUES = [
  "DEFAULT_KG_CONTENT_FIELDS",
  "DEFAULT_WEB_CONTENT_FIELDS",
  "dictToDocument",
  "diffbotExtract",
  "diffbotKnowledgeGraph",
  "diffbotTools",
  "diffbotWebSearch",
  "shapeExtractResponse",
].sort();

describe("barrel exports", () => {
  it("runtime value exports match the Phase 1 list", () => {
    const values = Object.keys(mod)
      .filter((key) => {
        const v = (mod as Record<string, unknown>)[key];
        return typeof v === "function" || Array.isArray(v);
      })
      .sort();
    expect(values).toEqual(EXPECTED_VALUES);
  });
});
