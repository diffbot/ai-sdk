import { DiffbotClient } from "@diffbot/typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadCrawl,
  loadExtract,
  retrieveKnowledgeGraph,
  retrieveWebSearch,
  streamCrawl,
  streamExtract,
  type DiffbotAuth,
} from "../../src/index.js";
import { createMockFetch, jsonResponse, type MockRequest } from "../helpers/mock-fetch.js";

/* One canned body that satisfies every helper's endpoint. */
const BODY = { data: [], search_results: [], objects: [{ text: "x" }], jobs: [{ name: "j" }] };

const HELPERS: Array<[string, (auth: DiffbotAuth) => Promise<unknown>]> = [
  ["retrieveKnowledgeGraph", (auth) => retrieveKnowledgeGraph({ ...auth, query: "q" })],
  ["retrieveWebSearch", (auth) => retrieveWebSearch({ ...auth, query: "q" })],
  ["loadExtract", (auth) => loadExtract({ ...auth, urls: ["https://example.com"] })],
  [
    "loadCrawl",
    (auth) =>
      loadCrawl({
        ...auth,
        site: "https://example.com",
        crawlOptions: { jobName: "j", watch: false },
      }),
  ],
];

function tokenOf(req: MockRequest): string | null {
  return (
    req.params.get("token") ?? req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? null
  );
}

/* Records the token each request carried, whether as `?token=` or a bearer header. */
function recordingFetch(seen: Array<string | null>) {
  return createMockFetch((req) => {
    seen.push(tokenOf(req));
    return jsonResponse(BODY);
  });
}

describe("retrieve/load helpers: lazy auth", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
    else process.env.DIFFBOT_API_TOKEN = saved;
  });

  it("creating the stream generators never resolves a token", () => {
    expect(() => streamExtract({ urls: ["https://example.com"] })).not.toThrow();
    expect(() => streamCrawl({ site: "https://example.com" })).not.toThrow();
  });

  it("stream generators reject with the no-token error on first iteration", async () => {
    await expect(streamExtract({ urls: ["https://example.com"] }).next()).rejects.toThrow(
      "No Diffbot API token.",
    );
    await expect(streamCrawl({ site: "https://example.com" }).next()).rejects.toThrow(
      "No Diffbot API token.",
    );
  });

  for (const [name, run] of HELPERS) {
    describe(name, () => {
      it("rejects with the no-token error when nothing is configured", async () => {
        await expect(run({ fetch: createMockFetch(() => jsonResponse(BODY)) })).rejects.toThrow(
          "No Diffbot API token.",
        );
      });

      it("treats a whitespace-only token as missing", async () => {
        process.env.DIFFBOT_API_TOKEN = "   ";
        await expect(
          run({ apiKey: " ", fetch: createMockFetch(() => jsonResponse(BODY)) }),
        ).rejects.toThrow("No Diffbot API token.");
      });

      it("reads DIFFBOT_API_TOKEN from process.env at call time", async () => {
        const seen: Array<string | null> = [];
        process.env.DIFFBOT_API_TOKEN = "from-process-env";
        await run({ fetch: recordingFetch(seen) });
        expect(seen).toEqual(["from-process-env"]);
      });

      it("reads a Workers-style env bag", async () => {
        const seen: Array<string | null> = [];
        await run({
          env: { DIFFBOT_API_TOKEN: "from-env-bag" },
          fetch: recordingFetch(seen),
        });
        expect(seen).toEqual(["from-env-bag"]);
      });

      it("prefers apiKey over env, and an injected client over both", async () => {
        const seen: Array<string | null> = [];
        const fetch = recordingFetch(seen);
        process.env.DIFFBOT_API_TOKEN = "from-process-env";
        await run({ apiKey: "from-api-key", fetch });
        await run({
          client: new DiffbotClient({ token: "from-client", fetch }),
          apiKey: "ignored",
        });
        expect(seen).toEqual(["from-api-key", "from-client"]);
      });
    });
  }
});
