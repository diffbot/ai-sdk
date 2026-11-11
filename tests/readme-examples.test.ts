/*
  README-examples suite (PLAN.md §6.1). Every ts block in README.md is
  extracted by scripts/doc-examples.mjs, has its `@diffbot/ai-sdk` imports
  rewritten to src/, and — for the blocks that need no model provider — is
  executed against a stubbed global fetch.

  Splitting on "does this block import from `ai`" is the whole trick: a block
  that calls generateText needs a model provider and a key this repo
  deliberately never holds, so those blocks are compiled by
  `pnpm typecheck:docs` and not run here. Everything else is a real Diffbot
  call path, and the stub below answers it with the smallest plausible
  response — so a block that reaches an endpoint nobody stubbed, or crashes
  on a shape the SDK really returns, fails this suite.

  The generated modules land in tests/.generated/ (gitignored) rather than a
  temp dir so vitest's own transform pipeline can load them.
*/
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { needsLlm, readDocExamples } from "../scripts/doc-examples.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED = resolve(HERE, ".generated");
const SRC_INDEX = resolve(HERE, "../src/index.ts");
const SRC_PROVIDER = resolve(HERE, "../src/provider.ts");

/** The rewrite §6.1 calls for: docs import the package name, we run the source. */
function rewriteImports(code: string): string {
  return code
    .replace(/(["'])@diffbot\/ai-sdk\/provider\1/g, JSON.stringify(SRC_PROVIDER))
    .replace(/(["'])@diffbot\/ai-sdk\1/g, JSON.stringify(SRC_INDEX));
}

const requested: string[] = [];

const CRAWL_URL_CSV = [
  "Url,Timestamp,Crawled Time,Crawl Status",
  "https://example.com/page,2026-01-01,2026-01-01T00:00:00Z,SUCCESS",
].join("\n");

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Smallest response per endpoint that the SDK's own parsers accept. */
function stubFetch(input: RequestInfo | URL): Promise<Response> {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href);
  requested.push(`${url.host}${url.pathname}`);

  switch (`${url.host}${url.pathname}`) {
    case "kg.diffbot.com/kg/v3/dql":
      return Promise.resolve(
        json({
          data: [
            {
              score: 0.9,
              entity: {
                id: "EXAMPLE_ENTITY_ID",
                type: "Organization",
                name: "Example Corp",
                description: "A company that exists only in this test.",
              },
            },
          ],
        }),
      );

    case "api.diffbot.com/v3/analyze":
      return Promise.resolve(
        json({
          objects: [
            {
              title: "Example page",
              type: "article",
              pageUrl: url.searchParams.get("url"),
              text: "Example page body.",
            },
          ],
        }),
      );

    /* Job creation carries `seeds`; the watch loop's status poll does not. A
       terminal, non-failing status ends the loop on its first pass, so the
       SDK's 2 s poll interval never sleeps. */
    case "api.diffbot.com/v3/crawl":
      return Promise.resolve(
        url.searchParams.has("seeds")
          ? json({ jobs: [{ name: url.searchParams.get("name") }] })
          : json({ jobs: [{ jobStatus: { status: 9, message: "Job has completed." } }] }),
      );

    case "api.diffbot.com/v3/crawl/data":
      return Promise.resolve(
        new Response(CRAWL_URL_CSV, { status: 200, headers: { "content-type": "text/csv" } }),
      );

    case "llm.diffbot.com/api/v1/web_search":
      return Promise.resolve(
        json({
          search_results: [
            { title: "Example page", pageUrl: "https://example.com", content: "Snippet." },
          ],
        }),
      );

    default:
      return Promise.reject(
        new Error(`A README example called an endpoint with no stub: ${url.host}${url.pathname}`),
      );
  }
}

const samples = readDocExamples().filter((sample) => sample.source === "README.md");
const runnable = samples.filter((sample) => !needsLlm(sample.code));

describe("README examples", () => {
  const realFetch = globalThis.fetch;
  const realToken = process.env.DIFFBOT_API_TOKEN;

  beforeAll(() => {
    rmSync(GENERATED, { recursive: true, force: true });
    mkdirSync(GENERATED, { recursive: true });
    globalThis.fetch = stubFetch as typeof globalThis.fetch;
    /* The env path the README documents; the stub never checks it, but the
       factories must find *some* token to build a client at all. */
    process.env.DIFFBOT_API_TOKEN = "readme-example-token";
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    if (realToken === undefined) {
      delete process.env.DIFFBOT_API_TOKEN;
    } else {
      process.env.DIFFBOT_API_TOKEN = realToken;
    }
  });

  it("finds ts blocks to run, and some that only typecheck", () => {
    expect(samples.length).toBeGreaterThan(0);
    expect(runnable.length).toBeGreaterThan(0);
    expect(samples.length).toBeGreaterThan(runnable.length);
  });

  for (const sample of runnable) {
    it(`${sample.name} runs against a stubbed Diffbot API`, async () => {
      const file = resolve(GENERATED, `${sample.name}.ts`);
      writeFileSync(file, rewriteImports(sample.code), "utf8");
      await import(/* @vite-ignore */ pathToFileURL(file).href);
    });
  }

  it("the executed blocks really talked to the stub", () => {
    expect(requested).toContain("kg.diffbot.com/kg/v3/dql");
    expect(requested).toContain("api.diffbot.com/v3/analyze");
    expect(requested).toContain("api.diffbot.com/v3/crawl");
  });
});
