import { describe, expect, it } from "vitest";
import { loadExtract } from "../../src/index.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("loadExtract (live)", () => {
  it("loads one document per URL with the requested url in metadata", async () => {
    const urls = [
      "https://en.wikipedia.org/wiki/Knowledge_graph",
      "https://en.wikipedia.org/wiki/Web_scraping",
    ];
    const docs = await loadExtract({ client: makeClient(), urls });

    expect(docs).toHaveLength(urls.length);
    docs.forEach((doc, i) => {
      expect(typeof doc.content).toBe("string");
      expect(doc.metadata.url).toBe(urls[i]);
    });
  });
});
