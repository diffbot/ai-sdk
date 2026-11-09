import { DiffbotClient } from "@diffbot/typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("constructs from apiKey when no client is given", () => {
    delete process.env.DIFFBOT_API_TOKEN;
    const fetch = createMockFetch(() => jsonResponse({}));
    const resolve = createClientResolver({ apiKey: "  api-key  ", fetch, timeout: 5_000 });
    const client = resolve();
    expect(client).toBeInstanceOf(DiffbotClient);
    expect(resolve()).toBe(client);
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

  it("ignores timeout and fetch when client is injected", () => {
    const client = new DiffbotClient({ token: "injected" });
    const resolve = createClientResolver({
      client,
      apiKey: "ignored",
      timeout: 1,
      fetch: undefined,
    });
    expect(resolve()).toBe(client);
  });
});
