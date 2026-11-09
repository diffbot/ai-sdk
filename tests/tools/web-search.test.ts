import { describe, expect, it } from "vitest";
import { diffbotWebSearch, diffbotWebSearchInputSchema } from "../../src/tools/web-search.js";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

async function runSearch(
  handler: MockHandler,
  input: {
    query: string;
    numResults?: number;
    snippetLength?: "short" | "medium" | "long" | "full";
  },
  options?: Parameters<typeof diffbotWebSearch>[0],
) {
  const tool = diffbotWebSearch({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...options,
  });
  return tool.execute!(input, toolExecOptions());
}

describe("diffbotWebSearch", () => {
  it("calls llm.diffbot.com with Bearer auth and no token query param", async () => {
    await runSearch(
      (req) => {
        expect(req.url).toBe("https://llm.diffbot.com/api/v1/web_search");
        expect(req.params.has("token")).toBe(false);
        expect(req.headers.get("Authorization")).toBe("Bearer test-token");
        return jsonResponse({ search_results: [] });
      },
      { query: "anything" },
    );
  });

  it("model numResults and snippetLength override factory options", async () => {
    await runSearch(
      (req) => {
        expect(req.params.get("size")).toBe("3");
        expect(req.params.get("snippetLength")).toBe("LONG");
        expect(req.params.get("maxTokens")).toBe("500");
        return jsonResponse({ search_results: [] });
      },
      { query: "anything", numResults: 3, snippetLength: "long" },
      { numResults: 10, snippetLength: "short", maxTokens: 500 },
    );
  });

  it("maxTokens comes only from factory options", async () => {
    await runSearch(
      (req) => {
        expect(req.params.get("maxTokens")).toBe("500");
        return jsonResponse({ search_results: [] });
      },
      { query: "anything" },
      { maxTokens: 500 },
    );
  });

  it("returns search_results or an empty list", async () => {
    const rows = [{ title: "A", pageUrl: "https://a.example" }];
    const out = await runSearch(() => jsonResponse({ search_results: rows }), { query: "q" });
    expect(out).toEqual(rows);

    const empty = await runSearch(() => jsonResponse({}), { query: "q" });
    expect(empty).toEqual([]);
  });

  it("rejects numResults outside 1–50", () => {
    expect(diffbotWebSearchInputSchema.safeParse({ query: "q", numResults: 0 }).success).toBe(
      false,
    );
    expect(diffbotWebSearchInputSchema.safeParse({ query: "q", numResults: 51 }).success).toBe(
      false,
    );
  });

  it("exposes description and execute", () => {
    const tool = diffbotWebSearch({ apiKey: "t", fetch: createMockFetch(() => jsonResponse({})) });
    expect(tool.description?.length).toBeGreaterThan(0);
    expect(typeof tool.execute).toBe("function");
    expect(tool.inputSchema).toBeDefined();
  });
});
