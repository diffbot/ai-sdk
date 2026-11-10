import { describe, expect, it } from "vitest";
import { retrieveKnowledgeGraph, retrieveWebSearch } from "../../src/index.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("retrieveKnowledgeGraph (live)", () => {
  it("returns documents narrowed to the requested fields", async () => {
    const docs = await retrieveKnowledgeGraph({
      client: makeClient(),
      query: "type:Organization",
      k: 3,
      fields: ["id", "type", "name"],
    });

    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.length).toBeLessThanOrEqual(3);
    for (const doc of docs) {
      expect(typeof doc.content).toBe("string");
      for (const key of Object.keys(doc.metadata)) {
        expect(["id", "type", "name", "score"]).toContain(key);
      }
    }
  });
});

describe.skipIf(!hasToken)("retrieveWebSearch (live)", () => {
  it("returns documents with pageUrl metadata", async () => {
    const docs = await retrieveWebSearch({
      client: makeClient(),
      query: "What is the Diffbot Knowledge Graph?",
      k: 3,
    });

    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(typeof doc.content).toBe("string");
      expect(typeof doc.metadata.pageUrl).toBe("string");
    }
  });
});
