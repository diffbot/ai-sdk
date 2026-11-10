import { diffbotDqlProbe, diffbotDqlProbeInputSchema } from "../../src/tools/dql-probe.js";
import { describe, expect, it } from "vitest";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

const DQL_URL = "https://kg.diffbot.com/kg/v3/dql";

async function runProbe(
  handler: MockHandler,
  input: { queries: string[]; workers?: number },
  options?: Parameters<typeof diffbotDqlProbe>[0],
) {
  const tool = diffbotDqlProbe({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...options,
  });
  return tool.execute!(input, toolExecOptions());
}

describe("diffbotDqlProbe", () => {
  it("probes each variant at size=0 and returns hit counts in input order", async () => {
    const out = await runProbe(
      (req) => {
        expect(req.url).toBe(DQL_URL);
        expect(req.method).toBe("GET");
        expect(req.params.get("token")).toBe("test-token");
        expect(req.params.get("size")).toBe("0");
        const query = req.params.get("query") ?? "";
        const hits = query.includes("Diffbot") ? 5 : 100;
        return jsonResponse({ hits, results: 0 });
      },
      {
        queries: ['type:Organization name:"Diffbot"', "type:Organization"],
      },
    );

    expect(out).toEqual([
      { query: 'type:Organization name:"Diffbot"', hits: 5 },
      { query: "type:Organization", hits: 100 },
    ]);
  });

  it("preserves input order when responses come back out of order", async () => {
    const queries = ["q0", "q1", "q2", "q3"];
    const out = await runProbe(
      async (req) => {
        const query = req.params.get("query") ?? "";
        const delay = (queries.length - queries.indexOf(query)) * 5;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return jsonResponse({ hits: queries.indexOf(query) });
      },
      { queries, workers: 4 },
    );

    expect(out).toEqual([
      { query: "q0", hits: 0 },
      { query: "q1", hits: 1 },
      { query: "q2", hits: 2 },
      { query: "q3", hits: 3 },
    ]);
  });

  it("reports null when a response carries no hit count", async () => {
    const out = await runProbe(() => jsonResponse({ results: 0 }), {
      queries: ["type:Organization"],
    });
    expect(out).toEqual([{ query: "type:Organization", hits: null }]);
  });

  it("returns an empty list for no queries without hitting the network", async () => {
    let calls = 0;
    const out = await runProbe(
      () => {
        calls += 1;
        return jsonResponse({ hits: 1 });
      },
      { queries: [] },
    );
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });

  it("caps concurrency at the factory `workers` when the model omits it", async () => {
    let inFlight = 0;
    let peak = 0;
    await runProbe(
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return jsonResponse({ hits: 1 });
      },
      { queries: ["q0", "q1", "q2", "q3", "q4", "q5"] },
      { workers: 2 },
    );
    expect(peak).toBe(2);
  });

  it("lets model input override the factory `workers`", async () => {
    let inFlight = 0;
    let peak = 0;
    await runProbe(
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return jsonResponse({ hits: 1 });
      },
      { queries: ["q0", "q1", "q2", "q3", "q4", "q5"], workers: 3 },
      { workers: 2 },
    );
    expect(peak).toBe(3);
  });

  it("defers the missing-token error to execute", async () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      const tool = diffbotDqlProbe();
      await expect(
        tool.execute!({ queries: ["type:Organization"] }, toolExecOptions()),
      ).rejects.toThrow("No Diffbot API token.");
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
  });

  it("validates its input schema", () => {
    expect(diffbotDqlProbeInputSchema.safeParse({}).success).toBe(false);
    expect(diffbotDqlProbeInputSchema.safeParse({ queries: "q" }).success).toBe(false);
    expect(diffbotDqlProbeInputSchema.safeParse({ queries: [1] }).success).toBe(false);
    expect(diffbotDqlProbeInputSchema.safeParse({ queries: ["q"], workers: 0 }).success).toBe(
      false,
    );
    expect(diffbotDqlProbeInputSchema.safeParse({ queries: ["q"], workers: 1.5 }).success).toBe(
      false,
    );
    expect(diffbotDqlProbeInputSchema.safeParse({ queries: ["q"] }).success).toBe(true);
  });
});
