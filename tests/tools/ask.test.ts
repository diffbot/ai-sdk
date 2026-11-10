import { diffbotAsk, diffbotAskInputSchema } from "../../src/tools/ask.js";
import { describe, expect, it } from "vitest";
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

  it("defaults client timeout to 120s when building its own client", async () => {
    let seen: AbortSignal | undefined;
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      seen = init?.signal ?? undefined;
      return sseResponse(ASK_SSE);
    };
    const tool = diffbotAsk({ apiKey: "test-token", fetch });
    await tool.execute!({ question: "q" }, toolExecOptions());
    expect(seen?.aborted).toBe(false);
  });
});
