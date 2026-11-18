/*
  Copied from langchain-diffbot-typescript/tests/helpers/mock-fetch.ts — the SDK does
  not publish it. Build a fake `fetch`, hand it to a DiffbotClient, and assert on the
  outbound request.
*/

import type { FetchFn } from "@diffbot/typescript";

export interface MockRequest {
  url: string;
  method: string;
  headers: Headers;
  params: URLSearchParams;
  body?: string;
  /** `body` parsed as JSON (POST bodies such as DQL); undefined if absent or not JSON. */
  json?: Record<string, unknown>;
}

export type MockHandler = (request: MockRequest) => Response | Promise<Response>;

function toTextBody(body: RequestInit["body"]): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  return undefined;
}

function parseJsonBody(body: string | undefined): Record<string, unknown> | undefined {
  if (body === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function createMockFetch(handler: MockHandler): FetchFn {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const body = toTextBody(init?.body ?? null);

    return handler({
      url: `${parsed.origin}${parsed.pathname}`,
      method,
      headers,
      params: parsed.searchParams,
      body,
      json: parseJsonBody(body),
    });
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function sseResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}
