import type { DiffbotClient } from "@diffbot/typescript";
import { retrieveKnowledgeGraph, retrieveWebSearch } from "../../src/index.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("retrieveKnowledgeGraph (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("returns documents narrowed to the requested fields, with the hit score", async () => {
    const docs = await retrieveKnowledgeGraph({
      client,
      query: 'type:Organization name:"Diffbot"',
      k: 3,
      fields: ["id", "type", "name"],
    });

    expect(docs.length).toBeGreaterThan(0);
    expect(docs.length).toBeLessThanOrEqual(3);
    for (const doc of docs) {
      expect(typeof doc.content).toBe("string");
      expect(doc.metadata).toHaveProperty("score");
      for (const key of Object.keys(doc.metadata)) {
        expect(["id", "type", "name", "score"]).toContain(key);
      }
    }
  });
});

describe.skipIf(!hasToken)("retrieveWebSearch (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("returns at most k documents with content and pageUrl metadata", async () => {
    const docs = await retrieveWebSearch({
      client,
      query: "What is the Diffbot Knowledge Graph?",
      k: 3,
    });

    expect(docs.length).toBeGreaterThan(0);
    expect(docs.length).toBeLessThanOrEqual(3);
    for (const doc of docs) {
      expect(typeof doc.content).toBe("string");
      expect(typeof doc.metadata.pageUrl).toBe("string");
      expect(doc.metadata).not.toHaveProperty("content");
    }
  });
});
