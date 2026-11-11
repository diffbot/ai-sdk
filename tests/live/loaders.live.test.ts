import type { DiffbotClient } from "@diffbot/typescript";
import { loadExtract } from "../../src/index.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("loadExtract (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("loads one non-empty document per URL, in order, with the requested url", async () => {
    const urls = [
      "https://en.wikipedia.org/wiki/Knowledge_graph",
      "https://en.wikipedia.org/wiki/Web_scraping",
    ];
    const docs = await loadExtract({ client, urls });

    expect(docs).toHaveLength(urls.length);
    docs.forEach((doc, i) => {
      expect(typeof doc.content).toBe("string");
      expect(doc.content.length).toBeGreaterThan(0);
      expect(doc.metadata.url).toBe(urls[i]);
    });
  });
});
