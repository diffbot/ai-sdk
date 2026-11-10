import { DiffbotClient } from "@diffbot/typescript";
import { DEFAULT_ASK_TIMEOUT_MS, diffbotAsk, diffbotAskInputSchema } from "../../src/tools/ask.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockFetch,
  jsonResponse,
  sseResponse,
  type MockHandler,
} from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

const ASK_URL = "https://llm.diffbot.com/rag/v1/chat/completions";

const ASK_SSE =
  'data: {"choices": [{"delta": {"content": "Diffbot was "}}]}\n' +
  'data: {"choices": [{"delta": {"content": "founded in 2008."}}]}\n' +
  "data: [DONE]\n";

async function runAsk(handler: MockHandler, input: { question: string }) {
  const tool = diffbotAsk({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
  });
  return tool.execute!(input, toolExecOptions());
}

describe("diffbotAsk", () => {
  it("aggregates a multi-chunk stream into one answer", async () => {
    const out = await runAsk(
      (req) => {
        expect(req.url).toBe(ASK_URL);
        expect(req.method).toBe("POST");
        expect(req.headers.get("Authorization")).toBe("Bearer test-token");
        expect(req.params.get("token")).toBeNull();
        const payload = JSON.parse(req.body ?? "{}") as {
          messages: Array<{ role: string; content: string }>;
          stream: boolean;
        };
        expect(payload.messages).toEqual([{ role: "user", content: "When was Diffbot founded?" }]);
        expect(payload.stream).toBe(true);
        return sseResponse(ASK_SSE);
      },
      { question: "When was Diffbot founded?" },
    );

    expect(out).toBe("Diffbot was founded in 2008.");
  });

  it("returns an empty string when the stream carries no content", async () => {
    const out = await runAsk(() => sseResponse("data: [DONE]\n"), { question: "anything?" });
    expect(out).toBe("");
  });

  it("does not throw when constructed without a token", async () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      const tool = diffbotAsk();
      await expect(tool.execute!({ question: "hi" }, toolExecOptions())).rejects.toThrow(
        "No Diffbot API token.",
      );
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
  });

  it("rejects invalid input via schema", () => {
    expect(diffbotAskInputSchema.safeParse({}).success).toBe(false);
    expect(diffbotAskInputSchema.safeParse({ question: 42 }).success).toBe(false);
    expect(diffbotAskInputSchema.safeParse({ question: "who?" }).success).toBe(true);
  });

  it("exposes description and execute", () => {
    const tool = diffbotAsk({ apiKey: "t", fetch: createMockFetch(() => jsonResponse({})) });
    expect(tool.description?.length).toBeGreaterThan(0);
    expect(typeof tool.execute).toBe("function");
  });

  describe("timeout", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function requestTimeout(options: Parameters<typeof diffbotAsk>[0]): Promise<unknown> {
      const spy = vi.spyOn(AbortSignal, "timeout");
      await diffbotAsk(options).execute!({ question: "q" }, toolExecOptions());
      expect(spy).toHaveBeenCalledTimes(1);
      return spy.mock.calls[0]![0];
    }

    const fetch = createMockFetch(() => sseResponse(ASK_SSE));

    it("defaults to 120s when the package builds the client", async () => {
      expect(await requestTimeout({ apiKey: "t", fetch })).toBe(DEFAULT_ASK_TIMEOUT_MS);
      expect(DEFAULT_ASK_TIMEOUT_MS).toBe(120_000);
    });

    it("respects an explicit factory timeout", async () => {
      expect(await requestTimeout({ apiKey: "t", fetch, timeout: 5_000 })).toBe(5_000);
    });

    it("leaves an injected client's timeout alone", async () => {
      const client = new DiffbotClient({ token: "t", fetch });
      expect(await requestTimeout({ client, timeout: 999 })).toBe(30_000);
    });
  });
});
