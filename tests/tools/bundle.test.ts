import { DiffbotClient } from "@diffbot/typescript";
import { describe, expect, it, vi } from "vitest";
import { diffbotTools } from "../../src/tools/index.js";
import { createMockFetch, jsonResponse, type MockRequest } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

describe("diffbotTools", () => {
  it("exposes the three diffbot_* keys in declaration order", () => {
    const tools = diffbotTools({
      client: new DiffbotClient({
        token: "t",
        fetch: createMockFetch(() => jsonResponse({ search_results: [] })),
      }),
    });
    expect(Object.keys(tools)).toEqual([
      "diffbot_web_search",
      "diffbot_extract",
      "diffbot_knowledge_graph",
    ]);
  });

  it("filters with only and preserves declaration order", () => {
    const tools = diffbotTools({
      client: new DiffbotClient({ token: "t", fetch: createMockFetch(() => jsonResponse({})) }),
      only: ["diffbot_extract", "diffbot_web_search"],
    });
    expect(Object.keys(tools)).toEqual(["diffbot_web_search", "diffbot_extract"]);
  });

  it("shares one client across tools in a bundle", async () => {
    const fetchSpy = vi.fn((req: MockRequest) => {
      expect(req).toBeDefined();
      return jsonResponse({ search_results: [], objects: [{ text: "x" }] });
    });
    const fetch = createMockFetch((req) => fetchSpy(req));

    const tools = diffbotTools({ apiKey: "shared-token", fetch });

    await tools.diffbot_web_search.execute!({ query: "q" }, toolExecOptions());
    await tools.diffbot_extract.execute!({ url: "https://example.com" }, toolExecOptions());

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const tokens = fetchSpy.mock.calls.map((c) => c[0]!.params.get("token"));
    const bearers = fetchSpy.mock.calls.map((c) => c[0]!.headers.get("Authorization"));
    expect(tokens.filter(Boolean)).toEqual(["shared-token"]);
    expect(bearers.filter(Boolean)).toEqual(["Bearer shared-token"]);
  });

  it("each entry is a valid AI SDK tool", () => {
    const tools = diffbotTools({
      client: new DiffbotClient({ token: "t", fetch: createMockFetch(() => jsonResponse({})) }),
    });
    for (const tool of Object.values(tools)) {
      expect(tool.description?.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });
});
