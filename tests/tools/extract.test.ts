import { AuthError, RateLimitError } from "@diffbot/typescript";
import { describe, expect, it } from "vitest";
import { diffbotExtract } from "../../src/tools/extract.js";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

async function runExtract(
  handler: MockHandler,
  input: { url: string; api?: string; fmt?: string },
  options?: Parameters<typeof diffbotExtract>[0],
) {
  const tool = diffbotExtract({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...options,
  });
  return tool.execute!(input, toolExecOptions());
}

describe("diffbotExtract", () => {
  it("calls api.diffbot.com/v3/analyze with ?token=", async () => {
    await runExtract(
      (req) => {
        expect(req.url).toBe("https://api.diffbot.com/v3/analyze");
        expect(req.params.get("token")).toBe("test-token");
        expect(req.params.get("url")).toBe("https://example.com");
        expect(req.params.get("mode")).toBe("llm");
        return jsonResponse({ objects: [{ text: "Body." }] });
      },
      { url: "https://example.com" },
    );
  });

  it("applies model → factory → default precedence for api and fmt", async () => {
    await runExtract(
      (req) => {
        expect(req.url).toBe("https://api.diffbot.com/v3/article");
        expect(req.params.get("mode")).toBeNull();
        return jsonResponse({ objects: [{ text: "Body." }] });
      },
      { url: "https://example.com", api: "article", fmt: "json" },
      { api: "analyze", fmt: "markdown" },
    );
  });

  it("threads factory extractOptions onto the wire", async () => {
    await runExtract(
      (req) => {
        expect(req.url).toBe("https://api.diffbot.com/v3/article");
        expect(req.params.get("timeout")).toBe("45000");
        expect(req.params.get("paging")).toBe("false");
        expect(req.params.get("fields")).toBe("links,meta");
        expect(req.params.get("mode")).toBeNull();
        return jsonResponse({ objects: [{ text: "Body." }] });
      },
      { url: "https://example.com", api: "article", fmt: "json" },
      { extractOptions: { timeout: 45_000, paging: false, fields: ["links", "meta"] } },
    );
  });

  it("keeps markdown mode and default timeout when no extractOptions are set", async () => {
    await runExtract(
      (req) => {
        expect(req.params.get("mode")).toBe("llm");
        expect(req.params.get("timeout")).toBe("30000");
        expect(req.params.has("fields")).toBe(false);
        return jsonResponse({ objects: [{ text: "Body." }] });
      },
      { url: "https://example.com" },
    );
  });

  it("shapes successful responses", async () => {
    const out = await runExtract(
      () =>
        jsonResponse({
          objects: [
            {
              text: "Hello",
              title: "Example",
              pageUrl: "https://example.com",
              type: "article",
            },
          ],
        }),
      { url: "https://example.com" },
    );
    expect(out).toMatchObject({ content: "Hello", title: "Example" });
  });

  it("returns structured data on ExtractionError", async () => {
    const out = await runExtract(() => jsonResponse({ errorCode: 500, error: "could not fetch" }), {
      url: "https://example.com",
    });
    expect(out).toMatchObject({ errorCode: 500 });
    expect((out as { error: string }).error).toContain("could not fetch");
  });

  it("rethrows AuthError and RateLimitError", async () => {
    await expect(
      runExtract(() => jsonResponse({ message: "bad token" }, 401), { url: "https://example.com" }),
    ).rejects.toBeInstanceOf(AuthError);

    await expect(
      runExtract(() => jsonResponse({ message: "slow down" }, 429), { url: "https://example.com" }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
