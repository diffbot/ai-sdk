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
    // Unfiltered on purpose: any accidental new runtime export fails here.
    expect(Object.keys(mod).sort()).toEqual(EXPECTED_VALUES);
  });
});
