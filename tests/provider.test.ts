import { generateText, streamText } from "ai";
import {
  PROVIDER_NO_TOKEN_MESSAGE,
  createDiffbot,
  DEFAULT_DIFFBOT_BASE_URL,
} from "../src/provider.js";
import { describe, expect, it } from "vitest";
import {
  createMockFetch,
  jsonResponse,
  sseResponse,
  type MockRequest,
} from "./helpers/mock-fetch.js";

const CHAT_URL = `${DEFAULT_DIFFBOT_BASE_URL}/chat/completions`;

const SSE_BODY =
  'data: {"choices": [{"delta": {"content": "Hello"}}]}\n\n' +
  'data: {"choices": [{"delta": {"content": ", world"}, "finish_reason": "stop"}]}\n\n' +
  "data: [DONE]\n\n";

function completionResponse(content: string) {
  return jsonResponse({
    choices: [{ message: { content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  });
}

describe("createDiffbot", () => {
  it("does not read the token at factory time", () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      expect(() => createDiffbot()).not.toThrow();
      expect(() => createDiffbot()("diffbot-small-xl")).not.toThrow();
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
  });

  it("throws a clear error on the first call when the token is missing", async () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      const diffbot = createDiffbot();
      await expect(
        generateText({
          model: diffbot("diffbot-small-xl"),
          prompt: "hi",
        }),
      ).rejects.toThrow(PROVIDER_NO_TOKEN_MESSAGE);
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
  });

  it("posts to the RAG chat/completions URL with Bearer auth and model id", async () => {
    let seen: MockRequest | undefined;
    const diffbot = createDiffbot({
      apiKey: "test-token",
      fetch: createMockFetch((req) => {
        seen = req;
        return completionResponse("Paris.");
      }),
    });

    const { text } = await generateText({
      model: diffbot("diffbot-small-xl"),
      prompt: "Capital of France?",
    });

    expect(text).toBe("Paris.");
    expect(seen?.url).toBe(CHAT_URL);
    expect(seen?.headers.get("Authorization")).toBe("Bearer test-token");
    expect(seen?.method).toBe("POST");
    const body = JSON.parse(seen?.body ?? "{}") as { model: string; stream: boolean };
    expect(body.model).toBe("diffbot-small-xl");
    expect(body.stream ?? false).toBe(false);
  });

  it("streamText yields text deltas from SSE", async () => {
    const diffbot = createDiffbot({
      apiKey: "test-token",
      fetch: createMockFetch((req) => {
        expect(req.url).toBe(CHAT_URL);
        const body = JSON.parse(req.body ?? "{}") as { stream: boolean };
        expect(body.stream).toBe(true);
        return sseResponse(SSE_BODY);
      }),
    });

    const result = streamText({
      model: diffbot.chatModel("diffbot-small"),
      prompt: "hi",
    });

    const deltas: string[] = [];
    for await (const part of result.textStream) {
      deltas.push(part);
    }
    expect(deltas.join("")).toBe("Hello, world");
  });
});
