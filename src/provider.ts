import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { resolveTokenFromEnv } from "@diffbot/typescript";

export const DEFAULT_DIFFBOT_BASE_URL = "https://llm.diffbot.com/rag/v1";

export type DiffbotChatModelId = "diffbot-small-xl" | "diffbot-small" | (string & {});

export const PROVIDER_NO_TOKEN_MESSAGE =
  "No Diffbot API token. Pass `apiKey` to createDiffbot(), or set DIFFBOT_API_TOKEN.";

function usableToken(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface CreateDiffbotOptions {
  /** API token. Defaults to `DIFFBOT_API_TOKEN`, resolved lazily on each request. */
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  /** Workers-style env bag for token resolution when `apiKey` is omitted. */
  env?: Record<string, string | undefined>;
}

export function createDiffbot(options?: CreateDiffbotOptions) {
  const staticKey = usableToken(options?.apiKey);
  const userFetch = options?.fetch;

  const resolveToken = (): string => {
    const token = staticKey ?? usableToken(resolveTokenFromEnv(undefined, options?.env));
    if (!token) {
      throw new Error(PROVIDER_NO_TOKEN_MESSAGE);
    }
    return token;
  };

  /*
    Auth is injected here, per request, rather than through the provider's
    `apiKey` option, so nothing reads the environment at import or
    createDiffbot() time (§5.3). `@ai-sdk/openai-compatible@2` types `apiKey`
    as a plain `string` — the lazy `Resolvable` form exists only in `@3`, so it
    is unavailable while `ai@6` is a supported peer.

    An `Authorization` header that is already set wins: that covers both the
    `apiKey` option (the provider adds the header itself) and a caller passing
    their own `headers`. `globalThis.fetch` is read per request so a later
    polyfill or test double still applies.
  */
  const lazyAuthFetch: typeof globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${resolveToken()}`);
    }
    const underlying = userFetch ?? globalThis.fetch;
    return underlying(input, { ...init, headers });
  };

  return createOpenAICompatible<DiffbotChatModelId, string, string, string>({
    name: "diffbot",
    baseURL: options?.baseURL ?? DEFAULT_DIFFBOT_BASE_URL,
    ...(staticKey !== undefined ? { apiKey: staticKey } : {}),
    ...(options?.headers !== undefined ? { headers: options.headers } : {}),
    fetch: lazyAuthFetch,
  });
}

/** A `createDiffbot()` instance. */
export type DiffbotProvider = ReturnType<typeof createDiffbot>;

/** Default provider instance — the token is read lazily on the first model call. */
export const diffbot = createDiffbot();
