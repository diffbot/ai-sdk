import { DiffbotClient, webSearch } from "@diffbot/typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_TOKEN_MESSAGE, createClientResolver } from "../src/client.js";
import { createMockFetch, jsonResponse } from "./helpers/mock-fetch.js";

describe("createClientResolver", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    process.env = { ...envSnapshot };
  });

  afterEach(() => {
    process.env = envSnapshot;
  });

  it("does not read env, construct a client, or throw until the returned function is called", () => {
    delete process.env.DIFFBOT_API_TOKEN;

    expect(() => createClientResolver()).not.toThrow();
    const resolve = createClientResolver();
    expect(() => resolve()).toThrow(NO_TOKEN_MESSAGE);
    expect(() => resolve()).toThrow(NO_TOKEN_MESSAGE);
  });

  it("prefers injected client over apiKey and env", () => {
    process.env.DIFFBOT_API_TOKEN = "env-token";
    const client = new DiffbotClient({ token: "injected" });
    const resolve = createClientResolver({ client, apiKey: "api-key" });
    expect(resolve()).toBe(client);
    expect(resolve()).toBe(client);
  });

  it("constructs from apiKey when no client is given", async () => {
    delete process.env.DIFFBOT_API_TOKEN;
    const fetch = vi.fn(createMockFetch(() => jsonResponse({})));
    const resolve = createClientResolver({ apiKey: "  api-key  ", fetch, timeout: 5_000 });
    const client = resolve();
    expect(client).toBeInstanceOf(DiffbotClient);
    expect(resolve()).toBe(client);

    // The injected fetch is forwarded to the constructed client, and the
    // trimmed apiKey — not the padded one — is the token on the wire.
    await webSearch(client, "q");
    expect(fetch).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetch.mock.calls[0]![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer api-key");
  });

  it("forwards timeout to the constructed client", async () => {
    delete process.env.DIFFBOT_API_TOKEN;
    let seen: AbortSignal | undefined;
    const fetch: typeof globalThis.fetch = (_input, init) => {
      seen = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        seen?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    };
    const resolve = createClientResolver({ apiKey: "api-key", fetch, timeout: 10 });

    await expect(webSearch(resolve(), "q")).rejects.toThrow();
    expect(seen?.aborted).toBe(true);
  });

  it("constructs from DIFFBOT_API_TOKEN when apiKey is absent", () => {
    process.env.DIFFBOT_API_TOKEN = "env-token";
    const resolve = createClientResolver();
    const client = resolve();
    expect(client).toBeInstanceOf(DiffbotClient);
  });

  it.each(["", "   "])("treats DIFFBOT_API_TOKEN=%p as missing", (token) => {
    process.env.DIFFBOT_API_TOKEN = token;
    const resolve = createClientResolver();
    expect(() => resolve()).toThrow(NO_TOKEN_MESSAGE);
  });

  it.each(["", "   "])("treats apiKey=%p as missing", (apiKey) => {
    delete process.env.DIFFBOT_API_TOKEN;
    const resolve = createClientResolver({ apiKey });
    expect(() => resolve()).toThrow(NO_TOKEN_MESSAGE);
  });

  it("ignores timeout and fetch when client is injected", async () => {
    const clientFetch = vi.fn(createMockFetch(() => jsonResponse({})));
    const authFetch = vi.fn(createMockFetch(() => jsonResponse({})));
    const client = new DiffbotClient({ token: "injected", fetch: clientFetch });
    const resolve = createClientResolver({
      client,
      apiKey: "ignored",
      timeout: 1,
      fetch: authFetch,
    });

    expect(resolve()).toBe(client);

    // `timeout: 1` would abort instantly if it were merged into the injected
    // client; the client's own fetch and timeout win instead.
    await webSearch(resolve(), "q");
    expect(clientFetch).toHaveBeenCalledTimes(1);
    expect(authFetch).not.toHaveBeenCalled();
  });
});
