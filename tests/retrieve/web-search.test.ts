import { describe, expect, it } from "vitest";
import { retrieveWebSearch } from "../../src/retrieve/web-search.js";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";

const WEB_SEARCH_URL = "https://llm.diffbot.com/api/v1/web_search";

const SAMPLE_BODY = {
  search_results: [
    {
      score: 0.91,
      title: "Diffbot Knowledge Graph",
      pageUrl: "https://www.diffbot.com/kg/",
      content: "Diffbot KG is the largest commercial knowledge graph...",
    },
    {
      score: 0.42,
      title: "About Diffbot",
      pageUrl: "https://www.diffbot.com/about",
      snippet: "Diffbot uses AI to extract structured data from web pages.",
    },
  ],
};

function retrieve(
  handler: MockHandler,
  overrides: Omit<Parameters<typeof retrieveWebSearch>[0], "apiKey" | "fetch">,
) {
  return retrieveWebSearch({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...overrides,
  });
}

describe("retrieveWebSearch", () => {
  it("maps search results to documents, preferring content over snippet", async () => {
    const docs = await retrieve(
      (req) => {
        expect(req.url).toBe(WEB_SEARCH_URL);
        expect(req.headers.get("Authorization")).toBe("Bearer test-token");
        expect(req.params.get("text")).toBe("diffbot knowledge graph");
        return jsonResponse(SAMPLE_BODY);
      },
      { k: 2, query: "diffbot knowledge graph" },
    );

    expect(docs).toHaveLength(2);
    expect(docs[0]!.content).toBe("Diffbot KG is the largest commercial knowledge graph...");
    expect(docs[0]!.metadata).not.toHaveProperty("content");
    expect(docs[0]!.metadata.score).toBe(0.91);
  });

  it("falls back to snippet when a result has no content", async () => {
    const docs = await retrieve(() => jsonResponse(SAMPLE_BODY), { k: 2, query: "diffbot" });
    expect(docs[1]!.content).toBe("Diffbot uses AI to extract structured data from web pages.");
    expect(docs[1]!.metadata).not.toHaveProperty("snippet");
  });

  it("sends k as the size wire param", async () => {
    await retrieve(
      (req) => {
        expect(req.params.get("size")).toBe("5");
        return jsonResponse(SAMPLE_BODY);
      },
      { k: 5, query: "q" },
    );
  });
});
