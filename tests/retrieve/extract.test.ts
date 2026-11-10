import { describe, expect, it } from "vitest";
import { DiffbotClient, type JsonObject } from "@diffbot/typescript";
import { loadExtract, streamExtract } from "../../src/retrieve/extract.js";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";

const ANALYZE_URL = "https://api.diffbot.com/v3/analyze";

function load(
  handler: MockHandler,
  urls: string[],
  extra?: Omit<Parameters<typeof loadExtract>[0], "apiKey" | "fetch" | "urls">,
) {
  return loadExtract({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    urls,
    ...extra,
  });
}

describe("loadExtract", () => {
  it("yields one document per URL with the requested url in metadata", async () => {
    const seen: string[] = [];
    const docs = await load(
      (req) => {
        const url = req.params.get("url") ?? "";
        seen.push(url);
        return jsonResponse({
          objects: [{ text: `Body for ${url}`, title: "T", type: "article", pageUrl: url }],
        });
      },
      ["https://example.com/a", "https://example.com/b"],
    );

    expect(docs).toHaveLength(2);
    expect(docs[0]!.metadata.url).toBe("https://example.com/a");
    expect(docs[1]!.metadata.url).toBe("https://example.com/b");
    expect(seen).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("falls back to top-level markdown when objects carries no text", async () => {
    const docs = await load(
      () => jsonResponse({ markdown: "Top-level markdown." }),
      ["https://example.com"],
    );
    expect(docs[0]!.content).toBe("Top-level markdown.");
  });

  it("sends api and fmt to the wire", async () => {
    let params: URLSearchParams | undefined;
    await load(
      (req) => {
        params = req.params;
        expect(req.url).toBe(ANALYZE_URL);
        return jsonResponse({ objects: [{ text: "x" }] });
      },
      ["https://example.com"],
      { api: "analyze", fmt: "markdown" },
    );
    expect(params!.get("mode")).toBe("llm");
  });

  it("lets documentMapper override the default mapping", async () => {
    const customMapper = (url: string, raw: JsonObject) => ({
      content: `custom:${url}`,
      metadata: { raw },
    });
    const docs = await load(
      () => jsonResponse({ objects: [{ text: "ignored" }] }),
      ["https://example.com"],
      { documentMapper: customMapper },
    );
    expect(docs[0]!.content).toBe("custom:https://example.com");
  });
});

describe("streamExtract", () => {
  it("yields documents incrementally", async () => {
    const iterator = streamExtract({
      client: new DiffbotClient({
        token: "t",
        fetch: createMockFetch((req) => {
          const url = req.params.get("url") ?? "";
          return jsonResponse({ objects: [{ text: `Body for ${url}` }] });
        }),
      }),
      urls: ["https://example.com/a", "https://example.com/b"],
    });

    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect(first.value!.content).toBe("Body for https://example.com/a");

    const second = await iterator.next();
    expect(second.value!.content).toBe("Body for https://example.com/b");

    const done = await iterator.next();
    expect(done.done).toBe(true);
  });
});
