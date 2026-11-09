import {
  diffbotKnowledgeGraph,
  diffbotKnowledgeGraphInputSchema,
} from "../../src/tools/knowledge-graph.js";
import type * as DiffbotSdk from "@diffbot/typescript";
import { describe, expect, it, vi } from "vitest";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

async function runDql(
  handler: MockHandler,
  input: { query: string; size?: number; from?: number; filter?: string },
  options?: Parameters<typeof diffbotKnowledgeGraph>[0],
) {
  const tool = diffbotKnowledgeGraph({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...options,
  });
  return tool.execute!(input, toolExecOptions());
}

describe("diffbotKnowledgeGraph", () => {
  it("calls kg.diffbot.com with ?token=", async () => {
    await runDql(
      (req) => {
        expect(req.url).toBe("https://kg.diffbot.com/kg/v3/dql");
        expect(req.params.get("token")).toBe("test-token");
        return jsonResponse({ data: [] });
      },
      { query: "type:Organization" },
    );
  });

  it("sends size, from, and filter on the wire", async () => {
    await runDql(
      (req) => {
        expect(req.params.get("query")).toBe("type:Organization");
        expect(req.params.get("size")).toBe("5");
        expect(req.params.get("from")).toBe("20");
        expect(req.params.get("filter")).toBe("nbEmployees>100");
        return jsonResponse({ data: [] });
      },
      { query: "type:Organization", size: 5, from: 20, filter: "nbEmployees>100" },
    );
  });

  it("defaults size to 10", async () => {
    await runDql(
      (req) => {
        expect(req.params.get("size")).toBe("10");
        return jsonResponse({ data: [] });
      },
      { query: "type:Organization" },
    );
  });

  it("returns the raw body", async () => {
    const body = { hits: 1, data: [{ entity: { id: "E1" } }] };
    const out = await runDql(() => jsonResponse(body), { query: "type:Organization", size: 1 });
    expect(out).toEqual(body);
  });

  it("throws when the SDK hands back a non-JSON body", async () => {
    vi.resetModules();
    vi.doMock("@diffbot/typescript", async (importOriginal) => {
      const mod = (await importOriginal()) as typeof DiffbotSdk;
      return { ...mod, dql: async () => new Uint8Array([1, 2, 3]) };
    });
    try {
      const { diffbotKnowledgeGraph: mocked } = await import("../../src/tools/knowledge-graph.js");
      const tool = mocked({ apiKey: "test-token" });
      await expect(
        tool.execute!({ query: "type:Organization" }, toolExecOptions()),
      ).rejects.toThrow("Unexpected non-JSON DQL response.");
    } finally {
      vi.doUnmock("@diffbot/typescript");
      vi.resetModules();
    }
  });

  it("rejects from < 0", () => {
    expect(diffbotKnowledgeGraphInputSchema.safeParse({ query: "q", from: -1 }).success).toBe(
      false,
    );
  });
});
