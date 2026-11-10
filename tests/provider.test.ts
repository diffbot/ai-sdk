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
  type MockHandler,
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

/* The SDK's env resolution falls through to `process.env`, so tests that must
   see no token have to scrub it rather than only passing an empty `env` bag. */
async function withEnvToken<T>(value: string | undefined, fn: () => Promise<T> | T): Promise<T> {
  const saved = process.env.DIFFBOT_API_TOKEN;
  if (value === undefined) delete process.env.DIFFBOT_API_TOKEN;
  else process.env.DIFFBOT_API_TOKEN = value;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
    else process.env.DIFFBOT_API_TOKEN = saved;
  }
}

describe("createDiffbot", () => {
  it("does not read the token at factory time", async () => {
    await withEnvToken(undefined, () => {
      expect(() => createDiffbot()).not.toThrow();
      expect(() => createDiffbot()("diffbot-small-xl")).not.toThrow();
    });
  });

  it("throws a clear error on the first call when the token is missing", async () => {
    await withEnvToken(undefined, async () => {
      const diffbot = createDiffbot();
      await expect(
        generateText({
          model: diffbot("diffbot-small-xl"),
          prompt: "hi",
        }),
      ).rejects.toThrow(PROVIDER_NO_TOKEN_MESSAGE);
    });
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

describe("createDiffbot auth and passthrough", () => {
  async function callWith(options: Parameters<typeof createDiffbot>[0], handler: MockHandler) {
    let seen: MockRequest | undefined;
    const diffbot = createDiffbot({
      ...options,
      fetch: createMockFetch((req) => {
        seen = req;
        return handler(req);
      }),
    });
    await generateText({ model: diffbot("diffbot-small-xl"), prompt: "hi" });
    return seen;
  }

  it("reads DIFFBOT_API_TOKEN on the call, not when the provider was built", async () => {
    let seen: MockRequest | undefined;
    const diffbot = await withEnvToken(undefined, () =>
      createDiffbot({
        fetch: createMockFetch((req) => {
          seen = req;
          return completionResponse("ok");
        }),
      }),
    );

    await withEnvToken("env-token", async () => {
      await generateText({ model: diffbot("diffbot-small-xl"), prompt: "hi" });
    });
    expect(seen?.headers.get("Authorization")).toBe("Bearer env-token");
  });

  it("reads a Workers-style env bag when apiKey is omitted", async () => {
    const seen = await withEnvToken(undefined, () =>
      callWith({ env: { DIFFBOT_API_TOKEN: "worker-token" } }, () => completionResponse("ok")),
    );
    expect(seen?.headers.get("Authorization")).toBe("Bearer worker-token");
  });

  it("treats a whitespace-only token as missing", async () => {
    await withEnvToken("   ", async () => {
      const diffbot = createDiffbot({ apiKey: "   " });
      await expect(
        generateText({ model: diffbot("diffbot-small-xl"), prompt: "hi" }),
      ).rejects.toThrow(PROVIDER_NO_TOKEN_MESSAGE);
    });
  });

  it("keeps a caller-supplied Authorization header instead of resolving a token", async () => {
    const seen = await withEnvToken(undefined, () =>
      callWith({ headers: { Authorization: "Bearer caller-owned" } }, () =>
        completionResponse("ok"),
      ),
    );
    expect(seen?.headers.get("Authorization")).toBe("Bearer caller-owned");
  });

  it("forwards custom headers and a custom baseURL", async () => {
    const seen = await callWith(
      { apiKey: "test-token", baseURL: "https://proxy.example/v1", headers: { "X-Trace": "abc" } },
      () => completionResponse("ok"),
    );
    expect(seen?.url).toBe("https://proxy.example/v1/chat/completions");
    expect(seen?.headers.get("X-Trace")).toBe("abc");
    expect(seen?.headers.get("Authorization")).toBe("Bearer test-token");
  });
});
