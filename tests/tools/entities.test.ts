import { diffbotEntities, diffbotEntitiesInputSchema } from "../../src/tools/entities.js";
import { describe, expect, it } from "vitest";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

async function runEntities(
  handler: MockHandler,
  input: { text: string; lang?: string },
  options?: Parameters<typeof diffbotEntities>[0],
) {
  const tool = diffbotEntities({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...options,
  });
  return tool.execute!(input, toolExecOptions());
}

describe("diffbotEntities", () => {
  it("returns the response object verbatim", async () => {
    const out = await runEntities(
      () =>
        jsonResponse([
          { entities: [{ name: "Apple", type: "Organization", id: "E1" }], sentiment: 0.4 },
        ]),
      { text: "Apple CEO ..." },
    );
    expect(out).toEqual({
      entities: [{ name: "Apple", type: "Organization", id: "E1" }],
      sentiment: 0.4,
    });
  });

  it("posts the text with the default `auto` language hint", async () => {
    await runEntities(
      (req) => {
        expect(req.method).toBe("POST");
        expect(req.url).toBe("https://nl.diffbot.com/v1/");
        expect(req.params.get("token")).toBe("test-token");
        expect(JSON.parse(req.body ?? "[]")).toEqual([
          { lang: "auto", format: "plain text", content: "Apple CEO ..." },
        ]);
        return jsonResponse([{ entities: [], sentiment: 0 }]);
      },
      { text: "Apple CEO ..." },
    );
  });

  it("passes an explicit lang through to the request payload", async () => {
    await runEntities(
      (req) => {
        expect(JSON.parse(req.body ?? "[]")).toEqual([
          { lang: "fr", format: "plain text", content: "Bonjour." },
        ]);
        return jsonResponse([{ entities: [], sentiment: 0 }]);
      },
      { text: "Bonjour.", lang: "fr" },
    );
  });

  it("uses factory lang when model omits it", async () => {
    await runEntities(
      (req) => {
        expect(JSON.parse(req.body ?? "[]")).toEqual([
          { lang: "de", format: "plain text", content: "Hallo." },
        ]);
        return jsonResponse([{ entities: [], sentiment: 0 }]);
      },
      { text: "Hallo." },
      { lang: "de" },
    );
  });

  it("defers the missing-token error to execute", async () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      const tool = diffbotEntities();
      await expect(tool.execute!({ text: "x" }, toolExecOptions())).rejects.toThrow(
        "No Diffbot API token.",
      );
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
  });

  it("requires `text` and rejects a non-string lang", () => {
    expect(diffbotEntitiesInputSchema.safeParse({}).success).toBe(false);
    expect(diffbotEntitiesInputSchema.safeParse({ text: 1 }).success).toBe(false);
    expect(diffbotEntitiesInputSchema.safeParse({ text: "x", lang: 7 }).success).toBe(false);
    expect(diffbotEntitiesInputSchema.safeParse({ text: "x" }).success).toBe(true);
  });

  it("exposes description and execute", () => {
    const tool = diffbotEntities({ apiKey: "t", fetch: createMockFetch(() => jsonResponse({})) });
    expect(tool.description?.length).toBeGreaterThan(0);
    expect(typeof tool.execute).toBe("function");
  });
});
