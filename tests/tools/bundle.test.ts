import { DiffbotClient, KVOntologyStore, type KVLike } from "@diffbot/typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diffbotTools } from "../../src/tools/index.js";
import {
  createMockFetch,
  jsonResponse,
  sseResponse,
  type MockRequest,
} from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

describe("diffbotTools", () => {
  it("exposes the seven diffbot_* keys in declaration order", () => {
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
      "diffbot_entities",
      "diffbot_ontology",
      "diffbot_dql_probe",
      "diffbot_ask",
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

  describe("timeout", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const fetch = createMockFetch((req) =>
      req.url.endsWith("/chat/completions")
        ? sseResponse('data: {"choices": [{"delta": {"content": "ok"}}]}\ndata: [DONE]\n')
        : jsonResponse({ search_results: [] }),
    );

    async function timeoutsFor(options: Parameters<typeof diffbotTools>[0]): Promise<unknown[]> {
      const spy = vi.spyOn(AbortSignal, "timeout");
      const tools = diffbotTools(options);
      await tools.diffbot_web_search?.execute!({ query: "q" }, toolExecOptions());
      await tools.diffbot_ask?.execute!({ question: "q" }, toolExecOptions());
      return spy.mock.calls.map((call) => call[0]);
    }

    it("builds one client with ask's 120s default when diffbot_ask is included", async () => {
      expect(await timeoutsFor({ apiKey: "t", fetch })).toEqual([120_000, 120_000]);
    });

    it("keeps the SDK default when diffbot_ask is not selected", async () => {
      expect(await timeoutsFor({ apiKey: "t", fetch, only: ["diffbot_web_search"] })).toEqual([
        30_000,
      ]);
    });

    it("an explicit timeout wins for every tool", async () => {
      expect(await timeoutsFor({ apiKey: "t", fetch, timeout: 7_000 })).toEqual([7_000, 7_000]);
    });
  });

  it("returns an empty bundle when only is empty", () => {
    const tools = diffbotTools({
      client: new DiffbotClient({ token: "t", fetch: createMockFetch(() => jsonResponse({})) }),
      only: [],
    });
    expect(Object.keys(tools)).toEqual([]);
  });

  it("builds tools without a token and defers the error to execute", async () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      const tools = diffbotTools();
      expect(Object.keys(tools)).toHaveLength(7);
      await expect(
        tools.diffbot_web_search.execute!({ query: "q" }, toolExecOptions()),
      ).rejects.toThrow("No Diffbot API token.");
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
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

  it("forwards ontologyStore to the ontology tool only", async () => {
    const data = new Map<string, string>();
    const kv: KVLike = {
      get: async (key) => data.get(key) ?? null,
      put: async (key, value) => {
        data.set(key, value);
      },
      delete: async (key) => {
        data.delete(key);
      },
    };
    let fetches = 0;
    const client = new DiffbotClient({
      token: "t",
      fetch: createMockFetch(() => {
        fetches += 1;
        return jsonResponse({ types: { Organization: { fields: {} } } });
      }),
    });

    const first = diffbotTools({ client, ontologyStore: new KVOntologyStore(client, kv) });
    expect(await first.diffbot_ontology.execute!({ op: "types" }, toolExecOptions())).toEqual([
      "Organization",
    ]);
    expect(fetches).toBe(1);

    /* A second bundle, a fresh in-memory cache: the shared KV store answers. */
    const second = diffbotTools({ client, ontologyStore: new KVOntologyStore(client, kv) });
    expect(await second.diffbot_ontology.execute!({ op: "types" }, toolExecOptions())).toEqual([
      "Organization",
    ]);
    expect(fetches).toBe(1);
  });
});
