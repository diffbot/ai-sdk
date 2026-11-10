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

  it("defaults k to 10 and caps the result list at k", async () => {
    let size: string | null = null;
    const many = { search_results: Array.from({ length: 12 }, (_, i) => ({ content: `r${i}` })) };
    const docs = await retrieve(
      (req) => {
        size = req.params.get("size");
        return jsonResponse(many);
      },
      { query: "q" },
    );
    expect(size).toBe("10");
    expect(docs).toHaveLength(10);

    const two = await retrieve(() => jsonResponse(many), { k: 2, query: "q" });
    expect(two.map((d) => d.content)).toEqual(["r0", "r1"]);
  });

  it("forwards maxTokens and snippetLength only when set", async () => {
    const seen: URLSearchParams[] = [];
    const handler: MockHandler = (req) => {
      seen.push(req.params);
      return jsonResponse(SAMPLE_BODY);
    };
    await retrieve(handler, { query: "q", maxTokens: 500, snippetLength: "short" });
    await retrieve(handler, { query: "q" });

    expect(seen[0]!.get("maxTokens")).toBe("500");
    expect(seen[0]!.get("snippetLength")).toBe("SHORT");
    expect(seen[1]!.has("maxTokens")).toBe(false);
    expect(seen[1]!.has("snippetLength")).toBe(false);
  });

  it("narrows metadata to the fields allowlist", async () => {
    const docs = await retrieve(() => jsonResponse(SAMPLE_BODY), {
      k: 2,
      query: "q",
      fields: ["pageUrl", "score"],
    });
    expect(docs[0]!.metadata).toEqual({ pageUrl: "https://www.diffbot.com/kg/", score: 0.91 });
  });

  it("honours custom contentFields and a full documentMapper override", async () => {
    const byTitle = await retrieve(() => jsonResponse(SAMPLE_BODY), {
      k: 2,
      query: "q",
      contentFields: ["title"],
    });
    expect(byTitle[0]!.content).toBe("Diffbot Knowledge Graph");

    const mapped = await retrieve(() => jsonResponse(SAMPLE_BODY), {
      k: 2,
      query: "q",
      fields: ["score"],
      documentMapper: (hit) => ({ content: String(hit.pageUrl), metadata: {} }),
    });
    expect(mapped.map((d) => d.content)).toEqual([
      "https://www.diffbot.com/kg/",
      "https://www.diffbot.com/about",
    ]);
    expect(mapped[0]!.metadata).toEqual({});
  });

  it("returns [] when the body has no search_results array", async () => {
    expect(await retrieve(() => jsonResponse({}), { query: "q" })).toEqual([]);
  });

  it("rejects a non-integer k before any request", async () => {
    await expect(
      retrieve(
        () => {
          throw new Error("should not be called");
        },
        { query: "q", k: 1.5 },
      ),
    ).rejects.toThrow(/`k` must be a positive integer/);
  });
});
